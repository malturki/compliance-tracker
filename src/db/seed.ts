import Database from 'better-sqlite3'
import { ulid } from 'ulid'
import { join } from 'path'

const dbPath = process.env.DATABASE_URL || join(process.cwd(), 'compliance.db')
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

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
    assignee TEXT,
    status TEXT NOT NULL DEFAULT 'current',
    risk_level TEXT NOT NULL DEFAULT 'medium',
    alert_days TEXT DEFAULT '[]',
    source_document TEXT,
    notes TEXT,
    entity TEXT DEFAULT 'Pi Squared Inc.',
    jurisdiction TEXT,
    amount REAL,
    auto_recur INTEGER DEFAULT 0,
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

for (const sql of CREATE_TABLES_SQL) {
  sqlite.prepare(sql).run()
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
  { title: 'FinCEN BOI Report Update', category: 'federal', subcategory: 'fincen', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Croke Fairchild', risk_level: 'critical', jurisdiction: 'Federal', notes: 'Must file within 30 days of changes to beneficial owners. Civil/criminal penalties for non-compliance.', alert_days: [30, 7], auto_recur: false },
  { title: 'Annual Stockholder Consent', category: 'governance', subcategory: 'corporate', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Ashbury Legal', risk_level: 'medium', jurisdiction: 'Delaware', notes: 'Delaware requires annual stockholder meeting or written consent in lieu.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'Corporate Income Tax (Form 1120)', category: 'tax', subcategory: 'corporate', frequency: 'annual', next_due_date: '2027-03-15', owner: 'Masotti & Masotti', risk_level: 'high', jurisdiction: 'Federal', notes: 'Or file extension by March 15. 2024 R&D credit study completed Oct 2025.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'R&D Tax Credit Study', category: 'tax', subcategory: 'corporate', frequency: 'annual', next_due_date: '2027-03-15', owner: 'GOAT.tax', risk_level: 'medium', jurisdiction: 'Federal', notes: 'Claimed on Form 1120. Reviewing cloud hosting, code repos, dev tools for qualification.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'Federal Estimated Tax - Q1', category: 'tax', subcategory: 'estimated', frequency: 'quarterly', next_due_date: '2026-04-15', owner: 'Masotti & Masotti', risk_level: 'high', jurisdiction: 'Federal', notes: 'Confirm payment amount with accountant.', alert_days: [14, 7, 3, 1], auto_recur: true },
  { title: 'Federal Estimated Tax - Q2', category: 'tax', subcategory: 'estimated', frequency: 'quarterly', next_due_date: '2026-06-15', owner: 'Masotti & Masotti', risk_level: 'high', jurisdiction: 'Federal', alert_days: [14, 7, 3, 1], auto_recur: true },
  { title: 'Federal Estimated Tax - Q3', category: 'tax', subcategory: 'estimated', frequency: 'quarterly', next_due_date: '2026-09-15', owner: 'Masotti & Masotti', risk_level: 'high', jurisdiction: 'Federal', alert_days: [14, 7, 3, 1], auto_recur: true },
  { title: 'Federal Estimated Tax - Q4', category: 'tax', subcategory: 'estimated', frequency: 'quarterly', next_due_date: '2027-01-15', owner: 'Masotti & Masotti', risk_level: 'high', jurisdiction: 'Federal', alert_days: [14, 7, 3, 1], auto_recur: true },
  { title: 'Form 941 - Q1 Payroll Tax', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', notes: 'Auto-filed by QuickBooks. Verify submission.', alert_days: [14, 7, 1], auto_recur: true },
  { title: 'Form 941 - Q2 Payroll Tax', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-07-31', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', alert_days: [14, 7, 1], auto_recur: true },
  { title: 'Form 941 - Q3 Payroll Tax', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-10-31', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', alert_days: [14, 7, 1], auto_recur: true },
  { title: 'Form 941 - Q4 Payroll Tax', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2027-01-31', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', alert_days: [14, 7, 1], auto_recur: true },
  { title: 'Form 940 - FUTA Annual', category: 'tax', subcategory: 'payroll', frequency: 'annual', next_due_date: '2027-01-31', owner: 'QuickBooks Payroll', risk_level: 'medium', jurisdiction: 'Federal', notes: 'Auto-filed by QuickBooks.', alert_days: [30, 14, 7], auto_recur: true },
  { title: '1099-NEC Filing (Contractors)', category: 'tax', subcategory: 'information-returns', frequency: 'annual', next_due_date: '2027-01-31', owner: 'Masotti & Masotti', risk_level: 'high', notes: '14 contractors currently.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'W-2 Filing (Employees)', category: 'tax', subcategory: 'information-returns', frequency: 'annual', next_due_date: '2027-01-31', owner: 'Masotti & Masotti', risk_level: 'high', notes: '8 employees currently.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'Illinois State Corporate Income Tax', category: 'tax', subcategory: 'state-tax', frequency: 'annual', next_due_date: '2027-03-15', owner: 'Masotti & Masotti', risk_level: 'medium', jurisdiction: 'Illinois', notes: 'Filed with federal return.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'State Unemployment Insurance (Multi-state)', category: 'tax', subcategory: 'payroll', frequency: 'quarterly', next_due_date: '2026-04-30', owner: 'QuickBooks Payroll', risk_level: 'medium', notes: 'IL, CA, TX, TN. California SDI wage code review pending.', alert_days: [14, 7], auto_recur: true },
  { title: 'Tennessee Tax Assessment Resolution', category: 'tax', subcategory: 'state-tax', frequency: 'one-time', next_due_date: '2026-05-01', owner: 'Masotti & Masotti', risk_level: 'high', jurisdiction: 'Tennessee', amount: 31000, notes: '$31K disputed assessment from Oct 2025. Under review with accountant.', alert_days: [14, 7, 1], auto_recur: false },
  { title: 'California SDI Wage Code Review', category: 'tax', subcategory: 'state-tax', frequency: 'one-time', next_due_date: '2026-04-15', owner: 'Internal', risk_level: 'medium', jurisdiction: 'California', notes: 'Starred inbox item. Review required.', alert_days: [7, 3, 1], auto_recur: false },
  { title: 'SIMPLE IRA Employer Match', category: 'benefits', subcategory: 'retirement', frequency: 'annual', next_due_date: '2026-10-15', owner: 'Internal', risk_level: 'medium', notes: '3% employer match mandatory. Custodian: Ascensus.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'SIMPLE IRA Form 5500', category: 'benefits', subcategory: 'retirement', frequency: 'annual', next_due_date: '2026-07-31', owner: 'Ascensus / Masotti', risk_level: 'medium', notes: 'Required if plan assets exceed $250K.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'RxDC Prescription Drug Reporting', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2026-06-01', owner: 'Dimond Bros / Internal', risk_level: 'high', notes: 'CMS requirement under Consolidated Appropriations Act 2021.', alert_days: [60, 30, 14, 7], auto_recur: true },
  { title: 'ACA Reporting (1095-C / 1094-C)', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2027-03-31', owner: 'Dimond Bros / Internal', risk_level: 'medium', notes: 'Required for applicable large employers (>50 FTEs). Pi2 has 8 employees - may not apply.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'Health Insurance Annual Renewal', category: 'benefits', subcategory: 'health', frequency: 'annual', next_due_date: '2027-01-01', owner: 'Dimond Bros', risk_level: 'medium', notes: 'BCBS/Mutual of Omaha through Dimond Bros. Open enrollment Nov-Dec.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'Polychain - FY2025 Annual Financials', category: 'investor', subcategory: 'polychain', frequency: 'annual', next_due_date: '2026-04-30', owner: 'Internal / Masotti', risk_level: 'critical', notes: 'Unaudited annual financials due within 120 days of fiscal year end. Polychain ($9M investor).', alert_days: [30, 14, 7, 3, 1], auto_recur: true },
  { title: 'Polychain - Q1 2026 Quarterly Financials', category: 'investor', subcategory: 'polychain', frequency: 'quarterly', next_due_date: '2026-05-15', owner: 'Internal / Masotti', risk_level: 'critical', notes: 'Due within 45 days of quarter end (Mar 31).', alert_days: [30, 14, 7, 3, 1], auto_recur: true },
  { title: 'Polychain - Q2 2026 Quarterly Financials', category: 'investor', subcategory: 'polychain', frequency: 'quarterly', next_due_date: '2026-08-14', owner: 'Internal / Masotti', risk_level: 'critical', notes: 'Due within 45 days of quarter end (Jun 30).', alert_days: [30, 14, 7, 3, 1], auto_recur: true },
  { title: 'Polychain - Q3 2026 Quarterly Financials', category: 'investor', subcategory: 'polychain', frequency: 'quarterly', next_due_date: '2026-11-14', owner: 'Internal / Masotti', risk_level: 'critical', notes: 'Due within 45 days of quarter end (Sep 30).', alert_days: [30, 14, 7, 3, 1], auto_recur: true },
  { title: 'Polychain - FY2027 Annual Operating Plan', category: 'investor', subcategory: 'polychain', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'high', notes: 'Must deliver before start of FY2027.', alert_days: [90, 60, 30, 14], auto_recur: true },
  { title: 'Polychain - Consent Rights (Material Actions)', category: 'investor', subcategory: 'polychain', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal / Ashbury Legal', risk_level: 'critical', notes: '9 consent categories including stock issuance >1M shares, debt >$500K, acquisitions.', alert_days: [7], auto_recur: false },
  { title: 'Polychain - Pro Rata Rights Notice (New Securities)', category: 'investor', subcategory: 'polychain', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal / Ashbury Legal', risk_level: 'high', notes: '15-day advance notice before closing any new securities issuance.', alert_days: [30, 15], auto_recur: false },
  { title: 'Polychain - MFN Rights Monitoring', category: 'investor', subcategory: 'polychain', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal / Ashbury Legal', risk_level: 'high', notes: 'Must provide notice and match any more favorable terms issued to other investors.', alert_days: [7], auto_recur: false },
  { title: 'Polychain - Board Observer Materials', category: 'investor', subcategory: 'polychain', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Invite observer to all board meetings, provide materials same timing as directors.', alert_days: [7], auto_recur: false },
  { title: '409A Valuation Renewal', category: 'equity', subcategory: 'compliance', frequency: 'annual', next_due_date: '2027-02-28', owner: 'Carta / Internal', risk_level: 'critical', notes: 'Last valuation Feb 2026 at $0.48/share FMV. Must renew within 12 months.', alert_days: [90, 60, 30, 14], auto_recur: true },
  { title: '83(b) Election Tracking', category: 'equity', subcategory: 'options', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'critical', notes: '30-day deadline from option exercise. No tracking system currently exists. CRITICAL GAP.', alert_days: [30, 14, 7, 1], auto_recur: false },
  { title: 'Stock Option Pool Reconciliation', category: 'equity', subcategory: 'options', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'Internal', risk_level: 'medium', notes: '380,000 shares authorized. Verify total grants don\'t exceed pool before each new grant.', alert_days: [30, 14], auto_recur: true },
  { title: 'Carta/Delaware Stock Ledger Sync', category: 'equity', subcategory: 'cap-table', frequency: 'quarterly', next_due_date: '2026-06-30', owner: 'Internal', risk_level: 'medium', notes: 'Reconcile Carta cap table with official Delaware stock ledger quarterly.', alert_days: [30, 14], auto_recur: true },
  { title: 'Post-Termination Option Exercise Monitoring', category: 'equity', subcategory: 'options', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'high', notes: '90-day exercise window for voluntary/involuntary termination. Dwight Guth repurchase in progress.', alert_days: [60, 30, 14, 7], auto_recur: false },
  { title: 'ISO Annual Limit Compliance ($100K)', category: 'equity', subcategory: 'options', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Ensure ISO grants don\'t exceed $100K/year first-exercisable limit per grantee.', alert_days: [30], auto_recur: true },
  { title: 'Token Incentive Plan Administration', category: 'equity', subcategory: 'tokens', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Separate from Stock Option Plan. Review upon TGE.', alert_days: [30], auto_recur: false },
  { title: 'SAFT/Token Warrant Delivery (upon TGE)', category: 'equity', subcategory: 'tokens', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal / Ashbury Legal', risk_level: 'high', notes: '2 SAFTs + token warrants require delivery upon Token Generation Event. 40 investors total.', alert_days: [90, 60, 30], auto_recur: false },
  { title: 'MegaETH Retainer Renewal', category: 'contract', subcategory: 'client', frequency: 'one-time', next_due_date: '2026-06-29', owner: 'Internal', risk_level: 'medium', amount: 150000, notes: '5-month retainer from Jan 29, 2026. $150K. 30-day termination notice.', alert_days: [60, 30, 14, 7], auto_recur: false },
  { title: 'H-1B Registration Window', category: 'contract', subcategory: 'visa', frequency: 'annual', next_due_date: '2027-03-01', owner: 'DeHeng Law', risk_level: 'high', notes: 'FY2028 registration. March window.', alert_days: [90, 60, 30], auto_recur: true },
  { title: 'I-9 Work Authorization Reverification', category: 'contract', subcategory: 'employment', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'high', notes: 'Must reverify within 3 business days of work authorization expiration. CRITICAL GAP.', alert_days: [90, 30, 14, 3], auto_recur: false },
  { title: 'Slack Subscription Renewal', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2027-03-18', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews.', alert_days: [30, 14], auto_recur: true },
  { title: 'Datadog Subscription', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-18', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews monthly. Review usage.', alert_days: [7], auto_recur: true },
  { title: 'Google Workspace Renewal', category: 'vendor', subcategory: 'saas', frequency: 'annual', next_due_date: '2027-03-31', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews.', alert_days: [30, 14], auto_recur: true },
  { title: 'Figma Subscription', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-16', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews monthly.', alert_days: [7], auto_recur: true },
  { title: 'Docker Subscription', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-05', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews monthly.', alert_days: [7], auto_recur: true },
  { title: 'QuickBooks Subscription', category: 'vendor', subcategory: 'saas', frequency: 'monthly', next_due_date: '2026-04-02', owner: 'Internal', risk_level: 'low', notes: 'Auto-renews.', alert_days: [7], auto_recur: true },
  { title: 'AWS Monthly Bill', category: 'vendor', subcategory: 'cloud', frequency: 'monthly', next_due_date: '2026-04-02', owner: 'Internal', risk_level: 'low', notes: 'Pay-as-you-go. Review for cost optimization.', alert_days: [7], auto_recur: true },
  { title: 'Porkbun Domain Renewal', category: 'vendor', subcategory: 'domains', frequency: 'annual', next_due_date: '2027-03-12', owner: 'Internal', risk_level: 'medium', notes: 'Domain registrations. Annual renewal.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'HubSpot Cancellation Follow-up', category: 'vendor', subcategory: 'saas', frequency: 'one-time', next_due_date: '2026-04-06', owner: 'Internal', risk_level: 'low', notes: 'Cancellation requested Mar 6, 2026. Confirm effective date.', alert_days: [7, 3, 1], auto_recur: false },
  { title: 'QSBS Qualification Tracking', category: 'equity', subcategory: 'tax-benefit', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal / Masotti', risk_level: 'high', notes: 'Qualified Small Business Stock (Section 1202). Investors get up to $10M capital gains exclusion after 5 years.', alert_days: [90, 30], auto_recur: true },
  { title: 'Workers\' Compensation Insurance', category: 'insurance', subcategory: 'workers-comp', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Required in most states with employees.', alert_days: [60, 30, 14], auto_recur: true },
  { title: 'General Liability Insurance Review', category: 'insurance', subcategory: 'general', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Recommended for any company. Verify if current policy exists.', alert_days: [60, 30], auto_recur: true },
  { title: 'Cyber Insurance Review', category: 'insurance', subcategory: 'cyber', frequency: 'annual', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Recommended for tech companies handling financial data.', alert_days: [60, 30], auto_recur: true },
  { title: 'COBRA Compliance (Departures)', category: 'benefits', subcategory: 'health', frequency: 'event-triggered', next_due_date: '2026-12-31', owner: 'Internal', risk_level: 'medium', notes: 'Must offer COBRA continuation for 18 months post-termination. 9 recent departures.', alert_days: [14, 7], auto_recur: false },
  { title: 'Polychain - FY2025 Quarterly Financials Audit', category: 'investor', subcategory: 'polychain', frequency: 'one-time', next_due_date: '2026-04-15', owner: 'Internal', risk_level: 'high', notes: 'Verify all FY2024 and FY2025 quarterly deliveries were made to Polychain.', alert_days: [7, 3, 1], auto_recur: false },
  { title: 'Revolut Launchpad DD Follow-ups', category: 'contract', subcategory: 'partnership', frequency: 'one-time', next_due_date: '2026-04-15', owner: 'Internal', risk_level: 'medium', notes: 'Two open items from risk team: MSB/money transmitter license question, notarized UBO doc.', alert_days: [7, 3], auto_recur: false },
  { title: 'Ashbury Legal Retainer Refresh', category: 'vendor', subcategory: 'legal', frequency: 'event-triggered', next_due_date: '2026-04-15', owner: 'Internal', risk_level: 'medium', amount: 10000, notes: 'Retainer depleted to $0 as of March invoice. $10K refresh required.', alert_days: [7, 3, 1], auto_recur: false },
]

// Clear existing data
sqlite.prepare('DELETE FROM completions').run()
sqlite.prepare('DELETE FROM obligations').run()

const now = new Date().toISOString()

const insert = sqlite.prepare(`
  INSERT INTO obligations (
    id, title, description, category, subcategory, frequency,
    next_due_date, last_completed_date, owner, assignee, status,
    risk_level, alert_days, source_document, notes, entity,
    jurisdiction, amount, auto_recur, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?
  )
`)

let inserted = 0
for (const r of records) {
  const status = computeStatus(r.next_due_date)
  insert.run(
    ulid(),
    r.title,
    null,
    r.category,
    r.subcategory ?? null,
    r.frequency,
    r.next_due_date,
    null,
    r.owner,
    null,
    status,
    r.risk_level,
    JSON.stringify(r.alert_days ?? []),
    null,
    (r as any).notes ?? null,
    'Pi Squared Inc.',
    (r as any).jurisdiction ?? null,
    (r as any).amount ?? null,
    r.auto_recur ? 1 : 0,
    now,
    now,
  )
  inserted++
}

console.log(`Seeded ${inserted} obligations.`)
sqlite.close()
