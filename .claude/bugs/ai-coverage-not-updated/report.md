# Bug Report: AI Coverage Not Updated After Import

## Summary
After importing AI scan results, the coverage percentage remains at 57% (standard scan value) instead of updating to 75-85% (AI-enhanced value).

## Bug Details

| Field | Value |
|-------|-------|
| **Bug ID** | ai-coverage-not-updated |
| **Severity** | Medium |
| **Priority** | High |
| **Component** | Enhanced Trust Indicators / AI Scan Import |
| **Status** | Reported |
| **Created** | 2026-01-17 |

## Description

When an AI-enhanced scan completes processing and the results are imported into the system, the Scan Coverage Card continues to display "57%" with "Standard" sublabel instead of updating to "75-85%" with "AI-enhanced" sublabel.

### Expected Behavior
- After AI scan results are imported/completed:
  - Detection Coverage should show "75-85%"
  - Sublabel should change from "Standard" to "AI-enhanced"
  - Coverage disclaimer should show the AI-enhanced message
  - The coverage card styling should use purple theme (AI-enhanced)

### Actual Behavior
- After AI scan import:
  - Detection Coverage still shows "57%"
  - Sublabel remains "Standard"
  - Coverage disclaimer shows the processing message or standard message
  - The coverage card uses amber theme (standard scan)

## Steps to Reproduce

1. Navigate to the homepage
2. Enter a URL (e.g., `https://httpbin.org/html`)
3. Enable "AI-Powered Analysis" checkbox
4. Enter email and accept consent
5. Submit the scan
6. Wait for AI processing to complete (or import results via admin)
7. View the scan results page
8. Observe the Scan Coverage Card - it still shows 57% instead of 75-85%

## Environment

- **Application**: ADAShield Web App
- **URL**: http://localhost:3000 (dev) / https://adashield.dev (prod)
- **Browser**: All browsers
- **Related Feature**: Enhanced Trust Indicators (Spec)

## Technical Context

### Related Files (Likely)
- `apps/web/src/components/features/compliance/ScanCoverageCard.tsx`
- `apps/web/src/components/features/compliance/CoveragePercentageMetric.tsx`
- `apps/web/src/components/features/compliance/CoverageDisclaimer.tsx`
- `apps/web/src/hooks/useAiScanStatus.ts`
- `apps/api/src/modules/scans/scan.service.ts` (AI result import)

### Expected Data Flow
1. AI scan completes processing
2. Results are imported into the scan record
3. `coverage.isAiEnhanced` should be set to `true`
4. Frontend receives updated coverage data
5. ScanCoverageCard renders with AI-enhanced values

### Suspected Issue Areas
1. API not updating `coverage.isAiEnhanced` flag when AI results are imported
2. Frontend not re-fetching coverage data after AI status changes
3. Coverage calculation logic not accounting for AI enhancement
4. Data transformation losing the `isAiEnhanced` flag

## Screenshots

- Screenshot of AI scan showing 57% after processing: `ai-scan-processing.png` (captured during testing)

## Related Specification

- `.claude/specs/enhanced-trust-indicators/` - The feature specification for coverage display

## Notes

- This bug was discovered during Playwright testing of the Enhanced Trust Indicators feature
- The standard scan correctly shows 57%, but AI-enhanced scans should show 75-85%
- The message "AI enhancement is being processed. Coverage will improve to 75-85% when complete." appears during processing, but the actual update never happens
