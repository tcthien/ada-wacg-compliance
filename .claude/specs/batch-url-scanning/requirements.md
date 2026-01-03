# Requirements Document: Batch URL Scanning

## Introduction

This feature enables users to scan multiple URLs in a single operation, providing batch processing capabilities for accessibility testing. Currently, users can discover and select multiple pages from a website, but only the first URL is scanned. This feature completes the multi-page scanning workflow by enabling batch submission, parallel processing, and aggregated results display.

## Alignment with Product Vision

### Product Goals (from product.md)
- **Multi-Page Scanning** is listed as a Phase 2 feature: "Select pages via UI, batch scanning" for "Comprehensive coverage"
- Supports the **E-commerce Owner** persona who needs to scan entire sites for ADA compliance
- Enables **Agencies** to efficiently audit client sites with multiple pages
- Aligns with positioning as an honest testing tool that can cover entire websites

### Competitive Positioning
- Batch scanning enables comprehensive site coverage that free tools (WAVE, Lighthouse) cannot provide
- Batch reports will include transparency disclaimer: "Automated testing detects approximately 57% of WCAG issues. Manual review recommended for comprehensive compliance."

### Key Business Value
- Reduces time to scan a complete website from manual sequential scans
- Enables comprehensive site-wide accessibility audits
- Leverages existing discovery feature investment
- Competitive differentiator vs. free tools that only scan single pages

## Constraints

- All URLs in a batch MUST belong to the same domain (inherited from discovery feature)
- Maximum 1 active batch per guest session at any time
- Batch history retained for 90 days, then automatically purged
- Maximum 50 URLs per batch, maximum 100 URLs per hour per session

## Requirements

### Requirement 1: Batch Scan Creation

**User Story:** As a website owner, I want to submit multiple URLs for scanning at once, so that I can test my entire website efficiently without submitting URLs one by one.

#### Acceptance Criteria

1.1. WHEN a user has selected multiple URLs from discovery AND clicks "Start Scan" THEN the system SHALL create a batch containing individual scans for each URL

1.2. WHEN creating a batch scan THEN the system SHALL validate all URLs before starting any scans

1.3. IF any URL fails validation THEN the system SHALL reject the entire batch with a clear error indicating which URLs are invalid

1.4. WHEN a batch is created THEN the system SHALL return a batch ID that can be used to track overall progress

1.5. WHEN a batch is created THEN the system SHALL queue all scan jobs for parallel processing

1.6. IF a user provides 1 URL THEN the system SHALL treat it as a single scan (backward compatible)

1.7. WHEN creating a batch THEN the system SHALL limit the maximum URLs to 50 per batch

1.8. IF a user submits more than 50 URLs in a batch THEN the system SHALL reject the request with error "Batch size limit exceeded (maximum 50 URLs)"

1.9. IF a user has exceeded the hourly rate limit (100 URLs/hour) THEN the system SHALL reject the batch with a clear rate limit error

### Requirement 2: Batch Progress Tracking

**User Story:** As a website owner, I want to see the progress of my batch scan, so that I know how many pages have been scanned and how long it will take to complete.

#### Acceptance Criteria

2.1. WHEN a batch scan is running THEN the system SHALL display overall progress (e.g., "5 of 10 URLs scanned")

2.2. WHEN a batch scan is running THEN the system SHALL show the status of each individual URL (pending/running/completed/failed)

2.3. WHEN an individual scan in a batch fails THEN the system SHALL continue scanning other URLs and mark the failed one appropriately

2.4. WHEN a batch scan is running THEN the system SHALL poll for progress updates via GET /api/v1/batches/{id} every 2 seconds (client-side polling)

2.5. WHEN all scans in a batch complete THEN the system SHALL update the batch status to "completed"

2.6. IF all scans in a batch fail THEN the system SHALL mark the batch as "failed" with a summary of errors

2.7. WHEN viewing batch progress AND some scans are still running THEN the system SHALL display partial results with a clear indicator that results are incomplete

### Requirement 3: Batch Results Display

**User Story:** As a website owner, I want to see aggregated results across all scanned URLs, so that I can understand the overall accessibility health of my website.

#### Acceptance Criteria

3.1. WHEN a batch scan completes THEN the system SHALL display a summary showing total issues across all URLs

3.2. WHEN viewing batch results THEN the system SHALL display issues grouped by axe-core impact level (critical/serious/moderate/minor) with counts aggregated across all URLs

3.3. WHEN viewing batch results THEN the system SHALL allow users to filter and view results for individual URLs

3.4. WHEN viewing batch results THEN the system SHALL highlight the top 5 URLs with the highest critical issue count

3.5. WHEN viewing batch results THEN the system SHALL show a per-URL breakdown with issue counts (critical, serious, moderate, minor, total)

3.6. WHEN a URL in a batch fails THEN the system SHALL clearly indicate the failure status and error message in the results view

3.7. WHEN viewing batch results THEN the aggregate statistics SHALL include: total issues, critical count, serious count, moderate count, minor count, passed checks, and URLs scanned

### Requirement 4: Batch Export

**User Story:** As a website owner, I want to export results for all scanned URLs in a single report, so that I can share comprehensive audit results with stakeholders.

#### Acceptance Criteria

4.1. WHEN viewing batch results THEN the system SHALL provide an option to export all results as a single PDF

4.2. WHEN exporting batch results as PDF THEN the report SHALL include a summary section with aggregate statistics (total issues, issues by impact level, URLs scanned)

4.3. WHEN exporting batch results as PDF THEN the report SHALL include a per-URL breakdown of issues

4.4. WHEN viewing batch results THEN the system SHALL provide an option to export results as JSON for programmatic analysis

4.5. WHEN exporting batch results THEN the system SHALL include metadata: batch ID, scan date, WCAG level, homepage URL, and total URLs scanned

4.6. WHEN exporting batch results as PDF THEN the report SHALL include the transparency disclaimer about automated testing limitations

### Requirement 5: Batch History and Management

**User Story:** As a website owner, I want to view my past batch scans, so that I can track accessibility improvements over time and re-run scans as needed.

#### Acceptance Criteria

5.1. WHEN viewing scan history THEN the system SHALL display batches as grouped entries (not individual scans)

5.2. WHEN viewing scan history THEN the system SHALL display batch-level summary: homepage URL, total URLs, overall status, aggregate issue count, and scan date

5.3. WHEN clicking on a past batch THEN the system SHALL navigate to the detailed batch results view

5.4. IF a batch scan was created from discovery THEN the system SHALL display the discovery homepage URL in the history

5.5. WHEN a batch scan exceeds 24 hours without completion THEN the system SHALL mark it as "stale" and display a warning to the user

### Requirement 6: Integration with Discovery

**User Story:** As a website owner, I want the discovered pages to seamlessly flow into batch scanning, so that I can reduce audit setup time by eliminating manual URL entry.

#### Acceptance Criteria

6.1. WHEN a user selects multiple pages from discovery AND clicks "Start Scan" THEN the system SHALL initiate a batch scan with all selected URLs

6.2. WHEN batch scan is initiated from discovery THEN the UI SHALL display: "Starting batch scan for X pages from {homepage}"

6.3. IF the user cancels the batch creation THEN the selected pages SHALL remain in the discovery state for retry

6.4. WHEN a batch scan starts from discovery THEN the system SHALL store the discovery ID in batch metadata for traceability

6.5. WHEN displaying batch results THEN the system SHALL show page titles from discovery (if available) alongside URLs

### Requirement 7: Batch Scan Cancellation

**User Story:** As a website owner, I want to cancel a running batch scan, so that I can stop processing if I realize I selected wrong URLs or need to modify my selection.

#### Acceptance Criteria

7.1. WHEN viewing a running batch THEN the system SHALL display a "Cancel Batch" button

7.2. WHEN a user clicks "Cancel Batch" THEN the system SHALL stop queuing new scans and cancel all pending scans

7.3. WHEN a batch is cancelled THEN the system SHALL preserve all completed scan results

7.4. WHEN a batch is cancelled THEN the system SHALL update the batch status to "cancelled" with cancellation timestamp

7.5. WHEN a batch is cancelled THEN the system SHALL display a summary: "Batch cancelled. X of Y scans completed before cancellation."

## Non-Functional Requirements

### Performance

- Individual scan execution time SHALL remain < 30 seconds per URL
- Batch submission API response SHALL return within 2 seconds regardless of batch size
- Progress polling endpoint SHALL respond within 200ms
- System SHALL support at least 100 concurrent batch operations across all users
- System SHALL process batch URLs in parallel (5-10 concurrent scans per batch, based on available resources)

### Security

- Batch scan creation SHALL validate reCAPTCHA to prevent abuse
- All URLs in a batch SHALL pass SSRF protection checks
- Rate limiting SHALL apply per session: maximum 2 batches per hour OR 100 total URLs per hour (whichever limit is reached first)
- Batch operations SHALL respect the same session-based authentication as single scans
- Batch export SHALL sanitize all HTML content to prevent XSS in PDF/JSON outputs

### Reliability

- Individual scan failures SHALL NOT cause the entire batch to fail
- Batch state SHALL be persisted to PostgreSQL database for recovery after service restart
- Failed scans within a batch SHALL be retryable individually (future enhancement)
- Batch progress SHALL be accurately tracked even if some scans timeout

### Usability

- Batch progress SHALL be clearly communicated with visual indicators (progress bar, URL status list)
- Error messages SHALL specifically indicate which URLs failed and why
- Users SHALL be able to cancel a running batch (pending scans cancelled, completed scans retained)
- Results SHALL be navigable with filtering and search capabilities for large batches

### Accessibility

- Batch progress indicators SHALL include ARIA live regions for screen reader announcements
- Batch status updates SHALL be keyboard navigable
- Color-coded status indicators SHALL include text labels for color-blind users

## Out of Scope

- **Scheduled batch scans** - Automated recurring batch scans are planned for Phase 3
- **Cross-domain batches** - All URLs in a batch must be from the same domain (discovery limitation)
- **Batch remediation suggestions** - AI-powered fix suggestions for batch results are a future enhancement
- **Team collaboration on batches** - Sharing batch results with team members is an enterprise feature
- **Batch comparison** - Comparing results between two batch runs is a future feature
- **Individual scan retry** - Retrying individual failed scans within a batch is a future enhancement

## Dependencies

- **Discovery feature** (completed) - Provides multi-URL selection UI
- **BullMQ job queue** (operational) - Handles parallel job processing
- **PDF report generation** (operational) - Needs enhancement for batch reports
- **Session management** (operational) - Batch scans tied to guest sessions
- **Scan worker** (operational) - Existing worker processes individual scans

## Glossary

- **Batch**: A group of scans submitted together, identified by a unique batch ID
- **Batch Scan**: The parent entity tracking overall batch progress and metadata
- **Individual Scan**: A single URL scan within a batch, processed independently
- **Discovery**: The feature that crawls a website to find all pages for potential scanning
- **Impact Level**: axe-core severity classification: critical, serious, moderate, minor
