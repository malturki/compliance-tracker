import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { templates, calculateDueDate, formatDueDateForDb } from '@/data/templates'
import type { TemplateObligation } from '@/data/templates'
import { ulid } from 'ulid'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { error: authError } = await requireRole('viewer')
    if (authError) return authError

    await dbReady
    const templateList = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      obligationCount: t.obligations.length,
    }))
    return NextResponse.json({ templates: templateList })
  } catch (error: any) {
    console.error('Error listing templates:', error)
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireRole('editor', request)
    if (authError) return authError

    await dbReady
    const body = await request.json()
    const { templateId, customizations } = body

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
    }

    const template = templates.find(t => t.id === templateId)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    let obligationsToImport = template.obligations
    if (customizations?.selectedObligationIndexes) {
      obligationsToImport = customizations.selectedObligationIndexes
        .map((idx: number) => template.obligations[idx])
        .filter(Boolean)
    }

    const owner = customizations?.owner || undefined
    const entity = customizations?.entity || 'Acme Corp'

    const now = new Date().toISOString()
    const records = obligationsToImport.map((tpl: TemplateObligation) => {
      const dueDate = calculateDueDate(tpl.relativeDueDate)
      return {
        id: ulid(),
        title: tpl.title,
        description: tpl.description || null,
        category: tpl.category,
        subcategory: tpl.subcategory || null,
        frequency: tpl.frequency,
        nextDueDate: formatDueDateForDb(dueDate),
        lastCompletedDate: null,
        owner: owner || tpl.owner,
        ownerEmail: null,
        assignee: null,
        assigneeEmail: null,
        status: 'current',
        riskLevel: tpl.riskLevel,
        alertDays: JSON.stringify(tpl.alertDays),
        lastAlertSent: null,
        sourceDocument: null,
        notes: tpl.notes || null,
        entity,
        jurisdiction: tpl.jurisdiction || null,
        amount: tpl.amount || null,
        autoRecur: tpl.autoRecur || false,
        templateId: templateId,
        createdAt: now,
        updatedAt: now,
      }
    })

    await db.insert(obligations).values(records)

    const actor = await getActor(request)
    const createdIds = records.map(o => o.id)
    await logEvent({
      type: 'template.applied',
      actor,
      entityType: 'template',
      entityId: templateId,
      summary: `Applied template "${template.name}" (${createdIds.length} obligations)`,
      metadata: { templateId, createdIds, count: createdIds.length },
    })

    return NextResponse.json({
      success: true,
      message: `Created ${records.length} obligations from "${template.name}"`,
      count: records.length,
      obligationIds: createdIds,
    })
  } catch (error: any) {
    console.error('Error applying template:', error)
    return NextResponse.json({ error: error.message || 'Failed to apply template' }, { status: 500 })
  }
}
