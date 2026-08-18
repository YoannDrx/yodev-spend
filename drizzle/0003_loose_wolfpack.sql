CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'system', 'support');--> statement-breakpoint
CREATE TYPE "public"."beta_invitation_status" AS ENUM('pending', 'consumed', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."commercial_billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."commercial_plan_code" AS ENUM('solo', 'studio');--> statement-breakpoint
CREATE TYPE "public"."commercial_subscription_status" AS ENUM('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."commercial_webhook_status" AS ENUM('pending', 'processing', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."deletion_job_status" AS ENUM('scheduled', 'export_window', 'purging', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."terms_document" AS ENUM('terms', 'privacy', 'dpa');--> statement-breakpoint
CREATE TYPE "public"."workspace_commercial_status" AS ENUM('private', 'pending_checkout', 'trialing', 'active', 'past_due', 'cancelled', 'deletion_scheduled');--> statement-breakpoint
CREATE TYPE "public"."workspace_quota_status" AS ENUM('within_limit', 'grace', 'restricted');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_user_id" text,
	"action" varchar(120) NOT NULL,
	"target_type" varchar(80),
	"target_id" varchar(180),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beta_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"plan_code" "commercial_plan_code" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"status" "beta_invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text,
	"consumed_by_user_id" text,
	"workspace_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "commercial_plan_code" NOT NULL,
	"version" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"monthly_price_minor" bigint NOT NULL,
	"annual_price_minor" bigint NOT NULL,
	"member_limit" integer NOT NULL,
	"project_limit" integer NOT NULL,
	"connection_limit" integer NOT NULL,
	"history_months" integer NOT NULL,
	"features" jsonb NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_plans_price_check" CHECK ("commercial_plans"."monthly_price_minor" >= 0 and "commercial_plans"."annual_price_minor" >= 0),
	CONSTRAINT "commercial_plans_limits_check" CHECK ("commercial_plans"."member_limit" > 0 and "commercial_plans"."project_limit" > 0 and "commercial_plans"."connection_limit" > 0 and "commercial_plans"."history_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "commercial_terms_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"document" "terms_document" NOT NULL,
	"version" varchar(40) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"stripe_event_id" varchar(120) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"status" "commercial_webhook_status" DEFAULT 'pending' NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(100),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_deletion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requested_by_user_id" text,
	"status" "deletion_job_status" DEFAULT 'scheduled' NOT NULL,
	"credentials_revoked_at" timestamp with time zone,
	"export_available_until" timestamp with time zone NOT NULL,
	"purge_scheduled_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"quote_currency" varchar(3) NOT NULL,
	"rate_scaled" bigint NOT NULL,
	"rate_scale" integer DEFAULT 8 NOT NULL,
	"rate_at" timestamp with time zone NOT NULL,
	"source" varchar(40) DEFAULT 'ecb' NOT NULL,
	"source_url" text NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_scale_check" CHECK ("fx_rates"."rate_scale" between 0 and 18),
	CONSTRAINT "fx_rates_positive_check" CHECK ("fx_rates"."rate_scaled" > 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_billing_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"legal_name" varchar(240) NOT NULL,
	"billing_email" varchar(320) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"address_line_1" varchar(240) NOT NULL,
	"address_line_2" varchar(240),
	"postal_code" varchar(32) NOT NULL,
	"city" varchar(120) NOT NULL,
	"vat_id" varchar(40),
	"business_confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_quota_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"commercial_plan_id" uuid NOT NULL,
	"status" "workspace_quota_status" DEFAULT 'within_limit' NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"project_count" integer DEFAULT 0 NOT NULL,
	"connection_count" integer DEFAULT 0 NOT NULL,
	"exceeded_at" timestamp with time zone,
	"grace_ends_at" timestamp with time zone,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_quota_counts_check" CHECK ("workspace_quota_states"."member_count" >= 0 and "workspace_quota_states"."project_count" >= 0 and "workspace_quota_states"."connection_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workspace_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"commercial_plan_id" uuid NOT NULL,
	"stripe_customer_id" varchar(120) NOT NULL,
	"stripe_subscription_id" varchar(120) NOT NULL,
	"stripe_price_id" varchar(120) NOT NULL,
	"status" "commercial_subscription_status" NOT NULL,
	"billing_interval" "commercial_billing_interval" NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_starts_at" timestamp with time zone,
	"current_period_ends_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_profiles" ADD COLUMN "commercial_status" "workspace_commercial_status" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_profiles" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_auth_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_invitations" ADD CONSTRAINT "beta_invitations_invited_by_user_id_auth_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_invitations" ADD CONSTRAINT "beta_invitations_consumed_by_user_id_auth_users_id_fk" FOREIGN KEY ("consumed_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beta_invitations" ADD CONSTRAINT "beta_invitations_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_terms_acceptances" ADD CONSTRAINT "commercial_terms_acceptances_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_terms_acceptances" ADD CONSTRAINT "commercial_terms_acceptances_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_webhook_events" ADD CONSTRAINT "commercial_webhook_events_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_jobs" ADD CONSTRAINT "data_deletion_jobs_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_jobs" ADD CONSTRAINT "data_deletion_jobs_requested_by_user_id_auth_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_billing_profiles" ADD CONSTRAINT "workspace_billing_profiles_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_quota_states" ADD CONSTRAINT "workspace_quota_states_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_quota_states" ADD CONSTRAINT "workspace_quota_states_commercial_plan_id_commercial_plans_id_fk" FOREIGN KEY ("commercial_plan_id") REFERENCES "public"."commercial_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_commercial_plan_id_commercial_plans_id_fk" FOREIGN KEY ("commercial_plan_id") REFERENCES "public"."commercial_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_workspace_idx" ON "audit_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("workspace_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "beta_invitations_token_idx" ON "beta_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "beta_invitations_email_status_idx" ON "beta_invitations" USING btree ("email","status");--> statement-breakpoint
CREATE INDEX "beta_invitations_workspace_idx" ON "beta_invitations" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_plans_code_version_idx" ON "commercial_plans" USING btree ("code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_plans_active_code_idx" ON "commercial_plans" USING btree ("code") WHERE "commercial_plans"."active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_terms_acceptances_unique_idx" ON "commercial_terms_acceptances" USING btree ("workspace_id","user_id","document","version");--> statement-breakpoint
CREATE INDEX "commercial_terms_acceptances_workspace_idx" ON "commercial_terms_acceptances" USING btree ("workspace_id","accepted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_webhook_events_stripe_idx" ON "commercial_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "commercial_webhook_events_workspace_idx" ON "commercial_webhook_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "data_deletion_jobs_active_idx" ON "data_deletion_jobs" USING btree ("workspace_id") WHERE "data_deletion_jobs"."status" in ('scheduled', 'export_window', 'purging');--> statement-breakpoint
CREATE INDEX "data_deletion_jobs_schedule_idx" ON "data_deletion_jobs" USING btree ("status","purge_scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_identity_idx" ON "fx_rates" USING btree ("base_currency","quote_currency","rate_at","source");--> statement-breakpoint
CREATE INDEX "fx_rates_lookup_idx" ON "fx_rates" USING btree ("base_currency","quote_currency","rate_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_billing_profiles_workspace_idx" ON "workspace_billing_profiles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_billing_profiles_country_idx" ON "workspace_billing_profiles" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_quota_states_workspace_idx" ON "workspace_quota_states" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_quota_states_status_idx" ON "workspace_quota_states" USING btree ("status","grace_ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscriptions_stripe_idx" ON "workspace_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "workspace_subscriptions_workspace_idx" ON "workspace_subscriptions" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_subscriptions_customer_idx" ON "workspace_subscriptions" USING btree ("stripe_customer_id");