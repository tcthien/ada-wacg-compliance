# Requirements Document: Enhanced Trust Indicators

## Introduction

This feature enhances the trust and confidence indicators displayed in scan results to provide users with clearer, more accurate information about scan coverage and reliability. Currently, the UI displays a static "57%" detection rate for all scans, which doesn't reflect the enhanced coverage provided by AI scanning. Additionally, users lack visibility into how many WCAG success criteria were actually tested.

**Key improvements:**
1. **Differentiated coverage percentages**: Show 57% for standard scans and 75-85% for AI-enhanced scans
2. **Criteria coverage metrics**: Display how many WCAG criteria were tested vs. total applicable criteria
3. **Enhanced credibility indicators**: Help users understand the completeness and reliability of their scan results

## Alignment with Product Vision

This feature directly supports ADAShield's core product principle of **"Honesty Over Hype"** as documented in product.md:

> "We never claim 100% automated compliance. We clearly communicate:
> - What we CAN detect automatically (~57% with axe-core, ~75-85% with AI)
> - What REQUIRES human review"

Additionally, it supports the **"Actionable Results"** principle by helping users understand the confidence level of their scan results and what additional steps may be needed.

**Business Impact:**
- Increases perceived value of AI-enhanced scans by clearly showing the improvement
- Builds trust through transparency about testing coverage
- Helps justify upgrade from free to paid tiers (Pro tier includes AI enhancement)

## Requirements

### Requirement 1: Differentiated Detection Coverage Display

**User Story:** As a user viewing scan results, I want to see an accurate detection percentage based on whether AI enhancement was used, so that I understand the true coverage of my scan.

#### Acceptance Criteria

1. WHEN a standard scan (without AI) result is displayed THEN the system SHALL show "Automated testing detects approximately **57%** of WCAG issues"

2. WHEN an AI-enhanced scan result is displayed AND the AI status is COMPLETED THEN the system SHALL show "AI-enhanced testing detects approximately **75-85%** of WCAG issues"

3. WHEN an AI-enhanced scan result is displayed AND the AI status is PENDING, DOWNLOADED, or PROCESSING THEN the system SHALL show "Automated testing detects approximately **57%** of WCAG issues" with a note that AI enhancement will improve coverage

4. IF the AI-enhanced scan has FAILED status THEN the system SHALL show "Automated testing detects approximately **57%** of WCAG issues" with a note that AI enhancement was not applied

5. WHEN displaying enhanced coverage THEN the system SHALL use a visually distinct style (purple/AI theme) to differentiate from standard scan coverage

### Requirement 2: WCAG Criteria Coverage Metrics

**User Story:** As a user viewing scan results, I want to see how many WCAG criteria were tested out of the total applicable criteria, so that I can understand the breadth of the compliance check.

#### Acceptance Criteria

1. WHEN scan results are displayed THEN the system SHALL show the count of WCAG criteria that were checked (passed + failed + inapplicable)

2. WHEN displaying criteria coverage THEN the system SHALL show the format: "X of Y criteria checked" where:
   - X = number of unique WCAG criteria covered by axe-core rules that were tested
   - Y = total WCAG criteria for the selected conformance level (A, AA, or AAA)

3. WHEN the scan level is A THEN the system SHALL calculate Y based on WCAG 2.1 Level A criteria count (30 criteria)

4. WHEN the scan level is AA THEN the system SHALL calculate Y based on WCAG 2.1 Level A + AA criteria count (50 criteria)

5. WHEN the scan level is AAA THEN the system SHALL calculate Y based on all WCAG 2.1 criteria count (78 criteria)

6. WHEN hover/tooltip is activated on the criteria count THEN the system SHALL display a breakdown showing:
   - Criteria with issues found
   - Criteria that passed
   - Criteria that were not testable by automation

### Requirement 3: Trust Summary Card

**User Story:** As a user viewing scan results, I want to see a clear summary of the scan's reliability and completeness, so that I can confidently use the results for compliance decisions.

#### Acceptance Criteria

1. WHEN scan results are displayed THEN the system SHALL show a "Scan Coverage" or "Trust Summary" card prominently in the results

2. WHEN displaying the trust summary THEN the system SHALL include:
   - Detection coverage percentage (57% or 75-85%)
   - Criteria coverage count (X of Y)
   - Passed checks count
   - Scan type indicator (Standard vs AI-Enhanced)

3. IF the scan is AI-enhanced with COMPLETED status THEN the system SHALL display an "AI-Enhanced" badge with the Sparkles icon

4. WHEN displaying the trust summary THEN the system SHALL include a link or expandable section explaining what the percentages mean

### Requirement 4: API Response Enhancement

**User Story:** As a developer integrating with the API, I want scan results to include coverage metadata, so that I can display accurate trust indicators in my application.

#### Acceptance Criteria

1. WHEN the scan result API returns data THEN the response SHALL include:
   - `coveragePercentage`: number (57 for standard, 75-85 for AI-enhanced)
   - `criteriaChecked`: number
   - `criteriaTotal`: number
   - `isAiEnhanced`: boolean

2. WHEN calculating `criteriaChecked` THEN the system SHALL count unique WCAG criteria from:
   - All passed checks (mapped from axe-core rules)
   - All failed checks (issues with wcagCriteria)
   - Inapplicable checks (when available)

3. WHEN the scan has `aiEnabled: true` AND `aiStatus: COMPLETED` THEN `isAiEnhanced` SHALL be true and `coveragePercentage` SHALL be 80 (midpoint of 75-85 range)

### Requirement 5: Batch Scan Coverage Summary

**User Story:** As a user viewing batch scan results, I want to see aggregated coverage information across all scanned URLs, so that I understand the overall compliance check coverage.

#### Acceptance Criteria

1. WHEN batch scan results are displayed THEN the system SHALL show an aggregated coverage summary

2. WHEN displaying batch coverage THEN the system SHALL show:
   - Average or consistent coverage percentage across scans
   - Total unique criteria checked across all URLs
   - Count of AI-enhanced vs standard scans in the batch

## Non-Functional Requirements

### Performance
- Coverage calculations SHALL complete within 100ms for single scans
- Coverage calculations for batch scans (up to 100 URLs) SHALL complete within 500ms
- API response size SHALL not increase by more than 1KB with added coverage fields

### Usability
- Coverage indicators SHALL be visible without scrolling on desktop views
- Tooltips SHALL be accessible via keyboard navigation
- Color contrast for coverage indicators SHALL meet WCAG AA requirements

### Accuracy
- WCAG criteria counts SHALL be based on the official WCAG 2.1 specification
- Coverage percentages SHALL match documented product claims (57% / 75-85%)
- Criteria mapping SHALL use the existing `WCAG_CRITERIA` and `AXE_RULE_TO_WCAG` constants

### Accessibility
- All new components SHALL pass axe-core accessibility testing
- Percentage and count information SHALL have appropriate ARIA labels
- Visual indicators SHALL have text alternatives for screen readers

## Out of Scope

- Real-time calculation of actual detection accuracy (would require ground truth data)
- Per-page criteria breakdown for batch scans
- Historical comparison of coverage across multiple scans
- Custom WCAG version selection (currently fixed to WCAG 2.1)
