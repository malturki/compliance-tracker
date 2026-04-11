// @vitest-environment node
// Run in Node (not jsdom) so multipart/form-data tests get undici's File class
// — JSDOM provides its own File that doesn't satisfy `value instanceof File`
// inside the route handler, so all uploaded files would be silently ignored.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations, completions, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, mockSession, mkReq, insertObligation } from '../integration-helpers'
import { POST as completeObligation } from '@/app/api/obligations/[id]/complete/route'
import { GET as getObligation } from '@/app/api/obligations/[id]/route'

// Mock the Vercel Blob uploader so multipart tests don't need real cloud storage.
// validateFile is kept real so we can exercise its size/type checks.
vi.mock('@/lib/blob', async () => {
  const actual = await vi.importActual<typeof import('@/lib/blob')>('@/lib/blob')
  return {
    ...actual,
    uploadToBlob: vi.fn(async (file: File) => `https://blob.test/${encodeURIComponent(file.name)}`),
  }
})

// Build a multipart/form-data Request the route handler can read.
function mkMultipartReq(
  url: string,
  fields: Record<string, string>,
  files: { name: string; type: string; content: string }[] = [],
) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  files.forEach((f, i) => {
    fd.append(`file_${i}`, new File([f.content], f.name, { type: f.type }))
  })
  const req = new Request(url, { method: 'POST', body: fd }) as any
  req.nextUrl = new URL(url)
  return req
}

// Tests for the validation, error, and edge-case branches of the
// /api/obligations/[id]/complete route. Recurrence happy paths for one-time,
// event-triggered, annual, and quarterly are covered in completion-status.test.ts —
// here we cover monthly/weekly, missing fields, evidence handling, audit
// metadata, and the 404 path.
describe('Completion flow — validation and edge cases', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
    mockSession({ email: 'admin@test.com', role: 'admin' })
  })

  describe('Validation errors', () => {
    it('rejects missing completedBy (400)', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedDate: '2026-04-01' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(400)
    })

    it('rejects empty completedBy (400)', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: '', completedDate: '2026-04-01' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(400)
    })

    it('rejects malformed completedDate (400)', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: 'yesterday' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(400)
    })

    it('completedDate defaults to today when omitted', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const today = new Date().toISOString().split('T')[0]
      const comps = await db.select().from(completions).where(eq(completions.obligationId, id))
      expect(comps[0].completedDate).toBe(today)
    })
  })

  describe('Not found', () => {
    it('returns 404 for a non-existent obligation id', async () => {
      const req = mkReq('http://localhost/api/obligations/nonexistent/complete', {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-04-01' },
      })
      const res = await completeObligation(req, { params: { id: 'nonexistent' } })
      expect(res.status).toBe(404)
    })
  })

  describe('Recurrence advancement (gaps in completion-status.test.ts)', () => {
    it('monthly autoRecur advances by 1 month', async () => {
      const id = await insertObligation({
        title: 'Monthly bill',
        frequency: 'monthly',
        nextDueDate: '2026-06-15',
        autoRecur: true,
      })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-06-10' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      // baseDate = max('2026-06-10', '2026-06-15') = '2026-06-15'; +1 month
      expect(rows[0].nextDueDate).toBe('2026-07-15')
      expect(rows[0].lastCompletedDate).toBe('2026-06-10')
    })

    it('weekly autoRecur advances by 7 days', async () => {
      const id = await insertObligation({
        title: 'Weekly check',
        frequency: 'weekly',
        nextDueDate: '2026-06-15',
        autoRecur: true,
      })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-06-10' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].nextDueDate).toBe('2026-06-22')
      expect(rows[0].lastCompletedDate).toBe('2026-06-10')
    })

    it('one-time obligation does NOT advance nextDueDate (terminal completion)', async () => {
      const id = await insertObligation({
        title: 'One-time filing',
        frequency: 'one-time',
        nextDueDate: '2026-06-15',
        autoRecur: true, // even if autoRecur is on, one-time should not advance
      })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-06-15' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].nextDueDate).toBe('2026-06-15')
      expect(rows[0].lastCompletedDate).toBe('2026-06-15')
    })

    it('event-triggered obligation does NOT advance nextDueDate', async () => {
      const id = await insertObligation({
        title: 'Event filing',
        frequency: 'event-triggered',
        nextDueDate: '2026-06-15',
        autoRecur: true,
      })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-06-15' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].nextDueDate).toBe('2026-06-15')
    })

    it('recurring without autoRecur records completion but does NOT advance', async () => {
      const id = await insertObligation({
        title: 'Manual recurring',
        frequency: 'monthly',
        nextDueDate: '2026-06-15',
        autoRecur: false,
      })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-06-10' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].nextDueDate).toBe('2026-06-15')
      expect(rows[0].lastCompletedDate).toBe('2026-06-10')
    })
  })

  describe('Notes and evidence', () => {
    it('persists notes on the completion record', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-04-01', notes: 'Filed via portal #12345' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const comps = await db.select().from(completions).where(eq(completions.obligationId, id))
      expect(comps[0].notes).toBe('Filed via portal #12345')
    })

    it('persists evidence URL via JSON body (single URL → JSON-encoded array)', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: {
          completedBy: 'Tester',
          completedDate: '2026-04-01',
          evidenceUrl: 'https://example.com/receipt.pdf',
        },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.evidenceUrls).toEqual(['https://example.com/receipt.pdf'])

      const comps = await db.select().from(completions).where(eq(completions.obligationId, id))
      expect(comps[0].evidenceUrl).toBe(JSON.stringify(['https://example.com/receipt.pdf']))
    })

    it('completion without evidence stores null evidenceUrl', async () => {
      const id = await insertObligation({ title: 'X' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-04-01' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const comps = await db.select().from(completions).where(eq(completions.obligationId, id))
      expect(comps[0].evidenceUrl).toBeNull()
    })
  })

  describe('Audit log metadata', () => {
    it('writes obligation.completed event with completionId, evidenceCount, and completedBy', async () => {
      const id = await insertObligation({ title: 'Audit me' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: {
          completedBy: 'Audit Tester',
          completedDate: '2026-04-01',
          evidenceUrl: 'https://example.com/proof.pdf',
        },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)
      const { id: completionId } = await res.json()

      const events = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, 'obligation.completed'))
      const forThis = events.filter(e => e.entityId === id)
      expect(forThis).toHaveLength(1)
      const metadata = JSON.parse(forThis[0].metadata || '{}')
      expect(metadata.completionId).toBe(completionId)
      expect(metadata.evidenceCount).toBe(1)
      expect(metadata.completedBy).toBe('Audit Tester')
      expect(forThis[0].summary).toMatch(/Audit me/)
    })

    it('audit event evidenceCount is 0 when no evidence supplied', async () => {
      const id = await insertObligation({ title: 'No proof' })
      const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-04-01' },
      })
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const events = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, 'obligation.completed'))
      const forThis = events.filter(e => e.entityId === id)
      const metadata = JSON.parse(forThis[0].metadata || '{}')
      expect(metadata.evidenceCount).toBe(0)
    })
  })

  describe('Multiple completions', () => {
    it('a recurring obligation can be completed multiple times, each recorded', async () => {
      const id = await insertObligation({
        title: 'Recurring',
        frequency: 'monthly',
        nextDueDate: '2026-04-15',
        autoRecur: true,
      })

      for (const date of ['2026-04-15', '2026-05-15', '2026-06-15']) {
        const req = mkReq(`http://localhost/api/obligations/${id}/complete`, {
          method: 'POST',
          body: { completedBy: 'Tester', completedDate: date },
        })
        const res = await completeObligation(req, { params: { id } })
        expect(res.status).toBe(201)
      }

      const comps = await db.select().from(completions).where(eq(completions.obligationId, id))
      expect(comps).toHaveLength(3)

      // After 3 completions starting at 2026-04-15: each call sets baseDate=max(completedDate, currentNextDueDate)
      // Call 1: completed 04-15, base = max(04-15, 04-15)=04-15, next = 05-15
      // Call 2: completed 05-15, base = max(05-15, 05-15)=05-15, next = 06-15
      // Call 3: completed 06-15, base = max(06-15, 06-15)=06-15, next = 07-15
      const rows = await db.select().from(obligations).where(eq(obligations.id, id))
      expect(rows[0].nextDueDate).toBe('2026-07-15')
      expect(rows[0].lastCompletedDate).toBe('2026-06-15')
    })
  })

  describe('Multipart/form-data evidence upload', () => {
    it('uploads files via multipart, stores returned URLs on the completion', async () => {
      const id = await insertObligation({ title: 'Multipart' })
      const req = mkMultipartReq(
        `http://localhost/api/obligations/${id}/complete`,
        { completedBy: 'Tester', completedDate: '2026-04-01' },
        [
          { name: 'receipt.pdf', type: 'application/pdf', content: 'pdf body' },
          { name: 'invoice.pdf', type: 'application/pdf', content: 'pdf body 2' },
        ],
      )
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.evidenceUrls).toHaveLength(2)
      expect(body.evidenceUrls[0]).toMatch(/^https:\/\/blob\.test\//)

      const comps = await db.select().from(completions).where(eq(completions.obligationId, id))
      const stored = JSON.parse(comps[0].evidenceUrl ?? '[]')
      expect(stored).toHaveLength(2)
      expect(stored[0]).toContain('receipt.pdf')
    })

    it('rejects more than 5 files in a single completion (400)', async () => {
      const id = await insertObligation({ title: 'TooMany' })
      const files = Array.from({ length: 6 }, (_, i) => ({
        name: `f${i}.pdf`,
        type: 'application/pdf',
        content: 'x',
      }))
      const req = mkMultipartReq(
        `http://localhost/api/obligations/${id}/complete`,
        { completedBy: 'Tester', completedDate: '2026-04-01' },
        files,
      )
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/maximum 5 files/i)
    })

    it('rejects unsupported file types (400)', async () => {
      const id = await insertObligation({ title: 'BadType' })
      const req = mkMultipartReq(
        `http://localhost/api/obligations/${id}/complete`,
        { completedBy: 'Tester', completedDate: '2026-04-01' },
        [{ name: 'malware.exe', type: 'application/x-msdownload', content: 'bin' }],
      )
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/file type not supported/i)
    })

    it('multipart with notes field stores notes on the completion', async () => {
      const id = await insertObligation({ title: 'WithNotes' })
      const req = mkMultipartReq(
        `http://localhost/api/obligations/${id}/complete`,
        {
          completedBy: 'Tester',
          completedDate: '2026-04-01',
          notes: 'Done via portal',
        },
        [{ name: 'proof.pdf', type: 'application/pdf', content: 'pdf' }],
      )
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const comps = await db.select().from(completions).where(eq(completions.obligationId, id))
      expect(comps[0].notes).toBe('Done via portal')
    })

    it('multipart without files works (just FormData fields)', async () => {
      const id = await insertObligation({ title: 'NoFiles' })
      const req = mkMultipartReq(
        `http://localhost/api/obligations/${id}/complete`,
        { completedBy: 'Tester', completedDate: '2026-04-01' },
      )
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.evidenceUrls).toEqual([])
    })

    it('audit metadata evidenceCount counts uploaded files', async () => {
      const id = await insertObligation({ title: 'AuditMultipart' })
      const req = mkMultipartReq(
        `http://localhost/api/obligations/${id}/complete`,
        { completedBy: 'Tester', completedDate: '2026-04-01' },
        [
          { name: 'a.pdf', type: 'application/pdf', content: 'a' },
          { name: 'b.pdf', type: 'application/pdf', content: 'b' },
          { name: 'c.pdf', type: 'application/pdf', content: 'c' },
        ],
      )
      const res = await completeObligation(req, { params: { id } })
      expect(res.status).toBe(201)

      const events = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.eventType, 'obligation.completed'))
      const forThis = events.filter(e => e.entityId === id)
      const metadata = JSON.parse(forThis[0].metadata || '{}')
      expect(metadata.evidenceCount).toBe(3)
    })
  })

  describe('GET reflects completion in returned shape', () => {
    it('after completing, GET returns the completion in the completions array', async () => {
      const id = await insertObligation({ title: 'Fetched' })
      const completeReq = mkReq(`http://localhost/api/obligations/${id}/complete`, {
        method: 'POST',
        body: { completedBy: 'Tester', completedDate: '2026-04-01', notes: 'done' },
      })
      const completeRes = await completeObligation(completeReq, { params: { id } })
      expect(completeRes.status).toBe(201)

      const getReq = mkReq(`http://localhost/api/obligations/${id}`)
      const getRes = await getObligation(getReq, { params: { id } })
      expect(getRes.status).toBe(200)
      const body = await getRes.json()
      expect(body.completions).toHaveLength(1)
      expect(body.completions[0].completedBy).toBe('Tester')
      expect(body.completions[0].completedDate).toBe('2026-04-01')
      expect(body.completions[0].notes).toBe('done')
    })
  })
})
