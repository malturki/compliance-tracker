/**
 * Phase 0 schema tests for the evidence packet columns on `completions`.
 *
 * At this point no API route writes the new fields yet (that lands in Phase 1
 * when the completion UI starts collecting approver/verification/summary/
 * multi-file evidence). These tests exercise the schema + validation directly
 * to confirm the columns exist, accept the expected values, reject invalid
 * combinations, and survive the round-trip.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { completions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { resetDb, insertObligation } from '../integration-helpers'
import { completeObligationSchema } from '@/lib/validation'

describe('Phase 0 — evidence packet schema', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
  })

  it('persists all new evidence packet columns on insert', async () => {
    const obligationId = await insertObligation({ title: 'Insurance Renewal' })
    const completionId = ulid()
    const now = new Date().toISOString()

    await db.insert(completions).values({
      id: completionId,
      obligationId,
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      evidenceUrl: 'https://blob.test/renewal.pdf',
      evidenceUrls: JSON.stringify([
        'https://blob.test/renewal.pdf',
        'https://blob.test/cert.pdf',
      ]),
      approvedBy: 'Bob',
      approvedDate: '2026-04-22',
      verificationStatus: 'approved',
      summary: 'Policy bound at $12k annual premium; no material coverage change.',
      notes: null,
      createdAt: now,
    } as any)

    const [row] = await db.select().from(completions).where(eq(completions.id, completionId))
    expect(row.approvedBy).toBe('Bob')
    expect(row.approvedDate).toBe('2026-04-22')
    expect(row.verificationStatus).toBe('approved')
    expect(row.summary).toMatch(/Policy bound/)
    expect(JSON.parse(row.evidenceUrls!)).toHaveLength(2)
  })

  it('defaults verificationStatus to "unverified" when omitted', async () => {
    const obligationId = await insertObligation()
    const completionId = ulid()
    const now = new Date().toISOString()

    await db.insert(completions).values({
      id: completionId,
      obligationId,
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      evidenceUrl: null,
      notes: null,
      createdAt: now,
    } as any)

    const [row] = await db.select().from(completions).where(eq(completions.id, completionId))
    expect(row.verificationStatus).toBe('unverified')
  })

  describe('completeObligationSchema validation', () => {
    it('accepts a minimal completion (back-compat)', () => {
      const result = completeObligationSchema.safeParse({
        completedDate: '2026-04-20',
        completedBy: 'Alice',
      })
      expect(result.success).toBe(true)
    })

    it('accepts a full evidence packet', () => {
      const result = completeObligationSchema.safeParse({
        completedDate: '2026-04-20',
        completedBy: 'Alice',
        approvedBy: 'Bob',
        approvedDate: '2026-04-22',
        verificationStatus: 'approved',
        summary: 'Done.',
        evidenceUrls: ['https://blob.test/x.pdf', 'https://blob.test/y.pdf'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects verificationStatus outside the allowed set', () => {
      const result = completeObligationSchema.safeParse({
        completedDate: '2026-04-20',
        completedBy: 'Alice',
        verificationStatus: 'bogus',
      })
      expect(result.success).toBe(false)
    })

    it('rejects approvedDate earlier than completedDate', () => {
      const result = completeObligationSchema.safeParse({
        completedDate: '2026-04-20',
        completedBy: 'Alice',
        approvedBy: 'Bob',
        approvedDate: '2026-04-19',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('approvedDate'))).toBe(true)
      }
    })

    it('rejects non-URL evidence URLs', () => {
      const result = completeObligationSchema.safeParse({
        completedDate: '2026-04-20',
        completedBy: 'Alice',
        evidenceUrls: ['not-a-url'],
      })
      expect(result.success).toBe(false)
    })
  })
})
