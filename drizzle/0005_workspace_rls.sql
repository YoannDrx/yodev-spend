CREATE OR REPLACE FUNCTION spend_current_workspace_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION spend_is_service() RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT current_user = 'spend_service' $$;
--> statement-breakpoint

ALTER TABLE "workspace_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_profiles_tenant" ON "workspace_profiles" FOR ALL
USING ("id" = spend_current_workspace_id() OR spend_is_service())
WITH CHECK ("id" = spend_current_workspace_id() OR spend_is_service());
--> statement-breakpoint

ALTER TABLE "workspace_billing_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_billing_profiles_tenant" ON "workspace_billing_profiles" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "workspace_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_subscriptions_tenant" ON "workspace_subscriptions" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "workspace_quota_states" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_quota_states_tenant" ON "workspace_quota_states" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "commercial_terms_acceptances" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_terms_acceptances_tenant" ON "commercial_terms_acceptances" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "data_deletion_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_deletion_jobs_tenant" ON "data_deletion_jobs" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
--> statement-breakpoint

ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_events_select" ON "audit_events" FOR SELECT USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
CREATE POLICY "audit_events_insert" ON "audit_events" FOR INSERT WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
--> statement-breakpoint

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_tenant" ON "clients" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_tenant" ON "projects" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "github_installations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "github_installations_tenant" ON "github_installations" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "repositories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repositories_tenant" ON "repositories" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "provider_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_connections_tenant" ON "provider_connections" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "external_resources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "external_resources_tenant" ON "external_resources" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "external_resource_projects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "external_resource_projects_tenant" ON "external_resource_projects" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "connector_sync_runs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connector_sync_runs_tenant" ON "connector_sync_runs" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "provider_plan_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_plan_versions_select" ON "provider_plan_versions" FOR SELECT USING ("workspace_id" IS NULL OR "workspace_id" = spend_current_workspace_id() OR spend_is_service());
CREATE POLICY "provider_plan_versions_write" ON "provider_plan_versions" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "usage_samples" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_samples_tenant" ON "usage_samples" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
--> statement-breakpoint

ALTER TABLE "billing_accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_accounts_tenant" ON "billing_accounts" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "billing_account_projects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_account_projects_tenant" ON "billing_account_projects" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_tenant" ON "subscriptions" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_tenant" ON "invoices" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_lines_tenant" ON "invoice_lines" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "cost_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_entries_tenant" ON "cost_entries" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
--> statement-breakpoint

ALTER TABLE "scan_runs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_runs_tenant" ON "scan_runs" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "detection_evidence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "detection_evidence_tenant" ON "detection_evidence" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "repository_provider_observations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repository_provider_observations_tenant" ON "repository_provider_observations" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "project_integrations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_integrations_tenant" ON "project_integrations" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "integration_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_events_tenant" ON "integration_events" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_tenant" ON "alerts" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
ALTER TABLE "optimization_findings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "optimization_findings_tenant" ON "optimization_findings" FOR ALL USING ("workspace_id" = spend_current_workspace_id() OR spend_is_service()) WITH CHECK ("workspace_id" = spend_current_workspace_id() OR spend_is_service());
