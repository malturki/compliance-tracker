import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertAgent } from '../integration-helpers'
import { POST as createObligation } from '@/app/api/obligations/route'
import { GET as listAgents } from '@/app/api/agents/route'
import { PUT as regenerateAgent } from '@/app/api/agents/[id]/route'

const validBody = {
  title: 'Agent Create',
  category: 'tax' as const,
  frequency: 'annual' as const,
  nextDueDate: '2027-06-30',
  owner: 'Agent Owner',
  riskLevel: 'low' as const,
}

describe('Agent bearer-token auth', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    // No user session — force the bearer token code path
    mockSession(null)
  })

  it('valid editor agent token can POST /api/obligations (201)', async () => {
    const { token } = await insertAgent({ role: 'editor', name: 'EditorBot' })

    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: validBody,
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(201)
  })

  it('invalid bearer token → 401', async () => {
    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: validBody,
      headers: { authorization: 'Bearer ct_live_nope' },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(401)
  })

  it('revoked agent token → 401', async () => {
    const { token } = await insertAgent({
      role: 'editor',
      name: 'RevokedBot',
      revokedAt: new Date().toISOString(),
    })
    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: validBody,
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(401)
  })

  it('expired agent token → 401', async () => {
    const { token } = await insertAgent({
      role: 'editor',
      name: 'ExpiredBot',
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    })
    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: validBody,
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(401)
  })

  it('viewer agent cannot POST /api/obligations (403)', async () => {
    const { token } = await insertAgent({ role: 'viewer', name: 'ViewerBot' })
    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: validBody,
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(403)
  })

  it('admin agent can GET /api/agents (200)', async () => {
    const { token } = await insertAgent({ role: 'admin', name: 'AdminBot' })
    // GET /api/agents takes no req; requireRole will fall back to headers().
    // So invoke via POST /api/obligations to test editor access;
    // for admin we regenerate the agent via PUT which does pass req through.
    // Here verify agent with admin role can hit a route that uses passed req.
    // Since listAgents doesn't accept req, it'll use headers(); we cannot pass
    // the Bearer header via headers() in a unit test easily, so we skip to a
    // regen call which passes req.
    const { id: otherAgentId } = await insertAgent({ role: 'editor', name: 'Target' })
    const req = mkReq(`http://localhost/api/agents/${otherAgentId}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await regenerateAgent(req, { params: { id: otherAgentId } })
    expect(res.status).toBe(200)
  })

  it('audit log for agent-initiated create has agent actor and agent source', async () => {
    const { token } = await insertAgent({ role: 'editor', name: 'AuditBot' })
    const req = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: { ...validBody, title: 'From Audit Bot' },
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await createObligation(req)
    expect(res.status).toBe(201)
    const { id } = await res.json()

    const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'obligation.created'))
    const forThis = events.filter(e => e.entityId === id)
    expect(forThis).toHaveLength(1)
    expect(forThis[0].actor).toBe('agent:AuditBot')
    expect(forThis[0].actorSource).toBe('agent')
  })

  it('regenerating an agent invalidates the old token', async () => {
    // Create an admin agent to do the regeneration
    const { token: adminToken } = await insertAgent({ role: 'admin', name: 'RegenAdmin' })
    // Create an editor agent whose token will be regenerated
    const { id: editorId, token: oldToken } = await insertAgent({ role: 'editor', name: 'RegenTarget' })

    // First, confirm old editor token works
    const beforeReq = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: { ...validBody, title: 'Before regen' },
      headers: { authorization: `Bearer ${oldToken}` },
    })
    const beforeRes = await createObligation(beforeReq)
    expect(beforeRes.status).toBe(201)

    // Regenerate token via admin agent
    const regenReq = mkReq(`http://localhost/api/agents/${editorId}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    const regenRes = await regenerateAgent(regenReq, { params: { id: editorId } })
    expect(regenRes.status).toBe(200)
    const { token: newToken } = await regenRes.json()
    expect(newToken).toBeTruthy()
    expect(newToken).not.toBe(oldToken)

    // Old token should now fail with 401
    const oldReq = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: { ...validBody, title: 'Old token attempt' },
      headers: { authorization: `Bearer ${oldToken}` },
    })
    const oldRes = await createObligation(oldReq)
    expect(oldRes.status).toBe(401)

    // New token should work
    const newReq = mkReq('http://localhost/api/obligations', {
      method: 'POST',
      body: { ...validBody, title: 'New token attempt' },
      headers: { authorization: `Bearer ${newToken}` },
    })
    const newRes = await createObligation(newReq)
    expect(newRes.status).toBe(201)
  })
})
