/**
 * Recommended-additions catalog — static, curated list of standard-startup
 * obligations that aren't yet in the DB. Browsable at /catalog; adding an
 * item creates a real obligation with these defaults pre-filled (the user
 * can override the date before confirming).
 *
 * Curation bias: Delaware C-corp, VC-backed, multi-state employer, crypto-
 * adjacent product. Items that duplicate what Carta or agent-submitted flows
 * already cover are intentionally excluded.
 *
 * See docs/superpowers/plans/2026-04-23-agentic-obligations.md (Phase 2).
 */

import type { Category, Frequency, RiskLevel } from '@/lib/types'

export type CatalogTag =
  | 'state-securities'
  | 'governance'
  | 'tax'
  | 'employment'
  | 'privacy'
  | 'ip'
  | 'crypto'

export type Maturity = 'now' | 'future'

export interface RecommendedItem {
  /** Stable slug, e.g. "ca-soi-biennial". */
  id: string
  title: string
  category: Category
  frequency: Frequency
  defaultJurisdiction?: string
  defaultCounterparty?: string
  suggestedOwner: string
  defaultRiskLevel: RiskLevel
  defaultAmount?: number
  /** One-paragraph explainer shown on the card. */
  whyItMatters: string
  /** Short line about penalties / risk. */
  consequenceOfMissing: string
  /** Optional qualifier like "If 50+ FTE" or "If you operate a token." */
  applicabilityHint?: string
  tags: CatalogTag[]
  /** "future" items are dimmed reminders; no Add button until the triggering event occurs. */
  maturity: Maturity
  /** Default description saved onto the obligation. */
  defaultDescription?: string
}

export const recommendedAdditions: RecommendedItem[] = [
  // ─── State securities ───────────────────────────────────────────────
  {
    id: 'blue-sky-delaware',
    title: 'Blue Sky notice — Delaware',
    category: 'federal',
    frequency: 'event-triggered',
    defaultJurisdiction: 'Delaware',
    defaultCounterparty: 'Delaware Division of Corporations',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'high',
    whyItMatters:
      'After each Form D, you typically owe a notice filing + fee in every state where you had subscribers. Delaware requires filing within 15 days of the first sale.',
    consequenceOfMissing: 'Fines + loss of Rule 506(b) exemption in the state.',
    applicabilityHint: 'After any round closing where a Delaware resident subscribed.',
    tags: ['state-securities'],
    maturity: 'now',
  },
  {
    id: 'blue-sky-california',
    title: 'Blue Sky notice — California',
    category: 'federal',
    frequency: 'event-triggered',
    defaultJurisdiction: 'California',
    defaultCounterparty: 'California Department of Financial Protection and Innovation',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'high',
    whyItMatters:
      'California Section 25102(f) notice required when selling to a CA resident under Rule 506. Due within 15 days of first sale.',
    consequenceOfMissing: 'Penalties + potential rescission rights for investors.',
    applicabilityHint: 'After any round closing where a California resident subscribed.',
    tags: ['state-securities'],
    maturity: 'now',
  },
  {
    id: 'blue-sky-new-york',
    title: 'Blue Sky notice — New York',
    category: 'federal',
    frequency: 'event-triggered',
    defaultJurisdiction: 'New York',
    defaultCounterparty: 'NY Dept. of Law — Investor Protection Bureau',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'high',
    whyItMatters:
      'NY requires a separate Form 99 filing + state fee for Rule 506 offerings involving NY residents.',
    consequenceOfMissing: 'Administrative penalties + registration complications.',
    applicabilityHint: 'After any round closing where a NY resident subscribed.',
    tags: ['state-securities'],
    maturity: 'now',
  },
  {
    id: 'rule-506d-bad-actor-recert',
    title: 'Rule 506(d) bad-actor re-certification',
    category: 'federal',
    frequency: 'annual',
    defaultCounterparty: 'SEC',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Rule 506(d) disqualifies issuers who have "bad actor" covered persons. Re-screen directors, officers, 20%+ holders, and placement agents at least annually or before any new 506 issuance.',
    consequenceOfMissing: 'Loss of the Rule 506(b)/(c) exemption — cannot raise under it.',
    tags: ['state-securities', 'governance'],
    maturity: 'now',
  },

  // ─── Governance ─────────────────────────────────────────────────────
  {
    id: 'ca-soi-biennial',
    title: 'California Statement of Information',
    category: 'state',
    frequency: 'annual',
    defaultJurisdiction: 'California',
    defaultCounterparty: 'California Secretary of State',
    suggestedOwner: 'Corporate Secretary',
    defaultRiskLevel: 'medium',
    defaultAmount: 25,
    whyItMatters:
      'Biennial filing (often tracked annually). $25 fee. Separate from the franchise tax. Routinely missed by out-of-state corps qualified to do business in CA.',
    consequenceOfMissing: '$250 penalty + suspension of powers by the FTB.',
    applicabilityHint: 'Required if qualified to do business in California.',
    tags: ['governance'],
    maturity: 'now',
  },
  {
    id: 'foreign-qualification-renewal',
    title: 'Foreign qualification renewal (state X)',
    category: 'state',
    frequency: 'annual',
    suggestedOwner: 'Corporate Secretary',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Delaware-incorporated companies must register + renew annually in every state where they do business (employees, office, property).',
    consequenceOfMissing:
      'Late-fee penalties, inability to sue in that state, personal liability for officers in extreme cases.',
    applicabilityHint: 'One row per foreign-qualified state (IL, TX, CA, etc.).',
    tags: ['governance'],
    maturity: 'now',
    defaultDescription:
      'Edit the jurisdiction field to the specific state after adding. Separate row per state with nexus.',
  },
  {
    id: 'registered-agent-renewal',
    title: 'Registered agent renewal',
    category: 'state',
    frequency: 'annual',
    suggestedOwner: 'Corporate Secretary',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Registered agents bill annually; lapses mean missed service-of-process notices. Often auto-renews but worth tracking.',
    consequenceOfMissing:
      'Losing registered-agent representation = default judgments in lawsuits you never learn about.',
    applicabilityHint: 'Track one row per jurisdiction where you have a registered agent.',
    tags: ['governance'],
    maturity: 'now',
  },
  {
    id: 'quarterly-board-meeting',
    title: 'Quarterly board meeting + consent',
    category: 'governance',
    frequency: 'quarterly',
    suggestedOwner: 'CEO',
    defaultRiskLevel: 'high',
    whyItMatters:
      'Most venture docs require quarterly board meetings. Consents in lieu must be circulated and signed for any material action between meetings.',
    consequenceOfMissing: 'Venture-doc covenant breaches + weak corporate hygiene on diligence.',
    tags: ['governance'],
    maturity: 'now',
  },
  {
    id: 'stock-issuance-board-consent',
    title: 'Board consent for stock issuance',
    category: 'governance',
    frequency: 'event-triggered',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'critical',
    whyItMatters:
      'Every stock issuance (grants, new round shares) needs documented board consent BEFORE the issuance. Often forgotten in the rush.',
    consequenceOfMissing: 'Invalid issuance — challenges on exit diligence.',
    applicabilityHint: 'One row per planned issuance event.',
    tags: ['governance'],
    maturity: 'now',
  },

  // ─── Tax ────────────────────────────────────────────────────────────
  {
    id: 'section-174-rd-review',
    title: 'Section 174 R&D capitalization review',
    category: 'tax',
    frequency: 'annual',
    defaultJurisdiction: 'Federal',
    defaultCounterparty: 'IRS',
    suggestedOwner: 'CFO',
    defaultRiskLevel: 'high',
    whyItMatters:
      'Post-2022, domestic R&D (including most software dev salaries) must be capitalized and amortized over 5 years. Wrong treatment = large unexpected tax liability.',
    consequenceOfMissing: 'Tax underpayment + interest + potential amended returns.',
    tags: ['tax'],
    maturity: 'now',
  },
  {
    id: 'unclaimed-property-reports',
    title: 'State unclaimed property / escheat report',
    category: 'tax',
    frequency: 'annual',
    suggestedOwner: 'CFO',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Uncashed vendor checks, unreturned deposits, and unclaimed payroll must be escheated to the state annually. Typically due Nov 1 each year per state.',
    consequenceOfMissing: 'Interest + penalties scale with unreported amounts; audits common.',
    applicabilityHint: 'File per state where payees are located. Delaware is audit-heavy.',
    tags: ['tax', 'governance'],
    maturity: 'now',
  },
  {
    id: 'form-1099-misc',
    title: 'Form 1099-MISC filing',
    category: 'tax',
    frequency: 'annual',
    defaultJurisdiction: 'Federal',
    defaultCounterparty: 'IRS',
    suggestedOwner: 'CFO',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Non-NEC contractor payments (rents, royalties, prizes, medical payments) use 1099-MISC. Due Feb 28 (paper) / Mar 31 (electronic).',
    consequenceOfMissing: 'Per-form penalties scale up quickly with delay.',
    tags: ['tax'],
    maturity: 'now',
  },
  {
    id: 'form-5472-foreign-ownership',
    title: 'Form 5472 — foreign ownership disclosure',
    category: 'tax',
    frequency: 'annual',
    defaultJurisdiction: 'Federal',
    defaultCounterparty: 'IRS',
    suggestedOwner: 'CFO',
    defaultRiskLevel: 'critical',
    whyItMatters:
      'Required if any 25%+ shareholder is foreign OR if you have reportable transactions with foreign related parties.',
    consequenceOfMissing: '$25,000 minimum penalty per year per form.',
    applicabilityHint: 'Only if ≥1 foreign 25%+ shareholder exists on the cap table.',
    tags: ['tax'],
    maturity: 'now',
  },
  {
    id: 'state-sales-tax-nexus-review',
    title: 'State sales tax nexus review',
    category: 'tax',
    frequency: 'annual',
    suggestedOwner: 'CFO',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Post-Wayfair (2018), many states have economic-nexus thresholds ($100k in sales or 200 transactions). Review sales by state annually to catch crossings.',
    consequenceOfMissing: 'Back-tax assessments once nexus is established, plus interest.',
    tags: ['tax'],
    maturity: 'now',
  },

  // ─── Employment ─────────────────────────────────────────────────────
  {
    id: 'osha-300a-posting',
    title: 'OSHA Form 300A annual summary posting',
    category: 'benefits',
    frequency: 'annual',
    defaultJurisdiction: 'Federal',
    defaultCounterparty: 'OSHA',
    suggestedOwner: 'HR',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'If 10+ employees at any point in the year, you must post Form 300A (summary of injuries) from Feb 1 to Apr 30. Some industries are partially exempt.',
    consequenceOfMissing: 'OSHA citation penalties.',
    applicabilityHint: 'If 10+ employees during the prior calendar year.',
    tags: ['employment'],
    maturity: 'now',
  },
  {
    id: 'aca-1094-1095-filings',
    title: 'ACA 1094-C / 1095-C filings',
    category: 'benefits',
    frequency: 'annual',
    defaultJurisdiction: 'Federal',
    defaultCounterparty: 'IRS',
    suggestedOwner: 'HR',
    defaultRiskLevel: 'high',
    whyItMatters:
      'Applicable Large Employers (50+ FTE average) must file 1094-C transmittal + 1095-C per employee. Due Feb 28 (paper) / Mar 31 (electronic).',
    consequenceOfMissing: 'Per-form penalties and potential employer mandate assessment.',
    applicabilityHint: 'Only if 50+ FTE on average across the prior calendar year.',
    tags: ['employment'],
    maturity: 'now',
  },
  {
    id: 'spd-sbc-distribution',
    title: 'SPD / SBC distribution to plan participants',
    category: 'benefits',
    frequency: 'annual',
    suggestedOwner: 'HR',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Summary Plan Descriptions (SPD) for ERISA plans and Summary of Benefits and Coverage (SBC) for health plans must be distributed annually and at enrollment.',
    consequenceOfMissing: 'DOL penalties + participant lawsuits.',
    tags: ['employment'],
    maturity: 'now',
  },
  {
    id: 'state-paid-leave-review',
    title: 'State paid sick/family leave compliance review',
    category: 'benefits',
    frequency: 'annual',
    suggestedOwner: 'HR',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'States with paid leave laws (CA, CO, CT, MA, NJ, NY, OR, WA, etc.) require annual postings + accrual policies. Laws change frequently.',
    consequenceOfMissing: 'Wage-and-hour lawsuits + state labor penalties.',
    tags: ['employment'],
    maturity: 'now',
  },

  // ─── Privacy ────────────────────────────────────────────────────────
  {
    id: 'privacy-policy-annual-review',
    title: 'Privacy policy annual review',
    category: 'governance',
    frequency: 'annual',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Privacy laws change fast (state + federal + international). Annual review ensures the posted policy still matches actual data practices.',
    consequenceOfMissing:
      'Misrepresentation = FTC enforcement risk; CCPA requires disclosures to be accurate.',
    tags: ['privacy', 'governance'],
    maturity: 'now',
  },
  {
    id: 'vendor-dpa-inventory',
    title: 'Vendor DPA inventory + renewal',
    category: 'vendor',
    frequency: 'annual',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Every vendor touching personal data needs a Data Processing Agreement (CCPA, GDPR, HIPAA). Track existence + renewal.',
    consequenceOfMissing: 'Joint-controller liability in a breach; regulatory findings.',
    tags: ['privacy'],
    maturity: 'now',
  },
  {
    id: 'ccpa-cpra-response-readiness',
    title: 'CCPA/CPRA consumer request response readiness',
    category: 'governance',
    frequency: 'annual',
    defaultJurisdiction: 'California',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'high',
    whyItMatters:
      'California requires a documented process for responding to consumer requests (right to know, delete, opt out) within 45 days.',
    consequenceOfMissing: '$2,500 per violation ($7,500 intentional) + private right of action for breaches.',
    applicabilityHint: 'If you collect PI from CA residents at any scale.',
    tags: ['privacy'],
    maturity: 'now',
  },
  {
    id: 'data-retention-schedule-review',
    title: 'Data retention schedule review',
    category: 'governance',
    frequency: 'annual',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Minimization is a core privacy principle and a risk-reducer in breaches. Review what you keep and for how long at least annually.',
    consequenceOfMissing: 'Avoidable breach blast radius + regulatory scrutiny.',
    tags: ['privacy', 'governance'],
    maturity: 'now',
  },

  // ─── IP ─────────────────────────────────────────────────────────────
  {
    id: 'trademark-application',
    title: 'Trademark application — [mark]',
    category: 'contract',
    frequency: 'one-time',
    defaultCounterparty: 'USPTO',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'Register core brand and product marks before launch. Common-law rights exist but federal registration is cheap insurance for ®, nationwide priority, and presumptive validity.',
    consequenceOfMissing: 'Other parties can register first in your class → rebrand.',
    applicabilityHint: 'One row per mark you plan to file.',
    tags: ['ip'],
    maturity: 'future',
  },
  {
    id: 'trademark-section-8-15',
    title: 'Trademark Section 8 / 15 declaration (Y5-Y6)',
    category: 'contract',
    frequency: 'one-time',
    defaultCounterparty: 'USPTO',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'high',
    whyItMatters:
      'Between years 5 and 6 after registration, file §8 (continued use) and optionally §15 (incontestability).',
    consequenceOfMissing: '§8 miss = mark cancelled. No way to recover the registration date.',
    applicabilityHint: 'Auto-add when a trademark is registered. Currently future-only.',
    tags: ['ip'],
    maturity: 'future',
  },
  {
    id: 'trademark-renewal-y10',
    title: 'Trademark renewal (Y10, every 10 years)',
    category: 'contract',
    frequency: 'one-time',
    defaultCounterparty: 'USPTO',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'critical',
    whyItMatters:
      'Every 10 years after registration, file §8 + §9 renewal. Missing = registration cancelled.',
    consequenceOfMissing: 'Lose the mark. Grace period is short.',
    applicabilityHint: 'Auto-add when a trademark is registered. Currently future-only.',
    tags: ['ip'],
    maturity: 'future',
  },
  {
    id: 'domain-renewals',
    title: 'Core domain renewals',
    category: 'vendor',
    frequency: 'annual',
    suggestedOwner: 'IT',
    defaultRiskLevel: 'critical',
    whyItMatters:
      'Losing a core company domain is catastrophic (email + product + identity). Most registrars auto-renew but a failed card = dropped domain.',
    consequenceOfMissing: 'Domain picked up by squatters; email + product outages.',
    applicabilityHint: 'One row per core domain (company.com, app.company.com).',
    tags: ['ip'],
    maturity: 'now',
  },
  {
    id: 'open-source-license-audit',
    title: 'Open-source license audit',
    category: 'governance',
    frequency: 'annual',
    suggestedOwner: 'Engineering',
    defaultRiskLevel: 'medium',
    whyItMatters:
      'GPL/AGPL/copyleft dependencies can create redistribution obligations. Annual review prevents surprises in diligence.',
    consequenceOfMissing: 'Diligence blockers; potential forced open-sourcing of proprietary code.',
    tags: ['ip', 'governance'],
    maturity: 'now',
  },

  // ─── Crypto (Pi Squared-specific) ───────────────────────────────────
  {
    id: 'smart-contract-audit-cycle',
    title: 'Smart contract audit cycle',
    category: 'vendor',
    frequency: 'annual',
    suggestedOwner: 'CTO',
    defaultRiskLevel: 'critical',
    whyItMatters:
      'Deployed contracts should be re-audited annually and before every material upgrade. Bug-to-exploit windows are short.',
    consequenceOfMissing: 'Funds loss; reputational damage; possible investor covenant breach.',
    applicabilityHint: 'If you deploy or upgrade smart contracts.',
    tags: ['crypto'],
    maturity: 'now',
  },
  {
    id: 'bug-bounty-disclosure-sla',
    title: 'Bug bounty / responsible disclosure SLA',
    category: 'governance',
    frequency: 'quarterly',
    suggestedOwner: 'CTO',
    defaultRiskLevel: 'high',
    whyItMatters:
      'Keep bug bounty / responsible disclosure program active with documented SLAs (acknowledge within 72h, triage within 1 week).',
    consequenceOfMissing: 'Public disclosure of unpatched vulnerabilities.',
    applicabilityHint: 'If you operate any public-facing on-chain system.',
    tags: ['crypto'],
    maturity: 'now',
  },
  {
    id: 'howey-legal-opinion-refresh',
    title: 'Howey / legal opinion refresh',
    category: 'federal',
    frequency: 'annual',
    defaultCounterparty: 'External counsel',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'high',
    whyItMatters:
      'If you operate or plan to operate a token, have counsel refresh the Howey analysis annually and whenever product direction materially changes.',
    consequenceOfMissing: 'SEC exposure; investor diligence surprises.',
    applicabilityHint: 'If tokens are planned or live.',
    tags: ['crypto'],
    maturity: 'now',
  },
  {
    id: 'token-transfer-restrictions',
    title: 'Token transfer restriction tracking',
    category: 'governance',
    frequency: 'quarterly',
    suggestedOwner: 'Legal',
    defaultRiskLevel: 'high',
    whyItMatters:
      'SAFT lockups, Rule 144 holding periods, and OFAC-screened wallets all create transfer restrictions that need active tracking.',
    consequenceOfMissing: 'Sanctions exposure; illegal transfers; clawback disputes.',
    applicabilityHint: 'If any tokens are held by restricted parties.',
    tags: ['crypto'],
    maturity: 'now',
  },
  {
    id: 'validator-operational-obligations',
    title: 'Validator operational obligations',
    category: 'vendor',
    frequency: 'monthly',
    suggestedOwner: 'Operations',
    defaultRiskLevel: 'high',
    whyItMatters:
      'Running validator infrastructure imposes uptime SLAs, key-rotation cadence, and slashing-avoidance controls. Review ops monthly.',
    consequenceOfMissing: 'Slashing, reputational damage, delegate loss.',
    applicabilityHint: 'Only if you run validator or sequencer infra.',
    tags: ['crypto'],
    maturity: 'now',
  },
]

export function getCatalogItem(id: string): RecommendedItem | undefined {
  return recommendedAdditions.find(i => i.id === id)
}

export function listCatalogItems(): RecommendedItem[] {
  return recommendedAdditions
}

export const CATALOG_TAG_LABELS: Record<CatalogTag, string> = {
  'state-securities': 'State securities',
  governance: 'Governance',
  tax: 'Tax',
  employment: 'Employment',
  privacy: 'Privacy',
  ip: 'IP',
  crypto: 'Crypto',
}
