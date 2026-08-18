ALTER TABLE "commercial_webhook_events" ADD COLUMN "stripe_event_created_at" integer;--> statement-breakpoint
UPDATE "commercial_webhook_events"
SET "stripe_event_created_at" = EXTRACT(EPOCH FROM "created_at")::integer
WHERE "stripe_event_created_at" IS NULL;--> statement-breakpoint
ALTER TABLE "commercial_webhook_events" ALTER COLUMN "stripe_event_created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ADD COLUMN "payment_grace_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ADD COLUMN "last_stripe_event_created_at" integer;
