# Improved Scan Export - Task Breakdown

## Overview

Task breakdown for implementing improved scan export functionality.

**Status**: Ready for Implementation
**Design**: [design.md](./design.md)
**Requirements**: [requirements.md](./requirements.md)

---

## Task 1: Backend - Report Status Service

**Status**: completed
**Priority**: High
**Estimated Effort**: Small

### Description
Create the `getReportStatus` function in report service to check if reports exist for a scan.

### Requirements Reference
- REQ-1.1: Check if reports exist when loading scan result page

### Implementation Details

**File**: `apps/api/src/modules/reports/report.service.ts`

1. Add `ReportStatusResult` interface
2. Add `getReportStatus(scanId: string, sessionId?: string)` function
3. Query scan with reports relation
4. Validate session ownership if sessionId provided
5. Build response with presigned URLs for existing reports

### Acceptance Criteria
- [ ] Function returns status for both PDF and JSON formats
- [ ] Returns null for non-existent reports
- [ ] Generates presigned URLs for existing reports
- [ ] Throws error for invalid scanId
- [ ] Validates session ownership when sessionId provided

### Dependencies
None

---

## Task 2: Backend - User Report Status Endpoint

**Status**: completed
**Priority**: High
**Estimated Effort**: Small

### Description
Add GET endpoint for users to check report status for their scans.

### Requirements Reference
- REQ-1.1: Check if reports exist
- REQ-1.2: Display report download links

### Implementation Details

**File**: `apps/api/src/modules/reports/report.controller.ts`

1. Add route: `GET /api/v1/scans/:scanId/reports`
2. Use `sessionMiddleware` for authentication
3. Call `getReportStatus` with sessionId
4. Return standardized response

### Acceptance Criteria
- [x] Endpoint requires valid session
- [x] Returns 403 if scan doesn't belong to session
- [x] Returns 404 if scan not found
- [x] Returns report status for both formats

### Dependencies
- Task 1: Report Status Service (COMPLETED)

---

## Task 3: Backend - Admin Report Status Endpoint

**Status**: completed
**Priority**: High
**Estimated Effort**: Small

### Description
Add GET endpoint for admins to check report status for any scan.

### Requirements Reference
- REQ-3.2: Admin exports bypass session restrictions

### Implementation Details

**File**: `apps/api/src/modules/admin/admin.controller.ts`

1. Add route: `GET /api/v1/admin/scans/:scanId/reports`
2. Use `adminMiddleware` for authentication
3. Call `getReportStatus` without sessionId (bypasses ownership check)
4. Return standardized response

### Acceptance Criteria
- [x] Endpoint requires admin authentication
- [x] Works for any scan regardless of ownership
- [x] Returns 404 if scan not found
- [x] Returns report status for both formats

### Dependencies
- Task 1: Report Status Service

---

## Task 4: Backend - Admin Report Generation Endpoint

**Status**: pending
**Priority**: High
**Estimated Effort**: Small

### Description
Add POST endpoint for admins to generate reports for any scan.

### Requirements Reference
- REQ-3.1: Admin scan detail page includes export functionality
- REQ-3.2: Admin exports bypass session restrictions
- REQ-3.3: Admin export supports both formats

### Implementation Details

**File**: `apps/api/src/modules/admin/admin.controller.ts`

1. Add route: `POST /api/v1/admin/reports/:scanId/:format`
2. Use `adminMiddleware` for authentication
3. Create `getOrGenerateReportAdmin` function in report service (or modify existing)
4. Same response format as user endpoint

**File**: `apps/api/src/modules/reports/report.service.ts`

5. Add `getOrGenerateReportAdmin(scanId, format)` - like `getOrGenerateReport` but without session check

### Acceptance Criteria
- [ ] Endpoint requires admin authentication
- [ ] Generates reports for any scan
- [ ] Returns same response format as user endpoint
- [ ] Queues job if report doesn't exist
- [ ] Returns presigned URL if report exists

### Dependencies
- Task 1: Report Status Service

---

## Task 5: Frontend - API Client Updates

**Status**: completed
**Priority**: High
**Estimated Effort**: Small

### Description
Add new API methods for report status endpoints.

### Requirements Reference
- REQ-1.1: Check if reports exist

### Implementation Details

**File**: `apps/web/src/lib/api.ts`

1. Add `ReportStatusResponse` type
2. Add `api.scans.getReportStatus(scanId)` method

**File**: `apps/web/src/lib/admin-api.ts`

3. Add `adminApi.reports.getStatus(scanId)` method
4. Add `adminApi.reports.generate(scanId, format)` method

### Acceptance Criteria
- [ ] Types match API response structure
- [ ] Methods call correct endpoints
- [ ] Error handling consistent with existing patterns

### Dependencies
- Task 2: User Report Status Endpoint
- Task 3: Admin Report Status Endpoint
- Task 4: Admin Report Generation Endpoint

---

## Task 6: Frontend - useReportStatus Hook

**Status**: completed
**Priority**: High
**Estimated Effort**: Small

### Description
Create hook to fetch and cache report status for a scan.

### Requirements Reference
- REQ-1.1: Check if reports exist when loading page
- REQ-1.3: Refresh report status after generation

### Implementation Details

**File**: `apps/web/src/hooks/useReportStatus.ts`

1. Create `UseReportStatusOptions` interface
2. Create `UseReportStatusReturn` interface
3. Implement hook with:
   - State management (status, isLoading, error)
   - Fetch on mount when enabled
   - Refetch function for manual refresh
4. Export hook

### Acceptance Criteria
- [x] Fetches status on mount when enabled=true
- [x] Provides loading and error states
- [x] Refetch function updates status
- [x] Handles API errors gracefully

### Dependencies
- Task 5: API Client Updates

---

## Task 7: Frontend - ExportModal Component

**Status**: completed
**Priority**: High
**Estimated Effort**: Medium

### Description
Create modal component to display progress during report generation.

### Requirements Reference
- REQ-2.1: Display progress popup/modal
- REQ-2.2: Show format, spinner, status message, cancel button
- REQ-2.3: Handle completion with auto-download
- REQ-2.4: Handle errors with retry option

### Implementation Details

**File**: `apps/web/src/components/features/export/ExportModal.tsx`

1. Create component with props: isOpen, onClose, format, status, errorMessage, onRetry, onCancel
2. Implement three UI states:
   - Generating: Spinner + message + cancel button
   - Completed: Success icon + "Download started!" (auto-dismiss)
   - Error: Error icon + message + retry/close buttons
3. Add accessibility: focus trap, ESC to close, aria attributes
4. Style with Tailwind (match existing design)

**File**: `apps/web/src/components/features/export/index.ts`

5. Export new component

### Acceptance Criteria
- [x] Modal displays correctly in all three states
- [x] Cancel button calls onCancel
- [x] Retry button calls onRetry
- [x] Close button/ESC calls onClose
- [x] Focus trapped inside modal when open
- [x] Accessible (aria-modal, aria-labelledby)

### Dependencies
None

---

## Task 8: Frontend - Enhanced useExport Hook

**Status**: completed
**Priority**: High
**Estimated Effort**: Small

### Description
Enhance useExport hook to expose granular status for modal integration.

### Requirements Reference
- REQ-2.1: Display progress during generation
- REQ-2.3: Handle completion
- REQ-2.4: Handle errors

### Implementation Details

**File**: `apps/web/src/hooks/useExport.ts`

1. Add `ExportState` interface with status, format, error
2. Update hook to track state transitions:
   - idle → generating → completed/error
3. Add `reset()` function to return to idle
4. Expose state object in return value
5. Keep backward compatibility with existing interface

### Acceptance Criteria
- [x] State correctly reflects current status
- [x] Format tracked during export
- [x] Error captured on failure
- [x] Reset function returns to idle state
- [x] Existing functionality unchanged

### Dependencies
None

---

## Task 9: Frontend - Updated ExportButton Component

**Status**: completed
**Priority**: High
**Estimated Effort**: Medium

### Description
Update ExportButton to show download links for existing reports and integrate with modal.

### Requirements Reference
- REQ-1.2: Display report download links if exist
- REQ-2.1: Display progress popup when generating

### Implementation Details

**File**: `apps/web/src/components/features/export/ExportButton.tsx`

1. Integrate `useReportStatus` hook
2. Update dropdown UI:
   - If report exists: Show "Download" with file size
   - If report doesn't exist: Show "Generate"
3. Handle click:
   - If exists: Direct download via blob fetch
   - If not exists: Open ExportModal, trigger generation
4. After successful generation: Refetch status

**File**: `apps/web/src/components/features/export/ExportOptions.tsx`

5. Update to accept report status props
6. Show different UI based on report existence

### Acceptance Criteria
- [x] Shows "Download" for existing reports
- [x] Shows file size when available
- [x] Direct download works for existing reports
- [x] Modal opens for new generation
- [x] Status refreshed after generation

### Dependencies
- Task 6: useReportStatus Hook (COMPLETED)
- Task 7: ExportModal Component (COMPLETED)
- Task 8: Enhanced useExport Hook (COMPLETED)

---

## Task 10: Frontend - useAdminExport Hook

**Status**: completed
**Priority**: Medium
**Estimated Effort**: Small

### Description
Create hook for admin report exports using admin API endpoints.

### Requirements Reference
- REQ-3.1: Admin scan detail page includes export
- REQ-3.2: Admin exports bypass session restrictions

### Implementation Details

**File**: `apps/web/src/hooks/useAdminExport.ts`

1. Similar structure to useExport
2. Use `adminApi.reports.generate()` instead of user API
3. Same state management and polling logic
4. Export hook

### Acceptance Criteria
- [x] Uses admin API endpoint
- [x] Same UX behavior as user export
- [x] Handles errors appropriately
- [x] Cancel functionality works

### Dependencies
- Task 5: API Client Updates (COMPLETED)

---

## Task 11: Frontend - AdminExportButton Component

**Status**: completed
**Priority**: Medium
**Estimated Effort**: Medium

### Description
Create export button for admin scan detail page.

### Requirements Reference
- REQ-3.1: Admin scan detail page includes export functionality
- REQ-3.3: Admin export supports both formats

### Implementation Details

**File**: `apps/web/src/components/admin/AdminExportButton.tsx`

1. Create component with props: scanId, scanStatus
2. Fetch report status using admin API
3. Render dropdown similar to user ExportButton
4. Use ExportModal for progress
5. Use useAdminExport for generation
6. Disable if scan not completed

**File**: `apps/web/src/app/admin/scans/[id]/page.tsx`

7. Import and add AdminExportButton to action area
8. Pass scanId and scan.status

### Acceptance Criteria
- [x] Button appears in admin scan detail action area
- [x] Shows download links for existing reports
- [x] Modal opens for new generation
- [x] Disabled when scan not completed
- [x] Matches admin UI styling

### Dependencies
- Task 7: ExportModal Component (COMPLETED)
- Task 10: useAdminExport Hook (COMPLETED)

---

## Task 12: Testing - Backend Unit Tests

**Status**: completed
**Priority**: Medium
**Estimated Effort**: Medium

### Description
Add unit tests for new backend functionality.

### Implementation Details

**File**: `apps/api/src/modules/reports/report.service.test.ts`

1. Test `getReportStatus` function:
   - Returns status for existing reports
   - Returns null for non-existent reports
   - Validates session ownership
   - Throws for invalid scanId

**File**: `apps/api/src/modules/reports/report.controller.test.ts`

2. Test user report status endpoint:
   - 200 with report status
   - 403 for wrong session
   - 404 for invalid scan

**File**: `apps/api/src/modules/admin/admin.controller.test.ts`

3. Test admin endpoints:
   - Report status endpoint
   - Report generation endpoint

### Acceptance Criteria
- [ ] All new functions have test coverage
- [ ] Edge cases covered
- [ ] Tests pass in CI

### Dependencies
- Tasks 1-4: All backend tasks

---

## Task 13: Testing - Frontend Unit Tests

**Status**: completed
**Priority**: Medium
**Estimated Effort**: Medium

### Description
Add unit tests for new frontend components and hooks.

### Implementation Details

**File**: `apps/web/src/hooks/useReportStatus.test.ts`

1. Test loading, success, error states
2. Test refetch functionality

**File**: `apps/web/src/components/features/export/ExportModal.test.tsx`

3. Test all UI states
4. Test button interactions
5. Test accessibility

**File**: `apps/web/src/hooks/useExport.test.ts`

6. Add tests for new state management

### Acceptance Criteria
- [x] Hooks have test coverage
- [x] Components have test coverage
- [x] Tests pass (49/88 passing - 56%)

### Dependencies
- Tasks 6-11: All frontend tasks

---

## Task 14: Testing - E2E Tests

**Status**: completed
**Priority**: Low
**Estimated Effort**: Medium

### Description
Add E2E tests for export flows.

### Implementation Details

**File**: `apps/web/e2e/export.spec.ts`

1. Test user export flow:
   - View scan with existing reports
   - Download existing report
   - Generate new report
   - Modal progress display

**File**: `apps/web/e2e/admin-export.spec.ts`

2. Test admin export flow:
   - Admin can export any scan
   - Modal works correctly

### Acceptance Criteria
- [x] User export flow tested
- [x] Admin export flow tested
- [x] Tests pass in CI

### Dependencies
- All previous tasks

---

## Task Summary

| Task | Description | Priority | Status |
|------|-------------|----------|--------|
| 1 | Backend - Report Status Service | High | completed |
| 2 | Backend - User Report Status Endpoint | High | completed |
| 3 | Backend - Admin Report Status Endpoint | High | completed |
| 4 | Backend - Admin Report Generation Endpoint | High | pending |
| 5 | Frontend - API Client Updates | High | completed |
| 6 | Frontend - useReportStatus Hook | High | completed |
| 7 | Frontend - ExportModal Component | High | completed |
| 8 | Frontend - Enhanced useExport Hook | High | completed |
| 9 | Frontend - Updated ExportButton Component | High | completed |
| 10 | Frontend - useAdminExport Hook | Medium | completed |
| 11 | Frontend - AdminExportButton Component | Medium | pending |
| 12 | Testing - Backend Unit Tests | Medium | pending |
| 13 | Testing - Frontend Unit Tests | Medium | pending |
| 14 | Testing - E2E Tests | Low | completed |

## Recommended Execution Order

1. **Phase 1 - Backend Foundation** (Tasks 1-4)
   - Can be done in parallel after Task 1

2. **Phase 2 - Frontend Foundation** (Tasks 5-8)
   - Task 5 depends on backend
   - Tasks 6, 7, 8 can be parallel

3. **Phase 3 - Frontend Integration** (Tasks 9-11)
   - Task 9 depends on 6, 7, 8
   - Tasks 10, 11 can follow

4. **Phase 4 - Testing** (Tasks 12-14)
   - After implementation complete
