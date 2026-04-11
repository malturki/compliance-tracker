import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { agents, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertAgent } from '../integration-helpers'
import { GET as listAgents, POST as createAgent } from '@/app/api/agents/route'
import { PUT as regenerateAgent, DELETE as revokeAgent } from '@/app/api/agents/[id]/route'
import { POST as createObligation } from '@/app/api/obligations/route'

const validCreateBody = {
  name: 'NewBot',
  description: 'a test bot',
  role: 'editor',
  expiresInDays: 30,
}

describe('Agent management (admin CRUD via session)', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
  })

  describe('POST /api/agents', () => {
    it('admin can create an agent and gets the raw token back', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq('http://localhost/api/agents', {
        method: 'POST',
        body: validCreateBody,
      })
      const res = await createAgent(req)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.id).toBeDefined()
      expect(typeof body.token).toBe('string')
      expect(body.token).toMatch(/^ct_live_/)
      expect(body.expiresAt).toBeDefined()

      // Row exists with correct role
      const rows = await db.select().from(agents).where(eq(agents.id, body.id))
      expect(rows).toHaveLength(1)
      expect(rows[0].name).toBe('NewBot')
      expect(rows[0].role).toBe('editor')
      expect(rows[0].createdBy).toBe('admin@test.com')
      expect(rows[0].revokedAt).toBeNull()
    })

    it('admin can create an agent at any role (viewer/editor/admin)', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      for (const role of ['viewer', 'editor', 'admin'] as const) {
        const req = mkReq('http://localhost/api/agents', {
          method: 'POST',
          body: { ...validCreateBody, name: `Bot-${role}`, role },
        })
        const res = await createAgent(req)
        expect(res.status).toBe(201)
      }
      const all = await db.select().from(agents)
      expect(all).toHaveLength(3)
    })

    it('writes an agent.created audit event with the agent id', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq('http://localhost/api/agents', {
        method: 'POST',
        body: { ...validCreateBody, name: 'AuditedBot' },
      })
      const res = await createAgent(req)
      expect(res.status).toBe(201)
      const { id } = await res.json()

      const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'agent.created'))
      const forThis = events.filter(e => e.entityId === id)
      expect(forThis).toHaveLength(1)
      expect(forThis[0].actor).toBe('admin@test.com')
      expect(forThis[0].actorSource).toBe('sso')
      expect(forThis[0].summary).toMatch(/AuditedBot/)
    })

    it('editor → 403', async () => {
      mockSession({ email: 'editor@test.com', role: 'editor' })
      const req = mkReq('http://localhost/api/agents', {
        method: 'POST',
        body: validCreateBody,
      })
      const res = await createAgent(req)
      expect(res.status).toBe(403)
      const all = await db.select().from(agents)
      expect(all).toHaveLength(0)
    })

    it('viewer → 403', async () => {
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      const req = mkReq('http://localhost/api/agents', {
        method: 'POST',
        body: validCreateBody,
      })
      const res = await createAgent(req)
      expect(res.status).toBe(403)
    })

    it('unauthenticated → 401', async () => {
      mockSession(null)
      const req = mkReq('http://localhost/api/agents', {
        method: 'POST',
        body: validCreateBody,
      })
      const res = await createAgent(req)
      expect(res.status).toBe(401)
    })

    it('rejects missing name (400)', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq('http://localhost/api/agents', {
        method: 'POST',
        body: { ...validCreateBody, name: '' },
      })
      const res = await createAgent(req)
      expect(res.status).toBe(400)
    })

    it('rejects invalid role (400)', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq('http://localhost/api/agents', {
        method: 'POST',
        body: { ...validCreateBody, role: 'superadmin' },
      })
      const res = await createAgent(req)
      expect(res.status).toBe(400)
    })

    it('rejects out-of-range expiresInDays (400)', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq('http://localhost/api/agents', {
        method: 'POST',
        body: { ...validCreateBody, expiresInDays: 5000 },
      })
      const res = await createAgent(req)
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/agents/[id] (revoke)', () => {
    it('admin can revoke; subsequent calls with that token return 401', async () => {
      const { id, token } = await insertAgent({ role: 'editor', name: 'ToRevoke' })

      // Confirm token works first
      mockSession(null)
      const beforeReq = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Pre-revoke',
          category: 'tax',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Owner',
          riskLevel: 'low',
        },
        headers: { authorization: `Bearer ${token}` },
      })
      const beforeRes = await createObligation(beforeReq)
      expect(beforeRes.status).toBe(201)

      // Revoke as admin user (session auth)
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const revokeReq = mkReq(`http://localhost/api/agents/${id}`, { method: 'DELETE' })
      const revokeRes = await revokeAgent(revokeReq, { params: { id } })
      expect(revokeRes.status).toBe(200)

      // Revoked column set
      const rows = await db.select().from(agents).where(eq(agents.id, id))
      expect(rows[0].revokedAt).not.toBeNull()

      // Old token now 401
      mockSession(null)
      const afterReq = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Post-revoke',
          category: 'tax',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Owner',
          riskLevel: 'low',
        },
        headers: { authorization: `Bearer ${token}` },
      })
      const afterRes = await createObligation(afterReq)
      expect(afterRes.status).toBe(401)
    })

    it('writes an agent.revoked audit event', async () => {
      const { id } = await insertAgent({ role: 'editor', name: 'AuditRevoke' })
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq(`http://localhost/api/agents/${id}`, { method: 'DELETE' })
      const res = await revokeAgent(req, { params: { id } })
      expect(res.status).toBe(200)

      const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'agent.revoked'))
      const forThis = events.filter(e => e.entityId === id)
      expect(forThis).toHaveLength(1)
      expect(forThis[0].actor).toBe('admin@test.com')
      expect(forThis[0].summary).toMatch(/AuditRevoke/)
    })

    it('revoking an already-revoked agent is idempotent (200)', async () => {
      const { id } = await insertAgent({
        role: 'editor',
        name: 'AlreadyRevoked',
        revokedAt: new Date().toISOString(),
      })
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq(`http://localhost/api/agents/${id}`, { method: 'DELETE' })
      const res = await revokeAgent(req, { params: { id } })
      expect(res.status).toBe(200)
    })

    it('revoking a non-existent agent → 404', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq('http://localhost/api/agents/nope', { method: 'DELETE' })
      const res = await revokeAgent(req, { params: { id: 'nope' } })
      expect(res.status).toBe(404)
    })

    it('editor → 403', async () => {
      const { id } = await insertAgent({ role: 'editor', name: 'Target' })
      mockSession({ email: 'editor@test.com', role: 'editor' })
      const req = mkReq(`http://localhost/api/agents/${id}`, { method: 'DELETE' })
      const res = await revokeAgent(req, { params: { id } })
      expect(res.status).toBe(403)

      // Still not revoked
      const rows = await db.select().from(agents).where(eq(agents.id, id))
      expect(rows[0].revokedAt).toBeNull()
    })

    it('viewer → 403', async () => {
      const { id } = await insertAgent({ role: 'editor', name: 'Target' })
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      const req = mkReq(`http://localhost/api/agents/${id}`, { method: 'DELETE' })
      const res = await revokeAgent(req, { params: { id } })
      expect(res.status).toBe(403)
    })

    it('unauthenticated → 401', async () => {
      const { id } = await insertAgent({ role: 'editor', name: 'Target' })
      mockSession(null)
      const req = mkReq(`http://localhost/api/agents/${id}`, { method: 'DELETE' })
      const res = await revokeAgent(req, { params: { id } })
      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/agents/[id] (regenerate) — non-admin denied', () => {
    it('editor → 403, token unchanged', async () => {
      const { id, token: oldToken } = await insertAgent({ role: 'editor', name: 'Target' })
      mockSession({ email: 'editor@test.com', role: 'editor' })
      const req = mkReq(`http://localhost/api/agents/${id}`, { method: 'PUT' })
      const res = await regenerateAgent(req, { params: { id } })
      expect(res.status).toBe(403)

      // Old token still works
      mockSession(null)
      const useReq = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Still-works',
          category: 'tax',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Owner',
          riskLevel: 'low',
        },
        headers: { authorization: `Bearer ${oldToken}` },
      })
      const useRes = await createObligation(useReq)
      expect(useRes.status).toBe(201)
    })

    it('viewer → 403', async () => {
      const { id } = await insertAgent({ role: 'editor', name: 'Target' })
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      const req = mkReq(`http://localhost/api/agents/${id}`, { method: 'PUT' })
      const res = await regenerateAgent(req, { params: { id } })
      expect(res.status).toBe(403)
    })

    it('cannot regenerate a revoked agent (400)', async () => {
      const { id } = await insertAgent({
        role: 'editor',
        name: 'Revoked',
        revokedAt: new Date().toISOString(),
      })
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const req = mkReq(`http://localhost/api/agents/${id}`, { method: 'PUT' })
      const res = await regenerateAgent(req, { params: { id } })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/agents — list visibility', () => {
    it('admin sees all agents including revoked', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      await insertAgent({ name: 'Active', role: 'editor' })
      await insertAgent({
        name: 'Revoked',
        role: 'editor',
        revokedAt: new Date().toISOString(),
      })
      const res = await listAgents()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.agents).toHaveLength(2)
    })
  })
})
