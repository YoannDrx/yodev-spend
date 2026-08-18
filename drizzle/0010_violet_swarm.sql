ALTER TYPE "public"."beta_invitation_status" ADD VALUE 'reserved' BEFORE 'consumed';--> statement-breakpoint
ALTER TABLE "beta_invitations" ADD COLUMN "reserved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "beta_invitations" ADD COLUMN "reserved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "beta_invitations" ADD COLUMN "reservation_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "beta_invitations" ADD COLUMN "checkout_session_id" varchar(160);--> statement-breakpoint
ALTER TABLE "beta_invitations" ADD CONSTRAINT "beta_invitations_reserved_by_user_id_auth_users_id_fk" FOREIGN KEY ("reserved_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "beta_invitations_checkout_session_idx" ON "beta_invitations" USING btree ("checkout_session_id") WHERE "beta_invitations"."checkout_session_id" is not null;