import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations, completions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { computeNextDueDate } from '@/lib/utils'
import { uploadToBlob, validateFile } from '@/lib/blob'
import { completeObligationSchema, formatZodError } from '@/lib/validation'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { error: authError } = await requireRole('editor', req)
    if (authError) return authError

    await dbReady
    const contentType = req.headers.get('content-type') || ''
    let data: {
      completedBy: string
      completedDate: string
      notes: string | null
      evidenceUrls: string[]
    }
    let files: File[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()

      data = {
        completedBy: formData.get('completedBy') as string,
        completedDate: (formData.get('completedDate') as string) || new Date().toISOString().split('T')[0],
        notes: formData.get('notes') as string | null,
        evidenceUrls: formData.get('evidenceUrls') ? JSON.parse(formData.get('evidenceUrls') as string) : [],
      }

      // Extract files (keyed as file_0, file_1, etc.)
      Array.from(formData.entries()).forEach(([key, value]) => {
        if (key.startsWith('file_') && value instanceof File) {
          files.push(value)
        }
      })

      if (files.length > 5) {
        return NextResponse.json(
          { error: 'Maximum 5 files allowed per completion' },
          { status: 400 }
        )
      }

      // Validate each file
      for (const file of files) {
        const validation = validateFile(file, 10)
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error },
            { status: 400 }
          )
        }
      }

      // Upload files to Vercel Blob
      const uploadedUrls = await Promise.all(
        files.map((file) => uploadToBlob(file))
      )

      data.evidenceUrls = [...data.evidenceUrls, ...uploadedUrls]
    } else {
      // JSON request (backward compatible)
      const body = await req.json()
      data = {
        completedBy: body.completedBy,
        completedDate: body.completedDate || new Date().toISOString().split('T')[0],
        notes: body.notes || null,
        evidenceUrls: body.evidenceUrl ? [body.evidenceUrl] : [],
      }
    }

    // Validate input data
    const validationResult = completeObligationSchema.safeParse({
      completedBy: data.completedBy,
      completedDate: data.completedDate,
      notes: data.notes,
      evidenceUrl: data.evidenceUrls.length > 0 ? data.evidenceUrls[0] : undefined,
    });
    
    if (!validationResult.success) {
      return NextResponse.json(formatZodError(validationResult.error), { status: 400 });
    }

    const now = new Date().toISOString()
    const rows = await db.select().from(obligations).where(eq(obligations.id, params.id))
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Obligation not found' }, { status: 404 })
    }

    const obligation = rows[0]
    const completionId = ulid()

    await db.transaction(async (tx) => {
      await tx.insert(completions).values({
        id: completionId,
        obligationId: params.id,
        completedDate: data.completedDate,
        completedBy: data.completedBy,
        evidenceUrl: data.evidenceUrls.length > 0 ? JSON.stringify(data.evidenceUrls) : null,
        notes: data.notes,
        createdAt: now,
      })

      const updateData: Partial<typeof obligations.$inferSelect> = {
        lastCompletedDate: data.completedDate,
        updatedAt: now,
      }

      if (obligation.autoRecur && obligation.frequency !== 'event-triggered' && obligation.frequency !== 'one-time') {
        const baseDate = new Date(data.completedDate) > new Date(obligation.nextDueDate) 
          ? data.completedDate 
          : obligation.nextDueDate
        updateData['nextDueDate'] = computeNextDueDate(baseDate, obligation.frequency)
      }

      await tx.update(obligations).set(updateData).where(eq(obligations.id, params.id))
    })

    const actor = await getActor(req)
    await logEvent({
      type: 'obligation.completed',
      actor,
      entityType: 'obligation',
      entityId: params.id,
      summary: `Marked "${obligation.title}" complete`,
      metadata: {
        completionId,
        evidenceCount: data.evidenceUrls.length,
        completedBy: data.completedBy,
      },
    })

    return NextResponse.json(
      {
        id: completionId,
        success: true,
        evidenceUrls: data.evidenceUrls,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Complete obligation error:', err)
    return NextResponse.json(
      { error: 'Failed to record completion' },
      { status: 500 }
    )
  }
}
