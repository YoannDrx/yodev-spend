# Spend commercial readiness execution plan

## 1. Purpose and ownership

This is the decision-complete, living execution plan for turning Spend from its current private alpha into a production-ready B2B SaaS that YoDev can sell safely. It supersedes no historical record: `spend-v1.md` remains the record of the private V1, while `spend-finops-v2.md` remains the product/FinOps roadmap. This plan owns the remediation, release and commercialization work that connects both.

Plan date: 2026-08-17.

Working branch: `codex/commercial-readiness`.

Production domain: `https://spend.yodev.fr`.

The implementation owner is Codex for all repository work, tests, migrations, deployment preparation and authenticated external configuration that can be completed safely. Yoann remains the decision maker for legal identity, tax registrations, pricing acceptance, live-payment authorization, provider consent screens and any external contract. An accountant, lawyer, Google reviewer and independent security assessor own the validations that cannot honestly be self-certified by the application author.

## 2. Target outcome

Spend is ready for commercialization only when a new invited B2B customer can:

1. read accurate French or English product, pricing, security and legal information;
2. authenticate with Google or GitHub;
3. accept the current contractual documents and provide B2B billing information;
4. start a 14-day Stripe trial with a payment method;
5. receive access only after a verified Stripe webhook;
6. create an isolated workspace, clients and projects;
7. connect the advertised read-only providers;
8. import invoices without raw documents or secrets leaking into logs or durable storage;
9. understand every total, source, currency, period, freshness indicator and recommendation;
10. invite permitted team members, export data, cancel, disconnect providers and request deletion;
11. recover from payment, provider and synchronization failures without duplicated money or cross-tenant exposure.

Spend remains a cost and optimization hub. It does not become a general email sender, uptime monitor, APM, log viewer or automatic provider-management system.

## 3. Verified baseline

### 3.1 Shipped production baseline

Production currently serves the old private V1. GitHub sign-in, the private YoDev workspace, selected-repository scanning and the manual FinOps foundation exist, but public product pages and the commercial Stripe endpoint are not deployed. The production database is in the United States, contains only the first two migrations and does not yet have the commercial schema or RLS policies.

### 3.2 Local commercial-readiness checkpoint

Commit `5dae4b4` on `codex/commercial-readiness` contains a large unpublished checkpoint. It already includes, but does not yet prove production readiness for:

- commercial tables and migrations `0002` through `0007`;
- Google sign-in configuration boundaries;
- public landing, pricing, security and legal draft routes;
- basic members, quotas and commercial onboarding;
- feature-gated Stripe Checkout, Portal and webhook handling;
- app/service/migration database URL boundaries and RLS transaction helpers;
- production rejection of `AUTH_TEST_MODE=true`;
- the financial connector framework and a fixture-tested Vercel connector;
- encrypted connector credentials;
- removal of some fabricated service-detail data;
- PostgreSQL-backed CI and local smoke-test infrastructure.

This checkpoint must be decomposed and reviewed. “Present in the branch” never means “accepted for production”.

### 3.3 Last repeatable local evidence

The last complete local verification used PostgreSQL 16 and applied migration files `0000` through `0007` to a blank database. It passed 67 Vitest tests, the Next.js production build and two Playwright smoke tests. This evidence is useful but insufficient: route handlers, real OAuth, commercial lifecycle, database roles, provider APIs, accessibility, load, restoration and destructive lifecycle operations remain unproven.

## 4. Non-negotiable invariants

These conditions apply to every milestone and review:

- Every tenant-owned read and write is scoped by a server-authorized workspace and protected by PostgreSQL RLS.
- Browser input never decides `workspaceId`, role, price, plan entitlement, provider account or financial source of truth.
- Authentication tables are accessed through a narrow identity/service boundary, not through the tenant application role.
- Runtime roles cannot own the schema or bypass RLS. Migration credentials are absent from application runtimes.
- Repository source, email bodies, invoice documents, OAuth tokens, API keys and secret values are never logged or durably stored in plaintext.
- Money is stored as integer minor/scaled units with the original ISO 4217 currency. JavaScript floating point is not used for ledger arithmetic.
- A final invoice takes precedence over provider-reported accruals without deleting their audit history.
- Partial, failed, stale or interrupted synchronization can add positive evidence but never prove absence.
- No page invents a project association, proof, cost, plan, freshness state or recommendation.
- Every external connector is read-only and exposes only the capabilities that are actually implemented.
- Spend never changes a provider plan, deletes a provider resource or cancels an external subscription.
- No live feature is advertised before a real staging and production reconciliation proves it.
- Migrations are additive and reviewed. Destructive evolution uses `expand -> backfill -> switch -> contract`.
- Stripe is the source of truth for Spend subscription status. A success redirect never grants access.
- Google Login and Gmail use separate OAuth clients and scopes.
- Gmail is a paid-launch gate while it remains advertised as a launch connector.
- Stripe Tax remains disabled until YoDev's registrations and collection obligations have been validated.

## 5. Release gates

No calendar date overrides these gates.

### Gate R0 — Reviewable checkpoint

- The large local commit is split into coherent reviewed commits or PRs.
- Blank-database and V1-upgrade migrations pass.
- Documentation describes the real state rather than planned state.
- Remote CI executes the new branch, including PostgreSQL and Playwright.

### Gate R1 — Safe private production

- GitHub installation trust is fixed.
- Database roles and grants are provisioned reproducibly.
- RLS is demonstrably enforced in staging and production.
- The existing YoDev workspace migrates to the EU stack without data loss.
- Private V1 workflows still pass.

### Gate R2 — Commercial staging

- Google/GitHub identity, beta invitation, Stripe test lifecycle, transactional email, export and deletion scheduling pass end to end.
- No feature is public in production; feature flags remain off.

### Gate R3 — YoDev dogfood

- Core financial connectors reconcile real YoDev closed periods.
- Imports, FX and recommendations are explainable.
- Restoration and incident exercises pass.
- YoDev uses the system for seven consecutive days with more than 98% successful due syncs.

### Gate R4 — Paid beta

- Legal, tax and Gmail review gates are complete.
- One controlled live payment, failure/recovery simulation, invoice, cancellation and export have been verified.
- Five workspaces are admitted first, then ten, then twenty.

### Gate R5 — General availability

- Four weeks of beta meet the exit metrics in section 25.
- Every connector advertised on public pages is production-validated.
- Independent security review and recovery test are complete.

## 6. Workstream W0 — Stabilize, decompose and document the checkpoint

### Objective

Turn the unpublished 129-file checkpoint into reviewable, reversible delivery units without losing the working local behavior.

### Implementation

1. Tag or record commit `5dae4b4` as the immutable stabilization baseline.
2. Inventory every changed file against `origin/main` and classify it as schema, tenancy, commercial billing, public UX, connector, test or documentation.
3. Verify that no generated output, local credentials, database dump or accidental attachment is part of the diff.
4. Rebuild a sequence of coherent commits while preserving the final tree:
   - FinOps schema and exact-money primitives;
   - connector platform and Vercel fixture adapter;
   - commercial schema and plan separation;
   - database boundaries and RLS;
   - Stripe integration foundation;
   - SaaS/public UI and membership;
   - CI, tests and documentation.
5. Review migrations `0002` through `0007` for lock duration, defaults, backfills, partial indexes, foreign keys and rollback implications.
6. Create a sanitized V1 schema/data fixture that resembles production structure without personal or secret data.
7. Run both migration paths: blank PostgreSQL 16 and sanitized V1 snapshot.
8. Update README, architecture, product and runbook claims so “implemented”, “feature-gated”, “externally configured” and “production validated” are distinct states.
9. Configure a GitHub pull request for the branch and require remote CI evidence before merge. If the GitHub plan cannot enforce a ruleset, document the manual merge checklist and retain protected-review discipline.

### Tests and evidence

- `drizzle-kit check` passes.
- All migrations apply exactly once to blank and V1-like databases.
- Bootstrap is idempotent and seed is deterministic.
- `git diff --check`, dependency audit and secret scan pass.
- CI artifacts include test counts and migration logs without database credentials.

### Rollback

No production deployment occurs in W0. The baseline commit remains available if commit decomposition changes behavior.

### Exit criteria

The branch is remotely reviewable, CI runs the full new tree and no commercial feature has been activated.

## 7. Workstream W1 — Repair the GitHub App trust boundary

### Objective

Eliminate the spoofable installation callback and ensure a GitHub installation can belong to only the workspace whose authenticated user can administer it.

### Schema and server changes

1. Add `github_install_states` with `id`, `workspaceId`, `initiatedByUserId`, `stateHash`, `expiresAt`, `consumedAt`, `createdAt` and a unique state hash.
2. Generate 256-bit random state server-side when the user clicks Connect. Persist only its SHA-256 hash with a ten-minute TTL.
3. Replace the direct GitHub URL in the settings page with a server action/route that creates state and redirects to the GitHub App installation flow.
4. On callback, require a current authenticated session, atomically consume the matching unexpired state and reject missing, reused or cross-workspace state.
5. Obtain the GitHub user authorization required by the documented setup flow and verify that the current GitHub user can access/administer the returned installation. Do not trust `installation_id`, `setup_action`, account login or repository metadata from query parameters.
6. Fetch canonical installation account, target type, repository selection and permissions from GitHub using an installation/user-authenticated API call.
7. Add global uniqueness for active `installationId`; an installation cannot silently attach to two workspaces.
8. Persist canonical GitHub metadata only after verification. Treat account login as display data, never authorization data.
9. Handle `installation`, `installation_repositories` and suspension/deletion webhooks idempotently. Removed repositories become unavailable/archived; their financial and scan history is retained.
10. Separate scanner `Contents: read` from organization billing `Administration: read` in both UI and documentation. A workspace can use either capability independently.

### Tests

- Valid state and authorized installation succeeds.
- Missing, expired, replayed and foreign-workspace state fails.
- Guessed installation ID fails even when numerically valid.
- A user without installation access fails.
- Duplicate installation/workspace race resolves once.
- Webhook delivery duplication and delivery reordering are idempotent.
- Removal/suspension revokes new access without deleting historical evidence.

### External configuration

Create separate development, staging and production GitHub Apps. Register exact setup, callback and webhook URLs, then verify least-privilege permissions with a test organization before touching YoDev production repositories.

### Rollout and rollback

Deploy the new callback while the Connect button is feature-flagged off. Validate with a test installation, then enable. Existing verified installations are backfilled as `legacy_verified=false` and require a one-time owner revalidation; they are not automatically reassigned. Rollback disables new connects while existing scan tokens continue through the old verified records.

### Exit criteria

No callback parameter alone can create an installation record, and every active installation has a verifiable ownership audit trail.

## 8. Workstream W2 — Provision database roles and enforce tenant isolation

### Objective

Make RLS a real production boundary rather than an unprovisioned migration concept.

### Role design

- `spend_migration`: schema owner; used only by controlled migration jobs.
- `spend_service`: non-browser service role for Better Auth, verified webhooks, schedulers, durable workflows, bootstrap and lifecycle jobs.
- `spend_app`: `NOBYPASSRLS`, non-owner role for tenant business reads and writes.

Production fails startup if URLs are missing, resolve to an unexpected role, use the same role, or if `AUTH_TEST_MODE=true`.

### Implementation

1. Add an idempotent operator script to create/alter roles, rotate passwords, revoke `PUBLIC`, set schema usage and grant the minimum table/sequence/function privileges.
2. Ensure no runtime role owns `public` schema or tenant tables.
3. Maintain an explicit table matrix: tenant tables for `spend_app`; authentication/commercial provisioning tables for `spend_service`; DDL for `spend_migration`.
4. Remove `spend_app` grants from Better Auth user, session, account, member, invitation and organization tables.
5. Move member lists, role changes, revocation and invitations into a narrow identity service that first authorizes the acting user and target organization, then uses `spend_service` or Better Auth server APIs.
6. Keep tenant quota/audit updates in the authorized app transaction when possible; coordinate cross-boundary writes with idempotent service operations and audit failure states rather than pretending cross-database-role atomicity.
7. Make every tenant repository function accept an authorized transaction rather than a raw workspace string where practical.
8. Extend the static DB-boundary check to reject direct tenant access through `requireDb`, direct service access from UI modules and auth-table imports in tenant pages/actions.
9. Verify `current_user` and RLS posture at startup/health checks without exposing connection strings.
10. Evaluate `FORCE ROW LEVEL SECURITY` table by table in staging. Enable only after migration/backfill jobs and the exact service policies have passing tests.

### Tests

- For every tenant table: no workspace setting returns zero rows or raises the expected denial; workspace A cannot read/update/delete B; service tasks can access only their documented scope.
- Guessing UUIDs in every Server Action and sensitive route fails.
- Auth member actions cannot target another organization.
- Concurrent quota checks cannot exceed project, connection or invitation limits.
- Audit rows cannot be updated or deleted by tenant roles.
- CI runs the suite with the actual three roles, not the schema owner URL reused three times.

### External deployment

Provision roles separately in staging and production Neon projects. Store each URL only in its intended Vercel environment. Never expose migration credentials to Preview or Production Functions.

### Rollout and rollback

First run a read-only permission audit, then shadow queries with `spend_app`, then switch staging. Production switches during a maintenance window after a snapshot and smoke tests. Rollback restores the previous app URL only if no new write depends on RLS-specific behavior; database policies remain additive.

### Exit criteria

All tenant paths run under `spend_app`, auth/service paths are isolated, CI proves cross-tenant denial and a runtime cannot start with unsafe credentials.

## 9. Workstream W3 — Move infrastructure to an EU production topology

### Objective

Align the EU-first commercial promise with the actual data and runtime placement while preserving the current domain and private V1.

### Target topology

Use separate EU Neon projects for staging and production, not merely two branches in one project. Use separate Vercel staging and production projects so OAuth secrets, cron/workflow triggers and service credentials cannot bleed across environments. Preview deployments use disposable or explicitly managed preview databases without production data.

### Implementation

1. Recheck currently available Neon and Vercel EU regions immediately before provisioning and select the closest compatible pair.
2. Create `yodev-spend-staging-eu` and `yodev-spend-production-eu`, with matching PostgreSQL major version, protected production resources and paid PITR/history retention supporting the one-hour RPO target.
3. Provision the three database roles in each project.
4. Apply migrations and bootstrap to staging from blank.
5. Copy production with unpooled `pg_dump`/`pg_restore` into a restricted migration window; for the current small dataset, prefer a short maintenance window over logical replication complexity.
6. Compare table counts, row counts, constraints, provider catalog, hashes for stable business rows and key financial totals.
7. Point staging Vercel to staging Neon and complete all identity/connector smoke tests.
8. Put production in read-only maintenance, take a final dump/snapshot, import the delta/full database, validate, update production environment URLs and deploy.
9. Preserve `spend.yodev.fr`; no OVH MX changes are needed. Update only the Vercel association/DNS if the Vercel project changes.
10. Keep the old Neon project read-only for 30 days, with credentials revoked from runtime, then delete it after written approval and verified backup expiry.

### Tests and recovery

- Execute a timed staging restore before cutover.
- Verify RPO/RTO recording, branch/snapshot IDs and post-restore connection behavior.
- Run FR/EN, auth, scan, dashboard and cron smoke tests on the new stack.

### Rollback

Before accepting writes on the new production database, rollback is an environment-variable reversal. After new writes begin, rollback uses the documented restore/reconciliation procedure; never blindly point to stale old data.

### Exit criteria

Production application and database execute in documented EU regions, restoration has been timed and the old US database is outside the runtime trust path.

## 10. Workstream W4 — Make CI/CD an enforceable release control

### Objective

Prevent green checks from hiding skipped database, E2E, security or migration coverage.

### CI pipeline

1. Start PostgreSQL 16 and provision the same three roles used in production.
2. Apply migrations to a blank database and a sanitized V1-upgrade database.
3. Run bootstrap/seed and fail when any integration suite is skipped.
4. Execute:
   - `npm run lint`;
   - `npm run check:db-boundaries`;
   - `npm run check:i18n`;
   - `npm run typecheck`;
   - unit and PostgreSQL integration tests;
   - `npm run build`;
   - Playwright authenticated and anonymous suites;
   - accessibility checks with axe;
   - dependency audit, secret scan and generated-migration drift check.
5. Add explicit CI assertions that builds do not execute migrations and production flags are not enabled in previews.
6. Add cleaned provider contract fixtures and schema-forward-compatibility tests.
7. Add test sharding only after deterministic execution is proven; retain a single blocking aggregate status.
8. Configure dependency update PRs and repository secret scanning. Where the GitHub plan cannot enforce branch rules, use a documented manual merge gate with CI status evidence.

### CD pipeline

1. Preview: ephemeral/sanitized database, no live provider credentials, no cron.
2. Staging: migration job, deploy with flags off, E2E, then selective flags.
3. Production: snapshot, migration job outside Vercel build, deploy flags off, smoke, progressive flag activation.
4. Record deployment ID, migration version, enabled flags, operator and rollback target for every production release.

### Exit criteria

No database test is skipped, no merge reaches production without the full blocking suite, and every release is traceable and reversible.

## 11. Workstream W5 — Complete identity, workspaces, invitations and quotas

### Objective

Provide a recoverable B2B onboarding and complete Studio membership model without unsafe account linking.

### Commercial invitation flow

1. Separate commercial beta invitations from organization membership invitations:
   - `/{locale}/start/[token]` for a commercial workspace invitation;
   - `/{locale}/invite/[id]` for an existing workspace member invitation.
2. Generate at least 256 bits of entropy and store only a token hash.
3. Validate hash, email, plan, expiry and unused status before onboarding.
4. Reserve rather than consume the invitation before Stripe. Add `reservedAt`, `reservedByUserId`, `checkoutSessionId` and reservation expiry.
5. Consume the invitation only when a verified Checkout/subscription webhook binds the workspace. Release stale reservations after 24 hours.
6. Make retries reuse the same pending workspace and Stripe customer/session when safe.
7. Delete or archive abandoned empty pending workspaces after 24 hours; retain minimal abuse/audit evidence according to policy.

### Identity rules

1. Keep Google Login at `openid email profile` only and GitHub Login separate from the GitHub App.
2. Require provider-verified email for invitation acceptance.
3. Never merge accounts from matching email alone.
4. Add a settings flow to link/unlink a second identity only from an authenticated session with recent-auth confirmation.
5. Prevent unlinking the last usable identity.
6. Add workspace switcher and remember the last active organization safely.

### Members and quotas

1. Implement owner, admin and member server permissions for every route/action.
2. Complete invite, cancel, accept, revoke and role change through the identity service boundary from W2.
3. Implement ownership transfer with recent authentication, explicit confirmation and audit.
4. Count pending invitations in member quotas transactionally.
5. Enforce project and connection quotas in the database transaction, including concurrent requests.
6. Implement seven-day overage grace and the deterministic “most recently successfully synchronized” retention rule only after the owner has been offered an explicit choice.

### Tests

- Google and GitHub login staging flows.
- Reused/expired/wrong-email beta and member invitations.
- No silent identity merge.
- Concurrent invitation/project/connection quota attempts.
- Role matrix across pages, Server Actions and APIs.
- Owner cannot be accidentally removed or leave a workspace ownerless.

### Exit criteria

An invited user can reliably reach Checkout, a Studio owner can manage the full member lifecycle and a Solo workspace cannot exceed its limits by races.

## 12. Workstream W6 — Finish Stripe Billing and transactional communication

### Objective

Make the full subscription lifecycle correct, testable and supportable before accepting money.

### Product configuration

Provision in Stripe sandbox, then live only after validation:

- Solo monthly: 19 EUR;
- Solo annual: 182.40 EUR;
- Studio monthly: 49 EUR;
- Studio annual: 470.40 EUR;
- 14-day trial with payment method required;
- configured Customer Portal for card, invoices, cancellation, immediate upgrade and deferred downgrade.

Price IDs are environment variables; price, currency and entitlement version are always resolved server-side. Dynamic payment methods remain Dashboard-controlled. Stripe Tax stays off until accounting approval.

### Application behavior

1. Use Checkout Sessions subscription mode with one server-selected price.
2. Pass a stable internal integration identifier/metadata for workspace and onboarding attempt; never trust metadata from the browser.
3. Activate only from verified webhook state.
4. Store Stripe event ID, event creation time, API version, processing state, real attempt count and a sanitized error.
5. Re-fetch the affected Stripe subscription/customer when an event could be stale; apply monotonic state rules so out-of-order events cannot restore obsolete access.
6. Entitlements:
   - historical YoDev workspace alone may use `private`;
   - `trialing` and `active` receive plan rights;
   - `past_due` receives a dated seven-day grace;
   - `incomplete`, `incomplete_expired`, `unpaid`, `canceled` and abandoned checkout receive no paid rights.
7. Upgrade immediately with Stripe-calculated proration.
8. Schedule downgrade at the next boundary; record the pending plan and enforce quotas after the grace/selection flow.
9. Cancel at period end; revoke connector credentials at actual termination, retain read/export access 30 days and schedule purge.
10. Separate webhook signature errors (`400`) from temporary processing failures (`500`) so Stripe retries correctly.
11. Add an operator replay command that accepts an event ID, is idempotent and records the operator audit event.

### Emails

Configure Resend on a dedicated sending subdomain without changing YoDev's main OVH MX records. Publish SPF, DKIM and DMARC. Implement localized, branded templates for:

- organization invitation;
- beta invitation;
- trial ending;
- payment failed and grace deadline;
- payment recovered;
- cancellation/termination;
- export ready;
- deletion scheduled and completed.

Delivery failure is visible and retryable; invitations must not appear successfully sent when Resend is unconfigured.

### Tests

Use real sandbox Checkout objects and Stripe Test Clocks, not only synthetic CLI fixtures:

- trial creation and zero invoice;
- successful first payment and renewal;
- immediate upgrade/proration;
- deferred downgrade;
- card failure, action required, retry, recovery and unpaid state;
- cancellation now/end of period;
- duplicate and out-of-order webhooks, including identical timestamps;
- Portal changes reflected only after webhook sync;
- abandoned Checkout cleanup;
- export/deletion schedule after termination.

### External gates

- Reauthenticate the Stripe connector/account.
- Verify YoDev legal identity and bank details.
- Obtain accountant approval for French VAT exemption/registration, EU B2B VAT and invoice wording.
- Obtain lawyer approval for terms, privacy policy and DPA before live Checkout.
- Run one controlled live transaction, refund/cancellation as appropriate and verify the issued invoice.

### Rollout and rollback

Keep `STRIPE_BILLING_ENABLED=false` in production until the live smoke test. Webhook endpoint can be deployed before Checkout but must fail closed. Rollback disables new Checkout and Portal entry while webhooks remain enabled to keep existing state synchronized.

### Exit criteria

The complete prospect-to-termination lifecycle is reproducible in staging and one controlled live production cycle has passed.

## 13. Workstream W7 — Make the financial ledger and UI truthful

### Objective

Ensure every visible number is derived from persisted, reconcilable data and all corrections preserve history.

### Portfolio and navigation

1. Complete client/project edit, archive, restore and project status management.
2. Add server pagination, URL-persisted search/filter/sort and accessible empty/error states to portfolio, repositories, discoveries, costs, alerts and audit.
3. Complete manual repository/project management for customers who do not connect GitHub.

### Scanner and discoveries

1. Add persistent `nextScanAt`, `lastScanAttemptAt`, scheduler cursor and stuck-run recovery.
2. Resolve `SCAN_FAILED` after a later success and preserve separate episodes.
3. Add discovery filters for new/probable/strong/ignored and test reopening on materially new proof.
4. Implement `PROVIDER_REMOVED` and `RENEWAL_SOON`, plus resolve/dismiss/snooze UI and deterministic episode deduplication.

### Billing operations

1. Add edit/cancel/correct flows for billing accounts, subscriptions and cost entries.
2. Never overwrite an accepted financial fact silently: corrections append an event/revision and supersede the prior value.
3. Require a client when owner type is `client`.
4. Add explicit project associations and shared allocations in basis points; total cannot exceed 10,000 and remainder stays visible.
5. Preserve exact annual-to-monthly fractions internally; round only at presentation or final allocation boundaries using a documented rule.
6. Add source-precedence reconciliation and a review queue for conflicting final invoices/accruals/manual data.

### Dashboard truth

1. Remove `demoData` spreading from all real-database query results. Demo content exists only in an explicit demo workspace/fixture.
2. Replace `scan: "—"`, `last: "—"`, generic age labels and zero alert amounts with real nullable data and explicit unavailable states.
3. Derive project/client/service totals from canonical costs and post-canonical allocations.
4. Show original amount/currency, state, source, period, retrieved time, freshness, completeness and reconciliation status.
5. Build a reconciliation center showing covered/missing periods and differences.
6. Add monthly close states `complete`, `partial`, `review_required` and prevent a partial source from being represented as a closed month.
7. Add financial coverage score by workspace, provider, project and period.
8. Add profitability by client/project only when revenue/allocation inputs are explicitly supplied; never infer revenue.

### FX

1. Ingest daily official ECB reference rates into global `fx_rates` with source URL, publication date and retrieval date.
2. Preserve original money; derive workspace-reference currency through EUR cross rates.
3. Use the transaction date or immediately preceding available date.
4. Display rate/date/source. Missing rates remain excluded with an explicit warning.

### Tests

- Exact bigint/scaled arithmetic, negative credits/taxes and allocation remainder.
- Source precedence and no double counting.
- Correct project/client/shared totals.
- Time-zone and month-boundary behavior.
- ECB weekends/holidays/missing rate behavior.
- No placeholder or fabricated data in non-demo workspaces.

### Exit criteria

Every cost and dashboard figure can be traced to canonical records, allocations and a deterministic query; every missing input is visibly missing.

## 14. Workstream W8 — Durable synchronization and credential lifecycle

### Objective

Replace direct cron processing with resumable, idempotent workflows and production-grade credential management.

### Implementation

1. Pin the Vercel Workflow/WDK version after reading its embedded version-specific documentation.
2. Keep cron as a scheduler only: find due connection/capability pairs and start a workflow with a deterministic window/idempotency key.
3. Use one durable workflow per connection and capability; isolate each provider call, page/cursor checkpoint, normalization transaction and reconciliation transaction in durable steps.
4. Implement retries at one minute, five minutes and thirty minutes, honoring longer `Retry-After` values on 429.
5. Classify errors as authentication, permanent permission/schema, rate-limited or transient.
6. Lock by connection/capability/window in PostgreSQL and enforce external-ID uniqueness so duplicate cron/workflow invocation cannot duplicate financial rows.
7. Persist cursor, watermark, completeness and last successful full window. Interrupted work never advances the absence watermark.
8. Recover stale `running` executions and expose a dead-letter/operator retry state after exhausted attempts.
9. Run costs/usage every six hours; resources/subscriptions/invoices daily; code scans daily; allow rate-limited manual sync.
10. Version AES-256-GCM encryption keys. Add lazy re-encryption/explicit rotation jobs, cryptographic context binding and a key inventory without plaintext.
11. On disconnect or subscription termination, call provider revocation where supported, delete encrypted credentials immediately and retain only non-secret audit/reference data.
12. Enforce provider hostname allowlists and prevent redirects to unapproved hosts to reduce SSRF/credential exfiltration risk.

### Tests

- Duplicate scheduling, parallel starts and repeated windows.
- Crash after each step, cursor resume and no double write.
- 401/403, 404, 429 with `Retry-After`, 5xx, timeouts and schema extension.
- Credential tamper, old-key decryption/new-key rotation and revocation.
- Partial sync cannot deactivate resources or trigger negative recommendations.

### Exit criteria

A forced interruption loses no accepted data, creates no duplicate cost and cannot create a false absence alert.

## 15. Workstream W9 — Deliver and reconcile the paid-beta connector nucleus

Every connector must implement a capability manifest, Zod validation, metadata allowlist, stable external IDs, pagination, cursors, rate-limit behavior, auth error state, revocation, sanitized contract fixtures, freshness and completeness.

### Vercel

1. Replace manual tokens as the customer journey with a scoped Vercel Integration/OAuth flow.
2. Read teams, projects, FOCUS 1.3 charges and contractual commitments.
3. Preserve effective cost, billed cost, currency, SKU, category, project/resource, period and provider timestamps.
4. Map charges to Spend projects only when source identifiers or confirmed mappings support it.
5. Retain manual-token support only as an internal migration path, clearly labeled.
6. Reconcile at least one closed YoDev invoice/period to zero unexplained variance before beta.

### OpenAI

1. Require a dedicated organization administration key accepted by the Costs API; reject ordinary project execution keys for financial sync.
2. Treat Costs as the financial source and Usage as explanation grouped by project/model/API type.
3. Never request, receive or persist prompts, outputs, files or end-user identifiers.
4. Show unexplained usage/cost differences rather than fabricating a correction.

### Neon

1. Use a dedicated Neon API key, never customer PostgreSQL connection strings.
2. Read organizations, projects, branches and consumption for compute, storage, restore and transfer.
3. Store monthly history, daily recent history and hourly detail only for recent cost-explanation windows.
4. Use a final invoice/import when consumption APIs do not provide a final monetary amount.

### GitHub Billing

1. Extend the GitHub App with organization `Administration: read` only when the billing capability is selected.
2. Show the additional permission separately from repository `Contents: read`.
3. Fetch supported organization billing/usage using installation tokens generated on demand.
4. Fall back explicitly to invoice/manual import when the account billing platform does not expose the required endpoint.

### Acceptance matrix for each connector

- Real staging account connected and revoked.
- Initial backfill and incremental page/cursor behavior verified.
- Closed-period totals compared with provider dashboard/invoice.
- Expected differences documented by SKU/period rather than hidden.
- No raw response or credential in logs/database.
- 401/403/429/5xx and partial response contract tests pass.
- Public capability wording matches exactly what the connector returns.

### Exit criteria

Vercel, OpenAI, Neon and GitHub Billing have real reconciliation evidence; any unavailable capability is visibly manual rather than “connected”.

## 16. Workstream W10 — Gmail, invoices, bank files and Apple Developer

### Gmail OAuth

1. Create a Google Cloud project/client distinct from Google Login.
2. Request only `gmail.readonly` and `gmail.labels`.
3. Create/find `Spend/Invoices` and read only messages with that label.
4. Never mark messages read, move, delete or relabel them after label creation/discovery.
5. Use Gmail history IDs for incremental synchronization and recover from expired history with a bounded labeled-message rescan.
6. Deduplicate by Gmail message ID, attachment ID and SHA-256.
7. Revoke the Google refresh token and delete encrypted credentials on disconnect.

### Secure ingestion pipeline

1. Accept Gmail attachments, direct PDF/CSV upload, OFX, QIF and CAMT XML.
2. Validate real content through magic bytes and strict format/schema parsing, not extension/MIME alone.
3. Limit each document to 10 MiB and PDF to 20 pages; reject encrypted, malformed, recursive or decompression-bomb content.
4. Process raw files in encrypted isolated temporary storage with a recorded deletion deadline under 24 hours.
5. Extract deterministic PDF text; use deterministic OCR only when a page has no text layer.
6. Parse provider, invoice number, period, currency, subtotal, tax, total and line items with per-field confidence.
7. Require human review when any critical financial field is below 90% confidence or reconciliation conflicts.
8. Promote to `final` only after deterministic full match or human validation.
9. Retain normalized financial data, hash, sanitized filename, confidence and review decisions; delete raw documents and extracted text.
10. Add a purge monitor that alerts if any raw object exceeds 24 hours.

### Apple Developer Program

1. Maintain versioned individual/organization catalog entries.
2. Allow invoice-assisted/manual amount, currency, owner, membership and renewal date.
3. Produce renewal, duplicate and “no active mobile project” advisories only.
4. Never label Apple as synchronized while no suitable API exists.

### External Google gate

Prepare verified homepage, privacy, terms, DPA, scope justification, demo video, test account and data-flow diagram. Submit restricted-scope verification and complete the required independent security assessment. Google Login must remain independently operational if Gmail review is delayed or renewed.

### Exit criteria

Labeled Gmail attachments and supported files become reviewed final costs, raw data is demonstrably purged within 24 hours and Google has approved the production OAuth use.

## 17. Workstream W11 — Usage-versus-plan recommendations and reporting

### Objective

Produce conservative, reproducible recommendations instead of generic savings guesses.

### Plan catalog

1. Version provider plans and entitlements by provider, name, currency, fixed fee, included units, overage tiers, seats/add-ons, valid dates, verification state, public source URL and retrieval date.
2. Never scrape authenticated pages. Use provider APIs, public documentation, invoices or reviewed administrative entry.
3. Keep Spend Solo/Studio plans in `commercial_plans`; never reuse provider-plan tables.

### Recommendation engine

Implement versioned deterministic rules for:

- paid account without active project;
- detected provider without billing account;
- stale/removed provider still paid;
- duplicate subscriptions in a category;
- unallocated resource/cost;
- abnormal cost growth;
- oversized plan;
- unused seat or add-on;
- annual billing opportunity;
- migration leaving an old subscription active;
- expiring credit/commitment;
- projected variable spend exceeding a higher-plan crossover;
- imminent renewal.

A plan-change recommendation requires 30 complete days, fresh daily data under 24 hours, known current plan, all billable metrics, no partial negative evidence, at least 20% capacity margin and positive savings after overages.

Each finding records rule/version, observation window, current/simulated cost, low/expected/high savings, included/used units, confidence, risks, evidence links and user feedback. Support accept, ignore, snooze and “not relevant”; Spend still takes no external action.

### Studio reporting

Add CSV and PDF exports, client/project allocation reports, monthly-close report and a reproducible calculation manifest. PDF generation must be visually checked and contain source/freshness disclaimers.

### Exit criteria

Every recommendation can be recalculated from stored inputs and a versioned rule, and at least 70% of beta feedback marks recommendations useful or plausible.

## 18. Workstream W12 — Complete lifecycle, privacy and retention

### Objective

Make export, cancellation and deletion real operational processes rather than schema placeholders.

### Implementation

1. Build authenticated export requests with downloadable, expiring, encrypted archives and audit events.
2. Include normalized business data, decisions, costs and audit records allowed by policy; exclude credentials and deleted raw content.
3. Revoke connectors immediately at actual subscription termination.
4. Keep the workspace read-only/exportable for 30 days, then purge tenant business data through an idempotent deletion workflow.
5. Expire backups containing deleted data within 30 additional days while preserving the separately governed YoDev commercial invoices for the legal accounting period.
6. Enforce 12/24-month active history by plan after a 30-day downgrade export/grace period.
7. Retain operational logs 30 days and security audit 24 months during the relationship, subject to final legal validation.
8. Add user-visible deletion status, cancellation, scheduled date and completion evidence.
9. Add operator retry/reconciliation for failed deletion stages; never mark complete until all data stores and credentials report completion.
10. Maintain a processing register and subprocessor inventory tied to deployed services.

### Tests

- Export isolation and expiry.
- Immediate credential revocation.
- Read-only grace and post-grace denial.
- Idempotent purge with partial failure/retry.
- Backup-expiry evidence and separation of legal accounting records.

### Exit criteria

An actual staging workspace can be exported, terminated and purged according to the published policy with auditable evidence.

## 19. Workstream W13 — Public UX, localization, accessibility and SEO

### Objective

Turn the internal-looking private V1 into an honest, accessible commercial journey.

### Implementation

1. Finish FR/EN landing, features, pricing, security, legal, privacy, terms, DPA and subprocessors pages.
2. Make every visible string use the locale catalog, including errors, themes, aria labels, status messages and email templates.
3. Add a commercial onboarding progress flow: identity, B2B profile, terms, plan/Checkout, currency, first project, first connector, backfill, association review, first summary.
4. Add truthful empty/loading/error/partial/freshness states.
5. Remove the fake notification bell and unconditional “all systems operational” label; replace them only when backed by real alerts/status.
6. Complete mobile drawer/list conversions, keyboard paths, focus restoration, reduced motion, semantic tables and screen-reader labels.
7. Add metadata, canonical/hreflang, sitemap, robots, Open Graph assets, application icons and structured organization/software pricing data where accurate.
8. Add a support/contact path and a public service-status link before GA.

### Tests and targets

- Automated axe on public, onboarding, dashboard, billing, members and connector paths with zero critical/serious violations.
- Keyboard-only E2E and responsive mobile smoke.
- Locale key parity and static detection of untranslated UI literals.
- Dashboard p95 under two seconds for 50 projects, 20 connections and 24 months of paginated data.
- No N+1 query pattern in dashboard or lists.

### Exit criteria

A prospect can understand, buy and use Spend in either language without misleading controls, untranslated text or inaccessible blockers.

## 20. Workstream W14 — Security, observability, support and disaster recovery

### Application security

1. Add a strict tested CSP using nonces/hashes where required by Next.js and providers; add `X-Content-Type-Options`, frame protection, `Referrer-Policy` and minimal `Permissions-Policy`.
2. Validate Origin/CSRF posture for every mutation and callback.
3. Add Postgres-backed or approved managed rate limits for auth abuse, beta validation, uploads and manual synchronization.
4. Apply provider egress allowlists and upload-parser resource limits.
5. Ensure cookies are Secure, HttpOnly and appropriate SameSite in production.
6. Add automated log/Sentry redaction tests for tokens, file contents, email contents, invoice text and authorization headers.
7. Add annual and incident-triggered secret rotation procedures.
8. Run threat modeling, OWASP review, dependency/secret scanning and an independent penetration test before GA.

### Observability

1. Add structured event names and correlation IDs for auth, Checkout, webhook, connector, import, scan, export and deletion workflows.
2. Send sanitized errors/traces to an EU-compatible configured provider or drain; never attach raw request bodies for protected routes.
3. Alert on payment webhook backlog, sync success below 98%, repeated auth failure, raw-document purge breach, stale scheduler, database errors and open `SCAN_FAILED` incidents.
4. Add internal operational dashboards only for Spend health; do not expose project APM to customers.
5. Publish a minimal status page and incident communication procedure before GA.

### Recovery and support

1. Document incident severity, owner, communication, containment, credential revocation and regulatory notification assessment.
2. Support access never silently impersonates a user. Exceptional access requires user consent or incident authority, reason, time limit and immutable audit.
3. Test a production-like Neon restore quarterly. Record achieved RPO/RTO; targets are one hour and four hours.
4. Test Vercel deployment rollback separately from database restoration.

### Exit criteria

Security review has no open critical/high issue, alerting detects staged failures and a timed recovery meets the internal targets.

## 21. Workstream W15 — GA connector expansion

These providers are implemented only after the paid-beta nucleus is stable:

1. Anthropic costs/usage using the least-privilege supported organization mechanism.
2. AWS Cost Explorer and/or CUR through a customer-created external-ID read-only IAM role.
3. OVHcloud usage/invoices using read-only API capabilities, with manual invoice fallback where APIs are incomplete.
4. Stripe Balance Transactions/fees as a customer expense connector, entirely separate from Spend's own Stripe Billing account.
5. Supabase costs/usage according to documented organization/project capabilities.
6. Resend usage/cost according to verified API capabilities.

Each follows the W9 acceptance matrix. Public copy is capability-specific and may state “invoice import only” when no reliable cost API exists.

## 22. Workstream W16 — Legal, tax and commercial operations

### Required external validation

1. Accountant validates Yoann Andrieux EI/YoDev billing identity, VAT exemption or registration, intra-EU reverse charge, invoice wording, Stripe Tax decision and French electronic-invoicing calendar.
2. Lawyer validates B2B terms, privacy, DPA, legal notice, processor/controller roles, liability, support commitment, cancellation/refund wording and data-transfer clauses.
3. Complete GDPR processing register, subprocessor list, data subject request process and breach notification playbook.
4. Preserve YoDev's own commercial invoices for the legal accounting period separately from purged workspace data.
5. Review supplier DPAs and EU/third-country transfer safeguards for Vercel, Neon, Stripe, Google, GitHub, Resend and error monitoring.

### Commercial operations

1. Define beta invitation approval, 30-minute onboarding, support intake and two-business-day response target without contractual SLA.
2. Create customer-facing connector permission guides, revocation instructions, data freshness expectations and known limitations.
3. Prepare refund/credit-note, chargeback, failed payment, deletion and security incident runbooks.
4. Maintain a feature-claims register: every marketing claim maps to a production acceptance test and owner.

### Exit criteria

No page says “draft”, Checkout is legally authorized, invoice wording is approved and every advertised claim has evidence.

## 23. End-to-end verification matrix

The following suites block release:

### Unit

- exact money, annual discount and Stripe entitlement state;
- source precedence, allocation and ECB conversion;
- scanners, sanitization, fingerprint score and stale rules;
- provider plan simulation and recommendation gates;
- document parsers and per-field confidence;
- credential crypto, key rotation and log redaction;
- beta reservation, quotas, grace, downgrade and retention dates.

### PostgreSQL integration

- blank and V1 migration paths;
- real app/service/migration roles;
- every tenant table and cross-workspace guessed ID;
- auth service boundary and role matrix;
- concurrent quotas, scans, syncs, webhooks and invoice deduplication;
- final invoice replacing accrued totals;
- workflow resume and deletion retry.

### Connector contracts

- pagination/cursor;
- unknown fields;
- negative amounts/credits;
- currency change;
- 401/403/404/429/5xx/timeout;
- partial responses and revoked credentials;
- repeated window without duplicate;
- external schema extension without breakage.

### E2E

- public FR/EN pages and anonymous denial;
- beta token, Google Login and GitHub Login;
- Checkout trial, Portal and webhook-driven access;
- client/project creation and repository import;
- Quick/Deep scan and discovery confirmation;
- each paid-beta connector with simulated then real staging flow;
- Gmail labeled invoice and manual upload review;
- dashboard update and recommendation feedback;
- members, upgrade/downgrade, cancellation, export and deletion;
- theme, mobile, keyboard and screen-reader paths;
- explicit cross-tenant attack paths.

### Load and reliability

- dashboard p95 under two seconds at Studio limits;
- scheduling 500 due connections without duplicate;
- 20 concurrent syncs without exhausting PostgreSQL;
- pagination on all unbounded financial/evidence/audit tables;
- forced workflow interruption and restart;
- restore within four hours and no more than one hour of data loss under the selected backup posture.

## 24. Deployment sequence

1. Complete W0, merge only after remote CI.
2. Deploy W1/W2 to isolated staging and validate roles/trust boundaries.
3. Complete W3 EU staging and production migration while commercial flags remain off.
4. Revalidate the existing YoDev private V1 in production.
5. Deploy W5/W6 public/commercial code with landing and Checkout still disabled.
6. Provision and validate Stripe sandbox, Google Login, Resend and legal copy in staging.
7. Complete W7/W8 and the core connectors W9/W10.
8. Run real YoDev reconciliation and seven-day dogfood.
9. Complete W11-W14, controlled live payment and recovery exercises.
10. Enable public landing and invite-only paid beta for five workspaces.
11. Expand to ten and twenty only if metrics remain green for seven days at each checkpoint.
12. Implement/validate W15 GA connectors.
13. Open GA only after four stable beta weeks and all external gates.

At every deployment: create a restore point, migrate outside the build, deploy flags off, run smoke tests, enable one flag at a time, observe, and retain the previous Vercel deployment. Database rollback is never coupled blindly to application rollback.

## 25. Commercial launch metrics and stop conditions

### Required beta/GA metrics

- due synchronization success above 98% over seven days;
- zero cross-tenant incident;
- zero credential, source-code, email-body or raw-invoice leak;
- 100% of supported final closed-period totals reconciled or visibly explained;
- less than 2% invoice duplicates before review and zero after reconciliation;
- at least 70% recommendations rated useful or plausible;
- no open critical/high security issue for seven days;
- successful staging restore and production-like recovery exercise;
- successful real payment, invoice, failure/recovery, cancellation and export lifecycle.

### Immediate stop conditions

Pause onboarding and affected synchronization when any of these occurs:

- possible tenant isolation breach;
- unverifiable financial double counting;
- secret or raw protected content in logs/durable storage;
- Stripe state granting access contrary to Stripe's current subscription;
- Gmail raw-content purge deadline missed;
- backup/restore evidence unavailable after a production migration;
- connector permissions exceed published read-only scope.

## 26. Dependencies and critical path

The critical path is:

`W0 checkpoint -> W1 GitHub trust + W2 RLS -> W3 EU infrastructure -> W4 CI -> W5 identity -> W6 Stripe/legal -> W8 workflows -> W9 core connectors -> W10 Gmail verification/imports -> W7/W11 truth and recommendations -> W12-W14 lifecycle/security -> dogfood -> beta -> W15 -> GA`.

W10 Google verification starts as soon as the public legal/security pages and data-flow evidence are credible; it runs in parallel because its external duration is unpredictable. Legal/tax review starts during W5/W6. W7 financial truth can proceed in parallel with W8 after W2. GA connectors do not delay a narrowly advertised paid beta, but every connector shown as available must pass its own gate.

## 27. Realistic duration

With deliberate overlap between application work, provider configuration, legal review and Google verification, the remaining elapsed work is approximately 24 to 32 weeks plus any additional Google restricted-scope review delay. A strictly sequential single stream would be closer to 25 to 35 weeks:

- W0-W4 foundation and release safety: 3-5 weeks;
- W5-W6 commercial lifecycle: 3-4 weeks;
- W7-W10 financial truth, workflows and launch connectors: 7-10 weeks;
- W11-W14 recommendations, lifecycle, UX and hardening: 4-6 weeks;
- dogfood and paid beta evidence: minimum 4 weeks, overlapping late hardening where safe;
- W15 GA connectors: 4-6 weeks, partly parallel and after beta stability.

These are planning ranges, not permission to weaken a release gate.

## 28. Immediate next actions

The first implementation sequence after approval of this plan is:

1. W0 diff inventory and commit decomposition plan.
2. W1 signed/replay-safe GitHub installation flow and tests.
3. W2 identity service boundary plus idempotent database-role provisioning.
4. CI with real three-role PostgreSQL and zero skipped DB tests.
5. Blank/V1 migration rehearsal.
6. EU staging provisioning and restore rehearsal.

No Stripe live product, public signup or customer connector is enabled during this sequence.

## 29. Progress log

- 2026-08-17: Created this remediation and commercialization plan from the repository, test, production, Vercel, Neon, GitHub and Stripe audit. The plan explicitly treats the local commercial checkpoint as unvalidated until each release gate has evidence.
- 2026-08-17: Implemented the W1 local trust boundary. New GitHub connections now use a ten-minute hashed state, encrypted PKCE verifier, GitHub App user authorization, direct user-token access verification, canonical app metadata, global installation ownership and single-use completion. Legacy rows without `verified_at` cannot list, import or scan until revalidated. Migrations `0008`-`0009` add transient service-only state and verification metadata.
- 2026-08-17: Implemented the first W2/W4 local boundary. `db:provision-roles` creates and rotates exact `spend_app`, `spend_service` and `spend_migration` roles, removes app grants from Better Auth/service-only tables and grants only reviewed tenant/catalog access. Member reads/mutations moved behind an identity service. CI now provisions the same roles before migrations and reapplies grants afterward.
- 2026-08-17: Rebuilt a fresh PostgreSQL 16 database through role provisioning, migrations `0000`-`0009`, post-migration grants, bootstrap and seed. The three-role test run passes 75/75 tests; `npm run check` passes lint, boundary/i18n checks, strict typecheck, tests and the 53-route build; Playwright passes 2/2 smoke tests on an isolated port. Live GitHub App client configuration and real installation revalidation remain release-gate work.
- 2026-08-17: Completed the local W5 beta-invitation boundary. Bearer tokens are hashed, bound to the authenticated verified email and reserved for 24 hours; they are consumed only by a valid `trialing`/`active` Stripe webhook. Repeated subscription webhooks accept an already-consumed matching invitation, while abandoned reservations are released or their `pending_checkout` workspace is scheduled for deletion. `beta:invite` emits the one-time URL for an operator and revokes older invitations for the address. Migration `0010` carries the reservation state.
- 2026-08-17: Repeated the blank-database rehearsal on PostgreSQL 16 with migrations `0000`-`0010`, exact runtime roles, bootstrap and seed. Lint, database-boundary checks, 364-key FR/EN parity, strict typecheck, 81 Vitest tests, the 53-route production build and 3 Playwright smoke tests pass. The Stripe integration suite now signs real webhook payloads and proves activation, invitation consumption, duplicate delivery and out-of-order protection against PostgreSQL. External Stripe/GitHub/Google/Resend configuration, a V1 production-data upgrade rehearsal and all later release gates remain explicitly open.

## 30. Audit-finding coverage

This matrix is the completeness check for the issues raised by the audit. A finding is closed only by its workstream exit evidence, not by appearing in this table.

| Audit finding | Treatment |
|---|---|
| Commercial code is local, monolithic and absent from production | W0 decomposition, W4 remote CI/CD and section 24 progressive deployment |
| Production still serves the old private V1 and public routes/webhook are absent | W0, W4, W6 and W13 behind release gates R1-R4 |
| GitHub App callback trusts a spoofable `installation_id` | W1 signed state, user authorization, canonical API verification and replay tests |
| RLS policies exist without real role provisioning/grants | W2 three-role provisioning, grant matrix, runtime checks and cross-tenant tests |
| Tenant code reads or mutates Better Auth tables with the app role | W2 identity/service boundary and removal of app grants |
| `AUTH_TEST_MODE` could have bypassed production auth | Existing local fail-fast is revalidated in W0/W2 and asserted by W4 CI/CD |
| Current Neon/Vercel data path is US-based despite EU-first positioning | W3 separate EU staging/production projects and rehearsed cutover |
| CI previously skipped DB tests and Playwright lacked a database | W4 real PostgreSQL roles, zero-skip assertion and blocking E2E |
| Beta invite token/hash lifecycle is incomplete and invite can be consumed before Checkout | W5 separate token route, reservation/expiry and webhook consumption |
| Account linking, workspace switching and full member lifecycle are incomplete | W5 verified explicit linking, switcher, revoke/role/ownership and quota races |
| Stripe products, prices, Portal, events and live lifecycle are not production-proven | W6 sandbox/live provisioning, Test Clocks, ordered reconciliation and controlled live cycle |
| Stripe entitlement edge cases and stale/out-of-order events could grant wrong access | W6 monotonic/refetch rules, fail-closed status matrix and duplicate/order tests |
| Transactional email is unconfigured or can fail invisibly | W6 Resend subdomain, templates, delivery state and retries |
| Legal pages are drafts and tax treatment is unvalidated | W16 accountant/lawyer gates; W6 forbids live Checkout and Stripe Tax beforehand |
| CRUD, restore, statuses, search, filters and pagination are incomplete | W7 portfolio/navigation implementation and E2E |
| Scanner scheduling can starve repositories or leave stuck runs | W7 scan scheduling state and W8 durable orchestration |
| Discovery filters, alert lifecycle and some alert types are missing | W7 deterministic alerts, episodes, filters, resolve/dismiss/snooze |
| Billing corrections, shared allocations and client ownership are incomplete | W7 immutable revisions, associations, basis-point allocation and reconciliation |
| Dashboard/project/client/service pages still contain placeholders or demo-derived values | W7 strict demo separation and traceable canonical queries |
| Multi-currency aggregation has no verified ECB conversion | W7 official rates, visible source/date and exclusion on missing rate |
| FinOps cron performs long work directly and lacks durable retry/resume | W8 scheduler-only cron, workflows, locks, cursors and dead-letter state |
| Credential rotation/revocation and SSRF controls are incomplete | W8 key versions, re-encryption, provider revocation and egress allowlists |
| Vercel connector is manual-token/fixture-only and not invoice-reconciled | W9 OAuth/Integration plus closed-period YoDev reconciliation |
| OpenAI Costs, Neon Consumption and GitHub Billing are not implemented | W9 capability-specific production connectors and real acceptance matrix |
| Gmail connector and restricted-scope verification are absent | W10 separate OAuth client, labeled-only ingestion, purge and Google review |
| PDF/CSV/OFX/QIF/CAMT, OCR and human review are absent | W10 deterministic secure ingestion and confidence workflow |
| Apple Developer is not automatically retrievable | W10 honest manual/invoice-assisted tracking and renewal advice only |
| Provider plan catalog and recommendations are incomplete | W11 versioned entitlements, conservative simulation and evidence-backed feedback |
| Exports, deletion jobs and retention are schema-level or absent | W12 executable export/revoke/grace/purge workflows and policy tests |
| Public onboarding, localization, mobile, accessibility and SEO are incomplete | W13 full commercial UX, axe/keyboard tests and search metadata |
| Security headers, rate limits, redacted observability and status handling are incomplete | W14 CSP/headers, abuse controls, sanitized telemetry and status/incident process |
| Backup retention and restoration have not met commercial RPO/RTO evidence | W3 EU backup posture and W14 timed recovery drills |
| GA connectors Anthropic/AWS/OVHcloud/Stripe fees/Supabase/Resend are absent | W15, each gated by the W9 connector acceptance matrix |
| No independent security, legal or fiscal approval exists | W14 independent pentest and W16 professional validations |
| Spend is not and should not be an email-sending product or APM | Sections 2 and 4 retain these as explicit non-goals; Mail by YoDev remains separate |
