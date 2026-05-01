'use client'

import Link from 'next/link'
import { ChevronRight, GitBranch } from 'lucide-react'
import { formatDate, getDaysUntil, getRiskColor } from '@/lib/utils'
import type { Obligation, RiskLevel, Status } from '@/lib/types'

export type TodayRowItem = Obligation & { computedStatus: Status }

interface Props {
  item: TodayRowItem
  /** Show the user as the owner column ("you") when this row is theirs. */
  isMine: boolean
}

function relativeLabel(daysUntil: number): { text: string; tone: 'overdue' | 'today' | 'upcoming' | 'future' } {
  if (daysUntil === 0) return { text: 'today', tone: 'today' }
  if (daysUntil < 0) {
    const n = Math.abs(daysUntil)
    return { text: `${n}d ago`, tone: 'overdue' }
  }
  if (daysUntil <= 7) return { text: `in ${daysUntil}d`, tone: 'upcoming' }
  return { text: `in ${daysUntil}d`, tone: 'future' }
}

export function TodayRow({ item, isMine }: Props) {
  const days = getDaysUntil(item.nextDueDate)
  const rel = relativeLabel(days)
  const isSubObligation = !!(item as any).parentId
  const isBlocked = item.computedStatus === 'blocked'

  return (
    <Link
      href={`/obligations?id=${item.id}`}
      className={`group flex items-center gap-2.5 px-3 py-2 border-b border-silicon/40 last:border-b-0 transition-colors
        ${isBlocked ? 'bg-danger/[0.05] hover:bg-danger/[0.10]' : 'hover:bg-silicon/[0.18]'}
      `}
    >
      {/* Sub-obligation indicator — leading dot suggests "part of a workflow" */}
      <span className={`flex-shrink-0 ${isSubObligation ? 'text-light-steel' : 'text-transparent'}`} aria-hidden>
        {isSubObligation ? <GitBranch className="w-3 h-3" /> : <span className="w-3 h-3 inline-block" />}
      </span>

      {/* Risk badge */}
      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border flex-shrink-0 ${getRiskColor(item.riskLevel as RiskLevel)}`}>
        {item.riskLevel.toUpperCase()}
      </span>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className={`text-xs truncate ${isBlocked ? 'text-graphite' : 'text-graphite'}`}>
          {item.title}
          {isBlocked && (
            <span className="ml-2 text-[10px] font-mono text-danger uppercase tracking-wider">blocked</span>
          )}
        </div>
        {item.counterparty && (
          <div className="text-[10px] text-steel/70 truncate mt-0.5 font-mono">→ {item.counterparty}</div>
        )}
      </div>

      {/* Relative date */}
      <span className={`text-[10px] font-mono flex-shrink-0 ${
        rel.tone === 'overdue' ? 'text-danger font-semibold'
        : rel.tone === 'today' ? 'text-warning font-semibold'
        : rel.tone === 'upcoming' ? 'text-warning'
        : 'text-steel'
      }`}>
        {rel.text}
        <span className="text-steel/60 ml-1.5 hidden sm:inline">{formatDate(item.nextDueDate)}</span>
      </span>

      {/* Owner */}
      <span className="hidden md:inline text-[10px] font-mono text-steel/70 max-w-[100px] truncate flex-shrink-0">
        {isMine ? 'you' : item.owner}
      </span>

      <ChevronRight className="w-3 h-3 text-steel/40 flex-shrink-0 group-hover:text-steel/70 transition-colors" />
    </Link>
  )
}
