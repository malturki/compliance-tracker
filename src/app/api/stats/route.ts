import { NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { computeStatus } from '@/lib/utils'
import { requireRole } from '@/lib/auth-helpers'
import { addDays, startOfDay, endOfDay, endOfMonth } from 'date-fns'
import type { Stats } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { error: authError } = await requireRole('viewer')
    if (authError) return authError

    await dbReady
    const rows = await db.select().from(obligations)

    const today = startOfDay(new Date())
    const weekEnd = endOfDay(addDays(today, 7))
    const monthEnd = endOfMonth(today)

    const stats: Stats = {
      total: rows.length,
      overdue: 0,
      dueThisWeek: 0,
      dueThisMonth: 0,
      current: 0,
      byCategory: {},
      byRisk: { critical: 0, high: 0, medium: 0, low: 0 },
    }

    for (const row of rows) {
      const status = computeStatus(row.nextDueDate, row.lastCompletedDate)
      const due = new Date(row.nextDueDate)

      if (status === 'overdue') stats.overdue++
      else if (status === 'current' || status === 'upcoming') {
        if (due <= weekEnd) stats.dueThisWeek++
        if (due <= monthEnd) stats.dueThisMonth++
      }
      if (status === 'current') stats.current++

      const cat = row.category
      if (!stats.byCategory[cat]) stats.byCategory[cat] = { total: 0, overdue: 0 }
      stats.byCategory[cat].total++
      if (status === 'overdue') stats.byCategory[cat].overdue++

      const risk = row.riskLevel as string
      if (risk in stats.byRisk) stats.byRisk[risk]++
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
