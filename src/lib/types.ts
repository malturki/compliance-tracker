export type Category = 'tax' | 'investor' | 'equity' | 'state' | 'federal' | 'contract' | 'insurance' | 'benefits' | 'governance' | 'vendor'
export type Frequency = 'annual' | 'quarterly' | 'monthly' | 'weekly' | 'one-time' | 'event-triggered'
export type Status = 'current' | 'upcoming' | 'overdue' | 'completed' | 'blocked' | 'unknown' | 'not-applicable'
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type Role = 'viewer' | 'editor' | 'admin'
export type VerificationStatus = 'unverified' | 'self-verified' | 'approved' | 'audited'

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
  counterparty?: string | null
  jurisdiction?: string | null
  amount?: number | null
  autoRecur: boolean
  // Agentic obligations (Phase 0): sub-obligation tree + blocker state + next-action hint
  parentId?: string | null
  sequence?: number | null
  blockerReason?: string | null
  nextRecommendedAction?: string | null
  createdAt: string
  updatedAt: string
}

export interface Completion {
  id: string
  obligationId: string
  completedDate: string
  completedBy: string
  evidenceUrl?: string[] | null
  notes?: string | null
  // Evidence packet (Phase 0): approver + verification + richer summary + multi-file evidence
  approvedBy?: string | null
  approvedDate?: string | null
  verificationStatus?: VerificationStatus | null
  summary?: string | null
  evidenceUrls?: string[] | null
  createdAt: string
}

/** Typed view over the evidence fields on a Completion, used by Phase 1 UI. */
export interface EvidencePacket {
  completedBy: string
  completedDate: string
  approvedBy?: string | null
  approvedDate?: string | null
  verificationStatus: VerificationStatus
  summary?: string | null
  evidenceUrls: string[]
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
