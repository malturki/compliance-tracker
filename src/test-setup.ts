import { vi, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Use a fresh file-based SQLite DB for each test run. :memory: has edge cases
// with libsql's transaction() path, so a real file is more reliable for
// integration tests. Same file is shared across a test run; integration tests
// reset rows between each test via resetDb().
const testDbPath = path.join(os.tmpdir(), `compliance-tracker-test-${process.pid}.db`)
try { fs.unlinkSync(testDbPath) } catch {}
process.env.TURSO_DATABASE_URL = `file:${testDbPath}`
delete process.env.TURSO_AUTH_TOKEN

// Before any test runs, ensure all application tables exist in the test DB.
// Unit tests that don't use resetDb (like the existing audit/agent-auth tests)
// still rely on tables being present.
//
// Files that mock `@/db` entirely don't have __getClientForTests in their mock;
// for those, we skip silently — their tests don't hit the real DB anyway.
beforeAll(async () => {
  let client: any
  try {
    const dbModule = await import('@/db')
    const getter = (dbModule as any).__getClientForTests
    if (typeof getter !== 'function') return // mocked file, skip
    client = getter()
  } catch {
    return
  }
  const ddl = [
    `CREATE TABLE IF NOT EXISTS obligations (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      category TEXT NOT NULL, subcategory TEXT, frequency TEXT NOT NULL,
      next_due_date TEXT NOT NULL, last_completed_date TEXT,
      owner TEXT NOT NULL, owner_email TEXT, assignee TEXT, assignee_email TEXT,
      status TEXT NOT NULL DEFAULT 'current',
      risk_level TEXT NOT NULL DEFAULT 'medium',
      alert_days TEXT DEFAULT '[]', last_alert_sent TEXT,
      source_document TEXT, notes TEXT,
      entity TEXT DEFAULT 'Pi Squared Inc.',
      counterparty TEXT,
      jurisdiction TEXT, amount REAL,
      auto_recur INTEGER DEFAULT 0, template_id TEXT,
      parent_id TEXT REFERENCES obligations(id),
      sequence INTEGER,
      blocker_reason TEXT,
      next_recommended_action TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_obligations_parent_id ON obligations(parent_id)`,
    `CREATE TABLE IF NOT EXISTS completions (
      id TEXT PRIMARY KEY,
      obligation_id TEXT NOT NULL REFERENCES obligations(id),
      completed_date TEXT NOT NULL, completed_by TEXT NOT NULL,
      evidence_url TEXT, notes TEXT,
      approved_by TEXT, approved_date TEXT,
      verification_status TEXT DEFAULT 'unverified',
      summary TEXT, evidence_urls TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, ts TEXT NOT NULL,
      event_type TEXT NOT NULL, actor TEXT NOT NULL,
      actor_source TEXT NOT NULL, entity_type TEXT NOT NULL,
      entity_id TEXT, summary TEXT NOT NULL,
      diff TEXT, metadata TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
      name TEXT, image TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      role TEXT NOT NULL, token_hash TEXT NOT NULL,
      token_prefix TEXT NOT NULL, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      last_used_at TEXT, revoked_at TEXT
    )`,
  ]
  for (const sql of ddl) {
    await client.execute(sql)
  }
})

// Mock next-auth to prevent "Cannot find module 'next/server'" errors.
// next-auth imports next/server which only works inside Next.js runtime.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn().mockResolvedValue({
      user: { id: 'test-user', email: 'test@test.com', role: 'admin' },
      expires: '',
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn(() => ({})),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'test-user', email: 'test@test.com', role: 'admin' } },
    status: 'authenticated',
  })),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock @/lib/auth (our NextAuth config wrapper) so requireRole/requireAuth work.
// Returns an admin session so all role checks pass in tests by default.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'test-user', email: 'test@test.com', role: 'admin' },
    expires: '',
  }),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}))
