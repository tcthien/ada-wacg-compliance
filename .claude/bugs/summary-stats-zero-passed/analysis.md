# Bug Analysis: Summary Statistics Show 0 Passed

## Root Cause Analysis

### Investigation Summary

The issue is a **missing prop** in the scan result page. The `ResultsSummary` component has an optional `passed` prop that defaults to `0`, but the page never passes this prop.

### Root Cause

**The `passed` prop is not being passed to `ResultsSummary`.**

Looking at `apps/web/src/app/scan/[id]/page.tsx` line 414:
```typescript
<ResultsSummary summary={result.summary} />
```

The `ResultsSummary` component expects:
```typescript
interface ResultsSummaryProps {
  summary: {
    totalIssues: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  passed?: number;  // <-- Optional prop, defaults to 0
}
```

The page only passes `summary` but not `passed`. The API response has `result.summary.passed` available (which equals `result.passedChecks` from the database - the axe-core passed checks count).

### Data Flow Analysis

```
Backend: result.service.ts
├── calculateSummary() returns { ..., passed: result.passedChecks }
│
API Response: ScanResultResponse
├── summary: { totalIssues, critical, serious, moderate, minor, passed }
│                                                              ↑
│                                                    This IS populated!
│
Frontend: scan/[id]/page.tsx (line 414)
├── <ResultsSummary summary={result.summary} />
│                                            ↑
│                              Missing: passed={result.summary.passed}
│
Component: ResultsSummary.tsx (line 12)
├── function ResultsSummary({ summary, passed = 0 })
│                                      ↑
│                            Defaults to 0 when not provided
```

### Why "0 Passed" Shows

1. The API correctly returns `result.summary.passed` (e.g., 50 passed axe-core checks)
2. The page doesn't pass this value to `ResultsSummary`
3. The component defaults `passed` to `0`
4. The UI shows "0 Passed"

## Technical Details

### Affected Code Locations

| File | Line | Issue |
|------|------|-------|
| `apps/web/src/app/scan/[id]/page.tsx` | 414 | Missing `passed` prop |

### The Fix

Simply add the `passed` prop:

```typescript
// Before
<ResultsSummary summary={result.summary} />

// After
<ResultsSummary summary={result.summary} passed={result.summary.passed} />
```

## Alternative Consideration

### What Does "Passed" Mean?

There are two different "passed" metrics:

| Metric | Source | Meaning |
|--------|--------|---------|
| `result.summary.passed` | `passedChecks` from DB | Count of axe-core rules that passed |
| `enhancedCoverage.breakdown.criteriaPassed` | Computed | Count of WCAG criteria that passed |

**Current behavior**: `summary.passed` = axe-core passed checks (individual rule tests)
**Alternative**: Could show `criteriaPassed` = WCAG criteria that passed

The `ScanCoverageCard` (which we just fixed) shows criteria-level breakdown. The `ResultsSummary` shows issue/check-level counts. These are different granularities:
- **Checks**: Individual axe-core rule tests (can be 100+ checks)
- **Criteria**: WCAG success criteria (50 criteria for AA level)

### Recommendation

Keep using `result.summary.passed` (axe-core passed checks) for `ResultsSummary` because:
1. It aligns with the issue counts in the same card (critical, serious, moderate, minor are also check-level)
2. The criteria-level breakdown is already shown in `ScanCoverageCard`
3. It provides meaningful information about what axe-core tested

## Solution Approach

### Fix Strategy

Add the missing `passed` prop to the `ResultsSummary` component call.

### Changes Required

**File: `apps/web/src/app/scan/[id]/page.tsx` (line 414)**

```typescript
// Before
<ResultsSummary summary={result.summary} />

// After
<ResultsSummary summary={result.summary} passed={result.summary.passed} />
```

### Testing Strategy

1. Navigate to a completed scan result page
2. Verify the "Passed" count shows the actual value from the API
3. Verify other summary statistics are unchanged

## Impact Analysis

### Risk Assessment

- **Risk Level**: Very Low
- **Scope**: Single prop addition
- **Backwards Compatibility**: ✅ No changes to component interface
- **Side Effects**: None

### Rollback Plan

Remove the `passed` prop to revert to showing 0.
