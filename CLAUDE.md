# Compliance Tracker

## Project overview

- Next.js 14 App Router app with TypeScript and Tailwind.
- Main UI pages live in `src/app/*`.
- API routes live in `src/app/api/*`.
- Database code lives in `src/db/*`.
- Shared validation logic lives in `src/lib/validation.ts`.
- Seed obligations live in `src/data/seed-obligations.json`.
- Templates live in `src/data/templates.ts`.

## Commands

- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Full test run: `npm test -- --run`
- Focused test run: `npx vitest path/to/test-file.ts --run`
- Seed local DB: `npm run seed`
- Push schema: `npm run db:push`
- Open DB studio: `npm run db:studio`

## Current repo gotchas

- `npm run build` is expected to pass — investigate if it doesn't.
- `npm test -- --run` currently has failing API tests. Do not assume the full suite is green.
- `npm run lint` is not fully configured yet and can trigger the Next.js interactive ESLint setup prompt. Do not rely on lint unless ESLint is explicitly configured in the repo.
- Production uses Turso (`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set on Vercel). Local dev uses in-memory SQLite seeded from JSON. `drizzle.config.ts` reads `DATABASE_URL` for schema push.
- DB client creation is lazy (Proxy in `src/db/index.ts`) to avoid build-time connection failures.
- `.env.local` on the VPS is the working local config. Never commit secrets.
- When setting Vercel env vars via CLI, use `printf` not `echo` to avoid trailing newlines.
- Vercel build cache can serve stale webpack chunks after DB init changes. If a deploy 500s but local build works, redeploy with `vercel --prod --force` to bypass cache.

## Workflow

- For multi-file or architectural changes, propose a plan and confirm before editing.
- For small isolated changes, edit directly.
- Run the smallest meaningful verification first, then broader checks if needed.
- When editing API behavior, update or add Vitest coverage in the adjacent `__tests__` files.
- Keep diffs tight. Do not reformat unrelated files.

## Commits and PRs

- Use conventional commit prefixes (`fix:`, `feat:`, `chore:`, `refactor:`) to match existing history.
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
