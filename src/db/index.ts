import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import path from 'path'
import * as schema from './schema'

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN
const isProduction = process.env.NODE_ENV === 'production'

// Support both Turso (production with remote DB) and local file (development/embedded)
let client: ReturnType<typeof createClient>

if (tursoUrl) {
  // Remote Turso database
  client = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  })
} else {
  // Local SQLite file - use absolute path to find bundled DB
  const dbPath = isProduction
    ? path.join(process.cwd(), 'compliance.db')
    : 'file:compliance.db'
  client = createClient({
    url: isProduction ? `file:${dbPath}` : dbPath,
  })
}

export const db = drizzle(client, { schema })

// Initialize tables only in development (production uses pre-seeded DB)
if (!isProduction && !tursoUrl) {
  const initTables = async () => {
    const CREATE_TABLES_SQL = [
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
        entity TEXT DEFAULT 'Acme Corp',
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
    ]

    for (const sql of CREATE_TABLES_SQL) {
      await client.execute(sql)
    }
  }
  initTables().catch(console.error)
}

export default db
