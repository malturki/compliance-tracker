import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfDay } from 'date-fns'
import type { RiskLevel, Status } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Derive the display status of an obligation from its dates and frequency.
 * Status is never persisted — it's computed on every read so it stays in sync
 * as time passes without needing a background job.
 *
 * Pass `frequency` so one-time and event-triggered obligations can reach the
 * terminal `'completed'` state once they have a `lastCompletedDate` — without
 * it, they'd flip back to `'overdue'` after the original due date passes.
 */
export function computeStatus(
  nextDueDate: string,
  lastCompletedDate?: string | null,
  frequency?: string | null,
): Status {
  // Terminal completion: a one-time or event-triggered obligation that has
  // been completed once is done forever — it should never flip back to
  // current/upcoming/overdue as time marches on.
  if (lastCompletedDate && (frequency === 'one-time' || frequency === 'event-triggered')) {
    return 'completed'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(nextDueDate)
  dueDate.setHours(0, 0, 0, 0)

  // If completed and the next due date hasn't arrived yet, status is 'current'
  if (lastCompletedDate) {
    const completed = new Date(lastCompletedDate)
    completed.setHours(0, 0, 0, 0)
    if (completed >= dueDate && dueDate >= today) {
      return 'current' // Completed for this period, next period not due yet
    }
  }

  if (dueDate < today) return 'overdue'
  if (dueDate.getTime() === today.getTime()) return 'upcoming'

  const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 7) return 'upcoming'

  return 'current'
}

export function getRiskColor(risk: RiskLevel): string {
  switch (risk) {
    case 'critical': return 'text-danger bg-danger/10 border-danger/30'
    case 'high': return 'text-warning bg-warning/10 border-warning/30'
    case 'medium': return 'text-steel bg-silicon/[0.4] border-silicon'
    case 'low': return 'text-success bg-success/10 border-success/30'
  }
}

export function getStatusColor(status: Status): string {
  switch (status) {
    case 'overdue': return 'text-danger bg-danger/10 border-danger/30'
    case 'upcoming': return 'text-warning bg-warning/10 border-warning/30'
    case 'current': return 'text-graphite bg-white border-silicon'
    case 'completed': return 'text-success bg-success/10 border-success/30'
    case 'blocked': return 'text-steel bg-silicon/[0.4] border-steel/40'
    default: return 'text-steel bg-silicon/[0.4] border-silicon'
  }
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy')
}

export function getDaysUntil(dateStr: string): number {
  const due = startOfDay(new Date(dateStr))
  const today = startOfDay(new Date())
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function getCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    tax: 'Tax', investor: 'Investor', equity: 'Equity', state: 'State',
    federal: 'Federal', contract: 'Contract', insurance: 'Insurance',
    benefits: 'Benefits', governance: 'Governance', vendor: 'Vendor',
  }
  return labels[cat] || cat
}

/**
 * Advance a due date by one period of the given frequency. Used by the
 * completion flow when an obligation has `autoRecur` enabled.
 *
 * Note: `one-time` and `event-triggered` should never be passed here — the
 * caller is expected to gate on frequency before calling. The `default` arm
 * advances by a year as a defensive fallback rather than throwing.
 */
export function computeNextDueDate(current: string, frequency: string): string {
  const d = new Date(current)
  switch (frequency) {
    case 'annual': d.setFullYear(d.getFullYear() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'weekly': d.setDate(d.getDate() + 7); break
    default: d.setFullYear(d.getFullYear() + 1)
  }
  return d.toISOString().split('T')[0]
}
