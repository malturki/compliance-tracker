import { describe, it, expect, beforeEach } from 'vitest'
import { dbReady } from '@/db'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import {
  GET as listObligations,
  POST as createObligation,
  DELETE as bulkDeleteObligations,
} from '@/app/api/obligations/route'
import {
  GET as getObligation,
  PUT as updateObligation,
  DELETE as deleteObligation,
} from '@/app/api/obligations/[id]/route'
import { POST as completeObligation } from '@/app/api/obligations/[id]/complete/route'
import { POST as bulkAction } from '@/app/api/obligations/bulk/route'
import { GET as listUsers } from '@/app/api/users/route'
import { GET as listAgents } from '@/app/api/agents/route'
import { GET as listCounterparties } from '@/app/api/counterparties/route'
import {
  GET as listPlaybooks,
  POST as applyPlaybook,
} from '@/app/api/playbooks/route'
import { GET as getPlaybookDetail } from '@/app/api/playbooks/[id]/route'
import { GET as listSubObligations } from '@/app/api/obligations/[id]/sub-obligations/route'

describe('Role enforcement', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
  })

  describe('Viewer role', () => {
    beforeEach(() => {
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
    })

    it('can GET /api/obligations', async () => {
      const res = await listObligations(mkReq('http://localhost/api/obligations'))
      expect(res.status).toBe(200)
    })

    it('cannot POST /api/obligations (403)', async () => {
      const req = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Nope',
          category: 'tax',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Test',
          riskLevel: 'low',
        },
      })
      const res = await createObligation(req)
      expect(res.status).toBe(403)
    })

    it('cannot PUT /api/obligations/[id] (403)', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const id = await insertObligation({ title: 'Seeded' })
      mockSession({ email: 'viewer@test.com', role: 'viewer' })

      const req = mkReq(`http://localhost/api/obligations/${id}`, {
        method: 'PUT',
        body: { owner: 'Changed' },
      })
      const res = await updateObligation(req, { params: { id } })
      expect(res.status).toBe(403)
    })

    it('cannot DELETE /api/obligations/[id] (403)', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const id = await insertObligation({ title: 'Seeded' })
      mockSession({ email: 'viewer@test.com', role: 'viewer' })

      const req = mkReq(`http://localhost/api/obligations/${id}`, { method: 'DELETE' })
      const res = await deleteObligation(req, { params: { id } })
      expect(res.status).toBe(403)
    })

    it('cannot POST /api/obligations/[id]/complete (403)', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const id = await insertObligation({ title: 'Seeded' })
      mockSession({ email: 'viewer@test.com', role: 'viewer' })

      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-04-01' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(403)
    })

    it('cannot POST /api/obligations/bulk (403)', async () => {
      const req = mkReq('http://localhost/api/obligations/bulk', {
        method: 'POST',
        body: { action: 'update-owner', ids: ['id1'], data: { owner: 'Nope' } },
      })
      const res = await bulkAction(req)
      expect(res.status).toBe(403)
    })

    it('cannot DELETE /api/obligations bulk (403)', async () => {
      const req = mkReq('http://localhost/api/obligations', {
        method: 'DELETE',
        body: { ids: ['id1'] },
      })
      const res = await bulkDeleteObligations(req)
      expect(res.status).toBe(403)
    })

    it('CAN GET /api/users (opened for owner dropdown)', async () => {
      const res = await listUsers()
      expect(res.status).toBe(200)
    })

    it('cannot GET /api/agents (admin only, 403)', async () => {
      const res = await listAgents()
      expect(res.status).toBe(403)
    })

    it('CAN GET /api/counterparties (viewer-readable)', async () => {
      const res = await listCounterparties()
      expect(res.status).toBe(200)
    })

    it('cannot GET /api/playbooks (editor+, 403)', async () => {
      const res = await listPlaybooks(mkReq('http://localhost/api/playbooks'))
      expect(res.status).toBe(403)
    })

    it('cannot GET /api/playbooks/[id] (editor+, 403)', async () => {
      const res = await getPlaybookDetail(
        mkReq('http://localhost/api/playbooks/quarterly-investor-report'),
        { params: { id: 'quarterly-investor-report' } },
      )
      expect(res.status).toBe(403)
    })

    it('cannot POST /api/playbooks (editor+, 403)', async () => {
      const req = mkReq('http://localhost/api/playbooks', {
        method: 'POST',
        body: {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme',
        },
      })
      const res = await applyPlaybook(req)
      expect(res.status).toBe(403)
    })

    it('CAN GET /api/obligations/[id]/sub-obligations (viewer-readable)', async () => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
      const id = await insertObligation({ title: 'Parent' })
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      const res = await listSubObligations(
        mkReq(`http://localhost/api/obligations/${id}/sub-obligations`),
        { params: { id } },
      )
      expect(res.status).toBe(200)
    })
  })

  describe('Editor role', () => {
    beforeEach(() => {
      mockSession({ email: 'editor@test.com', role: 'editor' })
    })

    it('can GET /api/obligations', async () => {
      const res = await listObligations(mkReq('http://localhost/api/obligations'))
      expect(res.status).toBe(200)
    })

    it('can POST /api/obligations (201)', async () => {
      const req = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Editor Create',
          category: 'tax',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Test',
          riskLevel: 'low',
        },
      })
      const res = await createObligation(req)
      expect(res.status).toBe(201)
    })

    it('can PUT /api/obligations/[id] (200)', async () => {
      const id = await insertObligation({ title: 'Seeded' })
      const req = mkReq(`http://localhost/api/obligations/${id}`, {
        method: 'PUT',
        body: { owner: 'Editor-Updated' },
      })
      const res = await updateObligation(req, { params: { id } })
      expect(res.status).toBe(200)
    })

    it('can DELETE /api/obligations/[id] (200)', async () => {
      const id = await insertObligation({ title: 'Seeded' })
      const req = mkReq(`http://localhost/api/obligations/${id}`, { method: 'DELETE' })
      const res = await deleteObligation(req, { params: { id } })
      expect(res.status).toBe(200)
    })

    it('can POST /api/obligations/[id]/complete (201)', async () => {
      const id = await insertObligation({ title: 'Seeded' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-04-01' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)
    })

    it('can GET /api/users (200 — opened to editors)', async () => {
      const res = await listUsers()
      expect(res.status).toBe(200)
    })

    it('cannot GET /api/agents (admin only, 403)', async () => {
      const res = await listAgents()
      expect(res.status).toBe(403)
    })

    it('can GET /api/playbooks (200)', async () => {
      const res = await listPlaybooks(mkReq('http://localhost/api/playbooks'))
      expect(res.status).toBe(200)
    })

    it('can POST /api/playbooks (201)', async () => {
      const req = mkReq('http://localhost/api/playbooks', {
        method: 'POST',
        body: {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme Capital LP',
        },
      })
      const res = await applyPlaybook(req)
      expect(res.status).toBe(201)
    })
  })

  describe('Admin role', () => {
    beforeEach(() => {
      mockSession({ email: 'admin@test.com', role: 'admin' })
    })

    it('can GET /api/agents (200)', async () => {
      const res = await listAgents()
      expect(res.status).toBe(200)
    })

    it('can GET /api/users (200)', async () => {
      const res = await listUsers()
      expect(res.status).toBe(200)
    })
  })

  describe('Unauthenticated', () => {
    beforeEach(() => {
      mockSession(null)
    })

    it('GET /api/obligations → 401', async () => {
      const res = await listObligations(mkReq('http://localhost/api/obligations'))
      expect(res.status).toBe(401)
    })

    it('POST /api/obligations → 401', async () => {
      const req = mkReq('http://localhost/api/obligations', {
        method: 'POST',
        body: {
          title: 'Nope',
          category: 'tax',
          frequency: 'annual',
          nextDueDate: '2027-06-30',
          owner: 'Test',
          riskLevel: 'low',
        },
      })
      const res = await createObligation(req)
      expect(res.status).toBe(401)
    })

    it('GET /api/users → 401', async () => {
      const res = await listUsers()
      expect(res.status).toBe(401)
    })

    it('GET /api/agents → 401', async () => {
      const res = await listAgents()
      expect(res.status).toBe(401)
    })

    it('GET /api/counterparties → 401', async () => {
      const res = await listCounterparties()
      expect(res.status).toBe(401)
    })
  })
})
