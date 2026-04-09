import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { logEvent } from './audit'

beforeEach(async () => {
  await dbReady
  await db.delete(auditLog)
})

describe('logEvent', () => {
  it('writes one row with all fields populated', async () => {
    await logEvent({
      type: 'obligation.updated',
      actor: { email: 'alice@acme.com', source: 'sso' },
      entityType: 'obligation',
      entityId: 'ob_123',
      summary: 'Updated owner',
      diff: { owner: ['X', 'Y'] },
      metadata: { extra: 1 },
    })
    const rows = await db.select().from(auditLog)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.eventType).toBe('obligation.updated')
    expect(row.actor).toBe('alice@acme.com')
    expect(row.actorSource).toBe('sso')
    expect(row.entityType).toBe('obligation')
    expect(row.entityId).toBe('ob_123')
    expect(row.summary).toBe('Updated owner')
    expect(JSON.parse(row.diff!)).toEqual({ owner: ['X', 'Y'] })
    expect(JSON.parse(row.metadata!)).toEqual({ extra: 1 })
    expect(row.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('stores null for absent diff and metadata', async () => {
    await logEvent({
      type: 'obligation.created',
      actor: { email: 'system', source: 'system' },
      entityType: 'obligation',
      entityId: 'ob_1',
      summary: 'Created',
    })
    const rows = await db.select().from(auditLog)
    expect(rows[0].diff).toBeNull()
    expect(rows[0].metadata).toBeNull()
  })

  it('does not throw when the DB write fails (swallow-on-error)', async () => {
    const spy = vi.spyOn(db, 'insert').mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      logEvent({
        type: 'obligation.created',
        actor: { email: 'system', source: 'system' },
        entityType: 'obligation',
        entityId: 'ob_1',
        summary: 'Created',
      }),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    spy.mockRestore()
    errSpy.mockRestore()
  })
})
