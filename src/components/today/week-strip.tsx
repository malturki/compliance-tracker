'use client'

import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { addDaysISO, toIsoDay } from '@/lib/today'
import type { RiskLevel } from '@/lib/types'
import type { TodayRowItem } from './today-row'

interface Props {
  /** Today as ISO YYYY-MM-DD — the strip starts here and extends 6 days right. */
  todayIso: string
  /** Aggregated buckets from /api/today; the strip only reads dates + risk levels. */
  overdue: { mine: TodayRowItem[]; others: TodayRowItem[] }
  today: { mine: TodayRowItem[]; others: TodayRowItem[] }
  thisWeek: { mine: TodayRowItem[]; others: TodayRowItem[] }
  /** When set, that day's column is highlighted; null = no day filter. */
  selectedDay: string | null
  onSelectDay: (iso: string | null) => void
  /** "overdue" pill is selected separately from a day. */
  overdueSelected: boolean
  onSelectOverdue: () => void
}

interface DayCell {
  iso: string
  date: Date
  count: number
  byRisk: Record<RiskLevel, number>
  isToday: boolean
}

const RISK_DOT_CLASSES: Record<RiskLevel, string> = {
  critical: 'bg-danger',
  high: 'bg-warning',
  medium: 'bg-steel/60',
  low: 'bg-success',
}

function buildCells(
  todayIso: string,
  todayItems: TodayRowItem[],
  weekItems: TodayRowItem[],
): DayCell[] {
  // Bucket every item due today + within the next 7 days into per-day cells.
  const cells: DayCell[] = []
  const all = [...todayItems, ...weekItems]
  for (let i = 0; i < 7; i++) {
    const iso = addDaysISO(todayIso, i)
    const date = new Date(iso + 'T00:00:00Z')
    const dayItems = all.filter(o => o.nextDueDate === iso)
    const byRisk: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const item of dayItems) {
      byRisk[item.riskLevel as RiskLevel] = (byRisk[item.riskLevel as RiskLevel] ?? 0) + 1
    }
    cells.push({ iso, date, count: dayItems.length, byRisk, isToday: i === 0 })
  }
  return cells
}

/**
 * Up to 4 colored dots per cell — one per item, capped at 4 with the highest
 * risk levels first so the visual is dominated by what matters most.
 */
function renderDots(byRisk: Record<RiskLevel, number>): React.ReactNode {
  const dots: React.ReactNode[] = []
  const ordered: RiskLevel[] = ['critical', 'high', 'medium', 'low']
  for (const r of ordered) {
    for (let i = 0; i < (byRisk[r] ?? 0); i++) {
      if (dots.length >= 4) {
        dots.push(
          <span key="more" className="text-[8px] font-mono text-steel/60 ml-0.5">+</span>,
        )
        return dots
      }
      dots.push(
        <span
          key={`${r}-${dots.length}`}
          className={`w-1.5 h-1.5 rounded-full ${RISK_DOT_CLASSES[r]}`}
          aria-label={`${r}-risk item`}
        />,
      )
    }
  }
  return dots
}

export function WeekStrip({
  todayIso,
  overdue,
  today,
  thisWeek,
  selectedDay,
  onSelectDay,
  overdueSelected,
  onSelectOverdue,
}: Props) {
  const overdueCount = overdue.mine.length + overdue.others.length
  const cells = buildCells(
    todayIso,
    [...today.mine, ...today.others],
    [...thisWeek.mine, ...thisWeek.others],
  )

  return (
    <div className="bg-white border border-black/5 rounded-card shadow-card p-3 mb-5 overflow-x-auto">
      <div className="flex items-stretch gap-1.5 min-w-fit">
        {/* Overdue pill — left of the calendar, always visible if there are overdue items */}
        {overdueCount > 0 && (
          <button
            type="button"
            onClick={() => onSelectOverdue()}
            className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded border transition-colors min-w-[78px]
              ${overdueSelected
                ? 'bg-danger/15 border-danger text-danger'
                : 'bg-danger/[0.06] border-danger/30 text-danger hover:bg-danger/10'}
            `}
            aria-pressed={overdueSelected}
          >
            <AlertTriangle className="w-3.5 h-3.5 mb-0.5" />
            <span className="text-[10px] font-mono uppercase tracking-wider leading-none">
              Overdue
            </span>
            <span className="text-base font-mono font-semibold leading-tight mt-1">
              {overdueCount}
            </span>
          </button>
        )}

        {/* 7-day strip */}
        {cells.map(cell => {
          const isSelected = selectedDay === cell.iso
          const monthDay = format(cell.date, 'd')
          const weekday = format(cell.date, 'EEE')
          const empty = cell.count === 0
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : cell.iso)}
              disabled={empty && !cell.isToday}
              className={`flex-1 flex-shrink-0 flex flex-col items-center justify-start px-2 py-2 rounded border transition-colors min-w-[78px]
                ${isSelected
                  ? 'bg-light-steel/[0.28] border-light-steel'
                  : cell.isToday
                  ? 'bg-light-steel/[0.10] border-light-steel/50 hover:bg-light-steel/[0.18]'
                  : empty
                  ? 'bg-canvas border-black/5 text-steel/50 cursor-default'
                  : 'bg-white border-black/10 hover:bg-silicon/[0.18] cursor-pointer'}
              `}
              aria-pressed={isSelected}
              aria-label={`${weekday} ${monthDay}, ${cell.count} item${cell.count === 1 ? '' : 's'}`}
            >
              <span className={`text-[10px] font-mono uppercase tracking-wider leading-none ${
                cell.isToday ? 'text-graphite font-semibold' : 'text-steel/70'
              }`}>
                {cell.isToday ? 'TODAY' : weekday}
              </span>
              <span className={`text-lg font-mono leading-tight mt-0.5 ${
                cell.isToday ? 'text-graphite font-semibold' : 'text-graphite'
              }`}>
                {monthDay}
              </span>
              {/* Risk dots */}
              <div className="flex items-center gap-0.5 mt-1.5 h-1.5">
                {renderDots(cell.byRisk)}
              </div>
              <span className={`text-[10px] font-mono mt-1 ${
                empty && !cell.isToday ? 'text-steel/40' : 'text-steel'
              }`}>
                {cell.count}
              </span>
            </button>
          )
        })}

        {/* "All week" reset, only visible when a filter is applied */}
        {(selectedDay || overdueSelected) && (
          <button
            type="button"
            onClick={() => {
              onSelectDay(null)
              if (overdueSelected) onSelectOverdue()
            }}
            className="flex-shrink-0 self-center text-[10px] font-mono text-steel hover:text-graphite px-2 py-1 ml-1 border border-black/10 rounded transition-colors"
          >
            All week
          </button>
        )}
      </div>
    </div>
  )
}

// Re-export the helpers that the WeekStrip relies on so the page can reuse
// them (e.g., for filtering rows by selected day) without re-implementing.
export { addDaysISO, toIsoDay }
