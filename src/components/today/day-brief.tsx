'use client'

import { formatDate, getRiskColor } from '@/lib/utils'
import type { RiskLevel } from '@/lib/types'
import type { TodayRowItem } from './today-row'

interface Props {
  /** First name (or full name) of the signed-in user, for the greeting. */
  userName: string | null
  summary: { overdue: number; today: number; thisWeek: number; comingUp: number }
  /** Used to identify the single "most urgent" item to call out by name. */
  overdue: { mine: TodayRowItem[]; others: TodayRowItem[] }
  today: { mine: TodayRowItem[]; others: TodayRowItem[] }
  thisWeek: { mine: TodayRowItem[]; others: TodayRowItem[] }
}

function timeOfDayGreeting(now: Date): string {
  const h = now.getHours()
  if (h < 5) return 'You\'re up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Pick the single most pressing item — overdue+critical first, then today, then week. */
function mostUrgent(
  overdue: Props['overdue'],
  today: Props['today'],
  thisWeek: Props['thisWeek'],
): TodayRowItem | null {
  // Each bucket is already sorted (risk DESC, then date ASC) by the server.
  const o = overdue.mine[0] ?? overdue.others[0]
  if (o) return o
  const t = today.mine[0] ?? today.others[0]
  if (t) return t
  const w = thisWeek.mine[0] ?? thisWeek.others[0]
  if (w) return w
  return null
}

export function DayBrief({ userName, summary, overdue, today, thisWeek }: Props) {
  const greeting = timeOfDayGreeting(new Date())
  const firstName = userName?.split(' ')[0] ?? null
  const mostPressing = mostUrgent(overdue, today, thisWeek)

  const totalActive = summary.overdue + summary.today + summary.thisWeek
  if (totalActive === 0 && summary.comingUp === 0) {
    // Whole-tracker-empty case is handled by the page's empty-state component.
    return null
  }

  // Build the situational sentence. Order of operations: overdue is the most
  // alarming so it leads; today is next; otherwise mention the week's load.
  const parts: string[] = []
  if (summary.overdue > 0) parts.push(`${summary.overdue} overdue`)
  if (summary.today > 0) parts.push(`${summary.today} due today`)
  if (parts.length === 0 && summary.thisWeek > 0) {
    parts.push(`${summary.thisWeek} due this week`)
  } else if (summary.thisWeek > 0) {
    parts.push(`${summary.thisWeek} this week`)
  }
  if (parts.length === 0 && summary.comingUp > 0) {
    parts.push(`${summary.comingUp} coming up in the next 30 days`)
  }
  const summaryLine = parts.length > 0 ? parts.join(' · ') : 'No active obligations.'

  // The "All caught up" mood: nothing overdue, nothing today.
  const caughtUp = summary.overdue === 0 && summary.today === 0

  return (
    <div className="bg-white border border-black/5 rounded-card shadow-card p-4 md:p-5 mb-5 relative overflow-hidden">
      {/* Light Steel Blue blade running down the left edge — the kit's
          accent-as-blade pattern, replacing the previous filled icon tile. */}
      <span className="absolute inset-y-0 left-0 w-0.5 bg-light-steel" aria-hidden />
      <div className="pl-3">
        <h2 className="text-sm font-medium text-graphite leading-snug tracking-[-0.01em]">
          {greeting}{firstName ? `, ${firstName}` : ''}
          {caughtUp && <span className="text-success ml-2 font-normal">— all caught up</span>}
        </h2>
        <p className="text-[11px] text-steel mt-1 font-mono">{summaryLine}</p>
        {mostPressing && !caughtUp && (
          <p className="text-xs text-graphite mt-2 leading-relaxed flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-steel/70">Start with</span>
            <span className="font-medium">{mostPressing.title}</span>
            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border align-middle ${getRiskColor(mostPressing.riskLevel as RiskLevel)}`}>
              {mostPressing.riskLevel.toUpperCase()}
            </span>
            <span className="text-steel font-mono text-[11px]">
              due {formatDate(mostPressing.nextDueDate)}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
