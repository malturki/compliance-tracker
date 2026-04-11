import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { POST as createObligation } from '@/app/api/obligations/route'
import { PUT as updateObligation, DELETE as deleteObligation } from '@/app/api/obligations/[id]/route'
import { POST as completeObligation } from '@/app/api/obligations/[id]/complete/route'
import { GET as getAudit } from '@/app/api/audit/route'

describe('Audit log correctness', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  it('create writes exactly one obligation.created event', async () => {
    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: {
        title: 'Audit Create Test',
        category: 'tax',
        frequency: 'annual',
        nextDueDate: '2027-06-30',
        owner: 'Test Owner',
        riskLevel: 'medium',
      },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(201)
    const { id } = await res.json()

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.created'))
    const forThis = events.filter(e => e.entityId === id)
    expect(forThis).toHaveLength(1)
    expect(forThis[0].summary).toContain('Audit Create Test')
    expect(forThis[0].entityType).toBe('obligation')
  })

  it('update writes exactly one obligation.updated event with a scoped diff', async () => {
    const id = await insertObligation({
      title: 'Orig Title',
      owner: 'Old Owner',
      riskLevel: 'medium',
    })

    const req = mkReq(`http://localhost/api/obligations/${id}`, {
      method: 'PUT',
      body: { owner: 'New Owner', riskLevel: 'high' },
    })
    const res = await updateObligation(req, { params: { id } })
    expect(res.status).toBe(200)

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.updated'))
    const forThis = events.filter(e => e.entityId === id)
    expect(forThis).toHaveLength(1)

    const diff = JSON.parse(forThis[0].diff || '{}')
    expect(diff.owner).toEqual(['Old Owner', 'New Owner'])
    expect(diff.riskLevel).toEqual(['medium', 'high'])
    // title was not touched — should not appear in diff
    expect(diff.title).toBeUndefined()
  })

  it('update touching only untracked fields writes no audit event', async () => {
    const id = await insertObligation({ title: 'Stable Title' })

    // Update only 'description' which is not in TRACKED_OBLIGATION_FIELDS.
    const req = mkReq(`http://localhost/api/obligations/${id}`, {
      method: 'PUT',
      body: { description: 'Just a description change' },
    })
    const res = await updateObligation(req, { params: { id } })
    expect(res.status).toBe(200)

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.updated'))
    const forThis = events.filter(e => e.entityId === id)
    expect(forThis).toHaveLength(0)
  })

  it('delete writes obligation.deleted event with snapshot metadata', async () => {
    const id = await insertObligation({ title: 'Delete Me' })

    const req = mkReq(`http://localhost/api/obligations/${id}`, { method: 'DELETE' })
    const res = await deleteObligation(req, { params: { id } })
    expect(res.status).toBe(200)

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.deleted'))
    const forThis = events.filter(e => e.entityId === id)
    expect(forThis).toHaveLength(1)
    const metadata = JSON.parse(forThis[0].metadata || '{}')
    expect(metadata.snapshot).toBeDefined()
    expect(metadata.snapshot.id).toBe(id)
    expect(metadata.snapshot.title).toBe('Delete Me')
  })

  it('complete writes obligation.completed event with completionId and evidenceCount', async () => {
    const id = await insertObligation({ title: 'Complete Me' })

    const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
      method: 'POST',
      body: { completedBy: 'Tester', completedDate: '2026-04-01' },
    })
    const res = await completeObligation(req, { params: { id } })
    expect(res.status).toBe(201)

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.completed'))
    const forThis = events.filter(e => e.entityId === id)
    expect(forThis).toHaveLength(1)
    const metadata = JSON.parse(forThis[0].metadata || '{}')
    expect(metadata.completionId).toBeDefined()
    expect(typeof metadata.completionId).toBe('string')
    expect(metadata.evidenceCount).toBe(0)
  })

  it('GET /api/audit filters by type', async () => {
    // Create one obligation, then delete it (produces created + deleted events)
    const id = await insertObligation({ title: 'Filter Me' })

    // Trigger an update to add an obligation.updated event
    const updateReq = mkReq(`http://localhost/api/obligations/${id}`, {
      method: 'PUT',
      body: { owner: 'Updated' },
    })
    await updateObligation(updateReq, { params: { id } })

    const deleteReq = mkReq(`http://localhost/api/obligations/${id}`, { method: 'DELETE' })
    await deleteObligation(deleteReq, { params: { id } })

    const req = mkReq('http://localhost/api/audit?type=obligation.deleted')
    const res = await getAudit(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.events.every((e: any) => e.eventType === 'obligation.deleted')).toBe(true)
    expect(body.events.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/audit filters by actor', async () => {
    // Create an obligation as admin@test.com
    const createReq = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: {
        title: 'Actor Filter',
        category: 'tax',
        frequency: 'annual',
        nextDueDate: '2027-06-30',
        owner: 'Test',
        riskLevel: 'low',
      },
    })
    await createObligation(createReq)

    // Switch session to a different actor, then create another
    mockSession({ email: 'other@test.com', role: 'admin' })
    const createReq2 = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: {
        title: 'Other Actor',
        category: 'tax',
        frequency: 'annual',
        nextDueDate: '2027-06-30',
        owner: 'Test',
        riskLevel: 'low',
      },
    })
    await createObligation(createReq2)

    const req = mkReq('http://localhost/api/audit?actor=other@test.com')
    const res = await getAudit(req)
    const body = await res.json()
    expect(body.events.length).toBeGreaterThanOrEqual(1)
    expect(body.events.every((e: any) => e.actor === 'other@test.com')).toBe(true)
  })

  it('GET /api/audit filters by entity', async () => {
    const id1 = await insertObligation({ title: 'Entity One' })
    const id2 = await insertObligation({ title: 'Entity Two' })

    // Update both so we get audit events with each entityId
    await updateObligation(
      mkReq(`http://localhost/api/obligations/${id1}`, {
        method: 'PUT',
        body: { owner: 'A' },
      }),
      { params: { id: id1 } },
    )
    await updateObligation(
      mkReq(`http://localhost/api/obligations/${id2}`, {
        method: 'PUT',
        body: { owner: 'B' },
      }),
      { params: { id: id2 } },
    )

    const req = mkReq(`http://localhost/api/audit?entity=${id1}`)
    const res = await getAudit(req)
    const body = await res.json()
    expect(body.events.length).toBeGreaterThanOrEqual(1)
    expect(body.events.every((e: any) => e.entityId === id1)).toBe(true)
  })

  it('GET /api/audit paginates with limit and before cursor', async () => {
    // Create 15 obligations to produce 15 obligation.created events
    for (let i = 0; i < 15; i++) {
      const req = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: `Paginate ${i}`,
          category: 'tax',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Test',
          riskLevel: 'low',
        },
      })
      await createObligation(req)
      // tiny delay to ensure distinct ts values
      await new Promise(r => setTimeout(r, 2))
    }

    // First page of 10
    const page1Req = mkReq('http://localhost/api/audit?type=obligation.created&limit=10')
    const page1Res = await getAudit(page1Req)
    const page1 = await page1Res.json()
    expect(page1.events).toHaveLength(10)
    expect(page1.nextCursor).toBeTruthy()

    // Second page using before=nextCursor
    const page2Req = mkReq(
      `http://localhost/api/audit?type=obligation.created&limit=10&before=${encodeURIComponent(page1.nextCursor)}`,
    )
    const page2Res = await getAudit(page2Req)
    const page2 = await page2Res.json()
    expect(page2.events).toHaveLength(5)
    // All returned events should be strictly before the cursor
    for (const e of page2.events) {
      expect(e.ts < page1.nextCursor).toBe(true)
    }
  })
})
