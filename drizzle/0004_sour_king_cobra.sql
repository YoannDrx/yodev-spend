ALTER TABLE "plan_entitlements" RENAME TO "provider_plan_entitlements";--> statement-breakpoint
ALTER TABLE "plan_versions" RENAME TO "provider_plan_versions";--> statement-breakpoint
ALTER TABLE "provider_plan_entitlements" DROP CONSTRAINT "plan_entitlements_quantity_scale_check";--> statement-breakpoint
ALTER TABLE "provider_plan_entitlements" DROP CONSTRAINT "plan_entitlements_amount_scale_check";--> statement-breakpoint
ALTER TABLE "provider_plan_versions" DROP CONSTRAINT "plan_versions_connection_scope_check";--> statement-breakpoint
ALTER TABLE "provider_plan_entitlements" DROP CONSTRAINT "plan_entitlements_plan_version_id_plan_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "provider_plan_versions" DROP CONSTRAINT "plan_versions_workspace_id_workspace_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "provider_plan_versions" DROP CONSTRAINT "plan_versions_provider_id_providers_id_fk";
--> statement-breakpoint
ALTER TABLE "provider_plan_versions" DROP CONSTRAINT "plan_versions_connection_id_provider_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_version_id_plan_versions_id_fk";
--> statement-breakpoint
DROP INDEX "plan_entitlements_metric_idx";--> statement-breakpoint
DROP INDEX "plan_versions_global_identity_idx";--> statement-breakpoint
DROP INDEX "plan_versions_workspace_identity_idx";--> statement-breakpoint
DROP INDEX "plan_versions_workspace_idx";--> statement-breakpoint
DROP INDEX "plan_versions_provider_idx";--> statement-breakpoint
ALTER TABLE "provider_plan_entitlements" ADD CONSTRAINT "provider_plan_entitlements_plan_version_id_provider_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."provider_plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_plan_versions" ADD CONSTRAINT "provider_plan_versions_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_plan_versions" ADD CONSTRAINT "provider_plan_versions_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_plan_versions" ADD CONSTRAINT "provider_plan_versions_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_version_id_provider_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."provider_plan_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_plan_entitlements_metric_idx" ON "provider_plan_entitlements" USING btree ("plan_version_id","metric_key");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_plan_versions_global_identity_idx" ON "provider_plan_versions" USING btree ("provider_id","external_id","effective_from") WHERE "provider_plan_versions"."workspace_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_plan_versions_workspace_identity_idx" ON "provider_plan_versions" USING btree ("workspace_id","provider_id","external_id","effective_from") WHERE "provider_plan_versions"."workspace_id" is not null;--> statement-breakpoint
CREATE INDEX "provider_plan_versions_workspace_idx" ON "provider_plan_versions" USING btree ("workspace_id","provider_id");--> statement-breakpoint
CREATE INDEX "provider_plan_versions_provider_idx" ON "provider_plan_versions" USING btree ("provider_id","effective_to");--> statement-breakpoint
ALTER TABLE "provider_plan_entitlements" ADD CONSTRAINT "provider_plan_entitlements_quantity_scale_check" CHECK ("provider_plan_entitlements"."quantity_scale" between 0 and 18);--> statement-breakpoint
ALTER TABLE "provider_plan_entitlements" ADD CONSTRAINT "provider_plan_entitlements_amount_scale_check" CHECK ("provider_plan_entitlements"."overage_amount_scale" between 0 and 18);--> statement-breakpoint
ALTER TABLE "provider_plan_versions" ADD CONSTRAINT "provider_plan_versions_connection_scope_check" CHECK (("provider_plan_versions"."connection_id" is null) or ("provider_plan_versions"."workspace_id" is not null));