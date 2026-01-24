# Bug Analysis: Coverage Statistics Mismatch

## Root Cause Analysis

### Investigation Summary

The bug stems from the scan result page (`apps/web/src/app/scan/[id]/page.tsx`) using **two different data sources** for coverage statistics that calculate values differently:

1. **ScanCoverageCard** (lines 388-397) uses `result.coverage`:
   ```typescript
   coveragePercentage={result.coverage?.coveragePercentage ?? 57}
   criteriaChecked={result.coverage?.criteriaChecked ?? 0}
   criteriaTotal={result.coverage?.criteriaTotal ?? 50}
   breakdown={result.coverage.breakdown}
   ```

2. **ScanResultsTabs → CriteriaTable** (lines 421-430) uses `result.enhancedCoverage`:
   ```typescript
   enhancedCoverage={result.enhancedCoverage}
   ```

### Root Cause: Different Calculation Methods

The API returns both `coverage` and `enhancedCoverage` in `result.service.ts`:

| Field | Source Method | Calculation |
|-------|--------------|-------------|
| `coverage` | `coverageService.calculateCoverage()` | Uses **theoretical percentages** (57% standard, 80% AI-enhanced) |
| `enhancedCoverage` | `coverageService.calculateCoverageFromVerifications()` | Uses **actual computed values** from criteriaVerifications |

**Key difference in `coverage.service.ts`:**

```typescript
// calculateCoverage() - Lines 97-138 - THEORETICAL
const coveragePercentage = isAiEnhanced
  ? AI_ENHANCED_COVERAGE_PERCENTAGE  // Always 80
  : STANDARD_COVERAGE_PERCENTAGE;    // Always 57

// calculateCoverageFromVerifications() - Lines 340-402 - ACTUAL
const coveragePercentage = criteriaTotal > 0
  ? Math.round((criteriaChecked / criteriaTotal) * 100)  // Computed from actual data
  : 0;
```

### Why Statistics Don't Match

1. **`coverage.coveragePercentage`** = Fixed value (57% or 80%)
2. **`enhancedCoverage.coveragePercentage`** = Actual computed percentage

3. **`coverage.criteriaChecked`** = Estimated from `passedChecks` count + unique criteria from issues
4. **`enhancedCoverage.criteriaChecked`** = Exact count from criteriaVerifications array

5. **`coverage.breakdown`** = Estimated values using heuristics
6. **`enhancedCoverage.breakdown`** = Exact counts from criteriaVerifications by status

### Data Flow Diagram

```
API: formatResult() in result.service.ts
├── Calls coverageService.calculateCoverage()
│   └── Returns theoretical coverage → result.coverage
│       - Uses fixed percentages (57/80)
│       - Estimates criteria from passedChecks count
│
└── Calls coverageService.calculateCoverageFromVerifications()
    └── Returns actual coverage → result.enhancedCoverage
        - Computes (criteriaChecked / criteriaTotal) * 100
        - Exact counts from criteriaVerifications array

Frontend: scan/[id]/page.tsx
├── ScanCoverageCard ← Uses result.coverage (theoretical)
│   └── Shows: Coverage %, Criteria X/Y, Breakdown
│
└── ScanResultsTabs → CriteriaTable ← Uses result.enhancedCoverage (actual)
    └── Shows: Criteria list with filtering
    └── "Showing X of Y criteria" (actual count)
```

### Specific Mismatch Examples

| Metric | `result.coverage` | `result.enhancedCoverage` | Cause |
|--------|------------------|--------------------------|-------|
| `coveragePercentage` | 57 or 80 (fixed) | 32 (actual) | Theoretical vs computed |
| `criteriaChecked` | 25 (estimated) | 16 (actual) | Heuristic vs exact count |
| `criteriaWithIssues` | 5 (from issues) | 3 (from verifications) | Different counting |
| `criteriaPassed` | 20 (estimated) | 13 (from verifications) | Heuristic vs exact |

## Solution Approach

### Fix Strategy: Single Data Source

The `enhancedCoverage` data is more accurate because it's computed from actual criteriaVerifications. The frontend should use `enhancedCoverage` for all statistics instead of mixing data sources.

### Changes Required

**File: `apps/web/src/app/scan/[id]/page.tsx`**

Change ScanCoverageCard from using `result.coverage` to `result.enhancedCoverage`:

```typescript
// Before (lines 388-397)
<ScanCoverageCard
  coveragePercentage={result.coverage?.coveragePercentage ?? 57}
  criteriaChecked={result.coverage?.criteriaChecked ?? 0}
  criteriaTotal={result.coverage?.criteriaTotal ?? 50}
  passedChecks={result.summary.passed}
  isAiEnhanced={scan.aiEnabled ?? false}
  wcagLevel={result.wcagLevel}
  {...(aiStatus?.status ? { aiStatus: aiStatus.status } : {})}
  {...(result.coverage?.breakdown ? { breakdown: result.coverage.breakdown } : {})}
/>

// After
<ScanCoverageCard
  coveragePercentage={result.enhancedCoverage?.coveragePercentage ?? 57}
  criteriaChecked={result.enhancedCoverage?.criteriaChecked ?? 0}
  criteriaTotal={result.enhancedCoverage?.criteriaTotal ?? 50}
  passedChecks={result.summary.passed}
  isAiEnhanced={result.enhancedCoverage?.isAiEnhanced ?? false}
  wcagLevel={result.wcagLevel}
  {...(aiStatus?.status ? { aiStatus: aiStatus.status } : {})}
  {...(result.enhancedCoverage?.breakdown ? { breakdown: result.enhancedCoverage.breakdown } : {})}
/>
```

### Files to Modify

1. `apps/web/src/app/scan/[id]/page.tsx` - Change data source for ScanCoverageCard
2. `apps/web/src/app/admin/scans/[id]/page.tsx` - Same change for admin view (if applicable)

### Testing Strategy

1. Verify ScanCoverageCard shows same numbers as CriteriaTable count
2. Verify breakdown totals sum to criteriaChecked
3. Test with both standard and AI-enhanced scans
4. Test legacy scans that use computed verifications (fallback path)

## Impact Analysis

### Risk Assessment

- **Risk Level**: Low
- **Scope**: UI data binding only - no backend changes
- **Backwards Compatibility**: ✅ Both data sources exist in API response
- **Side Effects**: None - `enhancedCoverage` is always computed

### Considerations

1. **Legacy `coverage` field**: Keep in API for backwards compatibility with any API consumers
2. **Percentage change**: Users will now see actual percentage (e.g., 32%) instead of theoretical (57%), which is more accurate but may seem lower
3. **UX Note**: Consider updating UI copy to clarify "32% of WCAG criteria tested" vs previous "57% detection coverage"

## Rollback Plan

Revert the frontend changes to use `result.coverage` if issues arise.
