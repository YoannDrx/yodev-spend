UPDATE "billing_accounts"
SET "owner_type" = 'workspace', "updated_at" = now()
WHERE "owner_type" = 'client' AND "client_id" IS NULL;--> statement-breakpoint
UPDATE "billing_accounts"
SET "client_id" = NULL, "updated_at" = now()
WHERE "owner_type" <> 'client' AND "client_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_client_owner_check" CHECK (("billing_accounts"."owner_type" = 'client' and "billing_accounts"."client_id" is not null) or ("billing_accounts"."owner_type" <> 'client' and "billing_accounts"."client_id" is null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "billing_accounts" VALIDATE CONSTRAINT "billing_accounts_client_owner_check";
