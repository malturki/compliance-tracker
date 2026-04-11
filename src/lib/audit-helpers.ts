import { db } from '@/db'
import { obligations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { diffFields } from './diff'
import { logEvent } from './audit'
import type { Actor } from './actor'

// Fields whose changes are worth recording in the audit log diff.
// Changes outside this list (e.g. updatedAt, lastAlertSent) are intentionally
// ignored so the log shows meaningful activity, not bookkeeping churn.
export const TRACKED_OBLIGATION_FIELDS = [
  'title',
  'nextDueDate',
  'owner',
  'assignee',
  'riskLevel',
  'frequency',
  'autoRecur',
  'category',
  'notes',
  'counterparty',
  'jurisdiction',
] as const

type ObligationRow = typeof obligations.$inferSelect

export async function auditedUpdate(
  id: string,
  patch: Partial<ObligationRow>,
  actor: Actor,
): Promise<ObligationRow | null> {
  const before = (await db.select().from(obligations).where(eq(obligations.id, id)))[0]
  if (!before) return null

  const nowIso = new Date().toISOString()
  const next = { ...patch, updatedAt: nowIso }

  await db.update(obligations).set(next).where(eq(obligations.id, id))
  const after = (await db.select().from(obligations).where(eq(obligations.id, id)))[0]

  const diff = diffFields(before, after, TRACKED_OBLIGATION_FIELDS)
  // Skip logging updates that only touched non-tracked fields.
  if (Object.keys(diff).length > 0) {
    await logEvent({
      type: 'obligation.updated',
      actor,
      entityType: 'obligation',
      entityId: id,
      summary: `Updated ${Object.keys(diff).join(', ')}`,
      diff,
    })
  }

  return after
}
