import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { obligations, completions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { computeNextDueDate } from '@/lib/utils'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]

    const rows = await db.select().from(obligations).where(eq(obligations.id, params.id))
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const obligation = rows[0]
    const completionId = ulid()

    // Create completion record
    await db.insert(completions).values({
      id: completionId,
      obligationId: params.id,
      completedDate: body.completedDate || today,
      completedBy: body.completedBy || 'Unknown',
      evidenceUrl: body.evidenceUrl ?? null,
      notes: body.notes ?? null,
      createdAt: now,
    })

    // Update obligation
    const updateData: Record<string, unknown> = {
      lastCompletedDate: body.completedDate || today,
      updatedAt: now,
    }

    // If auto-recur, advance next due date
    if (obligation.autoRecur && obligation.frequency !== 'event-triggered' && obligation.frequency !== 'one-time') {
      updateData['nextDueDate'] = computeNextDueDate(obligation.nextDueDate, obligation.frequency)
    }

    await db.update(obligations).set(updateData as any).where(eq(obligations.id, params.id))

    return NextResponse.json({ id: completionId, success: true }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to record completion' }, { status: 500 })
  }
}
