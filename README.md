# Spend by YoDev

Spend inventories third-party services across software projects, explains how they were detected, connects them to manual billing, and highlights stack drift and potentially wasted recurring cost.

The V1 is private to YoDev but all business data is workspace-scoped for later SaaS use. The UI is available under `/fr` and `/en`.

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

Use a random Better Auth secret and configure a GitHub OAuth App for real login. For UI-only local work, set `AUTH_TEST_MODE=true`; that mode bypasses auth and serves safe demonstration data, and must never be enabled in production.

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
