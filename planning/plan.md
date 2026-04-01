# Compliance Tracker - Implementation Plan

## Sections

### Section 1: Project Scaffolding + Database Schema
**Files:** package.json, tsconfig.json, tailwind.config.ts, drizzle.config.ts, src/db/schema.ts, src/db/index.ts, .env.example, next.config.ts, src/app/layout.tsx, src/styles/globals.css, src/lib/utils.ts, src/lib/types.ts
**Depends on:** None
**Task:** 
- Initialize Next.js 14 project with App Router, TypeScript, Tailwind
- Install dependencies: drizzle-orm, @libsql/client, shadcn/ui, lucide-react, date-fns, ulid
- Configure Turso connection (libSQL client)
- Define Drizzle schema for `obligations` and `completions` tables
- Set up Tailwind with custom theme (deep navy/slate palette, Plus Jakarta Sans + JetBrains Mono fonts)
- Create base layout with sidebar navigation skeleton
- Configure shadcn/ui with custom theme colors
**Verification:** `npm run build` succeeds, schema compiles, tailwind generates

### Section 2: API Routes (CRUD)
**Files:** src/app/api/obligations/route.ts, src/app/api/obligations/[id]/route.ts, src/app/api/obligations/[id]/complete/route.ts, src/app/api/stats/route.ts
**Depends on:** Section 1
**Task:**
- GET /api/obligations - list all with query param filters (category, status, risk_level, owner, search)
- POST /api/obligations - create new obligation
- GET /api/obligations/[id] - get single obligation with completions
- PUT /api/obligations/[id] - update obligation
- DELETE /api/obligations/[id] - delete obligation
- POST /api/obligations/[id]/complete - mark complete, create completion record, auto-generate next due date if auto_recur is true
- GET /api/stats - return summary stats (total, overdue, due this week, due this month, by category, by risk)
**Verification:** All API routes respond correctly with test curl commands

### Section 3: Seed Data
**Files:** src/db/seed.ts, scripts/seed.sh
**Depends on:** Section 1
**Task:**
- Create comprehensive seed data file with all 98+ obligations from the discovery scan
- Include additional standard startup obligations (QSBS, workers comp, cyber insurance, etc.)
- Each obligation should have realistic next_due_dates, owners, categories, risk levels
- Create a seed script that can be run to populate the database
- Include some sample completions for obligations that are already current
**Verification:** `npm run seed` populates database, `GET /api/obligations` returns all records, `GET /api/stats` shows correct counts

### Section 4: Layout + Sidebar Navigation
**Files:** src/components/layout/sidebar.tsx, src/components/layout/header.tsx, src/components/layout/app-shell.tsx, src/app/layout.tsx (update)
**Depends on:** Section 1
**Task:**
- Build sidebar navigation with links: Overview, Calendar, Obligations, Categories
- Include company name/logo area at top
- Collapsible sidebar for mobile
- Active state highlighting
- Header bar with search input and notification bell (placeholder)
- Use the editorial/dense aesthetic: dark sidebar, clean content area
- Plus Jakarta Sans for headings, JetBrains Mono for data
- Color palette: slate-950/900 background, amber-500 accents, proper urgency colors
**Verification:** Navigation renders, links work, responsive at 320px and 1440px

### Section 5: Overview Dashboard Page
**Files:** src/app/page.tsx, src/components/dashboard/stats-bar.tsx, src/components/dashboard/urgency-timeline.tsx, src/components/dashboard/overdue-list.tsx, src/components/dashboard/upcoming-list.tsx, src/components/dashboard/category-breakdown.tsx
**Depends on:** Sections 2, 4
**Task:**
- Top stats bar: total obligations, overdue (red), due this week (amber), due this month (yellow), on track (green)
- Overdue items section (red-highlighted, top priority visibility)
- Urgency timeline: horizontal visual showing next 90 days of deadlines
- Upcoming obligations: sorted by due date, grouped by week
- Category breakdown: ring chart or compact bar chart showing distribution
- All data fetched from API routes
- Responsive layout
**Verification:** Page renders with seed data, stats are accurate, overdue items display correctly

### Section 6: Obligations Table Page
**Files:** src/app/obligations/page.tsx, src/components/obligations/obligations-table.tsx, src/components/obligations/filter-bar.tsx, src/components/obligations/obligation-detail-panel.tsx, src/components/obligations/obligation-form.tsx
**Depends on:** Sections 2, 4
**Task:**
- Dense sortable table with columns: title, category, frequency, next due, owner, status, risk level
- Filter bar with chips: category, status, risk level, owner dropdowns
- Search input (filters as you type)
- Click row to open detail side panel (slide-in from right)
- Detail panel shows full info, completion history, mark-complete button, edit button
- Add new obligation button → opens form dialog
- Edit obligation → same form dialog
- Mark complete with evidence URL and notes fields
- Color-coded risk/urgency badges
- Sort by any column header
**Verification:** Table renders all obligations, filters work, CRUD operations work through UI

### Section 7: Calendar View Page
**Files:** src/app/calendar/page.tsx, src/components/calendar/calendar-grid.tsx, src/components/calendar/day-cell.tsx, src/components/calendar/calendar-header.tsx
**Depends on:** Sections 2, 4
**Task:**
- Monthly calendar grid
- Each day shows colored dots/pills for obligations due that day
- Color-coded by risk level (critical=red, high=orange, medium=amber, low=green)
- Click a day to see list of obligations due
- Month navigation (prev/next)
- Today highlighted
- Responsive (stacks on mobile)
**Verification:** Calendar renders current month, obligations appear on correct dates, navigation works

### Section 8: Categories View Page
**Files:** src/app/categories/page.tsx, src/components/categories/category-card.tsx, src/components/categories/category-stats.tsx
**Depends on:** Sections 2, 4
**Task:**
- Grid of category cards (tax, investor, equity, state, federal, contract, insurance, benefits, governance, vendor)
- Each card shows: count of obligations, overdue count, next upcoming deadline, completion rate
- Click to filter obligations table by that category (navigate to /obligations?category=X)
- Visual indicator for categories with overdue items
- Category icons (using Lucide icons)
**Verification:** All categories render with correct counts, clicking navigates to filtered view

### Section 9: Polish, Deploy, Seed Production
**Files:** Various (fixes, README.md, vercel.json if needed)
**Depends on:** All previous sections
**Task:**
- Final responsive pass (320px, 768px, 1024px, 1440px)
- Loading states (skeleton loaders)
- Empty states for views with no data
- Error boundaries
- README.md with setup instructions
- Create GitHub repo (malturki/compliance-tracker, public)
- Push code
- Deploy to Vercel
- Set up Turso database (production)
- Run seed script against production
- Verify production deployment
**Verification:** Production URL loads, all pages work, seed data visible, responsive at all breakpoints
