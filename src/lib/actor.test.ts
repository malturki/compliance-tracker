import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('./auth', () => ({
  auth: vi.fn(),
}))

import { getActor } from './actor'
import { auth } from './auth'

const mkReq = (opts: { auth?: string } = {}) => {
  const headers = new Headers()
  if (opts.auth) headers.set('authorization', opts.auth)
  return new Request('http://localhost/api/test', { headers })
}

describe('getActor', () => {
  const origEnv = { ...process.env }
  beforeEach(() => {
    process.env = { ...origEnv }
    vi.mocked(auth).mockResolvedValue(null as any)
  })
  afterEach(() => {
    process.env = origEnv
  })

  it('returns sso actor when NextAuth session exists', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: '1', email: 'alice@acme.com', role: 'admin' },
      expires: '',
    } as any)
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'alice@acme.com', source: 'sso' })
  })

  it('returns cron actor when Authorization matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'shh'
    const actor = await getActor(mkReq({ auth: 'Bearer shh' }))
    expect(actor).toEqual({ email: 'cron', source: 'cron' })
  })

  it('does not match cron on wrong secret', async () => {
    process.env.CRON_SECRET = 'shh'
    process.env.NODE_ENV = 'production'
    const actor = await getActor(mkReq({ auth: 'Bearer wrong' }))
    expect(actor).toEqual({ email: 'system', source: 'system' })
  })

  it('returns dev actor in non-production when no session', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DEV_ACTOR = 'dev@local'
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'dev@local', source: 'dev' })
  })

  it('returns system when nothing present in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.CRON_SECRET
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'system', source: 'system' })
  })
})
