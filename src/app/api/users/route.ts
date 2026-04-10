import { NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { users } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt))
    return NextResponse.json({ users: allUsers })
  } catch (err) {
    console.error('Users list error:', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
