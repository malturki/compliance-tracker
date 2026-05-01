'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ListTodo, Loader2, AlertTriangle, Clock, Calendar as CalendarIcon, Sparkles } from 'lucide-react'
import { TodaySection } from '@/components/today/today-section'
import { TodayEmptyState } from '@/components/today/empty-state'
import type { TodayRowItem } from '@/components/today/today-row'

interface TodayResponse {
  summary: { overdue: number; today: number; thisWeek: number; comingUp: number }
  overdue:  { mine: TodayRowItem[]; others: TodayRowItem[] }
  today:    { mine: TodayRowItem[]; others: TodayRowItem[] }
  thisWeek: { mine: TodayRowItem[]; others: TodayRowItem[] }
  comingUp: { mine: TodayRowItem[]; others: TodayRowItem[] }
}

const EMPTY: TodayResponse = {
  summary: { overdue: 0, today: 0, thisWeek: 0, comingUp: 0 },
  overdue: { mine: [], others: [] },
  today: { mine: [], others: [] },
  thisWeek: { mine: [], others: [] },
  comingUp: { mine: [], others: [] },
}

export default function TodayPage() {
  const { data: session } = useSession()
  const role = (session?.user?.role ?? 'viewer') as 'viewer' | 'editor' | 'admin'
  const canEdit = role === 'editor' || role === 'admin'
  const isViewer = role === 'viewer'

  const [data, setData] = useState<TodayResponse>(EMPTY)
  const [loading, setLoading] = useState(true)
  const today = new Date()

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/today')
      if (!res.ok) throw new Error('Failed to load today')
      const body = await res.json()
      setData(body)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load today', {
        action: { label: 'Retry', onClick: load },
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const overdueExists = data.summary.overdue > 0
  const todayExists = data.summary.today > 0
  const weekExists = data.summary.thisWeek > 0
  const upExists = data.summary.comingUp > 0
  const allEmpty = !overdueExists && !todayExists && !weekExists && !upExists
  const caughtUp = !overdueExists && !todayExists && (weekExists || upExists)

  return (
    <div className="p-4 md:p-6 max-w-[1100px] overflow-x-hidden">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4 border-b border-black/5 pb-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-graphite" />
            Today
          </h1>
          <p className="text-xs text-steel mt-0.5 font-mono">{format(today, 'EEEE, MMM d yyyy')}</p>
        </div>
      </div>

      {/* Hero ribbon — sticky on scroll. 2x2 grid on mobile, single row from md+. */}
      {!loading && !allEmpty && (
        <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-canvas/90 backdrop-blur border-b border-black/5 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-xs">
            <HeroStat icon={<AlertTriangle className="w-3 h-3" />} label="Overdue" value={data.summary.overdue} tone="danger" />
            <HeroStat icon={<Clock className="w-3 h-3" />} label="Today" value={data.summary.today} tone="warning" />
            <HeroStat icon={<CalendarIcon className="w-3 h-3" />} label="This week" value={data.summary.thisWeek} tone="neutral" />
            <HeroStat icon={<Sparkles className="w-3 h-3" />} label="Coming up" value={data.summary.comingUp} tone="neutral" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-steel">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : allEmpty ? (
        <TodayEmptyState variant="tracker-empty" canEdit={canEdit} />
      ) : (
        <div className="space-y-4">
          {overdueExists && (
            <TodaySection title="Overdue" group={data.overdue} defaultOpen tone="overdue" hideSplit={isViewer} />
          )}
          {todayExists && (
            <TodaySection title="Today" group={data.today} defaultOpen tone="today" hideSplit={isViewer} />
          )}
          {caughtUp && <TodayEmptyState variant="caught-up" canEdit={canEdit} />}
          {weekExists && (
            <TodaySection title="This week" group={data.thisWeek} defaultOpen tone="thisWeek" hideSplit={isViewer} />
          )}
          {upExists && (
            <TodaySection title="Coming up" group={data.comingUp} defaultOpen={false} tone="comingUp" hideSplit={isViewer} />
          )}
          {!weekExists && !upExists && !overdueExists && !todayExists && (
            <TodayEmptyState variant="nothing-scheduled" canEdit={canEdit} />
          )}
        </div>
      )}
    </div>
  )
}

function HeroStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'danger' | 'warning' | 'neutral'
}) {
  const numClass =
    tone === 'danger' && value > 0 ? 'text-danger'
    : tone === 'warning' && value > 0 ? 'text-warning'
    : 'text-graphite'
  return (
    <div className="bg-white border border-black/5 rounded p-2 md:p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-steel flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className={`text-xl md:text-2xl font-mono font-semibold mt-0.5 ${numClass}`}>{value}</div>
    </div>
  )
}
