# Requirements Document: Axe-Core Criteria Mapping

## Introduction

This feature addresses a critical gap in the accessibility scanning workflow where axe-core's passed rule data is discarded, preventing accurate criteria-level coverage reporting. Currently, only the count of passed checks (e.g., "45 passed") is stored, not which specific rules passed. This makes it impossible to map axe-core results to WCAG criteria in the criteria table, causing user confusion when the "45 passed" number doesn't match the criteria breakdown.

The feature will store axe-core passed rule IDs and map them to WCAG criteria, enabling the criteria table to show which criteria were tested by axe-core (PASS/FAIL) alongside AI verification results.

## Alignment with Product Vision

This feature directly supports ADAShield's core principle of **transparency and honest positioning**:

> "We are transparent about what automation CAN and CANNOT do."

By accurately showing:
- Which WCAG criteria axe-core actually tested (not estimates)
- Which criteria passed vs failed at the automation level
- How AI verification enhances the baseline axe-core results

This also supports the **trust indicator** feature by providing accurate coverage statistics that users can verify against the detailed criteria table.

## Requirements

### Requirement 1: Store Axe-Core Passed Rule IDs

**User Story:** As a system administrator, I want axe-core's passed rule IDs to be stored during scan processing, so that we can accurately map which WCAG criteria were tested and passed.

#### Acceptance Criteria

1. WHEN a scan completes successfully THEN the system SHALL store the list of axe-core rule IDs that passed (from `axeResults.passes[].id`)
2. WHEN storing passed rule IDs THEN the system SHALL preserve the total count in `passedChecks` field (existing behavior)
3. IF a scan has no passes (edge case) THEN the system SHALL store an empty array, not null
4. WHEN migrating existing data THEN the system SHALL NOT break existing scans that lack passed rule data

**Note:** Per-rule node counts are not stored as they don't affect criteria-level verification status. The aggregate `passedChecks` count is preserved for reference.

### Requirement 2: Map Passed Rules to WCAG Criteria

**User Story:** As a developer, I want passed axe-core rules to be automatically mapped to WCAG criteria using the existing AXE_RULE_TO_WCAG constant, so that criteria verifications can be built accurately.

#### Acceptance Criteria

1. WHEN building criteria verifications THEN the system SHALL use actual passed rule IDs (not estimated counts) to determine which criteria have PASS status
2. WHEN a rule maps to multiple WCAG criteria THEN the system SHALL mark all mapped criteria as PASS
3. IF a criterion has both a passing rule AND a failing issue THEN the system SHALL mark it as FAIL (failure takes precedence)
4. WHEN AI verification exists for a criterion THEN AI status SHALL take precedence over axe-core status (AI_VERIFIED_PASS/FAIL overrides PASS/FAIL)

### Requirement 3: Display Axe-Core Results in Criteria Table

**User Story:** As a user viewing scan results, I want the criteria table to show which criteria were tested by axe-core with their pass/fail status, so that I can understand what automated testing actually covered.

#### Acceptance Criteria

1. WHEN displaying criteria verifications THEN the system SHALL show status as PASS for criteria where axe-core rules passed
2. WHEN displaying criteria verifications THEN the system SHALL show status as FAIL for criteria with issues from axe-core
3. WHEN displaying a criterion with both axe-core and AI results THEN the scanner field SHALL show "axe-core + AI"
4. WHEN a criterion has no axe-core or AI data THEN the system SHALL show status as NOT_TESTED with scanner "N/A"

### Requirement 4: Align Summary Statistics with Criteria Table

**User Story:** As a user, I want the "Passed" count in the Summary section to reflect meaningful criteria-level data, so that the numbers make sense when compared to the criteria table.

#### Acceptance Criteria

1. WHEN displaying the Summary section THEN the system SHALL show criteria-level "passed" count (PASS + AI_VERIFIED_PASS), not axe-core rule count
2. IF legacy display of axe-core rule count is needed THEN it SHALL be clearly labeled as "Axe-core Checks Passed" to differentiate from criteria
3. WHEN displaying Scan Coverage breakdown THEN the numbers SHALL exactly match the counts derivable from the criteria table

### Requirement 5: Backward Compatibility

**User Story:** As a system administrator, I want existing scans without passed rule data to continue working, so that historical data remains accessible.

#### Acceptance Criteria

1. WHEN loading a scan without stored passed rule IDs THEN the system SHALL fall back to the existing estimation method
2. WHEN API returns criteria verifications THEN it SHALL work identically for old and new scans (same response structure)
3. IF migration is needed THEN it SHALL be optional and not block application startup

## Non-Functional Requirements

### Performance
- Storing passed rule IDs SHALL NOT increase scan processing time by more than 5%
- The additional database storage per scan SHALL NOT exceed 50KB (typical scans have <100 passed rules)
- Criteria verification calculation SHALL complete within 100ms for typical scans

### Data Integrity
- Passed rule data SHALL be stored atomically with the scan result (same transaction)
- The system SHALL validate rule IDs against the known AXE_RULE_TO_WCAG mapping

### Reliability
- If passed rule storage fails, the scan SHALL still complete with just the count (graceful degradation)
- The system SHALL log warnings when falling back to estimation mode

### Usability
- Users SHALL NOT need to take any action to benefit from improved accuracy
- The criteria table UI SHALL NOT require changes to support new data (same component, better data)
