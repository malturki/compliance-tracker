import { NextRequest, NextResponse } from 'next/server'
import { templates, calculateDueDate, formatDueDateForDb } from '@/data/templates'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const template = templates.find(t => t.id === params.id)
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const obligationsWithDates = template.obligations.map((obl, index) => {
      const dueDate = calculateDueDate(obl.relativeDueDate)
      return {
        index,
        title: obl.title,
        description: obl.description,
        category: obl.category,
        frequency: obl.frequency,
        owner: obl.owner,
        riskLevel: obl.riskLevel,
        jurisdiction: obl.jurisdiction,
        amount: obl.amount,
        notes: obl.notes,
        previewDueDate: formatDueDateForDb(dueDate),
        autoRecur: obl.autoRecur,
      }
    })

    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      obligations: obligationsWithDates,
    })
  } catch (error: any) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}
