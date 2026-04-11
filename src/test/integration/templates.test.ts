import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations, auditLog } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { resetDb, mockSession, mkReq } from '../integration-helpers'
import { GET as listTemplates, POST as applyTemplate } from '@/app/api/templates/route'
import { GET as getTemplate } from '@/app/api/templates/[id]/route'

const KNOWN_TEMPLATE_ID = 'delaware-c-corp'

describe('Templates API', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  describe('GET /api/templates', () => {
    it('returns the full list with name, description, category, and obligation count', async () => {
      const res = await listTemplates()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.templates)).toBe(true)
      expect(body.templates.length).toBeGreaterThan(0)
      const dela = body.templates.find((t: any) => t.id === KNOWN_TEMPLATE_ID)
      expect(dela).toBeDefined()
      expect(dela.obligationCount).toBeGreaterThan(0)
      expect(typeof dela.name).toBe('string')
    })

    it('viewer can list templates (200)', async () => {
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      const res = await listTemplates()
      expect(res.status).toBe(200)
    })

    it('unauthenticated → 401', async () => {
      mockSession(null)
      const res = await listTemplates()
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/templates/[id]', () => {
    it('returns full template detail with computed previewDueDate per obligation', async () => {
      const req = mkReq(`http://localhost/api/templates/${KNOWN_TEMPLATE_ID}`)
      const res = await getTemplate(req, { params: { id: KNOWN_TEMPLATE_ID } })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(KNOWN_TEMPLATE_ID)
      expect(Array.isArray(body.obligations)).toBe(true)
      expect(body.obligations.length).toBeGreaterThan(0)
      // Each obligation has a YYYY-MM-DD previewDueDate and an index
      for (const obl of body.obligations) {
        expect(obl.previewDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(typeof obl.index).toBe('number')
      }
    })

    it('preview includes counterparty for entries that have one', async () => {
      const req = mkReq(`http://localhost/api/templates/${KNOWN_TEMPLATE_ID}`)
      const res = await getTemplate(req, { params: { id: KNOWN_TEMPLATE_ID } })
      const body = await res.json()
      const franchiseTax = body.obligations.find((o: any) => o.title === 'Delaware Franchise Tax')
      expect(franchiseTax).toBeDefined()
      expect(franchiseTax.counterparty).toBe('Delaware Division of Corporations')
    })

    it('returns 404 for unknown template id', async () => {
      const req = mkReq('http://localhost/api/templates/not-real')
      const res = await getTemplate(req, { params: { id: 'not-real' } })
      expect(res.status).toBe(404)
    })

    it('viewer can fetch template detail (200)', async () => {
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      const req = mkReq(`http://localhost/api/templates/${KNOWN_TEMPLATE_ID}`)
      const res = await getTemplate(req, { params: { id: KNOWN_TEMPLATE_ID } })
      expect(res.status).toBe(200)
    })

    it('unauthenticated → 401', async () => {
      mockSession(null)
      const req = mkReq(`http://localhost/api/templates/${KNOWN_TEMPLATE_ID}`)
      const res = await getTemplate(req, { params: { id: KNOWN_TEMPLATE_ID } })
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/templates (apply)', () => {
    it('admin can apply a full template, creating one obligation per entry', async () => {
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: { templateId: KNOWN_TEMPLATE_ID },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.count).toBeGreaterThan(0)
      expect(Array.isArray(body.obligationIds)).toBe(true)
      expect(body.obligationIds.length).toBe(body.count)

      const rows = await db.select().from(obligations).where(inArray(obligations.id, body.obligationIds))
      expect(rows).toHaveLength(body.count)
      // templateId is recorded on each row
      expect(rows.every(r => r.templateId === KNOWN_TEMPLATE_ID)).toBe(true)
    })

    it('applies counterparty from the template fixtures onto created obligations', async () => {
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: { templateId: KNOWN_TEMPLATE_ID },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(200)
      const body = await res.json()

      const rows = await db.select().from(obligations).where(inArray(obligations.id, body.obligationIds))
      const franchiseTax = rows.find(r => r.title === 'Delaware Franchise Tax')
      expect(franchiseTax).toBeDefined()
      expect(franchiseTax!.counterparty).toBe('Delaware Division of Corporations')

      // Internal obligation (Annual Stockholder Meeting) has no counterparty
      const stockholders = rows.find(r => r.title === 'Annual Stockholder Meeting')
      expect(stockholders).toBeDefined()
      expect(stockholders!.counterparty).toBeNull()
    })

    it('respects selectedObligationIndexes customization', async () => {
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: {
          templateId: KNOWN_TEMPLATE_ID,
          customizations: { selectedObligationIndexes: [0, 1] },
        },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.count).toBe(2)
    })

    it('respects custom owner override', async () => {
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: {
          templateId: KNOWN_TEMPLATE_ID,
          customizations: { owner: 'Custom Owner' },
        },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(200)
      const body = await res.json()

      const rows = await db.select().from(obligations).where(inArray(obligations.id, body.obligationIds))
      expect(rows.every(r => r.owner === 'Custom Owner')).toBe(true)
    })

    it('writes a single template.applied audit event with all created ids', async () => {
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: { templateId: KNOWN_TEMPLATE_ID },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(200)
      const body = await res.json()

      const events = await db.select().from(auditLog).where(eq(auditLog.eventType, 'template.applied'))
      expect(events).toHaveLength(1)
      expect(events[0].entityId).toBe(KNOWN_TEMPLATE_ID)
      const metadata = JSON.parse(events[0].metadata || '{}')
      expect(metadata.templateId).toBe(KNOWN_TEMPLATE_ID)
      expect(metadata.count).toBe(body.count)
      expect(metadata.createdIds).toEqual(body.obligationIds)
    })

    it('rejects request without templateId (400)', async () => {
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: {},
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(400)
    })

    it('returns 404 for unknown templateId', async () => {
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: { templateId: 'not-real' },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(404)
    })

    it('viewer cannot apply templates (403)', async () => {
      mockSession({ email: 'viewer@test.com', role: 'viewer' })
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: { templateId: KNOWN_TEMPLATE_ID },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(403)
    })

    it('editor CAN apply templates (200)', async () => {
      mockSession({ email: 'editor@test.com', role: 'editor' })
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: { templateId: KNOWN_TEMPLATE_ID },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(200)
    })

    it('unauthenticated → 401', async () => {
      mockSession(null)
      const req = mkReq('http://localhost/api/templates', {
        method: 'POST',
        body: { templateId: KNOWN_TEMPLATE_ID },
      })
      const res = await applyTemplate(req)
      expect(res.status).toBe(401)
    })
  })
})
