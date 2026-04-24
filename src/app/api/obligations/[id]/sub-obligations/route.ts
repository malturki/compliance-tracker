import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error: authError } = await requireRole('viewer', req)
  if (authError) return authError

  await dbReady

  // Confirm the parent exists so callers get a clean 404 for bad IDs rather
  // than an empty 200 that ambiguously means "no children yet."
  const [parent] = await db.select().from(obligations).where(eq(obligations.id, params.id))
  if (!parent) {
    return NextResponse.json({ error: 'Obligation not found' }, { status: 404 })
  }

  const children = await db
    .select()
    .from(obligations)
    .where(eq(obligations.parentId, params.id))
  children.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

  return NextResponse.json({ parent: { id: parent.id, title: parent.title }, children })
}
