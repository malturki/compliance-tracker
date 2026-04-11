# Compliance Tracker

## Project overview

- Next.js 14 App Router app with TypeScript and Tailwind.
- Main UI pages live in `src/app/*`. Settings pages under `src/app/settings/*`.
- API routes live in `src/app/api/*`. Agent token routes at `src/app/api/agents/*`.
- Database code lives in `src/db/*`. Drizzle ORM over libsql (Turso in prod, file-based SQLite in tests, in-memory for dev without Turso).
- Auth: NextAuth v5 with Google provider in `src/lib/auth.ts`. Domain restriction and role provisioning in the `signIn` + `jwt` callbacks.
- Auth helpers (`requireRole`, `requireAuth`) in `src/lib/auth-helpers.ts` — work for both user sessions and agent bearer tokens.
- Agent token verification in `src/lib/agent-auth.ts` + token utils in `src/lib/token-utils.ts` (uses Web Crypto, works in Edge + Node).
- Audit log writer in `src/lib/audit.ts` + `auditedUpdate` helper in `src/lib/audit-helpers.ts`.
- Middleware at `src/middleware.ts` handles route protection, viewer restrictions, and the bearer-token bypass path.
- Shared validation logic lives in `src/lib/validation.ts`.
- Seed obligations live in `src/data/seed-obligations.json`.
- Templates live in `src/data/templates.ts`.
- The public agent skill content lives at `src/lib/compliance-tracker-skill.ts` and is served as markdown at `/.well-known/compliance-tracker-skill` (also mirrored in `docs/skills/compliance-tracker/SKILL.md`).

## Commands

- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Full test run: `npx vitest --run` (or `npm test -- --run`)
- Focused test run: `npx vitest path/to/test-file.ts --run`
- Integration tests only: `npx vitest src/test/integration --run`
- Seed local DB: `npm run seed`
- Push schema: `npm run db:push`
- Open DB studio: `npm run db:studio`
- Prod smoke test: `./scripts/smoke-test-prod.sh` (optional `COMPLIANCE_TRACKER_TOKEN` env var)
- Local smoke test: `./scripts/smoke-test-local.sh` (expects `npm run dev` running)

## Testing

- **235 tests across 21 files**, all passing. Integration tests hit a real file-based SQLite via `src/test/integration-helpers.ts` — no mocks for `@/db`. Overall coverage is ~84% lines / ~82% branches.
- Test setup (`src/test-setup.ts`) creates a temp `file:$TMPDIR/compliance-tracker-test-*.db` per `process.pid` and runs the full schema in `beforeAll`. Existing pre-test DB files are unlinked on startup for isolation.
- Integration tests live in `src/test/integration/` and cover: CRUD workflow, completion status semantics, completion-flow edge cases (multipart upload, recurrence advancement, validation errors), bulk operations (every action variant + validation), audit log events, role enforcement matrix, agent authentication, user management, agent management, and the counterparty field.
- To test a specific role in an integration test, call `mockSession({email, role})` from `integration-helpers`. To test agent auth, call `mockSession(null)` and attach an `Authorization: Bearer ...` header via `mkReq`.
- When adding a new API route or changing role enforcement, add a case to `src/test/integration/role-enforcement.test.ts`.
- Tests that read multipart/form-data uploads must declare `// @vitest-environment node` at the top of the file. JSDOM (the default) ships its own `File` class that doesn't satisfy `value instanceof File` inside the route handler, so uploaded files would silently get dropped.

## Auth and access control

- Three roles: `viewer`, `editor`, `admin`. Hierarchy enforced by `checkRole` / `requireRole` in `src/lib/auth-helpers.ts`.
- Humans sign in via Google OAuth. Email must match one of the comma-separated domains in `GOOGLE_ALLOWED_DOMAIN` (production: `fast.xyz,pi2labs.org`). First user to sign in becomes admin; everyone else starts as `viewer`.
- Agents authenticate via bearer tokens stored as SHA-256 hashes in the `agents` table. Admin creates them at `/settings/agents`. Tokens shown exactly once at creation or regeneration.
- Middleware does NOT verify bearer tokens (libsql isn't Edge-compatible). It passes Bearer-authenticated requests through and the route handler's `requireRole` does the actual verification at Node runtime.
- Viewer role restrictions: middleware redirects viewers away from `/calendar`, `/obligations`, `/templates`, `/activity`, `/categories`, `/settings` and returns 403 on non-GET API requests.
- `requireRole(minRole, req?)` accepts an optional Request — pass `req` from API route handlers so it can read the Authorization header. Pages/server components omit `req` and fall back to `next/headers`.

## Current repo gotchas

- `npm run build` is expected to pass — investigate if it doesn't.
- `npm run lint` is not fully configured yet and can trigger the Next.js interactive ESLint setup prompt. Do not rely on lint unless ESLint is explicitly configured in the repo.
- Production uses Turso (`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set on Vercel). Local dev uses in-memory SQLite seeded from JSON. `drizzle.config.ts` reads `DATABASE_URL` for schema push.
- Tests set `TURSO_DATABASE_URL=file:/tmp/...` in `src/test-setup.ts` before the db module loads, so the test DB is a real file (not `:memory:`). This is required because libsql's `db.transaction()` has issues with `:memory:`.
- DB client creation is lazy (Proxy in `src/db/index.ts`) to avoid build-time connection failures when the build environment can't reach Turso.
- Vercel Deployment Protection is **disabled** for production — the app's own Google auth + agent tokens handle all access. Previews remain gated.
- When setting Vercel env vars via CLI, use `printf` not `echo` to avoid trailing newlines (causes `TypeError: Invalid URL`).
- Vercel build cache can serve stale webpack chunks after DB init changes. If a deploy 500s but local build works, redeploy with `vercel --prod --force` to bypass cache.
- Agent tokens use `ct_live_` prefix. Hashed with SHA-256 via Web Crypto (`src/lib/token-utils.ts`) so the same code works in Edge middleware and Node runtime.
- The hosted skill URL (`/.well-known/compliance-tracker-skill`) is in the middleware's bypass list so agents can fetch it without auth.
- Schema changes need updates in **5 places**: `src/db/schema.ts`, `src/db/index.ts` (in-memory init DDL + the seed INSERT), `src/db/seed.ts` (DDL + INSERT), `src/test-setup.ts`, and `src/test/integration-helpers.ts`. Plus a Turso `ALTER TABLE` for prod, and any `__tests__/*.test.ts` legacy files that build their own DDL.

## Obligations data model

- **`entity`** is the *internal* party — always `Pi Squared Inc.`. Defaults set in schema, validation, and UI. Don't repurpose this field.
- **`counterparty`** is the *external* party an obligation is owed to (AWS, IRS, Venture Partners LP, Republic Registered Agent LLC). Free-text, nullable, max 200 chars. Used for filtering, the "By counterparty" rollup on `/categories`, and grouping in the obligations list. Tracked in audit diffs.
- **`jurisdiction`** is the *geographic scope* (Delaware, California, Federal). One jurisdiction can have many counterparties (e.g. CA Franchise Tax Board vs CA EDD vs CA Secretary of State). Also tracked in audit diffs.
- Counterparty edits happen via inline-edit in the detail panel (`CounterpartyEditor` in `src/app/obligations/page.tsx`). The autocomplete data source is `GET /api/counterparties`, which returns distinct names with counts and is viewer-readable.
- When backfilling counterparty for new bulk-imported data, leave truly internal obligations (board meetings, internal audits, policy reviews) as `NULL` — only populate when there's a real external party.

## Workflow

- For multi-file or architectural changes, propose a plan and confirm before editing.
- For small isolated changes, edit directly.
- Run the smallest meaningful verification first, then broader checks if needed.
- When editing API behavior, update or add Vitest coverage — prefer integration tests in `src/test/integration/` over the legacy mocked-db tests.
- Keep diffs tight. Do not reformat unrelated files.
- Prefer feature branches + fast-forward merge to main over direct edits when the change touches more than one or two files.

## Commits and PRs

- Use conventional commit prefixes (`fix:`, `feat:`, `chore:`, `refactor:`, `test:`, `docs:`) to match existing history.
- Subject line in the imperative, lowercase, no trailing period.
- Only commit when explicitly asked.

## Data and privacy

- The canonical entity name is `Pi Squared Inc.` — use it consistently for the default `entity` field, UI labels, seed data, and any new fixtures.
- Do not reintroduce private investor names, personal emails, home addresses, or other sensitive PII into committed code, seed data, screenshots, or docs unless explicitly asked.
- When anonymization is needed (e.g., a generic example in documentation unrelated to the real app), use `Acme Corp` as the placeholder.

## UI direction

- Preserve the current dense, operational dashboard feel.
- Avoid playful consumer SaaS styling.
- Prefer incremental UI improvements over broad restyles.
- Viewer role sees a reduced UI: only Overview and Dashboard in the sidebar, stats + category breakdown on Overview (no obligation tables), no owner-performance table on Dashboard. Tune viewer experience when changing page layouts.

## Keyboard and navigation

- `Cmd/Ctrl + K` opens the command palette (`src/components/command-palette.tsx`). Searches obligations by title and jumps to pages/filters. Role-aware.
- `?` opens the keyboard shortcuts help dialog (`src/components/keyboard-shortcuts-help.tsx`).
- `Esc` closes modals. Note: not implemented everywhere yet — verify before adding a modal without Esc handling.
