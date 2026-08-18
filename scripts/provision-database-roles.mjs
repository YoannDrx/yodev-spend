import pg from "pg";

const { Client } = pg;

const adminUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL_UNPOOLED;
const appPassword = process.env.SPEND_APP_DB_PASSWORD;
const servicePassword = process.env.SPEND_SERVICE_DB_PASSWORD;
const migrationPassword = process.env.SPEND_MIGRATION_DB_PASSWORD;

if (!adminUrl) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL_UNPOOLED is required.");
if (!appPassword || !servicePassword || !migrationPassword) {
  throw new Error("SPEND_APP_DB_PASSWORD, SPEND_SERVICE_DB_PASSWORD and SPEND_MIGRATION_DB_PASSWORD are required.");
}

const tenantTables = [
  "alerts",
  "audit_events",
  "billing_account_projects",
  "billing_accounts",
  "clients",
  "commercial_terms_acceptances",
  "connector_sync_runs",
  "cost_entries",
  "data_deletion_jobs",
  "detection_evidence",
  "external_resource_projects",
  "external_resources",
  "github_installations",
  "integration_events",
  "invoice_lines",
  "invoices",
  "optimization_findings",
  "project_integrations",
  "projects",
  "provider_connections",
  "provider_plan_versions",
  "repositories",
  "repository_provider_observations",
  "scan_runs",
  "subscriptions",
  "usage_samples",
  "workspace_billing_profiles",
  "workspace_profiles",
  "workspace_quota_states",
  "workspace_subscriptions",
];

const globalReadTables = ["commercial_plans", "fx_rates", "provider_plan_entitlements", "providers", "usage_metrics"];

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function setPassword(client, role, password) {
  const { rows } = await client.query("select format('alter role %I password %L', $1::text, $2::text) command", [role, password]);
  await client.query(rows[0].command);
}

const client = new Client({ connectionString: adminUrl });
await client.connect();
try {
  await client.query("begin");
  await client.query(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'spend_migration') then create role spend_migration login noinherit nocreatedb nocreaterole; end if;
    if not exists (select 1 from pg_roles where rolname = 'spend_service') then create role spend_service login noinherit nocreatedb nocreaterole; end if;
    if not exists (select 1 from pg_roles where rolname = 'spend_app') then create role spend_app login noinherit nocreatedb nocreaterole; end if;
  end $$`);
  await client.query("alter role spend_migration noinherit nocreatedb nocreaterole");
  await client.query("alter role spend_service noinherit nocreatedb nocreaterole");
  await client.query("alter role spend_app noinherit nocreatedb nocreaterole");
  const unsafeRoles = await client.query(`select rolname from pg_roles
    where rolname in ('spend_app', 'spend_service', 'spend_migration')
      and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole)`);
  if (unsafeRoles.rowCount) {
    throw new Error(`Unsafe database role attributes: ${unsafeRoles.rows.map((row) => row.rolname).join(", ")}`);
  }
  await setPassword(client, "spend_app", appPassword);
  await setPassword(client, "spend_service", servicePassword);
  await setPassword(client, "spend_migration", migrationPassword);

  const adminUser = new URL(adminUrl).username;
  await client.query(`grant spend_migration to ${quoteIdentifier(decodeURIComponent(adminUser))}`);
  const { rows: databaseRows } = await client.query("select current_database() name");
  await client.query(`grant connect on database ${quoteIdentifier(databaseRows[0].name)} to spend_app, spend_service, spend_migration`);
  await client.query(`grant create on database ${quoteIdentifier(databaseRows[0].name)} to spend_migration`);
  await client.query("alter schema public owner to spend_migration");
  await client.query("grant usage, create on schema public to spend_migration");
  await client.query(`do $$
    declare object record;
    begin
      if exists (select 1 from pg_namespace where nspname = 'drizzle') then
        execute 'alter schema drizzle owner to spend_migration';
      end if;
      for object in
        select n.nspname schema_name, c.relname object_name, c.relkind
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'drizzle')
          and c.relkind in ('r', 'p', 'v', 'm', 'S')
          and pg_get_userbyid(c.relowner) = current_user
          and (c.relkind <> 'S' or not exists (
            select 1 from pg_depend d
            where d.classid = 'pg_class'::regclass
              and d.objid = c.oid
              and d.deptype in ('a', 'i')
          ))
      loop
        execute format(
          case when object.relkind = 'S' then 'alter sequence %I.%I owner to spend_migration'
               when object.relkind = 'v' then 'alter view %I.%I owner to spend_migration'
               when object.relkind = 'm' then 'alter materialized view %I.%I owner to spend_migration'
               else 'alter table %I.%I owner to spend_migration' end,
          object.schema_name,
          object.object_name
        );
      end loop;
      for object in
        select n.nspname schema_name, p.proname object_name, pg_get_function_identity_arguments(p.oid) arguments
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and pg_get_userbyid(p.proowner) = current_user
      loop
        execute format('alter function %I.%I(%s) owner to spend_migration', object.schema_name, object.object_name, object.arguments);
      end loop;
      for object in
        select n.nspname schema_name, t.typname object_name
        from pg_type t join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e' and pg_get_userbyid(t.typowner) = current_user
      loop
        execute format('alter type %I.%I owner to spend_migration', object.schema_name, object.object_name);
      end loop;
    end $$`);
  await client.query("revoke create on schema public from public");
  await client.query("revoke all on all tables in schema public from public");
  await client.query("revoke all on all sequences in schema public from public");
  await client.query("revoke all on all functions in schema public from public");
  await client.query("grant usage on schema public to spend_app, spend_service");
  await client.query("grant select, insert, update, delete on all tables in schema public to spend_service");
  await client.query("grant usage, select, update on all sequences in schema public to spend_service");
  await client.query("grant execute on all functions in schema public to spend_service");

  const existingTables = await client.query("select tablename from pg_tables where schemaname = 'public'");
  const existing = new Set(existingTables.rows.map((row) => row.tablename));
  const appTenantTables = tenantTables.filter((table) => existing.has(table));
  const appGlobalTables = globalReadTables.filter((table) => existing.has(table));
  if (appTenantTables.length) {
    await client.query(`grant select, insert, update, delete on ${appTenantTables.map((table) => `public.${quoteIdentifier(table)}`).join(", ")} to spend_app`);
  }
  if (appGlobalTables.length) {
    await client.query(`grant select on ${appGlobalTables.map((table) => `public.${quoteIdentifier(table)}`).join(", ")} to spend_app`);
  }
  const restrictedTables = [
    "auth_accounts", "auth_invitations", "auth_members", "auth_organizations", "auth_rate_limits", "auth_sessions", "auth_users", "auth_verifications",
    "beta_invitations", "commercial_webhook_events", "github_install_states",
  ].filter((table) => existing.has(table));
  if (restrictedTables.length) {
    await client.query(`revoke all on ${restrictedTables.map((table) => `public.${quoteIdentifier(table)}`).join(", ")} from spend_app`);
  }
  await client.query("grant usage, select, update on all sequences in schema public to spend_app");
  for (const functionName of ["spend_current_workspace_id", "spend_is_service"]) {
    const present = await client.query("select 1 from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace where nspname = 'public' and proname = $1", [functionName]);
    if (present.rowCount) await client.query(`grant execute on function public.${quoteIdentifier(functionName)}() to spend_app`);
  }

  await client.query("alter default privileges for role spend_migration in schema public grant select, insert, update, delete on tables to spend_service");
  await client.query("alter default privileges for role spend_migration in schema public grant usage, select, update on sequences to spend_service");
  await client.query("alter default privileges for role spend_migration in schema public grant execute on functions to spend_service");
  await client.query("commit");
  console.log(`Database runtime roles provisioned for ${new URL(adminUrl).pathname.slice(1)}.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
