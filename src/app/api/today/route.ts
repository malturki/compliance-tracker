import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations, completions } from '@/db/schema'
import { ne, desc, eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { computeStatus } from '@/lib/utils'
import { groupForToday, toIsoDay } from '@/lib/today'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole('viewer', req)
  if (authError) return authError

  await dbReady

  // Pull every non-completed top-level + sub obligation. Sub-obligations
  // (parent_id set) ARE included on Today — they're real action items.
  const rows = await db
    .select()
    .from(obligations)
    .where(ne(obligations.status, 'completed'))

  // Compute the status field as the page would, so the bucketer's
  // "completed" check is consistent with the rest of the UI.
  // The DB columns are typed as plain strings by Drizzle; the values stored
  // are always valid enum members so casting back to the typed shape is safe.
  const enriched = rows.map(r => ({
    ...r,
    status: r.status as any,
    riskLevel: r.riskLevel as any,
    frequency: r.frequency as any,
    computedStatus: computeStatus(r.nextDueDate, r.lastCompletedDate, r.frequency),
  }))

  // Session-derived owner identity. Agents authenticated via Bearer token will
  // have no NextAuth session here; their work shows up in `others` rather
  // than `mine`. That's fine for now — the agent UI doesn't surface this view.
  const session = await auth().catch(() => null)
  const sessionEmail = session?.user?.email ?? null
  const sessionName = session?.user?.name ?? null
  const role = (session?.user?.role ?? 'viewer') as 'viewer' | 'editor' | 'admin'
  const flatten = role === 'viewer'

  const todayIso = toIsoDay(new Date())
  const result = groupForToday(enriched, {
    todayIso,
    sessionEmail,
    sessionName,
    flatten,
  })

  // Daily momentum: completions where completed_date == today.
  // Reads the completions table directly + joins by obligationId for titles.
  const todaysCompletions = await db
    .select({
      id: completions.id,
      obligationId: completions.obligationId,
      completedBy: completions.completedBy,
      createdAt: completions.createdAt,
    })
    .from(completions)
    .where(eq(completions.completedDate, todayIso))
    .orderBy(desc(completions.createdAt))
    .limit(50)
  const titlesById = new Map(rows.map(r => [r.id, r.title]))
  // Some completed obligations may have status='completed' and were excluded
  // from the rows query above. Backfill their titles with one extra select.
  const missingIds = todaysCompletions
    .map(c => c.obligationId)
    .filter(id => !titlesById.has(id))
  if (missingIds.length > 0) {
    const extra = await db
      .select({ id: obligations.id, title: obligations.title })
      .from(obligations)
    for (const e of extra) {
      if (missingIds.includes(e.id) && !titlesById.has(e.id)) titlesById.set(e.id, e.title)
    }
  }
  const recent = todaysCompletions.slice(0, 5).map(c => ({
    obligationId: c.obligationId,
    title: titlesById.get(c.obligationId) ?? '(deleted)',
    completedBy: c.completedBy,
    completedAt: c.createdAt,
  }))

  return NextResponse.json({
    ...result,
    completedToday: {
      count: todaysCompletions.length,
      recent,
    },
  })
}
