CREATE TABLE "github_install_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"initiated_by_user_id" text NOT NULL,
	"locale" varchar(2) DEFAULT 'fr' NOT NULL,
	"state_hash" varchar(64) NOT NULL,
	"candidate_installation_id" bigint,
	"pkce_verifier_ciphertext" text NOT NULL,
	"pkce_verifier_iv" varchar(32) NOT NULL,
	"pkce_verifier_tag" varchar(32) NOT NULL,
	"encryption_key_version" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "github_installations"
		GROUP BY "installation_id"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot enforce global GitHub installation ownership: duplicate installation_id values exist';
	END IF;
END $$;
--> statement-breakpoint
DROP INDEX "github_installations_workspace_installation_idx";--> statement-breakpoint
ALTER TABLE "github_install_states" ADD CONSTRAINT "github_install_states_workspace_id_workspace_profiles_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_install_states" ADD CONSTRAINT "github_install_states_initiated_by_user_id_auth_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_install_states_state_hash_idx" ON "github_install_states" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "github_install_states_workspace_idx" ON "github_install_states" USING btree ("workspace_id","expires_at");--> statement-breakpoint
CREATE INDEX "github_install_states_expiry_idx" ON "github_install_states" USING btree ("expires_at","consumed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "github_installations_installation_idx" ON "github_installations" USING btree ("installation_id");--> statement-breakpoint
ALTER TABLE "github_install_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "github_install_states_service" ON "github_install_states" FOR ALL
USING (spend_is_service())
WITH CHECK (spend_is_service());
