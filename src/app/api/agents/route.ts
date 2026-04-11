import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { agents } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { ulid } from 'ulid'
import { requireRole } from '@/lib/auth-helpers'
import { generateToken, hashToken } from '@/lib/token-utils'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['viewer', 'editor', 'admin'] as const

export async function GET() {
  const { error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady
    const rows = await db
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        role: agents.role,
        tokenPrefix: agents.tokenPrefix,
        createdBy: agents.createdBy,
        createdAt: agents.createdAt,
        expiresAt: agents.expiresAt,
        lastUsedAt: agents.lastUsedAt,
        revokedAt: agents.revokedAt,
      })
      .from(agents)
      .orderBy(desc(agents.createdAt))

    return NextResponse.json({ agents: rows })
  } catch (err) {
    console.error('Agents list error:', err)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady
    const body = await req.json()
    const { name, description, role, expiresInDays } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
    }

    const days = Number(expiresInDays ?? 365)
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return NextResponse.json({ error: 'expiresInDays must be between 1 and 3650' }, { status: 400 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + days * 86_400_000).toISOString()
    const rawToken = generateToken()
    const id = ulid()

    await db.insert(agents).values({
      id,
      name: name.trim(),
      description: description?.trim() || null,
      role,
      tokenHash: hashToken(rawToken),
      tokenPrefix: rawToken.slice(0, 15),
      createdBy: session!.user.email,
      createdAt: now.toISOString(),
      expiresAt,
      lastUsedAt: null,
      revokedAt: null,
    })

    const actor = await getActor(req)
    await logEvent({
      type: 'agent.created',
      actor,
      entityType: 'agent',
      entityId: id,
      summary: `Created agent "${name}" with role ${role}`,
      metadata: { agentId: id, name, role, expiresAt },
    })

    return NextResponse.json({ id, token: rawToken, expiresAt }, { status: 201 })
  } catch (err) {
    console.error('Create agent error:', err)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
