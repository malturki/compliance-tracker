import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dbReady } from '@/db'
import { resetDb, mockSession, mkReq } from '../integration-helpers'
import { POST as summarizeAnalytics } from '@/app/api/analytics/summary/route'

vi.hoisted(() => {
  delete process.env.OPENAI_API_KEY
})

const validAnalyticsPayload = {
  overview: {
    totalObligations: 4,
    overdueCount: 1,
    dueThisWeek: 2,
    complianceScore: 82,
    completionRate: 75,
  },
  trends: {
    last30Days: {
      completed: 3,
      overdue: 1,
      completionRate: 75,
    },
  },
  ownerPerformance: [
    { owner: 'Ops', overdue: 1, completionRate: 75 },
  ],
  riskExposure: [
    { riskLevel: 'high', total: 2, overdue: 1 },
  ],
}

describe('POST /api/analytics/summary', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'viewer@test.com', role: 'viewer' })
  })

  it('returns fallback summary when OpenAI is not configured', async () => {
    const req = mkReq('http://localhost/api/analytics/summary', {
      method: 'POST',
      body: validAnalyticsPayload,
    })
    const res = await summarizeAnalytics(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isAI).toBe(false)
    expect(body.summary).toContain('Compliance score: 82/100')
    expect(body.summary).toContain('Ops has 1 overdue items')
  })

  it('rejects malformed analytics payloads', async () => {
    const req = mkReq('http://localhost/api/analytics/summary', {
      method: 'POST',
      body: { overview: { complianceScore: 'high' } },
    })
    const res = await summarizeAnalytics(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid analytics payload')
    expect(body.issues.length).toBeGreaterThan(0)
  })

  it('unauthenticated callers are rejected', async () => {
    mockSession(null)
    const req = mkReq('http://localhost/api/analytics/summary', {
      method: 'POST',
      body: validAnalyticsPayload,
    })
    const res = await summarizeAnalytics(req)
    expect(res.status).toBe(401)
  })
})
