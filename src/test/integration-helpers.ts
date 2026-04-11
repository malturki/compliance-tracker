import { vi } from 'vitest'
import { db, dbReady, __getClientForTests } from '@/db'
import { obligations, completions, auditLog, users, agents } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ulid } from 'ulid'
import { hashToken } from '@/lib/token-utils'

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS obligations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    frequency TEXT NOT NULL,
    next_due_date TEXT NOT NULL,
    last_completed_date TEXT,
    owner TEXT NOT NULL,
    owner_email TEXT,
    assignee TEXT,
    assignee_email TEXT,
    status TEXT NOT NULL DEFAULT 'current',
    risk_level TEXT NOT NULL DEFAULT 'medium',
    alert_days TEXT DEFAULT '[]',
    last_alert_sent TEXT,
    source_document TEXT,
    notes TEXT,
    entity TEXT DEFAULT 'Pi Squared Inc.',
    jurisdiction TEXT,
    amount REAL,
    auto_recur INTEGER DEFAULT 0,
    template_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS completions (
    id TEXT PRIMARY KEY,
    obligation_id TEXT NOT NULL REFERENCES obligations(id),
    completed_date TEXT NOT NULL,
    completed_by TEXT NOT NULL,
    evidence_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
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
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agents (
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
  )`,
]

/**
 * Reset all application tables between tests so state from one test doesn't
 * leak into the next. Also idempotently re-creates tables in case a prior
 * test's transaction dropped them or the connection was reset.
 */
export async function resetDb(options: { keepSeed?: boolean } = {}) {
  await dbReady
  // Idempotently re-create tables using the same client the Proxy db wraps.
  // If tables got dropped between tests (e.g., an in-memory connection reset),
  // this brings them back before we try to delete rows.
  const client = __getClientForTests()
  for (const sql of DDL_STATEMENTS) {
    await client.execute(sql)
  }
  await db.delete(auditLog)
  await db.delete(completions)
  await db.delete(users)
  await db.delete(agents)
  if (!options.keepSeed) {
    await db.delete(obligations)
  }
}

/**
 * Replace the mocked auth() return value for the duration of a single test.
 * Call this inside a test body to simulate a different role or an unauthenticated
 * caller. The global mock in test-setup.ts defaults to admin@test.com.
 *
 * Pass null to simulate an unauthenticated caller (no session). This is
 * typically used together with a Bearer token header for agent tests.
 */
export function mockSession(
  session: { email: string; role: 'viewer' | 'editor' | 'admin' } | null,
) {
  if (session) {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: `user-${session.email}`,
        email: session.email,
        name: session.email,
        image: null,
        role: session.role,
      },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    } as any)
  } else {
    vi.mocked(auth).mockResolvedValue(null as any)
  }
}

export async function insertUser(email: string, role: 'viewer' | 'editor' | 'admin' = 'admin') {
  const now = new Date().toISOString()
  const id = ulid()
  await db.insert(users).values({
    id,
    email,
    name: email,
    image: null,
    role,
    createdAt: now,
    updatedAt: now,
  })
  return { id, email, role }
}

export async function insertAgent(options: {
  name?: string
  role?: 'viewer' | 'editor' | 'admin'
  expiresAt?: string
  revokedAt?: string | null
} = {}) {
  const token = 'ct_live_' + Math.random().toString(36).slice(2).padEnd(44, 'x').slice(0, 44)
  const tokenHash = await hashToken(token)
  const now = new Date().toISOString()
  const id = ulid()
  await db.insert(agents).values({
    id,
    name: options.name ?? 'TestAgent',
    description: null,
    role: options.role ?? 'editor',
    tokenHash,
    tokenPrefix: token.slice(0, 15),
    createdBy: 'test@test.com',
    createdAt: now,
    expiresAt: options.expiresAt ?? new Date(Date.now() + 86_400_000).toISOString(),
    lastUsedAt: null,
    revokedAt: options.revokedAt ?? null,
  })
  return { id, token }
}

export async function insertObligation(overrides: Partial<{
  id: string
  title: string
  category: string
  frequency: string
  nextDueDate: string
  lastCompletedDate: string | null
  owner: string
  riskLevel: string
  status: string
  autoRecur: boolean
  alertDays: string
}> = {}) {
  const now = new Date().toISOString()
  const id = overrides.id ?? ulid()
  await db.insert(obligations).values({
    id,
    title: overrides.title ?? 'Test Obligation',
    description: null,
    category: (overrides.category ?? 'tax') as any,
    subcategory: null,
    frequency: (overrides.frequency ?? 'annual') as any,
    nextDueDate: overrides.nextDueDate ?? '2027-12-31',
    lastCompletedDate: overrides.lastCompletedDate ?? null,
    owner: overrides.owner ?? 'Test Owner',
    ownerEmail: null,
    assignee: null,
    assigneeEmail: null,
    status: overrides.status ?? 'current',
    riskLevel: overrides.riskLevel ?? 'medium',
    alertDays: overrides.alertDays ?? '[]',
    lastAlertSent: null,
    sourceDocument: null,
    notes: null,
    entity: 'Pi Squared Inc.',
    jurisdiction: null,
    amount: null,
    autoRecur: overrides.autoRecur ?? false,
    templateId: null,
    createdAt: now,
    updatedAt: now,
  } as any)
  return id
}

/**
 * Build a NextRequest-like object for passing to API route handlers. The
 * handlers accept a Next.js `NextRequest`, but for integration tests a plain
 * `Request` with the `nextUrl` extension works because route handlers only
 * read headers, URL, and body.
 */
export function mkReq(
  url: string,
  init: {
    method?: string
    body?: any
    headers?: Record<string, string>
  } = {},
) {
  const method = init.method ?? 'GET'
  const headers = new Headers({
    'content-type': 'application/json',
    ...init.headers,
  })
  const body = init.body !== undefined ? JSON.stringify(init.body) : undefined

  const req = new Request(url, { method, headers, body }) as any
  // Route handlers that need nextUrl.searchParams get a URL object
  req.nextUrl = new URL(url)
  return req
}
