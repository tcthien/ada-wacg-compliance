# Bug Report: Summary Statistics Show 0 Passed Despite Criteria Table Data

## Bug Information

| Field | Value |
|-------|-------|
| Bug ID | summary-stats-zero-passed |
| Reported Date | 2026-01-19 |
| Severity | Medium |
| Status | Open |

## Summary

The Summary statistics card shows incorrect values - specifically showing "0 passed" when the scan has detected 7 issues and the criteria table shows 30/50 criteria checked. The statistics in the Summary section don't match the actual data displayed in the Criteria Table.

## Steps to Reproduce

1. Navigate to a completed scan result page (e.g., `/scan/[id]`)
2. Observe the "Summary" section which shows issue counts and passed checks
3. Compare with the Criteria Coverage tab in Detailed Results
4. **Result**: Summary shows "0 passed" while criteria table shows 30/50 criteria checked

## Expected Behavior

The Summary statistics should accurately reflect the scan results:
- "Passed" count should represent the number of passed accessibility checks
- Statistics should be consistent with what's displayed in the Criteria Table
- If criteria table shows 30/50 criteria checked with some passing, the passed count should reflect this

## Actual Behavior

- Summary section shows "0 passed"
- Criteria Table shows 30/50 criteria checked
- 7 total issues detected
- There's a mismatch between what the Summary shows and what the Criteria Table displays

## Affected Components

| Component | Location |
|-----------|----------|
| `ResultsSummary` | `apps/web/src/components/features/results/ResultsSummary.tsx` |
| `ScanCoverageCard` | `apps/web/src/components/features/compliance/ScanCoverageCard.tsx` |
| Scan Result Page | `apps/web/src/app/scan/[id]/page.tsx` |

## Impact

- **User Confusion**: Users see conflicting statistics in different parts of the UI
- **Trust Issue**: Showing "0 passed" when criteria are passing undermines confidence
- **Data Misrepresentation**: The Summary doesn't accurately reflect the scan status

## Initial Analysis

### Suspected Root Cause

This may be related to the `coverage-stats-mismatch` bug that was just fixed. The fix changed `ScanCoverageCard` to use `result.enhancedCoverage`, but the `ResultsSummary` component may still be using `result.summary.passed` which could have a different value.

Possible causes:
1. `result.summary.passed` represents a different metric (axe-core passed checks) than criteria passed
2. The value isn't being populated correctly from the API
3. Different data sources for Summary vs Criteria Table

### Data Flow

```
API Response
├── summary.passed (axe-core passed checks count)
├── coverage.breakdown.criteriaPassed (legacy)
└── enhancedCoverage.breakdown.criteriaPassed (actual criteria passed)
```

The Summary section may be showing `summary.passed` (axe-core check count) instead of the more meaningful `criteriaPassed` from the criteria breakdown.

## Related Issues

- Related to `coverage-stats-mismatch` bug - same root cause of inconsistent data sources
