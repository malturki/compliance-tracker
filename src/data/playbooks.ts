/**
 * Playbook definitions — reusable workflow templates that expand into a parent
 * obligation + a tree of sub-obligations when applied.
 *
 * Definitions are static code (not DB rows) so they version with the codebase.
 * Counterparty-specific data (which investor, vendor, etc.) is supplied at
 * apply time via the Apply dialog, not baked into the playbook.
 *
 * See docs/superpowers/plans/2026-04-23-agentic-obligations.md (Phase 1).
 */

import type { Category, RiskLevel } from '@/lib/types'

export interface PlaybookStep {
  /** Stable identifier within this playbook. Used to target ownerOverrides. */
  slug: string
  /** Rendered as the sub-obligation title. Supports {{counterparty}} placeholder. */
  title: string
  description?: string
  /** Role label shown as the default owner, e.g. "CFO". Overridable at apply time. */
  defaultOwner: string
  /** Negative = before anchor date, positive = after. */
  offsetDaysFromAnchor: number
  riskLevel: RiskLevel
  /** If true, completing this step requires at least one evidence URL. Phase 1 UI enforces. */
  evidenceRequired: boolean
  alertDays?: number[]
  notes?: string
}

export type AnchorDateStrategy = 'end-of-quarter' | 'provided-at-apply'
export type PlaybookRecurrence = 'quarterly' | 'annual' | 'monthly' | null

export interface Playbook {
  /** Stable slug, e.g. "quarterly-investor-report". */
  id: string
  name: string
  description: string
  category: Category
  icon: string
  anchorDateStrategy: AnchorDateStrategy
  recurrence?: PlaybookRecurrence
  /** If true, applyPlaybook requires a counterparty string. */
  requiresCounterparty: boolean
  parentTemplate: {
    /** Supports {{quarter}}, {{year}}, {{counterparty}} placeholders. */
    title: string
    description?: string
    jurisdiction?: string
    amount?: number
  }
  steps: PlaybookStep[]
}

export interface ApplyPlaybookInput {
  playbookId: string
  /** ISO date (YYYY-MM-DD). Parent's nextDueDate. Each step is anchorDate + offsetDaysFromAnchor. */
  anchorDate: string
  /** Required when playbook.requiresCounterparty. Populates the parent's counterparty + placeholders. */
  counterparty?: string
  /** Map of step slug → owner name, overriding defaultOwner for that step. */
  ownerOverrides?: Record<string, string>
}

export const playbooks: Playbook[] = [
  {
    id: 'quarterly-investor-report',
    name: 'Quarterly Investor Report',
    description:
      'Prepare and send a quarterly report to an investor: collect financials, draft narrative, review, send, archive.',
    category: 'investor',
    icon: '📊',
    anchorDateStrategy: 'end-of-quarter',
    recurrence: 'quarterly',
    requiresCounterparty: true,
    parentTemplate: {
      title: '{{counterparty}} — {{quarter}} {{year}} Quarterly Report',
      description: 'Quarterly financials + narrative delivered to {{counterparty}}.',
    },
    steps: [
      {
        slug: 'collect-financials',
        title: 'Collect quarterly financials',
        description: 'Pull P&L, balance sheet, cash summary for the quarter.',
        defaultOwner: 'CFO',
        offsetDaysFromAnchor: -21,
        riskLevel: 'high',
        evidenceRequired: true,
        alertDays: [7, 3, 1],
      },
      {
        slug: 'draft-narrative',
        title: 'Draft narrative update',
        description: 'Write the investor-facing commentary: wins, losses, asks, next quarter plan.',
        defaultOwner: 'CEO',
        offsetDaysFromAnchor: -14,
        riskLevel: 'medium',
        evidenceRequired: true,
        alertDays: [5, 2],
      },
      {
        slug: 'internal-review',
        title: 'Internal review + sign-off',
        description: 'CFO and CEO review the full packet before it ships.',
        defaultOwner: 'CEO',
        offsetDaysFromAnchor: -7,
        riskLevel: 'medium',
        evidenceRequired: false,
        alertDays: [2, 1],
      },
      {
        slug: 'send-to-investor',
        title: 'Send report to {{counterparty}}',
        description: 'Send the final packet via email and attach the sent-confirmation as evidence.',
        defaultOwner: 'CEO',
        offsetDaysFromAnchor: 0,
        riskLevel: 'critical',
        evidenceRequired: true,
        alertDays: [1, 0],
      },
      {
        slug: 'archive',
        title: 'Archive & reconcile',
        description: 'File a copy of the delivered report in the canonical location and reconcile to prior quarter.',
        defaultOwner: 'CFO',
        offsetDaysFromAnchor: 3,
        riskLevel: 'low',
        evidenceRequired: false,
      },
    ],
  },

  // Placeholder — full step list lands in a later phase. Exists so the browse UI
  // has more than one row from day one. Cannot be applied yet (empty steps).
  {
    id: 'annual-insurance-renewal',
    name: 'Annual Insurance Renewal',
    description:
      'Broker-led annual renewal: quote, comparison, stakeholder approval, bind, cert on file. (Placeholder — full steps coming in a later phase.)',
    category: 'insurance',
    icon: '🛡️',
    anchorDateStrategy: 'provided-at-apply',
    recurrence: 'annual',
    requiresCounterparty: true,
    parentTemplate: {
      title: '{{counterparty}} — Policy Renewal',
      description: 'Annual renewal cycle for {{counterparty}} coverage.',
    },
    steps: [],
  },
]

export function getPlaybook(id: string): Playbook | undefined {
  return playbooks.find(p => p.id === id)
}
