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

## Production-readiness audit — 2026-09-06

The deployment now includes the commercial foundation from `2e5fa64`, confirmed through Vercel; it runs in `iad1`. The historical private-V1 completion does not certify commercial readiness. The current audit, feature matrix, fixes and release conditions are in `docs/PRODUCTION_AUDIT_2026-09-06.md`.

This remediation adds exact currency input/display, invoice conflict/precedence protection, strict production runtime roles, a read-only DB security gate, collaborator invitation admission, canonical GitHub import and revocation handling, Stripe Portal plan reconciliation, a safe business export and usable portfolio/ledger/navigation states. It uses real PostgreSQL for E2E instead of implicit demo responses. Deployment, real OAuth/provider/payment acceptance, deletion lifecycle and legal/operational validation remain open.

Validation finale de ce lot : lint, frontières DB, 465 clés FR/EN, TypeScript, 122 tests (39 fichiers, aucun ignoré), build de production, sécurité des deux rôles runtime sur 30 tables tenant, 15 tests Playwright et audit npm sans vulnérabilité passent. La promotion et les gates commerciaux externes restent ouverts ; voir docs/PRODUCTION_AUDIT_2026-09-06.md.

## Four priority workstreams — 2026-09-07

The follow-up adds an immutable financial correction service/UI, a 30-day owner-requested erasure lifecycle, shared mutation/exclusive worker lifecycle locks, stale-worker recovery and bounded connector retries. Migration 0012 adds a narrowly scoped service erasure policy for audit PII; ordinary audit operations remain append-only. Late Stripe/GitHub events must not reactivate a deleted or terminated workspace.

Staging preflight and a separate Better Auth browser suite distinguish real session validation from OAuth consent. Provider credentials downloaded from Vercel are masked; Preview also lacks separate runtime DB roles, Stripe sandbox, Google OAuth and Resend configuration. Real provider/payment/invitation acceptance therefore remains open.

A real Neon snapshot was restored and 46 tables matched, but implicit finalization temporarily moved the production endpoint. Original branch/name/default/endpoint were restored and public HTTP health checked. Record the incident and explicit `finalize:false` requirement in the restoration report. Do not represent the drill as fully isolated or as proof of continuous availability. Production code has not been promoted.

Five FR/EN legal drafts, configurable publisher identity and support, document version approval and a live Checkout gate are implemented. The legal identity, chosen Stripe account/sandbox, test identities, vendor contracts, retention and legal/tax review still require owner inputs. See the staging acceptance and commercial legal dossier for concrete remaining inputs.

Validation finale du lot : `npm run check` passe (lint, frontières DB, 502 clés FR/EN, TypeScript, 134 tests sans skip et build de 55 pages). Les 18 scénarios navigateur et le contrôle des rôles DB passent également. Aucun déploiement applicatif n’a été effectué.

## Identité Yodev — 15 septembre 2026

La refonte adopte Yodev Spend, le symbole partagé, DM Sans/Fira Code et les tokens versionnés de `yodev/brand`. Thème sombre par défaut avec préférence locale conservée. Navigation regroupée et menu mobile complet, source manuelle du ledger explicitée. Les modifications locales de préparation commerciale et les règles financières sont conservées. Vérification de ce lot consignée dans le rapport de refonte Yodev.
