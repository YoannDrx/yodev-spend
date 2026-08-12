# Spend engineering rules

- Use npm, Next.js App Router, React Server Components by default, and strict TypeScript.
- Keep business logic in `src/server`; UI and route handlers only coordinate it.
- Scope every tenant-owned query and mutation by an authorized `workspaceId`.
- Never persist or log repository file contents, secret values, OAuth tokens, or installation tokens.
- Store money as integer minor units (`bigint`) with its original ISO 4217 currency.
- Provider detection is deterministic, registry-driven, explainable, and fixture-tested.
- Failed or partial scans never count as negative evidence.
- Archive business/financial records instead of deleting history.
- Generate and review SQL migrations; never use schema push in production.
- Update `.agent/exec-plans/spend-v1.md` when milestones or architectural decisions change.
- Before completion run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and relevant Playwright tests.

See `docs/ARCHITECTURE.md`, `docs/SCANNER.md`, and `docs/PRODUCTION_RUNBOOK.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
