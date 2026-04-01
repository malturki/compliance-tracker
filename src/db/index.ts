import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { join } from 'path'

const dbPath = process.env.DATABASE_URL || join(process.cwd(), 'compliance.db')
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

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
    assignee TEXT,
    status TEXT NOT NULL DEFAULT 'current',
    risk_level TEXT NOT NULL DEFAULT 'medium',
    alert_days TEXT DEFAULT '[]',
    source_document TEXT,
    notes TEXT,
    entity TEXT DEFAULT 'Pi Squared Inc.',
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
  sqlite.prepare(sql).run()
}

export default db
