'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { CompletedTodayEntry } from '@/lib/today'

interface Props {
  count: number
  recent: CompletedTodayEntry[]
  /** Local optimistic counter — added to `count` when the user marks something
   * complete in this session, before the next /api/today refresh lands. */
  localBoost?: number
}

/**
 * Daily-momentum strip: a small "X done today" pill plus a collapsible
 * "Just done" feed. Renders nothing when there's no completion activity
 * (count=0 + no localBoost) — empty state is the absence of the strip.
 */
export function MomentumStrip({ count, recent, localBoost = 0 }: Props) {
  const total = count + localBoost
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  // Tick every 30s so "X minutes ago" labels stay roughly fresh without
  // refetching the whole feed.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  if (total === 0) return null

  return (
    <div className="bg-success/[0.06] border border-success/30 rounded-card overflow-hidden mb-5">
      <button
        type="button"
        onClick={() => recent.length > 0 && setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left ${
          recent.length > 0 ? 'hover:bg-success/[0.10] cursor-pointer' : 'cursor-default'
        } transition-colors`}
      >
        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
        <span className="text-xs text-graphite">
          <span className="font-semibold">{total}</span>{' '}
          completed today
          {localBoost > 0 && (
            <span className="text-[10px] font-mono text-success/80 ml-1.5">+{localBoost} just now</span>
          )}
        </span>
        {recent.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-steel/70">
            {open ? 'Hide' : 'Show'} feed
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        )}
      </button>
      {open && recent.length > 0 && (
        <ul className="border-t border-success/30 divide-y divide-success/20">
          {recent.map(entry => (
            <li key={`${entry.obligationId}-${entry.completedAt}`} className="flex items-center gap-2 px-4 py-2 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-success/70 flex-shrink-0" />
              <span className="text-graphite truncate flex-1" title={entry.title}>
                {entry.title}
              </span>
              <span className="text-steel/70 font-mono whitespace-nowrap">
                {formatDistanceToNow(new Date(entry.completedAt), { addSuffix: true, includeSeconds: false })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
