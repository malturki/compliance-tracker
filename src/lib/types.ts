export type Category = 'tax' | 'investor' | 'equity' | 'state' | 'federal' | 'contract' | 'insurance' | 'benefits' | 'governance' | 'vendor'
export type Frequency = 'annual' | 'quarterly' | 'monthly' | 'weekly' | 'one-time' | 'event-triggered'
export type Status = 'current' | 'upcoming' | 'overdue' | 'completed' | 'unknown' | 'not-applicable'
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

export interface Obligation {
  id: string
  title: string
  description?: string | null
  category: Category
  subcategory?: string | null
  frequency: Frequency
  nextDueDate: string
  lastCompletedDate?: string | null
  owner: string
  assignee?: string | null
  status: Status
  riskLevel: RiskLevel
  alertDays: number[]
  sourceDocument?: string | null
  notes?: string | null
  entity: string
  jurisdiction?: string | null
  amount?: number | null
  autoRecur: boolean
  createdAt: string
  updatedAt: string
}

export interface Completion {
  id: string
  obligationId: string
  completedDate: string
  completedBy: string
  evidenceUrl?: string | null
  notes?: string | null
  createdAt: string
}

export interface Stats {
  total: number
  overdue: number
  dueThisWeek: number
  dueThisMonth: number
  current: number
  byCategory: Record<string, { total: number; overdue: number }>
  byRisk: Record<string, number>
}
