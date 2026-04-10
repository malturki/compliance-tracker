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

  // Seed demo audit events so the /activity page and per-obligation history
  // panel are populated on every cold start in the in-memory demo environment.
  // Remove once a durable backing store (Turso) is configured.
  const now = Date.now()
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString()
  const firstId = (seedObligations[0] as { id: string } | undefined)?.id ?? null
  const secondId = (seedObligations[1] as { id: string } | undefined)?.id ?? null
  const thirdId = (seedObligations[4] as { id: string } | undefined)?.id ?? null
  const fourthId = (seedObligations[7] as { id: string } | undefined)?.id ?? null

  const demoEvents: Array<{
    id: string
    ts: string
    event_type: string
    actor: string
    actor_source: string
    entity_type: string
    entity_id: string | null
    summary: string
    diff: string | null
    metadata: string | null
  }> = [
    {
      id: '01DEMO00000000000000000001',
      ts: hoursAgo(216),
      event_type: 'template.applied',
      actor: 'alice@acme.com',
      actor_source: 'sso',
      entity_type: 'template',
      entity_id: 'delaware-c-corp',
      summary: 'Applied template "Delaware C-Corp" (32 obligations)',
      diff: null,
      metadata: JSON.stringify({ templateId: 'delaware-c-corp', count: 32 }),
    },
    {
      id: '01DEMO00000000000000000002',
      ts: hoursAgo(168),
      event_type: 'obligation.created',
      actor: 'alice@acme.com',
      actor_source: 'sso',
      entity_type: 'obligation',
      entity_id: firstId,
      summary: 'Created "Delaware Franchise Tax"',
      diff: null,
      metadata: JSON.stringify({ fields: ['title', 'category', 'frequency', 'nextDueDate', 'owner', 'riskLevel'] }),
    },
    {
      id: '01DEMO00000000000000000003',
      ts: hoursAgo(96),
      event_type: 'obligation.updated',
      actor: 'bob@acme.com',
      actor_source: 'sso',
      entity_type: 'obligation',
      entity_id: secondId,
      summary: 'Updated owner, riskLevel',
      diff: JSON.stringify({ owner: ['Internal', 'Anderson & Co'], riskLevel: ['medium', 'high'] }),
      metadata: null,
    },
    {
      id: '01DEMO00000000000000000004',
      ts: hoursAgo(72),
      event_type: 'alert.sent',
      actor: 'cron',
      actor_source: 'cron',
      entity_type: 'alert',
      entity_id: thirdId,
      summary: 'Sent alert for "D&O Insurance Renewal" to ops@acme.com',
      diff: null,
      metadata: JSON.stringify({ obligationId: thirdId, recipient: 'ops@acme.com', channel: 'email', daysUntilDue: 7 }),
    },
    {
      id: '01DEMO00000000000000000005',
      ts: hoursAgo(48),
      event_type: 'obligation.updated',
      actor: 'alice@acme.com',
      actor_source: 'sso',
      entity_type: 'obligation',
      entity_id: firstId,
      summary: 'Updated nextDueDate',
      diff: JSON.stringify({ nextDueDate: ['2026-03-01', '2026-03-15'] }),
      metadata: null,
    },
    {
      id: '01DEMO00000000000000000006',
      ts: hoursAgo(26),
      event_type: 'obligation.completed',
      actor: 'bob@acme.com',
      actor_source: 'sso',
      entity_type: 'obligation',
      entity_id: fourthId,
      summary: 'Marked "FinCEN BOI Report Update" complete',
      diff: null,
      metadata: JSON.stringify({ completionId: '01DEMOCOMPLETION001', evidenceCount: 2, completedBy: 'Bob Chen' }),
    },
    {
      id: '01DEMO00000000000000000007',
      ts: hoursAgo(20),
      event_type: 'obligation.bulk_updated',
      actor: 'alice@acme.com',
      actor_source: 'sso',
      entity_type: 'obligation',
      entity_id: null,
      summary: 'Bulk update-owner on 4 obligations',
      diff: null,
      metadata: JSON.stringify({ action: 'update-owner', ids: [firstId, secondId, thirdId, fourthId].filter(Boolean), count: 4 }),
    },
    {
      id: '01DEMO00000000000000000008',
      ts: hoursAgo(10),
      event_type: 'alert.sent',
      actor: 'cron',
      actor_source: 'cron',
      entity_type: 'alert',
      entity_id: firstId,
      summary: 'Sent alert for "Delaware Franchise Tax" to finance@acme.com',
      diff: null,
      metadata: JSON.stringify({ obligationId: firstId, recipient: 'finance@acme.com', channel: 'email', daysUntilDue: 3 }),
    },
    {
      id: '01DEMO00000000000000000009',
      ts: hoursAgo(4),
      event_type: 'obligation.updated',
      actor: 'alice@acme.com',
      actor_source: 'sso',
      entity_type: 'obligation',
      entity_id: secondId,
      summary: 'Updated assignee',
      diff: JSON.stringify({ assignee: [null, 'Carol Reyes'] }),
      metadata: null,
    },
    {
      id: '01DEMO00000000000000000010',
      ts: hoursAgo(1),
      event_type: 'obligation.completed',
      actor: 'alice@acme.com',
      actor_source: 'sso',
      entity_type: 'obligation',
      entity_id: secondId,
      summary: 'Marked "Illinois Annual Report" complete',
      diff: null,
      metadata: JSON.stringify({ completionId: '01DEMOCOMPLETION002', evidenceCount: 1, completedBy: 'Alice Kim' }),
    },
  ]

  for (const ev of demoEvents) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO audit_log (id, ts, event_type, actor, actor_source, entity_type, entity_id, summary, diff, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [ev.id, ev.ts, ev.event_type, ev.actor, ev.actor_source, ev.entity_type, ev.entity_id, ev.summary, ev.diff, ev.metadata],
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
