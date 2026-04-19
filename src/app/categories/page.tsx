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

type CounterpartyStat = {
  name: string
  total: number
  overdue: number
  upcoming: number
  nextDeadline: string | null
}

async function getData() {
  await dbReady
  const rows = await db.select().from(obligations)
  const enriched = rows.map(row => ({
    ...row,
    computedStatus: computeStatus(row.nextDueDate, row.lastCompletedDate, row.frequency),
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

  // Counterparty rollup
  const byCounterparty = new Map<string, CounterpartyStat>()
  for (const row of enriched) {
    const name = (row.counterparty ?? '').trim()
    if (!name) continue
    let stat = byCounterparty.get(name)
    if (!stat) {
      stat = { name, total: 0, overdue: 0, upcoming: 0, nextDeadline: null }
      byCounterparty.set(name, stat)
    }
    stat.total++
    if (row.computedStatus === 'overdue') stat.overdue++
    if (row.computedStatus === 'upcoming') stat.upcoming++
    if (!stat.nextDeadline || row.nextDueDate < stat.nextDeadline) {
      stat.nextDeadline = row.nextDueDate
    }
  }
  const sortedCounterparties = Array.from(byCounterparty.values()).sort((a, b) => {
    if (a.overdue !== b.overdue) return b.overdue - a.overdue
    if (a.total !== b.total) return b.total - a.total
    return a.name.localeCompare(b.name)
  })

  return { byCategory, sortedCategories, totalObs: enriched.length, sortedCounterparties }
}

export default async function CategoriesPage() {
  const { byCategory, sortedCategories, totalObs, sortedCounterparties } = await getData()

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 border-b border-black/5 pb-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">Categories</h1>
          <p className="text-xs text-steel mt-0.5 font-mono">
            {sortedCategories.length} categories • {totalObs} total obligations
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedCategories.map(cat => {
          const data = byCategory[cat]
          const Icon = CATEGORY_ICONS[cat] || FileText
          const hasProblems = data.overdue > 0

          return (
            <div
              key={cat}
              className={`bg-white border rounded-card shadow-card overflow-hidden transition-all p-5
                ${hasProblems ? 'border-danger/30' : 'border-black/5'}
              `}
            >
              {/* Header */}
              <div className={`pb-3 border-b flex items-center justify-between
                ${hasProblems ? 'border-danger/30' : 'border-black/5'}
              `}>
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${hasProblems ? 'text-danger' : 'text-steel'}`} />
                  <div>
                    <Link
                      href={`/obligations?category=${cat}`}
                      className={`text-sm font-semibold hover:underline transition-colors
                        ${hasProblems ? 'text-danger' : 'text-graphite'}
                      `}
                    >
                      {getCategoryLabel(cat)}
                    </Link>
                    <div className="text-[10px] text-steel mt-0.5">
                      {CATEGORY_DESCRIPTIONS[cat] || 'Compliance obligations'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-graphite">{data.total}</div>
                  <div className="text-[9px] text-steel/70 uppercase tracking-wider">total</div>
                </div>
              </div>

              {/* Stats row */}
              <div className="py-3 border-b border-black/5 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[9px] text-steel/70 uppercase tracking-wider mb-0.5">Overdue</div>
                  <div className={`text-lg font-mono font-semibold ${data.overdue > 0 ? 'text-danger' : 'text-steel/60'}`}>
                    {data.overdue}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-steel/70 uppercase tracking-wider mb-0.5">Upcoming</div>
                  <div className={`text-lg font-mono font-semibold ${data.upcoming > 0 ? 'text-warning' : 'text-steel/60'}`}>
                    {data.upcoming}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-steel/70 uppercase tracking-wider mb-0.5">Next Due</div>
                  <div className="text-xs font-mono text-steel">
                    {data.nextDeadline ? formatDate(data.nextDeadline) : '—'}
                  </div>
                </div>
              </div>

              {/* Items preview */}
              <div className="pt-3 space-y-1.5 max-h-[200px] overflow-y-auto">
                {data.overdueItems.slice(0, 3).map(item => (
                  <Link
                    key={item.id}
                    href={`/obligations?id=${item.id}`}
                    className="block text-xs bg-danger/10 border border-danger/30 p-2 hover:bg-danger/20 transition-colors rounded"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-danger font-medium leading-tight flex-1">{item.title}</span>
                      <span className="text-[10px] font-mono text-danger flex-shrink-0">{formatDate(item.nextDueDate)}</span>
                    </div>
                    {item.owner && (
                      <div className="text-[10px] text-steel mt-0.5">{item.owner}</div>
                    )}
                  </Link>
                ))}
                {data.upcomingItems.slice(0, 3 - data.overdueItems.length).map(item => (
                  <Link
                    key={item.id}
                    href={`/obligations?id=${item.id}`}
                    className="block text-xs bg-white border border-black/5 p-2 hover:bg-silicon/[0.18] transition-colors rounded"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-graphite leading-tight flex-1">{item.title}</span>
                      <span className="text-[10px] font-mono text-warning flex-shrink-0">{formatDate(item.nextDueDate)}</span>
                    </div>
                    {item.owner && (
                      <div className="text-[10px] text-steel mt-0.5">{item.owner}</div>
                    )}
                  </Link>
                ))}
                {data.total === 0 && (
                  <div className="text-xs text-steel text-center py-4">No obligations in this category</div>
                )}
                {data.total > 3 && (
                  <Link
                    href={`/obligations?category=${cat}`}
                    className="block text-xs text-center text-graphite hover:underline pt-1"
                  >
                    View all {data.total} →
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* By counterparty */}
      {sortedCounterparties.length > 0 && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between mb-4 border-b border-black/5 pb-3">
            <h2 className="text-base font-semibold text-graphite">By counterparty</h2>
            <p className="text-[10px] text-steel font-mono uppercase tracking-wider">
              {sortedCounterparties.length} counterparties
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedCounterparties.map(cp => {
              const hasProblems = cp.overdue > 0
              return (
                <Link
                  key={cp.name}
                  href={`/obligations?counterparty=${encodeURIComponent(cp.name)}`}
                  className={`block bg-white border rounded-card p-3 hover:shadow-card transition-shadow
                    ${hasProblems ? 'border-danger/30' : 'border-black/5'}
                  `}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`text-xs font-medium leading-tight truncate ${hasProblems ? 'text-danger' : 'text-graphite'}`}>
                      {cp.name}
                    </span>
                    <span className="text-lg font-mono font-bold text-graphite flex-shrink-0 leading-none">
                      {cp.total}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    {cp.overdue > 0 && <span className="text-danger">{cp.overdue} overdue</span>}
                    {cp.upcoming > 0 && <span className="text-warning">{cp.upcoming} upcoming</span>}
                    {cp.nextDeadline && (
                      <span className="text-steel">next: {formatDate(cp.nextDeadline)}</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
