# Requirements - Scan Console Logger

## Introduction

The Scan Console Logger feature adds a real-time, console-style logging component to the scan process UI that displays step-by-step progress, events, and diagnostic information during accessibility scans. This provides transparency into the scanning process for both end-users and administrators, with admin-specific views containing additional technical details, critical errors, and debugging information.

### User Roles

| Role | Definition | Console Access |
|------|------------|----------------|
| **Public User** | Guest users or authenticated users performing scans | Simplified console view with user-friendly messages |
| **Admin User** | Internal team members with `role = 'ADMIN'` (from existing admin auth system) | Full console view with technical details, debug logs, and system metrics |

### Integration Points

| Component | Location | Integration |
|-----------|----------|-------------|
| **Console Component** | `apps/web/src/components/features/scan/ScanConsole.tsx` | Embedded in existing `ScanStatus.tsx` as collapsible panel |
| **Events API** | `apps/api/src/modules/scans/scan-events.*` | New sub-module within existing scans module |
| **Events Schema** | `apps/api/prisma/schema.prisma` | New `ScanEvent` model linked to `Scan` |
| **Admin Console** | `apps/web/src/components/admin/ScanConsole.tsx` | Enhanced version for admin scan detail view |

## Alignment with Product Vision

This feature directly supports several key principles from the product vision:

| Product Principle | How This Feature Supports It |
|-------------------|------------------------------|
| **Honesty Over Hype** | Transparent visibility into what the scanner is actually doing - no black box |
| **Developer-First** | Technical console output familiar to developers, useful for debugging |
| **Actionable Results** | Real-time feedback on scan progress and any issues encountered |
| **Transparency** | Users see exactly what steps are being performed on their website |

### MVP Alignment
This feature enhances the core scanning experience (MVP Phase 1) by improving user engagement during the scan wait time and reducing support requests from confused users.

## Requirements

### Requirement 1: Real-Time Scan Event Logging

**User Story:** As a user, I want to see real-time log messages during my scan, so that I understand what is happening and feel confident the scan is progressing.

#### Acceptance Criteria

1. WHEN a scan is created THEN the system SHALL display a console component showing "Initializing scan..."
2. WHEN a scan transitions to RUNNING status THEN the console SHALL display "Starting accessibility analysis..."
3. WHEN the scanner begins fetching the target URL THEN the console SHALL log "Fetching page: {url}"
4. WHEN the page is successfully loaded THEN the console SHALL log "Page loaded successfully ({loadTime}ms)"
5. WHEN axe-core analysis begins THEN the console SHALL log "Running accessibility checks..."
6. WHEN a specific WCAG category is being checked THEN the console SHALL log "Checking: {categoryName}"
7. WHEN issues are found in a category THEN the console SHALL log "Found {count} issues in {categoryName}" with appropriate severity indicator
8. WHEN the scan completes THEN the console SHALL log "Scan completed! Found {totalIssues} accessibility issues"
9. IF the scan fails THEN the console SHALL display an error message with a user-friendly explanation

### Requirement 2: Console Visual Design

**User Story:** As a user, I want the console to look professional and familiar like a terminal, so that it feels trustworthy and technical.

#### Acceptance Criteria

1. WHEN the console is rendered THEN it SHALL display with a dark background (similar to terminal)
2. WHEN log entries are added THEN each SHALL include a timestamp in HH:MM:SS format
3. WHEN a log entry is INFO level THEN it SHALL display with a neutral/white color
4. WHEN a log entry is SUCCESS level THEN it SHALL display with a green color/indicator
5. WHEN a log entry is WARNING level THEN it SHALL display with an amber/yellow color/indicator
6. WHEN a log entry is ERROR level THEN it SHALL display with a red color/indicator
7. WHEN new log entries are added THEN the console SHALL auto-scroll to show the latest entry
8. WHEN the user manually scrolls up THEN auto-scroll SHALL pause until user scrolls to bottom
9. WHEN the console has more than 100 entries THEN older entries MAY be virtualized for performance

### Requirement 3: User Console View (Public)

**User Story:** As a public user scanning my website, I want to see a simplified console that shows progress without overwhelming technical details, so that I can understand my scan status.

#### Acceptance Criteria

1. WHEN the user console is displayed THEN it SHALL show a maximum of 50 entries (most recent)
2. WHEN displaying log messages THEN technical stack traces SHALL be hidden
3. WHEN displaying log messages THEN internal system details (Redis keys, job IDs) SHALL be hidden
4. WHEN an error occurs THEN the user console SHALL show a user-friendly message, not raw error details
5. WHEN the scan is waiting in queue THEN the console SHALL display estimated wait time if available
6. IF the page load fails THEN the console SHALL suggest common causes (e.g., "Page might be blocking automated access")

### Requirement 4: Admin Console View (Enhanced)

**User Story:** As an admin, I want to see detailed technical logs including errors, timing, and system events, so that I can diagnose issues and monitor system health.

#### Acceptance Criteria

1. WHEN viewing a scan as admin THEN the console SHALL show all log levels including DEBUG
2. WHEN displaying logs THEN the admin console SHALL include job queue details (job ID, attempts, delays)
3. WHEN displaying logs THEN the admin console SHALL include performance metrics (memory usage, response times)
4. WHEN an error occurs THEN the admin console SHALL display full error stack traces
5. WHEN Redis operations occur THEN the admin console SHALL log cache hits/misses
6. WHEN the worker processes the scan THEN the admin console SHALL show worker ID and queue position
7. WHEN displaying admin-only entries THEN they SHALL be visually distinguished (e.g., different background or icon)
8. WHEN the admin is viewing THEN they SHALL be able to toggle between "User View" and "Full View"

### Requirement 5: Console Persistence and History

**User Story:** As a user, I want to see the console log after a scan completes, so that I can review what happened during the scan.

#### Acceptance Criteria

1. WHEN a scan completes THEN the console log SHALL remain visible on the results page
2. WHEN viewing a completed scan THEN the full console history SHALL be available
3. WHEN the page is refreshed THEN the console history for that scan SHALL be preserved
4. IF the scan is older than 24 hours THEN detailed logs MAY be summarized to save storage
5. WHEN viewing scan history THEN a collapsed console summary SHALL be available with option to expand

### Requirement 6: Backend Log Event System

**User Story:** As a developer, I want scan events to be captured and streamed in real-time, so that the frontend console can display them immediately.

#### Acceptance Criteria

1. WHEN a scan event occurs THEN it SHALL be stored with scan_id, timestamp, level, message, and metadata
2. WHEN events are stored THEN they SHALL be persisted in the database (`ScanEvent` Prisma model) AND cached in Redis for real-time retrieval
3. WHEN events are stored THEN they SHALL include an event_type for categorization (see Event Types below)
4. WHEN the frontend requests events THEN the API SHALL provide endpoint: `GET /api/v1/scans/{scanId}/events?since={timestamp}`
5. WHEN events are created THEN they SHALL be cached in Redis with key pattern `scan:{scanId}:events` (TTL: 24 hours)
6. IF real-time updates are implemented THEN events SHALL be publishable via Redis pub/sub for future SSE/WebSocket support
7. WHEN an event includes sensitive data THEN it SHALL be marked as `adminOnly: true`

#### Event Types

| Type | Description | Example Messages |
|------|-------------|------------------|
| **INIT** | Scan initialization events | "Initializing scan...", "Validating URL..." |
| **QUEUE** | Job queue events | "Added to queue", "Processing started" |
| **FETCH** | Page fetching and loading | "Fetching page: {url}", "Page loaded ({time}ms)" |
| **ANALYSIS** | Accessibility analysis progress | "Running accessibility checks...", "Checking: {category}" |
| **RESULT** | Scan completion and summary | "Found {count} issues", "Scan completed!" |
| **ERROR** | Failure and error conditions | "Failed to load page", "Connection timeout" |
| **DEBUG** | Technical/admin-only events | "Redis cache miss", "Worker: {workerId}" |

#### Data Retention

| Data Type             | Storage                      | Retention              |
|-----------------------|------------------------------|------------------------|
| **Database events**   | PostgreSQL (ScanEvent table) | 30 days, then deleted  |
| **Redis cache**       | Redis                        | 24 hours TTL           |
| **Event summary**     | Stored in Scan record        | Indefinite (with scan) |

#### Storage Strategy

**Volume Estimate**: ~20-50 events per scan × thousands of scans/month = potentially millions of rows

**Recommended Approach**:
1. **MVP Phase**: Simple table with indexed `createdAt` column + scheduled cleanup job
2. **Scale Phase**: PostgreSQL native partitioning by month (`PARTITION BY RANGE (created_at)`)

**Cleanup Strategy**:
- Daily job deletes events older than 30 days
- Before deletion, aggregate summary stats into parent `Scan` record
- Redis cache auto-expires via TTL

**Note**: Full partitioning implementation is optional for MVP but the schema should be designed to support future partitioning (avoid constraints that block partition conversion).

## Non-Functional Requirements

### Performance
- Console rendering SHALL NOT impact scan page load time by more than 100ms
- Log entries SHALL appear in the console within 500ms of the event occurring
- The console SHALL handle 200+ log entries without noticeable lag
- Polling for new events SHALL occur at most every 1 second during active scans

### Security
- Admin-only log entries SHALL NOT be accessible via the public API
- Internal system identifiers (database IDs, internal URLs) SHALL be sanitized from user-visible logs
- Error messages SHALL NOT expose stack traces or internal paths to non-admin users

### Reliability
- IF the log event system fails THEN the scan SHALL continue without interruption
- Console failures SHALL be silently logged and not affect the core scanning functionality
- Logs SHALL be stored for at least 7 days for completed scans

### Usability
- Console font size SHALL be readable (minimum 12px)
- Console SHALL be accessible with appropriate ARIA labels (role="log", aria-live="polite")
- Console colors SHALL meet WCAG AA contrast requirements (ironic for an accessibility tool!)
- Console SHALL be collapsible/expandable for users who prefer minimal UI

### Accessibility
- The console component itself SHALL be WCAG 2.2 AA compliant
- Screen readers SHALL announce new critical log entries
- Keyboard users SHALL be able to navigate and scroll the console
- High contrast mode SHALL be respected
