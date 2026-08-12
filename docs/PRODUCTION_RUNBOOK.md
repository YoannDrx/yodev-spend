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
3. Apply `npm run db:migrate` using `DATABASE_URL_UNPOOLED` outside the Vercel build, then run `npm run db:bootstrap` to idempotently load the global provider catalog. Never run the demonstration seed in production.
4. Deploy and smoke-test `/fr/dashboard`, `/en/dashboard`, auth, GitHub installation, repository import, a quick scan, discovery review and a manual billing entry.
5. Attach and verify `spend.yodev.fr`, then set `CRON_ENABLED=true` in Production and redeploy to activate scans.

The build command never migrates the database. Destructive changes use expand, backfill, switch and contract releases.

## Rollback

- Application: promote the preceding known-good Vercel deployment.
- Database: stop writes, assess post-migration records, then restore or branch from the pre-migration Neon point. Never blindly restore over valid newer financial data.
- GitHub: suspend the App or remove its private key/installation. No external repository content is modified by Spend.
- Cron: remove/disable the Vercel schedule or rotate `CRON_SECRET`.

## Operations

Review Vercel structured logs for scan outcome, duration, files/bytes, skips, rate limits and cron batches. Logs must contain only opaque identifiers and safe error messages. Investigate open `SCAN_FAILED` alerts and repositories whose last successful scan is old. Monitor evidence and scan-run table growth before adding retention or partitioning.
