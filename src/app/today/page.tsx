'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ListTodo, Loader2 } from 'lucide-react'
import { TodaySection } from '@/components/today/today-section'
import { TodayEmptyState } from '@/components/today/empty-state'
import { MomentumStrip } from '@/components/today/momentum-strip'
import { DayBrief } from '@/components/today/day-brief'
import { WeekStrip } from '@/components/today/week-strip'
import { type TodayRowItem } from '@/components/today/today-row'
import { toIsoDay, type CompletedTodayEntry } from '@/lib/today'

interface TodayResponse {
  summary: { overdue: number; today: number; thisWeek: number; comingUp: number }
  overdue:  { mine: TodayRowItem[]; others: TodayRowItem[] }
  today:    { mine: TodayRowItem[]; others: TodayRowItem[] }
  thisWeek: { mine: TodayRowItem[]; others: TodayRowItem[] }
  comingUp: { mine: TodayRowItem[]; others: TodayRowItem[] }
  completedToday: { count: number; recent: CompletedTodayEntry[] }
}

const EMPTY: TodayResponse = {
  summary: { overdue: 0, today: 0, thisWeek: 0, comingUp: 0 },
  overdue: { mine: [], others: [] },
  today: { mine: [], others: [] },
  thisWeek: { mine: [], others: [] },
  comingUp: { mine: [], others: [] },
  completedToday: { count: 0, recent: [] },
}

export default function TodayPage() {
  const { data: session } = useSession()
  const role = (session?.user?.role ?? 'viewer') as 'viewer' | 'editor' | 'admin'
  const canEdit = role === 'editor' || role === 'admin'
  const isViewer = role === 'viewer'

  const [data, setData] = useState<TodayResponse>(EMPTY)
  const [loading, setLoading] = useState(true)
  // Optimistic counter — bumped immediately on mutation, then reset to 0 when
  // the next fetch lands (the server-side count picks up the new completion).
  const [localBoost, setLocalBoost] = useState(0)
  // WeekStrip filter state. selectedDay = ISO date drills into a specific day;
  // overdueSelected toggles the leading red pill.
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [overdueSelected, setOverdueSelected] = useState(false)
  const today = new Date()
  const todayIso = toIsoDay(today)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/today')
      if (!res.ok) throw new Error('Failed to load today')
      const body = await res.json()
      setData(body)
      // Server count is now authoritative — clear the optimistic boost.
      setLocalBoost(0)
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

  /** Called by row actions (complete / snooze). Bumps the momentum counter
   * immediately, then re-fetches so the server has authoritative data. */
  const handleMutate = (kind: 'complete' | 'snooze') => {
    if (kind === 'complete') setLocalBoost(b => b + 1)
    load()
  }

  const overdueExists = data.summary.overdue > 0
  const todayExists = data.summary.today > 0
  const weekExists = data.summary.thisWeek > 0
  const upExists = data.summary.comingUp > 0
  const allEmpty = !overdueExists && !todayExists && !weekExists && !upExists
  const caughtUp = !overdueExists && !todayExists && (weekExists || upExists)
  const filterActive = selectedDay !== null || overdueSelected

  // Items for the selectedDay drill-in. We pull from today + thisWeek (and
  // future-period buckets) and filter by exact date match. Sub-grouping by
  // mine/others is preserved so the same UX as the urgency sections.
  const filteredForDay = (iso: string) => {
    const fromBuckets = (b: { mine: TodayRowItem[]; others: TodayRowItem[] }) => ({
      mine: b.mine.filter(i => i.nextDueDate === iso),
      others: b.others.filter(i => i.nextDueDate === iso),
    })
    const allBuckets = [data.today, data.thisWeek, data.comingUp]
    return allBuckets.reduce<{ mine: TodayRowItem[]; others: TodayRowItem[] }>(
      (acc, b) => {
        const f = fromBuckets(b)
        return { mine: [...acc.mine, ...f.mine], others: [...acc.others, ...f.others] }
      },
      { mine: [], others: [] },
    )
  }

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

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-steel">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : allEmpty && data.completedToday.count + localBoost === 0 ? (
        <TodayEmptyState variant="tracker-empty" canEdit={canEdit} />
      ) : (
        <div className="space-y-4">
          {/* Personal greeting + situational brief. */}
          <DayBrief
            userName={session?.user?.name ?? null}
            summary={data.summary}
            overdue={data.overdue}
            today={data.today}
            thisWeek={data.thisWeek}
          />

          {/* Time-as-space calendar strip + overdue pill. */}
          <WeekStrip
            todayIso={todayIso}
            overdue={data.overdue}
            today={data.today}
            thisWeek={data.thisWeek}
            selectedDay={selectedDay}
            onSelectDay={iso => {
              setSelectedDay(iso)
              if (iso !== null) setOverdueSelected(false)
            }}
            overdueSelected={overdueSelected}
            onSelectOverdue={() => {
              setOverdueSelected(s => !s)
              setSelectedDay(null)
            }}
          />

          {/* Daily momentum — only renders when there's completion activity. */}
          <MomentumStrip
            count={data.completedToday.count}
            recent={data.completedToday.recent}
            localBoost={localBoost}
          />

          {/* Drill-in views when a strip filter is active */}
          {overdueSelected && overdueExists && (
            <TodaySection
              title="Overdue"
              group={data.overdue}
              defaultOpen
              tone="overdue"
              hideSplit={isViewer}
              canAct={canEdit}
              onMutate={() => handleMutate('complete')}
            />
          )}
          {selectedDay && (
            <TodaySection
              title={selectedDay === todayIso ? 'Today' : `Items due ${selectedDay}`}
              group={filteredForDay(selectedDay)}
              defaultOpen
              tone={selectedDay === todayIso ? 'today' : 'thisWeek'}
              hideSplit={isViewer}
              canAct={canEdit}
              onMutate={() => handleMutate('complete')}
            />
          )}

          {/* Default urgency-grouped sections — only when no strip filter is active */}
          {!filterActive && overdueExists && (
            <TodaySection
              title="Overdue"
              group={data.overdue}
              defaultOpen
              tone="overdue"
              hideSplit={isViewer}
              canAct={canEdit}
              onMutate={() => handleMutate('complete')}
            />
          )}
          {!filterActive && todayExists && (
            <TodaySection
              title="Today"
              group={data.today}
              defaultOpen
              tone="today"
              hideSplit={isViewer}
              canAct={canEdit}
              onMutate={() => handleMutate('complete')}
            />
          )}
          {!filterActive && caughtUp && <TodayEmptyState variant="caught-up" canEdit={canEdit} />}
          {!filterActive && weekExists && (
            <TodaySection
              title="This week"
              group={data.thisWeek}
              defaultOpen
              tone="thisWeek"
              hideSplit={isViewer}
              canAct={canEdit}
              onMutate={() => handleMutate('snooze')}
            />
          )}
          {!filterActive && upExists && (
            <TodaySection
              title="Coming up"
              group={data.comingUp}
              defaultOpen={false}
              tone="comingUp"
              hideSplit={isViewer}
              canAct={canEdit}
              onMutate={() => handleMutate('snooze')}
            />
          )}
          {!filterActive && !weekExists && !upExists && !overdueExists && !todayExists && (
            <TodayEmptyState variant="nothing-scheduled" canEdit={canEdit} />
          )}
        </div>
      )}
    </div>
  )
}

