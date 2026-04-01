# QA Audit Report v2

**Date:** 2026-04-01  
**Auditor:** QA Subagent  
**Commit:** Latest (post multiple feature additions)

---

## Build Status

✅ **PASS** - Build completed successfully with no errors

```
▲ Next.js 14.2.5
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (17/17)
Route (app)                              Size     First Load JS
...all routes built successfully
```

**No TypeScript errors, no warnings.**

---

## Test Results

❌ **FAIL** - 1 out of 52 tests failing

**Test Files:** 1 failed | 4 passed (5)  
**Tests:** 1 failed | 51 passed (52)

### Failing Test

**File:** `src/app/api/obligations/[id]/complete/__tests__/route.test.ts`  
**Test:** `POST /api/obligations/[id]/complete > rejects invalid completion date (400)`

**Error:**
```
AssertionError: expected 201 to be 400 // Object.is equality
- Expected: 400
+ Received: 201
```

**Root cause:** The complete route (`src/app/api/obligations/[id]/complete/route.ts`) does **not validate** the `completedDate` field format before processing. It accepts any string, including invalid dates like `'invalid-date'`.

---

## API Route Issues

All API routes tested successfully:

| Endpoint | Status | Response |
|----------|--------|----------|
| `GET /api/stats` | ✅ 200 | Valid JSON with stats |
| `GET /api/obligations` | ✅ 200 | Array of obligations |
| `GET /api/templates` | ✅ 200 | Object with `{templates: [...]}` |
| `GET /api/analytics` | ✅ 200 | Full analytics object |
| `POST /api/obligations` | ✅ 201 | Created obligation with ULID |

**No 500 errors or unexpected failures when testing live endpoints.**

---

## Frontend Issues

✅ **NO ISSUES** - All page components compiled and rendered successfully during static generation:

- `/` (dashboard home)
- `/calendar`
- `/categories`
- `/dashboard`
- `/obligations`
- `/templates`

**No hydration mismatches, missing imports, or broken references found.**

---

## Schema Issues

### ⚠️ Critical: Missing `templateId` field in database

**Schema definition** (`src/db/schema.ts`) includes:
```typescript
templateId: text('template_id'), // Track which template created this obligation
```

**SQL CREATE TABLE** (`src/db/index.ts`) **DOES NOT** include `template_id` column.

**Impact:**
- Any obligation created from templates will fail to store the `templateId` reference
- Silently ignored during INSERT (Drizzle won't error, just drops the field)
- Breaking template tracking feature

**Mismatch:**
```diff
src/db/schema.ts:     templateId: text('template_id'),
src/db/index.ts:      (no template_id column in CREATE TABLE)
```

### ⚠️ Medium: Missing `ownerEmail` and `assigneeEmail` in UPDATE/CREATE routes

**Schema has these fields:**
```typescript
ownerEmail: text('owner_email'),
assigneeEmail: text('assignee_email'),
```

**But they're not in allowed update fields:**

- `src/app/api/obligations/[id]/route.ts` (PUT) - missing from `allowed` array
- `src/app/api/obligations/route.ts` (POST) - not inserted
- `src/app/api/obligations/bulk/route.ts` - handles `ownerEmail` but single create/update don't

**Impact:**
- Email fields used by alert system (`src/app/api/alerts/route.ts` lines 73-74, 91-93)
- Cannot set owner/assignee emails via standard CRUD endpoints
- Only bulk edit can set them currently

---

## Data Issues

### ❌ Real Company Data Found - NOT ANONYMIZED

**"Pi Squared" references found in 7 locations:**

| File | Line(s) | Issue |
|------|---------|-------|
| `src/components/layout/sidebar.tsx` | 22, 39 | "Pi Squared" in sidebar title, "Pi Squared Inc." in footer |
| `src/app/page.tsx` | 173 | "Pi Squared Inc. — Compliance Dashboard" subtitle |
| `src/app/obligations/page.tsx` | 479 | Default entity: `'Pi Squared Inc.'` |
| `src/app/layout.tsx` | 12 | Page title: `'Compliance Tracker — Pi Squared Inc.'` |
| `src/app/templates/page.tsx` | 33, 226 | Default entity state: `'Pi Squared Inc.'` |

**All references should be changed to "Acme Corp" for full anonymization.**

---

## Code Quality

### Type Safety Issues

**`as any` casts found (19 occurrences):**

| File | Count | Risk Level |
|------|-------|------------|
| Test files (`route.test.ts`) | 13 | Low (test mocks) |
| `src/app/api/obligations/[id]/route.ts` | 1 | **HIGH** - line 56, dynamic key assignment could hide type errors |
| Frontend pages (page.tsx files) | 3 | Medium - `getRiskColor(item.riskLevel as any)` could fail silently |
| `src/db/seed.ts` | 3 | Low - optional field handling |

**Critical instance:**
```typescript
// src/app/api/obligations/[id]/route.ts:56
updateData[key] = data[key] as any
```
This bypasses type checking for dynamic updates. Should use proper typing.

### Missing Error Handling

❌ **No validation in complete route** - already covered in test failure above.

---

## Cleanup Needed

### 🗑️ Unused Feature Summary Files

5 feature summary markdown files left over from development:
```
/home/openclaw/workarea/compliance-tracker/FEATURE_1_SUMMARY.md
/home/openclaw/workarea/compliance-tracker/FEATURE_2_SUMMARY.md
/home/openclaw/workarea/compliance-tracker/FEATURE_3_SUMMARY.md
/home/openclaw/workarea/compliance-tracker/FEATURE_4_SUMMARY.md
/home/openclaw/workarea/compliance-tracker/FEATURE_5_SUMMARY.md
```

**Action:** Move to `planning/archive/` or delete if no longer needed.

### No test shell scripts found

No `test-*.sh` files present (clean).

---

## Fix List (Ordered by Priority)

### 🔴 CRITICAL (Must fix before production)

1. **Add `template_id` column to database schema**
   - **File:** `src/db/index.ts`
   - **Line:** 21 (in CREATE TABLE obligations)
   - **Fix:** Add `template_id TEXT,` after `auto_recur INTEGER DEFAULT 0,`
   - **Test:** Run seed, create obligation from template, verify templateId is saved

2. **Add date validation to complete route**
   - **File:** `src/app/api/obligations/[id]/complete/route.ts`
   - **Line:** After line 72 (after extracting data from JSON body)
   - **Fix:** Validate `data.completedDate` matches `/^\d{4}-\d{2}-\d{2}$/` format
   - **Alternative:** Import and use `completeObligationSchema.safeParse()` from validation.ts
   - **Test:** Failing test should pass: `npm test -- route.test.ts`

3. **Add ownerEmail/assigneeEmail to allowed update fields**
   - **File:** `src/app/api/obligations/[id]/route.ts`
   - **Line:** 45-47 (the `allowed` array)
   - **Fix:** Add `'ownerEmail'` and `'assigneeEmail'` to allowed fields list
   - **Note:** Also needed in validation schemas (createObligationSchema, updateObligationSchema)

4. **Add ownerEmail/assigneeEmail to POST /api/obligations**
   - **File:** `src/app/api/obligations/route.ts`
   - **Line:** 85-109 (the insert statement)
   - **Fix:** Add `ownerEmail: data.ownerEmail ?? null,` and `assigneeEmail: data.assigneeEmail ?? null,`
   - **Note:** Also update validation schema first

### 🟡 HIGH (Should fix soon)

5. **Replace type-unsafe `as any` cast in update route**
   - **File:** `src/app/api/obligations/[id]/route.ts`
   - **Line:** 56
   - **Current:** `updateData[key] = data[key] as any`
   - **Fix:** Use proper Record type or explicit switch statement for type-safe assignment
   ```typescript
   type AllowedKey = typeof allowed[number];
   if (data[key] !== undefined) {
     updateData[key as AllowedKey] = data[key];
   }
   ```

6. **Anonymize all "Pi Squared" references**
   - **Files:** 6 files (see Data Issues section above)
   - **Find/Replace:** `"Pi Squared Inc."` → `"Acme Corp"`
   - **Also:** `"Pi Squared"` → `"Acme Corp"` (sidebar)
   - **Verify:** `grep -ri "Pi Squared\|pi2" src/` should return 0 results

### 🟢 MEDIUM (Nice to have)

7. **Fix frontend `as any` casts for riskLevel**
   - **Files:** `src/app/page.tsx`, `src/app/calendar/page.tsx`, `src/app/templates/page.tsx`
   - **Issue:** `getRiskColor(item.riskLevel as any)`
   - **Fix:** Import proper RiskLevel type and assert: `getRiskColor(item.riskLevel as RiskLevel)`
   - **Better:** Fix getRiskColor signature to accept `string` and handle unknown values gracefully

8. **Remove or archive FEATURE_*_SUMMARY.md files**
   - **Location:** Root directory
   - **Action:** `mkdir -p planning/archive && mv FEATURE_*.md planning/archive/`

9. **Add validation schemas for email fields**
   - **File:** `src/lib/validation.ts`
   - **Fix:** Add `.email()` validation for ownerEmail and assigneeEmail
   ```typescript
   ownerEmail: z.string().email().optional().nullable(),
   assigneeEmail: z.string().email().optional().nullable(),
   ```

### 🔵 LOW (Code quality)

10. **Reduce `as any` in seed.ts**
    - **File:** `src/db/seed.ts`
    - **Lines:** 40, 41, 42
    - **Fix:** Type the raw seed data properly or use optional chaining with proper types

---

## Summary

**Build:** ✅ Pass  
**Tests:** ❌ 1 failing  
**API Routes:** ✅ All functional  
**Frontend:** ✅ No issues  
**Schema:** ❌ Critical mismatch (templateId missing from DB)  
**Data:** ❌ Not fully anonymized (Pi Squared references remain)  
**Code Quality:** ⚠️ Several type safety issues

**Recommended Action:**
1. Fix Critical #1 (schema mismatch) and #2 (validation) immediately
2. Fix Critical #3-4 (email fields) before using alert features
3. Anonymize data (High #6) before any external demo/sharing
4. Address type safety issues (High #5, Medium #7) for maintainability

**Estimated Fix Time:** ~2-3 hours for all critical and high priority items.
