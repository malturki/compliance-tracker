import type { Category, Frequency, RiskLevel } from '@/lib/types'

export interface TemplateObligation {
  title: string
  description?: string
  category: Category
  subcategory?: string
  frequency: Frequency
  relativeDueDate: RelativeDueDate
  owner: string
  riskLevel: RiskLevel
  alertDays: number[]
  jurisdiction?: string
  amount?: number
  autoRecur: boolean
  notes?: string
}

export interface RelativeDueDate {
  type: 'fixed-date' | 'days-from-now' | 'quarterly' | 'monthly'
  month?: number
  day?: number
  days?: number
  quarter?: number
  daysAfterQuarterEnd?: number
  dayOfMonth?: number
}

export interface Template {
  id: string
  name: string
  description: string
  category: 'corporate' | 'tax' | 'investor-relations' | 'hr-benefits' | 'contracts' | 'insurance'
  icon: string
  obligations: TemplateObligation[]
}

export const templates: Template[] = [
  {
    id: 'delaware-c-corp',
    name: 'Delaware C-Corp Basics',
    description: 'Essential annual compliance obligations for Delaware corporations',
    category: 'corporate',
    icon: '📄',
    obligations: [
      {
        title: 'Delaware Franchise Tax',
        description: 'Annual franchise tax payment due March 1st',
        category: 'state',
        frequency: 'annual',
        relativeDueDate: { type: 'fixed-date', month: 3, day: 1 },
        owner: 'CFO',
        riskLevel: 'high',
        amount: 450,
        alertDays: [30, 14, 7, 1],
        jurisdiction: 'Delaware',
        autoRecur: true,
        notes: 'Pay online at corp.delaware.gov. Choose authorized shares method to minimize tax.',
      },
      {
        title: 'Delaware Annual Report',
        description: 'File annual report with Delaware Division of Corporations',
        category: 'state',
        frequency: 'annual',
        relativeDueDate: { type: 'fixed-date', month: 3, day: 1 },
        owner: 'CFO',
        riskLevel: 'high',
        amount: 50,
        alertDays: [30, 14, 7, 1],
        jurisdiction: 'Delaware',
        autoRecur: true,
        notes: 'Update registered agent and officer information if changed.',
      },
      {
        title: 'Registered Agent Renewal',
        description: 'Confirm registered agent service is active',
        category: 'state',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CFO',
        riskLevel: 'medium',
        amount: 299,
        alertDays: [30, 14],
        jurisdiction: 'Delaware',
        autoRecur: true,
        notes: 'Most registered agent services auto-renew. Confirm billing is up to date.',
      },
      {
        title: 'Annual Stockholder Meeting',
        description: 'Hold annual meeting of stockholders per bylaws',
        category: 'governance',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'General Counsel',
        riskLevel: 'medium',
        alertDays: [60, 30, 14],
        jurisdiction: 'Delaware',
        autoRecur: true,
        notes: 'Record minutes and resolutions. Elect directors.',
      },
      {
        title: 'Annual Board Meeting',
        description: 'Hold annual meeting of board of directors',
        category: 'governance',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'General Counsel',
        riskLevel: 'medium',
        alertDays: [60, 30, 14],
        jurisdiction: 'Delaware',
        autoRecur: true,
        notes: 'Approve financial statements, elect officers, review major contracts.',
      },
      {
        title: 'Corporate Records Update',
        description: 'Update corporate records book with new documents',
        category: 'governance',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'General Counsel',
        riskLevel: 'low',
        alertDays: [30],
        jurisdiction: 'Delaware',
        autoRecur: true,
        notes: 'Include: meeting minutes, stock ledger updates, major contracts, option grants.',
      },
    ],
  },
  {
    id: 'federal-payroll-tax',
    name: 'Federal Payroll Tax',
    description: 'Quarterly and annual federal payroll tax filings (941, 940, W-2, 1099)',
    category: 'tax',
    icon: '💰',
    obligations: [
      {
        title: 'IRS Form 941 - Q1',
        description: 'Quarterly federal payroll tax return',
        category: 'federal',
        frequency: 'quarterly',
        relativeDueDate: { type: 'fixed-date', month: 4, day: 30 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [14, 7, 3, 1],
        jurisdiction: 'Federal',
        autoRecur: true,
        notes: 'Report wages, tips, and withholding. Due April 30 for Q1.',
      },
      {
        title: 'IRS Form 941 - Q2',
        description: 'Quarterly federal payroll tax return',
        category: 'federal',
        frequency: 'quarterly',
        relativeDueDate: { type: 'fixed-date', month: 7, day: 31 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [14, 7, 3, 1],
        jurisdiction: 'Federal',
        autoRecur: true,
        notes: 'Report wages, tips, and withholding. Due July 31 for Q2.',
      },
      {
        title: 'IRS Form 941 - Q3',
        description: 'Quarterly federal payroll tax return',
        category: 'federal',
        frequency: 'quarterly',
        relativeDueDate: { type: 'fixed-date', month: 10, day: 31 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [14, 7, 3, 1],
        jurisdiction: 'Federal',
        autoRecur: true,
        notes: 'Report wages, tips, and withholding. Due October 31 for Q3.',
      },
      {
        title: 'IRS Form 941 - Q4',
        description: 'Quarterly federal payroll tax return',
        category: 'federal',
        frequency: 'quarterly',
        relativeDueDate: { type: 'fixed-date', month: 1, day: 31 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [14, 7, 3, 1],
        jurisdiction: 'Federal',
        autoRecur: true,
        notes: 'Report wages, tips, and withholding. Due January 31 for Q4.',
      },
      {
        title: 'IRS Form 940 (FUTA)',
        description: 'Annual federal unemployment tax return',
        category: 'federal',
        frequency: 'annual',
        relativeDueDate: { type: 'fixed-date', month: 1, day: 31 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [30, 14, 7],
        jurisdiction: 'Federal',
        autoRecur: true,
        notes: 'Report unemployment tax. Due January 31.',
      },
      {
        title: 'IRS Form W-2',
        description: 'Wage and tax statement for employees',
        category: 'federal',
        frequency: 'annual',
        relativeDueDate: { type: 'fixed-date', month: 1, day: 31 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [30, 14, 7],
        jurisdiction: 'Federal',
        autoRecur: true,
        notes: 'Provide W-2 to employees and file with SSA. Due January 31.',
      },
      {
        title: 'IRS Form 1099-NEC',
        description: 'Nonemployee compensation (contractors)',
        category: 'federal',
        frequency: 'annual',
        relativeDueDate: { type: 'fixed-date', month: 1, day: 31 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [30, 14, 7],
        jurisdiction: 'Federal',
        autoRecur: true,
        notes: 'Report payments to contractors $600+. Due January 31.',
      },
    ],
  },
  {
    id: 'investor-reporting',
    name: 'Investor Reporting',
    description: 'Quarterly investor updates, cap table maintenance, annual meeting',
    category: 'investor-relations',
    icon: '📊',
    obligations: [
      {
        title: 'Q1 Investor Update',
        description: 'Quarterly investor update and financial report',
        category: 'investor',
        frequency: 'quarterly',
        relativeDueDate: { type: 'quarterly', quarter: 1, daysAfterQuarterEnd: 45 },
        owner: 'CEO',
        riskLevel: 'high',
        alertDays: [30, 14, 7],
        autoRecur: true,
        notes: 'Include: financial summary, KPIs, headcount, milestones, risks, asks.',
      },
      {
        title: 'Q2 Investor Update',
        description: 'Quarterly investor update and financial report',
        category: 'investor',
        frequency: 'quarterly',
        relativeDueDate: { type: 'quarterly', quarter: 2, daysAfterQuarterEnd: 45 },
        owner: 'CEO',
        riskLevel: 'high',
        alertDays: [30, 14, 7],
        autoRecur: true,
        notes: 'Include: financial summary, KPIs, headcount, milestones, risks, asks.',
      },
      {
        title: 'Q3 Investor Update',
        description: 'Quarterly investor update and financial report',
        category: 'investor',
        frequency: 'quarterly',
        relativeDueDate: { type: 'quarterly', quarter: 3, daysAfterQuarterEnd: 45 },
        owner: 'CEO',
        riskLevel: 'high',
        alertDays: [30, 14, 7],
        autoRecur: true,
        notes: 'Include: financial summary, KPIs, headcount, milestones, risks, asks.',
      },
      {
        title: 'Q4 Investor Update',
        description: 'Quarterly investor update and financial report',
        category: 'investor',
        frequency: 'quarterly',
        relativeDueDate: { type: 'quarterly', quarter: 4, daysAfterQuarterEnd: 45 },
        owner: 'CEO',
        riskLevel: 'high',
        alertDays: [30, 14, 7],
        autoRecur: true,
        notes: 'Include: financial summary, KPIs, headcount, milestones, risks, asks. Include annual summary.',
      },
      {
        title: 'Cap Table Update',
        description: 'Update capitalization table and audit for accuracy',
        category: 'investor',
        frequency: 'quarterly',
        relativeDueDate: { type: 'days-from-now', days: 90 },
        owner: 'CFO',
        riskLevel: 'medium',
        alertDays: [30, 14],
        autoRecur: true,
        notes: 'Reconcile option grants, exercises, new equity issuances.',
      },
      {
        title: 'Annual Investor Meeting',
        description: 'Host annual meeting for investors',
        category: 'investor',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CEO',
        riskLevel: 'medium',
        alertDays: [60, 30, 14],
        autoRecur: true,
        notes: 'Present annual performance, strategy, roadmap. Q&A session.',
      },
    ],
  },
  {
    id: 'insurance-benefits',
    name: 'Insurance & Benefits',
    description: 'Annual insurance renewals, open enrollment, benefit compliance',
    category: 'hr-benefits',
    icon: '🏥',
    obligations: [
      {
        title: 'Health Insurance Renewal',
        description: 'Review and renew company health insurance policy',
        category: 'benefits',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [60, 45, 30, 14],
        autoRecur: true,
        notes: 'Shop rates 60 days before renewal. Notify employees 30 days in advance.',
      },
      {
        title: 'Open Enrollment Period',
        description: 'Annual benefits open enrollment for employees',
        category: 'benefits',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [60, 30, 14],
        autoRecur: true,
        notes: 'Communicate benefit changes, host Q&A, collect employee elections.',
      },
      {
        title: 'D&O Insurance Renewal',
        description: 'Directors & Officers liability insurance renewal',
        category: 'insurance',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CFO',
        riskLevel: 'high',
        amount: 5000,
        alertDays: [60, 30, 14],
        autoRecur: true,
        notes: 'Review coverage limits with counsel. Ensure tail coverage if changing carriers.',
      },
      {
        title: 'Cyber Insurance Renewal',
        description: 'Cyber liability insurance renewal',
        category: 'insurance',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CFO',
        riskLevel: 'high',
        amount: 3000,
        alertDays: [60, 30, 14],
        autoRecur: true,
        notes: 'Update revenue/headcount. Confirm security requirements (MFA, backups).',
      },
      {
        title: 'Workers Compensation Audit',
        description: 'Annual workers comp premium audit',
        category: 'insurance',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CFO',
        riskLevel: 'medium',
        alertDays: [30, 14],
        autoRecur: true,
        notes: 'Provide payroll data to insurer. Respond within 30 days to avoid penalties.',
      },
      {
        title: 'IRS Form 5500 (Employee Benefit Plan)',
        description: 'Annual return/report for employee benefit plans',
        category: 'benefits',
        frequency: 'annual',
        relativeDueDate: { type: 'fixed-date', month: 7, day: 31 },
        owner: 'CFO',
        riskLevel: 'high',
        alertDays: [60, 30, 14],
        jurisdiction: 'Federal',
        autoRecur: true,
        notes: 'Required if 100+ participants in 401k or health plan. Due July 31.',
      },
    ],
  },
  {
    id: 'contracts-renewals',
    name: 'Contracts & Renewals',
    description: 'Track SaaS subscriptions, vendor contracts, lease renewals',
    category: 'contracts',
    icon: '📝',
    obligations: [
      {
        title: 'Office Lease Renewal',
        description: 'Review and renew office lease agreement',
        category: 'contract',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CFO',
        riskLevel: 'medium',
        alertDays: [90, 60, 30],
        autoRecur: true,
        notes: 'Most leases require 60-90 days notice before renewal or termination.',
      },
      {
        title: 'AWS/Cloud Infrastructure Renewal',
        description: 'Review cloud infrastructure spend and commitment',
        category: 'vendor',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CTO',
        riskLevel: 'medium',
        alertDays: [45, 30, 14],
        autoRecur: true,
        notes: 'Review usage trends. Consider reserved instances or savings plans.',
      },
      {
        title: 'SaaS Audit (Slack, Notion, etc.)',
        description: 'Review all SaaS subscriptions for unused licenses',
        category: 'vendor',
        frequency: 'quarterly',
        relativeDueDate: { type: 'days-from-now', days: 90 },
        owner: 'CFO',
        riskLevel: 'low',
        alertDays: [30],
        autoRecur: true,
        notes: 'Audit tools: Slack, Notion, GitHub, Figma, Zoom. Remove inactive users.',
      },
      {
        title: 'Legal Counsel Retainer Review',
        description: 'Review legal counsel arrangement and rates',
        category: 'contract',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CEO',
        riskLevel: 'medium',
        alertDays: [60, 30],
        autoRecur: true,
        notes: 'Evaluate if current firm meets needs. Shop rates if spending $50k+/year.',
      },
      {
        title: 'Accounting Firm Engagement Letter',
        description: 'Renew engagement with accounting/bookkeeping firm',
        category: 'contract',
        frequency: 'annual',
        relativeDueDate: { type: 'days-from-now', days: 365 },
        owner: 'CFO',
        riskLevel: 'medium',
        alertDays: [60, 30],
        autoRecur: true,
        notes: 'Confirm scope: bookkeeping, tax prep, audit support. Lock in rates.',
      },
    ],
  },
]

/**
 * Calculate absolute due date from relative date spec
 */
export function calculateDueDate(relative: RelativeDueDate): Date {
  const today = new Date()

  switch (relative.type) {
    case 'fixed-date': {
      const year = today.getFullYear()
      const targetDate = new Date(year, relative.month! - 1, relative.day!)
      if (targetDate < today) {
        targetDate.setFullYear(year + 1)
      }
      return targetDate
    }

    case 'days-from-now': {
      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + relative.days!)
      return futureDate
    }

    case 'quarterly': {
      const year = today.getFullYear()
      const quarterEndMonth = relative.quarter! * 3
      const quarterEndDate = new Date(year, quarterEndMonth, 0)
      if (quarterEndDate < today) {
        quarterEndDate.setFullYear(year + 1)
      }
      quarterEndDate.setDate(quarterEndDate.getDate() + (relative.daysAfterQuarterEnd || 0))
      return quarterEndDate
    }

    case 'monthly': {
      const targetDate = new Date(today.getFullYear(), today.getMonth(), relative.dayOfMonth!)
      if (targetDate < today) {
        targetDate.setMonth(targetDate.getMonth() + 1)
      }
      return targetDate
    }

    default:
      return today
  }
}

export function formatDueDateForDb(date: Date): string {
  return date.toISOString().split('T')[0]
}
