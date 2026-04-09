import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getActor } from './actor'

const mkReq = (opts: { cookie?: string; auth?: string } = {}) => {
  const headers = new Headers()
  if (opts.cookie) headers.set('cookie', opts.cookie)
  if (opts.auth) headers.set('authorization', opts.auth)
  return new Request('http://localhost/api/test', { headers })
}

describe('getActor', () => {
  const origEnv = { ...process.env }
  beforeEach(() => {
    process.env = { ...origEnv }
  })
  afterEach(() => {
    process.env = origEnv
    vi.unstubAllGlobals()
  })

  it('returns cron actor when Authorization header matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'shh'
    const req = mkReq({ auth: 'Bearer shh' })
    expect(await getActor(req)).toEqual({ email: 'cron', source: 'cron' })
  })

  it('does not match cron on wrong secret', async () => {
    process.env.CRON_SECRET = 'shh'
    process.env.NODE_ENV = 'production'
    const req = mkReq({ auth: 'Bearer wrong' })
    const actor = await getActor(req)
    expect(actor.source).toBe('system')
    expect(actor.email).toBe('system')
  })

  it('returns dev actor in non-production when no JWT and no cron secret', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DEV_ACTOR = 'dev@local'
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'dev@local', source: 'dev' })
  })

  it('returns system when nothing is present in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.CRON_SECRET
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'system', source: 'system' })
  })
})
