# Spend by YoDev

Spend inventories third-party services across software projects, explains how they were detected, connects them to manual billing, and highlights stack drift and potentially wasted recurring cost.

The production currently includes the private YoDev workflows and a gated commercial foundation. Commercial availability depends on the release gates, not on the presence of a page or connector. See `docs/PRODUCTION_AUDIT_2026-09-06.md` for the current feature audit and outstanding gates. The UI is available under `/fr` and `/en`.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Better Auth with GitHub OAuth and organizations
- Drizzle ORM with PostgreSQL locally and Neon in production
- Read-only GitHub App and Octokit
- Deterministic quick/deep scanner
- Vitest and Playwright

## Local setup

```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run db:migrate
npm run db:bootstrap
npm run db:seed
npm run dev
```

Use a random Better Auth secret and configure a GitHub OAuth App for real login. For database-backed local E2E, set `AUTH_TEST_MODE=true`; this authenticates the seeded local owner and keeps real database reads/writes. For visual fixtures only, also set `DEMO_DATA_ENABLED=true`. Both flags must remain false in production. Runtime production access requires distinct `DATABASE_APP_URL` (`spend_app`) and `DATABASE_SERVICE_URL` (`spend_service`) credentials. Keep migration credentials in operator jobs only.

## Commands

```bash
npm run dev
npm run db:generate
npm run db:migrate
npm run db:bootstrap
npm run db:seed
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run check
```

Migrations are generated SQL committed under `drizzle/`. Never run `drizzle-kit push` against staging or production.

## External setup

- GitHub OAuth and GitHub App: `docs/GITHUB_APP.md`
- Architecture and security boundaries: `docs/ARCHITECTURE.md`
- Scanner behavior and adding providers: `docs/SCANNER.md`
- Neon/Vercel deployment and recovery: `docs/PRODUCTION_RUNBOOK.md`

No real credential belongs in this repository. GitHub installation access tokens are generated on demand and never stored.
