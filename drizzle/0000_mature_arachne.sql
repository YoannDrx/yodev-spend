CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('NEW_PROVIDER_DETECTED', 'PROVIDER_STALE', 'PROVIDER_REMOVED', 'POSSIBLE_MIGRATION', 'PAID_PROVIDER_WITHOUT_PROJECT', 'PROJECT_PROVIDER_WITHOUT_BILLING', 'RENEWAL_SOON', 'SCAN_FAILED');--> statement-breakpoint
CREATE TYPE "public"."billing_account_status" AS ENUM('active', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year', 'none');--> statement-breakpoint
CREATE TYPE "public"."billing_model" AS ENUM('free', 'fixed_monthly', 'fixed_yearly', 'usage', 'fixed_plus_usage', 'manual');--> statement-breakpoint
CREATE TYPE "public"."billing_owner" AS ENUM('workspace', 'client', 'shared');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."cost_kind" AS ENUM('subscription', 'usage', 'credit', 'tax', 'manual');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('package', 'env_variable', 'import', 'config_file', 'domain', 'workflow', 'iac', 'manual');--> statement-breakpoint
CREATE TYPE "public"."github_installation_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."integration_lifecycle" AS ENUM('candidate', 'active', 'stale', 'removed');--> statement-breakpoint
CREATE TYPE "public"."integration_review" AS ENUM('pending', 'confirmed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'maintenance', 'archived');--> statement-breakpoint
CREATE TYPE "public"."provider_category" AS ENUM('hosting', 'cloud', 'database', 'email', 'observability', 'analytics', 'ai', 'payments', 'authentication', 'storage', 'dns', 'maps', 'messaging', 'ci', 'cms', 'developer_tool', 'other');--> statement-breakpoint
CREATE TYPE "public"."repository_source" AS ENUM('github');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'running', 'success', 'partial', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."scan_trigger" AS ENUM('manual', 'scheduled', 'initial');--> statement-breakpoint
CREATE TYPE "public"."scan_type" AS ENUM('quick', 'deep');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'archived');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" "alert_type" NOT NULL,
	"severity" "alert_severity" DEFAULT 'warning' NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"dedupe_key" varchar(220) NOT NULL,
	"provider_id" uuid,
	"project_id" uuid,
	"billing_account_id" uuid,
	"title" varchar(240) NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "auth_organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"github_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email"),
	CONSTRAINT "auth_users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_account_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"allocation_bps" integer DEFAULT 10000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"client_id" uuid,
	"name" varchar(180) NOT NULL,
	"owner_type" "billing_owner" DEFAULT 'workspace' NOT NULL,
	"status" "billing_account_status" DEFAULT 'active' NOT NULL,
	"default_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"source" varchar(64) DEFAULT 'manual' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"subscription_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"kind" "cost_kind" NOT NULL,
	"source" varchar(64) DEFAULT 'manual' NOT NULL,
	"external_id" varchar(180),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detection_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"scan_run_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"type" "evidence_type" NOT NULL,
	"key" text NOT NULL,
	"file_path" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weight" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"installation_id" bigint NOT NULL,
	"account_login" varchar(140) NOT NULL,
	"account_type" varchar(32) NOT NULL,
	"status" "github_installation_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"actor_user_id" text,
	"event_type" varchar(64) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"lifecycle_status" "integration_lifecycle" DEFAULT 'candidate' NOT NULL,
	"review_status" "integration_review" DEFAULT 'pending' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"evidence_signature" varchar(64),
	"first_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_detected_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"ignored_at" timestamp with time zone,
	"stale_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" "provider_category" NOT NULL,
	"website_url" text,
	"discovery_supported" boolean DEFAULT true NOT NULL,
	"billing_supported" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"github_installation_id" uuid,
	"source" "repository_source" DEFAULT 'github' NOT NULL,
	"external_id" bigint NOT NULL,
	"owner" varchar(140) NOT NULL,
	"name" varchar(140) NOT NULL,
	"full_name" varchar(300) NOT NULL,
	"default_branch" varchar(140) DEFAULT 'main' NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"html_url" text NOT NULL,
	"last_known_commit_sha" varchar(64),
	"last_scanned_commit_sha" varchar(64),
	"last_successful_scan_at" timestamp with time zone,
	"last_scan_attempt_at" timestamp with time zone,
	"scan_enabled" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_provider_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"present" boolean DEFAULT false NOT NULL,
	"consecutive_absences" integer DEFAULT 0 NOT NULL,
	"first_absent_at" timestamp with time zone,
	"last_detected_at" timestamp with time zone,
	"last_successful_scan_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	"type" "scan_type" NOT NULL,
	"trigger" "scan_trigger" NOT NULL,
	"status" "scan_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(180),
	"commit_sha" varchar(64),
	"fingerprint_version" varchar(32) DEFAULT '1' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" varchar(80),
	"error_message" text,
	"files_inspected" integer DEFAULT 0 NOT NULL,
	"bytes_inspected" integer DEFAULT 0 NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"billing_model" "billing_model" NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"billing_interval" "billing_interval" DEFAULT 'none' NOT NULL,
	"renewal_date" timestamp with time zone,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" varchar(140) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"base_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"locale" varchar(8) DEFAULT 'fr' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Europe/Paris' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_organization_id_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."auth_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_invitations" ADD CONSTRAINT "auth_invitations_inviter_id_auth_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_members" ADD CONSTRAINT "auth_members_organization_id_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."auth_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_members" ADD CONSTRAINT "auth_members_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_active_organization_id_auth_organizations_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."auth_organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD CONSTRAINT "billing_account_projects_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD CONSTRAINT "billing_account_projects_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD CONSTRAINT "billing_account_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_evidence" ADD CONSTRAINT "detection_evidence_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_evidence" ADD CONSTRAINT "detection_evidence_scan_run_id_scan_runs_id_fk" FOREIGN KEY ("scan_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_evidence" ADD CONSTRAINT "detection_evidence_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_evidence" ADD CONSTRAINT "detection_evidence_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_integration_id_project_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."project_integrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_actor_user_id_auth_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_github_installation_id_github_installations_id_fk" FOREIGN KEY ("github_installation_id") REFERENCES "public"."github_installations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_provider_observations" ADD CONSTRAINT "repository_provider_observations_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_provider_observations" ADD CONSTRAINT "repository_provider_observations_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_provider_observations" ADD CONSTRAINT "repository_provider_observations_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_provider_observations" ADD CONSTRAINT "repository_provider_observations_last_successful_scan_run_id_scan_runs_id_fk" FOREIGN KEY ("last_successful_scan_run_id") REFERENCES "public"."scan_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_profiles" ADD CONSTRAINT "workspace_profiles_organization_id_auth_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."auth_organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_open_dedupe_idx" ON "alerts" USING btree ("workspace_id","dedupe_key") WHERE "alerts"."status" = 'open';--> statement-breakpoint
CREATE INDEX "alerts_workspace_status_idx" ON "alerts" USING btree ("workspace_id","status","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_account_idx" ON "auth_accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_invitations_org_idx" ON "auth_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auth_invitations_email_idx" ON "auth_invitations" USING btree ("email","status");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_members_org_user_idx" ON "auth_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "auth_members_user_idx" ON "auth_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expiry_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_account_project_unique_idx" ON "billing_account_projects" USING btree ("workspace_id","billing_account_id","project_id");--> statement-breakpoint
CREATE INDEX "billing_project_idx" ON "billing_account_projects" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "billing_accounts_workspace_idx" ON "billing_accounts" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "billing_accounts_provider_idx" ON "billing_accounts" USING btree ("workspace_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_workspace_slug_idx" ON "clients" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "clients_workspace_status_idx" ON "clients" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "cost_entries_workspace_period_idx" ON "cost_entries" USING btree ("workspace_id","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_entries_source_external_idx" ON "cost_entries" USING btree ("workspace_id","source","external_id") WHERE "cost_entries"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "evidence_repository_provider_idx" ON "detection_evidence" USING btree ("workspace_id","repository_id","provider_id");--> statement-breakpoint
CREATE INDEX "evidence_scan_idx" ON "detection_evidence" USING btree ("scan_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_installations_workspace_installation_idx" ON "github_installations" USING btree ("workspace_id","installation_id");--> statement-breakpoint
CREATE INDEX "github_installations_workspace_idx" ON "github_installations" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "integration_events_integration_idx" ON "integration_events" USING btree ("workspace_id","integration_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_integrations_unique_idx" ON "project_integrations" USING btree ("workspace_id","project_id","provider_id");--> statement-breakpoint
CREATE INDEX "project_integrations_status_idx" ON "project_integrations" USING btree ("workspace_id","lifecycle_status","review_status");--> statement-breakpoint
CREATE INDEX "project_integrations_provider_idx" ON "project_integrations" USING btree ("workspace_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_slug_idx" ON "projects" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("workspace_id","client_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_workspace_external_idx" ON "repositories" USING btree ("workspace_id","source","external_id");--> statement-breakpoint
CREATE INDEX "repositories_project_idx" ON "repositories" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "repositories_scan_idx" ON "repositories" USING btree ("workspace_id","scan_enabled","last_successful_scan_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_provider_observation_idx" ON "repository_provider_observations" USING btree ("workspace_id","repository_id","provider_id");--> statement-breakpoint
CREATE INDEX "observations_provider_idx" ON "repository_provider_observations" USING btree ("workspace_id","provider_id","present");--> statement-breakpoint
CREATE INDEX "scan_runs_workspace_repository_idx" ON "scan_runs" USING btree ("workspace_id","repository_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scan_runs_idempotency_idx" ON "scan_runs" USING btree ("workspace_id","idempotency_key") WHERE "scan_runs"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "scan_runs_active_repository_idx" ON "scan_runs" USING btree ("repository_id") WHERE "scan_runs"."status" in ('pending', 'running');--> statement-breakpoint
CREATE INDEX "subscriptions_workspace_status_idx" ON "subscriptions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "subscriptions_account_idx" ON "subscriptions" USING btree ("workspace_id","billing_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_org_idx" ON "workspace_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_idx" ON "workspace_profiles" USING btree ("slug");