import { createClient } from '@libsql/client'
import { ulid } from 'ulid'

async function seed() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

  // Support both Turso (production) and local file (development)
  const client = tursoUrl
    ? createClient({
        url: tursoUrl,
        authToken: tursoAuthToken,
      })
    : createClient({
        url: 'file:compliance.db',
      })

  const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS obligations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    frequency TEXT NOT NULL,
    next_due_date TEXT NOT NULL,
    last_completed_date TEXT,
    owner TEXT NOT NULL,
    owner_email TEXT,
    assignee TEXT,
    assignee_email TEXT,
    status TEXT NOT NULL DEFAULT 'current',
    risk_level TEXT NOT NULL DEFAULT 'medium',
    alert_days TEXT DEFAULT '[]',
    last_alert_sent TEXT,
    source_document TEXT,
    notes TEXT,
    entity TEXT DEFAULT 'Pi Squared Inc.',
    jurisdiction TEXT,
    amount REAL,
    auto_recur INTEGER DEFAULT 0,
    template_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS completions (
    id TEXT PRIMARY KEY,
    obligation_id TEXT NOT NULL REFERENCES obligations(id),
    completed_date TEXT NOT NULL,
    completed_by TEXT NOT NULL,
    evidence_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  )`,
]

// Execute table creation with Turso client
for (const sql of CREATE_TABLES_SQL) {
  await client.execute(sql)
}

// Today is 2026-04-01 for seed purposes
const TODAY = new Date('2026-04-01')

function computeStatus(nextDueDate: string): string {
  const due = new Date(nextDueDate)
  const diffMs = due.getTime() - TODAY.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 14) return 'upcoming'
  return 'current'
}

const records = [
  { title: 'Delaware Franchise Tax', category: 'state', subcategory: 'annual-filing', frequency: 'annual', next_due_date: '2027-03-01', owner: 'Ashbury Legal', risk_level: 'high', jurisdiction: 'Delaware', amount: 450, notes: 'Uses Assumed Par Value Capital Method. Filed through Jan 2026.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'Illinois Annual Report', category: 'state', subcategory: 'annual-filing', frequency: 'annual', next_due_date: '2027-01-09', owner: 'Ashbury Legal', risk_level: 'medium', jurisdiction: 'Illinois', amount: 200, notes: 'BCA 14.30 form, File #74447627. Last filed 2025-01-09.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'Texas Annual Filing', category: 'state', subcategory: 'annual-filing', frequency: 'annual', next_due_date: '2027-02-20', owner: 'Northwest Registered Agent', risk_level: 'medium', jurisdiction: 'Texas', notes: 'Paid Feb 2026 via Northwest Registered Agent.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'Delaware Registered Agent Renewal', category: 'state', subcategory: 'corporate-services', frequency: 'annual', next_due_date: '2026-10-19', owner: 'Republic Registered Agent', risk_level: 'medium', jurisdiction: 'Delaware', amount: 100, notes: 'Republic Registered Agent LLC.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'D&O Insurance Renewal', category: 'insurance', subcategory: 'directors-officers', frequency: 'annual', next_due_date: '2027-03-18', owner: 'Internal', risk_level: 'high', amount: 5823, notes: 'Berkley Regional Insurance Co. Policy BMP-1040437-02. $1M aggregate limit. Start renewal process 60 days before.', alert_days: [90, 60, 30, 14], auto_recur: true },
  { title: 'SEC Form D Amendment - Seed 2024 (021-512728)', category: 'federal', subcategory: 'sec', frequency: 'event-triggered', next_due_date: '2026-05-08', owner: 'Ashbury Legal', risk_level: 'high', jurisdiction: 'Federal', notes: 'Annual review if offering remains open.', alert_days: [30, 14, 7], auto_recur: true },
  { title: 'SEC Form D Amendment - 2025 Round (021-545317)', category: 'federal', subcategory: 'sec', frequency: 'event-triggered', next_due_date: '2026-05-06', owner: 'Ashbury Legal', risk_level: 'high', jurisdiction: 'Federal', notes: 'Annual review if offering remains open.', alert_days: [30, 14, 7], auto_recur: true },
  { title: 'FinCEN BOI Report Update', category: 'federal', subcategory: 'fincen', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Jane Smith', risk_level: 'critical', jurisdiction: 'Federal', notes: 'Must file within 30 days of changes to beneficial owners. Civil/criminal penalties for non-compliance.', alert_days: [30, 7], auto_recur: false },
  { title: 'Annual Stockholder Consent', category: 'governance', subcategory: 'corporate', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Ashbury Legal', risk_level: 'medium', jurisdiction: 'Delaware', notes: 'Delaware requires annual stockholder meeting or written consent in lieu.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'Corporate Income Tax (Form 1120)', category: 'tax', subcategory: 'corporate', frequency: 'annual', next_due_date: '2027-03-15', owner: 'Anderson & Co', risk_level: 'high', jurisdiction: 'Federal', notes: 'Or file extension by March 15. 2024 R&D credit study completed Oct 2025.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'R&D Tax Credit Study', category: 'tax', subcategory: 'corporate', frequency: 'annual', next_due_date: '2027-03-15', owner: 'GOAT.tax', risk_level: 'medium', jurisdiction: 'Federal', notes: 'Claimed on Form 1120. Reviewing cloud hosting, code repos, dev tools for qualification.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'Federal Estimated Tax - Q1', category: 'tax', subcategory: 'estimated', frequency: 'quarterly', next_due_date: '2026-04-15', owner: 'Anderson & Co', risk_level: 'high', jurisdiction: 'Federal', notes: 'Confirm payment amount with accountant.', alert_days: [14, 7, 3, 1], auto_recur: true },
  { title: 'Federal Estimated Tax - Q2', category: 'tax', subcategory: 'estimated', frequency: 'quarterly', next_due_date: '2026-06-15', owner: 'Anderson & Co', risk_level: 'high', jurisdiction: 'Federal', alert_days: [14, 7, 3, 1], auto_recur: true },
  { title: 'Federal Estimated Tax - Q3', category: 'tax', subcategory: 'estimated', frequency: 'quarterly', next_due_date: '2026-09-15', owner: 'Anderson & Co', risk_level: 'high', jurisdiction: 'Federal', alert_days: [14, 7, 3, 1], auto_recur: true },
  { title: 'Federal Estimated Tax - Q4', category: 'tax', subcategory: 'estimated', frequency: 'quarterly', next_due_date: '2027-01-15', owner: 'Anderson & Co', risk_level: 'high', jurisdiction: 'Federal', alert_days: [14, 7, 3, 1], auto_recur: true },
  { title: 'Form 941 - Q1 Payroll Tax', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', notes: 'Auto-filed by QuickBooks. Verify submission.', alert_days: [14, 7, 1], auto_recur: true },
  { title: 'Form 941 - Q2 Payroll Tax', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-07-31', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', alert_days: [14, 7, 1], auto_recur: true },
  { title: 'Form 941 - Q3 Payroll Tax', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-10-31', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', alert_days: [14, 7, 1], auto_recur: true },
  { title: 'Form 941 - Q4 Payroll Tax', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2027-01-31', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', alert_days: [14, 7, 1], auto_recur: true },
  { title: 'Form 940 - FUTA Annual', category: 'tax', subcategory: 'payroll', frequency: 'annual', next_due_date: '2027-01-31', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', notes: 'Auto-filed by QuickBooks.', alert_days: [30, 14, 7], auto_recur: true },
  { title: '1099-NEC Filing (Contractors)', category: 'tax', subcategory: 'information-returns', frequency: 'annual', next_due_date: '2027-01-31', owner: 'Anderson & Co', risk_level: 'high', notes: '14 contractors currently.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'W-2 Filing (Employees)', category: 'tax', subcategory: 'information-returns', frequency: 'annual', next_due_date: '2027-01-31', owner: 'Anderson & Co', risk_level: 'high', notes: '8 employees currently.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'Illinois State Corporate Income Tax', category: 'tax', subcategory: 'state-tax', frequency: 'annual', next_due_date: '2027-03-15', owner: 'Anderson & Co', risk_level: 'medium', jurisdiction: 'Illinois', notes: 'Filed with federal return.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'State Unemployment Insurance (Multi-state)', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', notes: 'IL, CA, TX, TN. California SDI wage code review pending.', alert_days: [14, 7], auto_recur: true },
  { title: 'Tennessee Tax Assessment Resolution', category: 'tax', subcategory: 'state-tax', frequency: 'one-time', next_due_date: '2026-05-01', owner: 'Anderson & Co', risk_level: 'high', jurisdiction: 'Tennessee', amount: 28000, notes: '$28K disputed assessment from Oct 2025. Under review with accountant.', alert_days: [14, 7, 1], auto_recur: false },
  { title: 'California SDI Wage Code Review', category: 'tax', subcategory: 'state-tax', frequency: 'one-time', next_due_date: '2026-04-15', owner: 'Internal', risk_level: 'medium', jurisdiction: 'California', notes: 'Starred inbox item. Review required.', alert_days: [7, 3, 1], auto_recur: false },
  { title: 'SIMPLE IRA Employer Match', category: 'benefits', subcategory: 'retirement', frequency: 'annual', next_due_date: '2026-10-15', owner: 'Internal', risk_level: 'medium', notes: '3% employer match mandatory. Custodian: Ascensus.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'SIMPLE IRA Form 5500', category: 'benefits', subcategory: 'retirement', frequency: 'annual', next_due_date: '2026-07-31', owner: 'Ascensus / Anderson', risk_level: 'medium', notes: 'Required if plan assets exceed $250K.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'RxDC Prescription Drug Reporting', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2026-06-01', owner: 'Dimond Bros / Internal', risk_level: 'high', notes: 'CMS requirement under Consolidated Appropriations Act 2021.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'ACA Reporting (1095-C / 1094-C)', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2027-03-31', owner: 'Dimond Bros / Internal', risk_level: 'medium', notes: 'Required for applicable large employers (>50 FTEs). Pi Squared Inc. has 8 employees - may not apply.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'Health Insurance Annual Renewal', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2027-01-01', owner: 'Dimond Bros', risk_level: 'medium', notes: 'BCBS/Mutual of Omaha through Dimond Bros. Open enrollment Nov-Dec.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'Venture Partners LP - FY2025 Annual Financials', category: 'investor', subcategory: 'venture-partners', frequency: 'annual', next_due_date: '2026-04-30', owner: 'Internal / Anderson', risk_level: 'critical', notes: 'Unaudited annual financials due within 120 days of fiscal year end. Venture Partners LP ($7.5M investor).', alert_days: [30, 14, 7, 3, 1], auto_recur: true },
  { title: 'Venture Partners LP - Q1 2026 Quarterly Financials', category: 'investor', subcategory: 'venture-partners', frequency: 'quarterly', next_due_date: '2026-05-15', owner: 'Internal / Anderson', risk_level: 'critical', notes: 'Due within 45 days of quarter end (Mar 31).', alert_days: [30, 14, 7, 3, 1], auto_recur: true },
  { title: 'Venture Partners LP - Q2 2026 Quarterly Financials', category: 'investor', subcategory: 'venture-partners', frequency: 'quarterly', next_due_date: '2026-08-14', owner: 'Internal / Anderson', risk_level: 'critical', notes: 'Due within 45 days of quarter end (Jun 30).', alert_days: [30, 14, 7, 3, 1], auto_recur: true },
  { title: 'Venture Partners LP - Q3 2026 Quarterly Financials', category: 'investor', subcategory: 'venture-partners', frequency: 'quarterly', next_due_date: '2026-11-14', owner: 'Internal / Anderson', risk_level: 'critical', notes: 'Due within 45 days of quarter end (Sep 30).', alert_days: [30, 14, 7, 3, 1], auto_recur: true },
  { title: 'Venture Partners LP - FY2027 Annual Operating Plan', category: 'investor', subcategory: 'venture-partners', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'high', notes: 'Must deliver before start of FY2027.', alert_days: [90, 60, 30, 14], auto_recur: true },
  { title: 'Venture Partners LP - Consent Rights (Material Actions)', category: 'investor', subcategory: 'venture-partners', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal / Ashbury Legal', risk_level: 'critical', notes: '9 consent categories including stock issuance >1M shares, debt >$500K, acquisitions.', alert_days: [7], auto_recur: false },
  { title: 'Venture Partners LP - Pro Rata Rights Notice (New Securities)', category: 'investor', subcategory: 'venture-partners', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal / Ashbury Legal', risk_level: 'high', notes: '15-day advance notice before closing any new securities issuance.', alert_days: [30, 15], auto_recur: false },
  { title: 'Venture Partners LP - MFN Rights Monitoring', category: 'investor', subcategory: 'venture-partners', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal / Ashbury Legal', risk_level: 'high', notes: 'Must provide notice and match any more favorable terms issued to other investors.', alert_days: [7], auto_recur: false },
  { title: 'Venture Partners LP - Board Observer Materials', category: 'investor', subcategory: 'venture-partners', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Invite observer to all board meetings, provide materials same timing as directors.', alert_days: [7], auto_recur: false },
  { title: '409A Valuation Renewal', category: 'equity', subcategory: 'compliance', frequency: 'annual', next_due_date: '2027-02-28', owner: 'Carta / Internal', risk_level: 'critical', notes: 'Last valuation Feb 2026 at $0.48/share FMV. Must renew within 12 months.', alert_days: [90, 60, 30, 14], auto_recur: true },
  { title: '83(b) Election Tracking', category: 'equity', subcategory: 'options', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'critical', notes: '30-day deadline from option exercise. No tracking system currently exists. CRITICAL GAP.', alert_days: [30, 14, 7, 1], auto_recur: false },
  { title: 'Stock Option Pool Reconciliation', category: 'equity', subcategory: 'options', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'Internal', risk_level: 'medium', notes: '380,000 shares authorized. Verify total grants don\'t exceed pool before each new grant.', alert_days: [30, 14], auto_recur: true },
  { title: 'Carta/Delaware Stock Ledger Sync', category: 'equity', subcategory: 'cap-table', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'Internal', risk_level: 'medium', notes: 'Reconcile Carta cap table with official Delaware stock ledger quarterly.', alert_days: [30, 14], auto_recur: true },
  { title: 'Post-Termination Option Exercise Monitoring', category: 'equity', subcategory: 'options', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'high', notes: '90-day exercise window for voluntary/involuntary termination. John Doe repurchase in progress.', alert_days: [60, 30, 14, 7], auto_recur: false },
  { title: 'ISO Annual Limit Compliance ($100K)', category: 'equity', subcategory: 'options', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Ensure ISO grants don\'t exceed $100K/year first-exercisable limit per grantee.', alert_days: [30], auto_recur: true },
  { title: 'Token Incentive Plan Administration', category: 'equity', subcategory: 'tokens', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Separate from Stock Option Plan. Review upon TGE.', alert_days: [30], auto_recur: false },
  { title: 'SAFT/Token Warrant Delivery (upon TGE)', category: 'equity', subcategory: 'tokens', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal / Ashbury Legal', risk_level: 'high', notes: '2 SAFTs + token warrants require delivery upon Token Generation Event. 40 investors total.', alert_days: [90, 60, 30], auto_recur: false },
  { title: 'BlockChain Inc Retainer Renewal', category: 'contract', subcategory: 'client', frequency: 'one-time', next_due_date: '2026-06-29', owner: 'Internal', risk_level: 'medium', amount: 135000, notes: '5-month retainer from Jan 29, 2026. $135K. 30-day termination notice.', alert_days: [60, 30, 14, 7], auto_recur: false },
  { title: 'H-1B Registration Window', category: 'contract', subcategory: 'visa', frequency: 'annual', next_due_date: '2027-03-01', owner: 'DeHeng Law', risk_level: 'high', notes: 'FY2028 registration. March window.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'I-9 Work Authorization Reverification', category: 'contract', subcategory: 'employment', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'high', notes: 'Must reverify within 3 business days of work authorization expiration. CRITICAL GAP.', alert_days: [90, 30, 14, 3], auto_recur: false },
  { title: 'Slack Subscription Renewal', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2027-03-18', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews.', alert_days: [30, 14], auto_recur: true },
  { title: 'Datadog Subscription', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-18', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews monthly. Review usage.', alert_days: [7], auto_recur: true },
  { title: 'Google Workspace Renewal', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2027-03-31', owner: 'Internal', risk_level: 'low', notes: 'Google Voice Starter for acmecorp.com. Auto-renews.', alert_days: [30, 14], auto_recur: true },
  { title: 'Figma Subscription', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-16', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews monthly.', alert_days: [7], auto_recur: true },
  { title: 'Docker Subscription', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-05', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews monthly.', alert_days: [7], auto_recur: true },
  { title: 'QuickBooks Subscription', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-02', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews.', alert_days: [7], auto_recur: true },
  { title: 'AWS Monthly Bill', category: 'vendor', subcategory: 'cloud', frequency: 'monthly', next_due_date: '2026-04-02', owner: 'Internal', risk_level: 'low', notes: 'Pay-as-you-go. Review for cost optimization.', alert_days: [7], auto_recur: true },
  { title: 'Porkbun Domain Renewal', category: 'vendor', subcategory: 'domains', frequency: 'annual', next_due_date: '2027-03-12', owner: 'Internal', risk_level: 'medium', notes: 'Domain registrations. Annual renewal.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'HubSpot Cancellation Follow-up', category: 'vendor', subcategory: 'saas', frequency: 'one-time', next_due_date: '2026-04-06', owner: 'Internal', risk_level: 'low', notes: 'Cancellation requested Mar 6, 2026. Confirm effective date.', alert_days: [7, 3, 1], auto_recur: false },
  { title: 'QSBS Qualification Tracking', category: 'equity', subcategory: 'tax-benefit', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal / Anderson', risk_level: 'high', notes: 'Qualified Small Business Stock (Section 1202). Investors get up to $10M capital gains exclusion after 5 years.', alert_days: [90, 30], auto_recur: true },
  { title: 'Workers\' Compensation Insurance', category: 'insurance', subcategory: 'workers-comp', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Required in most states with employees.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'General Liability Insurance Review', category: 'insurance', subcategory: 'general', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Recommended for any company. Verify if current policy exists.', alert_days: [60, 30], auto_recur: true },
  { title: 'Cyber Insurance Review', category: 'insurance', subcategory: 'cyber', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Recommended for tech companies handling financial data.', alert_days: [60, 30], auto_recur: true },
  { title: 'COBRA Compliance (Departures)', category: 'benefits', subcategory: 'health', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Must offer COBRA continuation for 18 months post-termination. 9 recent departures.', alert_days: [14, 7], auto_recur: false },
  { title: 'Venture Partners LP - FY2025 Quarterly Financials Audit', category: 'investor', subcategory: 'venture-partners', frequency: 'one-time', next_due_date: '2026-04-15', owner: 'Internal', risk_level: 'high', notes: 'Verify all FY2024 and FY2025 quarterly deliveries were made to Venture Partners.', alert_days: [7, 3, 1], auto_recur: false },
  { title: 'Revolut Launchpad DD Follow-ups', category: 'contract', subcategory: 'partnership', frequency: 'one-time', next_due_date: '2026-04-15', owner: 'Internal', risk_level: 'medium', notes: 'Two open items from risk team: MSB/money transmitter license question, notarized UBO doc.', alert_days: [7, 3], auto_recur: false },
  { title: 'Ashbury Legal Retainer Refresh', category: 'vendor', subcategory: 'legal', frequency: 'event-triggered', next_due_date: '2026-04-15', owner: 'Internal', risk_level: 'medium', amount: 10000, notes: 'Retainer depleted to $0 as of March invoice. $10K refresh required.', alert_days: [7, 3, 1], auto_recur: false },
  
  // Additional SaaS/Vendor renewals
  { title: 'GitHub Enterprise Renewal', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2027-02-14', owner: 'CTO', risk_level: 'high', amount: 21000, notes: 'Annual subscription for team plan. Review seat count before renewal.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'Vercel Pro Plan Renewal', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-05-01', owner: 'CTO', risk_level: 'low', amount: 240, notes: 'Auto-renews monthly. Review bandwidth usage.', alert_days: [7], auto_recur: true },
  { title: 'Notion Team Plan', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2026-08-12', owner: 'Internal', risk_level: 'low', amount: 960, notes: '12 seats. Auto-renews.', alert_days: [30, 14], auto_recur: true },
  { title: 'Linear Subscription', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2026-11-08', owner: 'CTO', risk_level: 'low', amount: 1200, notes: 'Project management for engineering team. 15 seats.', alert_days: [30, 14], auto_recur: true },
  { title: 'Zoom Enterprise', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2026-09-22', owner: 'Internal', risk_level: 'medium', amount: 1800, notes: 'Webinar license included. Auto-renews.', alert_days: [30, 14], auto_recur: true },
  { title: 'DocuSign Business Pro', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2026-10-30', owner: 'Internal', risk_level: 'medium', amount: 1200, notes: 'Used for NDAs, offer letters, vendor contracts.', alert_days: [30, 14], auto_recur: true },
  { title: 'HubSpot CRM', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-05-15', owner: 'Sales', risk_level: 'low', amount: 450, notes: 'Starter plan. Review usage vs cost.', alert_days: [7], auto_recur: true },
  { title: 'Intercom Customer Support', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-20', owner: 'Support', risk_level: 'medium', amount: 399, notes: 'Essential for customer support. 4 seats.', alert_days: [7], auto_recur: true },
  { title: 'Amplitude Analytics', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2026-07-18', owner: 'Product', risk_level: 'medium', amount: 12000, notes: 'Product analytics platform. Growth plan.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'Sentry Error Monitoring', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-25', owner: 'CTO', risk_level: 'low', amount: 99, notes: 'Error tracking for production. Team plan.', alert_days: [7], auto_recur: true },
  { title: 'Cloudflare Business Plan', category: 'vendor', subcategory: 'cloud', frequency: 'annual', next_due_date: '2026-12-10', owner: 'CTO', risk_level: 'medium', amount: 2400, notes: 'CDN and DDoS protection. Critical infrastructure.', alert_days: [30, 14], auto_recur: true },
  
  // More state registrations
  { title: 'California Foreign Entity Registration', category: 'state', subcategory: 'annual-filing', frequency: 'annual', next_due_date: '2027-02-28', owner: 'Ashbury Legal', risk_level: 'high', jurisdiction: 'California', amount: 800, notes: 'Required for doing business in California. Statement of Information.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'New York Foreign Entity Registration', category: 'state', subcategory: 'annual-filing', frequency: 'annual', next_due_date: '2026-11-15', owner: 'Ashbury Legal', risk_level: 'high', jurisdiction: 'New York', amount: 300, notes: 'Biennial filing. Department of State.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'Massachusetts Foreign Corporation Report', category: 'state', subcategory: 'annual-filing', frequency: 'annual', next_due_date: '2027-03-31', owner: 'Ashbury Legal', risk_level: 'medium', jurisdiction: 'Massachusetts', amount: 125, notes: 'Annual report to Secretary of the Commonwealth.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'California Franchise Tax', category: 'tax', subcategory: 'state-tax', frequency: 'annual', next_due_date: '2027-03-15', owner: 'Anderson & Co', risk_level: 'high', jurisdiction: 'California', amount: 800, notes: 'Minimum $800 franchise tax. File with FTB.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'New York State Income Tax', category: 'tax', subcategory: 'state-tax', frequency: 'annual', next_due_date: '2027-03-15', owner: 'Anderson & Co', risk_level: 'medium', jurisdiction: 'New York', notes: 'Filed with federal return. CT-3 or CT-4 form.', alert_days: [60, 30, 14], auto_recur: true },
  
  // Payroll state-specific
  { title: 'California State Withholding - Quarterly', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'California', notes: 'DE 9 form. Auto-filed by payroll service.', alert_days: [14, 7], auto_recur: true },
  { title: 'New York State Withholding - Quarterly', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'New York', notes: 'NYS-45 form. Auto-filed by payroll service.', alert_days: [14, 7], auto_recur: true },
  { title: 'Illinois State Withholding - Quarterly', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Illinois', notes: 'IL-941 form. Auto-filed by payroll service.', alert_days: [14, 7], auto_recur: true },
  { title: 'Texas SUI Quarterly Report', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Texas', notes: 'State Unemployment Insurance. TWC Form C-3.', alert_days: [14, 7], auto_recur: true },
  { title: 'California SUI Quarterly Report', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'California', notes: 'State Unemployment Insurance. EDD Form DE 9C.', alert_days: [14, 7], auto_recur: true },
  
  // Employee benefits expansions
  { title: '401(k) Annual Contribution Deadline', category: 'benefits', subcategory: 'retirement', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'high', notes: 'Employer match contributions must be made by year-end.', alert_days: [60, 30, 14], auto_recur: true },
  { title: '401(k) Safe Harbor Notice', category: 'benefits', subcategory: 'retirement', frequency: 'annual', next_due_date: '2026-11-01', owner: 'Internal', risk_level: 'medium', notes: 'Must provide notice 30-90 days before plan year. Required for safe harbor plans.', alert_days: [60, 30], auto_recur: true },
  { title: 'FSA Annual Election Period', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2026-11-15', owner: 'Dimond Bros', risk_level: 'medium', notes: 'Flexible Spending Account open enrollment period. Communicate to employees.', alert_days: [30, 14], auto_recur: true },
  { title: 'HSA Contribution Limits Review', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2027-01-15', owner: 'Dimond Bros', risk_level: 'low', notes: 'Review IRS contribution limit changes for new year. Update payroll.', alert_days: [30, 14], auto_recur: true },
  { title: 'PTO Accrual Audit', category: 'benefits', subcategory: 'leave', frequency: 'quarterly', next_due_date: '2026-07-01', owner: 'Internal', risk_level: 'low', notes: 'Verify PTO balances in payroll system match policy. Address discrepancies.', alert_days: [14], auto_recur: true },
  { title: 'Annual Benefits Summary (SBC)', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2026-10-01', owner: 'Dimond Bros', risk_level: 'medium', notes: 'Summary of Benefits and Coverage. Required ACA disclosure. Provide to all participants.', alert_days: [30, 14], auto_recur: true },
  
  // Legal & IP
  { title: 'Trademark Renewal - Pi Squared Logo', category: 'contract', subcategory: 'intellectual-property', frequency: 'annual', next_due_date: '2026-09-15', owner: 'Ashbury Legal', risk_level: 'high', jurisdiction: 'Federal', amount: 525, notes: 'USPTO trademark registration. Renew between 5th-6th year, then every 10 years.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'Patent Maintenance Fee - US12345678', category: 'contract', subcategory: 'intellectual-property', frequency: 'event-triggered', next_due_date: '2027-01-20', owner: 'Ashbury Legal', risk_level: 'high', jurisdiction: 'Federal', amount: 1600, notes: '3.5-year maintenance fee due. Failure to pay abandons patent.', alert_days: [90, 60, 30, 14], auto_recur: false },
  { title: 'NDA Renewal - BlockChain Inc', category: 'contract', subcategory: 'client', frequency: 'annual', next_due_date: '2027-01-29', owner: 'Internal', risk_level: 'medium', notes: '2-year mutual NDA. Review and renew if relationship continues.', alert_days: [60, 30], auto_recur: true },
  { title: 'NDA Tracking Audit', category: 'contract', subcategory: 'client', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'Internal', risk_level: 'low', notes: 'Review all active NDAs. Flag expiring agreements. Ensure confidentiality still required.', alert_days: [30], auto_recur: true },
  { title: 'Open Source License Audit', category: 'contract', subcategory: 'intellectual-property', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'CTO', risk_level: 'medium', notes: 'Review dependencies for GPL/AGPL licenses. Verify compliance with attributions.', alert_days: [30, 14], auto_recur: true },
  
  // Board governance
  { title: 'Board Meeting - Q2 2026', category: 'governance', subcategory: 'corporate', frequency: 'quarterly', next_due_date: '2026-05-15', owner: 'CEO', risk_level: 'high', notes: 'Quarterly board meeting. Prepare board deck, financials, resolutions.', alert_days: [30, 14, 7], auto_recur: true },
  { title: 'Board Meeting - Q3 2026', category: 'governance', subcategory: 'corporate', frequency: 'quarterly', next_due_date: '2026-08-15', owner: 'CEO', risk_level: 'high', notes: 'Quarterly board meeting. Prepare board deck, financials, resolutions.', alert_days: [30, 14, 7], auto_recur: true },
  { title: 'Board Meeting - Q4 2026', category: 'governance', subcategory: 'corporate', frequency: 'quarterly', next_due_date: '2026-11-15', owner: 'CEO', risk_level: 'high', notes: 'Quarterly board meeting. Prepare board deck, financials, resolutions.', alert_days: [30, 14, 7], auto_recur: true },
  { title: 'Board Meeting Minutes Review', category: 'governance', subcategory: 'corporate', frequency: 'quarterly', next_due_date: '2026-06-01', owner: 'General Counsel', risk_level: 'medium', notes: 'Draft and circulate minutes within 7 days. Obtain approval. File in minute book.', alert_days: [7, 3], auto_recur: true },
  { title: 'Board Consent Resolutions Filing', category: 'governance', subcategory: 'corporate', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'General Counsel', risk_level: 'medium', notes: 'File written consents in corporate records. E.g., option grants, stock issuances, major contracts.', alert_days: [14, 7], auto_recur: false },
  { title: 'Annual Board Officer Elections', category: 'governance', subcategory: 'corporate', frequency: 'annual', next_due_date: '2027-01-31', owner: 'General Counsel', risk_level: 'medium', notes: 'Elect/reappoint officers (CEO, CFO, Secretary). Record in minutes.', alert_days: [60, 30], auto_recur: true },
  
  // Banking & finance
  { title: 'Bank Credit Facility Annual Review', category: 'contract', subcategory: 'banking', frequency: 'annual', next_due_date: '2027-03-01', owner: 'CFO', risk_level: 'high', amount: 500000, notes: '$500K line of credit with Silicon Valley Bank. Annual renewal/review.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'Wire Transfer Authorization Audit', category: 'contract', subcategory: 'banking', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'CFO', risk_level: 'medium', notes: 'Review authorized signers for wire transfers. Update with departures/hires.', alert_days: [30], auto_recur: true },
  { title: 'Bank Account Reconciliation', category: 'contract', subcategory: 'banking', frequency: 'monthly', next_due_date: '2026-04-30', owner: 'Anderson & Co', risk_level: 'medium', notes: 'Monthly bank reconciliation. Close books within 10 business days.', alert_days: [7, 3], auto_recur: true },
  { title: 'Corporate Card Policy Review', category: 'contract', subcategory: 'banking', frequency: 'annual', next_due_date: '2026-12-31', owner: 'CFO', risk_level: 'low', notes: 'Review corporate card spend limits and authorized users. Update policy.', alert_days: [30], auto_recur: true },
  
  // Compliance & security
  { title: 'SOC 2 Type II Audit Preparation', category: 'contract', subcategory: 'compliance', frequency: 'annual', next_due_date: '2026-08-01', owner: 'CTO', risk_level: 'critical', amount: 35000, notes: 'Engage auditor by August. 6-month observation period required. Critical for enterprise sales.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'SOC 2 Quarterly Control Testing', category: 'contract', subcategory: 'compliance', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'CTO', risk_level: 'high', notes: 'Internal control testing: access reviews, vulnerability scans, incident response.', alert_days: [30, 14], auto_recur: true },
  { title: 'Privacy Policy Annual Review', category: 'contract', subcategory: 'compliance', frequency: 'annual', next_due_date: '2027-01-15', owner: 'General Counsel', risk_level: 'medium', notes: 'Review privacy policy for GDPR/CCPA compliance. Update for product changes.', alert_days: [60, 30], auto_recur: true },
  { title: 'Cookie Consent Banner Review', category: 'contract', subcategory: 'compliance', frequency: 'annual', next_due_date: '2027-01-15', owner: 'Product', risk_level: 'low', notes: 'Ensure cookie consent banner covers all tracking. Update for new cookies.', alert_days: [30], auto_recur: true },
  { title: 'Penetration Testing', category: 'contract', subcategory: 'security', frequency: 'annual', next_due_date: '2026-10-01', owner: 'CTO', risk_level: 'high', amount: 15000, notes: 'Annual pen test by third party. Required for SOC 2 and enterprise contracts.', alert_days: [60, 30], auto_recur: true },
  { title: 'Vulnerability Scanning', category: 'contract', subcategory: 'security', frequency: 'monthly', next_due_date: '2026-05-01', owner: 'CTO', risk_level: 'medium', notes: 'Monthly automated vulnerability scans. Address critical findings within 30 days.', alert_days: [7], auto_recur: true },
  { title: 'Security Awareness Training', category: 'contract', subcategory: 'security', frequency: 'annual', next_due_date: '2026-09-01', owner: 'CTO', risk_level: 'medium', notes: 'Annual security training for all employees. Phishing simulations quarterly.', alert_days: [30, 14], auto_recur: true },
  { title: 'Incident Response Plan Review', category: 'contract', subcategory: 'security', frequency: 'annual', next_due_date: '2026-12-01', owner: 'CTO', risk_level: 'medium', notes: 'Update incident response plan. Test with tabletop exercise.', alert_days: [30], auto_recur: true },
  { title: 'Backup Verification Test', category: 'contract', subcategory: 'security', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'CTO', risk_level: 'high', notes: 'Test backup restoration. Verify RTO/RPO targets. Document results.', alert_days: [14, 7], auto_recur: true },
  { title: 'SSL Certificate Renewal - acmecorp.com', category: 'vendor', subcategory: 'domains', frequency: 'annual', next_due_date: '2026-11-20', owner: 'CTO', risk_level: 'high', notes: 'Renew SSL certificate before expiration. Auto-renew via Cloudflare if enabled.', alert_days: [60, 30, 14, 7], auto_recur: true },
  
  // Additional insurance
  { title: 'E&O Insurance Renewal', category: 'insurance', subcategory: 'professional', frequency: 'annual', next_due_date: '2027-02-28', owner: 'CFO', risk_level: 'high', amount: 8000, notes: 'Errors & Omissions (Professional Liability). Required for client contracts.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'Commercial Property Insurance', category: 'insurance', subcategory: 'property', frequency: 'annual', next_due_date: '2026-12-15', owner: 'CFO', risk_level: 'medium', amount: 2400, notes: 'Office equipment, furniture, servers. Business personal property coverage.', alert_days: [60, 30], auto_recur: true },
  { title: 'Business Interruption Insurance Review', category: 'insurance', subcategory: 'general', frequency: 'annual', next_due_date: '2026-12-31', owner: 'CFO', risk_level: 'low', notes: 'Consider adding to general liability policy. Covers lost revenue from covered events.', alert_days: [30], auto_recur: true },
]

// Clear existing data
await client.execute('DELETE FROM completions')
await client.execute('DELETE FROM obligations')

const now = new Date().toISOString()

let inserted = 0
for (const r of records) {
  const status = computeStatus(r.next_due_date)
  
  await client.execute({
    sql: `
      INSERT INTO obligations (
        id, title, description, category, subcategory, frequency,
        next_due_date, last_completed_date, owner, owner_email, assignee, assignee_email,
        status, risk_level, alert_days, last_alert_sent, source_document, notes,
        entity, jurisdiction, amount, auto_recur, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `,
    args: [
      ulid(),
      r.title,
      null,
      r.category,
      r.subcategory ?? null,
      r.frequency,
      r.next_due_date,
      null,
      r.owner,
      null, // owner_email (null for seed data - can be updated later)
      null, // assignee
      null, // assignee_email
      status,
      r.risk_level,
      JSON.stringify(r.alert_days ?? []),
      null, // last_alert_sent
      null, // source_document
      (r as any).notes ?? null,
      'Pi Squared Inc.',
      (r as any).jurisdiction ?? null,
      (r as any).amount ?? null,
      r.auto_recur ? 1 : 0,
      now,
      now,
    ]
  })
  inserted++
}

  console.log(`Seeded ${inserted} obligations.`)
  await client.close()
}

seed().catch(console.error)
