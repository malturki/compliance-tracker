import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { dbReady } from '@/db'
import { resetDb, mkReq } from '../integration-helpers'
import { GET as checkAlertsGet, POST as checkAlertsPost } from '@/app/api/cron/check-alerts/route'
import { GET as weeklyDigestGet, POST as weeklyDigestPost } from '@/app/api/cron/weekly-digest/route'

// The cron routes are thin wrappers that verify CRON_SECRET, then fetch()
// internal /api/alerts and /api/alerts/digest endpoints. We mock global.fetch
// so the tests don't depend on a running server or real SMTP.

describe('Cron routes', () => {
  let originalFetch: typeof globalThis.fetch
  let originalCronSecret: string | undefined

  beforeEach(async () => {
    await dbReady
    await resetDb()
    originalFetch = globalThis.fetch
    originalCronSecret = process.env.CRON_SECRET
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
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

    it('with CRON_SECRET set, correct token → calls /api/alerts and returns success', async () => {
      process.env.CRON_SECRET = 'top-secret'
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ sent: 3 }), { status: 200 }),
      ) as any

      const req = mkReq('http://localhost/api/cron/check-alerts', {
        headers: { authorization: 'Bearer top-secret' },
      })
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.timestamp).toBeDefined()
      expect(body.result).toEqual({ sent: 3 })
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      const call = (globalThis.fetch as any).mock.calls[0]
      expect(call[0]).toMatch(/\/api\/alerts$/)
      expect(call[1].method).toBe('POST')
    })

    it('with no CRON_SECRET configured, request without auth header is allowed', async () => {
      delete process.env.CRON_SECRET
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ sent: 0 }), { status: 200 }),
      ) as any

      const req = mkReq('http://localhost/api/cron/check-alerts')
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(200)
    })

    it('returns 500 when downstream /api/alerts fails', async () => {
      delete process.env.CRON_SECRET
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'smtp down' }), { status: 500 }),
      ) as any

      const req = mkReq('http://localhost/api/cron/check-alerts')
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/alert check failed/i)
      expect(body.details).toEqual({ error: 'smtp down' })
    })

    it('returns 500 when fetch itself throws (network error)', async () => {
      delete process.env.CRON_SECRET
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('connection refused')) as any

      const req = mkReq('http://localhost/api/cron/check-alerts')
      const res = await checkAlertsGet(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/cron job failed/i)
      expect(body.details).toMatch(/connection refused/i)
    })

    it('POST handler delegates to GET (manual trigger)', async () => {
      delete process.env.CRON_SECRET
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ sent: 1 }), { status: 200 }),
      ) as any

      const req = mkReq('http://localhost/api/cron/check-alerts', { method: 'POST' })
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

    it('with CRON_SECRET set, correct token → calls /api/alerts/digest', async () => {
      process.env.CRON_SECRET = 'top-secret'
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ sentDigests: 1 }), { status: 200 }),
      ) as any

      const req = mkReq('http://localhost/api/cron/weekly-digest', {
        headers: { authorization: 'Bearer top-secret' },
      })
      const res = await weeklyDigestGet(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.result).toEqual({ sentDigests: 1 })
      const call = (globalThis.fetch as any).mock.calls[0]
      expect(call[0]).toMatch(/\/api\/alerts\/digest$/)
      expect(call[1].method).toBe('POST')
    })

    it('returns 500 when downstream digest fails', async () => {
      delete process.env.CRON_SECRET
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'no recipients' }), { status: 500 }),
      ) as any

      const req = mkReq('http://localhost/api/cron/weekly-digest')
      const res = await weeklyDigestGet(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toMatch(/digest generation failed/i)
    })

    it('POST handler delegates to GET (manual trigger)', async () => {
      delete process.env.CRON_SECRET
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ sentDigests: 0 }), { status: 200 }),
      ) as any

      const req = mkReq('http://localhost/api/cron/weekly-digest', { method: 'POST' })
      const res = await weeklyDigestPost(req)
      expect(res.status).toBe(200)
    })
  })
})
