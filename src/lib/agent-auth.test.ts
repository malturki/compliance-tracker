import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { agents } from '@/db/schema'
import { verifyAgentToken } from './agent-auth'
import { generateToken, hashToken } from './token-utils'
import { ulid } from 'ulid'

async function seedAgent(overrides: Partial<{
  role: string
  token: string
  expiresAt: string
  revokedAt: string | null
}> = {}) {
  const token = overrides.token ?? generateToken()
  const now = new Date().toISOString()
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 86_400_000).toISOString()
  const id = ulid()
  await db.insert(agents).values({
    id,
    name: 'TestAgent',
    description: null,
    role: overrides.role ?? 'editor',
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, 15),
    createdBy: 'admin@test',
    createdAt: now,
    expiresAt,
    lastUsedAt: null,
    revokedAt: overrides.revokedAt ?? null,
  })
  return { id, token }
}

describe('verifyAgentToken', () => {
  beforeEach(async () => {
    await dbReady
    await db.delete(agents)
  })

  it('returns null for tokens without the ct_live_ prefix', async () => {
    expect(await verifyAgentToken('bearer_foo')).toBeNull()
  })

  it('returns null for unknown tokens', async () => {
    expect(await verifyAgentToken('ct_live_notreal')).toBeNull()
  })

  it('returns the agent actor for a valid token', async () => {
    const { id, token } = await seedAgent({ role: 'editor' })
    const actor = await verifyAgentToken(token)
    expect(actor).toEqual({
      type: 'agent',
      agentId: id,
      name: 'TestAgent',
      role: 'editor',
    })
  })

  it('returns null for an expired token', async () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString()
    const { token } = await seedAgent({ expiresAt: pastDate })
    expect(await verifyAgentToken(token)).toBeNull()
  })

  it('returns null for a revoked token', async () => {
    const { token } = await seedAgent({ revokedAt: new Date().toISOString() })
    expect(await verifyAgentToken(token)).toBeNull()
  })
})
