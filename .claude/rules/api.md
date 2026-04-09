---
paths:
  - "src/app/api/**"
  - "src/lib/validation.ts"
---

# API route guidance

- DB-backed routes should import and await `dbReady` before querying.
- Validate request bodies and query inputs explicitly. Prefer existing helpers in `src/lib/validation.ts`.
- Keep status codes intentional and stable. Avoid silent fallthrough to `500` when the real outcome is `400`, `404`, or `409`.
- When changing route behavior, update the adjacent Vitest coverage in `__tests__`.
- Keep response shapes consistent across similar endpoints.
