import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';

// Mock the database
vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
  dbReady: Promise.resolve(),
}));

// Mock ulid
vi.mock('ulid', () => ({
  ulid: vi.fn(() => 'test-ulid-123'),
}));

describe('POST /api/obligations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates obligation with valid data (201)', async () => {
    const validData = {
      title: 'Annual Tax Filing',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
      riskLevel: 'high',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(validData),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
  });

  it('rejects empty title (400)', async () => {
    const invalidData = {
      title: '',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('rejects invalid category enum (400)', async () => {
    const invalidData = {
      title: 'Test',
      category: 'invalid-category',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects invalid date format (400)', async () => {
    const invalidData = {
      title: 'Test',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '12/31/2024', // Wrong format
      owner: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects invalid frequency enum (400)', async () => {
    const invalidData = {
      title: 'Test',
      category: 'tax',
      frequency: 'daily', // Not valid
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('GET /api/obligations', () => {
  it('returns empty array when no obligations exist', async () => {
    const request = new NextRequest('http://localhost/api/obligations');
    
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('filters by category when provided', async () => {
    const request = new NextRequest('http://localhost/api/obligations?category=tax');
    
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('filters by status when provided', async () => {
    const request = new NextRequest('http://localhost/api/obligations?status=overdue');
    
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('supports search parameter', async () => {
    const request = new NextRequest('http://localhost/api/obligations?search=tax');

    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});

async function ensureSchema() {
  const { __getClientForTests } = await import('@/db');
  const client = __getClientForTests();
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
      entity TEXT DEFAULT 'Pi Squared Inc.', counterparty TEXT, jurisdiction TEXT, amount REAL,
      auto_recur INTEGER DEFAULT 0, template_id TEXT,
      parent_id TEXT REFERENCES obligations(id),
      sequence INTEGER,
      blocker_reason TEXT,
      next_recommended_action TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, ts TEXT NOT NULL, event_type TEXT NOT NULL,
      actor TEXT NOT NULL, actor_source TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT,
      summary TEXT NOT NULL, diff TEXT, metadata TEXT
    )`,
  ];
  for (const sql of ddl) await client.execute(sql);
}

describe('audit: POST /api/obligations', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock('@/db');
    vi.doUnmock('ulid');
    await ensureSchema();
    const { db, dbReady } = await import('@/db');
    const { auditLog } = await import('@/db/schema');
    await dbReady;
    await db.delete(auditLog);
  });

  it('writes an obligation.created audit row', async () => {
    vi.resetModules();
    vi.doUnmock('@/db');
    vi.doUnmock('ulid');
    const { POST: RealPOST } = await import('../route');
    const { db, dbReady } = await import('@/db');
    const { auditLog, obligations } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await dbReady;
    await db.delete(auditLog);

    const title = 'Audit Trail Test Filing ' + Date.now();
    const validData = {
      title,
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2026-12-31',
      owner: 'Jane Doe',
      riskLevel: 'high',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(validData),
    });

    const response = await RealPOST(request);
    expect([200, 201]).toContain(response.status);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventType, 'obligation.created'));
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toContain(title);

    // cleanup created obligation
    const created = await response.json();
    if (created?.id) {
      await db.delete(obligations).where(eq(obligations.id, created.id));
    }
  });
});

describe('audit: PUT /api/obligations/[id]', () => {
  it('writes an obligation.updated audit row with diff', async () => {
    vi.resetModules();
    vi.doUnmock('@/db');
    vi.doUnmock('ulid');
    await ensureSchema();
    const { PUT } = await import('../[id]/route');
    const { db, dbReady } = await import('@/db');
    const { auditLog, obligations } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await dbReady;
    await db.delete(auditLog);

    const id = 'test-audit-upd-1';
    await db.delete(obligations).where(eq(obligations.id, id));
    const nowIso = new Date().toISOString();
    await db.insert(obligations).values({
      id,
      title: 'Original',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2026-12-31',
      owner: 'Internal',
      status: 'current',
      riskLevel: 'medium',
      alertDays: '[]',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const request = new NextRequest(`http://localhost/api/obligations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ owner: 'Anderson & Co' }),
    });

    const response = await PUT(request, { params: { id } });
    expect(response.status).toBe(200);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventType, 'obligation.updated'));
    expect(rows).toHaveLength(1);
    const diff = JSON.parse(rows[0].diff || '{}');
    expect(diff).toMatchObject({ owner: ['Internal', 'Anderson & Co'] });

    await db.delete(obligations).where(eq(obligations.id, id));
    await db.delete(auditLog);
  });
});
