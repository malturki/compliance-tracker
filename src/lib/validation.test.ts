import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  formatZodError,
  createObligationSchema,
  updateObligationSchema,
  completeObligationSchema,
} from './validation'

const baseValidObligation = {
  title: 'Test',
  category: 'tax' as const,
  frequency: 'annual' as const,
  nextDueDate: '2027-01-01',
  owner: 'Alice',
}

describe('formatZodError', () => {
  it('joins all issue paths and messages into a single error string', () => {
    const schema = z.object({ a: z.string(), b: z.number() })
    const result = schema.safeParse({ a: 123, b: 'oops' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const out = formatZodError(result.error)
      expect(out.error).toContain('a:')
      expect(out.error).toContain('b:')
      expect(out.issues.length).toBe(2)
    }
  })

  it('handles top-level (path-less) issues', () => {
    // A refined schema with a top-level-only failure path.
    const schema = z.object({ x: z.number() }).refine(() => false, { message: 'top-level failure' })
    const result = schema.safeParse({ x: 1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const out = formatZodError(result.error)
      expect(out.error).toContain('top-level failure')
    }
  })

  it('returns a fallback error message when no issues are present', () => {
    // Synthesize an empty ZodError to exercise the fallback branch.
    const emptyError = new z.ZodError([])
    const out = formatZodError(emptyError)
    expect(out.error).toBe('Invalid request')
    expect(out.issues).toEqual([])
  })
})

describe('createObligationSchema', () => {
  it('accepts a minimal valid obligation', () => {
    expect(createObligationSchema.safeParse(baseValidObligation).success).toBe(true)
  })

  it('rejects titles longer than 500 chars', () => {
    const res = createObligationSchema.safeParse({ ...baseValidObligation, title: 'x'.repeat(501) })
    expect(res.success).toBe(false)
  })

  it('rejects malformed nextDueDate', () => {
    const res = createObligationSchema.safeParse({ ...baseValidObligation, nextDueDate: '2027/01/01' })
    expect(res.success).toBe(false)
  })

  it('rejects unknown category', () => {
    const res = createObligationSchema.safeParse({ ...baseValidObligation, category: 'nonsense' as any })
    expect(res.success).toBe(false)
  })

  it('rejects unknown frequency', () => {
    const res = createObligationSchema.safeParse({ ...baseValidObligation, frequency: 'biennial' as any })
    expect(res.success).toBe(false)
  })

  it('accepts every Frequency enum value', () => {
    for (const f of ['annual', 'semi-annual', 'quarterly', 'bi-monthly', 'monthly', 'weekly', 'one-time', 'event-triggered'] as const) {
      const res = createObligationSchema.safeParse({ ...baseValidObligation, frequency: f })
      expect(res.success, `frequency ${f} should be accepted`).toBe(true)
    }
  })

  it('rejects empty owner', () => {
    const res = createObligationSchema.safeParse({ ...baseValidObligation, owner: '' })
    expect(res.success).toBe(false)
  })

  it('rejects empty title', () => {
    const res = createObligationSchema.safeParse({ ...baseValidObligation, title: '' })
    expect(res.success).toBe(false)
  })

  it('defaults entity to "Pi Squared Inc." when omitted', () => {
    const res = createObligationSchema.safeParse(baseValidObligation)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.entity).toBe('Pi Squared Inc.')
    }
  })

  it('defaults riskLevel to medium when omitted', () => {
    const res = createObligationSchema.safeParse(baseValidObligation)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.riskLevel).toBe('medium')
    }
  })

  it('accepts blocked status only with a blockerReason', () => {
    const ok = createObligationSchema.safeParse({
      ...baseValidObligation,
      status: 'blocked',
      blockerReason: 'Waiting on board',
    })
    expect(ok.success).toBe(true)

    const bad = createObligationSchema.safeParse({ ...baseValidObligation, status: 'blocked' })
    expect(bad.success).toBe(false)
  })

  it('rejects counterparty longer than 200 chars', () => {
    const res = createObligationSchema.safeParse({
      ...baseValidObligation,
      counterparty: 'y'.repeat(201),
    })
    expect(res.success).toBe(false)
  })

  it('rejects negative sequence', () => {
    const res = createObligationSchema.safeParse({ ...baseValidObligation, sequence: -3 })
    expect(res.success).toBe(false)
  })

  it('rejects non-integer sequence', () => {
    const res = createObligationSchema.safeParse({ ...baseValidObligation, sequence: 1.5 })
    expect(res.success).toBe(false)
  })

  it('accepts blockerReason up to 1000 chars but rejects longer', () => {
    const good = createObligationSchema.safeParse({
      ...baseValidObligation,
      status: 'blocked',
      blockerReason: 'x'.repeat(1000),
    })
    expect(good.success).toBe(true)
    const bad = createObligationSchema.safeParse({
      ...baseValidObligation,
      status: 'blocked',
      blockerReason: 'x'.repeat(1001),
    })
    expect(bad.success).toBe(false)
  })
})

describe('updateObligationSchema', () => {
  it('accepts an empty patch (all fields optional)', () => {
    expect(updateObligationSchema.safeParse({}).success).toBe(true)
  })

  it('rejects bogus category when provided', () => {
    expect(updateObligationSchema.safeParse({ category: 'x' as any }).success).toBe(false)
  })

  it('rejects negative sequence', () => {
    expect(updateObligationSchema.safeParse({ sequence: -1 }).success).toBe(false)
  })

  it('accepts nextRecommendedAction up to 500 chars', () => {
    expect(updateObligationSchema.safeParse({ nextRecommendedAction: 'x'.repeat(500) }).success).toBe(true)
    expect(updateObligationSchema.safeParse({ nextRecommendedAction: 'x'.repeat(501) }).success).toBe(false)
  })
})

describe('completeObligationSchema', () => {
  it('accepts the minimal shape', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-23',
      completedBy: 'Alice',
    })
    expect(res.success).toBe(true)
  })

  it('accepts the full evidence packet', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      approvedBy: 'Bob',
      approvedDate: '2026-04-22',
      verificationStatus: 'approved',
      summary: 'Done.',
      evidenceUrls: ['https://blob.test/x.pdf'],
    })
    expect(res.success).toBe(true)
  })

  it('rejects approvedDate earlier than completedDate', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      approvedBy: 'Bob',
      approvedDate: '2026-04-19',
    })
    expect(res.success).toBe(false)
  })

  it('rejects malformed completedDate', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: 'yesterday',
      completedBy: 'Alice',
    })
    expect(res.success).toBe(false)
  })

  it('rejects malformed approvedDate format', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      approvedDate: '4/22/2026',
    })
    expect(res.success).toBe(false)
  })

  it('rejects non-URL evidenceUrl', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      evidenceUrl: 'not-a-url',
    })
    expect(res.success).toBe(false)
  })

  it('accepts empty-string evidenceUrl (legacy single-url shape)', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      evidenceUrl: '',
    })
    expect(res.success).toBe(true)
  })

  it('rejects invalid verificationStatus', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      verificationStatus: 'totally-verified',
    })
    expect(res.success).toBe(false)
  })

  it('rejects non-URL entries inside evidenceUrls array', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      evidenceUrls: ['https://blob.test/a.pdf', 'nope'],
    })
    expect(res.success).toBe(false)
  })

  it('rejects summary longer than 5000 chars', () => {
    const res = completeObligationSchema.safeParse({
      completedDate: '2026-04-20',
      completedBy: 'Alice',
      summary: 'x'.repeat(5001),
    })
    expect(res.success).toBe(false)
  })
})
