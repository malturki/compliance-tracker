import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { GET as listObligations, POST as createObligation } from '@/app/api/obligations/route'
import { PUT as updateObligation } from '@/app/api/obligations/[id]/route'
import { GET as listCounterparties } from '@/app/api/counterparties/route'

describe('Counterparty field', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  describe('POST /api/obligations', () => {
    it('creates an obligation with a counterparty', async () => {
      const req = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'AWS Monthly Invoice',
          category: 'vendor',
          frequency: 'monthly',
          nextDueDate: '2027-06-30',
          owner: 'Test Owner',
          riskLevel: 'low',
          counterparty: 'Amazon Web Services',
        },
      })
      const res = await createObligation(req)
      expect(res.status).toBe(201)
      const { id } = await res.json()

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].counterparty).toBe('Amazon Web Services')
    })

    it('creates an obligation without a counterparty (nullable)', async () => {
      const req = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Internal cleanup',
          category: 'governance',
          frequency: 'quarterly',
          nextDueDate: '2027-06-30',
          owner: 'Test Owner',
          riskLevel: 'low',
        },
      })
      const res = await createObligation(req)
      expect(res.status).toBe(201)
      const { id } = await res.json()

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].counterparty).toBeNull()
    })

    it('rejects counterparty over 200 chars (400)', async () => {
      const req = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Long counterparty',
          category: 'vendor',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Test',
          riskLevel: 'low',
          counterparty: 'x'.repeat(201),
        },
      })
      const res = await createObligation(req)
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/obligations/[id]', () => {
    it('updates the counterparty and writes an audit diff entry', async () => {
      const id = await insertObligation({ title: 'Edit me' })
      const req = mkReq(`http://localhost/api/obligations/${id}`, {
        method: 'PUT',
        body: { counterparty: 'California Franchise Tax Board' },
      })
      const res = await updateObligation(req, { params: { id } })
      expect(res.status).toBe(200)

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].counterparty).toBe('California Franchise Tax Board')

      const events = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, 'obligation.updated'))
      const forThis = events.filter(e => e.entityId === id)
      expect(forThis).toHaveLength(1)
      const diff = JSON.parse(forThis[0].diff || '{}')
      expect(diff.counterparty).toEqual([null, 'California Franchise Tax Board'])
    })

    it('clearing counterparty (set to null) records the diff', async () => {
      const id = await insertObligation({ title: 'Clear CP', counterparty: 'AWS' })
      const req = mkReq(`http://localhost/api/obligations/${id}`, {
        method: 'PUT',
        body: { counterparty: null },
      })
      const res = await updateObligation(req, { params: { id } })
      expect(res.status).toBe(200)

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].counterparty).toBeNull()

      const events = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, 'obligation.updated'))
      const forThis = events.filter(e => e.entityId === id)
      expect(forThis).toHaveLength(1)
      const diff = JSON.parse(forThis[0].diff || '{}')
      expect(diff.counterparty).toEqual(['AWS', null])
    })

    it('updating jurisdiction also records a diff (newly tracked field)', async () => {
      const id = await insertObligation({ title: 'Track jurisdiction' })
      const req = mkReq(`http://localhost/api/obligations/${id}`, {
        method: 'PUT',
        body: { jurisdiction: 'Delaware' },
      })
      const res = await updateObligation(req, { params: { id } })
      expect(res.status).toBe(200)

      const events = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, 'obligation.updated'))
      const forThis = events.filter(e => e.entityId === id)
      expect(forThis).toHaveLength(1)
      const diff = JSON.parse(forThis[0].diff || '{}')
      expect(diff.jurisdiction).toEqual([null, 'Delaware'])
    })

    it('changing counterparty from one value to another shows old and new in diff', async () => {
      const id = await insertObligation({ title: 'Switch CP', counterparty: 'AWS' })
      const req = mkReq(`http://localhost/api/obligations/${id}`, {
        method: 'PUT',
        body: { counterparty: 'GCP' },
      })
      const res = await updateObligation(req, { params: { id } })
      expect(res.status).toBe(200)

      const events = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, 'obligation.updated'))
      const forThis = events.filter(e => e.entityId === id)
      expect(forThis).toHaveLength(1)
      const diff = JSON.parse(forThis[0].diff || '{}')
      expect(diff.counterparty).toEqual(['AWS', 'GCP'])
    })
  })

  describe('GET /api/obligations?counterparty=', () => {
    it('filters by counterparty', async () => {
      await insertObligation({ title: 'AWS A', counterparty: 'AWS' })
      await insertObligation({ title: 'AWS B', counterparty: 'AWS' })
      await insertObligation({ title: 'GCP A', counterparty: 'GCP' })
      await insertObligation({ title: 'No CP' })

      const req = mkReq('http://localhost/api/obligations?counterparty=AWS')
      const res = await listObligations(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(2)
      expect(body.every((o: any) => o.counterparty === 'AWS')).toBe(true)
    })

    it('returns empty array when filtering on a non-existent counterparty', async () => {
      await insertObligation({ counterparty: 'AWS' })
      const req = mkReq('http://localhost/api/obligations?counterparty=NotReal')
      const res = await listObligations(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(0)
    })
  })

  describe('GET /api/counterparties', () => {
    it('returns distinct counterparties with counts, sorted alphabetically', async () => {
      await insertObligation({ counterparty: 'AWS' })
      await insertObligation({ counterparty: 'AWS' })
      await insertObligation({ counterparty: 'AWS' })
      await insertObligation({ counterparty: 'GCP' })
      await insertObligation({ counterparty: 'California FTB' })
      await insertObligation({ counterparty: null })

      const res = await listCounterparties()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.counterparties).toEqual([
        { name: 'AWS', count: 3 },
        { name: 'California FTB', count: 1 },
        { name: 'GCP', count: 1 },
      ])
    })

    it('omits null and empty-string counterparties', async () => {
      await insertObligation({ counterparty: 'AWS' })
      await insertObligation({ counterparty: null })
      await insertObligation({ counterparty: '' as any })

      const res = await listCounterparties()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.counterparties).toEqual([{ name: 'AWS', count: 1 }])
    })

    it('returns 200 with empty array when no obligations have a counterparty', async () => {
      await insertObligation({})
      const res = await listCounterparties()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.counterparties).toEqual([])
    })

    it('viewer can list counterparties (200)', async () => {
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      await insertObligation({ counterparty: 'AWS' })
      const res = await listCounterparties()
      expect(res.status).toBe(200)
    })

    it('unauthenticated → 401', async () => {
      mockSession(null)
      const res = await listCounterparties()
      expect(res.status).toBe(401)
    })
  })
})
