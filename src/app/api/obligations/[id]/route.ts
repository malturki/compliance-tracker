import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { obligations, completions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { computeStatus } from '@/lib/utils'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const rows = await db.select().from(obligations).where(eq(obligations.id, params.id))
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const row = rows[0]
    const comps = await db.select().from(completions).where(eq(completions.obligationId, params.id))

    const computed = computeStatus(row.nextDueDate, row.lastCompletedDate)
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
    const body = await req.json()
    const now = new Date().toISOString()

    const updateData: Record<string, unknown> = { updatedAt: now }
    const allowed = [
      'title', 'description', 'category', 'subcategory', 'frequency',
      'nextDueDate', 'lastCompletedDate', 'owner', 'assignee', 'riskLevel',
      'sourceDocument', 'notes', 'entity', 'jurisdiction', 'amount', 'autoRecur',
    ]
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }
    if ('alertDays' in body) updateData['alertDays'] = JSON.stringify(body.alertDays)

    await db.update(obligations).set(updateData as any).where(eq(obligations.id, params.id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update obligation' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await db.delete(completions).where(eq(completions.obligationId, params.id))
    await db.delete(obligations).where(eq(obligations.id, params.id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete obligation' }, { status: 500 })
  }
}
