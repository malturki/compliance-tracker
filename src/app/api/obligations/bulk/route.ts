import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'

type BulkAction = 'mark-complete' | 'update-owner' | 'update-risk' | 'delete'

interface BulkRequest {
  action: BulkAction
  ids: string[]
  data?: {
    owner?: string
    ownerEmail?: string
    riskLevel?: 'critical' | 'high' | 'medium' | 'low'
    completedBy?: string
    completionNotes?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbReady
    const body: BulkRequest = await request.json()
    const { action, ids, data } = body

    // Validate
    if (!action || !ids || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: action and ids are required' },
        { status: 400 }
      )
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Cannot process more than 100 items at once' },
        { status: 400 }
      )
    }

    // Execute action
    let result: any

    switch (action) {
      case 'mark-complete':
        if (!data?.completedBy) {
          return NextResponse.json(
            { error: 'completedBy is required for mark-complete action' },
            { status: 400 }
          )
        }

        // For each obligation, mark as complete via the completion endpoint
        const completeResults = await Promise.allSettled(
          ids.map(async (id) => {
            const res = await fetch(
              `${request.nextUrl.origin}/api/obligations/${id}/complete`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  completedBy: data.completedBy,
                  notes: data.completionNotes || '',
                }),
              }
            )
            if (!res.ok) throw new Error(`Failed to complete ${id}`)
            return id
          })
        )

        const completed = completeResults.filter(r => r.status === 'fulfilled').length
        const failed = completeResults.filter(r => r.status === 'rejected').length

        result = {
          action: 'mark-complete',
          completed,
          failed,
          total: ids.length,
        }
        break

      case 'update-owner':
        if (!data?.owner) {
          return NextResponse.json(
            { error: 'owner is required for update-owner action' },
            { status: 400 }
          )
        }

        const ownerUpdate = await db
          .update(obligations)
          .set({
            owner: data.owner,
            ownerEmail: data.ownerEmail || null,
            updatedAt: new Date().toISOString(),
          })
          .where(inArray(obligations.id, ids))

        result = {
          action: 'update-owner',
          updated: ids.length,
          owner: data.owner,
        }
        break

      case 'update-risk':
        if (!data?.riskLevel) {
          return NextResponse.json(
            { error: 'riskLevel is required for update-risk action' },
            { status: 400 }
          )
        }

        const riskUpdate = await db
          .update(obligations)
          .set({
            riskLevel: data.riskLevel,
            updatedAt: new Date().toISOString(),
          })
          .where(inArray(obligations.id, ids))

        result = {
          action: 'update-risk',
          updated: ids.length,
          riskLevel: data.riskLevel,
        }
        break

      case 'delete':
        // Delete obligations
        const deleteResult = await db
          .delete(obligations)
          .where(inArray(obligations.id, ids))

        result = {
          action: 'delete',
          deleted: ids.length,
        }
        break

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    const actor = await getActor(request)
    await logEvent({
      type: 'obligation.bulk_updated',
      actor,
      entityType: 'obligation',
      entityId: null,
      summary: `Bulk ${action} on ${ids.length} obligations`,
      metadata: { action, ids, count: ids.length },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Bulk operation error:', error)
    return NextResponse.json(
      { error: 'Failed to execute bulk operation' },
      { status: 500 }
    )
  }
}
