# Bug Report: Coverage Statistics Mismatch

## Bug Information

| Field | Value |
|-------|-------|
| Bug ID | coverage-stats-mismatch |
| Reported Date | 2026-01-19 |
| Severity | Medium |
| Status | Open |

## Summary

The statistics displayed in the Scan Coverage section (ScanCoverageCard) and the Summary statistics card don't match with the criteria shown in the detailed results (CriteriaTable). The numbers appear inconsistent between the summary view and the detailed breakdown.

## Steps to Reproduce

1. Navigate to a completed scan result page (e.g., `/scan/[id]`)
2. Observe the "Scan Coverage" card which shows:
   - Detection Coverage percentage
   - Criteria Checked (X of Y)
   - Breakdown (criteria with issues, passed, AI-verified, not testable)
3. Click on the "Criteria Coverage" tab in Detailed Results
4. Count the criteria shown in the CriteriaTable
5. **Result**: The counts in the ScanCoverageCard don't match the actual criteria in CriteriaTable

## Expected Behavior

The statistics shown in the summary card should match the detailed breakdown:
- `criteriaChecked` should equal the count of criteria in CriteriaTable
- `criteriaWithIssues` should equal criteria with FAIL/AI_VERIFIED_FAIL status
- `criteriaPassed` should equal criteria with PASS/AI_VERIFIED_PASS status
- The breakdown totals should sum to `criteriaChecked`

## Actual Behavior

There's a discrepancy between:
- `result.coverage` (used by ScanCoverageCard)
- `result.enhancedCoverage` (used by CriteriaTable)

These two data sources may have different values, causing the UI to show inconsistent information.

## Affected Components

| Component | Data Source | Location |
|-----------|-------------|----------|
| `ScanCoverageCard` | `result.coverage` | `apps/web/src/components/features/compliance/ScanCoverageCard.tsx` |
| `CriteriaCoverage` | `result.coverage.breakdown` | `apps/web/src/components/features/compliance/CriteriaCoverage.tsx` |
| `CriteriaTable` | `result.enhancedCoverage.criteriaVerifications` | `apps/web/src/components/features/compliance/CriteriaTable.tsx` |

## Data Flow

```
API Response (ScanResultResponse)
├── coverage (CoverageMetrics)
│   ├── coveragePercentage
│   ├── criteriaChecked
│   ├── criteriaTotal
│   └── breakdown
│       ├── criteriaWithIssues
│       ├── criteriaPassed
│       ├── criteriaAiVerified
│       └── criteriaNotTestable
│
└── enhancedCoverage (EnhancedCoverageResponse)
    ├── coveragePercentage
    ├── criteriaChecked
    ├── criteriaTotal
    ├── breakdown (same structure)
    └── criteriaVerifications[] ← Actual detailed data
```

## Root Cause Hypothesis

1. **Dual data sources**: The API returns both `coverage` and `enhancedCoverage` which may be calculated differently
2. **Timing issue**: Coverage stats may be calculated before AI verification completes
3. **Calculation mismatch**: The backend may calculate breakdown stats differently from what's in criteriaVerifications

## Impact

- **User Confusion**: Users see different numbers in summary vs detailed view
- **Trust Issue**: Inconsistent statistics undermine confidence in the tool's accuracy
- **Debugging Difficulty**: Hard to determine which numbers are correct

## Proposed Investigation

1. Compare `result.coverage` vs `result.enhancedCoverage` values from API
2. Check if `criteriaVerifications` array length matches `criteriaChecked`
3. Verify breakdown calculation logic in backend service
4. Ensure both data sources are updated together after AI processing
