# Implementation Plan: Enhanced Trust Indicators

## Task Overview

This implementation adds differentiated trust indicators to scan results, showing accurate coverage percentages (57% standard vs 75-85% AI-enhanced) and WCAG criteria coverage metrics. The implementation follows a backend-first approach: API service → API response → Frontend components → Integration.

## Steering Document Compliance

- **structure.md**: Components placed in `apps/web/src/components/features/compliance/`
- **tech.md**: TypeScript strict mode, existing interface patterns, Tailwind CSS styling

## Atomic Task Requirements

Each task is designed to:
- Touch 1-3 related files maximum
- Be completable in 15-30 minutes
- Have one testable outcome
- Specify exact files to create/modify

## Tasks

### Phase 1: API Backend (Coverage Calculation)

- [ ] 1. Create CoverageService class with calculateCoverage method
  - **File**: `apps/api/src/modules/results/coverage.service.ts` (create)
  - Define CoverageMetrics interface
  - Implement calculateCoverage() that:
    - Counts unique WCAG criteria from issues (using wcagCriteria field)
    - Maps passed/inapplicable checks to WCAG criteria using AXE_RULE_TO_WCAG
    - Returns coveragePercentage (57 or 80), criteriaChecked, criteriaTotal, isAiEnhanced
  - Export service class
  - _Leverage: `packages/core/src/constants/wcag.constants.ts` (WCAG_CRITERIA, AXE_RULE_TO_WCAG, getCriteriaUpToLevel)_
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 2. Add unit tests for CoverageService
  - **File**: `apps/api/src/modules/results/coverage.service.test.ts` (create)
  - Test calculateCoverage with standard scan (returns 57%)
  - Test calculateCoverage with AI-enhanced scan (returns 80%)
  - Test criteria counting for each WCAG level (A=30, AA=50, AAA=78)
  - Test edge cases: empty issues, no passed checks
  - _Leverage: `apps/api/src/tests/setup.ts`, vitest patterns_
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 3. Integrate CoverageService into ResultService
  - **File**: `apps/api/src/modules/results/result.service.ts` (modify)
  - Import CoverageService
  - Add coverage calculation call in getScanResult method
  - Include coverage object in response
  - _Leverage: Existing result.service.ts patterns_
  - _Requirements: 4.1_

- [ ] 4. Update result API response type definitions
  - **File**: `apps/api/src/modules/results/result.types.ts` (modify or create)
  - Add CoverageMetrics interface
  - Add coverage field to ScanResultResponse type
  - Ensure backward compatibility (coverage is optional)
  - _Leverage: Existing type patterns in the module_
  - _Requirements: 4.1_

### Phase 2: Frontend Types and Hooks

- [x] 5. Update frontend API types with coverage fields
  - **File**: `apps/web/src/lib/api.ts` (modify)
  - Add CoverageMetrics interface
  - Add coverage field to ScanResultResponse interface
  - Add isAiEnhanced, coveragePercentage, criteriaChecked, criteriaTotal fields
  - _Leverage: Existing interface patterns in api.ts_
  - _Requirements: 4.1_

- [x] 6. Update useScanResult hook to expose coverage data
  - **File**: `apps/web/src/hooks/useScanResult.ts` (modify)
  - Ensure coverage data is returned from hook
  - Add default values for backward compatibility
  - _Leverage: Existing hook patterns_
  - _Requirements: 4.1_

### Phase 3: Frontend Components

- [x] 7. Create CriteriaCoverage component with tooltip
  - **File**: `apps/web/src/components/features/compliance/CriteriaCoverage.tsx` (create)
  - Display "X of Y criteria checked" format
  - Add Tooltip with breakdown (issues/passed/not testable)
  - Include visual progress indicator
  - Add ARIA labels for accessibility
  - _Leverage: `@/components/ui/tooltip`, `cn()` utility, Tailwind patterns_
  - _Requirements: 2.1, 2.2, 2.6_

- [x] 8. Add unit tests for CriteriaCoverage component
  - **File**: `apps/web/src/components/features/compliance/CriteriaCoverage.test.tsx` (create)
  - Test rendering with different WCAG levels
  - Test tooltip content shows correct breakdown
  - Test accessibility attributes
  - _Leverage: `@testing-library/react`, vitest_
  - _Requirements: 2.1, 2.2_

- [x] 9. Enhance CoverageDisclaimer with AI differentiation props
  - **File**: `apps/web/src/components/features/compliance/CoverageDisclaimer.tsx` (modify)
  - Add isAiEnhanced and aiStatus props with defaults
  - Show 57% for standard scans (existing behavior)
  - Show 75-85% for AI-enhanced scans with COMPLETED status
  - Add purple gradient styling for AI-enhanced state
  - Add Sparkles icon and "AI-Enhanced" badge for AI scans
  - Handle PENDING/PROCESSING states with "AI enhancement will improve coverage" message
  - Handle FAILED state with "AI enhancement was not applied" message
  - _Leverage: Existing amber styling, AiSummarySection gradient patterns, lucide-react Sparkles icon_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 10. Add unit tests for enhanced CoverageDisclaimer
  - **File**: `apps/web/src/components/features/compliance/CoverageDisclaimer.test.tsx` (create)
  - Test default (standard) rendering shows 57%
  - Test AI-enhanced COMPLETED shows 75-85%
  - Test AI PENDING/PROCESSING shows 57% with note
  - Test AI FAILED shows 57% with note
  - Test AI badge and purple styling for enhanced scans
  - _Leverage: `@testing-library/react`, vitest_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 11. Create ScanCoverageCard container component
  - **File**: `apps/web/src/components/features/compliance/ScanCoverageCard.tsx` (create)
  - Create card layout with header "Scan Coverage"
  - Display 3-column grid: Coverage %, Criteria Count, Passed Checks
  - Include CoverageDisclaimer at bottom
  - Show AI-Enhanced badge in header when applicable
  - Add className prop for flexibility
  - _Leverage: `ResultsSummary.tsx` card patterns, `cn()` utility_
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 12. Add unit tests for ScanCoverageCard component
  - **File**: `apps/web/src/components/features/compliance/ScanCoverageCard.test.tsx` (create)
  - Test rendering with standard scan data
  - Test rendering with AI-enhanced scan data
  - Test AI badge visibility based on isAiEnhanced
  - Test all metrics display correctly
  - _Leverage: `@testing-library/react`, vitest_
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 13. Export new components from compliance index
  - **File**: `apps/web/src/components/features/compliance/index.ts` (create or modify)
  - Export CriteriaCoverage
  - Export ScanCoverageCard
  - Re-export CoverageDisclaimer
  - _Requirements: All_

### Phase 4: Integration

- [x] 14. Integrate ScanCoverageCard into ScanResultPage
  - **File**: `apps/web/src/app/scan/[id]/page.tsx` (modify)
  - Import ScanCoverageCard from compliance
  - Replace standalone CoverageDisclaimer with ScanCoverageCard
  - Pass coverage data from useScanResult hook
  - Pass aiEnabled and aiStatus from scan/aiStatus
  - Position prominently above or near ResultsSummary
  - _Leverage: Existing page structure, useScan, useScanResult, useAiScanStatus hooks_
  - _Requirements: 3.1, 1.1, 1.2, 2.1_

- [x] 15. Add integration test for scan result page with coverage
  - **File**: `apps/web/src/app/scan/[id]/page.test.tsx` (create or modify)
  - Test ScanCoverageCard renders with coverage data
  - Test AI-enhanced vs standard display
  - Test criteria coverage tooltip interaction
  - _Leverage: `@testing-library/react`, MSW for API mocking_
  - _Requirements: All_

### Phase 5: Batch Scan Support (Optional Enhancement)

- [ ] 16. Add coverage aggregation to batch result API
  - **File**: `apps/api/src/modules/batches/batch.service.ts` (modify)
  - Calculate aggregated coverage across batch scans
  - Include average coverage percentage
  - Include total unique criteria checked
  - Include count of AI-enhanced vs standard scans
  - _Leverage: CoverageService, existing batch aggregation patterns_
  - _Requirements: 5.1, 5.2_

- [ ] 17. Display aggregated coverage in batch results page
  - **File**: `apps/web/src/app/batch/[id]/page.tsx` (modify)
  - Import and use ScanCoverageCard (or simplified version)
  - Display aggregated metrics for entire batch
  - Show breakdown of AI vs standard scans
  - _Leverage: Existing batch page patterns, ScanCoverageCard_
  - _Requirements: 5.1, 5.2_

## Task Dependencies

```
Phase 1: [1] → [2] → [3] → [4]
Phase 2: [4] → [5] → [6]
Phase 3: [7] → [8], [9] → [10], [11] → [12], [13]
Phase 4: [6, 13] → [14] → [15]
Phase 5: [3, 14] → [16] → [17]
```

## Verification Checklist

After implementation:
- [ ] Standard scan shows 57% coverage with amber styling
- [ ] AI-enhanced scan (COMPLETED) shows 75-85% with purple styling
- [ ] Criteria coverage shows "X of Y" format with working tooltip
- [ ] All WCAG levels (A, AA, AAA) show correct criteria totals
- [ ] API response includes coverage object
- [ ] All new components pass accessibility tests
- [ ] Unit tests pass for all new/modified files
