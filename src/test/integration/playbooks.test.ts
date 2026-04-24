import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { GET as listPlaybooks, POST as applyPlaybook } from '@/app/api/playbooks/route'
import { GET as detailPlaybook } from '@/app/api/playbooks/[id]/route'
import { GET as listSubObligations } from '@/app/api/obligations/[id]/sub-obligations/route'
import { POST as completeObligation } from '@/app/api/obligations/[id]/complete/route'
import {
  endOfQuarter,
  quarterFromAnchor,
  applyPlaybook as applyPlaybookDirect,
} from '@/lib/playbooks'

describe('Playbooks — engine', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'editor@test.com', role: 'editor' })
  })

  describe('date helpers', () => {
    it('endOfQuarter returns the last day of the containing quarter', () => {
      expect(endOfQuarter(new Date('2026-04-15T00:00:00Z'))).toBe('2026-06-30')
      expect(endOfQuarter(new Date('2026-01-01T00:00:00Z'))).toBe('2026-03-31')
      expect(endOfQuarter(new Date('2026-12-31T00:00:00Z'))).toBe('2026-12-31')
      expect(endOfQuarter(new Date('2026-07-01T00:00:00Z'))).toBe('2026-09-30')
    })

    it('quarterFromAnchor derives Q1-Q4 + year from an ISO anchor date', () => {
      expect(quarterFromAnchor('2026-03-31')).toEqual({ quarter: 'Q1', year: '2026' })
      expect(quarterFromAnchor('2026-06-30')).toEqual({ quarter: 'Q2', year: '2026' })
      expect(quarterFromAnchor('2026-12-31')).toEqual({ quarter: 'Q4', year: '2026' })
    })
  })

  describe('engine directly', () => {
    it('creates parent + 5 children with correct dates, owners, and placeholders', async () => {
      const result = await applyPlaybookDirect(
        {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme Capital LP',
        },
        { email: 'editor@test.com', source: 'user' },
      )

      expect(result.parent.title).toBe('Acme Capital LP — Q2 2026 Quarterly Report')
      expect(result.parent.counterparty).toBe('Acme Capital LP')
      expect(result.parent.parentId).toBeNull()
      expect(result.children).toHaveLength(5)

      const byDate = result.children.map(c => c.nextDueDate)
      expect(byDate).toEqual([
        '2026-06-09',
        '2026-06-16',
        '2026-06-23',
        '2026-06-30',
        '2026-07-03',
      ])

      // All children point back at the parent and preserve sequence.
      for (let i = 0; i < result.children.length; i++) {
        expect(result.children[i].parentId).toBe(result.parent.id)
        expect(result.children[i].sequence).toBe(i)
      }

      // Placeholder substitution reaches step titles too.
      const sendStep = result.children.find(c => c.title.startsWith('Send report'))
      expect(sendStep?.title).toBe('Send report to Acme Capital LP')

      // Owners default to role labels.
      expect(result.children[0].owner).toBe('CFO')   // collect-financials
      expect(result.children[1].owner).toBe('CEO')   // draft-narrative
    })

    it('applies owner overrides per step slug', async () => {
      const result = await applyPlaybookDirect(
        {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme Capital LP',
          ownerOverrides: { 'collect-financials': 'Alex Jones', archive: 'Priya' },
        },
        { email: 'editor@test.com', source: 'user' },
      )
      expect(result.children[0].owner).toBe('Alex Jones') // collect-financials
      expect(result.children[4].owner).toBe('Priya')      // archive
      expect(result.children[1].owner).toBe('CEO')        // untouched default
    })

    it('rejects apply without counterparty when required', async () => {
      await expect(
        applyPlaybookDirect(
          {
            playbookId: 'quarterly-investor-report',
            anchorDate: '2026-06-30',
          },
          { email: 'editor@test.com', source: 'user' },
        ),
      ).rejects.toThrow(/requires a counterparty/i)
    })

    it('rejects unknown playbook id', async () => {
      await expect(
        applyPlaybookDirect(
          { playbookId: 'does-not-exist', anchorDate: '2026-06-30' },
          { email: 'editor@test.com', source: 'user' },
        ),
      ).rejects.toThrow(/unknown playbook/i)
    })

    it('rejects a playbook with empty steps', async () => {
      await expect(
        applyPlaybookDirect(
          {
            playbookId: 'annual-insurance-renewal',
            anchorDate: '2026-06-30',
            counterparty: 'Acme Insurance',
          },
          { email: 'editor@test.com', source: 'user' },
        ),
      ).rejects.toThrow(/no steps defined/i)
    })

    it('rejects invalid anchorDate format', async () => {
      await expect(
        applyPlaybookDirect(
          {
            playbookId: 'quarterly-investor-report',
            anchorDate: '06/30/2026',
            counterparty: 'X',
          },
          { email: 'editor@test.com', source: 'user' },
        ),
      ).rejects.toThrow(/YYYY-MM-DD/i)
    })

    it('two applies with different counterparties produce independent trees', async () => {
      const a = await applyPlaybookDirect(
        {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme Capital LP',
        },
        { email: 'editor@test.com', source: 'user' },
      )
      const b = await applyPlaybookDirect(
        {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Beta Ventures LP',
        },
        { email: 'editor@test.com', source: 'user' },
      )
      expect(a.parent.id).not.toBe(b.parent.id)
      expect(a.children[0].parentId).toBe(a.parent.id)
      expect(b.children[0].parentId).toBe(b.parent.id)
      expect(a.parent.counterparty).toBe('Acme Capital LP')
      expect(b.parent.counterparty).toBe('Beta Ventures LP')
    })

    it('writes audit events: per-child + playbook.applied summary + parent create', async () => {
      await applyPlaybookDirect(
        {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme Capital LP',
        },
        { email: 'editor@test.com', source: 'user' },
      )
      const events = await db.select().from(auditLog)
      const byType = events.reduce<Record<string, number>>((acc, e) => {
        acc[e.eventType] = (acc[e.eventType] ?? 0) + 1
        return acc
      }, {})
      expect(byType['obligation.created']).toBe(1)
      expect(byType['obligation.sub_created']).toBe(5)
      expect(byType['playbook.applied']).toBe(1)
    })
  })

  describe('routes', () => {
    it('GET /api/playbooks returns the list (editor+)', async () => {
      const req = mkReq('http://localhost/api/playbooks')
      const res = await listPlaybooks(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      const ids = body.playbooks.map((p: any) => p.id)
      expect(ids).toContain('quarterly-investor-report')
    })

    it('GET /api/playbooks/[id] returns steps', async () => {
      const req = mkReq('http://localhost/api/playbooks/quarterly-investor-report')
      const res = await detailPlaybook(req, { params: { id: 'quarterly-investor-report' } })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.steps).toHaveLength(5)
    })

    it('GET /api/playbooks/[id] returns 404 for unknown id', async () => {
      const req = mkReq('http://localhost/api/playbooks/nonsense')
      const res = await detailPlaybook(req, { params: { id: 'nonsense' } })
      expect(res.status).toBe(404)
    })

    it('POST /api/playbooks applies and returns 201 with parent + children', async () => {
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
      const body = await res.json()
      expect(body.parent.title).toBe('Acme Capital LP — Q2 2026 Quarterly Report')
      expect(body.children).toHaveLength(5)
    })

    it('POST /api/playbooks rejects missing counterparty with 400', async () => {
      const req = mkReq('http://localhost/api/playbooks', {
        method: 'POST',
        body: {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
        },
      })
      const res = await applyPlaybook(req)
      expect(res.status).toBe(400)
    })

    it('POST /api/playbooks rejects unknown playbook with 404', async () => {
      const req = mkReq('http://localhost/api/playbooks', {
        method: 'POST',
        body: {
          playbookId: 'does-not-exist',
          anchorDate: '2026-06-30',
          counterparty: 'X',
        },
      })
      const res = await applyPlaybook(req)
      expect(res.status).toBe(404)
    })

    it('GET /api/obligations/[id]/sub-obligations returns children in order', async () => {
      const result = await applyPlaybookDirect(
        {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme',
        },
        { email: 'editor@test.com', source: 'user' },
      )
      const req = mkReq(`http://localhost/api/obligations/${result.parent.id}/sub-obligations`)
      const res = await listSubObligations(req, { params: { id: result.parent.id } })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.children).toHaveLength(5)
      expect(body.children.map((c: any) => c.sequence)).toEqual([0, 1, 2, 3, 4])
    })

    it('GET /api/obligations/[id]/sub-obligations returns 404 for unknown id', async () => {
      const req = mkReq('http://localhost/api/obligations/nonexistent/sub-obligations')
      const res = await listSubObligations(req, { params: { id: 'nonexistent' } })
      expect(res.status).toBe(404)
    })
  })

  describe('parent rollup', () => {
    it('marking the last sub-obligation complete auto-completes the parent', async () => {
      mockSession({ email: 'editor@test.com', role: 'editor' })
      const result = await applyPlaybookDirect(
        {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme',
        },
        { email: 'editor@test.com', source: 'user' },
      )

      // Complete all 5 children
      for (const child of result.children) {
        const req = mkReq(`http://localhost/api/obligations/${child.id}/complete`, {
          method: 'POST',
          body: { completedBy: 'editor@test.com', completedDate: '2026-06-30' },
        })
        const res = await completeObligation(req, { params: { id: child.id } })
        expect(res.status).toBe(201)
      }

      const [parent] = await db.select().from(obligations).where(eq(obligations.id, result.parent.id))
      expect(parent.status).toBe('completed')

      const events = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, 'obligation.parent_rollup_complete'))
      expect(events).toHaveLength(1)
      expect(events[0].entityId).toBe(result.parent.id)
    })

    it('marking only some children complete leaves the parent in-progress', async () => {
      mockSession({ email: 'editor@test.com', role: 'editor' })
      const result = await applyPlaybookDirect(
        {
          playbookId: 'quarterly-investor-report',
          anchorDate: '2026-06-30',
          counterparty: 'Acme',
        },
        { email: 'editor@test.com', source: 'user' },
      )
      // Complete just 2 of 5
      for (const child of result.children.slice(0, 2)) {
        const req = mkReq(`http://localhost/api/obligations/${child.id}/complete`, {
          method: 'POST',
          body: { completedBy: 'editor@test.com', completedDate: '2026-06-30' },
        })
        await completeObligation(req, { params: { id: child.id } })
      }
      const [parent] = await db.select().from(obligations).where(eq(obligations.id, result.parent.id))
      expect(parent.status).not.toBe('completed')
    })
  })

  describe('evidence packet fields through completion route', () => {
    it('persists approvedBy, approvedDate, verificationStatus, summary, evidenceUrls', async () => {
      const id = await insertObligation({ title: 'Test' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: {
          completedBy: 'Alice',
          completedDate: '2026-04-20',
          approvedBy: 'Bob',
          approvedDate: '2026-04-22',
          verificationStatus: 'approved',
          summary: 'All good.',
          evidenceUrls: ['https://blob.test/a.pdf', 'https://blob.test/b.pdf'],
        },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const { completions } = await import('@/db/schema')
      const [row] = await db
        .select()
        .from(completions)
        .where(eq(completions.obligationId, id))
      expect(row.approvedBy).toBe('Bob')
      expect(row.approvedDate).toBe('2026-04-22')
      expect(row.verificationStatus).toBe('approved')
      expect(row.summary).toBe('All good.')
      expect(JSON.parse(row.evidenceUrls!)).toHaveLength(2)
    })
  })
})
