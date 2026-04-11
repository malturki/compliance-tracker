import { describe, it, expect, beforeEach } from 'vitest'
import { dbReady } from '@/db'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { POST as completeObligation } from '@/app/api/obligations/[id]/complete/route'
import { GET as getStats } from '@/app/api/stats/route'
import { GET as getAnalytics } from '@/app/api/analytics/route'

// Today is 2026-04-11 per the test session date.
const TODAY = '2026-04-11'

async function complete(id: string, date: string) {
  const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
    method: 'POST',
    body: { completedBy: 'Tester', completedDate: date },
  })
  const res = await completeObligation(req, { params: { id } })
  expect(res.status).toBe(201)
}

describe('GET /api/stats', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  it('returns zeros when there are no obligations', async () => {
    const res = await getStats()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.overdue).toBe(0)
    expect(body.dueThisWeek).toBe(0)
    expect(body.dueThisMonth).toBe(0)
    expect(body.byCategory).toEqual({})
    expect(body.byRisk).toEqual({ critical: 0, high: 0, medium: 0, low: 0 })
  })

  it('counts total, overdue, and risk distribution from inserted rows', async () => {
    await insertObligation({ title: 'Past', nextDueDate: '2025-01-01', riskLevel: 'critical', category: 'tax' })
    await insertObligation({ title: 'Future', nextDueDate: '2027-12-31', riskLevel: 'medium', category: 'tax' })
    await insertObligation({ title: 'High', nextDueDate: '2027-12-31', riskLevel: 'high', category: 'vendor' })

    const res = await getStats()
    const body = await res.json()
    expect(body.total).toBe(3)
    expect(body.overdue).toBe(1)
    expect(body.byRisk).toEqual({ critical: 1, high: 1, medium: 1, low: 0 })
    expect(body.byCategory.tax.total).toBe(2)
    expect(body.byCategory.tax.overdue).toBe(1)
    expect(body.byCategory.vendor.total).toBe(1)
    expect(body.byCategory.vendor.overdue).toBe(0)
  })

  it('counts dueThisWeek for an obligation due in 3 days', async () => {
    // Today = 2026-04-11; +3 days = 2026-04-14
    await insertObligation({ title: 'Soon', nextDueDate: '2026-04-14' })
    const res = await getStats()
    const body = await res.json()
    expect(body.dueThisWeek).toBeGreaterThanOrEqual(1)
    expect(body.dueThisMonth).toBeGreaterThanOrEqual(1)
  })

  it('viewer can read stats (200)', async () => {
    mockSession({ email: 'viewer@test.com', role: 'viewer' })
    const res = await getStats()
    expect(res.status).toBe(200)
  })

  it('unauthenticated → 401', async () => {
    mockSession(null)
    const res = await getStats()
    expect(res.status).toBe(401)
  })
})

describe('GET /api/analytics', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  it('returns the full shape with sane defaults when DB is empty', async () => {
    const res = await getAnalytics()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.overview).toEqual({
      totalObligations: 0,
      overdueCount: 0,
      dueThisWeek: 0,
      complianceScore: expect.any(Number),
      completionRate: 100,
    })
    expect(body.trends).toHaveProperty('last30Days')
    expect(body.trends).toHaveProperty('last60Days')
    expect(body.trends).toHaveProperty('last90Days')
    expect(Array.isArray(body.categoryPerformance)).toBe(true)
    expect(Array.isArray(body.ownerPerformance)).toBe(true)
    expect(Array.isArray(body.riskExposure)).toBe(true)
  })

  it('overview reflects inserted rows', async () => {
    await insertObligation({ title: 'A', nextDueDate: '2025-01-01' }) // overdue
    await insertObligation({ title: 'B', nextDueDate: '2026-04-13' }) // within week
    await insertObligation({ title: 'C', nextDueDate: '2027-01-01' }) // far future

    const res = await getAnalytics()
    const body = await res.json()
    expect(body.overview.totalObligations).toBe(3)
    expect(body.overview.overdueCount).toBe(1)
    expect(body.overview.dueThisWeek).toBeGreaterThanOrEqual(1)
  })

  it('on-time completion contributes to last30Days trend', async () => {
    const id = await insertObligation({
      title: 'On time',
      frequency: 'one-time',
      nextDueDate: '2026-05-01',
    })
    // Complete BEFORE the due date — counts as on-time
    await complete(id, '2026-04-01')

    const res = await getAnalytics()
    const body = await res.json()
    expect(body.trends.last30Days.total).toBeGreaterThanOrEqual(1)
    expect(body.trends.last30Days.completed).toBeGreaterThanOrEqual(1)
  })

  it('categoryPerformance lists each category with totals', async () => {
    await insertObligation({ title: 'Tax 1', category: 'tax', nextDueDate: '2027-01-01' })
    await insertObligation({ title: 'Tax 2', category: 'tax', nextDueDate: '2027-02-01' })
    await insertObligation({ title: 'Vendor 1', category: 'vendor', nextDueDate: '2027-03-01' })

    const res = await getAnalytics()
    const body = await res.json()
    const categories = body.categoryPerformance.map((c: any) => c.category)
    expect(categories).toContain('tax')
    expect(categories).toContain('vendor')
    const tax = body.categoryPerformance.find((c: any) => c.category === 'tax')
    expect(tax.total).toBe(2)
    const vendor = body.categoryPerformance.find((c: any) => c.category === 'vendor')
    expect(vendor.total).toBe(1)
  })

  it('ownerPerformance lists each owner with overdue counts', async () => {
    await insertObligation({ title: 'Alice 1', owner: 'Alice', nextDueDate: '2025-01-01' }) // overdue
    await insertObligation({ title: 'Alice 2', owner: 'Alice', nextDueDate: '2027-01-01' })
    await insertObligation({ title: 'Bob 1', owner: 'Bob', nextDueDate: '2027-01-01' })

    const res = await getAnalytics()
    const body = await res.json()
    const owners = body.ownerPerformance.map((o: any) => o.owner)
    expect(owners).toContain('Alice')
    expect(owners).toContain('Bob')
    const alice = body.ownerPerformance.find((o: any) => o.owner === 'Alice')
    expect(alice.total).toBe(2)
    expect(alice.overdue).toBe(1)
  })

  it('riskExposure shows non-empty risk levels with percentages', async () => {
    await insertObligation({ title: 'Crit', riskLevel: 'critical', nextDueDate: '2027-01-01' })
    await insertObligation({ title: 'Med 1', riskLevel: 'medium', nextDueDate: '2027-01-01' })
    await insertObligation({ title: 'Med 2', riskLevel: 'medium', nextDueDate: '2027-01-01' })

    const res = await getAnalytics()
    const body = await res.json()
    const levels = body.riskExposure.map((r: any) => r.riskLevel)
    expect(levels).toContain('critical')
    expect(levels).toContain('medium')
    const medium = body.riskExposure.find((r: any) => r.riskLevel === 'medium')
    expect(medium.total).toBe(2)
    expect(medium.percentage).toBe(67) // 2 of 3
    // 'low' should not appear because it has no rows
    expect(levels).not.toContain('low')
  })

  it('viewer can read analytics (200)', async () => {
    mockSession({ email: 'viewer@test.com', role: 'viewer' })
    const res = await getAnalytics()
    expect(res.status).toBe(200)
  })

  it('unauthenticated → 401', async () => {
    mockSession(null)
    const res = await getAnalytics()
    expect(res.status).toBe(401)
  })
})
