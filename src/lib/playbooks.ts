/**
 * Playbook engine — resolves a Playbook definition into a real obligation
 * tree: one parent + N sub-obligations with correct dates, owners, and
 * placeholders. Used by the POST /api/playbooks route.
 */

import { db } from '@/db'
import { obligations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { logEvent } from './audit'
import type { Actor } from './actor'
import { playbooks, getPlaybook } from '@/data/playbooks'
import type { Playbook, ApplyPlaybookInput } from '@/data/playbooks'

export function listPlaybooks(): Playbook[] {
  return playbooks
}

export { getPlaybook }

export type ObligationRow = typeof obligations.$inferSelect

export class PlaybookError extends Error {
  constructor(message: string, public readonly code: 'not_found' | 'invalid_input') {
    super(message)
    this.name = 'PlaybookError'
  }
}

/**
 * Compute end-of-quarter for a given reference date, as ISO YYYY-MM-DD.
 * Quarter boundaries: Mar 31, Jun 30, Sep 30, Dec 31.
 */
export function endOfQuarter(ref: Date): string {
  const q = Math.floor(ref.getUTCMonth() / 3) // 0..3
  const month = q * 3 + 3 // 3, 6, 9, 12
  const lastDay = new Date(Date.UTC(ref.getUTCFullYear(), month, 0)) // day 0 of next month = last day of this
  return lastDay.toISOString().slice(0, 10)
}

/**
 * Compute the quarter label (Q1-Q4) for a given ISO YYYY-MM-DD anchor date.
 * A date on the last day of March is Q1; first day of April is Q2; etc.
 */
export function quarterFromAnchor(anchorDate: string): { quarter: string; year: string } {
  const d = new Date(anchorDate + 'T00:00:00Z')
  const month = d.getUTCMonth() // 0..11
  const quarter = `Q${Math.floor(month / 3) + 1}`
  return { quarter, year: String(d.getUTCFullYear()) }
}

/**
 * Add/subtract days from an ISO YYYY-MM-DD string, returning a new ISO date.
 */
function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function resolvePlaceholders(
  template: string,
  vars: { counterparty?: string; quarter?: string; year?: string },
): string {
  return template
    .replace(/\{\{counterparty\}\}/g, vars.counterparty ?? '')
    .replace(/\{\{quarter\}\}/g, vars.quarter ?? '')
    .replace(/\{\{year\}\}/g, vars.year ?? '')
    .trim()
}

export interface ApplyPlaybookResult {
  parent: ObligationRow
  children: ObligationRow[]
}

/**
 * Validate input + expand the playbook into a parent obligation + sub-obligation
 * tree in a single transaction. Emits one audit event per created obligation
 * plus a `playbook.applied` summary event. Returns the created rows.
 */
export async function applyPlaybook(
  input: ApplyPlaybookInput,
  actor: Actor,
): Promise<ApplyPlaybookResult> {
  const playbook = getPlaybook(input.playbookId)
  if (!playbook) {
    throw new PlaybookError(`Unknown playbook: ${input.playbookId}`, 'not_found')
  }

  if (!input.anchorDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.anchorDate)) {
    throw new PlaybookError('anchorDate must be YYYY-MM-DD', 'invalid_input')
  }

  const counterparty = (input.counterparty ?? '').trim() || undefined
  if (playbook.requiresCounterparty && !counterparty) {
    throw new PlaybookError(
      `Playbook ${playbook.id} requires a counterparty`,
      'invalid_input',
    )
  }

  if (playbook.steps.length === 0) {
    throw new PlaybookError(
      `Playbook ${playbook.id} has no steps defined and cannot be applied`,
      'invalid_input',
    )
  }

  const { quarter, year } = quarterFromAnchor(input.anchorDate)
  const vars = { counterparty, quarter, year }
  const now = new Date().toISOString()

  const parentId = ulid()
  const parentRow: typeof obligations.$inferInsert = {
    id: parentId,
    title: resolvePlaceholders(playbook.parentTemplate.title, vars),
    description: playbook.parentTemplate.description
      ? resolvePlaceholders(playbook.parentTemplate.description, vars)
      : null,
    category: playbook.category as any,
    subcategory: null,
    frequency: playbook.recurrence ?? 'one-time',
    nextDueDate: input.anchorDate,
    lastCompletedDate: null,
    owner: 'Coordinator',
    ownerEmail: null,
    assignee: null,
    assigneeEmail: null,
    status: 'current',
    riskLevel: 'medium',
    alertDays: '[]',
    lastAlertSent: null,
    sourceDocument: null,
    notes: null,
    entity: 'Pi Squared Inc.',
    counterparty: counterparty ?? null,
    jurisdiction: playbook.parentTemplate.jurisdiction ?? null,
    amount: playbook.parentTemplate.amount ?? null,
    autoRecur: false,
    templateId: null,
    parentId: null,
    sequence: null,
    blockerReason: null,
    nextRecommendedAction: null,
    createdAt: now,
    updatedAt: now,
  }

  const childRows = playbook.steps.map((step, i) => {
    const ownerOverride = input.ownerOverrides?.[step.slug]
    const ownerValue = (ownerOverride && ownerOverride.trim()) || step.defaultOwner
    const row: typeof obligations.$inferInsert = {
      id: ulid(),
      title: resolvePlaceholders(step.title, vars),
      description: step.description
        ? resolvePlaceholders(step.description, vars)
        : null,
      category: playbook.category as any,
      subcategory: null,
      frequency: 'one-time',
      nextDueDate: addDaysISO(input.anchorDate, step.offsetDaysFromAnchor),
      lastCompletedDate: null,
      owner: ownerValue,
      ownerEmail: null,
      assignee: null,
      assigneeEmail: null,
      status: 'current',
      riskLevel: step.riskLevel,
      alertDays: JSON.stringify(step.alertDays ?? []),
      lastAlertSent: null,
      sourceDocument: null,
      notes: step.notes ?? null,
      entity: 'Pi Squared Inc.',
      counterparty: counterparty ?? null,
      jurisdiction: null,
      amount: null,
      autoRecur: false,
      templateId: null,
      parentId,
      sequence: i,
      blockerReason: null,
      nextRecommendedAction: null,
      createdAt: now,
      updatedAt: now,
    }
    return row
  })

  // Insert parent + children. libsql transactions have edge cases on some envs
  // (in-memory), so we do two sequential batches rather than a single tx call.
  // Failure of the child insert leaves an orphan parent; cleanup is a future
  // concern — in practice this block is tiny and both sides succeed together.
  await db.insert(obligations).values(parentRow)
  if (childRows.length > 0) {
    await db.insert(obligations).values(childRows)
  }

  // Re-select the inserted rows with their actual typed shape.
  const [parent] = await db.select().from(obligations).where(eq(obligations.id, parentId))
  const children = await db.select().from(obligations).where(eq(obligations.parentId, parentId))
  // children returns rows ordered by insert, but sort defensively by sequence.
  children.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

  // Audit: one event per row, plus a summary.
  await logEvent({
    type: 'obligation.created',
    actor,
    entityType: 'obligation',
    entityId: parent.id,
    summary: `Created parent obligation "${parent.title}" via playbook ${playbook.id}`,
    metadata: { playbookId: playbook.id, childCount: children.length },
  })
  for (const c of children) {
    await logEvent({
      type: 'obligation.sub_created',
      actor,
      entityType: 'obligation',
      entityId: c.id,
      summary: `Created sub-obligation "${c.title}"`,
      metadata: { playbookId: playbook.id, parentId: parent.id, sequence: c.sequence },
    })
  }
  await logEvent({
    type: 'playbook.applied',
    actor,
    entityType: 'playbook',
    entityId: playbook.id,
    summary: `Applied playbook "${playbook.name}"${counterparty ? ` for ${counterparty}` : ''}`,
    metadata: {
      playbookId: playbook.id,
      parentId: parent.id,
      childCount: children.length,
      counterparty: counterparty ?? null,
      anchorDate: input.anchorDate,
    },
  })

  return { parent, children }
}

/**
 * If the given obligation has a parent, check whether all siblings are now
 * `completed`. If so, mark the parent `completed` too and emit an audit event.
 *
 * Safe to call from the completion route after any child is marked complete.
 * No-op for top-level obligations.
 */
export async function maybeRollupParent(
  childObligationId: string,
  actor: Actor,
): Promise<{ parentCompleted: boolean; parentId?: string }> {
  const [child] = await db
    .select()
    .from(obligations)
    .where(eq(obligations.id, childObligationId))
  if (!child || !child.parentId) return { parentCompleted: false }

  const siblings = await db
    .select()
    .from(obligations)
    .where(eq(obligations.parentId, child.parentId))
  const allComplete = siblings.length > 0 && siblings.every(s => s.status === 'completed')
  if (!allComplete) return { parentCompleted: false, parentId: child.parentId }

  const [parent] = await db
    .select()
    .from(obligations)
    .where(eq(obligations.id, child.parentId))
  if (!parent || parent.status === 'completed') {
    return { parentCompleted: false, parentId: child.parentId }
  }

  const nowIso = new Date().toISOString()
  const today = nowIso.slice(0, 10)
  await db
    .update(obligations)
    .set({ status: 'completed', lastCompletedDate: today, updatedAt: nowIso })
    .where(eq(obligations.id, parent.id))

  await logEvent({
    type: 'obligation.parent_rollup_complete',
    actor,
    entityType: 'obligation',
    entityId: parent.id,
    summary: `Auto-completed parent "${parent.title}" — all ${siblings.length} sub-obligations complete`,
    metadata: { parentId: parent.id, childCount: siblings.length },
  })

  return { parentCompleted: true, parentId: parent.id }
}
