import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { computeStatus, formatDate, getCategoryLabel } from '@/lib/utils'
import { FileText, AlertTriangle, Calendar, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const CATEGORY_ICONS: Record<string, any> = {
  tax: FileText,
  investor: TrendingUp,
  equity: TrendingUp,
  state: FileText,
  federal: FileText,
  contract: FileText,
  insurance: AlertTriangle,
  benefits: Calendar,
  governance: FileText,
  vendor: FileText,
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  tax: 'Federal, state, and local tax filings',
  investor: 'Investor reporting and consent obligations',
  equity: 'Stock options, valuations, and cap table compliance',
  state: 'State-level corporate filings and registrations',
  federal: 'Federal regulatory filings (SEC, FinCEN)',
  contract: 'Client contracts, employment, and vendor agreements',
  insurance: 'D&O, liability, workers comp, and cyber insurance',
  benefits: 'Health, retirement, and employee benefit compliance',
  governance: 'Board meetings, stockholder consents, corporate records',
  vendor: 'SaaS subscriptions, domains, and service renewals',
}

async function getData() {
  await dbReady
  const rows = await db.select().from(obligations)
  const enriched = rows.map(row => ({
    ...row,
    computedStatus: computeStatus(row.nextDueDate, row.lastCompletedDate),
  }))

  const byCategory: Record<string, {
    total: number
    overdue: number
    upcoming: number
    nextDeadline: string | null
    overdueItems: typeof enriched
    upcomingItems: typeof enriched
  }> = {}

  for (const row of enriched) {
    if (!byCategory[row.category]) {
      byCategory[row.category] = {
        total: 0,
        overdue: 0,
        upcoming: 0,
        nextDeadline: null,
        overdueItems: [],
        upcomingItems: [],
      }
    }
    byCategory[row.category].total++
    if (row.computedStatus === 'overdue') {
      byCategory[row.category].overdue++
      byCategory[row.category].overdueItems.push(row)
    }
    if (row.computedStatus === 'upcoming') {
      byCategory[row.category].upcoming++
      byCategory[row.category].upcomingItems.push(row)
    }
    if (!byCategory[row.category].nextDeadline || row.nextDueDate < byCategory[row.category].nextDeadline!) {
      byCategory[row.category].nextDeadline = row.nextDueDate
    }
  }

  // Sort overdue and upcoming by date
  Object.values(byCategory).forEach(cat => {
    cat.overdueItems.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    cat.upcomingItems.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
  })

  const sortedCategories = Object.keys(byCategory).sort((a, b) => {
    // Sort by overdue count first, then total
    const aDanger = byCategory[a].overdue
    const bDanger = byCategory[b].overdue
    if (aDanger !== bDanger) return bDanger - aDanger
    return byCategory[b].total - byCategory[a].total
  })

  return { byCategory, sortedCategories, totalObs: enriched.length }
}

export default async function CategoriesPage() {
  const { byCategory, sortedCategories, totalObs } = await getData()

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Categories</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {sortedCategories.length} categories • {totalObs} total obligations
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {sortedCategories.map(cat => {
          const data = byCategory[cat]
          const Icon = CATEGORY_ICONS[cat] || FileText
          const hasProblems = data.overdue > 0

          return (
            <div
              key={cat}
              className={`border bg-[#0f1629] overflow-hidden transition-all
                ${hasProblems ? 'border-red-900/40' : 'border-[#1e2d47]'}
              `}
            >
              {/* Header */}
              <div className={`px-4 py-3 border-b flex items-center justify-between
                ${hasProblems ? 'bg-red-950/20 border-red-900/40' : 'bg-[#0a0e1a] border-[#1e2d47]'}
              `}>
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${hasProblems ? 'text-red-400' : 'text-amber-500'}`} />
                  <div>
                    <Link
                      href={`/obligations?category=${cat}`}
                      className={`text-sm font-semibold hover:text-amber-400 transition-colors
                        ${hasProblems ? 'text-red-300' : 'text-slate-100'}
                      `}
                    >
                      {getCategoryLabel(cat)}
                    </Link>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {CATEGORY_DESCRIPTIONS[cat] || 'Compliance obligations'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-slate-200">{data.total}</div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider">total</div>
                </div>
              </div>

              {/* Stats row */}
              <div className="px-4 py-2.5 border-b border-[#1e2d47] bg-[#0a0e1a]/50 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">Overdue</div>
                  <div className={`text-lg font-mono font-semibold ${data.overdue > 0 ? 'text-red-400' : 'text-slate-700'}`}>
                    {data.overdue}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">Upcoming</div>
                  <div className={`text-lg font-mono font-semibold ${data.upcoming > 0 ? 'text-amber-400' : 'text-slate-700'}`}>
                    {data.upcoming}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">Next Due</div>
                  <div className="text-xs font-mono text-slate-400">
                    {data.nextDeadline ? formatDate(data.nextDeadline) : '—'}
                  </div>
                </div>
              </div>

              {/* Items preview */}
              <div className="p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                {data.overdueItems.slice(0, 3).map(item => (
                  <Link
                    key={item.id}
                    href={`/obligations?id=${item.id}`}
                    className="block text-xs bg-red-950/20 border border-red-900/30 p-2 hover:bg-red-950/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-red-300 font-medium leading-tight flex-1">{item.title}</span>
                      <span className="text-[10px] font-mono text-red-400 flex-shrink-0">{formatDate(item.nextDueDate)}</span>
                    </div>
                    {item.owner && (
                      <div className="text-[10px] text-slate-600 mt-0.5">{item.owner}</div>
                    )}
                  </Link>
                ))}
                {data.upcomingItems.slice(0, 3 - data.overdueItems.length).map(item => (
                  <Link
                    key={item.id}
                    href={`/obligations?id=${item.id}`}
                    className="block text-xs bg-[#0a0e1a] border border-[#1e2d47] p-2 hover:bg-[#162035] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-200 leading-tight flex-1">{item.title}</span>
                      <span className="text-[10px] font-mono text-amber-400 flex-shrink-0">{formatDate(item.nextDueDate)}</span>
                    </div>
                    {item.owner && (
                      <div className="text-[10px] text-slate-600 mt-0.5">{item.owner}</div>
                    )}
                  </Link>
                ))}
                {data.total === 0 && (
                  <div className="text-xs text-slate-600 text-center py-4">No obligations in this category</div>
                )}
                {data.total > 3 && (
                  <Link
                    href={`/obligations?category=${cat}`}
                    className="block text-xs text-center text-amber-400 hover:text-amber-300 pt-1"
                  >
                    View all {data.total} →
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
