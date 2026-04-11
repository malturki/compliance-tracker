import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { GET as getObligation } from '@/app/api/obligations/[id]/route'
import { POST as completeObligation } from '@/app/api/obligations/[id]/complete/route'

describe('Completion status semantics', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  async function completeIt(id: string, date = '2026-04-01') {
    const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
      method: 'POST',
      body: { completedBy: 'Tester', completedDate: date },
    })
    const res = await completeObligation(req, { params: { id } })
    expect(res.status).toBe(201)
  }

  async function fetchComputed(id: string) {
    const req = mkReq(`http://localhost/api/obligations/${id}`)
    const res = await getObligation(req, { params: { id } })
    expect(res.status).toBe(200)
    return res.json()
  }

  it('one-time obligation becomes completed after complete', async () => {
    const id = await insertObligation({
      title: 'One-time filing',
      frequency: 'one-time',
      nextDueDate: '2027-06-30',
    })
    await completeIt(id)
    const body = await fetchComputed(id)
    expect(body.status).toBe('completed')
  })

  it('one-time obligation stays completed even after due date has passed', async () => {
    const id = await insertObligation({
      title: 'Past-due one-time',
      frequency: 'one-time',
      // Past due date (today is 2026-04-11)
      nextDueDate: '2025-01-01',
    })
    // Mark completed on a plausible past date
    await completeIt(id, '2025-01-02')
    const body = await fetchComputed(id)
    expect(body.status).toBe('completed')
  })

  it('event-triggered obligation becomes completed after complete', async () => {
    const id = await insertObligation({
      title: 'Event thing',
      frequency: 'event-triggered',
      nextDueDate: '2027-06-30',
    })
    await completeIt(id)
    const body = await fetchComputed(id)
    expect(body.status).toBe('completed')
  })

  it('annual with autoRecur advances nextDueDate and stays current', async () => {
    const id = await insertObligation({
      title: 'Annual recurring',
      frequency: 'annual',
      nextDueDate: '2026-06-01',
      autoRecur: true,
    })
    await completeIt(id, '2026-05-15')
    const body = await fetchComputed(id)
    // Advanced by one year from baseDate (max of completedDate and nextDueDate)
    expect(body.nextDueDate).toBe('2027-06-01')
    // With new due date in the future, status is current
    expect(body.status).toBe('current')
    expect(body.lastCompletedDate).toBe('2026-05-15')
  })

  it('annual without autoRecur keeps nextDueDate and reflects completed-for-period', async () => {
    const id = await insertObligation({
      title: 'Annual manual',
      frequency: 'annual',
      nextDueDate: '2027-01-15',
      autoRecur: false,
    })
    await completeIt(id, '2026-05-15')
    const body = await fetchComputed(id)
    expect(body.nextDueDate).toBe('2027-01-15')
    // completed + dueDate still in future => 'current' (completed for this period)
    expect(body.status).toBe('current')
  })

  it('quarterly with autoRecur advances nextDueDate by 3 months', async () => {
    const id = await insertObligation({
      title: 'Quarterly recurring',
      frequency: 'quarterly',
      nextDueDate: '2026-07-01',
      autoRecur: true,
    })
    await completeIt(id, '2026-06-15')
    const body = await fetchComputed(id)
    // baseDate = max of '2026-06-15' and '2026-07-01' => '2026-07-01'
    // +3 months => '2026-10-01'
    expect(body.nextDueDate).toBe('2026-10-01')
    expect(body.status).toBe('current')

    // Verify DB directly too
    const rows = await db.select().from(obligations).where(eq(obligations.id, id))
    expect(rows[0].nextDueDate).toBe('2026-10-01')
    expect(rows[0].lastCompletedDate).toBe('2026-06-15')
  })
})
