# Spend V1 execution plan

## Objective

Deliver a private, bilingual, SaaS-ready application at `spend.yodev.fr` that connects repository evidence to project integrations, manual billing, drift, and advisory waste alerts.

## Milestones

- [x] M0 foundation, localization, design system, documentation skeleton, CI.
- [x] M1 multi-tenant Drizzle schema, generated migration, provider catalog, demo seed.
- [x] M2 Better Auth GitHub allowlist, organization/workspace bootstrap, tenancy helpers.
- [x] M3 clients/projects/repository portfolio and server mutations.
- [x] M4 read-only GitHub App callback, signed webhook and explicit repository import.
- [x] M5 bounded quick/deep scanner, sanitization, fingerprints, scoring, fixtures.
- [x] M6 discovery inbox, history, review decisions and drift rules.
- [x] M7 manual billing accounts, subscriptions, cost entries, money/allocation calculations.
- [x] M8 dashboard, provider inventory, project and service detail surfaces.
- [x] M9 idempotent alerts, manual scan service and secure bounded daily cron.
- [x] M10 production activation. Neon, Vercel, GitHub OAuth/App, OVH DNS, SSL and the daily scan cron are active at `spend.yodev.fr`.

## Decisions

- Better Auth organizations are the membership source; `workspace_profiles` adds Spend preferences.
- GitHub OAuth authenticates humans; a separate GitHub App scans selected repositories.
- Source content exists only in memory. Persisted evidence contains a signal name and file path, never a secret value.
- `partial` results can add positive evidence but cannot advance absence/stale state.
- V1 ledger rows remain immutable in their original currencies. FinOps V2 now derives EUR reporting totals from dated ECB rates and exposes the rate date/source; rows without an eligible rate remain excluded and visible.
- Production infrastructure is active. External financial connectors remain read-only and require explicitly scoped credentials.

## Verification record

Completed 2026-08-12:

- `npm run check`: lint, strict typecheck, 22 unit tests and the Next.js production build pass.
- `TEST_DATABASE_URL=postgresql://spend:spend@localhost:5432/spend npm run test`: 25/25 tests pass, including PostgreSQL constraints and tenant isolation.
- `npm run test:e2e`: Playwright smoke passes in French and English application surfaces.
- `npm audit --audit-level=high`: zero vulnerabilities.
- A disposable empty PostgreSQL database was migrated and seeded successfully.
- Neon project `billowing-recipe-36985615`: production and staging each expose 24 public tables and 29 catalog providers.
- Vercel project `yodev-spend` is linked and has isolated production/preview database, auth and cron secrets. The production GitHub OAuth App and read-only GitHub App are configured separately.
- GitHub OAuth and the read-only GitHub App are configured; repository import and a production scan succeeded.
- `spend.yodev.fr` is attached through OVH DNS and serves production with a valid certificate.

FinOps V2 work continues in `.agent/exec-plans/spend-finops-v2.md`. The private V1 completion record does not mean the commercial SaaS is production-ready; remediation and commercial release gates are tracked in `.agent/exec-plans/spend-commercial-readiness.md`.
