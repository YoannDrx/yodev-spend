DROP INDEX "billing_account_project_unique_idx";--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD COLUMN "allocation_method" "allocation_method" DEFAULT 'equal' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD COLUMN "confirmed_by_user" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD COLUMN "effective_from" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "billing_account_projects" SET "effective_from" = "created_at";--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD COLUMN "effective_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_account_projects_active_idx" ON "billing_account_projects" USING btree ("workspace_id","billing_account_id","project_id") WHERE "billing_account_projects"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "billing_account_projects_period_idx" ON "billing_account_projects" USING btree ("workspace_id","billing_account_id","effective_from","effective_to");--> statement-breakpoint
ALTER TABLE "billing_account_projects" ADD CONSTRAINT "billing_allocation_period_check" CHECK ("billing_account_projects"."effective_to" is null or "billing_account_projects"."effective_to" > "billing_account_projects"."effective_from");
