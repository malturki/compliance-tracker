import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { ne } from 'drizzle-orm'
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

  return NextResponse.json(result)
}
