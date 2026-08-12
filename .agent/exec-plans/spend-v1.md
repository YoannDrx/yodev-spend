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
- [ ] M10 production activation. Neon and Vercel are provisioned; real GitHub credentials and DNS authorization remain operator gates.

## Decisions

- Better Auth organizations are the membership source; `workspace_profiles` adds Spend preferences.
- GitHub OAuth authenticates humans; a separate GitHub App scans selected repositories.
- Source content exists only in memory. Persisted evidence contains a signal name and file path, never a secret value.
- `partial` results can add positive evidence but cannot advance absence/stale state.
- Currency conversion is intentionally absent. EUR aggregates exclude other currencies.
- Production infrastructure changes require the operator's authenticated Neon, Vercel, DNS and GitHub accounts.

## Verification record

Completed 2026-08-12:

- `npm run check`: lint, strict typecheck, 22 unit tests and the Next.js production build pass.
- `TEST_DATABASE_URL=postgresql://spend:spend@localhost:5432/spend npm run test`: 25/25 tests pass, including PostgreSQL constraints and tenant isolation.
- `npm run test:e2e`: Playwright smoke passes in French and English application surfaces.
- `npm audit --audit-level=high`: zero vulnerabilities.
- A disposable empty PostgreSQL database was migrated and seeded successfully.
- Neon project `billowing-recipe-36985615`: production and staging each expose 24 public tables and 29 catalog providers.
- Vercel project `yodev-spend` is linked and has isolated production/preview database, auth and cron secrets. GitHub OAuth/App secrets are deliberately absent until the two apps are created.
- `spend.yodev.fr` cannot yet be attached from the current Vercel team because `yodev.fr` is controlled elsewhere; DNS/domain authorization is required before activation.
