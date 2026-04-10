import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import seedObligations from '@/data/seed-obligations.json'

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN
// Use in-memory SQLite (seeded from JSON below) whenever Turso isn't configured.
// This covers both Vercel serverless and local dev without creds.
const useInMemory = !tursoUrl

let client: ReturnType<typeof createClient>

try {
  if (tursoUrl) {
    client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    })
  } else {
    client = createClient({
      url: ':memory:',
    })
  }
} catch {
  // Fallback to in-memory if Turso URL fails (e.g., during Next.js build
  // "Collecting page data" phase where the URL protocol isn't supported).
  // Runtime requests will use the real Turso client via a fresh cold start.
  client = createClient({ url: ':memory:' })
}

export const db = drizzle(client, { schema })

// For in-memory mode (Vercel without Turso), seed from JSON on each cold start
const initInMemory = async () => {
  if (!useInMemory) return

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
    entity TEXT DEFAULT 'Acme Corp',
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

// Initialize in-memory DB (awaited before first query via promise)
export const dbReady = initInMemory()

// Development: init tables from SQL
if (process.env.NODE_ENV !== 'production' && !tursoUrl) {
  const initTables = async () => {
    await client.execute(`CREATE TABLE IF NOT EXISTS obligations (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, category TEXT NOT NULL,
      subcategory TEXT, frequency TEXT NOT NULL, next_due_date TEXT NOT NULL,
      last_completed_date TEXT, owner TEXT NOT NULL, owner_email TEXT, assignee TEXT,
      assignee_email TEXT, status TEXT NOT NULL DEFAULT 'current',
      risk_level TEXT NOT NULL DEFAULT 'medium', alert_days TEXT DEFAULT '[]',
      last_alert_sent TEXT, source_document TEXT, notes TEXT,
      entity TEXT DEFAULT 'Acme Corp', jurisdiction TEXT, amount REAL,
      auto_recur INTEGER DEFAULT 0, template_id TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`)
    await client.execute(`CREATE TABLE IF NOT EXISTS completions (
      id TEXT PRIMARY KEY, obligation_id TEXT NOT NULL REFERENCES obligations(id),
      completed_date TEXT NOT NULL, completed_by TEXT NOT NULL,
      evidence_url TEXT, notes TEXT, created_at TEXT NOT NULL
    )`)
  }
  initTables().catch(console.error)
}

export default db
