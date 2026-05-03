import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { dbReady } from '@/db'
import { resetDb, mkReq } from '../integration-helpers'
import { processDueAlerts, sendWeeklyDigest } from '@/lib/alerts'
import { GET as checkAlertsGet, POST as checkAlertsPost } from '@/app/api/cron/check-alerts/route'
import { GET as weeklyDigestGet, POST as weeklyDigestPost } from '@/app/api/cron/weekly-digest/route'

vi.mock('@/lib/alerts', () => ({
  processDueAlerts: vi.fn(),
  sendWeeklyDigest: vi.fn(),
}))

describe('Cron routes', () => {
  let originalCronSecret: string | undefined

  beforeEach(async () => {
    await dbReady
    await resetDb()
    originalCronSecret = process.env.CRON_SECRET
    vi.mocked(processDueAlerts).mockResolvedValue({
      success: true,
      alertsSent: 0,
      details: [],
    })
    vi.mocked(sendWeeklyDigest).mockResolvedValue({
      success: true,
      digest: {
        period: 'May 3 - May 9, 2026',
        overdue: 0,
        dueThisWeek: 0,
        dueNextWeek: 0,
        recipient: 'ops@example.com',
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
  })

  describe('GET /api/cron/check-alerts', () => {
    it('with CRON_SECRET set, missing Authorization header → 401', async () => {
      process.env.CRON_SECRET = 'top-secret'
      const req = mkReq('http://localhost/api/cron/check-alerts')
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(401)
    })

    it('with CRON_SECRET set, wrong token → 401', async () => {
      process.env.CRON_SECRET = 'top-secret'
      const req = mkReq('http://localhost/api/cron/check-alerts', {
        headers: { authorization: 'Bearer wrong' },
      })
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(401)
    })

    it('with CRON_SECRET set, correct token → processes alerts directly', async () => {
      process.env.CRON_SECRET = 'top-secret'
      vi.mocked(processDueAlerts).mockResolvedValue({
        success: true,
        alertsSent: 3,
        details: [{ id: 'obl_1', title: 'Tax filing', daysUntilDue: 7 }],
      })

      const req = mkReq('http://localhost/api/cron/check-alerts', {
        headers: { authorization: 'Bearer top-secret' },
      })
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.timestamp).toBeDefined()
      expect(body.result.alertsSent).toBe(3)
      expect(processDueAlerts).toHaveBeenCalledTimes(1)
    })

    it('with no CRON_SECRET configured, fails closed', async () => {
      delete process.env.CRON_SECRET

      const req = mkReq('http://localhost/api/cron/check-alerts')
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/cron_secret/i)
      expect(processDueAlerts).not.toHaveBeenCalled()
    })

    it('returns 500 when alert processing throws', async () => {
      process.env.CRON_SECRET = 'top-secret'
      vi.mocked(processDueAlerts).mockRejectedValue(new Error('smtp down'))

      const req = mkReq('http://localhost/api/cron/check-alerts', {
        headers: { authorization: 'Bearer top-secret' },
      })
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/cron job failed/i)
      expect(body.details).toMatch(/smtp down/i)
    })

    it('POST handler delegates to GET (manual trigger)', async () => {
      process.env.CRON_SECRET = 'top-secret'

      const req = mkReq('http://localhost/api/cron/check-alerts', {
        method: 'POST',
        headers: { authorization: 'Bearer top-secret' },
      })
      const res = await checkAlertsPost(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })

  describe('GET /api/cron/weekly-digest', () => {
    it('with CRON_SECRET set, missing token → 401', async () => {
      process.env.CRON_SECRET = 'top-secret'
      const req = mkReq('http://localhost/api/cron/weekly-digest')
      const res = await weeklyDigestGet(req)
      expect(res.status).toBe(401)
    })

    it('with CRON_SECRET set, correct token → sends weekly digest directly', async () => {
      process.env.CRON_SECRET = 'top-secret'

      const req = mkReq('http://localhost/api/cron/weekly-digest', {
        headers: { authorization: 'Bearer top-secret' },
      })
      const res = await weeklyDigestGet(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.result.digest.recipient).toBe('ops@example.com')
      expect(sendWeeklyDigest).toHaveBeenCalledTimes(1)
    })

    it('with no CRON_SECRET configured, fails closed', async () => {
      delete process.env.CRON_SECRET

      const req = mkReq('http://localhost/api/cron/weekly-digest')
      const res = await weeklyDigestGet(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/cron_secret/i)
      expect(sendWeeklyDigest).not.toHaveBeenCalled()
    })

    it('returns 500 when weekly digest processing throws', async () => {
      process.env.CRON_SECRET = 'top-secret'
      vi.mocked(sendWeeklyDigest).mockRejectedValue(new Error('digest host unavailable'))

      const req = mkReq('http://localhost/api/cron/weekly-digest', {
        headers: { authorization: 'Bearer top-secret' },
      })
      const res = await weeklyDigestGet(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/cron job failed/i)
      expect(body.details).toMatch(/digest host unavailable/i)
    })

    it('POST handler delegates to GET (manual trigger)', async () => {
      process.env.CRON_SECRET = 'top-secret'

      const req = mkReq('http://localhost/api/cron/weekly-digest', {
        method: 'POST',
        headers: { authorization: 'Bearer top-secret' },
      })
      const res = await weeklyDigestPost(req)
      expect(res.status).toBe(200)
    })
  })
})
