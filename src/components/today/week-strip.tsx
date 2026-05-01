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
      <div className="flex items-stretch gap-1 min-w-fit">
        {/* Overdue pill — accent-as-blade: white base with a danger-toned
            border-bottom rule. Selected fills lightly. Same visual rhythm as
            the day cells so the eye scans them as one row. */}
        {overdueCount > 0 && (
          <button
            type="button"
            onClick={() => onSelectOverdue()}
            className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded border transition-colors min-w-[68px] relative
              ${overdueSelected
                ? 'bg-danger/[0.08] border-danger text-danger'
                : 'bg-white border-black/5 text-danger hover:bg-silicon/[0.18]'}
            `}
            aria-pressed={overdueSelected}
          >
            <span className="flex items-center gap-1 leading-none">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-[9px] font-mono uppercase tracking-[0.18em]">Overdue</span>
            </span>
            <span className="text-sm font-mono font-semibold mt-1.5 leading-none">
              {overdueCount}
            </span>
            {/* Bottom blade — always present so the row aligns with day cells */}
            <span className="absolute inset-x-2 bottom-0 h-px bg-danger/40" aria-hidden />
          </button>
        )}

        {/* 7-day strip — uniform white cells with a Light Steel Blue blade
            under today and a tinted fill only when selected. */}
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
              className={`flex-1 flex-shrink-0 flex flex-col items-center justify-start px-2 py-2 rounded border transition-colors min-w-[64px] relative
                ${isSelected
                  ? 'bg-light-steel/[0.18] border-light-steel'
                  : empty && !cell.isToday
                  ? 'bg-white border-black/5 cursor-default'
                  : 'bg-white border-black/5 hover:bg-silicon/[0.18] cursor-pointer'}
              `}
              aria-pressed={isSelected}
              aria-label={`${weekday} ${monthDay}, ${cell.count} item${cell.count === 1 ? '' : 's'}`}
            >
              <span className={`text-[9px] font-mono uppercase tracking-[0.18em] leading-none ${
                cell.isToday ? 'text-graphite' : empty && !cell.isToday ? 'text-steel/40' : 'text-steel/70'
              }`}>
                {weekday}
              </span>
              <span className={`text-base font-mono leading-none mt-1 ${
                empty && !cell.isToday ? 'text-steel/40' : 'text-graphite'
              }`}>
                {monthDay}
              </span>
              {/* Risk dots — only render the row when there are items, keeps
                  empty cells crisp. Reserve the height regardless so cells
                  stay aligned. */}
              <div className="flex items-center gap-0.5 mt-1.5 h-1.5">
                {renderDots(cell.byRisk)}
              </div>
              <span className={`text-[10px] font-mono mt-1 leading-none ${
                empty && !cell.isToday ? 'text-steel/30' : 'text-steel'
              }`}>
                {cell.count}
              </span>
              {/* Today blade — accent applied as a 2px under-rule (the kit's
                  "use it as a blade, not a paint bucket" guidance). Hidden when
                  the cell is selected because the selected state already
                  carries a full Light Steel border. */}
              {cell.isToday && !isSelected && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 bg-light-steel" aria-hidden />
              )}
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
            className="flex-shrink-0 self-center text-[10px] font-mono text-steel hover:text-graphite px-2 py-1 ml-1 border border-black/5 rounded transition-colors"
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
