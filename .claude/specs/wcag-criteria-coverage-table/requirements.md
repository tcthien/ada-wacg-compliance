# Requirements Document: WCAG Criteria Coverage Table

## Introduction

This feature adds a comprehensive WCAG criteria coverage table to the scan detail UI (both customer and admin views). Currently, users only see issues (failures) found during scanning. This enhancement will display **all WCAG criteria** with their verification status, providing transparency into what was tested, what passed, and what couldn't be automated.

Additionally, this feature extends the AI scan tool to verify additional WCAG criteria beyond axe-core's capabilities, actually increasing the "Criteria Checked" count when AI analysis is completed.

## Alignment with Product Vision

This feature directly supports ADAShield's core positioning of **honest, transparent testing**:

1. **Transparency**: Shows users exactly which criteria were checked vs. not testable
2. **Trust Building**: Displays pass/fail status for all criteria, not just failures
3. **AI Value Demonstration**: Clearly shows which criteria AI verified vs. axe-core
4. **Honest Positioning**: Acknowledges automation limitations while highlighting AI's added value

From product.md:
> "We are transparent about what automation CAN and CANNOT do."

This table makes that transparency actionable and visible to users.

## Requirements

### Requirement 1: Tabbed Interface for Scan Results

**User Story:** As a user viewing scan results, I want to switch between Issues and Criteria Coverage views, so that I can see both problems found and overall compliance status.

#### Acceptance Criteria

1. WHEN a user views scan detail page THEN the system SHALL display two tabs: "Issues" and "Criteria Coverage"
2. WHEN user clicks "Issues" tab THEN the system SHALL display the current issue list view
3. WHEN user clicks "Criteria Coverage" tab THEN the system SHALL display the criteria coverage table
4. IF scan is still in progress THEN the system SHALL disable the Criteria Coverage tab until scan completes
5. WHEN user navigates away and returns THEN the system SHALL preserve their last selected tab

### Requirement 2: Criteria Coverage Table Display

**User Story:** As a user, I want to see all WCAG criteria for my conformance level in a table format, so that I understand exactly what was checked and its status.

#### Acceptance Criteria

1. WHEN Criteria Coverage tab is selected THEN the system SHALL display a table with columns: ID, Name, Description, Status, Scanner
2. WHEN scan targets WCAG AA THEN the system SHALL display all 50 criteria (30 Level A + 20 Level AA)
3. WHEN scan targets WCAG A THEN the system SHALL display all 30 Level A criteria
4. WHEN scan targets WCAG AAA THEN the system SHALL display all 78 criteria
5. WHEN a criterion has issues THEN the system SHALL display status as "Fail" with issue count and link to Issues tab
6. WHEN a criterion passed checks THEN the system SHALL display status as "Pass"
7. WHEN a criterion was verified by AI THEN the system SHALL display status as "AI Verified" with appropriate badge
8. WHEN a criterion cannot be tested by automation THEN the system SHALL display status as "Not Tested" with explanation tooltip

### Requirement 3: Scanner Source Attribution

**User Story:** As a user, I want to know which tool verified each criterion, so that I understand the source and reliability of the verification.

#### Acceptance Criteria

1. WHEN criterion was tested by axe-core THEN the system SHALL display "axe-core" in Scanner column
2. WHEN criterion was verified by AI analysis THEN the system SHALL display the AI model name (e.g., "claude-opus-4")
3. WHEN criterion cannot be tested by automation THEN the system SHALL display "N/A" in Scanner column
4. WHEN both axe-core and AI tested a criterion THEN the system SHALL display "axe-core + AI" with priority to AI status

### Requirement 4: Issue Linking from Criteria Table

**User Story:** As a user viewing a failed criterion, I want to quickly see the related issues, so that I can understand what needs to be fixed.

#### Acceptance Criteria

1. WHEN a criterion has status "Fail" THEN the system SHALL display the issue count (e.g., "Fail (3 issues)")
2. WHEN user clicks on a failed criterion row THEN the system SHALL switch to Issues tab and filter to show only issues for that criterion
3. WHEN user clicks issue count link THEN the system SHALL navigate to Issues tab filtered by that WCAG criterion
4. IF criterion has no issues THEN the system SHALL NOT display issue count

### Requirement 5: AI Scan Tool Enhancement for Criteria Verification

**User Story:** As a system administrator, I want the AI scan to verify additional WCAG criteria beyond axe-core, so that users get higher criteria coverage with AI-enhanced scans.

#### Acceptance Criteria

1. WHEN AI scan processes a page THEN the system SHALL analyze for criteria not testable by axe-core
2. WHEN AI verifies a criterion passes THEN the system SHALL record it with status "AI_VERIFIED_PASS"
3. WHEN AI identifies a potential issue for untestable criterion THEN the system SHALL record it with status "AI_VERIFIED_FAIL" and create an issue
4. WHEN AI cannot determine criterion status THEN the system SHALL leave status as "NOT_TESTED"
5. WHEN AI scan completes THEN the system SHALL update criteriaChecked count to include AI-verified criteria

### Requirement 6: Criteria Verification Data Storage

**User Story:** As the system, I need to store per-criterion verification status, so that the coverage table can display accurate data.

#### Acceptance Criteria

1. WHEN scan completes THEN the system SHALL store verification status for each applicable WCAG criterion
2. WHEN storing criterion verification THEN the system SHALL include: criterionId, status, scanner, issueIds (if any)
3. WHEN API returns scan results THEN the system SHALL include criteriaVerifications array in response
4. IF criteriaVerifications is empty THEN the system SHALL compute it from issues and passed checks (backward compatibility)

### Requirement 7: Table Filtering and Sorting

**User Story:** As a user viewing the criteria table, I want to filter and sort the data, so that I can focus on specific criteria or statuses.

#### Acceptance Criteria

1. WHEN user clicks Status column header THEN the system SHALL sort table by status (Fail first, then Not Tested, then Pass)
2. WHEN user clicks ID column header THEN the system SHALL sort table by criterion ID numerically
3. WHEN user selects status filter THEN the system SHALL show only criteria matching that status
4. WHEN user selects WCAG level filter THEN the system SHALL show only criteria of that level (A, AA)
5. WHEN filters are applied THEN the system SHALL display filter count (e.g., "Showing 12 of 50 criteria")

### Requirement 8: Admin View Enhancement

**User Story:** As an admin viewing scan details, I want to see the same criteria coverage table with additional admin context, so that I can diagnose issues and verify AI performance.

#### Acceptance Criteria

1. WHEN admin views scan detail THEN the system SHALL display the same tabbed interface as customer view
2. WHEN admin views criteria table THEN the system SHALL additionally show confidence score for AI-verified criteria
3. WHEN admin clicks on AI-verified criterion THEN the system SHALL show AI analysis reasoning (if available)
4. WHEN admin exports scan report THEN the system SHALL include criteria coverage table data

### Requirement 9: Scan Coverage Card Statistics Update

**User Story:** As a user viewing scan results, I want the "Scan Coverage" section to display accurate statistics computed from actual criteria verifications, so that the numbers are consistent and trustworthy.

#### Acceptance Criteria

1. WHEN scan results are displayed THEN the "Criteria Checked" count SHALL equal the sum of criteria with status Pass + Fail + AI_VERIFIED_PASS + AI_VERIFIED_FAIL
2. WHEN scan results are displayed THEN the breakdown SHALL show:
   - "Criteria with Issues" = count of criteria with status Fail or AI_VERIFIED_FAIL
   - "Criteria Passed" = count of criteria with status Pass or AI_VERIFIED_PASS
   - "Not Testable" = count of criteria with status NOT_TESTED
3. WHEN AI scan completes successfully THEN the "Criteria Checked" count SHALL increase to include AI-verified criteria
4. WHEN user views Scan Coverage card AND Criteria Coverage table THEN the statistics SHALL be consistent (same counts)
5. WHEN standard scan completes (no AI) THEN the system SHALL compute criteria checked from axe-core passed rules mapping
6. WHEN AI scan completes THEN the system SHALL compute criteria checked from both axe-core mapping AND AI verifications (no double counting)
7. IF a criterion is verified by both axe-core and AI THEN the system SHALL count it once with AI taking precedence for status

### Requirement 10: Coverage Percentage Accuracy

**User Story:** As a user, I want the "Detection Coverage" percentage to accurately reflect what was actually tested, so that I understand the true coverage of my scan.

#### Acceptance Criteria

1. WHEN displaying Detection Coverage THEN the system SHALL calculate: (criteriaChecked / criteriaTotal) * 100
2. WHEN standard scan completes THEN the coverage percentage SHALL reflect axe-core's actual coverage (not fixed 57%)
3. WHEN AI scan completes THEN the coverage percentage SHALL reflect combined axe-core + AI coverage
4. WHEN coverage is displayed THEN the system SHALL show the actual percentage (e.g., "36%" for 18/50) not the theoretical maximum
5. WHEN AI-enhanced badge is shown THEN the system SHALL display actual achieved coverage, not "75-85%" range

## Non-Functional Requirements

### Performance
- Criteria table SHALL render within 500ms for 78 criteria (AAA level)
- Table sorting and filtering SHALL complete within 100ms
- API response with criteriaVerifications SHALL not increase response time by more than 200ms

### Security
- Criteria verification data SHALL follow same access controls as scan results
- AI analysis reasoning SHALL only be visible to authenticated admins

### Reliability
- System SHALL gracefully degrade if criteriaVerifications is unavailable (compute from issues)
- Table SHALL display loading state while data is being fetched

### Usability
- Table SHALL be responsive and usable on mobile devices (collapsible columns)
- Status colors SHALL meet WCAG AA contrast requirements
- Table SHALL support keyboard navigation for accessibility
- Screen readers SHALL announce criterion status changes

### Compatibility
- Feature SHALL work with existing scans (backward compatible)
- New data fields SHALL be optional in API responses

---

**Created**: 2026-01-18
**Status**: Draft - Pending Approval
