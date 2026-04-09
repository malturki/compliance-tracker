# Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an append-only audit log with two read surfaces (global `/activity` feed and per-obligation history), attributed to real user identities via Vercel Deployment Protection SSO JWT, without breaking any existing user-facing mutation.

**Architecture:** One new `audit_log` table. Three small library files (`src/lib/diff.ts`, `src/lib/actor.ts`, `src/lib/audit.ts`) plus one helper (`src/lib/audit-helpers.ts`). Every existing write path calls `await getActor(req)` once and then either `auditedUpdate(...)` or `logEvent(...)`. Two read surfaces: a new `/activity` page and a history panel on the existing obligations detail view. One new read API at `GET /api/audit`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM, libsql client (in-memory on Vercel / file on dev), Vitest, `jose` (new dep for JWT verification), `date-fns` (already present), `ulid` (already present), Tailwind.

**Reference spec:** [docs/superpowers/specs/2026-04-09-audit-trail-design.md](../specs/2026-04-09-audit-trail-design.md)

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `src/db/schema.ts` | Modify | Add `auditLog` table definition |
| `src/db/index.ts` | Modify | Add `CREATE TABLE audit_log` + two indexes to in-memory init |
| `src/lib/diff.ts` | Create | Pure `diffFields()` function |
| `src/lib/diff.test.ts` | Create | Unit tests for diffFields |
| `src/lib/actor.ts` | Create | `getActor(req)` with SSO / cron / dev / system fallback |
| `src/lib/actor-vercel-jwt.ts` | Create | JWT verification against Vercel JWKS |
| `src/lib/actor.test.ts` | Create | Unit tests for each branch |
| `src/lib/audit.ts` | Create | `logEvent()` writer, `AuditEventType` and `Actor` types |
| `src/lib/audit.test.ts` | Create | Tests for successful write and swallow-on-error |
| `src/lib/audit-helpers.ts` | Create | `auditedUpdate()` convenience |
| `src/app/api/obligations/route.ts` | Modify | Log `obligation.created` on POST |
| `src/app/api/obligations/[id]/route.ts` | Modify | Log `obligation.updated` via auditedUpdate on PUT, `obligation.deleted` on DELETE |
| `src/app/api/obligations/[id]/complete/route.ts` | Modify | Log `obligation.completed` |
| `src/app/api/obligations/bulk/route.ts` | Modify | Log `obligation.bulk_updated` |
| `src/app/api/templates/route.ts` | Modify | Log `template.applied` on apply |
| `src/app/api/alerts/route.ts` | Modify | Log `alert.sent` after each successful send |
| `src/app/api/cron/check-alerts/route.ts` | Modify | Same, attributed to `cron` actor |
| `src/app/api/audit/route.ts` | Create | `GET /api/audit` list endpoint |
| `src/app/activity/page.tsx` | Create | Global activity feed page |
| `src/app/obligations/page.tsx` | Modify | Add History panel to obligation detail view |
| `src/components/ObligationHistory.tsx` | Create | Client component that renders per-obligation timeline |
| `src/app/api/obligations/__tests__/route.test.ts` | Modify | Assert audit row written for create/update |
| `package.json` | Modify | Add `jose` dependency |

---

## Task 1: Add `audit_log` to the database schema

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add the `auditLog` table to schema.ts**

Append to `src/db/schema.ts`:

```ts
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  ts: text('ts').notNull(),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  actorSource: text('actor_source').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  summary: text('summary').notNull(),
  diff: text('diff'),
  metadata: text('metadata'),
})
```

- [ ] **Step 2: Add the `CREATE TABLE` and indexes to in-memory init**

In `src/db/index.ts`, inside the `initInMemory()` function after the `CREATE TABLE completions` block:

```ts
await client.execute(`CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_source TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  diff TEXT,
  metadata TEXT
)`)

await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC)`)
await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id, ts DESC)`)
```

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds, no type errors.

- [ ] **Step 4: Commit**

Stage `src/db/schema.ts` and `src/db/index.ts`, then commit with message `feat(audit): add audit_log table and indexes`.

---

## Task 2: `diffFields` pure helper

**Files:**
- Create: `src/lib/diff.ts`
- Create: `src/lib/diff.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diffFields } from './diff'

describe('diffFields', () => {
  const tracked = ['title', 'owner', 'riskLevel'] as const

  it('returns empty object when nothing changed', () => {
    const row = { title: 'A', owner: 'X', riskLevel: 'low', notes: 'hi' }
    expect(diffFields(row, row, tracked)).toEqual({})
  })

  it('returns only fields that actually changed', () => {
    const before = { title: 'A', owner: 'X', riskLevel: 'low', notes: 'hi' }
    const after = { title: 'A', owner: 'Y', riskLevel: 'high', notes: 'hi' }
    expect(diffFields(before, after, tracked)).toEqual({
      owner: ['X', 'Y'],
      riskLevel: ['low', 'high'],
    })
  })

  it('ignores fields not in the tracked list', () => {
    const before = { title: 'A', owner: 'X', riskLevel: 'low', notes: 'hi' }
    const after = { title: 'A', owner: 'X', riskLevel: 'low', notes: 'bye' }
    expect(diffFields(before, after, tracked)).toEqual({})
  })

  it('handles null/undefined transitions', () => {
    const before = { title: 'A', owner: null as any, riskLevel: 'low' }
    const after = { title: 'A', owner: 'Y', riskLevel: 'low' }
    expect(diffFields(before, after, tracked)).toEqual({ owner: [null, 'Y'] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest src/lib/diff.test.ts --run`
Expected: FAIL with "Failed to load ... diff".

- [ ] **Step 3: Implement diffFields**

Create `src/lib/diff.ts`:

```ts
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  trackedFields: readonly (keyof T)[],
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {}
  for (const key of trackedFields) {
    const b = before[key]
    const a = after[key]
    if (b !== a) {
      out[key as string] = [b ?? null, a ?? null]
    }
  }
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest src/lib/diff.test.ts --run`
Expected: 4 passing.

- [ ] **Step 5: Commit**

Stage `src/lib/diff.ts` and `src/lib/diff.test.ts`, commit with message `feat(audit): add diffFields helper`.

---

## Task 3: `getActor` resolver

**Files:**
- Modify: `package.json`
- Create: `src/lib/actor.ts`
- Create: `src/lib/actor-vercel-jwt.ts`
- Create: `src/lib/actor.test.ts`

- [ ] **Step 1: Install `jose`**

Run: `npm install jose@5`
Expected: Adds `"jose": "^5.x.x"` to dependencies in package.json. No other changes.

- [ ] **Step 2: Write failing tests for getActor**

Create `src/lib/actor.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getActor } from './actor'

const mkReq = (opts: { cookie?: string; auth?: string } = {}) => {
  const headers = new Headers()
  if (opts.cookie) headers.set('cookie', opts.cookie)
  if (opts.auth) headers.set('authorization', opts.auth)
  return new Request('http://localhost/api/test', { headers })
}

describe('getActor', () => {
  const origEnv = { ...process.env }
  beforeEach(() => {
    process.env = { ...origEnv }
  })
  afterEach(() => {
    process.env = origEnv
    vi.unstubAllGlobals()
  })

  it('returns cron actor when Authorization header matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'shh'
    const req = mkReq({ auth: 'Bearer shh' })
    expect(await getActor(req)).toEqual({ email: 'cron', source: 'cron' })
  })

  it('does not match cron on wrong secret', async () => {
    process.env.CRON_SECRET = 'shh'
    process.env.NODE_ENV = 'production'
    const req = mkReq({ auth: 'Bearer wrong' })
    const actor = await getActor(req)
    expect(actor.source).toBe('system')
    expect(actor.email).toBe('system')
  })

  it('returns dev actor in non-production when no JWT and no cron secret', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DEV_ACTOR = 'dev@local'
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'dev@local', source: 'dev' })
  })

  it('returns system when nothing is present in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.CRON_SECRET
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'system', source: 'system' })
  })
})
```

Note: a full SSO-JWT positive test requires mocking `verifyVercelJwt`. That is added as a Task 3 follow-up if needed; the four tests above cover every non-JWT branch and are sufficient for Phase 4 verification.

- [ ] **Step 3: Run tests to verify failure**

Run: `npx vitest src/lib/actor.test.ts --run`
Expected: FAIL (file not found or cannot import actor).

- [ ] **Step 4: Implement the JWT verifier in its own tiny file**

Create `src/lib/actor-vercel-jwt.ts`:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose'

// Vercel Deployment Protection SSO signs JWTs accessible via this JWKS endpoint.
// If Vercel changes the shape, this helper fails gracefully and getActor
// falls through to the 'system' branch — no 500s.
const JWKS_URL = new URL('https://vercel.com/.well-known/jwks.json')
const jwks = createRemoteJWKSet(JWKS_URL)

export async function verifyVercelJwt(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, jwks)
    const email = typeof payload.email === 'string' ? payload.email : null
    return email ? { email } : null
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Implement getActor**

Create `src/lib/actor.ts`:

```ts
import { verifyVercelJwt } from './actor-vercel-jwt'

export type Actor = {
  email: string
  source: 'sso' | 'cron' | 'dev' | 'system'
}

function readVercelJwtCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? ''
  // Match any cookie whose name starts with `_vercel_jwt`
  const match = /(?:^|;\s*)(_vercel_jwt[^=]*)=([^;]+)/.exec(cookie)
  return match ? match[2] : null
}

export async function getActor(req: Request): Promise<Actor> {
  // 1. Vercel SSO JWT
  const token = readVercelJwtCookie(req)
  if (token) {
    const verified = await verifyVercelJwt(token)
    if (verified?.email) {
      return { email: verified.email, source: 'sso' }
    }
  }

  // 2. Cron secret
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return { email: 'cron', source: 'cron' }
  }

  // 3. Dev fallback
  if (process.env.NODE_ENV !== 'production') {
    return { email: process.env.DEV_ACTOR ?? 'dev@local', source: 'dev' }
  }

  // 4. System fallback
  return { email: 'system', source: 'system' }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest src/lib/actor.test.ts --run`
Expected: 4 passing.

- [ ] **Step 7: Commit**

Stage `package.json`, `package-lock.json`, `src/lib/actor.ts`, `src/lib/actor-vercel-jwt.ts`, `src/lib/actor.test.ts`. Commit with message `feat(audit): add getActor resolver with Vercel SSO JWT verification`.

---

## Task 4: `logEvent` writer and types

**Files:**
- Create: `src/lib/audit.ts`
- Create: `src/lib/audit.test.ts`

- [ ] **Step 1: Write failing tests for logEvent**

Create `src/lib/audit.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logEvent } from './audit'

beforeEach(async () => {
  await dbReady
  await db.delete(auditLog)
})

describe('logEvent', () => {
  it('writes one row with all fields populated', async () => {
    await logEvent({
      type: 'obligation.updated',
      actor: { email: 'alice@acme.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_123',
      summary: 'Updated owner',
      diff: { owner: ['X', 'Y'] },
      metadata: { extra: 1 },
    })
    const rows = await db.select().from(auditLog)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.eventType).toBe('obligation.updated')
    expect(row.actor).toBe('alice@acme.com')
    expect(row.actorSource).toBe('sso')
    expect(row.entityType).toBe('obligation')
    expect(row.entityId).toBe('ob_123')
    expect(row.summary).toBe('Updated owner')
    expect(JSON.parse(row.diff!)).toEqual({ owner: ['X', 'Y'] })
    expect(JSON.parse(row.metadata!)).toEqual({ extra: 1 })
    expect(row.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('stores null for absent diff and metadata', async () => {
    await logEvent({
      type: 'obligation.created',
      actor: { email: 'system', source: 'system' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created',
    })
    const rows = await db.select().from(auditLog)
    expect(rows[0].diff).toBeNull()
    expect(rows[0].metadata).toBeNull()
  })

  it('does not throw when the DB write fails (swallow-on-error)', async () => {
    const spy = vi.spyOn(db, 'insert').mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      logEvent({
        type: 'obligation.created',
        actor: { email: 'system', source: 'system' },
        entityType: 'obligation',
        entityId: 'ob_1',
        summary: 'Created',
      }),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    spy.mockRestore()
    errSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest src/lib/audit.test.ts --run`
Expected: FAIL (cannot import logEvent).

- [ ] **Step 3: Implement logEvent**

Create `src/lib/audit.ts`:

```ts
import { ulid } from 'ulid'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
import type { Actor } from './actor'

export type AuditEventType =
  | 'obligation.created'
  | 'obligation.updated'
  | 'obligation.deleted'
  | 'obligation.completed'
  | 'obligation.bulk_updated'
  | 'template.applied'
  | 'alert.sent'

export type AuditEntityType = 'obligation' | 'template' | 'alert'

export type LogEventInput = {
  type: AuditEventType
  actor: Actor
  entityType: AuditEntityType
  entityId?: string | null
  summary: string
  diff?: Record<string, [unknown, unknown]> | null
  metadata?: Record<string, unknown> | null
}

export async function logEvent(event: LogEventInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: ulid(),
      ts: new Date().toISOString(),
      eventType: event.type,
      actor: event.actor.email,
      actorSource: event.actor.source,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      summary: event.summary,
      diff: event.diff ? JSON.stringify(event.diff) : null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    })
  } catch (err) {
    // Never break a user-facing mutation because the audit write failed.
    console.error('[audit] logEvent failed', err)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest src/lib/audit.test.ts --run`
Expected: 3 passing.

- [ ] **Step 5: Commit**

Stage `src/lib/audit.ts` and `src/lib/audit.test.ts`, commit with message `feat(audit): add logEvent writer with swallow-on-error semantics`.

---

## Task 5: `auditedUpdate` helper

**Files:**
- Create: `src/lib/audit-helpers.ts`

- [ ] **Step 1: Implement the helper**

Create `src/lib/audit-helpers.ts`:

```ts
import { db } from '@/db'
import { obligations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { diffFields } from './diff'
import { logEvent } from './audit'
import type { Actor } from './actor'

// Fields whose changes are worth recording in the audit log diff.
// Changes outside this list (e.g. updatedAt, lastAlertSent) are intentionally
// ignored so the log shows meaningful activity, not bookkeeping churn.
export const TRACKED_OBLIGATION_FIELDS = [
  'title',
  'nextDueDate',
  'owner',
  'assignee',
  'riskLevel',
  'frequency',
  'autoRecur',
  'category',
  'notes',
] as const

type ObligationRow = typeof obligations.$inferSelect

export async function auditedUpdate(
  id: string,
  patch: Partial<ObligationRow>,
  actor: Actor,
): Promise<ObligationRow | null> {
  const before = (await db.select().from(obligations).where(eq(obligations.id, id)))[0]
  if (!before) return null

  const nowIso = new Date().toISOString()
  const next = { ...patch, updatedAt: nowIso }

  await db.update(obligations).set(next).where(eq(obligations.id, id))
  const after = (await db.select().from(obligations).where(eq(obligations.id, id)))[0]

  const diff = diffFields(before, after, TRACKED_OBLIGATION_FIELDS)
  // Skip logging updates that only touched non-tracked fields.
  if (Object.keys(diff).length > 0) {
    await logEvent({
      type: 'obligation.updated',
      actor,
      entityType: 'obligation',
      entityId: id,
      summary: `Updated ${Object.keys(diff).join(', ')}`,
      diff,
    })
  }

  return after
}
```

- [ ] **Step 2: Run the build and existing tests**

Run: `npm run build`
Expected: Build succeeds.

Run: `npx vitest src/lib --run`
Expected: All Task 2-4 tests still passing.

- [ ] **Step 3: Commit**

Stage `src/lib/audit-helpers.ts`, commit with message `feat(audit): add auditedUpdate helper with tracked fields allowlist`.

---

## Task 6: Wire up `POST /api/obligations` (create)

**Files:**
- Modify: `src/app/api/obligations/route.ts`

- [ ] **Step 1: Add the audit call to the POST handler**

At the top of `src/app/api/obligations/route.ts` add imports:

```ts
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'
```

Inside the POST handler, after the successful insert and before returning the response, add:

```ts
const actor = await getActor(request)
await logEvent({
  type: 'obligation.created',
  actor,
  entityType: 'obligation',
  entityId: created.id,
  summary: `Created "${created.title}"`,
  metadata: { fields: Object.keys(body) },
})
```

Rename the request parameter to match what the file already uses (`req`/`request`). Use the existing variable name that holds the newly-created row (`created`, `row`, `inserted`, etc.) and the existing variable that holds the parsed body.

- [ ] **Step 2: Add a test asserting the audit row is written**

Append to `src/app/api/obligations/__tests__/route.test.ts`:

```ts
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('audit: POST /api/obligations', () => {
  it('writes an obligation.created event', async () => {
    await dbReady
    await db.delete(auditLog)
    const body = { title: 'Test obligation', category: 'tax', frequency: 'annual', nextDueDate: '2026-12-31', owner: 'Internal' }
    const req = new Request('http://localhost/api/obligations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const { POST } = await import('../route')
    const res = await POST(req as any)
    expect([200, 201]).toContain(res.status)
    const rows = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.created'))
    expect(rows).toHaveLength(1)
    expect(rows[0].summary).toContain('Test obligation')
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npx vitest src/app/api/obligations/__tests__/route.test.ts --run`
Expected: All passing, including the new audit test.

- [ ] **Step 4: Commit**

Stage `src/app/api/obligations/route.ts` and `src/app/api/obligations/__tests__/route.test.ts`, commit with message `feat(audit): log obligation.created on POST /api/obligations`.

---

## Task 7: Wire up `PUT /api/obligations/[id]` (update)

**Files:**
- Modify: `src/app/api/obligations/[id]/route.ts`

- [ ] **Step 1: Replace the manual update with auditedUpdate**

Add imports at the top of `src/app/api/obligations/[id]/route.ts`:

```ts
import { getActor } from '@/lib/actor'
import { auditedUpdate } from '@/lib/audit-helpers'
```

In the PUT handler, preserve any existing validation, then replace the manual `db.update(obligations).set(...).where(eq(obligations.id, id))` block with:

```ts
const actor = await getActor(request)
const updated = await auditedUpdate(id, body, actor)
if (!updated) {
  return Response.json({ error: 'Not found' }, { status: 404 })
}
return Response.json(updated)
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Add a test asserting an `obligation.updated` event with a diff**

Append to `src/app/api/obligations/__tests__/route.test.ts`:

```ts
describe('audit: PUT /api/obligations/[id]', () => {
  it('writes obligation.updated with a diff', async () => {
    await dbReady
    const { obligations } = await import('@/db/schema')
    await db.delete(auditLog)
    const id = 'test-upd-1'
    await db.insert(obligations).values({
      id, title: 'Orig', category: 'tax', frequency: 'annual',
      nextDueDate: '2026-12-31', owner: 'Internal',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as any)
    const req = new Request(`http://localhost/api/obligations/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ owner: 'Anderson & Co' }),
    })
    const { PUT } = await import('../[id]/route')
    const res = await PUT(req as any, { params: { id } })
    expect(res.status).toBe(200)
    const rows = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.updated'))
    expect(rows).toHaveLength(1)
    const diff = JSON.parse(rows[0].diff!)
    expect(diff.owner).toEqual(['Internal', 'Anderson & Co'])
  })
})
```

- [ ] **Step 4: Run the test**

Run: `npx vitest src/app/api/obligations/__tests__/route.test.ts --run`
Expected: All passing.

- [ ] **Step 5: Commit**

Stage both the route file and the test file, commit with message `feat(audit): log obligation.updated via auditedUpdate`.

---

## Task 8: Wire up `DELETE /api/obligations/[id]`

**Files:**
- Modify: `src/app/api/obligations/[id]/route.ts`

- [ ] **Step 1: Add the audit call to the DELETE handler**

In the DELETE handler, replace the body with:

```ts
const actor = await getActor(request)
const existing = (await db.select().from(obligations).where(eq(obligations.id, id)))[0]
if (!existing) {
  return Response.json({ error: 'Not found' }, { status: 404 })
}

await db.delete(obligations).where(eq(obligations.id, id))

await logEvent({
  type: 'obligation.deleted',
  actor,
  entityType: 'obligation',
  entityId: id,
  summary: `Deleted "${existing.title}"`,
  metadata: { snapshot: existing },
})
return Response.json({ ok: true })
```

Make sure `logEvent` is imported at the top: `import { logEvent } from '@/lib/audit'`.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

Stage `src/app/api/obligations/[id]/route.ts`, commit with message `feat(audit): log obligation.deleted on DELETE with snapshot`.

---

## Task 9: Wire up completions, bulk, templates, alerts

Five small edits in the same pattern — one `getActor` call at the top, one `logEvent` call after the successful mutation.

**Files:**
- Modify: `src/app/api/obligations/[id]/complete/route.ts`
- Modify: `src/app/api/obligations/bulk/route.ts`
- Modify: `src/app/api/templates/route.ts`
- Modify: `src/app/api/alerts/route.ts`
- Modify: `src/app/api/cron/check-alerts/route.ts`

Each file needs the two imports at the top:

```ts
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'
```

- [ ] **Step 1: `POST /api/obligations/[id]/complete`**

After the existing completion insert and obligation update, add:

```ts
const actor = await getActor(request)
await logEvent({
  type: 'obligation.completed',
  actor,
  entityType: 'obligation',
  entityId: id,
  summary: `Marked "${existing.title}" complete`,
  metadata: {
    completionId: completion.id,
    evidenceCount: Array.isArray(evidenceUrls) ? evidenceUrls.length : 0,
    nextDueDate: updated?.nextDueDate ?? null,
  },
})
```

Use the field names already present in the file for `existing`, `completion`, `evidenceUrls`, and `updated`. If the file uses different names (e.g. `obligation` instead of `existing`), adapt the snippet.

- [ ] **Step 2: `POST /api/obligations/bulk`**

After the bulk operation succeeds and you know the `action` and `obligationIds`:

```ts
const actor = await getActor(request)
await logEvent({
  type: 'obligation.bulk_updated',
  actor,
  entityType: 'obligation',
  entityId: null,
  summary: `Bulk ${action} on ${obligationIds.length} obligations`,
  metadata: { action, obligationIds, count: obligationIds.length },
})
```

- [ ] **Step 3: `POST /api/templates` (apply)**

After the template apply path creates N new obligations:

```ts
const actor = await getActor(request)
await logEvent({
  type: 'template.applied',
  actor,
  entityType: 'template',
  entityId: templateId,
  summary: `Applied template ${templateId} (${createdIds.length} obligations)`,
  metadata: { templateId, createdIds, count: createdIds.length },
})
```

Use whatever variable holds the created IDs in the existing code. If the route returns the created rows, map `.id`.

- [ ] **Step 4: `POST /api/alerts`**

Inside the send loop, after each successful mail send:

```ts
// hoist once at top of handler:
const actor = await getActor(request)

// after each successful send:
await logEvent({
  type: 'alert.sent',
  actor,
  entityType: 'alert',
  entityId: obligation.id,
  summary: `Sent alert for "${obligation.title}" to ${recipient}`,
  metadata: { obligationId: obligation.id, recipient, channel: 'email' },
})
```

- [ ] **Step 5: `GET|POST /api/cron/check-alerts`**

Same pattern as step 4. `getActor` will return `{ email: 'cron', source: 'cron' }` because the cron invocation includes the `Authorization: Bearer ${CRON_SECRET}` header.

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

Stage all five modified route files, commit with message `feat(audit): log completed/bulk/template/alert events`.

---

## Task 10: `GET /api/audit` read endpoint

**Files:**
- Create: `src/app/api/audit/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/audit/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { and, desc, eq, lt, SQL } from 'drizzle-orm'
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  await dbReady
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const actor = searchParams.get('actor')
  const entity = searchParams.get('entity')
  const before = searchParams.get('before')
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)

  const clauses: SQL[] = []
  if (type) clauses.push(eq(auditLog.eventType, type))
  if (actor) clauses.push(eq(auditLog.actor, actor))
  if (entity) clauses.push(eq(auditLog.entityId, entity))
  if (before) clauses.push(lt(auditLog.ts, before))

  const rows = await db
    .select()
    .from(auditLog)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(auditLog.ts))
    .limit(limit)

  const parsed = rows.map(r => ({
    ...r,
    diff: r.diff ? JSON.parse(r.diff) : null,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
  }))

  const nextCursor = rows.length === limit ? rows[rows.length - 1].ts : null

  return Response.json({ events: parsed, nextCursor })
}
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds and `/api/audit` appears as `ƒ` in the route table.

- [ ] **Step 3: Commit**

Stage `src/app/api/audit/route.ts`, commit with message `feat(audit): add GET /api/audit list endpoint`.

---

## Task 11: `/activity` page (global feed)

**Files:**
- Create: `src/app/activity/page.tsx`
- Modify: sidebar component (grep for `Overview` and `Templates` to locate; likely `src/app/layout.tsx` or a dedicated sidebar component under `src/components/`)

- [ ] **Step 1: Implement the page**

Create `src/app/activity/page.tsx`:

```tsx
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { and, desc, eq, lt, SQL } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SearchParams = { type?: string; actor?: string; entity?: string; before?: string }

async function fetchEvents(params: SearchParams) {
  await dbReady
  const clauses: SQL[] = []
  if (params.type) clauses.push(eq(auditLog.eventType, params.type))
  if (params.actor) clauses.push(eq(auditLog.actor, params.actor))
  if (params.entity) clauses.push(eq(auditLog.entityId, params.entity))
  if (params.before) clauses.push(lt(auditLog.ts, params.before))
  return db
    .select()
    .from(auditLog)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(auditLog.ts))
    .limit(50)
}

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await fetchEvents(searchParams)

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Activity</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">Audit log — most recent first</p>
        </div>
        <div className="text-xs font-mono text-slate-500">{rows.length} events</div>
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-slate-500 border border-[#1e2d47] bg-[#0f1629] p-6 text-center">
          No activity yet. History begins when events are recorded.
        </div>
      ) : (
        <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d47] text-slate-500">
                <th className="text-left px-3 py-2 font-medium font-mono">When</th>
                <th className="text-left px-3 py-2 font-medium">Actor</th>
                <th className="text-left px-3 py-2 font-medium">Event</th>
                <th className="text-left px-3 py-2 font-medium">Summary</th>
                <th className="text-right px-3 py-2 font-medium font-mono">Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-b border-[#1e2d47]/50 ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'}`}>
                  <td className="px-3 py-2 font-mono text-slate-500" title={r.ts}>
                    {formatDistanceToNow(new Date(r.ts), { addSuffix: true })}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{r.actor}</td>
                  <td className="px-3 py-2 font-mono text-amber-400">{r.eventType}</td>
                  <td className="px-3 py-2 text-slate-400">{r.summary}</td>
                  <td className="px-3 py-2 text-right">
                    {r.entityType === 'obligation' && r.entityId ? (
                      <Link href={`/obligations?id=${r.entityId}`} className="text-amber-400 hover:underline font-mono">
                        open →
                      </Link>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add "Activity" to the sidebar nav**

Find the sidebar component that renders `Overview / Dashboard / Calendar / Obligations / Templates / Categories`. Add an `Activity` entry between `Templates` and `Categories`, linking to `/activity`. Use an icon from `lucide-react` that matches the dense style (e.g. `History`).

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds and `/activity` appears as `ƒ` in the route table.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, visit `http://localhost:3000/activity`, create a new obligation from the Obligations page, return to `/activity`, verify the `obligation.created` event shows up.

- [ ] **Step 5: Commit**

Stage `src/app/activity/page.tsx` and the sidebar file, commit with message `feat(audit): add /activity page with global event feed`.

---

## Task 12: Per-obligation history panel

**Files:**
- Create: `src/components/ObligationHistory.tsx`
- Modify: `src/app/obligations/page.tsx`

- [ ] **Step 1: Build the client component**

Create `src/components/ObligationHistory.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

type AuditEvent = {
  id: string
  ts: string
  eventType: string
  actor: string
  summary: string
  diff: Record<string, [unknown, unknown]> | null
}

export function ObligationHistory({ obligationId }: { obligationId: string }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded || events !== null) return
    fetch(`/api/audit?entity=${encodeURIComponent(obligationId)}&limit=20`)
      .then(r => r.json())
      .then(data => setEvents(data.events))
      .catch(() => setEvents([]))
  }, [expanded, events, obligationId])

  const count = events?.length ?? null

  return (
    <div className="border-t border-[#1e2d47] mt-4 pt-3">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="text-xs uppercase tracking-wider text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-2"
      >
        History {count !== null ? `(${count} events)` : ''} {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {events === null ? (
            <div className="text-xs text-slate-500 font-mono">loading…</div>
          ) : events.length === 0 ? (
            <div className="text-xs text-slate-500 font-mono">no events</div>
          ) : (
            events.map(ev => (
              <div key={ev.id} className="text-xs border-l border-[#1e2d47] pl-3 py-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-slate-500" title={ev.ts}>
                    {formatDistanceToNow(new Date(ev.ts), { addSuffix: true })}
                  </span>
                  <span className="text-slate-300">{ev.actor}</span>
                  <span className="font-mono text-amber-400">{ev.eventType}</span>
                </div>
                <div className="text-slate-400 mt-0.5">{ev.summary}</div>
                {ev.diff && (
                  <div className="text-slate-500 font-mono mt-0.5">
                    {Object.entries(ev.diff).map(([k, [b, a]]) => (
                      <div key={k}>
                        {k}: <span className="text-slate-400">{String(b)}</span> → <span className="text-slate-200">{String(a)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Mount it on the obligation detail panel**

Open `src/app/obligations/page.tsx`. Locate where the selected obligation's detail panel renders its completion history. Below that block, add:

```tsx
import { ObligationHistory } from '@/components/ObligationHistory'

// inside the detail panel, below the completion list:
<ObligationHistory obligationId={selected.id} />
```

Replace `selected` with whatever variable holds the currently-selected obligation in the existing code.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open an obligation, update its owner, close and reopen the panel, click `History`, verify the `obligation.updated` event appears with the diff.

- [ ] **Step 5: Commit**

Stage `src/components/ObligationHistory.tsx` and `src/app/obligations/page.tsx`, commit with message `feat(audit): add ObligationHistory panel to detail view`.

---

## Task 13: Deploy and verify end-to-end

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: All new tests green. Pre-existing failing API tests (per CLAUDE.md) remain as they were at baseline.

- [ ] **Step 2: Build and push**

Run: `npm run build`
Expected: Build succeeds.

Push to origin: `git push`

- [ ] **Step 3: Wait for Vercel prod deploy**

Run: `vercel ls compliance-tracker | head -5`
Expected: A new `● Ready` production deployment at the top.

- [ ] **Step 4: Smoke test the live site**

- Open the live URL, go to `/activity`.
- Verify the empty state renders on a fresh in-memory DB.
- From `/obligations`, update an obligation.
- Reload `/activity`, verify the `obligation.updated` event appears with the actor set to your SSO email.
- Open the obligation detail panel, expand History, verify the same event is visible with the diff.

- [ ] **Step 5: Final commit (if any follow-up fixes)**

Commit any follow-up fixes with a `chore(audit): follow-up fixes from live smoke test` message and push.

---

## Self-review

**Spec coverage:**
- Data model → Task 1 ✓
- Helpers (diff/actor/audit/audit-helpers) → Tasks 2-5 ✓
- Seven call sites → Tasks 6-9 ✓
- Read API → Task 10 ✓
- Global feed → Task 11 ✓
- Per-obligation history → Task 12 ✓
- Testing → colocated tests in Tasks 2-7 ✓
- Migration → Task 1 ✓
- Out-of-scope items (hash chaining, retention, backfill) → explicitly not attempted ✓

**Placeholder scan:** No TBD/TODO. No "similar to Task N". Every code step shows code. Every test step shows test. File paths are exact.

**Type consistency:**
- `Actor` → same shape in actor.ts (`email`, `source`) and audit.ts (via import) ✓
- `AuditEventType` → defined in audit.ts, used as string literals in call sites matching the union ✓
- `logEvent` signature stable across all 7 call sites ✓
- `auditedUpdate` used only in Task 7 ✓
- `TRACKED_OBLIGATION_FIELDS` defined in audit-helpers.ts, used only there ✓

**Judgment calls left to the implementer:**
- The sidebar nav file wasn't located precisely — Task 11 step 2 says to grep for `Overview` to find it. Current candidates are `src/app/layout.tsx` or a dedicated component under `src/components/`.
- The exact variable names in the existing bulk, templates, alerts, and complete handlers (e.g. `action`, `obligationIds`, `createdIds`, `recipient`) depend on what those files already use. Tasks 8 and 9 explicitly say to reuse the existing names rather than inventing new ones.
