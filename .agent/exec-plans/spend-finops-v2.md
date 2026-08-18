# Spend FinOps V2 execution plan

## Objective

Turn Spend into YoDev's complete developer-spend hub: reconcile final invoices and provider-reported costs, place usage beside versioned plan entitlements, attribute shared expenses to projects/clients, and produce conservative, evidence-backed optimization findings.

## Non-goals

- No runtime-log or APM dashboard.
- No provider plan change, resource deletion or subscription cancellation.
- No collection of source code, AI prompts, email bodies, end-customer identities or payment-card details.
- No recommendation based only on a short or incomplete observation window.

## Delivery order

- [x] M11 financial truth model, exact monetary precision, connector/resource/sync schema and migrations.
- [x] M12 generic connection platform, encrypted credentials, capability contracts, idempotent sync runner and settings UI.
- [ ] M13 Vercel projects, FOCUS charges, commitments, attribution, backfill and daily sync. Implementation complete; live-account reconciliation remains the completion gate.
- [ ] M14 plan versions, entitlements, usage projections and explainable optimization findings. Schema, comparison engine, cost-growth and unallocated-cost rules are complete; provider plan catalogs and richer usage metrics remain.
- [ ] M15 universal invoice/file ingestion and Apple Developer annual membership. Manual invoice reconciliation and Apple provider support are complete; file extraction remains.
- [ ] M16 OpenAI, Anthropic, GitHub and Neon read-only connectors. OpenAI Admin Costs and GitHub Billing are implemented; live reconciliation plus Anthropic and Neon remain.
- [ ] M17 OVHcloud, Stripe fees, Supabase and Resend connectors according to verified API capabilities.
- [ ] M18 manual bank-file reconciliation, financial coverage score, monthly close and exports.
- [ ] M19 security, tenancy, correction/reconciliation, recovery and production hardening.

## Locked decisions

- Provider capabilities are independent; unavailable data is never simulated.
- Original amounts and currencies are immutable. Converted amounts are derived from a versioned rate.
- Cost source precedence is final invoice, provider charge, calculated estimate, then manual entry.
- An issued invoice reconciles overlapping accrued/estimated entries instead of adding them.
- Detailed cloud costs use scaled integers; JavaScript floating-point values never enter ledger arithmetic.
- External resources are explicitly mapped to Spend projects; automated matches remain proposals until unambiguous or confirmed.
- Shared fees and credits retain their source total and expose a separate allocation view.
- Recommendations record observation windows, evidence, blocking plan features, confidence and estimated savings range.
- Financial sync has its own cron and does not share repository-scan locks or cursors.

## Verification gates

- Generated SQL reviewed and applied to a disposable empty PostgreSQL database.
- Existing V1 seed and production data migrate without destructive rewrites.
- Cross-workspace tests cover every new tenant-owned table and mutation.
- Credential ciphertext never contains the plaintext and authenticated encryption rejects tampering.
- Duplicate provider payloads and overlapping cron runs do not duplicate costs, usage or findings.
- A failed or rate-limited connector preserves the last successful financial state.
- Vercel closed-period totals reconcile to the provider source before M13 is complete.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` and relevant Playwright tests pass before each production promotion.

## Progress log

- 2026-08-18: Added versioned billing-account allocations (`equal`/`manual`) with exact 10,000-basis-point validation and deterministic largest-remainder allocation. All cost paths now preserve `provider total = projects + unallocated`, including credits and mid-period rule changes.
- 2026-08-18: Added OpenAI Admin Costs, GitHub Billing public-preview and AWS Cost Explorer connectors with explicit pagination, exact decimal normalization, read-only credentials, resource mappings and provider-specific failure classification. AWS uses an assumed IAM role and does not persist long-lived AWS access keys.
- 2026-08-18: Activated audited ECB EUR reporting as a derived view, including prior-business-day lookup, rate provenance, allocation coverage, unallocated spend and freshness. Migration `0011` versions existing account allocation history additively.

- 2026-08-17: Added the decision-complete production and commercialization remediation plan in `spend-commercial-readiness.md`. It is now the authoritative source for release gates, GitHub setup trust, database roles/RLS, EU migration, Stripe lifecycle, connector validation, Gmail verification, retention, security and beta/GA admission.
- 2026-08-17: Started the remediation implementation with migrations `0008`-`0009`: replay-safe GitHub installation state and PKCE verification, globally unique installations, verified canonical metadata, identity-service membership access, reproducible three-role PostgreSQL provisioning and matching CI. Fresh-database tests pass under the real app/service/migration boundaries; live provider configuration remains disabled pending staging.
- 2026-08-17: Migration `0010` and the commercial onboarding boundary now reserve hashed beta tokens for the authenticated verified address, bind them to Checkout and consume them only from an active/trialing Stripe webhook. The cron recovers abandoned reservations and schedules abandoned pending workspaces for deletion; operators can issue one-time links with `beta:invite`. A blank three-role PostgreSQL rebuild passes 81 tests, the 53-route build and 3 Playwright smoke tests, including signed Stripe duplicate/out-of-order delivery.

- 2026-08-13: Generated migration `0002_redundant_rocket_racer.sql` creates the connector, resource, usage, plan, invoice and optimization model without rewriting V1 financial history.
- 2026-08-13: Verified all migrations against a disposable PostgreSQL 16 database, bootstrapped 38 providers and ran the deterministic development seed.
- 2026-08-13: Added authenticated AES-256-GCM credential storage bound to workspace/provider, Vercel project/FOCUS/commitment adapters, separate financial cron, resource-to-project allocation and exact decimal tests.
- 2026-08-13: Added invoice precedence reconciliation, multi-currency visibility, current-period provider/category/project cost aggregation and evidence-backed optimization review.
- 2026-08-13: Started the commercial M20–M31 track. Added versioned Solo/Studio plans, workspace billing profiles/subscriptions/quotas, beta invitations, terms acceptances, deletion scheduling, append-only audit events and ECB-ready FX rates in additive migration `0003`.
- 2026-08-13: Added Google as an optional basic-scope login provider with implicit account linking disabled. The Gmail connector remains a separate, feature-gated OAuth client and is not represented as implemented.
- 2026-08-13: Added feature-gated Stripe Checkout (14-day subscription trial), Customer Portal and signed/idempotent webhook processing. Workspace activation is derived only from synchronized Stripe subscription state.
- 2026-08-13: Added localized public landing, features, pricing, security and legal-document routes. Legal content is explicitly marked as a working draft pending professional validation.
- 2026-08-13: Renamed provider plan tables to `provider_plan_versions` and `provider_plan_entitlements` in migration `0004`, separating them from Spend commercial plans.
- 2026-08-13: Evolved the connector contract to expose a capability/auth/frequency manifest and completeness. Partial resource syncs can add positive data but cannot deactivate resources as negative evidence.
- 2026-08-13: Applied migrations `0000`–`0005` to a disposable PostgreSQL 16 database, bootstrapped catalogs, loaded the deterministic seed and passed schema integrity tests. A non-owner verification role saw zero clients without `app.workspace_id` and exactly the seeded workspace rows after transaction scope was set.
- 2026-08-16: Stabilization branch `codex/commercial-readiness` adds PostgreSQL 16 to CI, makes DB/E2E tests executable, forbids production `AUTH_TEST_MODE`, separates app/service/migration credentials, routes tenant UI and actions through RLS transactions, and statically rejects new direct tenant DB access. The service policy now authenticates the fixed PostgreSQL role instead of trusting a spoofable session flag.
- 2026-08-16: Hardened Stripe state with ordered event timestamps, durable attempt increments, explicit seven-day `past_due` grace, inactive entitlements after cancellation/unpaid states, and separate 400 signature versus 500 processing responses. Migrations `0006`–`0007` backfill safely before adding constraints.
- 2026-08-16: Removed fabricated provider-detail projects/evidence, exposed GitHub repository-list errors, paginated all GitHub App repositories, fixed skipped-scan scheduling fairness, and added validated client/shared billing ownership with deterministic 10,000-basis-point allocation.

## Commercial milestones

- [ ] M20 stabilization: local code gates and fresh PostgreSQL migrations pass; anonymized V1-upgrade rehearsal, clean checkpoint review and live Vercel reconciliation remain.
- [ ] M21 SaaS tenancy: commercial workspace bootstrap, Google login, quotas, RLS boundaries and basic invitation UI exist; production role provisioning, per-route isolation coverage, member revocation/role/ownership and live OAuth validation remain.
- [ ] M22 Stripe Billing: Checkout, Portal, ordered/idempotent webhook ledger and fail-closed entitlements exist behind `STRIPE_BILLING_ENABLED`; Stripe products/prices, transactional emails, Test Clocks, tax/legal validation and live staging/production cycles remain external gates.
- [ ] M23 durable workflows: connector result contracts and idempotence exist; Workflow DevKit orchestration, key rotation and retry/dead-letter policy remain.
- [ ] M24 connector nucleus: Vercel, OpenAI Admin Costs, GitHub Billing and AWS Cost Explorer code paths exist; live closed-period reconciliation, production Vercel OAuth and Neon consumption remain.
- [ ] M25 Gmail/imports: separate configuration boundary exists; Google project verification and deterministic parsers remain.
- [ ] M26 usage-versus-plan: schema and initial optimization rules exist; verified catalog breadth and plan simulator remain.
- [ ] M27 commercial UX: public FR/EN shell, pricing, security, onboarding and billing settings exist; waitlist, member management, exports and deletion UI remain.
- [ ] M28 GA connectors, M29 external legal/security validation, M30 dogfood/beta evidence and M31 GA remain gated on real provider accounts and operational evidence.
