# Production runbook

## Provision

1. Create a Neon project near the Vercel function region, with isolated staging and production branches.
2. Create isolated Vercel Preview and Production environment-variable sets (or separate projects when stronger deployment isolation is required).
3. Create staging/production GitHub OAuth and GitHub Apps using `GITHUB_APP.md`.
4. Keep `AUTH_TEST_MODE=false` everywhere outside local E2E.
5. Do not enable the cron until the first repository smoke scan succeeds.

## Migration and release

1. Run `npm run check` and `npm run test:e2e`.
2. Create a Neon restore branch immediately before production schema changes.
3. Provision `spend_app`, `spend_service` and `spend_migration` with `npm run db:provision-roles` from an operator environment using `DATABASE_ADMIN_URL` and the three password variables. Apply `npm run db:migrate` using `DATABASE_MIGRATION_URL` outside the Vercel build, rerun role provisioning to grant newly created objects, then run `npm run db:bootstrap` through `DATABASE_SERVICE_URL`. Never run the demonstration seed in production.
4. Deploy and smoke-test `/fr/dashboard`, `/en/dashboard`, auth, GitHub installation, repository import, a quick scan, discovery review and a manual billing entry.
5. Attach and verify `spend.yodev.fr`, then set `CRON_ENABLED=true` in Production and redeploy to activate scans.

Commercial billing remains disabled until all four production price IDs, a restricted Stripe key and the webhook secret are installed. Set `STRIPE_BILLING_ENABLED=true` only after the webhook endpoint `/api/stripe/webhooks` has received a signed test event and the complete trial → paid → failed → cancelled sequence has been validated in staging. Never infer activation from the Checkout success redirect.

Google Login and Gmail are separate OAuth clients. Google Login receives only `openid email profile`. Do not set `GMAIL_CONNECTOR_ENABLED=true` or advertise Gmail as available until the restricted-scope verification and required security assessment are complete.

Financial connectors additionally require a dedicated random `CONNECTOR_ENCRYPTION_KEY` (`openssl rand -base64 32`). Keep the same key across deployments that read the same database; rotating it requires an explicit credential re-encryption procedure. Provider access tokens are entered through the authenticated owner-only settings UI and stored only as authenticated ciphertext. OpenAI requires an Admin key and organization ID. GitHub Billing requires organization Administration read access and remains public preview. AWS requires ambient runtime credentials that can assume the configured read-only Cost Explorer role; store only the role ARN, optional external ID, account metadata and allocation tag, never long-lived AWS access keys.

The repository scan runs daily at 02:00 UTC and `/api/cron/finops` runs at 03:00 UTC. The FinOps cron refreshes the official 90-day ECB reference-rate feed before provider synchronization. A rate-sync or connector failure preserves the last successful financial state; it must never write a zero-cost replacement. Before enabling a new connection, run its supported resources, commitments and accrued-cost capabilities manually, attribute imported resources to projects, and reconcile a closed billing period with the provider total.

Beta invitations are bearer credentials and are only shown once. Create one with the service database role, for example `npm run beta:invite -- --email=client@example.com --plan=solo --valid-days=7`, then transmit the resulting HTTPS URL through an appropriate private channel. The database stores only its SHA-256 hash. Issuing a new invitation revokes previous invitations for the same address. A reservation expires after 24 hours; the FinOps cron releases unused reservations and schedules any abandoned `pending_checkout` workspace for deletion. Stripe webhooks, never the Checkout success URL, activate the workspace and consume the invitation.

The build command never migrates the database. Destructive changes use expand, backfill, switch and contract releases.

The deployment workflow uses three distinct credentials (only the first two belong in the application runtime):

- `DATABASE_APP_URL`: a restricted `NOBYPASSRLS` role that does not own tables;
- `DATABASE_SERVICE_URL`: the role named exactly `spend_service`, reserved for Better Auth, signed webhooks, cron and workflows;
- `DATABASE_MIGRATION_URL`: a schema-owner role such as `spend_migration`, used only by migration/bootstrap commands.

Tenant operations run in transactions that set `app.workspace_id`. RLS recognizes the service role from PostgreSQL `current_user`; a caller-settable GUC cannot grant service access. Never expose the service or migration URL to application code that handles arbitrary queries. Verify unscoped fail-closed reads, attempts to spoof `app.is_service`, scoped visibility and cross-workspace write rejection before every production promotion. Commercial feature flags require both runtime URLs. All production database operations require the exact `spend_app` and `spend_service` identities. `DATABASE_MIGRATION_URL` belongs only in the operator migration job, not in Functions.

`DATABASE_ADMIN_URL` and `SPEND_*_DB_PASSWORD` are operator-only inputs for role creation/rotation. They must not be configured in Vercel Functions. After role provisioning, keep them in the approved secret-management/operator environment only. The application role has no grants on Better Auth tables, commercial webhook events, beta invitations or transient GitHub installation state.

## Rollback

- Application: promote the preceding known-good Vercel deployment.
- Database: stop writes, assess post-migration records, then restore or branch from the pre-migration Neon point. Never blindly restore over valid newer financial data.
- GitHub: suspend the App or remove its private key/installation. No external repository content is modified by Spend.
- Cron: remove/disable the Vercel schedule or rotate `CRON_SECRET`.

## Operations

Review Vercel structured logs for scan and connector outcomes, duration, record counts, skips, rate limits and cron batches. Logs must contain only opaque identifiers and safe error codes/messages. Investigate open `SCAN_FAILED` alerts, failed connector runs and stale last-success timestamps. Monitor evidence, scan-run, connector-run, cost and usage table growth before adding retention or partitioning.

## Audit release gate (September 2026)

Read `PRODUCTION_AUDIT_2026-09-06.md` before promoting the audit branch. Run `npm run check:db-security` with the two runtime URLs against staging and production; the command is read-only and suppresses connection values. Run the complete `check` with `TEST_DATABASE_URL` and database-backed E2E. Set `DEMO_DATA_ENABLED=false` alongside `AUTH_TEST_MODE=false`. The stricter runtime guard deliberately rejects a legacy single-owner database connection.

Manual invoice periods are half-open: start included, end excluded. A manually entered total closes the full account/currency period. A partial overlap with an accrued bucket, a conflicting invoice, or an already final manual cost requires human reconciliation; the application refuses to silently double count or erase uncovered cost. Provider reimports after a covered invoice remain superseded. The guided conflict-resolution workflow is not yet delivered.

Business JSON exports are owner-only, contain explicit safe columns, preserve integer amounts as strings and refuse collections over 10,000 rows. They are not database backups or a complete identity/privacy portability export.

## Readiness follow-up — 7 September 2026

Apply reviewed migration `0012_privacy_audit_erasure.sql` with the migration role before enabling the new deletion worker. It adds only an audit DELETE policy restricted to the service role, a workspace scheduled for deletion and a currently purging job. Application audit update/delete remains unavailable. Test rollback by dropping only that policy: deletion will then fail atomically and remain retryable, rather than silently claiming completion. The application rollout and migration should use staging first; no schema push.

`npm run check:operations` performs read-only aggregate checks with `DATABASE_SERVICE_URL`. Exit 1 means stale scans/syncs, failed/overdue purges or active connections without success for two days; exit 2 means the check itself failed. Route this command's status to the team's chosen monitoring channel before commercial launch. This command alone does not establish that an alert has been delivered.

Cron calls recover abandoned runs older than thirty minutes, skipping any workspace whose active worker still holds the lifecycle lock. Recovery marks interrupted work failed without creating negative provider evidence. Failed connector runs can be retried after their backoff, at most three times for a given idempotency key. Daily scheduling is still bounded synchronous execution, not a durable queue; capacity/load acceptance remains necessary.

The FinOps cron also processes up to ten due erasures. A failed purge rolls back business deletion, stores a safe failure code and produces HTTP 503. Retry by invoking the authenticated cron after diagnosing the failure. Do not reset the workspace status or erase audit history manually to force success. For a cancellation, the owner has thirty days; revoked credentials are never restored automatically.

A successful business erasure removes tenant data and memberships, tombstones the organization/workspace, and retains a minimal job receipt. Shared auth identities, seller billing profiles/subscriptions and contractual evidence are excluded and need their own validated retention policy. The workspace itself remains as a tombstone so late payment events can be reconciled without restoring access.

Restoration rehearsal evidence, including the temporary endpoint-routing incident and remediation, is in `docs/RESTORATION_REHEARSAL_2026-09-06.md`. Every future snapshot rehearsal must explicitly set `finalize:false`, verify the default branch and production endpoint before/after, and use separate compute. A restored backup must replay completed deletion requests before serving traffic. The observed six-hour Neon history is not a commercial RPO commitment; choose retention, alert ownership, off-site recovery needs and RPO/RTO targets before launch.

Real-provider acceptance remains in `docs/STAGING_ACCEPTANCE.md`; identity and contract inputs in `docs/COMMERCIAL_LEGAL_DOSSIER.md`. No sandbox evidence should be represented as a successful live payment.
