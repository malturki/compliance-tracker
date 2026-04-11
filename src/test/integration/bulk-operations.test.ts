import { describe, it, expect, beforeEach } from 'vitest'
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
})
