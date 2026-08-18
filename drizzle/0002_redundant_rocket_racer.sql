CREATE TYPE "public"."allocation_method" AS ENUM('direct', 'equal', 'usage_proportional', 'cost_proportional', 'manual', 'workspace_unallocated');--> statement-breakpoint
CREATE TYPE "public"."cost_amount_basis" AS ENUM('invoice', 'provider_charge', 'usage_calculation', 'contract', 'manual');--> statement-breakpoint
CREATE TYPE "public"."cost_amount_status" AS ENUM('commitment', 'accrued', 'estimated', 'final');--> statement-breakpoint
CREATE TYPE "public"."external_resource_status" AS ENUM('active', 'inactive', 'deleted', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('estimated', 'issued', 'paid', 'void', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."optimization_confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."optimization_status" AS ENUM('open', 'accepted', 'ignored', 'snoozed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."provider_auth_type" AS ENUM('oauth2', 'api_key', 'admin_key', 'service_account', 'access_token', 'email', 'manual');--> statement-breakpoint
CREATE TYPE "public"."provider_connection_status" AS ENUM('pending', 'active', 'invalid', 'rate_limited', 'error', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sync_capability" AS ENUM('accounts', 'resources', 'subscriptions', 'plans', 'usage', 'accrued_costs', 'invoices');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'running', 'success', 'partial', 'failed', 'rate_limited', 'skipped');--> statement-breakpoint
ALTER TYPE "public"."cost_kind" ADD VALUE 'fee' BEFORE 'manual';--> statement-breakpoint
ALTER TYPE "public"."cost_kind" ADD VALUE 'refund' BEFORE 'manual';--> statement-breakpoint
ALTER TYPE "public"."cost_kind" ADD VALUE 'adjustment' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE "connector_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"capability" "sync_capability" NOT NULL,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(240) NOT NULL,
	"requested_from" timestamp with time zone,
	"requested_to" timestamp with time zone,
	"covered_from" timestamp with time zone,
	"covered_to" timestamp with time zone,
	"cursor_before" text,
	"cursor_after" text,
	"records_read" integer DEFAULT 0 NOT NULL,
	"records_written" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"error_code" varchar(100),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_sync_period_check" CHECK ("connector_sync_runs"."requested_from" is null or "connector_sync_runs"."requested_to" is null or "connector_sync_runs"."requested_to" >= "connector_sync_runs"."requested_from")
);
--> statement-breakpoint
CREATE TABLE "external_resource_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"external_resource_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"allocation_bps" integer DEFAULT 10000 NOT NULL,
	"allocation_method" "allocation_method" DEFAULT 'direct' NOT NULL,
	"confirmed_by_user" boolean DEFAULT false NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_resource_allocation_check" CHECK ("external_resource_projects"."allocation_bps" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "external_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"external_id" varchar(240) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"name" varchar(240) NOT NULL,
	"region" varchar(80),
	"status" "external_resource_status" DEFAULT 'unknown' NOT NULL,
	"parent_external_id" varchar(240),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"external_resource_id" uuid,
	"project_id" uuid,
	"external_id" varchar(240) NOT NULL,
	"description" text NOT NULL,
	"product_code" varchar(180),
	"quantity_scaled" bigint,
	"quantity_scale" integer DEFAULT 0 NOT NULL,
	"unit" varchar(80),
	"unit_amount_scaled" bigint,
	"unit_amount_scale" integer DEFAULT 2 NOT NULL,
	"gross_minor" bigint,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"net_minor" bigint NOT NULL,
	"tax_minor" bigint,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_lines_quantity_scale_check" CHECK ("invoice_lines"."quantity_scale" between 0 and 18),
	CONSTRAINT "invoice_lines_amount_scale_check" CHECK ("invoice_lines"."unit_amount_scale" between 0 and 18)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"connection_id" uuid,
	"external_resource_id" uuid,
	"external_id" varchar(240) NOT NULL,
	"invoice_number" varchar(180),
	"issued_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"currency" varchar(3) NOT NULL,
	"subtotal_minor" bigint,
	"tax_minor" bigint,
	"total_minor" bigint NOT NULL,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"source" varchar(80) NOT NULL,
	"document_hash" varchar(128),
	"source_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_period_check" CHECK ("invoices"."period_end" >= "invoices"."period_start")
);
--> statement-breakpoint
CREATE TABLE "optimization_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid,
	"provider_id" uuid NOT NULL,
	"billing_account_id" uuid,
	"subscription_id" uuid,
	"external_resource_id" uuid,
	"project_id" uuid,
	"type" varchar(100) NOT NULL,
	"status" "optimization_status" DEFAULT 'open' NOT NULL,
	"confidence" "optimization_confidence" DEFAULT 'low' NOT NULL,
	"dedupe_key" varchar(240) NOT NULL,
	"title" varchar(240) NOT NULL,
	"description" text NOT NULL,
	"currency" varchar(3),
	"savings_min_minor" bigint,
	"savings_max_minor" bigint,
	"observation_from" timestamp with time zone NOT NULL,
	"observation_to" timestamp with time zone NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocking_features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rule_version" varchar(40) NOT NULL,
	"first_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_validated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snoozed_until" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "optimization_findings_period_check" CHECK ("optimization_findings"."observation_to" >= "optimization_findings"."observation_from"),
	CONSTRAINT "optimization_findings_savings_check" CHECK ("optimization_findings"."savings_min_minor" is null or "optimization_findings"."savings_max_minor" is null or "optimization_findings"."savings_max_minor" >= "optimization_findings"."savings_min_minor")
);
--> statement-breakpoint
CREATE TABLE "plan_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"metric_key" varchar(120) NOT NULL,
	"included_quantity_scaled" bigint,
	"quantity_scale" integer DEFAULT 0 NOT NULL,
	"unit" varchar(80) NOT NULL,
	"limit_type" varchar(32) DEFAULT 'soft' NOT NULL,
	"overage_amount_scaled" bigint,
	"overage_amount_scale" integer DEFAULT 2 NOT NULL,
	"overage_currency" varchar(3),
	"overage_per_quantity_scaled" bigint,
	"overage_per_quantity_scale" integer DEFAULT 0 NOT NULL,
	"scope" varchar(32) DEFAULT 'account' NOT NULL,
	"required_feature" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_entitlements_quantity_scale_check" CHECK ("plan_entitlements"."quantity_scale" between 0 and 18),
	CONSTRAINT "plan_entitlements_amount_scale_check" CHECK ("plan_entitlements"."overage_amount_scale" between 0 and 18)
);
--> statement-breakpoint
CREATE TABLE "plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"provider_id" uuid NOT NULL,
	"connection_id" uuid,
	"external_id" varchar(240) NOT NULL,
	"name" varchar(180) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"billing_interval" "billing_interval" DEFAULT 'none' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"source" varchar(80) NOT NULL,
	"source_url" text,
	"last_verified_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_versions_connection_scope_check" CHECK (("plan_versions"."connection_id" is null) or ("plan_versions"."workspace_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"auth_type" "provider_auth_type" NOT NULL,
	"status" "provider_connection_status" DEFAULT 'pending' NOT NULL,
	"external_account_id" varchar(240),
	"external_account_name" varchar(240),
	"capabilities" jsonb NOT NULL,
	"credential_ciphertext" text,
	"credential_iv" varchar(64),
	"credential_tag" varchar(64),
	"credential_key_version" integer DEFAULT 1 NOT NULL,
	"credential_expires_at" timestamp with time zone,
	"last_validated_at" timestamp with time zone,
	"last_successful_sync_at" timestamp with time zone,
	"last_error_code" varchar(100),
	"created_by_user_id" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections_credentials_check" CHECK (("provider_connections"."credential_ciphertext" is null and "provider_connections"."credential_iv" is null and "provider_connections"."credential_tag" is null) or ("provider_connections"."credential_ciphertext" is not null and "provider_connections"."credential_iv" is not null and "provider_connections"."credential_tag" is not null))
);
--> statement-breakpoint
CREATE TABLE "usage_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"key" varchar(120) NOT NULL,
	"name" varchar(180) NOT NULL,
	"unit" varchar(80) NOT NULL,
	"aggregating_method" varchar(32) DEFAULT 'sum' NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_resource_id" uuid,
	"metric_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"quantity_scaled" bigint NOT NULL,
	"quantity_scale" integer DEFAULT 0 NOT NULL,
	"source" varchar(80) NOT NULL,
	"external_id" varchar(240) NOT NULL,
	"quality" varchar(32) DEFAULT 'provider_reported' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_samples_period_check" CHECK ("usage_samples"."period_end" >= "usage_samples"."period_start"),
	CONSTRAINT "usage_samples_scale_check" CHECK ("usage_samples"."quantity_scale" between 0 and 18)
);
--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "external_resource_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "invoice_line_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "exact_amount_scaled" bigint;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "exact_amount_scale" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "amount_status" "cost_amount_status" DEFAULT 'final' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "amount_basis" "cost_amount_basis" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "superseded_by_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan_version_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "source" varchar(64) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "external_id" varchar(240);--> statement-breakpoint
ALTER TABLE "connector_sync_runs" ADD CONSTRAINT "connector_sync_runs_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_sync_runs" ADD CONSTRAINT "connector_sync_runs_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resource_projects" ADD CONSTRAINT "external_resource_projects_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resource_projects" ADD CONSTRAINT "external_resource_projects_external_resource_id_external_resources_id_fk" FOREIGN KEY ("external_resource_id") REFERENCES "public"."external_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resource_projects" ADD CONSTRAINT "external_resource_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_resources" ADD CONSTRAINT "external_resources_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_external_resource_id_external_resources_id_fk" FOREIGN KEY ("external_resource_id") REFERENCES "public"."external_resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_external_resource_id_external_resources_id_fk" FOREIGN KEY ("external_resource_id") REFERENCES "public"."external_resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_findings" ADD CONSTRAINT "optimization_findings_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_findings" ADD CONSTRAINT "optimization_findings_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_findings" ADD CONSTRAINT "optimization_findings_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_findings" ADD CONSTRAINT "optimization_findings_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_findings" ADD CONSTRAINT "optimization_findings_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_findings" ADD CONSTRAINT "optimization_findings_external_resource_id_external_resources_id_fk" FOREIGN KEY ("external_resource_id") REFERENCES "public"."external_resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_findings" ADD CONSTRAINT "optimization_findings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_created_by_user_id_auth_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_samples" ADD CONSTRAINT "usage_samples_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_samples" ADD CONSTRAINT "usage_samples_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_samples" ADD CONSTRAINT "usage_samples_external_resource_id_external_resources_id_fk" FOREIGN KEY ("external_resource_id") REFERENCES "public"."external_resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_samples" ADD CONSTRAINT "usage_samples_metric_id_usage_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."usage_metrics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connector_sync_runs_idempotency_idx" ON "connector_sync_runs" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_sync_runs_active_idx" ON "connector_sync_runs" USING btree ("connection_id","capability") WHERE "connector_sync_runs"."status" in ('pending', 'running');--> statement-breakpoint
CREATE INDEX "connector_sync_runs_connection_idx" ON "connector_sync_runs" USING btree ("workspace_id","connection_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_resource_projects_active_idx" ON "external_resource_projects" USING btree ("workspace_id","external_resource_id","project_id") WHERE "external_resource_projects"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "external_resource_projects_project_idx" ON "external_resource_projects" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_resources_connection_external_idx" ON "external_resources" USING btree ("workspace_id","connection_id","external_id");--> statement-breakpoint
CREATE INDEX "external_resources_provider_idx" ON "external_resources" USING btree ("workspace_id","provider_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_external_idx" ON "invoice_lines" USING btree ("invoice_id","external_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_resource_idx" ON "invoice_lines" USING btree ("workspace_id","external_resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_source_external_idx" ON "invoices" USING btree ("workspace_id","source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_document_hash_idx" ON "invoices" USING btree ("workspace_id","document_hash") WHERE "invoices"."document_hash" is not null;--> statement-breakpoint
CREATE INDEX "invoices_account_period_idx" ON "invoices" USING btree ("workspace_id","billing_account_id","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "optimization_findings_active_idx" ON "optimization_findings" USING btree ("workspace_id","dedupe_key") WHERE "optimization_findings"."status" in ('open', 'accepted', 'ignored', 'snoozed');--> statement-breakpoint
CREATE INDEX "optimization_findings_workspace_idx" ON "optimization_findings" USING btree ("workspace_id","status","confidence");--> statement-breakpoint
CREATE INDEX "optimization_findings_connection_idx" ON "optimization_findings" USING btree ("workspace_id","connection_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_entitlements_metric_idx" ON "plan_entitlements" USING btree ("plan_version_id","metric_key");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_versions_global_identity_idx" ON "plan_versions" USING btree ("provider_id","external_id","effective_from") WHERE "plan_versions"."workspace_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_versions_workspace_identity_idx" ON "plan_versions" USING btree ("workspace_id","provider_id","external_id","effective_from") WHERE "plan_versions"."workspace_id" is not null;--> statement-breakpoint
CREATE INDEX "plan_versions_workspace_idx" ON "plan_versions" USING btree ("workspace_id","provider_id");--> statement-breakpoint
CREATE INDEX "plan_versions_provider_idx" ON "plan_versions" USING btree ("provider_id","effective_to");--> statement-breakpoint
CREATE INDEX "provider_connections_workspace_idx" ON "provider_connections" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "provider_connections_provider_idx" ON "provider_connections" USING btree ("workspace_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_external_account_idx" ON "provider_connections" USING btree ("workspace_id","provider_id","external_account_id") WHERE "provider_connections"."external_account_id" is not null and "provider_connections"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_metrics_provider_key_idx" ON "usage_metrics" USING btree ("provider_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_samples_source_external_idx" ON "usage_samples" USING btree ("workspace_id","connection_id","external_id");--> statement-breakpoint
CREATE INDEX "usage_samples_period_idx" ON "usage_samples" USING btree ("workspace_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "usage_samples_resource_metric_idx" ON "usage_samples" USING btree ("workspace_id","external_resource_id","metric_id");--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_connection_id_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."provider_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_external_resource_id_external_resources_id_fk" FOREIGN KEY ("external_resource_id") REFERENCES "public"."external_resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_superseded_by_invoice_id_invoices_id_fk" FOREIGN KEY ("superseded_by_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_accounts_connection_idx" ON "billing_accounts" USING btree ("workspace_id","connection_id");--> statement-breakpoint
CREATE INDEX "cost_entries_resource_idx" ON "cost_entries" USING btree ("workspace_id","external_resource_id");--> statement-breakpoint
CREATE INDEX "cost_entries_project_idx" ON "cost_entries" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "cost_entries_invoice_idx" ON "cost_entries" USING btree ("workspace_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_source_external_idx" ON "subscriptions" USING btree ("workspace_id","source","external_id") WHERE "subscriptions"."external_id" is not null;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entry_exact_scale_check" CHECK ("cost_entries"."exact_amount_scale" between 0 and 18);