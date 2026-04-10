import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['viewer', 'editor', 'admin'] as const

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady
    const body = await req.json()
    const newRole = body.role

    if (!VALID_ROLES.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const existing = await db.select().from(users).where(eq(users.id, params.id))
    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = existing[0]
    const oldRole = user.role

    if (oldRole === newRole) {
      return NextResponse.json({ success: true })
    }

    if (oldRole === 'admin' && newRole !== 'admin') {
      const adminCount = (await db.select().from(users).where(eq(users.role, 'admin'))).length
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 400 })
      }
    }

    await db.update(users).set({ role: newRole, updatedAt: new Date().toISOString() }).where(eq(users.id, params.id))

    const actor = await getActor(req)
    await logEvent({
      type: 'obligation.updated' as any,
      actor,
      entityType: 'obligation' as any,
      entityId: params.id,
      summary: `Changed ${user.email} role from ${oldRole} to ${newRole}`,
      diff: { role: [oldRole, newRole] },
      metadata: { userId: params.id, email: user.email },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update user role error:', err)
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
  }
}
