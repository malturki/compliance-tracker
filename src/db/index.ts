import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

// Support both Turso (production) and local file (development)
const client = tursoUrl
  ? createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    })
  : createClient({
      url: 'file:compliance.db',
    })

export const db = drizzle(client, { schema })

// Initialize tables (runs once on module load)
// Note: Drizzle-kit should handle migrations in production
// This is a fallback for development
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

// Initialize tables on import (fire-and-forget)
initTables().catch(console.error)

export default db
