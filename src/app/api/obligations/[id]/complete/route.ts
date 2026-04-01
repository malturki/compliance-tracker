import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { obligations, completions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { computeNextDueDate } from '@/lib/utils'
import { completeObligationSchema } from '@/lib/validation'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    
    // Validate input
    const result = completeObligationSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 })
    }
    
    const data = result.data
    const now = new Date().toISOString()

    const rows = await db.select().from(obligations).where(eq(obligations.id, params.id))
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const obligation = rows[0]
    const completionId = ulid()
    const completedDate = data.completedDate

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Create completion record
      await tx.insert(completions).values({
        id: completionId,
        obligationId: params.id,
        completedDate,
        completedBy: data.completedBy,
        evidenceUrl: data.evidenceUrl ?? null,
        notes: data.notes ?? null,
        createdAt: now,
      })

      // Update obligation
      const updateData: Partial<typeof obligations.$inferSelect> = {
        lastCompletedDate: completedDate,
        updatedAt: now,
      }

      // If auto-recur, advance next due date
      // Use max of completion date and current next due date as the base
      if (obligation.autoRecur && obligation.frequency !== 'event-triggered' && obligation.frequency !== 'one-time') {
        const baseDate = new Date(completedDate) > new Date(obligation.nextDueDate) 
          ? completedDate 
          : obligation.nextDueDate
        updateData['nextDueDate'] = computeNextDueDate(baseDate, obligation.frequency)
      }

      await tx.update(obligations).set(updateData).where(eq(obligations.id, params.id))
    })

    return NextResponse.json({ id: completionId, success: true }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to record completion' }, { status: 500 })
  }
}
