import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, lt, type SQL } from 'drizzle-orm'
import { db, dbReady } from '@/db'
import { auditClaims } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireRole('admin', req)
    if (authError) return authError

    await dbReady
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status')
    const before = searchParams.get('before')
    const rawLimit = Number(searchParams.get('limit') ?? '50')
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200)

    const clauses: SQL[] = []
    if (status) clauses.push(eq(auditClaims.status, status))
    if (before) clauses.push(lt(auditClaims.createdAt, before))

    const rows = await db
      .select()
      .from(auditClaims)
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(auditClaims.createdAt), desc(auditClaims.id))
      .limit(limit)

    const claims = rows.map(row => ({
      ...row,
      payloadJson: JSON.parse(row.payloadJson),
      fastCertificate: row.fastCertificate ? JSON.parse(row.fastCertificate) : null,
    }))

    const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt : null
    return NextResponse.json({ claims, nextCursor })
  } catch (err) {
    console.error('Audit claims list error:', err)
    return NextResponse.json({ error: 'Failed to fetch audit claims' }, { status: 500 })
  }
}

