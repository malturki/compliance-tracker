import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations, completions, auditLog } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { DELETE as bulkDelete } from '@/app/api/obligations/route'
import { POST as bulkAction } from '@/app/api/obligations/bulk/route'
import { POST as completeObligation } from '@/app/api/obligations/[id]/complete/route'

describe('Bulk operations', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  it('bulk delete removes all target obligations', async () => {
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      ids.push(await insertObligation({ title: `Item ${i}` }))
    }

    const req = mkReq('http://localhost/api/obligations', {
      method: 'DELETE',
      body: { ids },
    })
    const res = await bulkDelete(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(5)

    const remaining = await db.select().from(obligations).where(inArray(obligations.id, ids))
    expect(remaining).toHaveLength(0)
  })

  it('bulk delete cleans up completions (no orphans)', async () => {
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      ids.push(await insertObligation({ title: `Item ${i}` }))
    }

    // Complete the first 2
    for (const id of ids.slice(0, 2)) {
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-04-01' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)
    }

    // Verify completions exist
    const before = await db.select().from(completions).where(inArray(completions.obligationId, ids))
    expect(before).toHaveLength(2)

    // Bulk delete all 3
    const req = mkReq('http://localhost/api/obligations', {
      method: 'DELETE',
      body: { ids },
    })
    const res = await bulkDelete(req)
    expect(res.status).toBe(200)

    const remainingObligations = await db.select().from(obligations).where(inArray(obligations.id, ids))
    expect(remainingObligations).toHaveLength(0)

    const remainingCompletions = await db.select().from(completions).where(inArray(completions.obligationId, ids))
    expect(remainingCompletions).toHaveLength(0)
  })

  it('bulk delete rejects empty ids array', async () => {
    const req = mkReq('http://localhost/api/obligations', {
      method: 'DELETE',
      body: { ids: [] },
    })
    const res = await bulkDelete(req)
    expect(res.status).toBe(400)
  })

  it('bulk delete rejects more than 100 ids', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    const req = mkReq('http://localhost/api/obligations', {
      method: 'DELETE',
      body: { ids },
    })
    const res = await bulkDelete(req)
    expect(res.status).toBe(400)
  })

  it('bulk update-owner updates owner on all targeted obligations', async () => {
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      ids.push(await insertObligation({ title: `Item ${i}`, owner: 'Old Owner' }))
    }

    const req = mkReq('http://localhost/api/obligations/bulk', {
      method: 'POST',
      body: { action: 'update-owner', ids, data: { owner: 'New Owner' } },
    })
    const res = await bulkAction(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('update-owner')
    expect(body.updated).toBe(3)

    const rows = await db.select().from(obligations).where(inArray(obligations.id, ids))
    expect(rows).toHaveLength(3)
    expect(rows.every(r => r.owner === 'New Owner')).toBe(true)
  })

  it('bulk update-risk updates riskLevel on all targeted obligations', async () => {
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      ids.push(await insertObligation({ title: `Item ${i}`, riskLevel: 'low' }))
    }

    const req = mkReq('http://localhost/api/obligations/bulk', {
      method: 'POST',
      body: { action: 'update-risk', ids, data: { riskLevel: 'critical' } },
    })
    const res = await bulkAction(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.updated).toBe(3)

    const rows = await db.select().from(obligations).where(inArray(obligations.id, ids))
    expect(rows.every(r => r.riskLevel === 'critical')).toBe(true)
  })

  it('bulk operations write exactly one obligation.bulk_updated audit event', async () => {
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      ids.push(await insertObligation({ title: `Item ${i}` }))
    }

    const req = mkReq('http://localhost/api/obligations/bulk', {
      method: 'POST',
      body: { action: 'update-owner', ids, data: { owner: 'Bulk Owner' } },
    })
    const res = await bulkAction(req)
    expect(res.status).toBe(200)

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.bulk_updated'))
    expect(events).toHaveLength(1)
    const metadata = JSON.parse(events[0].metadata || '{}')
    expect(metadata.action).toBe('update-owner')
    expect(metadata.count).toBe(4)
    expect(metadata.ids).toEqual(ids)
  })

  describe('bulk validation errors', () => {
    it('rejects request with no action (400)', async () => {
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { ids: ['x'] },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(400)
    })

    it('rejects request with no ids (400)', async () => {
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'update-owner', data: { owner: 'Whatever' } },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(400)
    })

    it('rejects request with empty ids array (400)', async () => {
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'update-owner', ids: [], data: { owner: 'Whatever' } },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(400)
    })

    it('rejects request with more than 100 ids (400)', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`)
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'update-owner', ids, data: { owner: 'Whatever' } },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(400)
    })

    it('rejects unknown action (400)', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'evaporate', ids: [id], data: {} },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/unknown action/i)
    })

    it('update-owner without owner field → 400', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'update-owner', ids: [id], data: {} },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/owner is required/i)
    })

    it('update-risk without riskLevel field → 400', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'update-risk', ids: [id], data: {} },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/risklevel is required/i)
    })

    it('mark-complete without completedBy → 400', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'mark-complete', ids: [id], data: {} },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/completedby is required/i)
    })
  })

  describe('bulk update-owner additional cases', () => {
    it('persists ownerEmail when provided', async () => {
      const id1 = await insertObligation({ title: 'A' })
      const id2 = await insertObligation({ title: 'B' })
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: {
          action: 'update-owner',
          ids: [id1, id2],
          data: { owner: 'Alice', ownerEmail: 'alice@test.com' },
        },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(200)

      const rows = await db.select().from(obligations).where(inArray(obligations.id, [id1, id2]))
      expect(rows.every(r => r.owner === 'Alice')).toBe(true)
      expect(rows.every(r => r.ownerEmail === 'alice@test.com')).toBe(true)
    })

    it('only updates the targeted ids, leaves others alone', async () => {
      const targeted = await insertObligation({ title: 'Target', owner: 'Old' })
      const untouched = await insertObligation({ title: 'Untouched', owner: 'Untouched-owner' })
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'update-owner', ids: [targeted], data: { owner: 'NewOwner' } },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(200)

      const rows = await db.select().from(obligations).where(inArray(obligations.id, [targeted, untouched]))
      const targetRow = rows.find(r => r.id === targeted)
      const untouchedRow = rows.find(r => r.id === untouched)
      expect(targetRow?.owner).toBe('NewOwner')
      expect(untouchedRow?.owner).toBe('Untouched-owner')
    })
  })

  describe('bulk delete via /api/obligations/bulk POST action', () => {
    it("action: 'delete' removes obligations and writes a single audit event", async () => {
      const ids: string[] = []
      for (let i = 0; i < 3; i++) {
        ids.push(await insertObligation({ title: `Del ${i}` }))
      }
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'delete', ids },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.action).toBe('delete')
      expect(body.deleted).toBe(3)

      const remaining = await db.select().from(obligations).where(inArray(obligations.id, ids))
      expect(remaining).toHaveLength(0)

      const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.bulk_updated'))
      expect(events).toHaveLength(1)
      const metadata = JSON.parse(events[0].metadata || '{}')
      expect(metadata.action).toBe('delete')
      expect(metadata.count).toBe(3)
    })
  })

  describe('bulk mark-complete (with mocked downstream fetch)', () => {
    let originalFetch: typeof globalThis.fetch | undefined

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      if (originalFetch) globalThis.fetch = originalFetch
    })

    it('reports completed count when all downstream calls succeed', async () => {
      const ids: string[] = []
      for (let i = 0; i < 3; i++) {
        ids.push(await insertObligation({ title: `Item ${i}` }))
      }

      // Mock fetch so the route's per-obligation /complete calls "succeed"
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 201 }),
      ) as any

      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: {
          action: 'mark-complete',
          ids,
          data: { completedBy: 'Tester', completionNotes: 'bulk ok' },
        },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.action).toBe('mark-complete')
      expect(body.total).toBe(3)
      expect(body.completed).toBe(3)
      expect(body.failed).toBe(0)
      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })

    it('reports failed count when downstream calls fail', async () => {
      const ids: string[] = []
      for (let i = 0; i < 3; i++) {
        ids.push(await insertObligation({ title: `Item ${i}` }))
      }

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'no' }), { status: 500 }),
      ) as any

      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'mark-complete', ids, data: { completedBy: 'Tester' } },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.completed).toBe(0)
      expect(body.failed).toBe(3)
      expect(body.total).toBe(3)
    })

    it('writes a single bulk_updated audit event for mark-complete', async () => {
      const ids = [await insertObligation({ title: 'A' }), await insertObligation({ title: 'B' })]
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 201 }),
      ) as any

      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'mark-complete', ids, data: { completedBy: 'Tester' } },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(200)

      const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.bulk_updated'))
      expect(events).toHaveLength(1)
      const metadata = JSON.parse(events[0].metadata || '{}')
      expect(metadata.action).toBe('mark-complete')
      expect(metadata.count).toBe(2)
    })
  })
})
