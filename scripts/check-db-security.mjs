import pg from "pg";

// Read-only deployment gate. Never print connection strings or database error text.
const targets = [["DATABASE_APP_URL", "spend_app"], ["DATABASE_SERVICE_URL", "spend_service"]];
let failed = false;
for (const [variable, expectedRole] of targets) {
  if (!process.env[variable]) { console.error(`${variable} is required.`); failed = true; continue; }
  const client = new pg.Client({connectionString: process.env[variable]});
  try {
    await client.connect();
    const {rows: [role]} = await client.query("select current_user name,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user");
    if (role.name !== expectedRole || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole) throw new Error("UNSAFE_ROLE");
    const {rows: tables} = await client.query(`select c.relname, c.relrowsecurity, pg_get_userbyid(c.relowner) owner
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname not in ('beta_invitations','commercial_webhook_events') and exists
      (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='workspace_id' and not a.attisdropped)`);
    if (tables.length < 20 || tables.some(table=>!table.relrowsecurity || ["spend_app","spend_service"].includes(table.owner))) throw new Error("UNSAFE_TENANT_TABLES");
    if (expectedRole === "spend_app") {
      const {rows: [grants]} = await client.query("select has_table_privilege(current_user,'auth_accounts','SELECT') auth, has_table_privilege(current_user,'github_install_states','SELECT') install");
      if (grants.auth || grants.install) throw new Error("UNSAFE_IDENTITY_GRANTS");
      const {rows: [count]} = await client.query("select count(*)::int value from clients");
      if (count.value !== 0) throw new Error("UNSCOPED_TENANT_READ");
    }
    console.log(`${expectedRole}: identity, role attributes, tenant RLS and grants verified (${tables.length} tenant tables).`);
  } catch {
    failed = true;
    console.error(`${expectedRole}: database security verification failed. Check connectivity, grants, RLS and role ownership.`);
  } finally { await client.end().catch(()=>undefined); }
}
if (failed) process.exitCode = 1;
