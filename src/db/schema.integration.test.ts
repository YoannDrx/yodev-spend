import { Client } from "pg";
import { afterAll,beforeAll,describe,expect,it } from "vitest";

const databaseUrl=process.env.TEST_DATABASE_URL;
const suite=databaseUrl?describe:describe.skip;

suite("PostgreSQL migration, seed and tenant isolation",()=>{
  const client=new Client({connectionString:databaseUrl});
  const seededWorkspace="00000000-0000-4000-8000-000000000001";
  const secondWorkspace="00000000-0000-4000-8000-000000000099";

  beforeAll(async()=>{
    await client.connect();
    await client.query("insert into auth_organizations (id,name,slug,created_at) values ($1::text,'Isolation','isolation-test',now()) on conflict do nothing",[secondWorkspace]);
    await client.query("insert into workspace_profiles (id,organization_id,name,slug,base_currency,locale) values ($1::uuid,$1::text,'Isolation','isolation-test','EUR','fr') on conflict do nothing",[secondWorkspace]);
    await client.query("insert into clients (workspace_id,name,slug) values ($1::uuid,'Isolation client','isolation-client') on conflict do nothing",[secondWorkspace]);
  });
  afterAll(()=>client.end());

  it("creates every critical table",async()=>{const result=await client.query<{table_name:string}>("select table_name from information_schema.tables where table_schema='public'");const names=new Set(result.rows.map((row)=>row.table_name));for(const name of ["workspace_profiles","clients","projects","repositories","github_installations","github_install_states","scan_runs","detection_evidence","project_integrations","billing_accounts","subscriptions","cost_entries","alerts","provider_connections","connector_sync_runs","external_resources","usage_samples","provider_plan_versions","provider_plan_entitlements","invoices","invoice_lines","optimization_findings","commercial_plans","workspace_subscriptions","commercial_webhook_events","audit_events","fx_rates"])expect(names.has(name)).toBe(true);});
  it("seeds a usable provider and project inventory",async()=>{const result=await client.query<{providers:string;projects:string}>("select (select count(*) from providers)::text providers,(select count(*) from projects)::text projects");expect(Number(result.rows[0].providers)).toBeGreaterThanOrEqual(38);expect(Number(result.rows[0].projects)).toBeGreaterThanOrEqual(3);});
  it("stores money as PostgreSQL bigint",async()=>{const result=await client.query<{data_type:string}>("select data_type from information_schema.columns where table_name='subscriptions' and column_name='amount_minor'");expect(result.rows[0].data_type).toBe("bigint");const exact=await client.query<{data_type:string}>("select data_type from information_schema.columns where table_name='cost_entries' and column_name='exact_amount_scaled'");expect(exact.rows[0].data_type).toBe("bigint");});
  it("fails closed without a workspace scope and isolates scoped reads",async()=>{
    await client.query("begin");
    try {
      await client.query("set local role spend_app");
      const unscoped=await client.query<{count:string}>("select count(*)::text count from clients");
      expect(Number(unscoped.rows[0].count)).toBe(0);
      await client.query("select set_config('app.workspace_id',$1,true)",[seededWorkspace]);
      const scoped=await client.query<{workspace_id:string}>("select distinct workspace_id::text workspace_id from clients");
      expect(scoped.rows.length).toBeGreaterThan(0);
      expect(scoped.rows.every((row)=>row.workspace_id===seededWorkspace)).toBe(true);
    } finally {
      await client.query("rollback");
    }
  });
  it("does not allow an application role to self-declare as a service",async()=>{
    await client.query("begin");
    try {
      await client.query("set local role spend_app");
      await client.query("select set_config('app.is_service','true',true)");
      const result=await client.query<{count:string}>("select count(*)::text count from clients");
      expect(Number(result.rows[0].count)).toBe(0);
    } finally {
      await client.query("rollback");
    }
  });
  it("provisions exact runtime roles without RLS bypass or auth-table access",async()=>{
    const roles=await client.query<{rolname:string;rolsuper:boolean;rolbypassrls:boolean;rolcreatedb:boolean;rolcreaterole:boolean}>("select rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole from pg_roles where rolname in ('spend_app','spend_service','spend_migration') order by rolname");
    expect(roles.rows.map((row)=>row.rolname)).toEqual(["spend_app","spend_migration","spend_service"]);
    expect(roles.rows.every((row)=>!row.rolsuper&&!row.rolbypassrls&&!row.rolcreatedb&&!row.rolcreaterole)).toBe(true);
    await client.query("begin");
    try {
      await client.query("set local role spend_app");
      await expect(client.query("select count(*) from auth_members")).rejects.toThrow();
    } finally {
      await client.query("rollback");
    }
  });
  it("lets only the service role access transient GitHub installation state",async()=>{
    await client.query("begin");
    try {
      await client.query("set local role spend_app");
      await expect(client.query("select count(*) from github_install_states")).rejects.toThrow();
    } finally {
      await client.query("rollback");
    }
    await client.query("begin");
    try {
      await client.query("set local role spend_service");
      const result=await client.query<{count:string}>("select count(*)::text count from github_install_states");
      expect(Number(result.rows[0].count)).toBeGreaterThanOrEqual(0);
    } finally {
      await client.query("rollback");
    }
  });
  it("allows a GitHub installation to belong to only one workspace",async()=>{
    await client.query("begin");
    try {
      await client.query("insert into github_installations (workspace_id,installation_id,account_login,account_type) values ($1,987654321,'seed','Organization')",[seededWorkspace]);
      await expect(client.query("insert into github_installations (workspace_id,installation_id,account_login,account_type) values ($1,987654321,'other','Organization')",[secondWorkspace])).rejects.toThrow();
    } finally {
      await client.query("rollback");
    }
  });
  it("rejects cross-workspace writes even when the row id is known",async()=>{
    await client.query("begin");
    try {
      await client.query("set local role spend_app");
      await client.query("select set_config('app.workspace_id',$1,true)",[seededWorkspace]);
      await expect(client.query("insert into clients (workspace_id,name,slug) values ($1,'Forbidden','forbidden')",[secondWorkspace])).rejects.toThrow();
    } finally {
      await client.query("rollback");
    }
  });
});
