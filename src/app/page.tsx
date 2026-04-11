import { db, dbReady } from '@/db'
import { obligations } from '@/db/schema'
import { computeStatus, formatDate, getDaysUntil, getRiskColor, getCategoryLabel } from '@/lib/utils'
import { format } from 'date-fns'
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getData() {
  await dbReady
  const rows = await db.select().from(obligations)
  const today = new Date()

  const enriched = rows.map(row => ({
    ...row,
    alertDays: JSON.parse(row.alertDays || '[]') as number[],
    computedStatus: computeStatus(row.nextDueDate, row.lastCompletedDate, row.frequency),
  }))

  const overdue = enriched.filter(r => r.computedStatus === 'overdue')
  const upcoming = enriched
    .filter(r => r.computedStatus === 'upcoming')
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))

  const dueThisMonth = enriched
    .filter(r => {
      const due = new Date(r.nextDueDate)
      return (
        due.getFullYear() === today.getFullYear() &&
        due.getMonth() === today.getMonth() &&
        r.computedStatus !== 'overdue' &&
        r.computedStatus !== 'upcoming'
      )
    })
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))

  const byCategory: Record<string, { total: number; overdue: number }> = {}
  for (const row of enriched) {
    if (!byCategory[row.category]) byCategory[row.category] = { total: 0, overdue: 0 }
    byCategory[row.category].total++
    if (row.computedStatus === 'overdue') byCategory[row.category].overdue++
  }

  return {
    total: enriched.length,
    overdueCount: overdue.length,
    dueThisWeekCount: enriched.filter(r => r.computedStatus === 'upcoming').length,
    dueThisMonthCount: dueThisMonth.length,
    overdue,
    upcoming,
    dueThisMonth,
    byCategory,
  }
}

export default async function OverviewPage() {
  const data = await getData()
  const today = new Date()
  const session = await auth()
  const isViewer = session?.user?.role === 'viewer'

  const categoryKeys = Object.keys(data.byCategory).sort()
  const maxTotal = Math.max(...categoryKeys.map(k => data.byCategory[k].total), 1)

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">Pi Squared Inc. — Compliance Dashboard</p>
        </div>
        <div className="text-xs font-mono text-slate-500">{format(today, 'EEE, MMM d yyyy')}</div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0f1629] border border-[#1e2d47] p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total</div>
          <div className="text-3xl font-mono font-bold text-slate-100">{data.total}</div>
          <div className="text-xs text-slate-600 mt-1">obligations tracked</div>
        </div>
        <div className="bg-[#0f1629] border border-red-900/40 p-4">
          <div className="text-xs text-red-400/70 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />Overdue
          </div>
          <div className="text-3xl font-mono font-bold text-red-400">{data.overdueCount}</div>
          <div className="text-xs text-slate-600 mt-1">require immediate action</div>
        </div>
        <div className="bg-[#0f1629] border border-amber-900/40 p-4">
          <div className="text-xs text-amber-400/70 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />Due Soon
          </div>
          <div className="text-3xl font-mono font-bold text-amber-400">{data.dueThisWeekCount}</div>
          <div className="text-xs text-slate-600 mt-1">within 7 days</div>
        </div>
        <div className="bg-[#0f1629] border border-[#1e2d47] p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />This Month
          </div>
          <div className="text-3xl font-mono font-bold text-slate-300">{data.dueThisMonthCount}</div>
          <div className="text-xs text-slate-600 mt-1">due in {format(today, 'MMMM')}</div>
        </div>
      </div>

      <div className={isViewer ? '' : 'grid grid-cols-3 gap-4'}>
        {/* Left: Overdue + Upcoming (hidden for viewers) */}
        {!isViewer && <div className="col-span-2 space-y-4">
          {/* Overdue */}
          {data.overdue.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-red-500 rounded-sm" />
                <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                  Overdue ({data.overdue.length})
                </h2>
              </div>
              <div className="border border-red-900/30 bg-[#0f1629] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2d47] text-slate-500">
                      <th className="text-left px-3 py-2 font-medium">Obligation</th>
                      <th className="text-left px-3 py-2 font-medium">Category</th>
                      <th className="text-left px-3 py-2 font-medium">Owner</th>
                      <th className="text-right px-3 py-2 font-medium font-mono">Due</th>
                      <th className="text-right px-3 py-2 font-medium font-mono">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overdue.map((item, i) => {
                      const days = getDaysUntil(item.nextDueDate)
                      return (
                        <tr key={item.id} className={`border-b border-[#1e2d47]/50 hover:bg-red-950/20 transition-colors ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'}`}>
                          <td className="px-3 py-2">
                            <Link href={`/obligations?id=${item.id}`} className="text-slate-200 hover:text-amber-400 transition-colors">
                              {item.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{getCategoryLabel(item.category)}</td>
                          <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{item.owner}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-400">{formatDate(item.nextDueDate)}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-400 font-semibold">{Math.abs(days)}d ago</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Due this week */}
          {data.upcoming.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-amber-500 rounded-sm" />
                <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                  Due Within 7 Days ({data.upcoming.length})
                </h2>
              </div>
              <div className="border border-amber-900/30 bg-[#0f1629] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2d47] text-slate-500">
                      <th className="text-left px-3 py-2 font-medium">Obligation</th>
                      <th className="text-left px-3 py-2 font-medium">Category</th>
                      <th className="text-left px-3 py-2 font-medium">Risk</th>
                      <th className="text-left px-3 py-2 font-medium">Owner</th>
                      <th className="text-right px-3 py-2 font-medium font-mono">Due</th>
                      <th className="text-right px-3 py-2 font-medium font-mono">In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.upcoming.map((item, i) => {
                      const days = getDaysUntil(item.nextDueDate)
                      return (
                        <tr key={item.id} className={`border-b border-[#1e2d47]/50 hover:bg-amber-950/10 transition-colors ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'}`}>
                          <td className="px-3 py-2">
                            <Link href={`/obligations?id=${item.id}`} className="text-slate-200 hover:text-amber-400 transition-colors">
                              {item.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{getCategoryLabel(item.category)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium border ${getRiskColor(item.riskLevel as any)}`}>
                              {item.riskLevel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500 truncate max-w-[100px]">{item.owner}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-400">{formatDate(item.nextDueDate)}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-400 font-semibold">
                            {days === 0 ? 'today' : `${days}d`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* This month */}
          {data.dueThisMonth.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-slate-600 rounded-sm" />
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Rest of {format(today, 'MMMM')} ({data.dueThisMonth.length})
                </h2>
              </div>
              <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2d47] text-slate-500">
                      <th className="text-left px-3 py-2 font-medium">Obligation</th>
                      <th className="text-left px-3 py-2 font-medium">Category</th>
                      <th className="text-left px-3 py-2 font-medium">Risk</th>
                      <th className="text-left px-3 py-2 font-medium">Owner</th>
                      <th className="text-right px-3 py-2 font-medium font-mono">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dueThisMonth.slice(0, 20).map((item, i) => (
                      <tr key={item.id} className={`border-b border-[#1e2d47]/50 hover:bg-[#162035] transition-colors ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'}`}>
                        <td className="px-3 py-2">
                          <Link href={`/obligations?id=${item.id}`} className="text-slate-200 hover:text-amber-400 transition-colors">
                            {item.title}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{getCategoryLabel(item.category)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium border ${getRiskColor(item.riskLevel as any)}`}>
                            {item.riskLevel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[100px]">{item.owner}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">{formatDate(item.nextDueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>}

        {/* Category breakdown */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-4 bg-amber-500/60 rounded-sm" />
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">By Category</h2>
            </div>
            <div className="border border-[#1e2d47] bg-[#0f1629] p-3 space-y-2">
              {categoryKeys.map(cat => {
                const { total, overdue } = data.byCategory[cat]
                const pct = Math.round((total / maxTotal) * 100)
                return (
                  <Link key={cat} href={`/obligations?category=${cat}`} className="block group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-300 group-hover:text-amber-400 transition-colors">
                        {getCategoryLabel(cat)}
                      </span>
                      <div className="flex items-center gap-2">
                        {overdue > 0 && (
                          <span className="text-[10px] font-mono text-red-400">{overdue} overdue</span>
                        )}
                        <span className="text-xs font-mono text-slate-400">{total}</span>
                      </div>
                    </div>
                    <div className="h-1 bg-[#1e2d47] overflow-hidden">
                      <div
                        className={`h-full transition-all ${overdue > 0 ? 'bg-red-500/60' : 'bg-amber-500/40'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
