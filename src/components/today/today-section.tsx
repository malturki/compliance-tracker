'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TodayRow, type TodayRowItem } from './today-row'

interface Group {
  mine: TodayRowItem[]
  others: TodayRowItem[]
}

interface Props {
  /** Section heading: "Overdue", "Today", "This week", "Coming up". */
  title: string
  group: Group
  /** Defaults: overdue + today expanded; thisWeek expanded if non-empty; comingUp collapsed. */
  defaultOpen: boolean
  /** Defaults: mine expanded; others collapsed. Hidden entirely when role flattens. */
  hideSplit?: boolean
  /** Tone affects the section header color (overdue is danger, today is warning). */
  tone?: 'overdue' | 'today' | 'thisWeek' | 'comingUp'
  /** True for editor/admin: enables inline complete + snooze actions on each row. */
  canAct: boolean
  /** Called after a row mutation (complete / snooze) so the page refreshes. */
  onMutate: () => void
}

export function TodaySection({ title, group, defaultOpen, hideSplit, tone = 'comingUp', canAct, onMutate }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [showOthers, setShowOthers] = useState(false)

  const total = group.mine.length + group.others.length
  if (total === 0) return null

  const headerColor =
    tone === 'overdue' ? 'text-danger'
    : tone === 'today' ? 'text-warning'
    : 'text-graphite'

  return (
    <section className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-silicon/[0.18] transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-steel" /> : <ChevronRight className="w-4 h-4 text-steel" />}
        <h2 className={`text-sm font-semibold uppercase tracking-wider ${headerColor}`}>
          {title}
        </h2>
        <span className="text-[11px] font-mono text-steel/70">({total})</span>
      </button>
      {open && (
        <div className="border-t border-black/5">
          {hideSplit ? (
            // Viewer view — flat list, no mine/others split.
            <div>
              {[...group.mine, ...group.others].map(item => (
                <TodayRow key={item.id} item={item} isMine={false} canAct={canAct} onMutate={onMutate} />
              ))}
            </div>
          ) : (
            <>
              {group.mine.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 bg-canvas border-b border-black/5 text-[10px] uppercase tracking-[0.18em] text-steel/70">
                    My obligations ({group.mine.length})
                  </div>
                  {group.mine.map(item => (
                    <TodayRow key={item.id} item={item} isMine canAct={canAct} onMutate={onMutate} />
                  ))}
                </div>
              )}
              {group.others.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOthers(v => !v)}
                    className="w-full px-3 py-1.5 bg-canvas border-b border-black/5 text-[10px] uppercase tracking-[0.18em] text-steel/70 hover:text-graphite flex items-center gap-1 transition-colors"
                  >
                    {showOthers ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Owned by others ({group.others.length})
                  </button>
                  {showOthers && group.others.map(item => (
                    <TodayRow key={item.id} item={item} isMine={false} canAct={canAct} onMutate={onMutate} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
