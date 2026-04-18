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
  const canEdit = session?.user?.role === 'editor' || session?.user?.role === 'admin'

  const categoryKeys = Object.keys(data.byCategory).sort()
  const maxTotal = Math.max(...categoryKeys.map(k => data.byCategory[k].total), 1)

  // First-run empty state: database has no obligations yet.
  if (data.total === 0) {
    return (
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-baseline justify-between mb-6 border-b border-black/5 pb-4">
          <div>
            <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">Overview</h1>
            <p className="text-xs text-steel mt-0.5 font-mono">FAST — Compliance Dashboard</p>
          </div>
          <div className="text-xs font-mono text-steel">{format(today, 'EEE, MMM d yyyy')}</div>
        </div>

        <div className="max-w-2xl mx-auto mt-16 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-light-steel/[0.18] border border-light-steel/40 mb-5">
            <TrendingUp className="w-6 h-6 text-graphite" />
          </div>
          <h2 className="text-lg font-semibold text-graphite mb-2">
            Welcome to the Compliance Tracker
          </h2>
          <p className="text-sm text-steel mb-8 leading-relaxed">
            No obligations are being tracked yet.
            {canEdit
              ? ' Get started by applying a template for common compliance requirements, or add your first obligation manually.'
              : ' An editor or admin needs to add obligations before anything shows up here.'}
          </p>

          {canEdit && (
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/templates"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-graphite hover:bg-graphite/90 text-white text-xs font-medium rounded transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Apply a template
              </Link>
              <Link
                href="/obligations"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-black/5 hover:border-light-steel text-graphite hover:text-graphite text-xs font-medium rounded transition-colors"
              >
                Add manually →
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 border-b border-black/5 pb-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">Overview</h1>
          <p className="text-xs text-steel mt-0.5 font-mono">FAST — Compliance Dashboard</p>
        </div>
        <div className="text-xs font-mono text-steel">{format(today, 'EEE, MMM d yyyy')}</div>
      </div>

      {/* Stats Row — 2 columns on mobile, 4 from md upward */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-black/5 rounded-card shadow-card p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-steel mb-1">Total</div>
          <div className="text-3xl font-medium tracking-[-0.02em] text-graphite">{data.total}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-steel mt-1">obligations tracked</div>
        </div>
        <div className="bg-white border border-black/5 rounded-card shadow-card p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-steel mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />Overdue
          </div>
          <div className={`text-3xl font-medium tracking-[-0.02em] ${data.overdueCount > 0 ? 'text-danger' : 'text-graphite'}`}>{data.overdueCount}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-steel mt-1">require immediate action</div>
        </div>
        <div className="bg-white border border-black/5 rounded-card shadow-card p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-steel mb-1 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />Due Soon
          </div>
          <div className="text-3xl font-medium tracking-[-0.02em] text-graphite">{data.dueThisWeekCount}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-steel mt-1">within 7 days</div>
        </div>
        <div className="bg-white border border-black/5 rounded-card shadow-card p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-steel mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />This Month
          </div>
          <div className="text-3xl font-medium tracking-[-0.02em] text-graphite">{data.dueThisMonthCount}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-steel mt-1">due in {format(today, 'MMMM')}</div>
        </div>
      </div>

      <div className={isViewer ? '' : 'grid grid-cols-1 lg:grid-cols-3 gap-4'}>
        {/* Left: Overdue + Upcoming (hidden for viewers) */}
        {!isViewer && <div className="col-span-2 space-y-4">
          {/* Overdue */}
          {data.overdue.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-4 bg-danger rounded-sm" />
                <h2 className="text-[10px] uppercase tracking-[0.18em] text-steel">
                  Overdue ({data.overdue.length})
                </h2>
              </div>
              <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/5 text-steel text-[10px] uppercase tracking-[0.18em]">
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
                      const isLast = i === data.overdue.length - 1
                      return (
                        <tr key={item.id} className={`${isLast ? '' : 'border-b border-silicon/40'} bg-danger/[0.04] hover:bg-danger/[0.08] transition-colors`}>
                          <td className="px-3 py-2">
                            <Link href={`/obligations?id=${item.id}`} className="text-graphite hover:text-graphite transition-colors">
                              {item.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-steel">{getCategoryLabel(item.category)}</td>
                          <td className="px-3 py-2 text-steel truncate max-w-[120px]">{item.owner}</td>
                          <td className="px-3 py-2 text-right font-mono text-danger">{formatDate(item.nextDueDate)}</td>
                          <td className="px-3 py-2 text-right font-mono text-danger font-semibold">{Math.abs(days)}d ago</td>
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
                <div className="w-1.5 h-4 bg-graphite rounded-sm" />
                <h2 className="text-[10px] uppercase tracking-[0.18em] text-steel">
                  Due Within 7 Days ({data.upcoming.length})
                </h2>
              </div>
              <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/5 text-steel text-[10px] uppercase tracking-[0.18em]">
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
                      const isLast = i === data.upcoming.length - 1
                      return (
                        <tr key={item.id} className={`${isLast ? '' : 'border-b border-silicon/40'} hover:bg-silicon/[0.18] transition-colors`}>
                          <td className="px-3 py-2">
                            <Link href={`/obligations?id=${item.id}`} className="text-graphite hover:text-graphite transition-colors">
                              {item.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-steel">{getCategoryLabel(item.category)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium border ${getRiskColor(item.riskLevel as any)}`}>
                              {item.riskLevel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-steel truncate max-w-[100px]">{item.owner}</td>
                          <td className="px-3 py-2 text-right font-mono text-steel">{formatDate(item.nextDueDate)}</td>
                          <td className="px-3 py-2 text-right font-mono text-warning font-semibold">
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
                <div className="w-1.5 h-4 bg-steel/70 rounded-sm" />
                <h2 className="text-[10px] uppercase tracking-[0.18em] text-steel">
                  Rest of {format(today, 'MMMM')} ({data.dueThisMonth.length})
                </h2>
              </div>
              <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/5 text-steel text-[10px] uppercase tracking-[0.18em]">
                      <th className="text-left px-3 py-2 font-medium">Obligation</th>
                      <th className="text-left px-3 py-2 font-medium">Category</th>
                      <th className="text-left px-3 py-2 font-medium">Risk</th>
                      <th className="text-left px-3 py-2 font-medium">Owner</th>
                      <th className="text-right px-3 py-2 font-medium font-mono">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dueThisMonth.slice(0, 20).map((item, i, arr) => {
                      const isLast = i === arr.length - 1
                      return (
                        <tr key={item.id} className={`${isLast ? '' : 'border-b border-silicon/40'} hover:bg-silicon/[0.18] transition-colors`}>
                          <td className="px-3 py-2">
                            <Link href={`/obligations?id=${item.id}`} className="text-graphite hover:text-graphite transition-colors">
                              {item.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-steel">{getCategoryLabel(item.category)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium border ${getRiskColor(item.riskLevel as any)}`}>
                              {item.riskLevel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-steel truncate max-w-[100px]">{item.owner}</td>
                          <td className="px-3 py-2 text-right font-mono text-steel">{formatDate(item.nextDueDate)}</td>
                        </tr>
                      )
                    })}
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
              <div className="w-1.5 h-4 bg-graphite rounded-sm" />
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-steel">By Category</h2>
            </div>
            <div className="bg-white border border-black/5 rounded-card shadow-card p-3 space-y-2">
              {categoryKeys.map(cat => {
                const { total, overdue } = data.byCategory[cat]
                const pct = Math.round((total / maxTotal) * 100)
                return (
                  <Link key={cat} href={`/obligations?category=${cat}`} className="block group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-steel text-xs group-hover:text-graphite transition-colors">
                        {getCategoryLabel(cat)}
                      </span>
                      <div className="flex items-center gap-2">
                        {overdue > 0 && (
                          <span className="text-[10px] font-mono text-danger font-medium">{overdue} overdue</span>
                        )}
                        <span className="text-graphite text-xs font-medium font-mono">{total}</span>
                      </div>
                    </div>
                    <div className="h-1 bg-silicon/[0.4] overflow-hidden rounded-sm">
                      <div
                        className={`h-full transition-all ${overdue > 0 ? 'bg-danger' : 'bg-light-steel'}`}
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
