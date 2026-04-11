import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations, completions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { computeStatus } from '@/lib/utils'
import { updateObligationSchema, formatZodError } from '@/lib/validation'
import { getActor } from '@/lib/actor'
import { auditedUpdate } from '@/lib/audit-helpers'
import { logEvent } from '@/lib/audit'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { error: authError } = await requireRole('viewer', _req)
    if (authError) return authError
    await dbReady
    const rows = await db.select().from(obligations).where(eq(obligations.id, params.id))
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const row = rows[0]
    const comps = await db.select().from(completions).where(eq(completions.obligationId, params.id))

    const computed = computeStatus(row.nextDueDate, row.lastCompletedDate, row.frequency)
    return NextResponse.json({
      ...row,
      alertDays: JSON.parse(row.alertDays || '[]'),
      status: computed,
      completions: comps,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch obligation' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { error: authError } = await requireRole('editor', req)
    if (authError) return authError
    await dbReady
    const body = await req.json()
    
    // Validate input
    const result = updateObligationSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(formatZodError(result.error), { status: 400 })
    }
    
    const data = result.data

    const updateData: Partial<typeof obligations.$inferSelect> = {}
    const allowed = [
      'title', 'description', 'category', 'subcategory', 'frequency',
      'nextDueDate', 'lastCompletedDate', 'owner', 'ownerEmail', 'assignee', 'assigneeEmail', 'riskLevel',
      'sourceDocument', 'notes', 'entity', 'counterparty', 'jurisdiction', 'amount', 'autoRecur',
    ] as const
    
    for (const key of allowed) {
      if (key in data) {
        updateData[key] = data[key] as any
      }
    }
    if ('alertDays' in data) {
      updateData['alertDays'] = JSON.stringify(data.alertDays)
    }

    const actor = await getActor(req)
    const updated = await auditedUpdate(params.id, updateData, actor)
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update obligation' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { error: authError } = await requireRole('editor', req)
    if (authError) return authError
    await dbReady
    const existing = (await db.select().from(obligations).where(eq(obligations.id, params.id)))[0]
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const actor = await getActor(req)
    await db.delete(completions).where(eq(completions.obligationId, params.id))
    await db.delete(obligations).where(eq(obligations.id, params.id))

    await logEvent({
      type: 'obligation.deleted',
      actor,
      entityType: 'obligation',
      entityId: params.id,
      summary: `Deleted "${existing.title}"`,
      metadata: { snapshot: existing },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete obligation' }, { status: 500 })
  }
}
