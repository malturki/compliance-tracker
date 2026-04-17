# FAST Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the compliance-tracker app from dark amber + Plus Jakarta Sans + Pi Squared Inc. identity to the FAST design language: light Platinum canvas, Graphite/Steel/Light Steel Blue palette, General Sans typography, FAST wordmark logo. Align all 12 pages and ~36 components with `/tmp/fast-demo-kit/fast-demo-kit/` guidelines.

**Architecture:** Ten phases, each independently reviewable and deployable. Phase 1 lays foundation (tokens, fonts, logo). Phases 2–4 reskin shared chrome (layout, sidebar, UI primitives). Phases 5–9 reskin pages one at a time in traffic order. Phase 10 handles launch metadata + pre-ship QA. Each phase ends with build + full test run + manual smoke of the affected surfaces, and a commit. **Backwards compatibility is abandoned** — the old dark theme is deleted in phase 1, not kept behind a flag, because the kit explicitly says light is the default and dual-theme doubles the work.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS (config-driven tokens), General Sans via `next/font/local`, shadcn-style UI primitives already present. No new dependencies required.

**Critical constraint:** Zero React component tests exist in this codebase. The 279 API integration tests don't touch UI and should remain green through every phase. Visual verification is manual per phase, using the dev server at `npm run dev` and spot-checking the key flows each phase touches.

---

## Pre-work — read these before starting

| File | Why |
| --- | --- |
| `/tmp/fast-demo-kit/fast-demo-kit/references/official-brand-guidelines.md` | Palette and logo rules |
| `/tmp/fast-demo-kit/fast-demo-kit/references/design-tokens.md` | Concrete hex values, shadow tokens, type scale |
| `/tmp/fast-demo-kit/fast-demo-kit/references/ux-principles.md` | Accent-as-blade, whitespace, state design |
| `/tmp/fast-demo-kit/fast-demo-kit/references/surface-recipes.md` | App-shell/dashboard recipe |
| `/tmp/fast-demo-kit/fast-demo-kit/references/pre-ship-checklist.md` | Final QA in phase 10 |
| `/tmp/fast-demo-kit/fast-demo-kit/assets/fast-theme.css` | Reference token CSS |

Do **not** copy-paste the kit CSS wholesale — it's the source of truth for token *values*, but our theming lives in Tailwind config and `globals.css`.

---

## File inventory

### Files created

- `public/fonts/GeneralSans-Variable.woff2` — variable General Sans for normal text
- `public/fonts/GeneralSans-VariableItalic.woff2` — italic variant
- `public/fast-logo-dark.svg` — FAST wordmark, dark ink, for light backgrounds (primary use)
- `public/fast-logo-light.svg` — FAST wordmark, light ink, for dark sections (rare, used in hero-style overlays if any)
- `src/app/icon.png` — favicon, 32×32, Platinum-bg with dark FAST wordmark
- `src/app/opengraph-image.png` — 1200×630 OG preview
- `src/app/twitter-image.png` — 1200×630 Twitter preview

### Files modified

| Path | Scope |
| --- | --- |
| `tailwind.config.ts` | Replace `navy`/`surface` colors with `fast` palette |
| `src/app/globals.css` | Replace dark tokens with FAST tokens, drop `dark` class default |
| `src/app/layout.tsx` | Swap Plus Jakarta → General Sans, remove `dark` class, update `<Toaster theme>`, update metadata |
| `src/components/layout/sidebar.tsx` | Replace Shield icon + "Pi Squared Inc." with FAST wordmark, reskin all color classes |
| `src/components/layout/app-shell.tsx` | Reskin container colors |
| `src/components/ui/*.tsx` (19 files) | Reskin color classes on button, input, badge, card, dialog, dropdown, popover, select, sheet, table, textarea, tooltip, tabs, separator, calendar, file-upload, scroll-area, label, checkbox |
| `src/components/command-palette.tsx` | Reskin palette overlay + results |
| `src/components/keyboard-shortcuts-help.tsx` | Reskin dialog |
| `src/components/obligations/{bulk-action-bar,bulk-complete-dialog,bulk-delete-dialog,bulk-edit-dialog}.tsx` | Reskin |
| `src/components/dashboard/{ai-summary-widget,category-performance-chart,completion-trend-chart,owner-performance-table,risk-exposure-chart}.tsx` | Reskin |
| `src/components/settings/settings-tabs.tsx` | Reskin |
| `src/components/ObligationHistory.tsx` | Reskin |
| `src/app/page.tsx` | Overview — reskin stats cards + category bar |
| `src/app/dashboard/page.tsx` | Reskin charts container |
| `src/app/obligations/page.tsx` | Reskin list + filters + detail panel (1200-line file; careful) |
| `src/app/calendar/page.tsx` | Reskin month grid + overflow popover |
| `src/app/templates/page.tsx` | Reskin template cards |
| `src/app/categories/page.tsx` | Reskin category rollups + counterparty panel |
| `src/app/activity/page.tsx` | Reskin audit log table |
| `src/app/help/page.tsx` | Reskin help cards |
| `src/app/auth/error/page.tsx` | Reskin error shell |
| `src/app/settings/users/page.tsx` | Reskin user table |
| `src/app/settings/agents/page.tsx` | Reskin agent table + skill URL bar + token modal |
| `CLAUDE.md` | Update "UI direction" section: dark dense dashboard → FAST light operational dashboard |

### Files not modified

- `src/lib/*.ts` — no UI
- `src/app/api/*` — no UI
- `src/test/**` — no UI
- `src/db/*` — no UI

---

## Phase 1: Foundation tokens, fonts, logo

**Files:**
- Create: `public/fonts/GeneralSans-Variable.woff2`
- Create: `public/fonts/GeneralSans-VariableItalic.woff2`
- Create: `public/fast-logo-dark.svg`
- Create: `public/fast-logo-light.svg`
- Modify: `tailwind.config.ts` (entire `theme.extend.colors` block)
- Modify: `src/app/globals.css` (lines 1–48, entire file body)
- Modify: `src/app/layout.tsx` (lines 1–39, entire file)

- [ ] **Step 1: Copy fonts into `public/fonts/`**

```bash
mkdir -p public/fonts
cp /tmp/fast-fonts/fonts/GeneralSans-Variable.woff2 public/fonts/
cp /tmp/fast-fonts/fonts/GeneralSans-VariableItalic.woff2 public/fonts/
```

- [ ] **Step 2: Copy logo SVGs into `public/`**

```bash
cp /tmp/fast-demo-kit/fast-demo-kit/assets/fast-logo-dark.svg public/fast-logo-dark.svg
cp /tmp/fast-demo-kit/fast-demo-kit/assets/fast-logo-light.svg public/fast-logo-light.svg
```

- [ ] **Step 3: Replace `tailwind.config.ts` color palette with FAST tokens**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // FAST official palette
        platinum: '#F6F8FA',
        silicon: '#C8CFD8',
        'light-steel': '#A1B0CF',
        steel: '#5F6672',
        graphite: '#2B2C2F',
        // Semantic (reference the palette above by hex for Tailwind JIT)
        canvas: '#F6F8FA',
        card: '#FFFFFF',
        'text-primary': '#2B2C2F',
        'text-muted': '#5F6672',
      },
      borderRadius: {
        card: '14px',
        inner: '12px',
      },
      boxShadow: {
        card: '0 12px 36px -18px rgba(43, 44, 47, 0.16)',
        'input-inner': 'inset 0 1px 2px rgba(43, 44, 47, 0.05)',
        button: '0 1px 1px rgba(43, 44, 47, 0.10)',
        'button-hover': '0 2px 4px rgba(43, 44, 47, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
```

Note: intentionally dropped `darkMode: 'class'` — FAST is light by default.

- [ ] **Step 4: Replace `src/app/globals.css` with FAST tokens**

```css
@import "tw-animate-css";

@tailwind base;
@tailwind components;
@tailwind utilities;

@font-face {
  font-family: 'General Sans';
  src: url('/fonts/GeneralSans-Variable.woff2') format('woff2');
  font-weight: 200 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'General Sans';
  src: url('/fonts/GeneralSans-VariableItalic.woff2') format('woff2');
  font-weight: 200 700;
  font-style: italic;
  font-display: swap;
}

:root {
  --font-sans: 'General Sans', system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  /* FAST official palette */
  --fast-platinum: #F6F8FA;
  --fast-silicon: #C8CFD8;
  --fast-light-steel: #A1B0CF;
  --fast-steel: #5F6672;
  --fast-graphite: #2B2C2F;

  /* Semantic tokens */
  --background: #F6F8FA;
  --foreground: #2B2C2F;
  --card: #FFFFFF;
  --card-foreground: #2B2C2F;
  --popover: #FFFFFF;
  --popover-foreground: #2B2C2F;
  --primary: #2B2C2F;
  --primary-foreground: #F6F8FA;
  --secondary: rgba(200, 207, 216, 0.18);
  --secondary-foreground: #2B2C2F;
  --muted: rgba(200, 207, 216, 0.18);
  --muted-foreground: #5F6672;
  --accent: #A1B0CF;
  --accent-foreground: #2B2C2F;
  --destructive: #B45555;
  --border: rgba(95, 102, 114, 0.16);
  --input: rgba(95, 102, 114, 0.16);
  --ring: rgba(161, 176, 207, 0.32);
  --radius: 0.875rem;
}

* {
  border-color: rgba(95, 102, 114, 0.16);
}

body {
  background: #F6F8FA;
  color: #2B2C2F;
  font-family: var(--font-sans);
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Section headings use General Sans Medium per kit */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-sans);
  font-weight: 500;
  letter-spacing: -0.015em;
}

/* Custom scrollbar — Silicon-tinted */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(200, 207, 216, 0.6); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(95, 102, 114, 0.4); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Replace `src/app/layout.tsx` — swap fonts, remove dark class, update metadata**

```tsx
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { AppShell } from '@/components/layout/app-shell'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help'
import { Toaster } from 'sonner'

const generalSans = localFont({
  src: [
    { path: '../../public/fonts/GeneralSans-Variable.woff2', weight: '200 700', style: 'normal' },
    { path: '../../public/fonts/GeneralSans-VariableItalic.woff2', weight: '200 700', style: 'italic' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FAST Compliance Tracker',
  description: 'Track compliance obligations, deadlines, and completions.',
  icons: { icon: '/icon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={generalSans.variable}>
      <body className="bg-[#F6F8FA] text-[#2B2C2F] font-sans antialiased">
        <SessionProvider>
          <AppShell>{children}</AppShell>
          <CommandPalette />
          <KeyboardShortcutsHelp />
          <Toaster position="bottom-right" theme="light" />
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Run build to verify font loads and classes compile**

Run: `npm run build 2>&1 | tail -20`
Expected: "✓ Compiled successfully"; no errors about missing woff2 or unknown color tokens.

- [ ] **Step 7: Run full test suite to confirm no regressions in non-UI code**

Run: `npm test -- --run 2>&1 | tail -10`
Expected: `Test Files 24 passed (24) / Tests 279 passed (279)`

- [ ] **Step 8: Manual smoke — start dev server and verify the app loads without crashing**

Run: `npm run dev` in one terminal, then open `http://localhost:3000` in a browser.
Expected: App loads. Pages will look visually broken (dark class names still in components), but there should be no font 404s and no runtime errors. Kill the dev server with Ctrl+C.

- [ ] **Step 9: Commit phase 1**

```bash
git add public/fonts public/fast-logo-dark.svg public/fast-logo-light.svg tailwind.config.ts src/app/globals.css src/app/layout.tsx
git commit -m "feat(brand): phase 1 — FAST tokens, General Sans, logo assets"
```

---

## Phase 2: Shell and sidebar

**Files:**
- Modify: `src/components/layout/app-shell.tsx` (full file)
- Modify: `src/components/layout/sidebar.tsx` (full file)

- [ ] **Step 1: Read current sidebar + app-shell to understand structure**

Run: `cat src/components/layout/app-shell.tsx src/components/layout/sidebar.tsx`
Note which color classes are used. Every `bg-[#050b18]`, `bg-[#0f1629]`, `border-[#1e2d47]`, `text-slate-*`, `text-amber-*` needs to be replaced.

- [ ] **Step 2: Replace sidebar header — swap Shield icon + "Pi Squared Inc." with FAST wordmark**

In `src/components/layout/sidebar.tsx`, find the header block (search for `Pi Squared Inc.`). Replace with:

```tsx
<div className="px-5 py-5 border-b border-black/5">
  <img
    src="/fast-logo-dark.svg"
    alt="FAST"
    className="h-6 w-auto"
  />
  <div className="text-[10px] text-[#5F6672] font-medium uppercase tracking-[0.18em] mt-1.5">
    Compliance
  </div>
</div>
```

Remove the `Shield` import from lucide-react (and the `Sparkles` import if still unused).

- [ ] **Step 3: Reskin sidebar nav — light surface, graphite text, light-steel active state**

Replace the `aside` wrapper class:

```tsx
<aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-black/5 flex flex-col z-50">
```

Replace the Search button class:

```tsx
className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#5F6672] hover:text-[#2B2C2F] hover:bg-[rgba(200,207,216,0.18)] transition-colors"
```

Replace the separator:

```tsx
<div className="h-px bg-black/5 my-1.5 mx-1" />
```

Replace the nav Link classes (active and inactive):

```tsx
className={cn(
  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
  active
    ? 'bg-[rgba(161,176,207,0.18)] text-[#2B2C2F] font-medium'
    : 'text-[#5F6672] hover:text-[#2B2C2F] hover:bg-[rgba(200,207,216,0.18)]',
)}
```

Replace the Settings link with the same scheme.

- [ ] **Step 4: Reskin the user footer at bottom of sidebar**

Replace the user row container:

```tsx
<div className="px-4 py-3 border-t border-black/5">
```

Replace role badge colors (the `roleBadgeColors` object):

```tsx
const roleBadgeColors: Record<string, string> = {
  admin: 'text-[#2B2C2F] bg-[rgba(161,176,207,0.28)] border-[#A1B0CF]',
  editor: 'text-[#2B2C2F] bg-[rgba(200,207,216,0.5)] border-[#C8CFD8]',
  viewer: 'text-[#5F6672] bg-[rgba(200,207,216,0.3)] border-[#C8CFD8]',
}
```

Replace the user name text color to `text-[#2B2C2F]` and the email/truncated label to `text-[#5F6672]`.

Replace the sign-out button:

```tsx
className="text-[#5F6672] hover:text-[#2B2C2F] transition-colors"
```

Replace the ⌘K kbd badge:

```tsx
<kbd className="text-[9px] font-mono text-[#5F6672] border border-black/10 rounded px-1 py-0.5">⌘K</kbd>
```

- [ ] **Step 5: Reskin `src/components/layout/app-shell.tsx`**

Replace any `bg-[#0a0e1a]` or similar dark tokens with `bg-[#F6F8FA]` or `bg-white`. Most of this file is probably a `<main className="ml-64 min-h-screen">` container — set it to `bg-[#F6F8FA]`.

- [ ] **Step 6: Build and smoke**

Run: `npm run build 2>&1 | tail -8`
Expected: "✓ Compiled successfully"

Run: `npm run dev` and open `http://localhost:3000`. Expected: sidebar shows FAST wordmark on a white background, nav links render with muted steel text, active link has subtle blue tint. Main content area is still wrong colors but that's phase 5+.

- [ ] **Step 7: Commit phase 2**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/app-shell.tsx
git commit -m "feat(brand): phase 2 — FAST sidebar with logo and light chrome"
```

---

## Phase 3: shadcn UI primitives — atomic reskin

**Files:** All 19 files in `src/components/ui/*.tsx`.

The shadcn primitives use a mix of hardcoded hex colors and CSS variables from `globals.css`. Some already drive from `--background`, `--foreground`, `--border`, etc., which we updated in phase 1 — those will mostly Just Work. The ones with hardcoded `bg-[#0f1629]` style classes need manual updates.

- [ ] **Step 1: Grep for hardcoded dark hexes inside `src/components/ui/`**

Run: `grep -rn "#0a0e1a\|#050b18\|#0f1629\|#1e2d47\|#162035\|amber-400\|amber-500" src/components/ui/`

This tells you exactly which files and lines need changes. Expect 10–15 hits.

- [ ] **Step 2: Systematic substitution in each file**

For each file returned by the grep, apply these substitutions (the hex is a rough mapping — adjust per component):

| Old | New |
| --- | --- |
| `bg-[#0a0e1a]` | `bg-[#F6F8FA]` |
| `bg-[#0f1629]` | `bg-white` |
| `bg-[#162035]` | `bg-[rgba(200,207,216,0.18)]` |
| `border-[#1e2d47]` | `border-black/5` |
| `text-slate-200` | `text-[#2B2C2F]` |
| `text-slate-300` | `text-[#2B2C2F]` |
| `text-slate-400` | `text-[#5F6672]` |
| `text-slate-500` | `text-[#5F6672]` |
| `text-slate-600` | `text-[#5F6672]/80` |
| `bg-amber-500/10` | `bg-[rgba(161,176,207,0.18)]` |
| `bg-amber-600` | `bg-[#2B2C2F]` (primary actions are graphite, not accent-colored) |
| `hover:bg-amber-500` | `hover:bg-[#1a1b1d]` |
| `text-amber-400` | `text-[#2B2C2F]` (primary CTA text) |
| `border-amber-500/20` | `border-[#A1B0CF]/40` |
| `border-amber-500/50` | `border-[#A1B0CF]` |
| `focus:border-amber-500/50` | `focus:border-[#A1B0CF]` |

Work through these files in this order:
1. `button.tsx` — primary action style. Use graphite bg with platinum text.
2. `input.tsx` — white bg, subtle border, light-steel focus ring.
3. `card.tsx` — white bg, shadow-card, rounded-card.
4. `badge.tsx` — subtle silicon bg variants.
5. `dialog.tsx`, `sheet.tsx`, `popover.tsx`, `dropdown-menu.tsx` — white bg, subtle border.
6. `select.tsx`, `command.tsx` — white bg, light-steel hover.
7. `checkbox.tsx`, `label.tsx` — graphite text.
8. `tabs.tsx`, `separator.tsx`, `scroll-area.tsx` — muted borders.
9. `table.tsx` — white bg, silicon hairlines.
10. `textarea.tsx`, `tooltip.tsx`, `calendar.tsx`, `file-upload.tsx`, `input-group.tsx` — same mapping.

- [ ] **Step 3: Build and check for broken class errors**

Run: `npm run build 2>&1 | tail -15`
Expected: clean build. Tailwind won't error on arbitrary value classes; TypeScript will error if you deleted an import accidentally.

- [ ] **Step 4: Smoke — open any page with a dialog or dropdown**

Run: `npm run dev`, open `http://localhost:3000/settings/agents` (if admin) or `http://localhost:3000/help`. Click to expand a help topic, open the command palette (⌘K). Verify: backgrounds are white, text is dark, no residual dark-blue surfaces.

- [ ] **Step 5: Commit phase 3**

```bash
git add src/components/ui/
git commit -m "feat(brand): phase 3 — FAST reskin of shadcn UI primitives"
```

---

## Phase 4: Shared non-primitive components

**Files:**
- Modify: `src/components/command-palette.tsx`
- Modify: `src/components/keyboard-shortcuts-help.tsx`
- Modify: `src/components/ObligationHistory.tsx`
- Modify: `src/components/settings/settings-tabs.tsx`
- Modify: `src/components/obligations/bulk-action-bar.tsx`
- Modify: `src/components/obligations/bulk-complete-dialog.tsx`
- Modify: `src/components/obligations/bulk-delete-dialog.tsx`
- Modify: `src/components/obligations/bulk-edit-dialog.tsx`
- Modify: `src/components/dashboard/ai-summary-widget.tsx`
- Modify: `src/components/dashboard/category-performance-chart.tsx`
- Modify: `src/components/dashboard/completion-trend-chart.tsx`
- Modify: `src/components/dashboard/owner-performance-table.tsx`
- Modify: `src/components/dashboard/risk-exposure-chart.tsx`

- [ ] **Step 1: Grep each file for dark-theme classes**

Run: `grep -rn "bg-\[#0\|border-\[#1\|text-slate\|text-amber\|bg-amber" src/components/command-palette.tsx src/components/keyboard-shortcuts-help.tsx src/components/ObligationHistory.tsx src/components/settings src/components/obligations src/components/dashboard`

- [ ] **Step 2: Apply the substitution table from phase 3**

Same mapping. For chart components, also replace series colors:
- Replace `#f59e0b` (amber) with `#A1B0CF` (light-steel) for single-series charts.
- For multi-series charts, use: `#2B2C2F` (graphite), `#A1B0CF` (light-steel), `#5F6672` (steel), `#C8CFD8` (silicon) as the palette. Keep red `#B45555` for overdue/error series.
- Chart grid lines: `rgba(95, 102, 114, 0.12)`.

For `src/components/obligations/bulk-action-bar.tsx`, the primary actions (Complete, Edit, Delete) should use graphite bg with platinum text. Delete variant stays red.

- [ ] **Step 3: Build and smoke**

Run: `npm run build 2>&1 | tail -8`
Expected: clean build.

Run: `npm run dev`, open `http://localhost:3000/dashboard`. Verify charts render in steel/graphite tones, not amber. Open the command palette (⌘K) and the shortcuts help (`?`). Verify dialogs are light.

- [ ] **Step 4: Commit phase 4**

```bash
git add src/components/command-palette.tsx src/components/keyboard-shortcuts-help.tsx src/components/ObligationHistory.tsx src/components/settings src/components/obligations src/components/dashboard
git commit -m "feat(brand): phase 4 — FAST reskin of shared dialogs and charts"
```

---

## Phase 5: Overview page (highest traffic)

**Files:**
- Modify: `src/app/page.tsx` (full file — ~300 lines)

- [ ] **Step 1: Grep current page for dark classes**

Run: `grep -n "bg-\[#\|border-\[#\|text-slate\|text-amber\|bg-amber\|getRiskColor" src/app/page.tsx`

- [ ] **Step 2: Apply substitution table**

Same mapping as phase 3. Additionally for this page:
- The four stats tiles (Total / Overdue / Due Soon / This Month) — give each tile a white bg, rounded-card, shadow-card. Use graphite text for the big numbers. Only the Overdue tile accent color can be red `#B45555` when count > 0. Do not use amber.
- The "By Category" bar chart — use `#A1B0CF` for the bars, `#B45555` only when a category has overdue items.
- Section headers — use `text-2xl font-medium tracking-[-0.02em]` for the page title, `text-[10px] uppercase tracking-[0.18em] text-[#5F6672]` for section labels.

- [ ] **Step 3: Verify `getRiskColor` and `getStatusColor` mapping in `src/lib/utils.ts` still produces legible colors**

Run: `cat src/lib/utils.ts | sed -n '45,62p'`

The existing mapping uses `text-red-400 bg-red-950/50 border-red-800/50` etc. Those are designed for dark backgrounds and will be invisible on white. Update them to:

```ts
export function getRiskColor(risk: RiskLevel): string {
  switch (risk) {
    case 'critical': return 'text-[#B45555] bg-[#B45555]/10 border-[#B45555]/30'
    case 'high': return 'text-[#A1620E] bg-[#A1620E]/10 border-[#A1620E]/30'
    case 'medium': return 'text-[#5F6672] bg-[rgba(200,207,216,0.4)] border-[#C8CFD8]'
    case 'low': return 'text-[#3A6B4F] bg-[#3A6B4F]/10 border-[#3A6B4F]/30'
  }
}

export function getStatusColor(status: Status): string {
  switch (status) {
    case 'overdue': return 'text-[#B45555] bg-[#B45555]/10 border-[#B45555]/30'
    case 'upcoming': return 'text-[#A1620E] bg-[#A1620E]/10 border-[#A1620E]/30'
    case 'current': return 'text-[#2B2C2F] bg-white border-[#C8CFD8]'
    case 'completed': return 'text-[#3A6B4F] bg-[#3A6B4F]/10 border-[#3A6B4F]/30'
    default: return 'text-[#5F6672] bg-[rgba(200,207,216,0.4)] border-[#C8CFD8]'
  }
}
```

These colors (`#B45555` error, `#A1620E` warning-amber-but-muted, `#3A6B4F` calm-green) are kit-approved — the kit allows `#B45555` for error and says "prefer calm confirmation over loud green" so we use a muted green.

- [ ] **Step 4: Build and smoke**

Run: `npm run build 2>&1 | tail -8`
Expected: clean build.

Run: `npm run dev`, sign in, open `http://localhost:3000/`. Verify: four stats tiles on a platinum background, white cards with subtle shadow. Overdue number is red if any. Category bars are light-steel, with any overdue count in red.

- [ ] **Step 5: Run full test suite — `getRiskColor`/`getStatusColor` are tested indirectly through status badges on obligations**

Run: `npm test -- --run 2>&1 | tail -8`
Expected: 279/279 passing. If anything fails, the `computeStatus` tests might assert status strings (not colors) so they should be fine.

- [ ] **Step 6: Commit phase 5**

```bash
git add src/app/page.tsx src/lib/utils.ts
git commit -m "feat(brand): phase 5 — FAST reskin of Overview page and status colors"
```

---

## Phase 6: Obligations page (highest density, 1200 lines)

**Files:**
- Modify: `src/app/obligations/page.tsx` (full file — ~1200 lines, the biggest surface)

This is the most complex phase. The file contains: filter bar, obligations list table, bulk action bar, detail panel sheet, create dialog, counterparty inline editor. Each has its own color classes.

- [ ] **Step 1: Grep and count**

Run: `grep -c "bg-\[#\|border-\[#\|text-slate\|text-amber" src/app/obligations/page.tsx`
Expected: roughly 80–120 hits.

- [ ] **Step 2: Do the substitutions in logical groups**

Work through the file top-to-bottom. Apply the phase 3 substitution table. Extra notes:

- The `StatusBadge` and `RiskBadge` components in the file use `getStatusColor`/`getRiskColor` from `src/lib/utils.ts`, which you updated in phase 5. They should already work.
- The filter bar at the top of the list (search, category select, status select, risk select, counterparty select) — use the phase 3 ui/input + ui/select classes, which are already light.
- The list table — white bg, silicon hairlines between rows (`border-b border-[#C8CFD8]/60`). Keep mono font for the due date and owner columns (the kit allows mono for data).
- Row hover: `hover:bg-[rgba(200,207,216,0.18)]`. Selected row (detail panel open): `bg-[rgba(161,176,207,0.12)] border-l-2 border-l-[#A1B0CF]`.
- Overdue row: replace `hover:bg-red-950/10` with `hover:bg-[#B45555]/5`.
- Counterparty inline editor (already its own component `CounterpartyEditor` in this file) — the input and buttons should pick up the phase 3 primitive styles. Verify they render correctly.
- Create Obligation dialog — uses the ui/dialog primitive, should work. Verify form labels are graphite, inputs have white bg.
- Detail panel (sheet) — uses the ui/sheet primitive. The panel's hero due-date box should use calm, tinted backgrounds:

```tsx
<div className={`border p-4 rounded-lg ${
  item.computedStatus === 'overdue' ? 'bg-[#B45555]/5 border-[#B45555]/30'
  : item.computedStatus === 'upcoming' ? 'bg-[#A1620E]/5 border-[#A1620E]/30'
  : item.computedStatus === 'completed' ? 'bg-[#3A6B4F]/5 border-[#3A6B4F]/30'
  : 'bg-white border-black/5'
}`}>
```

The section label under the hero box:

```tsx
<div className="text-[10px] uppercase tracking-[0.18em] text-[#5F6672] mb-1">Next Due</div>
```

The large number:

```tsx
<div className={`text-2xl font-medium tracking-[-0.02em] ${
  item.computedStatus === 'overdue' ? 'text-[#B45555]'
  : item.computedStatus === 'upcoming' ? 'text-[#A1620E]'
  : item.computedStatus === 'completed' ? 'text-[#3A6B4F]'
  : 'text-[#2B2C2F]'
}`}>
```

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: clean build. If it fails on a TypeScript error about a class name in a Tailwind arbitrary value, the syntax is `bg-[rgba(95,102,114,0.16)]` (no spaces inside brackets).

- [ ] **Step 4: Manual smoke — this is the largest surface**

Run: `npm run dev`, open `http://localhost:3000/obligations`. Check:
- Filter bar renders on a white row, inputs have subtle borders.
- Table has white rows, silicon separators, overdue rows have a subtle red wash.
- Click any row → detail panel opens with a tinted hero (red/amber/green based on status) and graphite details below.
- Click the counterparty row → inline editor appears with General Sans input.
- Click "+ Add" → create dialog opens on a white surface, all fields readable.
- Select multiple rows with checkboxes → bulk action bar appears at the top. Mark Complete is graphite, Edit is graphite, Delete is red.
- Open "Bulk Delete" dialog → destructive action uses red text and border.

- [ ] **Step 5: Full test run**

Run: `npm test -- --run 2>&1 | tail -8`
Expected: 279/279.

- [ ] **Step 6: Commit phase 6**

```bash
git add src/app/obligations/page.tsx
git commit -m "feat(brand): phase 6 — FAST reskin of Obligations page"
```

---

## Phase 7: Dashboard, Calendar, Categories, Templates, Activity

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/calendar/page.tsx`
- Modify: `src/app/categories/page.tsx`
- Modify: `src/app/templates/page.tsx`
- Modify: `src/app/activity/page.tsx`

- [ ] **Step 1: Systematic pass — one page at a time**

For each page, grep for dark classes and apply the phase 3 substitution table. Extra notes:

**dashboard/page.tsx**
- The charts (which are in `src/components/dashboard/`) were already reskinned in phase 4. This page is mostly layout containers.
- Page title: `text-2xl font-medium tracking-[-0.02em]`
- Chart containers: white card, shadow-card, rounded-card, p-6.

**calendar/page.tsx**
- Month grid cells: white bg, silicon hairlines.
- "Today" cell: `bg-[rgba(161,176,207,0.18)] border-[#A1B0CF]`.
- Overdue event chips: `bg-[#B45555]/10 text-[#B45555] border-[#B45555]/30`.
- Upcoming event chips: `bg-[#A1620E]/10 text-[#A1620E] border-[#A1620E]/30`.
- Current/future event chips: `bg-white text-[#2B2C2F] border-black/10`.
- "Month navigation" buttons: use ui/button ghost variant.

**categories/page.tsx**
- Each category card: white bg, shadow-card, rounded-card, p-5.
- Category icon: use `text-[#5F6672]`. If the category has overdue items, use `text-[#B45555]`.
- "By counterparty" panel at the bottom (already present from recent commit): each counterparty card = white bg, subtle hover shadow.

**templates/page.tsx**
- Template cards: white bg, shadow-card, rounded-card.
- Icon emoji: keep as-is (they're emoji, not branded icons).
- Badge showing obligation count: `bg-[rgba(200,207,216,0.4)] text-[#5F6672]`.
- "Preview" and "Apply" buttons: graphite primary for Apply, ghost for Preview.

**activity/page.tsx**
- Audit log table: white bg, silicon hairlines.
- Event type column: use monospace with light-steel tint: `text-[#5F6672] font-mono`.
- Actor column: plain graphite text.
- "Load older events →" link: `text-[#2B2C2F] hover:underline`.

- [ ] **Step 2: Build after each page OR in batch**

Easier option: update all five files, then run one build:

Run: `npm run build 2>&1 | tail -10`
Expected: clean build.

- [ ] **Step 3: Manual smoke each page**

For each, visit `http://localhost:3000/<page>` and verify no residual dark surfaces.

- [ ] **Step 4: Commit phase 7**

```bash
git add src/app/dashboard src/app/calendar src/app/categories src/app/templates src/app/activity
git commit -m "feat(brand): phase 7 — FAST reskin of Dashboard/Calendar/Categories/Templates/Activity"
```

---

## Phase 8: Help, Auth error, Settings

**Files:**
- Modify: `src/app/help/page.tsx`
- Modify: `src/app/auth/error/page.tsx`
- Modify: `src/app/settings/users/page.tsx`
- Modify: `src/app/settings/agents/page.tsx`

- [ ] **Step 1: Apply substitution table, per-page notes**

**help/page.tsx**
- Page title: graphite, `text-2xl font-medium`.
- Help topic cards: white bg, shadow-card, rounded-card. Role badge in top-right: use the same `roleBadgeColors` we defined in phase 2.
- Expanded-topic body: use `text-[#5F6672]` for body paragraphs, `text-[#2B2C2F]` for bold and code. Code blocks: `bg-[#F6F8FA] border border-black/10 text-[#2B2C2F] font-mono`.
- `<code>` inline tokens: `bg-[#F6F8FA] border border-black/10 px-1 py-0.5 text-[#2B2C2F] rounded text-[11px]`.
- Search input: uses the phase 3 ui/input, already light.

**auth/error/page.tsx**
- Error shell: white card on Platinum canvas. Error message in graphite with a calm red accent (`#B45555`).

**settings/users/page.tsx**
- User table: white bg, silicon hairlines.
- Role dropdown: phase 3 ui/select, already light.
- "Last admin" disabled state: graphite text with a subtle `bg-[rgba(200,207,216,0.4)]` row background.

**settings/agents/page.tsx**
- Agent table: same as users.
- **Skill URL bar** (the one we added recently) — update to a light version:
  ```tsx
  <div className="mt-4 mb-4 bg-white border border-black/5 shadow-card rounded-card p-4 flex items-center gap-3">
    <div className="flex-shrink-0">
      <div className="text-[10px] text-[#5F6672] uppercase tracking-[0.18em] mb-0.5">Agent skill URL</div>
      <div className="text-[10px] text-[#5F6672]/80">Public, no auth — share with any AI agent</div>
    </div>
    <code className="flex-1 font-mono text-[11px] text-[#2B2C2F] break-all bg-[#F6F8FA] border border-black/5 px-2.5 py-2 rounded-inner">
      {SKILL_URL}
    </code>
    {/* Copy and Open buttons — use ui/button ghost variant */}
  </div>
  ```
- Create-token modal (the one that shows the token once): hero token box = Platinum surface, monospace, graphite. "Copy Token" primary button = graphite bg, platinum text. The two secondary "Copy command" / "Copy prompt" buttons = ghost style (transparent bg, border, graphite text).

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: clean build.

- [ ] **Step 3: Manual smoke**

Open each page. Admin pages require an admin session — sign in with an admin account (or use the dev fallback). Verify skill URL bar is readable on the light background.

- [ ] **Step 4: Commit phase 8**

```bash
git add src/app/help src/app/auth src/app/settings
git commit -m "feat(brand): phase 8 — FAST reskin of Help, Settings, and Auth error"
```

---

## Phase 9: Copy and metadata cleanup

**Files:**
- Modify: `src/app/layout.tsx` (metadata block)
- Modify: `src/components/layout/sidebar.tsx` (any remaining "Pi Squared Inc." text)
- Modify: `src/data/help-content.ts` (replace "Pi Squared Inc." references)
- Modify: `src/lib/compliance-tracker-skill.ts` (replace "Pi Squared Inc." in the skill markdown)
- Modify: `docs/skills/compliance-tracker/SKILL.md` (same, mirror)

Goal: finish switching the identity from "Pi Squared Inc." to FAST.

- [ ] **Step 1: Grep for every reference**

Run: `grep -rn "Pi Squared Inc\." src/ docs/`
Expect ~15–25 hits across help topics, metadata, skill markdown, seed data.

- [ ] **Step 2: Decide per-hit: swap or keep**

Some references need careful thought:
- **Entity field** (`entity: 'Pi Squared Inc.'` in schema default, seed, templates) — this is the **data** entity for obligations, not the brand. **KEEP** the default as "Pi Squared Inc." unless the user wants to rebrand their corporate entity too. Confirm with user before changing.
- **Sidebar label** — already swapped to FAST logo in phase 2, but if there's any text fallback or aria-label still saying "Pi Squared Inc." → change to "FAST".
- **Metadata title** — already changed to "FAST Compliance Tracker" in phase 1.
- **Help topic copy** referring to "Pi Squared Inc.'s compliance tracker" — change to "FAST's compliance tracker" or "the compliance tracker".
- **Agent skill markdown** at `/.well-known/compliance-tracker-skill` — may mention "Pi Squared Inc." in descriptions. Change to "FAST".

- [ ] **Step 3: Apply substitutions**

For user-facing strings (help, metadata, skill), use:

```bash
# Dry-run: list all matches
grep -rn "Pi Squared Inc\." src/data/help-content.ts src/lib/compliance-tracker-skill.ts docs/skills/
# Then edit each file with the Edit tool, replacing the brand string
```

Suggested replacements:
- `"Pi Squared Inc.'s compliance tracker"` → `"FAST Compliance Tracker"`
- `"the Pi Squared Inc. compliance tracker"` → `"FAST Compliance Tracker"`
- `"Pi Squared Inc."` when used as the company name → `"FAST"`

- [ ] **Step 4: Do NOT change the `entity` default in schema/seed/validation/templates**

Confirm these are unchanged:
- `src/db/schema.ts` — `entity: text('entity').default('Pi Squared Inc.')`
- `src/db/index.ts` — seed INSERT still uses `'Pi Squared Inc.'`
- `src/lib/validation.ts` — `entity: z.string().default('Pi Squared Inc.')`

The `entity` field is legal data, not branding. It represents which corporate entity an obligation belongs to — the user can change this later through the UI if they want; plan 9 does not.

- [ ] **Step 5: Update CLAUDE.md UI direction section**

Find the "UI direction" section in `CLAUDE.md` and replace with:

```markdown
## UI direction

- The app follows the FAST design language (see `docs/superpowers/plans/2026-04-17-fast-rebrand.md`):
  - Light theme, Platinum canvas, white cards, Graphite text.
  - General Sans typography (woff2 in `public/fonts/`, loaded via `next/font/local`).
  - Accent is Light Steel Blue `#A1B0CF` — use as a blade, not a paint bucket.
  - FAST wordmark logo in sidebar; never type "FAST" as plain text.
- Keep density controlled but not crowded. One dominant pane per page.
- Viewer role sees a reduced UI: only Overview and Dashboard in the sidebar, stats + category breakdown on Overview (no obligation tables), no owner-performance table on Dashboard. Tune viewer experience when changing page layouts.
- Follow the FAST pre-ship checklist at `/tmp/fast-demo-kit/fast-demo-kit/references/pre-ship-checklist.md` before shipping a new surface.
```

Remove the old `dense, operational dashboard feel` and `avoid playful consumer SaaS styling` bullets — they're superseded.

- [ ] **Step 6: Build and test**

Run: `npm run build 2>&1 | tail -8 && npm test -- --run 2>&1 | tail -8`
Expected: clean build, 279/279.

- [ ] **Step 7: Commit phase 9**

```bash
git add src/data/help-content.ts src/lib/compliance-tracker-skill.ts docs/skills/ CLAUDE.md
git commit -m "feat(brand): phase 9 — FAST copy + metadata, CLAUDE.md UI direction update"
```

---

## Phase 10: Launch assets and pre-ship QA

**Files:**
- Create: `src/app/icon.png` (favicon — 32×32, Platinum background, dark FAST wordmark, or a single dark-graphite "F" glyph at 32×32 if the wordmark is illegible that small)
- Create: `src/app/opengraph-image.png` (1200×630, FAST logo centered on liquid-metal gradient)
- Create: `src/app/twitter-image.png` (1200×630, same as OG)

The kit's pre-ship checklist requires these. Without access to an image editor or AI image tool in this session, the pragmatic move is:

- [ ] **Step 1: Generate the icon.png with a script**

Run the following to create a 32×32 platinum-background icon with a dark FAST glyph:

```bash
node -e "
const { readFileSync, writeFileSync } = require('fs');
// Simple approach: generate an SVG and convert to PNG
// For production, replace with a proper designer-made icon.
// This is a functional placeholder that matches the FAST palette.
const svg = Buffer.from(\`
<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>
  <rect width='32' height='32' fill='#F6F8FA'/>
  <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui,sans-serif' font-size='20' font-weight='700' fill='#2B2C2F'>F</text>
</svg>
\`);
writeFileSync('src/app/icon.svg', svg);
"
```

Actually, Next.js App Router supports `src/app/icon.svg` directly — it will be rasterized at runtime. Using SVG is better than a hand-rolled PNG here. Remove the PNG requirement from this plan step.

Create `src/app/icon.svg` directly with the content above. This gives us a valid favicon without needing a rasterizer.

- [ ] **Step 2: Generate OG + Twitter images using Next.js Image Generation API**

Instead of static PNGs, use the dynamic image generation route Next.js provides. Create:

`src/app/opengraph-image.tsx`:

```tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'FAST Compliance Tracker'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(132deg, #F6F8FA 0%, #C8CFD8 18%, #A1B0CF 38%, #F6F8FA 56%, #C8CFD8 76%, #5F6672 100%)',
          color: '#2B2C2F',
          padding: 80,
        }}
      >
        <div style={{ fontSize: 140, fontWeight: 700, letterSpacing: '-0.04em' }}>FAST</div>
        <div style={{ fontSize: 40, fontWeight: 400, color: '#5F6672', marginTop: 16 }}>
          Compliance Tracker
        </div>
      </div>
    ),
    { ...size }
  )
}
```

And `src/app/twitter-image.tsx` with the same content (Next.js serves the same image for both slots if you duplicate the file).

- [ ] **Step 3: Update metadata in `src/app/layout.tsx`**

Now that we have the generated OG and favicon files, extend the metadata block:

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://compliance-tracker-alturki.vercel.app'),
  title: 'FAST Compliance Tracker',
  description: 'Track compliance obligations, deadlines, and completions.',
  openGraph: {
    title: 'FAST Compliance Tracker',
    description: 'Track compliance obligations, deadlines, and completions.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAST Compliance Tracker',
    description: 'Track compliance obligations, deadlines, and completions.',
  },
}
```

Next.js automatically picks up `src/app/icon.svg`, `src/app/opengraph-image.tsx`, and `src/app/twitter-image.tsx`.

- [ ] **Step 4: Run through the pre-ship checklist manually**

Open `/tmp/fast-demo-kit/fast-demo-kit/references/pre-ship-checklist.md` and verify each box.

For this app (internal tool, no mobile PWA, no extension), most of the "required shipped assets" items apply:
- [x] Correct FAST logo variant present (sidebar)
- [x] Favicon present (`src/app/icon.svg`)
- [x] OG image present (`src/app/opengraph-image.tsx`)
- [x] Twitter preview image present (`src/app/twitter-image.tsx`)
- [x] Metadata title and description set

Brand correctness:
- [x] Light theme is default
- [x] FAST tokens applied via globals.css + tailwind.config.ts
- [x] Real FAST logo asset, not typed text
- [x] General Sans loaded locally
- [x] UI feels mostly grayscale with color used for meaning

Responsive + accessibility (test manually):
- [ ] Mobile works at 375px — shrink the browser, make sure the sidebar collapses or overlays. If there's no mobile behavior today, note it as a known gap. **The existing app may not be mobile-friendly; this phase does not add mobile; document as a known gap if so.**
- [ ] No horizontal scroll on desktop
- [ ] Focus states visible (Tab through forms, verify ring)
- [ ] `prefers-reduced-motion` respected (already wired in globals.css step 4)

Content QA:
- [ ] Every button has action-oriented text
- [ ] No placeholder copy or dead links

- [ ] **Step 5: Final build + full test**

Run: `npm run build 2>&1 | tail -12`
Expected: clean build. The build output should list `/icon.svg`, `/opengraph-image`, `/twitter-image` as new routes.

Run: `npm test -- --run 2>&1 | tail -8`
Expected: 279/279.

- [ ] **Step 6: Smoke test prod-like locally**

Run: `npm run start &` (after the build). Visit `http://localhost:3000` and spot-check the rebrand is holistic.

Verify: `curl -s http://localhost:3000/opengraph-image | file -` returns PNG metadata.

Kill the server.

- [ ] **Step 7: Commit phase 10**

```bash
git add src/app/icon.svg src/app/opengraph-image.tsx src/app/twitter-image.tsx src/app/layout.tsx
git commit -m "feat(brand): phase 10 — favicon, OG/Twitter previews, metadata"
```

- [ ] **Step 8: Merge feature branch to main**

Assuming this work was done on a branch `feat/fast-rebrand`:

```bash
git checkout main
git merge --ff-only feat/fast-rebrand
git push origin main
git branch -d feat/fast-rebrand
```

- [ ] **Step 9: Smoke test production after Vercel auto-deploys**

Wait for the Vercel deploy (check `vercel ls compliance-tracker | sed -n '5p'` until status is `● Ready`).

Run: `./scripts/smoke-test-prod.sh 2>&1 | tail -15`
Expected: 11/11 baseline checks pass.

Verify https://compliance-tracker-alturki.vercel.app serves the FAST-branded UI. Share a link — the OG preview should render the liquid-metal gradient with the FAST wordmark.

---

## Self-review checklist

**Spec coverage** — each part of the user's ask:

- [x] Replace Pi Squared Inc. with FAST branding → Phase 2 (logo in sidebar), Phase 9 (copy, metadata, skill markdown), Phase 10 (OG).
- [x] Use what the kit says (light theme, FAST palette, General Sans) → Phase 1 (foundation).
- [x] Use the locally uploaded fonts → Phase 1 step 1.
- [x] Phased update → 10 phases, each commits and deploys.
- [x] Use what needs updating in the repo → all 12 pages + 36 components + tailwind/globals/layout/CLAUDE.md/help-content/skill-markdown touched across phases 1–10.
- [x] Kit is high priority → plan quotes the kit's rules and defers to its references.

**Placeholder scan** — any "TBD" or "similar to"? No. Every step shows exact commands, exact code, exact substitutions. The substitution table (phase 3 step 2) is referenced from later phases, which is acceptable — it's a single shared mapping.

**Type consistency** — `getRiskColor`/`getStatusColor` return types unchanged (`string`), just different Tailwind classes inside. `SessionProvider` prop unchanged. Metadata shape uses standard Next.js types. No naming collisions.

**Gap** identified during self-review: the existing `src/lib/utils.ts` status/risk color helpers need updating in phase 5. I flagged this inline — it's the reason phase 5 touches `src/lib/utils.ts`.

**Gap** identified during self-review: the `entity` field default stays as "Pi Squared Inc." per step 9.4. If the user wants the legal corporate entity rebranded too, that is a separate database migration plan, not this UI rebrand.

---

## Risks and rollback

**Biggest risk:** 303 color-class touch points across ~30 files, zero React component tests. A typo in an arbitrary-value class (`bg-[#2B2C2F` missing `]`) will render as an unstyled element — Tailwind won't error, the build will succeed, but the UI will look broken. Mitigation: manual browser smoke after each phase (step labeled "smoke" in every phase).

**Second risk:** `getRiskColor`/`getStatusColor` return strings used in multiple places. If phase 5 changes them before phase 6 is done, the obligations list rows may look wrong briefly on `main`. Mitigation: this plan does phases in a single branch; the intermediate commits are fine as long as main stays green. If you merge each phase to main separately (instead of at the end), merge phases 5 and 6 together.

**Rollback:** every phase is a single commit. `git revert <sha>` of any phase reverts that layer without affecting earlier ones. Phase 1 and 2 are the most foundational — reverting them after later phases land will break everything downstream.
