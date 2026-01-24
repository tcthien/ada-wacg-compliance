# Bug Report: Axe-Core Passed Rules Not Reflected in Criteria Table

## Bug Information

| Field | Value |
|-------|-------|
| Bug ID | passed-checks-metric-confusion |
| Reported Date | 2026-01-19 |
| Severity | High |
| Status | Open |

## Summary

The criteria table does not show axe-core's passed/failed checks. Axe-core reports 45 passed checks, but this data is NOT reflected in the criteria table. The criteria table only shows AI verification results, while axe-core's actual test results are lost.

## The Problem

For scan `072ecc14-3fa9-4336-bc5a-c4f830db235a`:

| Source | Data | Where It Shows |
|--------|------|----------------|
| Axe-core | 45 passed checks | Summary card only (as a count) |
| Axe-core | 7 issues (failures) | Issues tab ✅ |
| AI | 25 AI_VERIFIED_PASS | Criteria table ✅ |
| AI | 5 AI_VERIFIED_FAIL | Criteria table ✅ |
| ??? | 20 NOT_TESTED | Criteria table |

**The 45 axe-core passed checks are not mapped to criteria in the table.**

## Root Cause Investigation

### 1. Database Schema
```prisma
model ScanResult {
  passedChecks       Int      @default(0)  // ← Only stores COUNT, not rule IDs
  inapplicableChecks Int      @default(0)
}
```

The database stores `passedChecks: 45` as just a **count**, NOT the actual rule IDs that passed.

### 2. Coverage Service Architecture

The `buildCriteriaVerifications()` method is designed to:
1. Map axe-core passed rule IDs → WCAG criteria (status: PASS)
2. Map issues → WCAG criteria (status: FAIL)
3. Merge AI verifications → AI_VERIFIED_*
4. Remainder → NOT_TESTED

But it requires `passedChecks: string[]` (array of rule IDs like `['color-contrast', 'image-alt']`), which is NOT being provided.

### 3. Current Data Flow

```
Axe-core scan runs
    ↓
Reports: 45 rules passed, 7 violations
    ↓
Stored: passedChecks = 45 (just the count!)
        passedRuleIds = ❌ NOT STORED
    ↓
AI import processes
    ↓
Stores: criteriaVerifications (AI results only)
    ↓
API returns:
    - summary.passed = 45 (axe count, meaningless to user)
    - criteriaVerifications = AI results only
    ↓
UI shows:
    - Summary: "45 Passed" (what does this mean?)
    - Criteria Table: Only AI results, no axe-core PASS/FAIL
```

## Expected Behavior

The criteria table should show the **full picture**:

| Criterion | Status | Scanner | Notes |
|-----------|--------|---------|-------|
| 1.1.1 | FAIL | axe-core | Issue detected |
| 1.3.1 | AI_VERIFIED_FAIL | axe-core + AI | AI detected issue |
| 1.3.2 | PASS | axe-core | Rule passed |
| 1.3.3 | AI_VERIFIED_PASS | AI | AI verified |
| 1.4.1 | AI_VERIFIED_PASS | axe-core + AI | axe passed, AI confirmed |
| 2.4.1 | NOT_TESTED | N/A | Not testable |

Users expect:
1. **Criteria Checked** = Count of criteria with PASS, FAIL, AI_VERIFIED_PASS, AI_VERIFIED_FAIL
2. **Criteria Passed** = PASS + AI_VERIFIED_PASS (where axe-core or AI verified it passed)
3. **Summary "Passed"** should align with criteria passed (or be clearly explained)

## Actual Behavior

- Criteria table shows ONLY AI results (AI_VERIFIED_* and NOT_TESTED)
- No criteria show "PASS" or "FAIL" from axe-core alone
- 45 passed checks from axe-core are displayed as just a number, with no criteria mapping
- User sees "45 Passed" in Summary but only 25 passed criteria in breakdown

## Scope of Fix Required

This is a **significant architectural gap**, not a simple UI bug:

### Option A: Store Passed Rule IDs (Recommended)
1. Modify worker to store passed rule IDs from axe-core
2. Store in database (new column `passedRuleIds String[]`)
3. Pass to `buildCriteriaVerifications()`
4. Criteria table shows axe-core PASS + AI results together

### Option B: Remove Passed Count from Summary
1. Remove "Passed" from Summary card (simpler, less informative)
2. Only show criteria-level data which is accurate

### Option C: Clarify Metrics with Labels
1. Keep "45 Passed Checks" in Summary (clarify it's axe-core rule checks)
2. Keep criteria breakdown separate
3. Accept that they measure different things

## Impact

- **High**: Users see conflicting numbers they can't reconcile
- **Trust Issue**: "45 passed" doesn't match "25 criteria passed"
- **Missing Data**: Axe-core pass/fail status per criterion is lost
- **Incomplete Picture**: Criteria table only shows AI results

## Related Files

- `apps/api/prisma/schema.prisma` - Missing `passedRuleIds` storage
- `apps/worker/src/processors/scan-processor.ts` - Where axe results are processed
- `apps/api/src/modules/results/coverage.service.ts` - `buildCriteriaVerifications()` expects rule IDs
- `apps/api/src/modules/results/result.service.ts` - Falls back to legacy computation
