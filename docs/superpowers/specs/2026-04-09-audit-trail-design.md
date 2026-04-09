# Audit Trail — Design Spec

**Date:** 2026-04-09
**Status:** Draft for review
**Scope:** Add an append-only audit log to compliance-tracker, with two read surfaces (global activity feed, per-obligation history) and actor attribution via Vercel Deployment Protection SSO JWT.

## Goal

Answer two questions for any user of the tool, at any time:

1. **"Who changed this obligation, and when?"** — per-entity timeline.
2. **"What happened across all obligations recently?"** — global activity feed.

Lay a foundation that a future multi-user access control layer can build on without data migration.

## Non-goals

- Cryptographic tamper-evidence (hash chain, attestation exports). Deferrable without schema change.
- Read/view event logging. No attribution source and high noise.
- Log retention, archival, or compaction. Volume is trivially small.
- Export of the audit log. Owned by a later CSV feature.
- Backfill of historical events prior to deploy. History starts on first write.
- Real multi-user auth. `getActor` is the seam; swapping the implementation is out of scope for this spec.

## Data model

New table, append-only. No `UPDATE` or `DELETE` calls anywhere in the codebase.

```ts
// src/db/schema.ts
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),                 // ulid
  ts: text('ts').notNull(),                    // ISO timestamp
  eventType: text('event_type').notNull(),     // see "Event types" below
  actor: text('actor').notNull(),              // email, 'cron', or 'system'
  actorSource: text('actor_source').notNull(), // 'sso' | 'cron' | 'dev' | 'system'
  entityType: text('entity_type').notNull(),   // 'obligation' | 'template' | 'alert'
  entityId: text('entity_id'),                 // nullable (bulk, digest)
  summary: text('summary').notNull(),          // short human description
  diff: text('diff'),                          // JSON { field: [before, after] } or null
  metadata: text('metadata'),                  // JSON, event-specific, or null
})
```

**Indexes:**
- `(ts DESC)` — powers the global feed with keyset pagination.
- `(entity_type, entity_id, ts DESC)` — powers the per-obligation timeline.

### Event types (7)

| Type                     | When                                           | diff            | metadata example                                        |
| ------------------------ | ---------------------------------------------- | --------------- | ------------------------------------------------------- |
| `obligation.created`     | POST /api/obligations                          | null            | `{ fields: [...] }`                                     |
| `obligation.updated`     | PUT /api/obligations/[id]                      | tracked fields  | null                                                    |
| `obligation.deleted`     | DELETE /api/obligations/[id]                   | null            | `{ snapshot: {...full row} }`                           |
| `obligation.completed`   | POST /api/obligations/[id]/complete            | null            | `{ completionId, evidenceCount, nextDueDate }`          |
| `obligation.bulk_updated`| POST /api/obligations/bulk                     | null            | `{ action, obligationIds: [...], count }`               |
| `template.applied`       | POST /api/templates (apply)                    | null            | `{ templateId, createdIds: [...], count }`              |
| `alert.sent`             | email-send helper, from /api/alerts and crons  | null            | `{ obligationId, recipient, channel: 'email' }`         |

### Tracked fields (for `diff` on `obligation.updated`)

`title, nextDueDate, owner, assignee, riskLevel, frequency, autoRecur, category, notes`

Changes outside this allowlist (notably `updatedAt`) are not logged, to keep the diff meaningful.

## Actor resolution

One abstraction, one file.

```ts
// src/lib/actor.ts
export type Actor = { email: string; source: 'sso' | 'cron' | 'dev' | 'system' }
export async function getActor(req: Request): Promise<Actor>
```

Resolution order:

1. **Vercel SSO JWT** — verify signed cookie against Vercel's JWKS using `jose`. Extract `email`. Return `{ source: 'sso' }`.
2. **Cron secret** — `Authorization: Bearer ${CRON_SECRET}` matches. Return `{ email: 'cron', source: 'cron' }`.
3. **Dev fallback** — `NODE_ENV !== 'production'`. Return `{ email: process.env.DEV_ACTOR ?? 'dev@local', source: 'dev' }`.
4. **System fallback** — none of the above. Return `{ email: 'system', source: 'system' }`.

This is the seam for future real auth. Swapping step 1 from "read Vercel JWT" to "read Clerk/Auth.js session" is a one-file change. The `audit_log.actor` column already stores the right shape (email string).

## Writer helpers

### `src/lib/audit.ts`

```ts
export async function logEvent(event: {
  type: AuditEventType
  actor: Actor
  entityType: 'obligation' | 'template' | 'alert'
  entityId?: string | null
  summary: string
  diff?: Record<string, [unknown, unknown]> | null
  metadata?: Record<string, unknown> | null
}): Promise<void>
```

Writes one row to `audit_log`. **Never throws to the caller** — on DB error it `console.error`s and swallows. A failing audit write must not break a user-facing mutation. This is a deliberate availability-over-completeness tradeoff; it can be reversed by removing the try/catch if strict semantics become necessary.

### `src/lib/audit-helpers.ts`

```ts
export async function auditedUpdate(
  id: string,
  patch: Partial<Obligation>,
  actor: Actor
): Promise<Obligation>
```

Convenience for the common `load → patch → diff → write → log` flow. Used by simple single-obligation updates. Bulk, template-apply, and alert paths call `logEvent` directly because they need custom metadata.

### `src/lib/diff.ts`

```ts
export function diffFields<T>(
  before: T,
  after: T,
  trackedFields: readonly (keyof T)[]
): Record<string, [unknown, unknown]>
```

Pure function. Returns only fields that actually changed. Unit-tested in isolation.

## Call sites

Seven write paths. Each handler calls `await getActor(req)` once at the top, then either `auditedUpdate(...)` or `logEvent(...)`.

| Route / location                             | Event                    | Helper          |
| -------------------------------------------- | ------------------------ | --------------- |
| `POST /api/obligations`                      | `obligation.created`     | `logEvent`      |
| `PUT /api/obligations/[id]`                  | `obligation.updated`     | `auditedUpdate` |
| `DELETE /api/obligations/[id]`               | `obligation.deleted`     | `logEvent`      |
| `POST /api/obligations/[id]/complete`        | `obligation.completed`   | `logEvent`      |
| `POST /api/obligations/bulk`                 | `obligation.bulk_updated`| `logEvent`      |
| `POST /api/templates` (apply)                | `template.applied`       | `logEvent`      |
| `sendAlertEmail()` (library)                 | `alert.sent`             | `logEvent`      |

Each route touches at most ~5 new lines.

## Read surfaces

### Global activity feed

**New page:** `/activity`

- Server component.
- Query: `SELECT * FROM audit_log ORDER BY ts DESC LIMIT 50` with keyset pagination (`WHERE ts < ?`).
- Layout: dense table matching the existing dashboard style. Columns: `when | actor | event | summary | link`.
- Filters via query string: `?type=obligation.updated`, `?actor=alice@acme.com`, `?entity=<id>`. Link-based, no form UI.
- Nav entry in the existing sidebar between "Templates" and "Categories".
- Empty state on first render: `"History begins on 2026-04-09"`.

### Per-obligation history

**New panel** on the existing obligation detail view in `/obligations`.

- Query: `SELECT * FROM audit_log WHERE entity_type='obligation' AND entity_id=? ORDER BY ts DESC LIMIT 20`.
- Collapsed by default: `"History (N events) ▼"`, expands to a timeline.
- For `updated` events, render the diff inline: `owner: Internal → Anderson & Co`.
- Rendered below the existing completion history in the same panel.

### Read API

**New route:** `GET /api/audit`

- Same query params as the feed page.
- Returns `{ events: AuditEvent[], nextCursor?: string }`.
- No POST/PUT/DELETE. The table is append-only and the writer helper is the only path.

## Testing

Colocated `__tests__` per existing convention.

**Unit:**

- `diffFields` — additions, removals, no-op, ignored fields, mixed changes.
- `getActor` — each branch: SSO JWT valid/invalid, cron secret match/mismatch, dev fallback, production system fallback.

**Integration:**

- PUT an obligation → assert exactly one `obligation.updated` row with correct diff, actor, and timestamp.
- `logEvent` throws internally → assert user-facing mutation still returns 200 (verifies swallow-on-error semantics).
- Template apply → assert one `template.applied` event with `createdIds` populated.

## Migration

- Add `audit_log` to `src/db/schema.ts`.
- Add `CREATE TABLE IF NOT EXISTS audit_log (...)` and its two indexes to the in-memory init in `src/db/index.ts`, matching the existing pattern for `obligations` and `completions`.
- `drizzle-kit push` for any Turso deployment.
- No data backfill. History starts at deploy time.

## Dependencies

One new npm dep: `jose` (JWT verification against Vercel JWKS). Small, zero runtime-config.

## Risks and open questions

- **Vercel JWT format stability.** Vercel's Deployment Protection SSO JWT cookie name and claims are not a stable public API. If Vercel changes the shape, `getActor` step 1 breaks and all events attribute to `'system'`. Mitigation: `getActor` has a robust fallback chain, so this degrades gracefully — it never 500s, it just loses attribution. Worth a comment in the code pointing at the JWKS endpoint and a smoke test.
- **Cron routes and actor attribution.** Cron-triggered events (`alert.sent` from `/api/cron/check-alerts`) attribute to `'cron'`. That's the right answer; noted here so future readers don't confuse it with missing attribution.
- **In-memory DB reset on every cold start.** On Vercel serverless without Turso, the audit log is ephemeral — it resets with the rest of the DB. This is a pre-existing limitation of the current deployment, not caused by this spec. The audit log becomes durable the day Turso is configured; no code change needed.
