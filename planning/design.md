# Compliance Tracker - Design Document

## Goal
A standalone web dashboard for tracking recurring company compliance obligations, deadlines, and completions. Targeted at venture-backed startups (Delaware C-Corp) who juggle state filings, tax deadlines, investor reporting, equity compliance, and contract renewals.

## Aesthetic Direction
**Editorial / dense information dashboard** - think Bloomberg Terminal meets Linear. Not the typical AI-generated dashboard with cards-in-cards and purple gradients.

- **Color scheme:** Deep navy/slate background with warm amber/gold accents for urgency. Crisp white text. Think financial terminal.
- **Typography:** JetBrains Mono for data/numbers, Plus Jakarta Sans for headings/body. Not Inter.
- **Layout:** Dense, information-rich. Left sidebar nav. Main content area uses tables and timeline views, not card grids.
- **Motion:** Subtle - smooth page transitions, status badge pulses for overdue items. No bouncing.
- **Differentiation:** Feels like a tool that a compliance officer at a bank would use, not a consumer SaaS toy.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + Shadcn/ui (customized theme)
- **Database:** Turso (libSQL - SQLite compatible, hosted, free tier)
- **ORM:** Drizzle ORM (lightweight, type-safe, SQLite-native)
- **Auth:** NextAuth.js with Google OAuth
- **Hosting:** Vercel
- **Repo:** Public, malturki/compliance-tracker

## Data Model

### obligations
- id (text, ULID)
- title (text, required)
- description (text)
- category (text: tax, investor, equity, state, federal, contract, insurance, benefits, governance, vendor)
- subcategory (text, optional - e.g. "payroll", "polychain", "visa")
- frequency (text: annual, quarterly, monthly, weekly, one-time, event-triggered)
- next_due_date (text, ISO date)
- last_completed_date (text, ISO date, nullable)
- owner (text - who's responsible: "Internal", "Masotti & Masotti", "Ashbury Legal", etc.)
- assignee (text, nullable - specific person)
- status (text: current, upcoming, overdue, completed, unknown, not-applicable)
- risk_level (text: critical, high, medium, low)
- alert_days (text, JSON array: e.g. "[30, 14, 7, 1]")
- source_document (text, nullable - reference/link)
- notes (text, nullable)
- entity (text: "Pi Squared Inc." default)
- jurisdiction (text, nullable - "Delaware", "Illinois", "Federal", etc.)
- amount (real, nullable - cost/fee if applicable)
- auto_recur (integer, boolean - auto-generate next occurrence on completion)
- created_at (text, ISO datetime)
- updated_at (text, ISO datetime)

### completions
- id (text, ULID)
- obligation_id (text, FK)
- completed_date (text, ISO date)
- completed_by (text)
- evidence_url (text, nullable)
- notes (text, nullable)
- created_at (text, ISO datetime)

### alerts (future - v2)
- id, obligation_id, alert_date, sent, channel, acknowledged_by

## Dashboard Views

### 1. Overview (Home)
- **Top bar:** Summary stats - total obligations, overdue count, due this week, due this month
- **Urgency timeline:** Horizontal timeline showing upcoming deadlines (next 90 days)
- **Overdue items:** Red-highlighted list at top (can't miss these)
- **Upcoming this week/month:** Sorted by due date
- **Category breakdown:** Small ring chart or bar showing distribution

### 2. Calendar View
- Monthly calendar with dots/pills showing obligations per day
- Click a day to see all obligations due
- Color-coded by risk level
- Month/week toggle

### 3. All Obligations (Table)
- Dense sortable/filterable table
- Columns: title, category, frequency, next due, owner, status, risk
- Filter chips: by category, status, risk level, owner
- Search
- Inline status update (mark complete without opening)
- Bulk actions

### 4. Obligation Detail (Side Panel or Page)
- Full details
- Completion history
- Mark as complete with evidence
- Edit obligation
- Notes/comments

### 5. Categories View
- Group obligations by category
- Show completion rate per category
- Identify categories with most overdue items

## Seed Data
All 98 obligations from the Phase 1 discovery scan, plus additional standard startup obligations:
- QSBS qualification tracking
- Blue sky state securities compliance
- Cyber insurance (recommendation)
- Patent/trademark renewals (if applicable)
- Annual Delaware franchise tax calculation (par value vs authorized shares method)
- ERISA compliance (if retirement plan assets grow)
- Workers' compensation insurance
- Business license renewals

## API Routes
- GET /api/obligations - list all (with filters)
- POST /api/obligations - create new
- PUT /api/obligations/:id - update
- DELETE /api/obligations/:id - delete
- POST /api/obligations/:id/complete - mark complete (creates completion record, auto-recurs)
- GET /api/obligations/:id/completions - get completion history
- GET /api/stats - summary statistics

## File Structure
```
compliance-tracker/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx (overview/home)
│   │   ├── calendar/page.tsx
│   │   ├── obligations/page.tsx (table view)
│   │   ├── categories/page.tsx
│   │   └── api/
│   │       ├── obligations/route.ts
│   │       ├── obligations/[id]/route.ts
│   │       ├── obligations/[id]/complete/route.ts
│   │       └── stats/route.ts
│   ├── components/
│   │   ├── layout/ (sidebar, header)
│   │   ├── dashboard/ (stats cards, timeline, charts)
│   │   ├── obligations/ (table, detail panel, forms)
│   │   ├── calendar/ (calendar grid, day detail)
│   │   └── ui/ (shadcn components)
│   ├── db/
│   │   ├── schema.ts (drizzle schema)
│   │   ├── index.ts (connection)
│   │   ├── seed.ts (seed data from discovery scan)
│   │   └── migrations/
│   ├── lib/
│   │   ├── utils.ts
│   │   └── types.ts
│   └── styles/
│       └── globals.css
├── drizzle.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```
