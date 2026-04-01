import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { obligations } from '@/db/schema'
import { eq, and, like, asc, desc, or } from 'drizzle-orm'
import { ulid } from 'ulid'
import { computeStatus } from '@/lib/utils'
import { createObligationSchema } from '@/lib/validation'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const category = searchParams.get('category')
    const statusFilter = searchParams.get('status')
    const riskLevel = searchParams.get('risk_level')
    const owner = searchParams.get('owner')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sort_by') || 'next_due_date'
    const sortDir = searchParams.get('sort_dir') || 'asc'

    const conditions = []
    if (category) conditions.push(eq(obligations.category, category))
    if (riskLevel) conditions.push(eq(obligations.riskLevel, riskLevel))
    if (owner) conditions.push(eq(obligations.owner, owner))
    if (search) conditions.push(like(obligations.title, `%${search}%`))

    const rows = await db
      .select()
      .from(obligations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    const result = rows.map(row => {
      const computed = computeStatus(row.nextDueDate, row.lastCompletedDate)
      return {
        ...row,
        alertDays: JSON.parse(row.alertDays || '[]'),
        status: computed,
      }
    })

    const filtered = statusFilter ? result.filter(r => r.status === statusFilter) : result

    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      switch (sortBy) {
        case 'next_due_date': aVal = a.nextDueDate; bVal = b.nextDueDate; break
        case 'title': aVal = a.title; bVal = b.title; break
        case 'category': aVal = a.category; bVal = b.category; break
        case 'risk_level': {
          const order = { critical: 0, high: 1, medium: 2, low: 3 }
          aVal = order[a.riskLevel as keyof typeof order] ?? 2
          bVal = order[b.riskLevel as keyof typeof order] ?? 2
          break
        }
        default: aVal = a.nextDueDate; bVal = b.nextDueDate
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return NextResponse.json(sorted)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch obligations' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate input
    const result = createObligationSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 })
    }
    
    const data = result.data
    const now = new Date().toISOString()
    const id = ulid()

    const status = computeStatus(data.nextDueDate, data.lastCompletedDate ?? null)

    await db.insert(obligations).values({
      id,
      title: data.title,
      description: data.description ?? null,
      category: data.category,
      subcategory: data.subcategory ?? null,
      frequency: data.frequency,
      nextDueDate: data.nextDueDate,
      lastCompletedDate: data.lastCompletedDate ?? null,
      owner: data.owner,
      assignee: data.assignee ?? null,
      status,
      riskLevel: data.riskLevel,
      alertDays: JSON.stringify(data.alertDays),
      sourceDocument: data.sourceDocument ?? null,
      notes: data.notes ?? null,
      entity: data.entity,
      jurisdiction: data.jurisdiction ?? null,
      amount: data.amount ?? null,
      autoRecur: data.autoRecur,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create obligation' }, { status: 500 })
  }
}
