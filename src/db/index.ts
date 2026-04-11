import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import seedObligations from '@/data/seed-obligations.json'

// Lazy initialization: defer client creation from module import time to first
// use. This prevents Next.js build "Collecting page data" from triggering
// network connections or URL-parsing errors when Turso env vars are present.

let _client: ReturnType<typeof createClient> | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _dbReadyPromise: Promise<void> | null = null

// Exported so integration tests can execute raw DDL against the same
// underlying libsql client the Proxy db wraps.
export function __getClientForTests() {
  return getClient()
}

function getClient() {
  if (_client) return _client

  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

  if (tursoUrl) {
    _client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    })
  } else {
    _client = createClient({
      url: ':memory:',
    })
  }

  return _client
}

// Proxy that lazily initializes the drizzle db instance on first property access.
// This ensures createClient() only runs at request time, never at build time.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = drizzle(getClient(), { schema })
    }
    return Reflect.get(_db, prop, receiver)
  },
})

async function initInMemory() {
  const client = getClient()
  const tursoUrl = process.env.TURSO_DATABASE_URL
  if (tursoUrl) return // Turso is persistent, no in-memory seeding needed

  // Create tables
  await client.execute(`CREATE TABLE IF NOT EXISTS obligations (
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
  )`)

  await client.execute(`CREATE TABLE IF NOT EXISTS completions (
    id TEXT PRIMARY KEY,
    obligation_id TEXT NOT NULL REFERENCES obligations(id),
    completed_date TEXT NOT NULL,
    completed_by TEXT NOT NULL,
    evidence_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  )`)

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

  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`)

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

  // Seed obligations from JSON
  for (const row of seedObligations) {
    const r = row as Record<string, unknown>
    await client.execute({
      sql: `INSERT OR IGNORE INTO obligations (id, title, description, category, subcategory, frequency, next_due_date, last_completed_date, owner, owner_email, assignee, assignee_email, status, risk_level, alert_days, last_alert_sent, source_document, notes, entity, jurisdiction, amount, auto_recur, template_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id as string, r.title as string, r.description as string | null, r.category as string,
        r.subcategory as string | null, r.frequency as string, r.next_due_date as string,
        r.last_completed_date as string | null, r.owner as string, r.owner_email as string | null,
        r.assignee as string | null, r.assignee_email as string | null, r.status as string,
        r.risk_level as string, r.alert_days as string, r.last_alert_sent as string | null,
        r.source_document as string | null, r.notes as string | null, r.entity as string,
        r.jurisdiction as string | null, r.amount as number | null, r.auto_recur as number,
        r.template_id as string | null, r.created_at as string, r.updated_at as string,
      ],
    })
  }
}

// Awaited by route handlers before first query. On Turso, resolves immediately.
// On in-memory, creates tables and seeds data.
export const dbReady = (async () => {
  // Only initialize if we're in a real runtime context, not during build
  if (typeof globalThis !== 'undefined') {
    if (!_dbReadyPromise) {
      _dbReadyPromise = initInMemory()
    }
    return _dbReadyPromise
  }
})()

export default db
