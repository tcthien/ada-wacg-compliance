# Task Breakdown: Admin Batch Management

## Task Overview

Implement admin batch management by extending the existing admin module with batch-specific API endpoints, frontend pages, and integration with existing scan views. **38 tasks** organized in 5 phases: API (8) → Frontend Core (6) → Frontend Pages (7) → Integration (10) → Testing (7).

**Design Philosophy**: Extend the existing admin module patterns. Reuse authentication, audit logging, and UI components. No modifications to user-facing batch functionality.

## Steering Document Compliance

- **structure.md**: Follows `apps/api/src/modules/admin/*` pattern for new batch-admin files
- **tech.md**: Uses Fastify + Zod + Prisma stack
- **Reuse**: Leverages existing adminAuthMiddleware, audit.service, ScanTable patterns
- **Frontend**: Follows `apps/web/src/app/admin/*` and `components/admin/*` patterns

## Atomic Task Requirements

- Each task completes in ≤30 minutes
- Maximum 1-2 files modified per task
- Clear acceptance criteria with testable outcomes
- Dependencies explicitly stated
- Leverage references to existing code

## Task Format Guidelines

Each task includes:
- Checkbox format: `- [ ] N. Task description`
- Files to modify
- Implementation steps
- `_Leverage:_` references to existing code
- `_Requirements:_` references to requirements.md

---

## Phase 1: API Layer

- [x] 1. Create Zod schemas for admin batch operations
  - File: `apps/api/src/modules/admin/admin.schema.ts`
  - Add `batchListQuerySchema` (page, limit, status, startDate, endDate, homepageUrl, sessionId)
  - Add `batchIdParamSchema` (id as UUID)
  - Add `batchExportQuerySchema` (format: pdf|json|csv)
  - Add batch audit action types to existing enum
  - _Leverage: Existing `scanListQuerySchema`, `paginationSchema` in same file_
  - _Requirements: 1.3, 1.4, 3.5_

- [x] 2. Create BatchAdminService with list and detail methods
  - File: `apps/api/src/modules/admin/batch-admin.service.ts`
  - Create `BatchAdminServiceError` class following existing pattern
  - Implement `listAllBatches(filters, pagination)` - query all batches with filtering
  - Implement `getBatchDetails(batchId)` - fetch batch with scans, aggregates, session info
  - _Leverage: `apps/api/src/modules/admin/scan-admin.service.ts` pattern_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

- [x] 3. Add BatchAdminService admin action methods
  - File: `apps/api/src/modules/admin/batch-admin.service.ts`
  - Implement `cancelBatch(batchId, adminId)` - cancel pending scans, update status, log audit
  - Implement `deleteBatch(batchId, adminId)` - cascade delete batch and all data, log audit
  - Implement `retryFailedScans(batchId, adminId)` - re-queue failed scans, log audit
  - _Leverage: Existing `cancelBatch` in batch.service.ts, audit.service.ts_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 4. Add BatchAdminService export and metrics methods
  - File: `apps/api/src/modules/admin/batch-admin.service.ts`
  - Implement `exportBatch(batchId, format)` - generate PDF/JSON/CSV export
  - Implement `getBatchMetrics()` - dashboard metrics (totals, averages, recent, trends)
  - _Leverage: `batch-export.service.ts` for PDF, existing dashboard.service.ts patterns_
  - _Requirements: 3.5, 5.1, 5.2, 5.3_

- [x] 5. Create BatchAdminController with list and detail endpoints
  - File: `apps/api/src/modules/admin/batch-admin.controller.ts`
  - GET `/api/v1/admin/batches` - list batches with filters (adminAuthMiddleware)
  - GET `/api/v1/admin/batches/:id` - batch details (adminAuthMiddleware)
  - Log audit events for both endpoints
  - _Leverage: Existing admin.controller.ts patterns, middleware chain_
  - _Requirements: 1.1, 1.5, 2.1_

- [x] 6. Add BatchAdminController action endpoints
  - File: `apps/api/src/modules/admin/batch-admin.controller.ts`
  - POST `/api/v1/admin/batches/:id/cancel` - cancel batch (adminAuthMiddleware)
  - DELETE `/api/v1/admin/batches/:id` - delete batch (requireSuperAdmin)
  - POST `/api/v1/admin/batches/:id/retry` - retry failed (adminAuthMiddleware)
  - _Leverage: Existing admin action endpoints, requireSuperAdmin middleware_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 7. Add BatchAdminController export and metrics endpoints
  - File: `apps/api/src/modules/admin/batch-admin.controller.ts`
  - GET `/api/v1/admin/batches/:id/export` - export batch (adminAuthMiddleware)
  - GET `/api/v1/admin/dashboard/batches` - batch metrics (adminAuthMiddleware)
  - _Leverage: Existing export response patterns, dashboard endpoints_
  - _Requirements: 3.5, 5.1_

- [x] 8. Register batch admin routes in admin module
  - File: `apps/api/src/modules/admin/admin.controller.ts`
  - Import and call `registerBatchAdminRoutes(fastify, prefix)`
  - Ensure routes are prefixed with `/api/v1/admin`
  - _Leverage: Existing route registration in registerAdminRoutes_
  - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6 (API foundation for all batch admin features)_

---

## Phase 2: Frontend Core

- [x] 9. Create admin batch API client functions
  - File: `apps/web/src/lib/admin-api.ts`
  - Add `listAdminBatches(filters, pagination)` function
  - Add `getAdminBatchDetail(batchId)` function
  - Add `cancelAdminBatch(batchId)` function
  - Add `deleteAdminBatch(batchId)` function
  - Add `retryAdminBatchFailed(batchId)` function
  - Add `exportAdminBatch(batchId, format)` function
  - Add `getAdminBatchMetrics()` function
  - Add TypeScript types matching API response schemas
  - _Leverage: Existing admin API functions in same file_
  - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1 (Frontend API client for all batch operations)_

- [x] 10. Create useAdminBatches hook for batch list
  - File: `apps/web/src/hooks/useAdminBatches.ts`
  - Fetch batches with React Query
  - Support filtering and pagination
  - Handle loading and error states
  - Provide refetch function
  - _Leverage: Existing admin hooks pattern_
  - _Requirements: 1.1, 1.3, 1.4_

- [x] 11. Create useAdminBatchDetail hook
  - File: `apps/web/src/hooks/useAdminBatchDetail.ts`
  - Fetch batch details with React Query
  - Provide action methods: cancelBatch, deleteBatch, retryFailed, exportBatch
  - Handle loading and error states
  - _Leverage: Existing admin detail hooks pattern_
  - _Requirements: 2.1, 3.1, 3.3, 3.5, 3.6_

- [x] 12. Create BatchTable component
  - File: `apps/web/src/components/admin/BatchTable.tsx`
  - Table with columns: Homepage URL, URLs, Status, Issues, Created, Actions
  - Row click navigates to batch detail
  - Status badges with color coding
  - Responsive design
  - _Leverage: `apps/web/src/components/admin/ScanTable.tsx` pattern_
  - _Requirements: 1.2, 1.5_

- [x] 13. Create BatchFilters component
  - File: `apps/web/src/components/admin/BatchFilters.tsx`
  - Status dropdown filter
  - Date range picker
  - Homepage URL search input
  - Clear filters button
  - _Leverage: Existing filter components in admin_
  - _Requirements: 1.3_

- [x] 14. Create BatchSummaryBar component
  - File: `apps/web/src/components/admin/BatchSummaryBar.tsx`
  - Display: total batches, total URLs, aggregate issue counts
  - Update when filters change
  - _Leverage: Similar summary patterns in admin_
  - _Requirements: 1.6_

---

## Phase 3: Frontend Pages

- [x] 15. Create admin batch list page
  - File: `apps/web/src/app/admin/batches/page.tsx`
  - Use AdminLayout wrapper
  - Compose BatchFilters, BatchSummaryBar, BatchTable
  - Add pagination controls
  - Handle loading and error states with retry button (1.7)
  - _Leverage: `apps/web/src/app/admin/scans/page.tsx` pattern_
  - _Requirements: 1.1, 1.7_

- [x] 16. Create BatchDetailHeader component
  - File: `apps/web/src/components/admin/BatchDetailHeader.tsx`
  - Display batch ID, homepage URL, WCAG level, status
  - Display timestamps (created, completed, cancelled)
  - Display discovery ID link if present
  - Back to list navigation
  - _Leverage: Existing detail header patterns_
  - _Requirements: 2.1_

- [x] 17. Create BatchDetailActions component
  - File: `apps/web/src/components/admin/BatchDetailActions.tsx`
  - Cancel button (for PENDING/RUNNING batches)
  - Delete button (shows for all, requires confirmation)
  - Retry Failed button (for batches with failed scans)
  - Export dropdown (PDF, JSON, CSV options)
  - Confirmation dialogs for destructive actions
  - _Leverage: Existing action button patterns_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 18. Create BatchAggregateCard component
  - File: `apps/web/src/components/admin/BatchAggregateCard.tsx`
  - Display aggregate statistics in card format
  - Total issues, critical, serious, moderate, minor counts
  - Passed checks count
  - Visual indicators for critical issues
  - _Leverage: Existing stats card patterns_
  - _Requirements: 2.1_

- [x] 19. Create BatchCriticalUrlsCard component
  - File: `apps/web/src/components/admin/BatchCriticalUrlsCard.tsx`
  - Display top 5 URLs with highest critical issues
  - Show URL, page title, critical count
  - Link to individual scan detail
  - Handle ties by URL alphabetically
  - _Leverage: Existing card patterns_
  - _Requirements: 2.4, 2.5_

- [x] 20. Create BatchScansList component
  - File: `apps/web/src/components/admin/BatchScansList.tsx`
  - List all scans in batch with: URL, title, status, issues, error
  - Expandable rows for error details
  - Link to individual scan detail page
  - Visual highlighting for critical issues
  - _Leverage: `BatchUrlList` from user-facing feature_
  - _Requirements: 2.2, 2.3_

- [x] 21. Create admin batch detail page
  - File: `apps/web/src/app/admin/batches/[id]/page.tsx`
  - Use AdminLayout wrapper
  - Compose: BatchDetailHeader, BatchDetailActions, BatchAggregateCard, BatchCriticalUrlsCard, BatchScansList
  - Handle loading and error states with back button (2.6)
  - _Leverage: `apps/web/src/app/admin/scans/[id]/page.tsx` pattern_
  - _Requirements: 2.1, 2.6_

---

## Phase 4: Integration

- [x] 22. Add Batches link to admin navigation
  - File: `apps/web/src/app/admin/layout.tsx`
  - Add "Batches" menu item between Dashboard and Scans in the sidebar navigation
  - Use Layers or Stack icon (consistent with existing icons)
  - Highlight when active using existing activeLink pattern
  - _Leverage: Existing navigation items in same file_
  - _Requirements: 1.1 (Admin batch list navigation access)_

- [x] 23. Enhance ScanTable with batch context column
  - File: `apps/web/src/components/admin/ScanTable.tsx`
  - Add "Batch" column after URL column
  - Display batch badge for batched scans
  - Show truncated homepage URL (30 chars)
  - Link icon to navigate to batch detail
  - _Leverage: Existing column patterns_
  - _Requirements: 4.1_

- [x] 24. Add batch filter to scan list page
  - File: `apps/web/src/app/admin/scans/page.tsx`
  - Add "Batch Filter" dropdown: All, Batched Only, Non-Batched, Specific Batch
  - Pass filter to API query
  - _Leverage: Existing filter patterns_
  - _Requirements: 4.3_

- [x] 25. Enhance scan detail page with batch context
  - File: `apps/web/src/app/admin/scans/[id]/page.tsx`
  - If scan has batchId, display batch context section
  - Show: Batch ID (link), position in batch, homepage URL, batch status
  - _Leverage: Existing detail section patterns_
  - _Requirements: 4.2_

- [x] 26. Add batch metrics to admin dashboard
  - File: `apps/web/src/app/admin/page.tsx` (dashboard)
  - Add batch metrics card: today/week/month counts, avg URLs, completion rate
  - Add "Recent Batches" widget with last 5 batches
  - _Leverage: Existing dashboard widget patterns, useAdminBatches for recent_
  - _Requirements: 5.1, 5.2_

- [x] 27. Add batch trends to dashboard charts
  - File: `apps/web/src/app/admin/page.tsx` (dashboard)
  - Add batch count to trend chart (bar overlay)
  - Add avg URLs per batch line
  - Add completion rate line
  - Support time period selection (7d, 30d, 90d)
  - _Leverage: Existing chart components, getBatchMetrics API_
  - _Requirements: 5.3_

- [x] 28. Create AdminSearch component
  - File: `apps/web/src/components/admin/AdminSearch.tsx` (NEW file)
  - Create search component with text input and search button
  - Search batches by: ID (exact match), homepage URL (partial), session ID (exact)
  - Display batch results in "Batches" section (max 10, sorted by created desc)
  - Link to batch detail page on result click
  - _Leverage: Existing form input patterns from BatchFilters_
  - _Requirements: 6.1, 6.2_

- [x] 29. Integrate AdminSearch into admin layout
  - File: `apps/web/src/app/admin/layout.tsx`
  - Import and add AdminSearch component to admin header
  - Position search bar in header navigation area
  - _Leverage: Existing layout header structure_
  - _Requirements: 6.1_

- [x] 30. Add "View Scans" button to batch detail page
  - File: `apps/web/src/app/admin/batches/[id]/page.tsx`
  - Add "View Scans" button in BatchDetailActions or header area
  - On click, navigate to /admin/scans?batchId={id}
  - _Leverage: Existing navigation patterns, URL query params_
  - _Requirements: 6.3_

- [x] 31. Add scan-to-batch navigation with highlighting
  - File: `apps/web/src/app/admin/batches/[id]/page.tsx`
  - When navigating from scan with ?highlightScanId query param
  - Scroll to the scan in BatchScansList
  - Apply yellow background to scan row for 3 seconds
  - _Leverage: CSS animations, useSearchParams hook_
  - _Requirements: 6.4_

---

## Phase 5: Testing

- [x] 32. Write BatchAdminService unit tests
  - File: `apps/api/src/modules/admin/batch-admin.service.test.ts`
  - Test listAllBatches with various filters
  - Test getBatchDetails returns complete data
  - Test cancelBatch updates status and logs audit
  - Test deleteBatch cascade deletes and logs audit
  - Test retryFailedScans re-queues jobs
  - _Leverage: Existing admin service test patterns, vitest_
  - _Requirements: 1.1, 2.1, 3.2, 3.4, 3.6 (Service layer validation)_

- [x] 33. Write BatchAdminController integration tests
  - File: `apps/api/src/modules/admin/batch-admin.controller.test.ts`
  - Test GET /admin/batches with auth and filters
  - Test GET /admin/batches/:id authorization
  - Test POST /admin/batches/:id/cancel
  - Test DELETE /admin/batches/:id requires SUPER_ADMIN
  - Test audit logging for all actions
  - _Leverage: Existing admin controller test patterns_
  - _Requirements: 1.1, 2.1, 3.2, 3.4 (API layer validation)_

- [x] 34. Write useAdminBatches hooks tests
  - File: `apps/web/src/hooks/useAdminBatches.test.ts`
  - Test data fetching with filters
  - Test pagination
  - Test error handling
  - _Leverage: React Testing Library, vitest_
  - _Requirements: 1.1, 1.3, 1.4 (Hook validation with filters and pagination)_

- [x] 35. Write admin batch list E2E test
  - File: `apps/web/e2e/admin-batch-list.spec.ts`
  - Login as admin
  - Navigate to /admin/batches
  - Verify table renders with data
  - Test status filter
  - Test pagination
  - Click batch row → verify navigation to detail
  - _Leverage: Playwright, existing admin E2E patterns_
  - _Requirements: 1.1, 1.3, 1.5_

- [x] 36. Write admin batch detail E2E test
  - File: `apps/web/e2e/admin-batch-detail.spec.ts`
  - Login as admin
  - Navigate to batch detail page
  - Verify all sections render
  - Test cancel batch action
  - Test export functionality
  - _Leverage: Playwright_
  - _Requirements: 2.1, 3.2, 3.5_

- [x] 37. Write admin batch delete E2E test
  - File: `apps/web/e2e/admin-batch-delete.spec.ts`
  - Login as SUPER_ADMIN
  - Navigate to batch detail
  - Delete batch with confirmation
  - Verify batch removed from list
  - Test non-SUPER_ADMIN cannot delete
  - _Leverage: Playwright_
  - _Requirements: 3.3, 3.4_

- [x] 38. Write scan-batch integration E2E test
  - File: `apps/web/e2e/admin-scan-batch-integration.spec.ts`
  - Verify batch column in scan table
  - Test batch filter on scan list
  - Test scan detail shows batch context
  - Test navigation between scan and batch
  - _Leverage: Playwright_
  - _Requirements: 4.1, 4.2, 4.3, 6.3, 6.4_

---

## Task Dependency Graph

```
Phase 1 (API)
├── Task 1 (Zod Schemas)
├── Task 2 (Service list/detail) ─depends→ [1]
├── Task 3 (Service actions) ─depends→ [2]
├── Task 4 (Service export/metrics) ─depends→ [2]
├── Task 5 (Controller list/detail) ─depends→ [2]
├── Task 6 (Controller actions) ─depends→ [3, 5]
├── Task 7 (Controller export/metrics) ─depends→ [4, 5]
└── Task 8 (Route registration) ─depends→ [5, 6, 7]

Phase 2 (Frontend Core)
├── Task 9 (API Client) ─depends→ [8]
├── Task 10 (useAdminBatches) ─depends→ [9]
├── Task 11 (useAdminBatchDetail) ─depends→ [9]
├── Task 12 (BatchTable)
├── Task 13 (BatchFilters)
└── Task 14 (BatchSummaryBar)

Phase 3 (Frontend Pages)
├── Task 15 (Batch List Page) ─depends→ [10, 12, 13, 14]
├── Task 16 (BatchDetailHeader)
├── Task 17 (BatchDetailActions)
├── Task 18 (BatchAggregateCard)
├── Task 19 (BatchCriticalUrlsCard)
├── Task 20 (BatchScansList)
└── Task 21 (Batch Detail Page) ─depends→ [11, 16, 17, 18, 19, 20]

Phase 4 (Integration)
├── Task 22 (Navigation) ─depends→ [15]
├── Task 23 (ScanTable batch column) ─depends→ [8]
├── Task 24 (Scan list batch filter) ─depends→ [8]
├── Task 25 (Scan detail batch context) ─depends→ [8]
├── Task 26 (Dashboard metrics) ─depends→ [9]
├── Task 27 (Dashboard charts) ─depends→ [26]
├── Task 28 (AdminSearch component) ─depends→ [9]
├── Task 29 (Integrate AdminSearch) ─depends→ [28]
├── Task 30 (View Scans button) ─depends→ [21]
└── Task 31 (Scan-to-batch highlighting) ─depends→ [21, 30]

Phase 5 (Testing)
├── Task 32 (Service tests) ─depends→ [4]
├── Task 33 (Controller tests) ─depends→ [8]
├── Task 34 (Hook tests) ─depends→ [11]
├── Task 35 (E2E list) ─depends→ [22]
├── Task 36 (E2E detail) ─depends→ [21]
├── Task 37 (E2E delete) ─depends→ [21]
└── Task 38 (E2E integration) ─depends→ [25, 31]
```

---

## Implementation Order

**Sprint 1: API Foundation (Tasks 1-8)**
- Zod schemas and validation
- BatchAdminService with all methods
- BatchAdminController with all endpoints
- Route registration

**Sprint 2: Frontend Core (Tasks 9-14)**
- Admin API client functions
- React hooks for data fetching
- Reusable table and filter components

**Sprint 3: Frontend Pages (Tasks 15-21)**
- Batch list page
- Batch detail page with all sections
- Action components with confirmations

**Sprint 4: Integration (Tasks 22-31)**
- Navigation updates
- Scan table/page batch context
- Dashboard metrics and charts
- Search component and integration
- Batch/scan cross-linking

**Sprint 5: Testing (Tasks 32-38)**
- Unit tests for service
- Integration tests for controller
- Hook tests
- E2E tests for all flows
