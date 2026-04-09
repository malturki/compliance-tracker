---
paths:
  - "src/db/**"
  - "drizzle.config.ts"
  - ".env.example"
---

# Database guidance

- Keep local development safe and predictable. Prefer local SQLite unless the task specifically requires Turso or Vercel environment behavior.
- Database changes often need updates in more than one place: `src/db/schema.ts`, `src/db/index.ts`, and `src/db/seed.ts`.
- If schema changes affect API payloads, also update validation and tests.
- Be careful with the current env mismatch: app runtime uses `TURSO_DATABASE_URL`, while `drizzle.config.ts` uses `DATABASE_URL`.
- Do not commit real credentials, tokens, or production connection strings.
