# Agent API Access + Compliance Tracker Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authorized AI agents to authenticate to the compliance-tracker REST API via bearer tokens scoped to service-account agents (separate from human users), and ship a Claude skill that teaches agents how to use the API.

**Architecture:** New `agents` table storing hashed bearer tokens. New `src/lib/agent-auth.ts` verifier. Middleware checks `Authorization: Bearer <token>` header **before** NextAuth session — valid tokens attach an agent actor to the request; invalid tokens return 401 immediately (no session fallback). Admin UI at `/settings/agents`. A `docs/skills/compliance-tracker/SKILL.md` file teaches Claude Code agents the API.

**Tech Stack:** Next.js 14 App Router, TypeScript, Drizzle ORM, Turso (libsql), Vitest, Node `crypto` module (no new npm deps), Tailwind.

**Reference spec:** [docs/superpowers/specs/2026-04-10-agent-api-access-design.md](../specs/2026-04-10-agent-api-access-design.md)

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `src/db/schema.ts` | Modify | Add `agents` table |
| `src/db/index.ts` | Modify | Add `CREATE TABLE agents` to in-memory init |
| `src/lib/token-utils.ts` | Create | `generateToken()`, `hashToken()` |
| `src/lib/token-utils.test.ts` | Create | Unit tests |
| `src/lib/agent-auth.ts` | Create | `verifyAgentToken()` function, `AgentActor` type |
| `src/lib/agent-auth.test.ts` | Create | Unit tests |
| `src/lib/actor.ts` | Modify | Add `'agent'` to source union, check token before session |
| `src/lib/actor.test.ts` | Modify | Add agent auth branch tests |
| `src/lib/audit.ts` | Modify | Add `agent.*` event types and `'agent'` entity type |
| `src/middleware.ts` | Modify | Token verification before session check |
| `src/app/api/agents/route.ts` | Create | GET list + POST create |
| `src/app/api/agents/[id]/route.ts` | Create | PUT regenerate + DELETE revoke |
| `src/app/settings/agents/page.tsx` | Create | Admin UI for agents |
| `src/app/settings/users/page.tsx` | Modify | Add tab bar (Users \| Agents) |
| `src/components/settings/settings-tabs.tsx` | Create | Shared tab bar component |
| `docs/skills/compliance-tracker/SKILL.md` | Create | The Claude skill file |
| `README.md` | Modify | Add "AI Agent Access" section |

---

## Task 1: Add `agents` table to schema

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Append the `agents` table to schema.ts**

Append to `src/db/schema.ts` after the `users` table:

```ts
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  role: text('role').notNull(),
  tokenHash: text('token_hash').notNull(),
  tokenPrefix: text('token_prefix').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
})
```

- [ ] **Step 2: Add `CREATE TABLE agents` to in-memory init**

In `src/db/index.ts` inside the `initInMemory()` function, after the `CREATE TABLE users` block, add:

```ts
  await client.execute(`CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    role TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_used_at TEXT,
    revoked_at TEXT
  )`)
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_agents_token_hash ON agents(token_hash)`)
```

- [ ] **Step 3: Create the table on Turso**

Run:
```bash
turso db shell compliance-tracker "CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, role TEXT NOT NULL, token_hash TEXT NOT NULL, token_prefix TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT);"
```

Then create the index:
```bash
turso db shell compliance-tracker "CREATE INDEX IF NOT EXISTS idx_agents_token_hash ON agents(token_hash);"
```

Verify: `turso db shell compliance-tracker "SELECT name FROM sqlite_master WHERE type='table' AND name='agents';"`
Expected output: `agents`

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: Build succeeds, no type errors.

- [ ] **Step 5: Commit**

Stage `src/db/schema.ts` and `src/db/index.ts`. Commit with message `feat(agents): add agents table`.

---

## Task 2: Token generation and hashing helpers

**Files:**
- Create: `src/lib/token-utils.ts`
- Create: `src/lib/token-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/token-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateToken, hashToken, TOKEN_PREFIX } from './token-utils'

describe('generateToken', () => {
  it('starts with the ct_live_ prefix', () => {
    const token = generateToken()
    expect(token.startsWith(TOKEN_PREFIX)).toBe(true)
  })

  it('produces tokens of consistent length', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a.length).toBe(b.length)
  })

  it('is 52 characters long total', () => {
    const token = generateToken()
    expect(token.length).toBe(52)
  })

  it('produces different values on each call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()))
    expect(tokens.size).toBe(100)
  })

  it('uses only base62 characters after the prefix', () => {
    const token = generateToken()
    const body = token.slice(TOKEN_PREFIX.length)
    expect(body).toMatch(/^[0-9A-Za-z]+$/)
  })
})

describe('hashToken', () => {
  it('is deterministic', () => {
    const h1 = hashToken('ct_live_abcdef')
    const h2 = hashToken('ct_live_abcdef')
    expect(h1).toBe(h2)
  })

  it('produces different hashes for different inputs', () => {
    expect(hashToken('ct_live_a')).not.toBe(hashToken('ct_live_b'))
  })

  it('returns a hex string of 64 chars (sha256)', () => {
    const h = hashToken('ct_live_test')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest src/lib/token-utils.test.ts --run`
Expected: FAIL (cannot import token-utils).

- [ ] **Step 3: Implement token-utils.ts**

Create `src/lib/token-utils.ts`:

```ts
import { randomBytes, createHash } from 'crypto'

export const TOKEN_PREFIX = 'ct_live_'
const BODY_LENGTH = 44
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function generateToken(): string {
  const bytes = randomBytes(BODY_LENGTH)
  let body = ''
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += BASE62[bytes[i] % BASE62.length]
  }
  return TOKEN_PREFIX + body
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest src/lib/token-utils.test.ts --run`
Expected: 8 passing.

- [ ] **Step 5: Commit**

Stage `src/lib/token-utils.ts` and `src/lib/token-utils.test.ts`. Commit with message `feat(agents): add token generation and hashing helpers`.

---

## Task 3: Add agent event types to audit log

**Files:**
- Modify: `src/lib/audit.ts`

- [ ] **Step 1: Extend the event type unions**

In `src/lib/audit.ts`, replace the `AuditEventType` and `AuditEntityType` declarations with:

```ts
export type AuditEventType =
  | 'obligation.created'
  | 'obligation.updated'
  | 'obligation.deleted'
  | 'obligation.completed'
  | 'obligation.bulk_updated'
  | 'template.applied'
  | 'alert.sent'
  | 'user.role_changed'
  | 'agent.created'
  | 'agent.regenerated'
  | 'agent.revoked'

export type AuditEntityType = 'obligation' | 'template' | 'alert' | 'user' | 'agent'
```

- [ ] **Step 2: Extend the Actor source type**

In `src/lib/actor.ts`, replace the `Actor` type with:

```ts
export type Actor = {
  email: string
  source: 'sso' | 'cron' | 'dev' | 'system' | 'agent'
}
```

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

Stage `src/lib/audit.ts` and `src/lib/actor.ts`. Commit with message `feat(agents): add agent event types and actor source`.

---

## Task 4: `verifyAgentToken` helper

**Files:**
- Create: `src/lib/agent-auth.ts`
- Create: `src/lib/agent-auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/agent-auth.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { agents } from '@/db/schema'
import { verifyAgentToken } from './agent-auth'
import { generateToken, hashToken } from './token-utils'
import { ulid } from 'ulid'

async function seedAgent(overrides: Partial<{
  role: string
  token: string
  expiresAt: string
  revokedAt: string | null
}> = {}) {
  const token = overrides.token ?? generateToken()
  const now = new Date().toISOString()
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 86_400_000).toISOString()
  const id = ulid()
  await db.insert(agents).values({
    id,
    name: 'TestAgent',
    description: null,
    role: overrides.role ?? 'editor',
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 15),
    createdBy: 'admin@test',
    createdAt: now,
    expiresAt,
    lastUsedAt: null,
    revokedAt: overrides.revokedAt ?? null,
  })
  return { id, token }
}

describe('verifyAgentToken', () => {
  beforeEach(async () => {
    await dbReady
    await db.delete(agents)
  })

  it('returns null for tokens without the ct_live_ prefix', async () => {
    expect(await verifyAgentToken('bearer_foo')).toBeNull()
  })

  it('returns null for unknown tokens', async () => {
    expect(await verifyAgentToken('ct_live_notreal')).toBeNull()
  })

  it('returns the agent actor for a valid token', async () => {
    const { id, token } = await seedAgent({ role: 'editor' })
    const actor = await verifyAgentToken(token)
    expect(actor).toEqual({
      type: 'agent',
      agentId: id,
      name: 'TestAgent',
      role: 'editor',
    })
  })

  it('returns null for an expired token', async () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString()
    const { token } = await seedAgent({ expiresAt: pastDate })
    expect(await verifyAgentToken(token)).toBeNull()
  })

  it('returns null for a revoked token', async () => {
    const { token } = await seedAgent({ revokedAt: new Date().toISOString() })
    expect(await verifyAgentToken(token)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest src/lib/agent-auth.test.ts --run`
Expected: FAIL (cannot import agent-auth).

- [ ] **Step 3: Implement agent-auth.ts**

Create `src/lib/agent-auth.ts`:

```ts
import { db } from '@/db'
import { agents } from '@/db/schema'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { hashToken, TOKEN_PREFIX } from './token-utils'

export type AgentActor = {
  type: 'agent'
  agentId: string
  name: string
  role: 'viewer' | 'editor' | 'admin'
}

export async function verifyAgentToken(token: string): Promise<AgentActor | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null

  const hash = hashToken(token)
  const nowIso = new Date().toISOString()

  const rows = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.tokenHash, hash),
        isNull(agents.revokedAt),
        gt(agents.expiresAt, nowIso),
      ),
    )
    .limit(1)

  if (rows.length === 0) return null
  const agent = rows[0]

  // Fire-and-forget last_used_at update; don't block the request on it.
  db.update(agents)
    .set({ lastUsedAt: nowIso })
    .where(eq(agents.id, agent.id))
    .catch(err => console.error('[agent-auth] failed to update lastUsedAt', err))

  return {
    type: 'agent',
    agentId: agent.id,
    name: agent.name,
    role: agent.role as 'viewer' | 'editor' | 'admin',
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest src/lib/agent-auth.test.ts --run`
Expected: 5 passing.

- [ ] **Step 5: Commit**

Stage `src/lib/agent-auth.ts` and `src/lib/agent-auth.test.ts`. Commit with message `feat(agents): add verifyAgentToken helper`.

---

## Task 5: Wire agent tokens into `getActor()`

**Files:**
- Modify: `src/lib/actor.ts`
- Modify: `src/lib/actor.test.ts`

- [ ] **Step 1: Update getActor to check agent tokens first**

Replace the contents of `src/lib/actor.ts` with:

```ts
import { auth } from './auth'
import { verifyAgentToken } from './agent-auth'

export type Actor = {
  email: string
  source: 'sso' | 'cron' | 'dev' | 'system' | 'agent'
}

export async function getActor(req?: Request): Promise<Actor> {
  // 1. Agent bearer token (checked first so agents never accidentally fall through to session)
  if (req) {
    const authHeader = req.headers.get('authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length)
      const agent = await verifyAgentToken(token)
      if (agent) {
        return { email: `agent:${agent.name}`, source: 'agent' }
      }
    }
  }

  // 2. NextAuth session
  const session = await auth()
  if (session?.user?.email) {
    return { email: session.user.email, source: 'sso' }
  }

  // 3. Cron secret
  if (req) {
    const authHeader = req.headers.get('authorization') ?? ''
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return { email: 'cron', source: 'cron' }
    }
  }

  // 4. Dev fallback
  if (process.env.NODE_ENV !== 'production') {
    return { email: process.env.DEV_ACTOR ?? 'dev@local', source: 'dev' }
  }

  return { email: 'system', source: 'system' }
}
```

- [ ] **Step 2: Add test for agent actor resolution**

Append to `src/lib/actor.test.ts` after the existing tests:

```ts
vi.mock('./agent-auth', () => ({
  verifyAgentToken: vi.fn(),
}))

describe('getActor agent path', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns agent actor when bearer token validates', async () => {
    const { verifyAgentToken } = await import('./agent-auth')
    vi.mocked(verifyAgentToken).mockResolvedValueOnce({
      type: 'agent',
      agentId: 'ag_1',
      name: 'TestBot',
      role: 'editor',
    })
    const req = mkReq({ auth: 'Bearer ct_live_abc' })
    const actor = await getActor(req)
    expect(actor).toEqual({ email: 'agent:TestBot', source: 'agent' })
  })

  it('falls through to session when bearer token is invalid', async () => {
    const { verifyAgentToken } = await import('./agent-auth')
    vi.mocked(verifyAgentToken).mockResolvedValueOnce(null)
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: '1', email: 'alice@acme.com', role: 'admin' },
      expires: '',
    } as any)
    const req = mkReq({ auth: 'Bearer ct_live_wrong' })
    const actor = await getActor(req)
    expect(actor).toEqual({ email: 'alice@acme.com', source: 'sso' })
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest src/lib/actor.test.ts --run`
Expected: All previously-passing tests still pass, plus 2 new tests passing.

- [ ] **Step 4: Commit**

Stage `src/lib/actor.ts` and `src/lib/actor.test.ts`. Commit with message `feat(agents): resolve agent tokens in getActor`.

---

## Task 6: Middleware-level token check (security-critical)

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add bearer token pre-check to middleware**

Replace the contents of `src/middleware.ts` with:

```ts
import { auth } from '@/lib/auth'
import { verifyAgentToken } from '@/lib/agent-auth'
import { NextResponse } from 'next/server'

export default auth(async (req) => {
  const { pathname } = req.nextUrl
  const isAuthRoute = pathname.startsWith('/api/auth') || pathname.startsWith('/auth/')
  const isCronRoute = pathname.startsWith('/api/cron')

  if (isAuthRoute || isCronRoute) return NextResponse.next()

  // Agent bearer token path (checked before session)
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const agent = await verifyAgentToken(token)
    if (agent) {
      // Valid agent token — enforce viewer mutation block
      if (agent.role === 'viewer' && pathname.startsWith('/api/') && req.method !== 'GET') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.next()
    }
    // Header present but invalid — reject immediately, do NOT fall through to session
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // NextAuth session path
  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const signInUrl = new URL('/api/auth/signin', req.nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.href)
    return NextResponse.redirect(signInUrl)
  }

  // Viewer-only: restrict to overview and dashboard pages
  const role = req.auth.user?.role
  const editorOnlyPages = ['/calendar', '/obligations', '/templates', '/activity', '/categories', '/settings']
  if (role === 'viewer' && editorOnlyPages.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }

  // Block viewer mutations on API routes
  if (role === 'viewer' && pathname.startsWith('/api/') && req.method !== 'GET') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds, middleware size reported in the route table.

- [ ] **Step 3: Run existing tests**

Run: `npx vitest --run`
Expected: All tests still pass. Middleware is not unit-tested directly; it's covered by integration tests at the route level.

- [ ] **Step 4: Commit**

Stage `src/middleware.ts`. Commit with message `feat(agents): verify bearer tokens in middleware before session`.

---

## Task 7: Admin API — GET and POST `/api/agents`

**Files:**
- Create: `src/app/api/agents/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/agents/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { agents } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { ulid } from 'ulid'
import { requireRole } from '@/lib/auth-helpers'
import { generateToken, hashToken } from '@/lib/token-utils'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['viewer', 'editor', 'admin'] as const

export async function GET() {
  const { error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady
    const rows = await db
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        role: agents.role,
        tokenPrefix: agents.tokenPrefix,
        createdBy: agents.createdBy,
        createdAt: agents.createdAt,
        expiresAt: agents.expiresAt,
        lastUsedAt: agents.lastUsedAt,
        revokedAt: agents.revokedAt,
      })
      .from(agents)
      .orderBy(desc(agents.createdAt))

    return NextResponse.json({ agents: rows })
  } catch (err) {
    console.error('Agents list error:', err)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady
    const body = await req.json()
    const { name, description, role, expiresInDays } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
    }

    const days = Number(expiresInDays ?? 365)
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return NextResponse.json({ error: 'expiresInDays must be between 1 and 3650' }, { status: 400 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + days * 86_400_000).toISOString()
    const rawToken = generateToken()
    const id = ulid()

    await db.insert(agents).values({
      id,
      name: name.trim(),
      description: description?.trim() || null,
      role,
      tokenHash: hashToken(rawToken),
      tokenPrefix: rawToken.slice(0, 15),
      createdBy: session!.user.email,
      createdAt: now.toISOString(),
      expiresAt,
      lastUsedAt: null,
      revokedAt: null,
    })

    const actor = await getActor(req)
    await logEvent({
      type: 'agent.created',
      actor,
      entityType: 'agent',
      entityId: id,
      summary: `Created agent "${name}" with role ${role}`,
      metadata: { agentId: id, name, role, expiresAt },
    })

    return NextResponse.json({ id, token: rawToken, expiresAt }, { status: 201 })
  } catch (err) {
    console.error('Create agent error:', err)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds and `/api/agents` appears as `ƒ` in the route table.

- [ ] **Step 3: Commit**

Stage `src/app/api/agents/route.ts`. Commit with message `feat(agents): add GET list and POST create routes`.

---

## Task 8: Admin API — PUT regenerate and DELETE revoke

**Files:**
- Create: `src/app/api/agents/[id]/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/agents/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { agents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'
import { generateToken, hashToken } from '@/lib/token-utils'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady

    const rows = await db.select().from(agents).where(eq(agents.id, params.id))
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const agent = rows[0]
    if (agent.revokedAt) {
      return NextResponse.json({ error: 'Cannot regenerate a revoked agent' }, { status: 400 })
    }

    const rawToken = generateToken()
    const now = new Date().toISOString()

    await db
      .update(agents)
      .set({
        tokenHash: hashToken(rawToken),
        tokenPrefix: rawToken.slice(0, 15),
      })
      .where(eq(agents.id, params.id))

    const actor = await getActor(req)
    await logEvent({
      type: 'agent.regenerated',
      actor,
      entityType: 'agent',
      entityId: params.id,
      summary: `Regenerated token for agent "${agent.name}"`,
      metadata: { agentId: params.id, name: agent.name, regeneratedAt: now },
    })

    return NextResponse.json({ token: rawToken, expiresAt: agent.expiresAt })
  } catch (err) {
    console.error('Regenerate agent error:', err)
    return NextResponse.json({ error: 'Failed to regenerate agent token' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady

    const rows = await db.select().from(agents).where(eq(agents.id, params.id))
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const agent = rows[0]
    if (agent.revokedAt) {
      return NextResponse.json({ success: true, message: 'Agent already revoked' })
    }

    const now = new Date().toISOString()
    await db.update(agents).set({ revokedAt: now }).where(eq(agents.id, params.id))

    const actor = await getActor(req)
    await logEvent({
      type: 'agent.revoked',
      actor,
      entityType: 'agent',
      entityId: params.id,
      summary: `Revoked agent "${agent.name}"`,
      metadata: { agentId: params.id, name: agent.name, revokedAt: now },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Revoke agent error:', err)
    return NextResponse.json({ error: 'Failed to revoke agent' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds and `/api/agents/[id]` appears in the route table.

- [ ] **Step 3: Commit**

Stage `src/app/api/agents/[id]/route.ts`. Commit with message `feat(agents): add PUT regenerate and DELETE revoke routes`.

---

## Task 9: Settings tabs component

**Files:**
- Create: `src/components/settings/settings-tabs.tsx`

- [ ] **Step 1: Create the shared tabs component**

Create `src/components/settings/settings-tabs.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/settings/users', label: 'Users' },
  { href: '/settings/agents', label: 'Agents' },
]

export function SettingsTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-[#1e2d47] mb-6">
      {tabs.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
              active
                ? 'text-amber-400 border-amber-500'
                : 'text-slate-500 border-transparent hover:text-slate-300',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Mount on the existing users page**

In `src/app/settings/users/page.tsx`, add at the top of the imports:

```tsx
import { SettingsTabs } from '@/components/settings/settings-tabs'
```

Then inside the returned JSX, insert `<SettingsTabs />` immediately after the page header's closing `</div>` (the one that wraps the title+description block). It should sit between the header and the table.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

Stage `src/components/settings/settings-tabs.tsx` and `src/app/settings/users/page.tsx`. Commit with message `feat(agents): add settings tabs component`.

---

## Task 10: Agent admin page

**Files:**
- Create: `src/app/settings/agents/page.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/settings/agents/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { Trash2, RotateCw, Copy, Plus, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Agent = {
  id: string
  name: string
  description: string | null
  role: string
  tokenPrefix: string
  createdBy: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

const ROLES = ['viewer', 'editor', 'admin'] as const
const EXPIRY_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '180 days', value: 180 },
  { label: '365 days', value: 365 },
]

const roleBadgeColors: Record<string, string> = {
  admin: 'text-red-400 bg-red-950/50 border-red-800/50',
  editor: 'text-amber-400 bg-amber-950/50 border-amber-800/50',
  viewer: 'text-slate-400 bg-slate-800/50 border-slate-700/50',
}

export default function AgentsSettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', description: '', role: 'viewer' as string, expiresInDays: 365 })
  const [createdToken, setCreatedToken] = useState<{ token: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (session?.user?.role !== 'admin') {
      router.push('/')
      return
    }
    fetch('/api/agents')
      .then(r => { if (!r.ok) throw new Error('Failed to fetch'); return r.json() })
      .then(d => setAgents(d.agents))
      .catch(() => toast.error('Failed to load agents'))
      .finally(() => setLoading(false))
  }, [session, router])

  const handleCreate = async () => {
    if (!newAgent.name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newAgent),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create')
      }
      const data = await res.json()
      setCreatedToken({ token: data.token, expiresAt: data.expiresAt })
      // Refresh list
      const listRes = await fetch('/api/agents')
      const listData = await listRes.json()
      setAgents(listData.agents)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create agent')
    }
  }

  const handleRegenerate = async (id: string) => {
    if (!confirm('Regenerating invalidates the existing token immediately. Continue?')) return
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'PUT' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to regenerate')
      }
      const data = await res.json()
      setCreatedToken({ token: data.token, expiresAt: data.expiresAt })
      const listRes = await fetch('/api/agents')
      const listData = await listRes.json()
      setAgents(listData.agents)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate')
    }
  }

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Permanently revoke "${name}"? Revoked agents cannot be restored.`)) return
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Agent revoked')
      const listRes = await fetch('/api/agents')
      const listData = await listRes.json()
      setAgents(listData.agents)
    } catch {
      toast.error('Failed to revoke agent')
    }
  }

  const copyToken = () => {
    if (!createdToken) return
    navigator.clipboard.writeText(createdToken.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const closeTokenModal = () => {
    setCreatedToken(null)
    setShowCreate(false)
    setNewAgent({ name: '', description: '', role: 'viewer', expiresInDays: 365 })
  }

  if (session?.user?.role !== 'admin') return null

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Agent Management</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">Service accounts with API tokens</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Agent
        </button>
      </div>

      <SettingsTabs />

      {loading ? (
        <div className="text-xs text-slate-500 font-mono">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="text-xs text-slate-500 border border-[#1e2d47] bg-[#0f1629] p-6 text-center">
          No agents yet. Create one to give an AI agent access to the API.
        </div>
      ) : (
        <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d47] text-slate-500">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-left px-3 py-2 font-medium">Token</th>
                <th className="text-left px-3 py-2 font-medium">Expires</th>
                <th className="text-left px-3 py-2 font-medium">Last used</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => {
                const revoked = !!agent.revokedAt
                const expired = new Date(agent.expiresAt) < new Date()
                return (
                  <tr key={agent.id} className={`border-b border-[#1e2d47]/50 ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'} ${revoked ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2">
                      <div className={revoked ? 'line-through text-slate-500' : 'text-slate-300'}>{agent.name}</div>
                      {agent.description && <div className="text-[10px] text-slate-600 mt-0.5">{agent.description}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded ${roleBadgeColors[agent.role] ?? roleBadgeColors.viewer}`}>
                        {agent.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">{agent.tokenPrefix}...</td>
                    <td className={`px-3 py-2 font-mono ${expired ? 'text-red-400' : 'text-slate-500'}`}>
                      {formatDistanceToNow(new Date(agent.expiresAt), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">
                      {agent.lastUsedAt ? formatDistanceToNow(new Date(agent.lastUsedAt), { addSuffix: true }) : 'never'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!revoked && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRegenerate(agent.id)}
                            className="text-slate-500 hover:text-amber-400 transition-colors"
                            title="Regenerate token"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRevoke(agent.id, agent.name)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                            title="Revoke agent"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && !createdToken && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1629] border border-[#1e2d47] max-w-md w-full p-5">
            <h2 className="text-sm font-semibold text-slate-100 mb-4">Create Agent</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Name</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="e.g. SlackBot"
                  className="w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs px-3 py-2 rounded focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Description (optional)</label>
                <input
                  type="text"
                  value={newAgent.description}
                  onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="What does this agent do?"
                  className="w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs px-3 py-2 rounded focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Role</label>
                <select
                  value={newAgent.role}
                  onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs px-3 py-2 rounded focus:border-amber-500/50 focus:outline-none"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Expires in</label>
                <select
                  value={newAgent.expiresInDays}
                  onChange={e => setNewAgent({ ...newAgent, expiresInDays: Number(e.target.value) })}
                  className="w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs px-3 py-2 rounded focus:border-amber-500/50 focus:outline-none"
                >
                  {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={closeTokenModal}
                className="flex-1 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors"
              >
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token display modal */}
      {createdToken && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1629] border border-[#1e2d47] max-w-lg w-full p-5">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">Agent Token</h2>
            <p className="text-xs text-amber-400 mb-4">
              Copy this token now. It will never be shown again.
            </p>
            <div className="bg-[#0a0e1a] border border-[#1e2d47] rounded p-3 font-mono text-[11px] text-slate-200 break-all mb-3">
              {createdToken.token}
            </div>
            <button
              onClick={copyToken}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors mb-3"
            >
              {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Token</>}
            </button>
            <button
              onClick={closeTokenModal}
              className="w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds and `/settings/agents` appears as a static page in the route table.

- [ ] **Step 3: Commit**

Stage `src/app/settings/agents/page.tsx`. Commit with message `feat(agents): add admin page for managing agents`.

---

## Task 11: Compliance Tracker skill file

**Files:**
- Create: `docs/skills/compliance-tracker/SKILL.md`
- Modify: `README.md`

- [ ] **Step 1: Create the skill file**

Create `docs/skills/compliance-tracker/SKILL.md`:

````markdown
---
name: compliance-tracker
description: Use this skill when the user asks to read, list, create, update, complete, or delete compliance obligations in the company's compliance tracker, or to query audit history, categories, templates, or analytics. Requires a COMPLIANCE_TRACKER_TOKEN environment variable to be set.
---

# Compliance Tracker

The compliance-tracker app at https://compliance-tracker-alturki.vercel.app
tracks compliance obligations for the company. This skill lets you read and
manage obligations via the REST API.

## Authentication

All requests require a bearer token in the Authorization header.
Read the token from the COMPLIANCE_TRACKER_TOKEN environment variable.
If the variable is not set, tell the user: "I need a compliance-tracker
API token. An admin can create one at Settings → Agents."

Example:

```bash
curl -H "Authorization: Bearer $COMPLIANCE_TRACKER_TOKEN" \
  https://compliance-tracker-alturki.vercel.app/api/obligations
```

## What you can do

Your capabilities depend on the agent role assigned to your token:
- **viewer**: read-only access to obligations, categories, analytics, audit log
- **editor**: everything viewer can, plus create, update, complete, delete
- **admin**: everything editor can, plus manage users and agents

If an API call returns 403, your role does not permit that action.
Tell the user which action was denied and suggest asking an admin for
a higher-privileged token.

## Core workflows

### List obligations

```
GET /api/obligations?category=tax&status=overdue
```

Returns: array of obligations with id, title, category, frequency,
nextDueDate, owner, riskLevel, status.

### Get a single obligation

```
GET /api/obligations/{id}
```

Returns: full obligation plus completions[] history.

### Create an obligation (editor)

```
POST /api/obligations
Body: { title, category, frequency, nextDueDate, owner, riskLevel, ... }
```

Returns: `{ id }`

### Update an obligation (editor)

```
PUT /api/obligations/{id}
Body: any subset of the fields above.
```

Returns: `{ success: true }`

### Mark obligation complete (editor)

```
POST /api/obligations/{id}/complete
Body: { completedBy, completedDate, notes?, evidenceUrls? }
```

Returns: `{ id, success: true, evidenceUrls }`. If `autoRecur` is true
on the obligation, its `nextDueDate` automatically advances to the next
period.

### Delete an obligation (editor)

```
DELETE /api/obligations/{id}
```

Returns: `{ success: true }`

### Bulk operations (editor)

```
POST /api/obligations/bulk   — update-owner, update-risk, mark-complete
DELETE /api/obligations      — Body: { ids: [...] } (max 100)
```

### Query the audit log (editor)

```
GET /api/audit?entity={id}&type=obligation.updated&limit=50
```

Returns: `{ events: [...], nextCursor }`

### Analytics (viewer)

```
GET /api/stats        — counts by status, category, risk
GET /api/analytics    — trends, compliance score, risk exposure
```

## Conventions

- **Dates**: always ISO-8601 (YYYY-MM-DD for date-only, full ISO for timestamps)
- **IDs**: ULIDs (26 chars, alphanumeric)
- **Categories**: tax, investor, equity, state, federal, contract, insurance, benefits, governance, vendor
- **Frequencies**: annual, quarterly, monthly, weekly, one-time, event-triggered
- **Risk levels**: critical, high, medium, low
- **Roles** (for users/agents): viewer, editor, admin

## Safety

- **Never call DELETE without confirming with the user first.**
- **Never call bulk operations** (update-all, delete-all) without showing
  the user which obligations will be affected and getting explicit confirmation.
- When completing an obligation, always ask for the `completedBy` field —
  do not invent it. If the user didn't specify, ask them.
- When in doubt, list first (GET) then mutate. Don't assume state.
````

- [ ] **Step 2: Add README section**

In `README.md`, add a section before the final horizontal rule (or at the end if there isn't one):

```markdown
## AI Agent Access

AI agents (Claude Code sessions, automation scripts, bots) can read and
manage obligations via the REST API using bearer tokens.

**Create a token:** Sign in as an admin, go to **Settings → Agents**, click
**New Agent**, pick a role (viewer / editor / admin), and copy the token
that's shown once.

**Use the skill:** Copy `docs/skills/compliance-tracker/SKILL.md` into your
Claude Code project at `.claude/skills/compliance-tracker/SKILL.md` and
export the token as `COMPLIANCE_TRACKER_TOKEN`. Ask Claude to do
compliance-related work and it will use the API.

**Raw API:** See `docs/skills/compliance-tracker/SKILL.md` for the full
endpoint reference.
```

- [ ] **Step 3: Commit**

Stage `docs/skills/compliance-tracker/SKILL.md` and `README.md`. Commit with message `docs(agents): add compliance-tracker skill and README section`.

---

## Task 12: Deploy and verify end-to-end

- [ ] **Step 1: Run full test suite**

Run: `npx vitest --run`
Expected: All tests pass (new agent tests added, no existing tests broken).

- [ ] **Step 2: Run clean build**

Run: `rm -rf .next && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Push and deploy**

```bash
git push
vercel --prod --force --yes
```

Expected: Deployment reports READY.

- [ ] **Step 4: Smoke test on production**

Sign in as admin in the browser. Go to `/settings/agents`. Create a test
agent with role `viewer`. Copy the token. Then run:

```bash
TOKEN=<paste-token>
BASE=https://compliance-tracker-alturki.vercel.app

# Should return 200 with obligations list
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/obligations" | head -c 200

# Should return 403 (viewer cannot POST)
curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"title":"test","category":"tax","frequency":"annual","nextDueDate":"2026-12-31","owner":"Test","riskLevel":"low"}' \
  "$BASE/api/obligations"

# Should return 401 (invalid token)
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ct_live_invalid" "$BASE/api/obligations"
```

Expected output:
- First curl: JSON array of obligations (`[{"id":"..."...`)
- Second curl: `403`
- Third curl: `401`

Then in the UI, regenerate the agent's token. Run the first curl again with the old token — should return 401.

Finally, revoke the agent. Run a curl with the new token — should return 401.

- [ ] **Step 5: Commit any follow-up fixes**

If any smoke test fails, fix the issue, commit with message `fix(agents): follow-up fixes from smoke test`, and redeploy.

---

## Self-review

**Spec coverage:**
- §1 Data model (agents table) → Task 1 ✓
- §2 Token format and storage → Task 2 ✓
- §3 Authentication flow (verifyAgentToken) → Task 4 ✓
- §3 Middleware integration → Task 6 ✓
- §3 getActor update → Task 5 ✓
- §3 Audit log event types → Task 3 ✓
- §5 API routes (GET/POST /api/agents, PUT/DELETE /api/agents/[id]) → Tasks 7, 8 ✓
- §4 Admin UI with tabs, create modal, token display, regenerate, revoke → Tasks 9, 10 ✓
- §6 Compliance Tracker skill file → Task 11 ✓
- §7 README update → Task 11 ✓
- §9 Testing (unit tests for token-utils and agent-auth, smoke tests post-deploy) → Tasks 2, 4, 12 ✓

**Placeholder scan:** No TBD/TODO. All code blocks are complete. All file paths exact.

**Type consistency:**
- `AgentActor` shape = `{ type: 'agent', agentId, name, role }` — consistent across agent-auth.ts and tests ✓
- `Actor` source union adds `'agent'` consistently in actor.ts and tests ✓
- `AuditEventType` additions (`agent.created/regenerated/revoked`) match the logEvent calls in API routes ✓
- Token format `ct_live_` prefix consistent across token-utils, agent-auth, middleware, and skill file ✓
- `tokenPrefix` stored as first 15 chars consistently in POST create and PUT regenerate ✓
