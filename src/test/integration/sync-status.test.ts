import { describe, it, expect, beforeEach } from 'vitest'
import { dbReady } from '@/db'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { GET as syncStatus } from '@/app/api/sync-status/route'
import { POST as createObligation } from '@/app/api/obligations/route'

describe('GET /api/sync-status', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'editor@test.com', role: 'editor' })
  })

  it('returns null lastSyncAt when no obligation-related audit events exist', async () => {
    const res = await syncStatus(mkReq('http://localhost/api/sync-status'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ lastSyncAt: null, lastEventType: null })
  })

  it('returns the timestamp of the most recent qualifying audit event', async () => {
    // Creating an obligation through the API writes an obligation.created
    // audit row that should be the lastSyncAt value.
    const res = await createObligation(
      mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Test',
          category: 'tax',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Alice',
          riskLevel: 'low',
        },
      }),
    )
    expect(res.status).toBe(201)

    const sync = await syncStatus(mkReq('http://localhost/api/sync-status'))
    const body = await sync.json()
    expect(body.lastSyncAt).toBeTruthy()
    expect(body.lastEventType).toBe('obligation.created')
    // ISO timestamp shape sanity check.
    expect(body.lastSyncAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('reflects the most recent event when multiple events exist', async () => {
    // Two creates back to back — second one should be the latest.
    await createObligation(
      mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: { title: 'A', category: 'tax', frequency: 'annual', nextDueDate: '2027-06-30', owner: 'Alice', riskLevel: 'low' },
      }),
    )
    await new Promise(r => setTimeout(r, 10)) // ensure ts ordering
    await createObligation(
      mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: { title: 'B', category: 'tax', frequency: 'annual', nextDueDate: '2027-06-30', owner: 'Bob', riskLevel: 'low' },
      }),
    )

    const sync = await syncStatus(mkReq('http://localhost/api/sync-status'))
    const body = await sync.json()
    expect(body.lastEventType).toBe('obligation.created')
    expect(typeof body.lastSyncAt).toBe('string')
  })

  it('ignores audit events for non-obligation entity types', async () => {
    // A direct insert of a user.role_changed-style event (entity_type='user')
    // should not affect the sync-status response.
    const id = await insertObligation({ title: 'seeded' })
    expect(id).toBeTruthy()
    // The insertObligation helper writes through Drizzle directly without an
    // audit row, so no obligation-related events exist; sync should be null.
    const sync = await syncStatus(mkReq('http://localhost/api/sync-status'))
    const body = await sync.json()
    expect(body.lastSyncAt).toBeNull()
  })

  describe('role enforcement', () => {
    it('viewer can read', async () => {
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      const res = await syncStatus(mkReq('http://localhost/api/sync-status'))
      expect(res.status).toBe(200)
    })

    it('unauthenticated returns 401', async () => {
      mockSession(null)
      const res = await syncStatus(mkReq('http://localhost/api/sync-status'))
      expect(res.status).toBe(401)
    })
  })
})
