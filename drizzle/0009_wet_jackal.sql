ALTER TABLE "github_installations" ADD COLUMN "repository_selection" varchar(16);--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "permissions" jsonb;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "verified_by_user_id" text;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_verified_by_user_id_auth_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;