# Requirements Document: Admin Batch Management

## Introduction

This feature extends the admin panel to include comprehensive batch scan management capabilities. Currently, the admin interface only displays individual scans without any batch context. When users submit batch scans (multiple URLs in a single operation), administrators cannot see which scans belong to the same batch, view batch-level statistics, or manage batch operations efficiently.

This feature adds a new "Batches" section to the admin panel with dedicated batch listing, batch detail views, batch-level actions, and integration with existing scan management.

## Alignment with Product Vision

### Product Goals (from product.md)
- **Admin Management** is essential for SaaS operation and customer support
- Supports monitoring of batch usage patterns and system health
- Enables administrators to troubleshoot user-reported batch issues
- Aligns with enterprise readiness by providing comprehensive admin tooling

### Key Business Value
- Enables customer support to investigate batch-related issues
- Provides visibility into batch usage patterns for capacity planning
- Allows administrators to manage problematic batches (cancel, retry, delete)
- Completes the admin interface for full scan management coverage

### Gap Analysis
Currently, the admin panel:
- Shows individual scans but NOT batch grouping
- Cannot identify which scans belong to the same batch
- Has no batch-level statistics or filtering
- Cannot perform batch-level operations (cancel all, export all)

## Constraints

### Technical Constraints
- Must use existing JWT-based admin authentication (no new auth mechanism)
- Must follow existing admin UI patterns and components
- Must integrate with existing batch database schema (no schema changes)
- Must work with existing pagination patterns (default 20, max 100)

### Business Constraints
- Admins CANNOT create new batches (user-only operation)
- Admins CANNOT modify batch parameters (URLs, WCAG level) after creation
- Batch delete is a HARD delete - data is not recoverable
- Admin batch operations must be logged to audit trail (retained for 90 days)

### Role-Based Access
- All batch viewing operations require ADMIN or SUPER_ADMIN role
- Batch delete operations require SUPER_ADMIN role
- Batch cancel and retry operations require ADMIN or SUPER_ADMIN role

## Requirements

### Requirement 1: Batch List View

**User Story:** As an administrator, I want to see a list of all batch scans across all users, so that I can monitor batch usage and identify problematic batches.

#### Acceptance Criteria

1.1. WHEN an admin navigates to /admin/batches THEN the system SHALL display a paginated list of all batch scans sorted by creation date (newest first)

1.2. WHEN viewing the batch list THEN each batch entry SHALL display:
- Homepage URL (primary identifier)
- Total URLs in batch
- Completion status (X of Y complete)
- Batch status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, STALE)
- Aggregate issue counts (critical, serious, moderate, minor)
- Creation timestamp
- Session/user identifier (if available)

1.3. WHEN viewing the batch list THEN the system SHALL allow filtering by:
- Status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, STALE)
- Date range (start date, end date)
- Homepage URL (partial match)

1.4. WHEN viewing the batch list THEN the system SHALL support pagination with:
- Default page size of 20 batches
- Maximum page size of 100 batches
- Total count and page navigation

1.5. WHEN clicking on a batch row THEN the system SHALL navigate to the batch detail view

1.6. WHEN viewing the batch list THEN the system SHALL display a summary bar at the top of the table showing:
- Total batches in filtered view
- Total URLs across all filtered batches
- Aggregate issue counts

1.7. IF batch data fetch fails THEN the system SHALL display an error message with retry button: "Failed to load batches. Please try again."

### Requirement 2: Batch Detail View

**User Story:** As an administrator, I want to view detailed information about a specific batch, so that I can understand its composition and troubleshoot issues.

#### Acceptance Criteria

2.1. WHEN an admin navigates to /admin/batches/{id} THEN the system SHALL display comprehensive batch information including:
- Batch ID
- Homepage URL
- WCAG level (A, AA, AAA)
- Total URLs
- Completion counts (completed, failed, pending)
- Aggregate statistics (total issues, issues by impact level, passed checks)
- Creation timestamp
- Completion timestamp (if completed)
- Cancellation timestamp (if cancelled)
- Discovery ID (if created from discovery)

2.2. WHEN viewing batch details THEN the system SHALL display a list of all individual scans within the batch showing:
- URL
- Page title (if available)
- Status (PENDING, RUNNING, COMPLETED, FAILED)
- Issue counts (if completed)
- Error message (if failed)
- Completion time (if completed)

2.3. WHEN viewing batch details THEN the system SHALL allow expanding individual scan rows to see:
- Full error stack trace (for failed scans)
- Issue breakdown by impact level
- Link to individual scan detail page

2.4. WHEN viewing batch details THEN the system SHALL highlight URLs with critical issues using visual indicators

2.5. WHEN viewing batch details THEN the system SHALL display the top 5 URLs with the highest critical issue count in a "Critical Issues" summary card, sorted by critical count descending then by URL alphabetically for ties; if fewer than 5 URLs have critical issues, show only those URLs

2.6. IF batch detail data cannot be loaded THEN the system SHALL display an error page with: batch ID, error message, and "Back to List" button

### Requirement 3: Batch Administrative Actions

**User Story:** As an administrator, I want to perform administrative actions on batches, so that I can manage system resources and support users.

#### Acceptance Criteria

3.1. WHEN viewing a running batch (status = RUNNING or PENDING) THEN the system SHALL display a "Cancel Batch" button

3.2. WHEN an admin clicks "Cancel Batch" THEN the system SHALL:
- Display a confirmation dialog with impact summary (X scans will be cancelled, Y already completed)
- Upon confirmation, cancel all pending and running scans in the batch
- Preserve completed scan results
- Update batch status to CANCELLED
- Log the action to audit trail with admin ID and timestamp

3.3. WHEN viewing any batch THEN the system SHALL display a "Delete Batch" button

3.4. WHEN an admin clicks "Delete Batch" THEN the system SHALL:
- Display a confirmation dialog warning that this action is irreversible
- Display count of scans and results that will be deleted
- Upon confirmation, delete the batch and ALL associated data (scans, results, issues)
- Log the action to audit trail with admin ID and timestamp

3.5. WHEN viewing a completed batch THEN the system SHALL display an "Export" button with options:
- Export as PDF (executive summary report)
- Export as JSON (full data export)
- Export as CSV (issue summary by URL)

3.6. WHEN viewing a batch with failed scans THEN the system SHALL display a "Retry Failed" button that:
- Re-queues all failed scans within the batch
- Updates their status to PENDING
- Logs the action to audit trail
- Note: Retry operations count toward the original user's rate limit; if rate limit exceeded, display error message with remaining cooldown time

3.7. IF any admin action (cancel, delete, export, retry) fails THEN the system SHALL:
- Display a toast notification with specific error message
- Log the failed action attempt to audit trail
- Allow the action to be retried

### Requirement 4: Batch Context in Existing Scan Views

**User Story:** As an administrator, I want to see batch context when viewing individual scans, so that I can understand the scan's relationship to batch operations.

#### Acceptance Criteria

4.1. WHEN viewing the scan list (/admin/scans) THEN scans that belong to a batch SHALL display:
- A "Batch" badge (blue pill-style) next to the URL column
- The batch homepage URL (truncated to 30 chars with ellipsis if longer)
- A clickable link icon that navigates to the parent batch detail view

4.2. WHEN viewing scan details (/admin/scans/{id}) AND the scan belongs to a batch THEN the system SHALL display:
- Batch ID with link to batch detail view
- Position in batch (e.g., "3 of 10")
- Batch homepage URL
- Batch overall status

4.3. WHEN an admin selects the "Batch Filter" dropdown THEN the system SHALL provide options:
- "All Scans" (default, shows all)
- "Batched Only" (batchId IS NOT NULL)
- "Non-Batched Only" (batchId IS NULL)
- "Specific Batch..." (opens batch ID input field)

### Requirement 5: Dashboard Batch Metrics

**User Story:** As an administrator, I want to see batch-related metrics on the admin dashboard, so that I can monitor batch usage patterns.

#### Acceptance Criteria

5.1. WHEN viewing the admin dashboard THEN the system SHALL display batch metrics:
- Total batches today/this week/this month
- Average batch size (URLs per batch)
- Batch completion rate
- Average batch processing time

5.2. WHEN viewing the admin dashboard THEN the system SHALL display a "Recent Batches" widget showing the last 5 batches with:
- Homepage URL
- Status
- Progress (X/Y complete)
- Quick link to batch detail

5.3. WHEN viewing the admin dashboard trend chart THEN batch metrics SHALL include:
- Daily batch count (bar chart overlay)
- Average URLs per batch (line chart)
- Batch completion rate percentage (line chart)
Time periods: Last 7 days, Last 30 days, Last 90 days (selectable)

### Requirement 6: Batch Search and Navigation

**User Story:** As an administrator, I want to quickly find and navigate to specific batches, so that I can efficiently respond to support requests.

#### Acceptance Criteria

6.1. WHEN using the admin search bar THEN the system SHALL support searching for batches by:
- Batch ID (exact match)
- Homepage URL (partial match)
- Session ID (exact match)

6.2. WHEN search results include batches THEN they SHALL be displayed in a separate "Batches" section, showing maximum 10 results, sorted by creation date descending

6.3. WHEN navigating from a batch to its scans (via "View Scans" button) THEN the system SHALL navigate to /admin/scans with the batch filter pre-populated

6.4. WHEN navigating from a scan to its batch THEN the system SHALL:
- Navigate to /admin/batches/{batchId}
- Scroll to the scan in the URL list
- Highlight the scan row with a yellow background for 3 seconds

## Non-Functional Requirements

### Performance

- Batch list API response SHALL return within 500ms for default pagination
- Batch detail API response SHALL return within 1 second including aggregate statistics
- Batch export (PDF) SHALL complete within 30 seconds for batches up to 50 URLs
- Dashboard batch metrics SHALL be cached with 5-minute refresh interval

### Security

- All batch admin endpoints SHALL require valid admin JWT authentication
- All batch admin actions SHALL be logged to audit trail
- Batch delete operations SHALL require SUPER_ADMIN role OR explicit confirmation
- Batch data export SHALL sanitize all content to prevent XSS

### Reliability

- Batch cancellation SHALL be atomic (all-or-nothing)
- Batch deletion SHALL use database transactions to prevent partial deletions
- Batch export SHALL handle partial failures gracefully (include completed scans even if some failed)

### Usability

- Batch list SHALL support keyboard navigation
- Status filters SHALL show counts (e.g., "Completed (45)")
- Error messages SHALL be specific and actionable
- Loading states SHALL be clearly indicated

### Accessibility

- All batch-related UI components SHALL meet WCAG 2.1 AA compliance
- Status indicators SHALL include text labels (not color-only)
- Interactive elements SHALL have appropriate ARIA labels
- Expandable sections SHALL be keyboard accessible

### Observability

- All batch admin API calls SHALL be logged with: admin ID, action, batch ID, timestamp
- Failed operations SHALL log full error details including stack traces
- Batch export generation time SHALL be tracked as a metric
- Dashboard queries SHALL log execution time for performance monitoring

## Out of Scope

- **Batch creation from admin** - Admins cannot create batches; only users can
- **Batch modification** - Admins cannot modify batch parameters (URLs, WCAG level)
- **Batch scheduling** - Scheduled batch execution is a separate feature
- **Batch comparison** - Comparing two batch results is a future enhancement
- **Batch notifications** - Email/webhook notifications for batch completion
- **Batch rate limit configuration** - Per-user batch limits are managed separately

## Dependencies

- **Admin module** (completed) - Authentication, authorization, audit logging
- **Batch scanning feature** (completed) - Database schema, API endpoints, worker processing
- **PDF export service** (operational) - Needs enhancement for admin exports
- **Dashboard service** (operational) - Needs enhancement for batch metrics

## Glossary

- **Batch**: A group of scans submitted together, identified by a unique batch ID
- **Batch Scan**: The parent entity tracking overall batch progress and metadata
- **Individual Scan**: A single URL scan within a batch, processed independently
- **Homepage URL**: The primary URL associated with a batch (usually the root domain)
- **Aggregate Statistics**: Combined metrics across all scans in a batch
- **Impact Level**: axe-core severity classification: critical, serious, moderate, minor
- **STALE**: Batch status indicating > 24 hours without completion
