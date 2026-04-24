/**
 * Phase 0 schema tests for sub-obligation structure on `obligations`.
 *
 * The actual sub-obligation API routes + UI ship in Phase 1. This file
 * confirms the schema accepts parent_id / sequence / blocker_reason /
 * next_recommended_action, that validation enforces the reasonable invariants
 * (blocker_reason required when status='blocked', parent_id can't reference
 * the row itself), and that children can be retrieved by parent_id.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { resetDb, insertObligation } from '../integration-helpers'
import { createObligationSchema, updateObligationSchema } from '@/lib/validation'

describe('Phase 0 — sub-obligation schema', () => {
  beforeEach(async () => {
    await dbReady
    await resetDb()
  })

  it('persists parent_id, sequence, blocker_reason, next_recommended_action', async () => {
    const parentId = await insertObligation({ title: 'VP LP — Q2 2026 Quarterly Report' })
    const childId = await insertObligation({
      title: 'Collect quarterly financials',
      parentId,
      sequence: 0,
      nextRecommendedAction: 'Email Finance by Friday for the trial balance',
    })

    const [child] = await db.select().from(obligations).where(eq(obligations.id, childId))
    expect(child.parentId).toBe(parentId)
    expect(child.sequence).toBe(0)
    expect(child.nextRecommendedAction).toMatch(/trial balance/)
  })

  it('lists children of a parent via parent_id index', async () => {
    const parentId = await insertObligation({ title: 'Parent' })
    const a = await insertObligation({ title: 'Step A', parentId, sequence: 0 })
    const b = await insertObligation({ title: 'Step B', parentId, sequence: 1 })
    const unrelated = await insertObligation({ title: 'Unrelated top-level' })

    const children = await db.select().from(obligations).where(eq(obligations.parentId, parentId))
    const ids = children.map(c => c.id).sort()
    expect(ids).toEqual([a, b].sort())
    expect(ids).not.toContain(unrelated)
  })

  it('allows status="blocked" with a blocker_reason', async () => {
    const id = await insertObligation({
      title: 'Blocked item',
      status: 'blocked',
      blockerReason: 'Waiting on signed engagement letter from counsel',
    })
    const [row] = await db.select().from(obligations).where(eq(obligations.id, id))
    expect(row.status).toBe('blocked')
    expect(row.blockerReason).toMatch(/engagement letter/)
  })

  describe('validation', () => {
    it('createObligationSchema rejects status="blocked" without blockerReason', () => {
      const result = createObligationSchema.safeParse({
        title: 'Something',
        category: 'tax',
        frequency: 'annual',
        nextDueDate: '2027-01-01',
        owner: 'Alice',
        status: 'blocked',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('blockerReason'))).toBe(true)
      }
    })

    it('createObligationSchema accepts status="blocked" with blockerReason', () => {
      const result = createObligationSchema.safeParse({
        title: 'Something',
        category: 'tax',
        frequency: 'annual',
        nextDueDate: '2027-01-01',
        owner: 'Alice',
        status: 'blocked',
        blockerReason: 'Awaiting input from CPA',
      })
      expect(result.success).toBe(true)
    })

    it('createObligationSchema accepts optional parentId, sequence, nextRecommendedAction', () => {
      const result = createObligationSchema.safeParse({
        title: 'Child',
        category: 'tax',
        frequency: 'annual',
        nextDueDate: '2027-01-01',
        owner: 'Alice',
        parentId: 'some-parent-id',
        sequence: 3,
        nextRecommendedAction: 'Prepare checklist',
      })
      expect(result.success).toBe(true)
    })

    it('updateObligationSchema rejects negative sequence', () => {
      const result = updateObligationSchema.safeParse({ sequence: -1 })
      expect(result.success).toBe(false)
    })
  })
})
