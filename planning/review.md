# QA Audit Report

**Project:** Compliance Tracker  
**Auditor:** Faheem (QA Subagent)  
**Date:** 2026-04-01  
**Build Status:** ✅ Passes (Next.js 14.2.5)

---

## Critical Issues (must fix)

### 1. **CRITICAL: SQLite on Vercel serverless - writes will fail**
- **Location:** `src/db/index.ts`, deployment architecture
- **Issue:** Using `better-sqlite3` with local file `./compliance.db`. Vercel serverless functions have read-only filesystems. ALL write operations (POST/PUT/DELETE) will fail silently or throw errors in production.
- **Evidence:** 
  - `DATABASE_URL=./compliance.db` in `.env.local`
  - No remote database configured
  - Better-sqlite3 requires filesystem write access
- **Impact:** App will appear to work (reads succeed from bundled seed DB) but users cannot create, update, or complete obligations. Data loss guaranteed.
- **Fix:** Migrate to Vercel Postgres, Turso (libSQL), or another hosted SQLite/Postgres solution. OR deploy to a persistent server (not serverless).

### 2. **Auto-recur logic uses old due date instead of completion date**
- **Location:** `src/app/api/obligations/[id]/complete/route.ts:42-44`
- **Issue:** 
  ```typescript
  if (obligation.autoRecur && obligation.frequency !== 'event-triggered' && obligation.frequency !== 'one-time') {
    updateData['nextDueDate'] = computeNextDueDate(obligation.nextDueDate, obligation.frequency)
  }
  ```
  Computes next due date from the **current** `nextDueDate`, not from the completion date. If an obligation is completed late (e.g., 2 weeks overdue), the new due date will still be based on the original due date, potentially creating another overdue obligation immediately.
- **Expected:** Next due date should be calculated from `max(completedDate, currentNextDueDate)` to prevent immediately overdue obligations when completing late items.
- **Example:** 
  - Obligation due 2026-03-15 (quarterly)
  - Completed 2026-04-01 (17 days late)
  - Current logic: next due = 2026-06-15 (3 months from original)
  - Correct logic: next due = 2026-07-01 (3 months from completion)

### 3. **Missing input validation on all API routes**
- **Location:** All `/api/obligations/*` routes
- **Issue:** No validation of request body fields. Users can submit:
  - Invalid dates (non-ISO strings, future dates for `lastCompletedDate`)
  - Invalid enum values (`category`, `frequency`, `riskLevel`, `status`)
  - Negative or invalid `amount` values
  - Malformed `alertDays` JSON
  - Empty/missing required fields (`title`, `owner`, `nextDueDate`)
- **Impact:** Database corruption, type errors, invalid state, poor UX (silent failures vs helpful error messages)
- **Fix:** Add validation library (Zod, Yup) or manual checks before DB operations. Return 400 with clear error messages.

### 4. **Race condition in complete endpoint**
- **Location:** `src/app/api/obligations/[id]/complete/route.ts`
- **Issue:** Two separate DB operations (INSERT completion, UPDATE obligation) are not wrapped in a transaction. If the UPDATE fails, the completion record exists but the obligation state is stale.
- **Impact:** Data inconsistency - completion records without corresponding obligation updates.
- **Fix:** Wrap both operations in a transaction using Drizzle's transaction API or better-sqlite3's transaction support.

---

## High Priority Issues

### 5. **Type safety violations: `as any` casts bypass TypeScript**
- **Location:** 
  - `src/app/api/obligations/[id]/route.ts:50`
  - `src/app/api/obligations/[id]/complete/route.ts:45`
- **Issue:** 
  ```typescript
  await db.update(obligations).set(updateData as any).where(...)
  ```
  Bypasses Drizzle's type checking. If `updateData` has wrong field types or names, it will fail at runtime.
- **Fix:** Properly type `updateData` to match the Drizzle schema, or use Drizzle's partial update types.

### 6. **No error handling for malformed JSON in seed data**
- **Location:** `src/db/seed.ts`, any code parsing `row.alertDays`
- **Issue:** Seed script does JSON.stringify on alertDays but does not validate. If seed data is manually edited and breaks JSON, the seed script will fail silently or crash.
- **Fix:** Add try/catch around JSON operations, validate array structure.

### 7. **`computeStatus` logic has edge case bug**
- **Location:** `src/lib/utils.ts:11-21`
- **Issue:**
  ```typescript
  if (lastCompletedDate) {
    const completed = new Date(lastCompletedDate)
    if (completed >= today) return 'completed'
  }
  ```
  If `lastCompletedDate` is TODAY or in the future, status is 'completed' regardless of `nextDueDate`. This is incorrect for recurring obligations - completing today doesn't mean it's "completed" if it's due again tomorrow.
- **Expected:** Status should reflect the relationship between `nextDueDate` and today. `lastCompletedDate` should only be used to verify if the current period is completed (i.e., `lastCompletedDate >= nextDueDate`).
- **Example:** 
  - Obligation due 2026-04-15
  - Last completed 2026-04-01 (today)
  - Current logic: status = 'completed' ✗
  - Correct: status = 'upcoming' (still due on 4/15)

### 8. **SQL injection risk in search filter**
- **Location:** `src/app/api/obligations/route.ts:23`
- **Issue:** 
  ```typescript
  if (search) conditions.push(like(obligations.title, `%${search}%`))
  ```
  Drizzle ORM should parameterize this, but if `search` contains SQL special characters (%, _, etc.), it could behave unexpectedly. Not traditional SQL injection, but user input is directly interpolated into a query pattern.
- **Severity:** Low-to-medium (Drizzle likely escapes, but worth verifying).
- **Fix:** Sanitize user input or use Drizzle's safe pattern matching APIs.

### 9. **Missing loading states on all client components**
- **Location:** 
  - `src/app/calendar/page.tsx` (has loading state ✓)
  - `src/app/obligations/page.tsx` (has loading state ✓)
  - Detail panel in obligations page (no loading for completion history fetch)
- **Issue:** When fetching a single obligation by ID for the detail panel, there's no loading indicator. User sees stale data or blank state.
- **Fix:** Add loading skeleton/spinner while `fetch(/api/obligations/${selectedId})` is pending.

### 10. **No empty state for zero obligations**
- **Location:** `src/app/page.tsx`
- **Issue:** Dashboard assumes obligations exist. If database is empty or all are deleted, the page shows zero counts but no helpful empty state (e.g., "No obligations tracked yet. Add your first obligation to get started.").
- **Impact:** Poor UX for first-time users.

### 11. **Date timezone handling inconsistency**
- **Location:** Multiple files
- **Issue:** 
  - Seed uses hardcoded `new Date('2026-04-01')` for "today"
  - Client code uses `new Date()` which is local browser time
  - Server-side rendering uses server timezone (UTC in deployment)
  - Dates stored as strings (`YYYY-MM-DD`) without timezone info
- **Impact:** "Overdue" calculation may differ between server-rendered and client-rendered content. A date that's "today" in one timezone might be "tomorrow" in another.
- **Fix:** Standardize on UTC for all date operations, or document assumption that all dates are in a single timezone (e.g., company HQ timezone).

### 12. **No confirmation dialog for destructive actions**
- **Location:** `src/app/api/obligations/[id]/route.ts` (DELETE endpoint)
- **Issue:** DELETE endpoint exists but there's no UI for it yet. When implemented, it should have confirmation (currently no code calls this endpoint from frontend).
- **Preemptive fix:** Add confirmation dialog when delete UI is built.

---

## Medium Priority Issues

### 13. **Missing error states in obligations list**
- **Location:** `src/app/obligations/page.tsx`
- **Issue:** If API fetch fails, loading state turns off but no error message is shown. User sees empty table with no explanation.
- **Fix:** Add error state with retry button.

### 14. **Hardcoded width breaks responsiveness**
- **Location:** `src/app/obligations/page.tsx:553`
- **Issue:** 
  ```tsx
  className="w-[420px] p-0 ..."
  ```
  Detail panel has fixed 420px width. On mobile/tablet, this will overflow or break layout.
- **Fix:** Use responsive width (e.g., `w-full md:w-[420px]` or max-width with proper mobile drawer).

### 15. **Accessibility: Missing form labels**
- **Location:** `src/app/obligations/page.tsx` - AddObligationDialog
- **Issue:** Labels exist for most fields, but some are programmatically associated via `Label` component. Need to verify `htmlFor` attributes match input IDs.
- **Severity:** Medium (Radix UI components handle this, but worth double-checking).

### 16. **Accessibility: Focus states missing on custom buttons**
- **Location:** Calendar page, custom navigation buttons
- **Issue:** Custom `<button>` elements in calendar navigation may not have visible focus indicators for keyboard users.
- **Fix:** Ensure all interactive elements have `:focus-visible` styles (Tailwind already includes this in many cases, but verify).

### 17. **No pagination on obligations list**
- **Location:** `src/app/obligations/page.tsx`
- **Issue:** If company has 1000+ obligations, the table will load all at once. Slow performance and poor UX.
- **Fix:** Add pagination or virtual scrolling.

### 18. **Inconsistent date formatting**
- **Location:** Various
- **Issue:** Some places use `formatDate()` helper, others manually format with `date-fns`. Inconsistent format strings could confuse users.
- **Fix:** Centralize all date formatting through a single helper.

### 19. **No audit trail for edits**
- **Location:** All API routes
- **Issue:** No tracking of who edited what and when. `updatedAt` is set but no `updatedBy` field.
- **Impact:** Compliance tracking without audit trail is risky for regulatory purposes.
- **Fix:** Add `updatedBy` field and change log table.

### 20. **Search is case-sensitive and title-only**
- **Location:** `src/app/api/obligations/route.ts:23`
- **Issue:** `like(obligations.title, `%${search}%`)` is case-sensitive in SQLite (unless COLLATE NOCASE is used). Also only searches title, not notes/owner/category.
- **Fix:** Add COLLATE NOCASE or convert to lowercase for search. Expand search to multiple fields.

### 21. **Alert days stored as JSON string - parsing risk**
- **Location:** Database schema, multiple files
- **Issue:** `alertDays` stored as JSON string (`TEXT` field). Every read requires `JSON.parse()`. If DB is manually edited and JSON is invalid, app will crash.
- **Fix:** Validate on read, or use a separate `alert_days` table with foreign key (more normalized).

### 22. **No rate limiting on API routes**
- **Location:** All API routes
- **Issue:** No protection against spam/abuse. User could create thousands of obligations or spam completion endpoint.
- **Fix:** Add rate limiting middleware (Vercel has built-in options, or use `express-rate-limit` equivalent).

---

## Low Priority / Suggestions

### 23. **TypeScript: `any` types in component props**
- **Location:** Multiple page components cast types with `as any` in JSX
- **Issue:** Not dangerous but reduces type safety benefit.
- **Fix:** Import proper types for `RiskLevel`, `Status`, etc., and assert only when necessary.

### 24. **Unused imports**
- **Location:** Various
- **Severity:** Low (build passes, but clutters code)
- **Fix:** Run `eslint --fix` to auto-remove.

### 25. **Next.js 14.2.5 security vulnerability**
- **Location:** `package.json`
- **Issue:** npm audit warns of security vulnerability in Next.js 14.2.5 (see build output).
- **Fix:** Upgrade to latest Next.js 14.x or 15.x.

### 26. **No database migration strategy**
- **Location:** `src/db/index.ts`
- **Issue:** Schema changes require manual SQL or re-seeding. No migration framework (Drizzle Kit can generate migrations but not applied here).
- **Fix:** Use `drizzle-kit generate` and `drizzle-kit migrate` for production.

### 27. **No authentication/authorization**
- **Location:** Entire app
- **Issue:** Acknowledged in task description. Anyone with URL can view/edit all obligations.
- **Note:** This is a known gap, not a bug. Document as "Phase 2" requirement.

### 28. **Calendar view: no year navigation**
- **Location:** `src/app/calendar/page.tsx`
- **Issue:** Can only navigate month-by-month. To reach 2027, user must click "next" 12+ times.
- **Fix:** Add year picker or "jump to date" feature.

### 29. **No bulk operations**
- **Location:** Obligations page
- **Issue:** Cannot select multiple obligations and bulk-complete or bulk-edit.
- **Fix:** Add checkbox selection and bulk action bar.

### 30. **Seed data uses hardcoded "today" date**
- **Location:** `src/db/seed.ts:26`
- **Issue:** `const TODAY = new Date('2026-04-01')` is hardcoded. Over time, seed data will become stale.
- **Fix:** Use `new Date()` or parameterize seed date.

### 31. **No export functionality**
- **Suggestion:** Add CSV/Excel export for reporting compliance to auditors.

### 32. **No notifications/reminders**
- **Suggestion:** Email/Slack alerts based on `alertDays` schedule (not implemented yet, but seems like a planned feature).

### 33. **Subcategory field unused**
- **Location:** Schema has `subcategory` but no UI filtering or special handling.
- **Suggestion:** Add subcategory filter dropdown or remove field if not needed.

### 34. **Categories page could show more stats**
- **Location:** `src/app/categories/page.tsx`
- **Suggestion:** Show total $ amount of fees/costs per category, or compliance coverage %.

### 35. **Missing keyboard shortcuts**
- **Suggestion:** Add keyboard nav (e.g., `/` to focus search, `Esc` to close panels, arrow keys in table).

---

## Test Plan

For each critical and high priority issue, describe what test should verify the fix:

### Critical Issues

**1. SQLite on Vercel serverless fix:**
- **Test:** Deploy to Vercel staging. Attempt to create a new obligation via UI. Verify it persists after page reload. Attempt to mark an obligation complete. Verify completion record is saved.
- **Expected:** All write operations succeed. No errors in Vercel function logs.

**2. Auto-recur logic fix:**
- **Test:** Create annual obligation due 2026-01-01. Mark it complete on 2026-03-01 (2 months late). Verify next due date is 2027-03-01 (1 year from completion), not 2027-01-01 (1 year from original).
- **Expected:** `nextDueDate` advances from completion date, not from old due date.

**3. Input validation:**
- **Test:** 
  - POST `/api/obligations` with empty `title` → expect 400 with error message
  - POST with invalid `category` → expect 400
  - POST with `nextDueDate: "not-a-date"` → expect 400
  - POST with valid data → expect 201
- **Expected:** API rejects invalid input with helpful error messages, accepts valid input.

**4. Race condition in complete endpoint:**
- **Test:** 
  - Mock DB failure on UPDATE (simulate network issue or constraint violation).
  - Verify completion record is NOT created if obligation update fails.
  - Under normal conditions, verify both INSERT and UPDATE succeed or both fail (atomic).
- **Expected:** Transactional consistency - either both operations succeed or both fail.

### High Priority Issues

**5. Type safety (`as any` casts):**
- **Test:** TypeScript compilation should pass without `as any`. Change field name in `updateData` to something invalid → expect compile error.
- **Expected:** TypeScript catches type mismatches at compile time.

**7. `computeStatus` logic:**
- **Test:** 
  - Obligation due 2026-04-15, last completed 2026-04-01 → expect status = 'upcoming'
  - Obligation due 2026-03-15, last completed 2026-04-01 → expect status = 'overdue'
  - Obligation due 2026-04-01, last completed 2026-04-01 → expect status = 'completed' OR 'current' (define expected behavior)
- **Expected:** Status reflects relationship between due date and today, not just completion date.

**8. SQL injection / search sanitization:**
- **Test:** Search for `%` or `_` or `'; DROP TABLE obligations; --` → verify app doesn't crash, returns safe results.
- **Expected:** No SQL errors, results match expected escaping behavior.

**9. Missing loading states:**
- **Test:** Open detail panel, observe network tab (slow 3G). Verify loading indicator appears while fetching obligation details.
- **Expected:** Visible loading state, no stale data flicker.

**11. Date timezone handling:**
- **Test:** 
  - Set system timezone to UTC-8, reload page. Note which obligations are "overdue".
  - Set system timezone to UTC+5, reload page. Verify same obligations are "overdue".
  - Deploy to Vercel (UTC server), compare server-rendered HTML to client hydration.
- **Expected:** Consistent overdue calculation across timezones (or clearly documented assumption).

### Medium Priority Issues

**13. Missing error states:**
- **Test:** Block API endpoint with firewall or dev tools. Verify error message appears in UI with retry option.
- **Expected:** User sees helpful error message, not just empty screen.

**14. Responsive design:**
- **Test:** Open obligations page on 375px mobile viewport. Verify detail panel doesn't cause horizontal scroll.
- **Expected:** Panel uses drawer/modal on mobile, fixed sidebar on desktop.

**17. Pagination:**
- **Test:** Seed 500 obligations. Measure page load time and DOM size. Implement pagination. Verify load time improves.
- **Expected:** <200 obligations rendered at once, fast page load.

**19. Audit trail:**
- **Test:** Edit obligation. Verify `updatedBy` field is recorded. View audit log showing who changed what.
- **Expected:** Full change history with user attribution.

---

## Summary

**Critical issues found:** 4  
**High priority issues:** 8  
**Medium priority issues:** 10  
**Low priority suggestions:** 13  

**Build status:** ✅ Passes  
**Code quality:** Good structure, but lacks production-ready error handling and validation  
**Biggest risk:** SQLite on Vercel serverless (deployment blocker)  
**Recommendation:** Address critical issues 1-4 before production deployment. High priority issues should be fixed within sprint 1. Medium/low can be prioritized based on user feedback.

---

**Status:** DONE_WITH_CONCERNS

The codebase is well-structured and demonstrates good frontend practices, but has several critical production-readiness gaps:
1. Database deployment architecture is incompatible with Vercel serverless
2. Auto-recur logic will create UX issues for late completions
3. No input validation creates data integrity risk
4. Race conditions in critical transaction paths

These are all fixable within 1-2 days of work. The foundation is solid, but the app is NOT production-ready in its current state.
