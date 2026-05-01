import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { desc, inArray } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

/**
 * Returns the timestamp of the most recent mutation to the obligations
 * database — anything an agent, a human in the UI, or a bulk operation has
 * done that produced an audit-log entry for `obligation`, `playbook`, or
 * `template`. Powers the "Last sync" badge in the AppShell so users always
 * see how fresh the data is, regardless of the page they're on.
 *
 * Returns null lastSyncAt when no qualifying audit events exist yet.
 */
export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole('viewer', req)
  if (authError) return authError

  await dbReady

  const rows = await db
    .select({
      ts: auditLog.ts,
      eventType: auditLog.eventType,
    })
    .from(auditLog)
    .where(inArray(auditLog.entityType, ['obligation', 'playbook', 'template']))
    .orderBy(desc(auditLog.ts))
    .limit(1)

  if (rows.length === 0) {
    return NextResponse.json({ lastSyncAt: null, lastEventType: null })
  }

  return NextResponse.json({
    lastSyncAt: rows[0].ts,
    lastEventType: rows[0].eventType,
  })
}
