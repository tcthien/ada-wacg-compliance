# Requirements Document: Criteria Detail Popup

## Introduction

This feature adds a detail popup modal to the Criteria Coverage table in the scan detail page. When users click on any row in the criteria table, a modal dialog displays comprehensive information about the selected WCAG criterion including its description, current verification status, scanner source, related issues (if any), and AI reasoning (if available).

Currently, row clicks on failed criteria navigate to the issues tab with a filter. This feature expands that interaction to provide immediate, contextual information for ALL criteria statuses without leaving the coverage view.

## Alignment with Product Vision

This feature supports the product vision of providing **honest, transparent testing results**:
- Users can quickly understand what each criterion means and why it passed/failed
- Shows the specific scanner that detected the issue (axe-core, AI, or both)
- Displays AI reasoning when available, building trust in automated decisions
- Reduces navigation friction by showing details in-place rather than tab switching

## Requirements

### Requirement 1: Clickable Criteria Rows

**User Story:** As a user viewing the criteria coverage table, I want to be able to click on any criteria row, so that I can see detailed information about that criterion without navigating away.

#### Acceptance Criteria

1. WHEN user clicks on any row in the CriteriaTable THEN the system SHALL open a detail popup dialog
2. WHEN user clicks on a row THEN the row SHALL show a visual hover indicator (cursor change, background highlight)
3. IF the row status is FAIL or AI_VERIFIED_FAIL THEN the popup SHALL include a link to view related issues
4. WHEN the popup is open THEN user SHALL be able to close it via close button, Escape key, or clicking outside

### Requirement 2: Display Criterion Information

**User Story:** As a user, I want to see comprehensive WCAG criterion information in the popup, so that I understand what is being tested and why it matters.

#### Acceptance Criteria

1. WHEN popup opens THEN the system SHALL display the criterion ID (e.g., "1.4.3")
2. WHEN popup opens THEN the system SHALL display the criterion title (e.g., "Contrast (Minimum)")
3. WHEN popup opens THEN the system SHALL display the WCAG level badge (A, AA, or AAA)
4. WHEN popup opens THEN the system SHALL display the full criterion description
5. IF WCAG criterion data is not available THEN the system SHALL display "Unknown Criterion" gracefully

### Requirement 3: Display Verification Status Details

**User Story:** As a user, I want to see detailed verification status information, so that I understand how this criterion was tested and the result.

#### Acceptance Criteria

1. WHEN popup opens THEN the system SHALL display the verification status with appropriate styling (PASS, FAIL, AI_VERIFIED_PASS, AI_VERIFIED_FAIL, NOT_TESTED)
2. WHEN popup opens THEN the system SHALL display the scanner source that performed the test (axe-core, AI, axe-core + AI, N/A)
3. IF status is FAIL or AI_VERIFIED_FAIL AND issueIds exist THEN the system SHALL display the count of related issues
4. IF status is AI_VERIFIED_PASS or AI_VERIFIED_FAIL AND confidence exists THEN the system SHALL display the AI confidence percentage
5. IF status is AI_VERIFIED_PASS or AI_VERIFIED_FAIL AND reasoning exists THEN the system SHALL display the AI reasoning explanation

### Requirement 4: Navigation to Related Issues

**User Story:** As a user viewing a failed criterion, I want to quickly navigate to the related issues, so that I can understand and fix the problems.

#### Acceptance Criteria

1. IF status is FAIL or AI_VERIFIED_FAIL THEN the popup SHALL display a "View Issues" button
2. WHEN user clicks "View Issues" THEN the system SHALL close the popup AND navigate to the issues tab with the criterion filter applied
3. IF no related issues exist for a failed criterion THEN the button SHALL be disabled or hidden

## Non-Functional Requirements

### Performance
- Popup SHALL open within 100ms of user click
- No additional API calls required - all data already available in CriteriaVerification object

### Accessibility
- Dialog SHALL be keyboard accessible (focus trap, Escape to close)
- Dialog SHALL have proper ARIA attributes (role="dialog", aria-modal, aria-labelledby)
- Focus SHALL return to the triggering row when dialog closes

### Usability
- Popup content SHALL be readable on mobile devices (responsive design)
- Close button SHALL be clearly visible and easily clickable
- Status badges SHALL use consistent styling with the criteria table

### Maintainability
- Component SHALL be reusable for both customer and admin views
- Component SHALL leverage existing UI components (Dialog, Badge, etc.)
