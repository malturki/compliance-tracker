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
import { maybeRollupParent } from '@/lib/playbooks'
import type { VerificationStatus } from '@/lib/types'

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
      approvedBy: string | null
      approvedDate: string | null
      verificationStatus: VerificationStatus | null
      summary: string | null
    }
    let files: File[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()

      data = {
        completedBy: formData.get('completedBy') as string,
        completedDate: (formData.get('completedDate') as string) || new Date().toISOString().split('T')[0],
        notes: (formData.get('notes') as string | null) ?? null,
        evidenceUrls: formData.get('evidenceUrls') ? JSON.parse(formData.get('evidenceUrls') as string) : [],
        approvedBy: (formData.get('approvedBy') as string | null) ?? null,
        approvedDate: (formData.get('approvedDate') as string | null) ?? null,
        verificationStatus: (formData.get('verificationStatus') as VerificationStatus | null) ?? null,
        summary: (formData.get('summary') as string | null) ?? null,
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

      // Validate each file (default 25 MB cap from validateFile).
      for (const file of files) {
        const validation = validateFile(file)
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
      // JSON request — accepts both the legacy single-URL shape and the new
      // evidence-packet shape. evidenceUrls (array) wins if both are present.
      const body = await req.json()
      const urlsFromArray = Array.isArray(body.evidenceUrls) ? body.evidenceUrls : null
      data = {
        completedBy: body.completedBy,
        completedDate: body.completedDate || new Date().toISOString().split('T')[0],
        notes: body.notes ?? null,
        evidenceUrls: urlsFromArray ?? (body.evidenceUrl ? [body.evidenceUrl] : []),
        approvedBy: body.approvedBy ?? null,
        approvedDate: body.approvedDate ?? null,
        verificationStatus: body.verificationStatus ?? null,
        summary: body.summary ?? null,
      }
    }

    // Validate input data
    const validationResult = completeObligationSchema.safeParse({
      completedBy: data.completedBy,
      completedDate: data.completedDate,
      notes: data.notes,
      evidenceUrl: data.evidenceUrls.length > 0 ? data.evidenceUrls[0] : undefined,
      evidenceUrls: data.evidenceUrls.length > 0 ? data.evidenceUrls : undefined,
      approvedBy: data.approvedBy || undefined,
      approvedDate: data.approvedDate || undefined,
      verificationStatus: data.verificationStatus || undefined,
      summary: data.summary || undefined,
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

    // Decide whether this completion terminates the obligation (no recurrence
    // rollover) so we can explicitly set status='completed'. Sub-obligations
    // (parent_id set) and non-recurring obligations terminate on completion.
    const willRecur =
      obligation.autoRecur &&
      obligation.frequency !== 'event-triggered' &&
      obligation.frequency !== 'one-time'

    await db.transaction(async (tx) => {
      await tx.insert(completions).values({
        id: completionId,
        obligationId: params.id,
        completedDate: data.completedDate,
        completedBy: data.completedBy,
        evidenceUrl: data.evidenceUrls.length > 0 ? JSON.stringify(data.evidenceUrls) : null,
        evidenceUrls: data.evidenceUrls.length > 0 ? JSON.stringify(data.evidenceUrls) : null,
        notes: data.notes,
        approvedBy: data.approvedBy,
        approvedDate: data.approvedDate,
        verificationStatus: data.verificationStatus ?? 'unverified',
        summary: data.summary,
        createdAt: now,
      })

      const updateData: Partial<typeof obligations.$inferSelect> = {
        lastCompletedDate: data.completedDate,
        updatedAt: now,
      }

      if (willRecur) {
        const baseDate = new Date(data.completedDate) > new Date(obligation.nextDueDate)
          ? data.completedDate
          : obligation.nextDueDate
        updateData['nextDueDate'] = computeNextDueDate(baseDate, obligation.frequency)
      } else {
        // Terminal completion — mark the obligation itself as completed so
        // parent-rollup can detect it.
        updateData['status'] = 'completed'
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

    // If this obligation has a parent and all its siblings are now complete,
    // auto-complete the parent. No-op for top-level obligations.
    const rollup = !willRecur ? await maybeRollupParent(params.id, actor) : { parentCompleted: false as const }

    return NextResponse.json(
      {
        id: completionId,
        success: true,
        evidenceUrls: data.evidenceUrls,
        parentCompleted: rollup.parentCompleted,
        parentId: (rollup as any).parentId ?? null,
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
