import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isPast, isToday, addDays, startOfDay } from 'date-fns'
import type { RiskLevel, Status } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
    case 'critical': return 'text-red-400 bg-red-950/50 border-red-800/50'
    case 'high': return 'text-orange-400 bg-orange-950/50 border-orange-800/50'
    case 'medium': return 'text-amber-400 bg-amber-950/50 border-amber-800/50'
    case 'low': return 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50'
  }
}

export function getStatusColor(status: Status): string {
  switch (status) {
    case 'overdue': return 'text-red-400 bg-red-950/50 border-red-800/50'
    case 'upcoming': return 'text-amber-400 bg-amber-950/50 border-amber-800/50'
    case 'current': return 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50'
    case 'completed': return 'text-sky-400 bg-sky-950/50 border-sky-800/50'
    default: return 'text-slate-400 bg-slate-800/50 border-slate-700/50'
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
