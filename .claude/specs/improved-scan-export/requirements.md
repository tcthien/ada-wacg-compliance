# Improved Scan Export Requirements

## Overview

Enhance the scan export functionality for both user and admin views to provide a better user experience when downloading PDF and JSON reports.

**Feature Name**: improved-scan-export
**Priority**: High
**Status**: Approved

## Problem Statement

Currently, the export functionality has several UX issues:
1. Users click export without knowing if a report already exists
2. No visual feedback during report generation (takes several seconds)
3. Admin users cannot export reports from the admin scan detail view
4. After recent bug fixes (exponential backoff, blob download), the UX can be improved further

## User Stories

### US-1: User Downloads Existing Report
**As a** user viewing scan results
**I want to** see if a report (PDF/JSON) already exists
**So that** I can download it immediately without waiting for generation

### US-2: User Generates New Report
**As a** user viewing scan results
**I want to** see a progress indicator when generating a new report
**So that** I know the system is working and can estimate wait time

### US-3: Admin Exports Report
**As an** admin user viewing scan details
**I want to** export scan reports (PDF/JSON) from the admin interface
**So that** I can download reports for any scan without accessing user view

## Functional Requirements

### 1. Report Status Detection

**REQ-1.1**: The system MUST check if reports (PDF/JSON) exist when loading scan result page
- Query API for report existence status on page load
- Cache status to avoid repeated API calls

**REQ-1.2**: The system MUST display report download links if reports already exist
- Show "Download PDF" and "Download JSON" links with direct presigned URLs
- Display file size if available from API
- Show report generation date/time

**REQ-1.3**: The system MUST refresh report status after successful generation
- Update UI to show download links after generation completes

### 2. Report Generation Progress

**REQ-2.1**: The system MUST display a progress popup/modal when generating a report
- Modal should appear when user clicks export for a non-existent report
- Modal should be dismissible (but continue generation in background)
- Use polling mechanism with exponential backoff (existing implementation)
- **Future Enhancement**: Consider SSE or WebSocket for real-time updates

**REQ-2.2**: The progress popup MUST show:
- Report format being generated (PDF/JSON)
- Animated progress indicator (spinner)
- Current status message (e.g., "Generating report...", "Uploading to storage...")
- Cancel button (cancels polling, not actual job)

**REQ-2.3**: The progress popup MUST handle completion
- Auto-download file when generation completes
- Show success message briefly before closing
- Close popup after download starts

**REQ-2.4**: The progress popup MUST handle errors
- Display error message if generation fails
- Provide retry option
- Allow dismissing error state

### 3. Admin Export Functionality

**REQ-3.1**: The admin scan detail page MUST include export functionality
- Add export button(s) to admin scan detail page action area
- Match existing admin UI patterns and styling

**REQ-3.2**: Admin export MUST work without session restrictions
- Admin exports should bypass session ownership validation
- Use admin authentication for authorization

**REQ-3.3**: Admin export MUST support both PDF and JSON formats
- Same format options as user view
- Same progress/download behavior

### 4. API Enhancements

**REQ-4.1**: Create endpoint to check report existence status
- GET `/api/v1/scans/:scanId/reports` - returns report status for both formats
- Response includes: exists, storageKey, createdAt, fileSize for each format

**REQ-4.2**: Admin report endpoint (if needed)
- POST `/api/v1/admin/scans/:scanId/reports/:format` - admin version of report generation
- Uses admin middleware instead of session middleware

## Non-Functional Requirements

### Performance

**NFR-1**: Report status check SHOULD complete within 500ms
**NFR-2**: Progress polling SHOULD use existing exponential backoff (already implemented)
**NFR-3**: Report download SHOULD use blob-based approach for cross-origin URLs (already implemented)

### User Experience

**NFR-4**: Progress modal SHOULD be accessible (keyboard navigable, focus trap, screen reader friendly)
**NFR-5**: Loading states MUST be clearly visible
**NFR-6**: Error messages MUST be actionable

### Compatibility

**NFR-7**: MUST work with existing report generation worker
**NFR-8**: MUST maintain backward compatibility with existing report API

## Out of Scope

- Batch export of multiple scans
- Export to additional formats (CSV, HTML)
- Email delivery of reports
- Report scheduling

## Technical Notes

### Existing Components

- `ExportButton` - current export trigger (apps/web/src/components/features/export/ExportButton.tsx)
- `ExportOptions` - dropdown with format options (apps/web/src/components/features/export/ExportOptions.tsx)
- `useExport` hook - handles export logic with polling (apps/web/src/hooks/useExport.ts)
- Report API - GET `/api/v1/reports/:scanId/:format` (apps/api/src/modules/reports/)
- Report worker - generates PDF/JSON (apps/worker/src/processors/reporter/)

### Database Schema

- `Report` model stores: scanId, format, storageKey, storageUrl, fileSizeBytes, createdAt, expiresAt

### API Response Types

```typescript
// Current report response
type ReportResponse =
  | { url: string; expiresAt: string }  // Report exists
  | { status: 'generating'; jobId: string }  // Being generated

// Proposed report status response
interface ReportStatusResponse {
  pdf: {
    exists: boolean;
    url?: string;
    createdAt?: string;
    fileSizeBytes?: number;
    expiresAt?: string;
  };
  json: {
    exists: boolean;
    url?: string;
    createdAt?: string;
    fileSizeBytes?: number;
    expiresAt?: string;
  };
}
```

## Acceptance Criteria

### User View
- [ ] On scan result page, report existence is checked on load
- [ ] If PDF/JSON reports exist, direct download links are displayed
- [ ] Clicking export for non-existent report shows progress modal
- [ ] Progress modal shows spinner and status text
- [ ] Report auto-downloads on completion
- [ ] Errors are displayed with retry option

### Admin View
- [ ] Admin scan detail page has export button(s)
- [ ] Admin can generate/download PDF and JSON reports
- [ ] Same progress UX as user view
- [ ] Works for any scan regardless of session ownership

## Dependencies

- Existing report generation infrastructure
- S3/MinIO storage for reports
- Presigned URL generation

## Risks

1. **Report expiration**: Presigned URLs expire - need to handle gracefully
2. **Large reports**: Very large scans may take longer to generate
3. **Storage costs**: More reports generated = more storage usage

## Open Questions

1. Should we show estimated generation time based on scan size?
2. Should the progress modal show actual percentage or just spinner?
3. Should we pre-generate reports on scan completion (background)?
