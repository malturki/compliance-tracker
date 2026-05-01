'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Clock, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Props {
  obligationId: string
  obligationTitle: string
  currentDueDate: string  // YYYY-MM-DD
  onSnoozed: () => void
  disabled?: boolean
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const PRESETS: { label: string; days: number }[] = [
  { label: '+1 day', days: 1 },
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+1 month', days: 30 },
]

/**
 * Tiny snooze affordance — pushes nextDueDate forward by N days. Mutation
 * goes through the normal PUT /api/obligations/[id], which means the existing
 * audit log already records the date change as an `obligation.updated` diff.
 *
 * Snoozing from today's view rebases relative to today (not from the current
 * due date), so "+1 day" always means "show me this tomorrow." This matches
 * how Things and Todoist handle defer-from-today.
 */
export function SnoozeMenu({
  obligationId,
  obligationTitle,
  currentDueDate,
  onSnoozed,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSnooze = async (days: number) => {
    setSubmitting(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      // Rebase from "today", not from current due date — feels right for the
      // "I'm not actually working on this today" use case.
      const baseDate = currentDueDate < today ? today : currentDueDate
      const newDueDate = addDaysISO(baseDate, days)
      const res = await fetch(`/api/obligations/${obligationId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nextDueDate: newDueDate }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to snooze')
      }
      toast.success(`Snoozed "${obligationTitle}" → ${newDueDate}`)
      setOpen(false)
      onSnoozed()
    } catch (err: any) {
      toast.error(err.message || 'Failed to snooze')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={v => {
        if (disabled) return
        setOpen(v)
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        onClick={e => e.stopPropagation()}
        className={`inline-flex items-center justify-center w-5 h-5 rounded text-steel/60 hover:text-graphite hover:bg-silicon/40 transition-colors flex-shrink-0
          ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
        `}
        aria-label={`Snooze ${obligationTitle}`}
      >
        <Clock className="w-3.5 h-3.5" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[160px] bg-white border-black/5 shadow-card text-graphite p-1"
        side="bottom"
        align="end"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-[10px] font-mono text-steel uppercase tracking-[0.18em] px-2 py-1">
          Push to:
        </div>
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            disabled={submitting}
            onClick={() => handleSnooze(p.days)}
            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-silicon/40 text-graphite disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-3 h-3 animate-spin inline mr-2" /> : null}
            {p.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
