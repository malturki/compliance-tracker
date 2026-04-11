import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, lt, type SQL } from 'drizzle-orm'
import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireRole('viewer', req)
    if (authError) return authError

    await dbReady
    const { searchParams } = req.nextUrl
    const type = searchParams.get('type')
    const actor = searchParams.get('actor')
    const entity = searchParams.get('entity')
    const before = searchParams.get('before')
    const rawLimit = Number(searchParams.get('limit') ?? '50')
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200)

    const clauses: SQL[] = []
    if (type) clauses.push(eq(auditLog.eventType, type))
    if (actor) clauses.push(eq(auditLog.actor, actor))
    if (entity) clauses.push(eq(auditLog.entityId, entity))
    if (before) clauses.push(lt(auditLog.ts, before))

    const rows = await db
      .select()
      .from(auditLog)
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(auditLog.ts))
      .limit(limit)

    const parsed = rows.map(r => ({
      ...r,
      diff: r.diff ? JSON.parse(r.diff) : null,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    }))

    const nextCursor = rows.length === limit ? rows[rows.length - 1].ts : null

    return NextResponse.json({ events: parsed, nextCursor })
  } catch (err) {
    console.error('Audit list error:', err)
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }
}
