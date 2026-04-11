import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { agents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'
import { generateToken, hashToken } from '@/lib/token-utils'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireRole('admin', req)
  if (error) return error

  try {
    await dbReady

    const rows = await db.select().from(agents).where(eq(agents.id, params.id))
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const agent = rows[0]
    if (agent.revokedAt) {
      return NextResponse.json({ error: 'Cannot regenerate a revoked agent' }, { status: 400 })
    }

    const rawToken = generateToken()
    const tokenHash = await hashToken(rawToken)
    const now = new Date().toISOString()

    await db
      .update(agents)
      .set({
        tokenHash,
        tokenPrefix: rawToken.slice(0, 15),
      })
      .where(eq(agents.id, params.id))

    const actor = await getActor(req)
    await logEvent({
      type: 'agent.regenerated',
      actor,
      entityType: 'agent',
      entityId: params.id,
      summary: `Regenerated token for agent "${agent.name}"`,
      metadata: { agentId: params.id, name: agent.name, regeneratedAt: now },
    })

    return NextResponse.json({ token: rawToken, expiresAt: agent.expiresAt })
  } catch (err) {
    console.error('Regenerate agent error:', err)
    return NextResponse.json({ error: 'Failed to regenerate agent token' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireRole('admin', req)
  if (error) return error

  try {
    await dbReady

    const rows = await db.select().from(agents).where(eq(agents.id, params.id))
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const agent = rows[0]
    if (agent.revokedAt) {
      return NextResponse.json({ success: true, message: 'Agent already revoked' })
    }

    const now = new Date().toISOString()
    await db.update(agents).set({ revokedAt: now }).where(eq(agents.id, params.id))

    const actor = await getActor(req)
    await logEvent({
      type: 'agent.revoked',
      actor,
      entityType: 'agent',
      entityId: params.id,
      summary: `Revoked agent "${agent.name}"`,
      metadata: { agentId: params.id, name: agent.name, revokedAt: now },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Revoke agent error:', err)
    return NextResponse.json({ error: 'Failed to revoke agent' }, { status: 500 })
  }
}
