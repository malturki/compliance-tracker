# Compliance Tracker

## Project overview

- Next.js 14 App Router app with TypeScript and Tailwind.
- Main UI pages live in `src/app/*`. Settings pages under `src/app/settings/*`.
- API routes live in `src/app/api/*`. Agent token routes at `src/app/api/agents/*`.
- Database code lives in `src/db/*`. Drizzle ORM over libsql (Turso in prod, file-based SQLite in tests, in-memory for dev without Turso).
- Auth: NextAuth v5 with Google provider in `src/lib/auth.ts`. Domain restriction and role provisioning in the `signIn` + `jwt` callbacks.
- Auth helpers (`requireRole`, `requireAuth`) in `src/lib/auth-helpers.ts` — work for both user sessions and agent bearer tokens.
- Actor resolution in `src/lib/actor.ts` — `getActor(req?)` returns who is performing the current action (sso user, agent, cron, dev fallback) and is the canonical input to the audit log.
- Agent token verification in `src/lib/agent-auth.ts` + token utils in `src/lib/token-utils.ts` (uses Web Crypto, works in Edge + Node).
- Audit log writer in `src/lib/audit.ts` + `auditedUpdate` helper in `src/lib/audit-helpers.ts`.
- Middleware at `src/middleware.ts` handles route protection, viewer restrictions, and the bearer-token bypass path.
- Shared validation logic lives in `src/lib/validation.ts`.
- Seed obligations live in `src/data/seed-obligations.json`.
- Templates live in `src/data/templates.ts`.
- **Playbook definitions** live in `src/data/playbooks.ts`; the apply-engine + parent rollup helper live in `src/lib/playbooks.ts`. Applied playbooks create a parent obligation + sub-obligation tree linked via `parent_id`.
- **Recommended-additions catalog** lives in `src/data/recommended-additions.ts` — curated standard-startup obligations browsable at `/catalog`.
- **Recurrence/frequency helpers** live in `src/lib/recurrence.ts` (`RECURRING_FREQUENCIES`, `RecurrenceCadence`, parsers for `?tab=` and `?cadence=` URL params on `/obligations`).
- The public agent skill content lives at `src/lib/compliance-tracker-skill.ts` and is served as markdown at `/.well-known/compliance-tracker-skill` (also mirrored in `docs/skills/compliance-tracker/SKILL.md`). Update both together when changing API surface.

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

- **423 tests across 33 files**, all passing. Integration tests hit a real file-based SQLite via `src/test/integration-helpers.ts` — no mocks for `@/db`. Overall coverage is ~91% lines / ~96.5% functions.
- Test setup (`src/test-setup.ts`) creates a temp `file:$TMPDIR/compliance-tracker-test-*.db` per `process.pid` and runs the full schema in `beforeAll`. Existing pre-test DB files are unlinked on startup for isolation.
- Integration tests live in `src/test/integration/` (17 files) and cover: CRUD workflow, completion status semantics, completion-flow edge cases (multipart upload, recurrence advancement, validation errors), evidence packets, sub-obligations + parent rollup, playbook engine + apply route + sub-obligations endpoint, recommended-additions catalog, bulk operations, audit log events, role enforcement matrix (every API route exercised across viewer/editor/admin/agent), agent authentication, user management, agent management, and the counterparty field.
- Pure-function unit tests live alongside source under `src/lib/` and `src/data/` (`utils.test.ts`, `validation.test.ts`, `recurrence.test.ts`, `blob.test.ts`, `templates.test.ts`, etc.) — these run without the DB.
- To test a specific role in an integration test, call `mockSession({email, role})` from `integration-helpers`. To test agent auth, call `mockSession(null)` and attach an `Authorization: Bearer ...` header via `mkReq`.
- When adding a new API route or changing role enforcement, add a case to `src/test/integration/role-enforcement.test.ts`.
- Tests that read multipart/form-data uploads must declare `// @vitest-environment node` at the top of the file. JSDOM (the default) ships its own `File` class that doesn't satisfy `value instanceof File` inside the route handler, so uploaded files would silently get dropped.
- Vitest spawns workers per file; `compliance-tracker-test-*.db` files in `/tmp` accumulate. `rm -f /tmp/compliance-tracker-test-*.db` before a test run if you've recently changed schema and tests start failing with "no such column."

## Auth and access control

- Three roles: `viewer`, `editor`, `admin`. Hierarchy enforced by `checkRole` / `requireRole` in `src/lib/auth-helpers.ts`.
- Humans sign in via Google OAuth. Email must match one of the comma-separated domains in `GOOGLE_ALLOWED_DOMAIN` (production: `fast.xyz,pi2labs.org`). First user to sign in becomes admin; everyone else starts as `viewer`.
- Agents authenticate via bearer tokens stored as SHA-256 hashes in the `agents` table. Admin creates them at `/settings/agents`. Tokens shown exactly once at creation or regeneration.
- Middleware does NOT verify bearer tokens (libsql isn't Edge-compatible). It passes Bearer-authenticated requests through and the route handler's `requireRole` does the actual verification at Node runtime.
- Viewer role restrictions: middleware redirects viewers away from `/calendar`, `/obligations`, `/templates`, `/playbooks`, `/catalog`, `/activity`, `/categories`, `/settings` and returns 403 on non-GET API requests. Keep this list in sync with the editor-min nav entries in `src/components/layout/sidebar.tsx`.
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
- Schema changes need updates in **5 places**: `src/db/schema.ts`, `src/db/index.ts` (in-memory init DDL + the seed INSERT), `src/db/seed.ts` (DDL + INSERT), `src/test-setup.ts`, and `src/test/integration-helpers.ts`. Plus a Turso `ALTER TABLE` migration script committed to `scripts/` and hand-run against prod before the deploy goes live (Phase 0's `scripts/migrate-2026-04-23-agentic.sql` is the example — `set -a; source .vercel/.env.production.local; set +a; node script.mjs`). Plus any `__tests__/*.test.ts` legacy files that build their own DDL.
- Frequency is a free-text TEXT column in the DB, not a SQL enum, so adding new values (e.g. `bi-monthly`, `semi-annual`) needs no schema migration — just update the `Frequency` type in `src/lib/types.ts`, the `z.enum` lists in `src/lib/validation.ts`, the `RECURRING_FREQUENCIES` set + `RecurrenceCadence` type in `src/lib/recurrence.ts`, the `computeNextDueDate` switch in `src/lib/utils.ts`, and the `FREQUENCIES` const in `src/app/obligations/page.tsx`.

## Obligations data model

- **`entity`** is the *internal* party — always `Pi Squared Inc.`. Defaults set in schema, validation, and UI. Don't repurpose this field.
- **`counterparty`** is the *external* party an obligation is owed to (AWS, IRS, Venture Partners LP, Republic Registered Agent LLC). Free-text, nullable, max 200 chars. Used for filtering, the "By counterparty" rollup on `/categories`, and grouping in the obligations list. Tracked in audit diffs.
- **`jurisdiction`** is the *geographic scope* (Delaware, California, Federal). One jurisdiction can have many counterparties (e.g. CA Franchise Tax Board vs CA EDD vs CA Secretary of State). Also tracked in audit diffs.
- **`parent_id`** links sub-obligations to their parent (Phase 0). Hides the child from the main `/obligations` list — children only render in the parent's detail Sheet as a tree. Used by the playbook engine.
- **`status`** also accepts `'blocked'`. When set, `blocker_reason` is required. Renders as a danger-tinted callout in the detail Sheet.
- **`next_recommended_action`** is a free-text owner-facing hint shown above the completion button.
- Counterparty edits happen via inline-edit in the detail panel (`CounterpartyEditor` in `src/app/obligations/page.tsx`). The autocomplete data source is `GET /api/counterparties`, which returns distinct names with counts and is viewer-readable.
- When backfilling counterparty for new bulk-imported data, leave truly internal obligations (board meetings, internal audits, policy reviews) as `NULL` — only populate when there's a real external party.

## Completions and evidence packets

- A completion is a row in `completions` plus a status flip on the obligation. Recurring obligations with `autoRecur=true` advance their `nextDueDate` instead of going terminal. Non-recurring completions are terminal (status='completed').
- The evidence-packet columns on `completions` (`approved_by`, `approved_date`, `verification_status`, `summary`, `evidence_urls`) are all nullable — pre-existing rows continue to work. The `verification_status` enum is `'unverified' | 'self-verified' | 'approved' | 'audited'` and defaults to `'unverified'`. `approved_date` must not precede `completed_date` (validated server-side).
- `completed_by` is loose TEXT for back-compat (historical rows hold names like "Tester"). The UI now constrains new completions to system-user emails via a `<Select>` populated from `/api/users`, defaulting to the current session user. Don't tighten the schema unless you're prepared to migrate the data.
- When a sub-obligation completes and every sibling under the same `parent_id` is also `completed`, `maybeRollupParent` in `src/lib/playbooks.ts` auto-completes the parent and emits an `obligation.parent_rollup_complete` audit event. The completion route's response includes `parentCompleted` + `parentId` to signal this.

## Playbooks and catalog

- **Playbooks** (`src/data/playbooks.ts`, `src/lib/playbooks.ts`) define reusable workflow trees. Applying one creates a parent obligation + sub-obligations with deadlines computed from an anchor date. Currently shipped: `quarterly-investor-report` (full 5-step) and `annual-insurance-renewal` (placeholder, no steps yet). UI at `/playbooks`.
- **Counterparty is supplied at apply time**, not in the playbook definition — so a single "Quarterly Investor Report" playbook applies to every investor.
- Apply-time inputs: `playbookId`, `anchorDate`, `counterparty?`, `ownerOverrides?` (per-step). Title placeholders `{{counterparty}}`, `{{quarter}}`, `{{year}}` are resolved at creation.
- **Catalog** (`src/data/recommended-additions.ts`, `/catalog`) is a curated list of standard-startup obligations not yet in the tracker (state securities, tax, privacy, IP, crypto). Adding an item is just `POST /api/obligations` with the item's defaults — no special endpoint. Items have `maturity: 'now' | 'future'`; "future" items render as dimmed reminders without an Add button.

## Recurrence tabs and cadence filter

The `/obligations` page splits obligations into three tabs (`?tab=`):

- **All** (default) — top-level obligations regardless of frequency
- **Recurring** — frequency in `{annual, semi-annual, quarterly, bi-monthly, monthly, weekly}`. Shows a secondary cadence-pill row that further filters by specific frequency (`?cadence=`).
- **One-time** — frequency in `{one-time, event-triggered}`

Sub-obligations (any row with `parent_id` set) are hidden from all three tabs — they only render inside the parent's detail Sheet. Tab + cadence state are URL-deep-linkable. The constants and parsers live in `src/lib/recurrence.ts`.

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

- The app follows the FAST design language (see `docs/superpowers/plans/2026-04-17-fast-rebrand.md`):
  - Light theme, Platinum canvas (`#F6F8FA`), white cards, Graphite (`#2B2C2F`) text.
  - General Sans typography (woff2 in `public/fonts/`, loaded via `next/font/local` in `src/app/layout.tsx`).
  - Accent is Light Steel Blue `#A1B0CF` — use as a blade, not a paint bucket.
  - FAST wordmark logo in sidebar (`public/fast-logo-dark.svg`); never type "FAST" as plain text.
  - Semantic colors (`danger`, `warning`, `success`) are Tailwind tokens; prefer `text-danger` over inline `#B45555`.
- Keep density controlled but not crowded. One dominant pane per page.
- Viewer role sees a reduced UI: only Overview and Dashboard in the sidebar, stats + category breakdown on Overview (no obligation tables), no owner-performance table on Dashboard. Tune viewer experience when changing page layouts.
- Role-badge colors live in `src/lib/role-colors.ts` — reuse `ROLE_BADGE_CLASSES` instead of re-defining per page.
- **Mobile layout (375px iPhone SE baseline):**
  - Sidebar becomes a drawer below `lg` (hamburger at fixed `top-3 left-3`, backdrop overlay, Esc / navigation auto-closes).
  - AppShell main is `lg:ml-64` (no margin on mobile) with `pt-12` to clear the hamburger. `min-w-0` on `<main>` allows `flex-1` to actually shrink — without it, wide children (tables) push the whole page wider than the viewport.
  - `html, body { overflow-x: clip }` in `src/app/globals.css` is the global safety net against any stray horizontal overflow.
  - Tables in `/obligations`, `/activity`, `/settings/users`, `/settings/agents` use `md:min-w-[XYZ]` (not unconditional `min-w-`) so they only impose a wide layout from md+; on mobile the table fits the viewport. Less-critical columns are hidden via `hidden md:table-cell`.
  - Obligations detail Sheet is `w-full sm:w-[420px]`. Inside, the body uses a native `<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">` (NOT Base UI's `ScrollArea`) — Safari sometimes drops touchmove events inside ScrollArea's transformed viewport when nested in a Dialog focus trap.
  - Owner Performance table on `/dashboard` hides Upcoming + Avg Days columns below md.
  - Calendar collapses the right detail panel below the grid on mobile, abbreviates day headers to single letters, and replaces the per-day chip list with a single count pill.
  - Categories grids are `grid-cols-1 md:grid-cols-2` (and `md:grid-cols-2 lg:grid-cols-3` for counterparty cards).
  - Settings/{users,agents} non-admin landing renders an inline "Admin access required" card instead of a silent redirect.
- Follow the FAST pre-ship checklist at `/tmp/fast-demo-kit/fast-demo-kit/references/pre-ship-checklist.md` (or the copy at `docs/superpowers/plans/2026-04-17-fast-rebrand.md#phase-10`) before shipping a new surface.

## Keyboard and navigation

- `Cmd/Ctrl + K` opens the command palette (`src/components/command-palette.tsx`). Searches obligations by title and jumps to pages/filters. Role-aware.
- `?` opens the keyboard shortcuts help dialog (`src/components/keyboard-shortcuts-help.tsx`).
- `Esc` closes modals. Note: not implemented everywhere yet — verify before adding a modal without Esc handling.
