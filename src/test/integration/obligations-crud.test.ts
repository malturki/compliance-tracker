import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations, completions, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { GET as listObligations, POST as createObligation, DELETE as bulkDelete } from '@/app/api/obligations/route'
import { GET as getObligation, PUT as updateObligation, DELETE as deleteObligation } from '@/app/api/obligations/[id]/route'
import { POST as completeObligation } from '@/app/api/obligations/[id]/complete/route'

describe('Obligations CRUD workflow', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  it('creates an obligation and returns its id', async () => {
    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: {
        title: 'Integration Create',
        category: 'tax',
        frequency: 'annual',
        nextDueDate: '2027-06-30',
        owner: 'Test Owner',
        riskLevel: 'medium',
      },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(typeof body.id).toBe('string')

    const rows = await db.select().from(obligations).where(eq(obligations.id, body.id))
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Integration Create')
  })

  it('rejects creation with invalid category (400)', async () => {
    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: {
        title: 'Bad',
        category: 'not-a-real-category',
        frequency: 'annual',
        nextDueDate: '2027-06-30',
        owner: 'Test',
        riskLevel: 'low',
      },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(400)
  })

  it('fetches a single obligation with its computed status and empty completions', async () => {
    const id = await insertObligation({
      title: 'Fetch Me',
      frequency: 'annual',
      nextDueDate: '2027-01-15',
    })
    const req = mkReq(`http://localhost/api/obligations/${id}`)
    const res = await getObligation(req, { params: { id } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(id)
    expect(body.title).toBe('Fetch Me')
    expect(body.completions).toEqual([])
    expect(body.status).toMatch(/^(current|upcoming|overdue|completed)$/)
  })

  it('returns 404 for non-existent obligation', async () => {
    const req = mkReq('http://localhost/api/obligations/nonexistent')
    const res = await getObligation(req, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })

  it('updates an obligation and writes an audit event with diff', async () => {
    const id = await insertObligation({ title: 'Before', owner: 'Old Owner' })
    const req = mkReq(`http://localhost/api/obligations/${id}`, {
      method: 'PUT',
      body: { owner: 'New Owner', notes: 'Updated notes' },
    })
    const res = await updateObligation(req, { params: { id } })
    expect(res.status).toBe(200)

    const rows = await db.select().from(obligations).where(eq(obligations.id, id))
    expect(rows[0].owner).toBe('New Owner')
    expect(rows[0].notes).toBe('Updated notes')

    // Audit log should have exactly one obligation.updated event for this id
    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.updated'))
    const entityEvents = events.filter(e => e.entityId === id)
    expect(entityEvents).toHaveLength(1)
    const diff = JSON.parse(entityEvents[0].diff || '{}')
    expect(diff.owner).toEqual(['Old Owner', 'New Owner'])
    expect(diff.notes).toEqual([null, 'Updated notes'])
  })

  it('deletes an obligation and its completions together (no orphans)', async () => {
    const id = await insertObligation({ title: 'To Delete' })

    // First complete it so it has a completion record
    const completeReq = mkReq(`http://localhost/api/obligations/${id}/complete`, {
      method: 'POST',
      body: { completedBy: 'Tester', completedDate: '2026-01-01' },
    })
    const completeRes = await completeObligation(completeReq, { params: { id } })
    expect(completeRes.status).toBe(201)

    // Verify the completion exists
    const compsBefore = await db.select().from(completions).where(eq(completions.obligationId, id))
    expect(compsBefore).toHaveLength(1)

    // Delete the obligation
    const deleteReq = mkReq(`http://localhost/api/obligations/${id}`, { method: 'DELETE' })
    const deleteRes = await deleteObligation(deleteReq, { params: { id } })
    expect(deleteRes.status).toBe(200)

    // Obligation gone
    const obsAfter = await db.select().from(obligations).where(eq(obligations.id, id))
    expect(obsAfter).toHaveLength(0)

    // Completions gone (no orphans)
    const compsAfter = await db.select().from(completions).where(eq(completions.obligationId, id))
    expect(compsAfter).toHaveLength(0)
  })

  it('lists obligations with filters', async () => {
    await insertObligation({ title: 'Tax One', category: 'tax' })
    await insertObligation({ title: 'Tax Two', category: 'tax' })
    await insertObligation({ title: 'Vendor Thing', category: 'vendor' })

    // No filter — all three
    let req = mkReq('http://localhost/api/obligations')
    let res = await listObligations(req)
    expect(res.status).toBe(200)
    let body = await res.json()
    expect(body).toHaveLength(3)

    // Filter by category
    req = mkReq('http://localhost/api/obligations?category=tax')
    res = await listObligations(req)
    body = await res.json()
    expect(body).toHaveLength(2)
    expect(body.every((o: any) => o.category === 'tax')).toBe(true)
  })
})
