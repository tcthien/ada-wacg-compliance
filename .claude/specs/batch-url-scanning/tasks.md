# Task Breakdown: Batch URL Scanning

## Task Overview

Implement batch URL scanning by adding a `BatchScan` coordination layer on top of existing single-scan infrastructure. Tasks are organized in 6 phases: Database → API → Worker → Frontend → Export → Testing, with dependencies minimized through careful sequencing.

**Design Philosophy**: Extend, don't replace. The existing single-scan flow remains unchanged; batch scanning adds a coordination layer on top.

## Steering Document Compliance

- **structure.md**: Follows `apps/api/src/modules/*` pattern for new batch module
- **tech.md**: Uses Fastify + Zod + Prisma stack
- **Reuse**: Leverages existing ScanService, QueueService, and scan worker
- **Frontend**: Follows `apps/web/src/app/[route]` and `components/features/*` patterns

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

## Phase 1: Database Layer

- [x] 1. Create BatchScan Prisma model with BatchStatus enum
  - File: `apps/api/prisma/schema.prisma`
  - Add `BatchStatus` enum (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, STALE)
  - Add `BatchScan` model with all fields from design.md
  - Add indexes on `guestSessionId`, `status`, `createdAt`
  - _Leverage: Existing `Scan` model pattern in schema.prisma_
  - _Requirements: 1.1, 1.4, 5.1_

- [x] 2. Update Scan model for batch association
  - File: `apps/api/prisma/schema.prisma`
  - Add `batchId` field (optional UUID)
  - Add `batch` relation to BatchScan
  - Add `pageTitle` field (optional, from discovery)
  - Add index on `batchId`
  - _Leverage: Existing `Scan` model, relation patterns_
  - _Requirements: 1.1, 6.5_

- [x] 3. Generate and apply database migration
  - File: `apps/api/prisma/migrations/[timestamp]_add_batch_scan/`
  - Run `pnpm --filter @adashield/api prisma migrate dev --name add_batch_scan`
  - Verify migration creates BatchScan table
  - Verify rollback works: `pnpm prisma migrate reset --force`
  - _Leverage: Existing migration patterns_
  - _Requirements: (Database foundation for all requirements)_

---

## Phase 2: API Layer

- [x] 4. Create BatchRepository with CRUD operations
  - File: `apps/api/src/modules/batches/batch.repository.ts`
  - Implement `create()`, `findById()`, `findBySessionId()`
  - Implement `updateStatus()`, `updateAggregateStats()`
  - Export TypeScript types
  - _Leverage: `apps/api/src/modules/scans/scan.repository.ts` pattern_
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [x] 5. Create Batch Zod schemas for validation
  - File: `apps/api/src/modules/batches/batch.schema.ts`
  - CreateBatchRequestSchema (urls 1-50, wcagLevel, recaptchaToken)
  - BatchStatusResponseSchema
  - BatchResultsResponseSchema
  - PaginationSchema for listing
  - _Leverage: `apps/api/src/modules/scans/scan.schema.ts` pattern_
  - _Requirements: 1.2, 1.3, 1.7, 1.8_

- [x] 6. Implement BatchService.createBatch() method
  - File: `apps/api/src/modules/batches/batch.service.ts`
  - Create BatchScan record with PENDING status
  - Loop through URLs, call ScanService.createScan() with batchId
  - Queue scan jobs via QueueService
  - Update batch status to RUNNING
  - _Leverage: `ScanService`, `QueueService`, `BatchRepository`_
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

- [x] 7. Implement BatchService status and results methods
  - File: `apps/api/src/modules/batches/batch.service.ts`
  - Add `getBatchStatus(batchId, sessionId)` with authorization check
  - Add `getBatchResults(batchId, sessionId)` for aggregate results
  - Add `listBatches(sessionId, pagination)`
  - _Leverage: `BatchRepository`, existing session patterns_
  - _Requirements: 2.1, 2.2, 2.5, 3.1, 3.5, 5.1, 5.2_

- [x] 8. Implement BatchService.cancelBatch() method
  - File: `apps/api/src/modules/batches/batch.service.ts`
  - Validate session authorization
  - Cancel pending scans in batch
  - Update batch status to CANCELLED with timestamp
  - Preserve completed scan results
  - _Leverage: `ScanService`, `QueueService`_
  - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 9. Extend rate limiting middleware for batches
  - File: `apps/api/src/shared/middleware/rate-limit.ts`
  - Add `checkBatchRateLimit(sessionId, urlCount)` function
  - Track URLs per hour (max 100) and batches per hour (max 2)
  - Use Redis for tracking with 1-hour TTL
  - Return detailed rate limit info in error response
  - _Leverage: Existing rate-limit.ts patterns, Redis config_
  - _Requirements: 1.9, Security NFRs_

- [x] 10. Create BatchController with create and status endpoints
  - File: `apps/api/src/modules/batches/batch.controller.ts`
  - POST `/api/v1/batches` with reCAPTCHA and rate limit middleware
  - GET `/api/v1/batches/:id` for batch status
  - Apply session middleware, Zod validation
  - _Leverage: Existing controller patterns, middleware_
  - _Requirements: 1.1, 2.1, 2.4, Security NFRs_

- [x] 11. Add BatchController results, cancel, and list endpoints
  - File: `apps/api/src/modules/batches/batch.controller.ts`
  - GET `/api/v1/batches/:id/results`
  - POST `/api/v1/batches/:id/cancel`
  - GET `/api/v1/batches` (list for session)
  - _Leverage: `BatchService`, session middleware_
  - _Requirements: 3.1, 5.2, 7.1_

- [x] 12. Register batch module with Fastify server
  - Files: `apps/api/src/modules/batches/index.ts`, `apps/api/src/index.ts`
  - Export batch routes from module index
  - Register batch routes under `/api/v1/batches`
  - _Leverage: Existing module registration patterns_
  - _Requirements: (API foundation)_

---

## Phase 3: Worker Layer

- [x] 13. Create BatchStatusService for worker notifications
  - File: `apps/worker/src/services/batch-status.service.ts`
  - Implement `notifyScanComplete(scanId, status)`
  - Check if all scans in batch are complete
  - Update batch status (COMPLETED or FAILED)
  - Calculate and store aggregate statistics
  - _Leverage: `apps/api/src/modules/batches/batch.repository.ts` (or separate worker repo)_
  - _Requirements: 2.5, 2.6, 3.7_

- [x] 14. Integrate BatchStatusService in scan worker
  - File: `apps/worker/src/jobs/scan-page.job.ts`
  - Import BatchStatusService
  - After scan completion, check if scan has batchId
  - If batchId exists, call `batchStatusService.notifyScanComplete()`
  - Handle errors gracefully (don't fail scan on notification error)
  - _Leverage: Existing scan-page.job.ts structure_
  - _Requirements: 2.3, 2.5_

- [x] 15. Create stale batch checker cron job
  - Files: `apps/api/src/jobs/batch-stale-checker.job.ts`, `apps/api/src/index.ts`
  - Create job that runs every hour via node-cron
  - Find batches in PENDING/RUNNING status older than 24 hours
  - Update status to STALE
  - Log stale batch count
  - _Leverage: node-cron package (add if needed)_
  - _Requirements: 5.5_

---

## Phase 4: Frontend Layer

- [x] 16. Create batch API client functions
  - File: `apps/web/src/lib/batch-api.ts`
  - `createBatch()`, `getBatchStatus()`, `getBatchResults()`
  - `cancelBatch()`, `listBatches()`
  - TypeScript types matching API schemas
  - _Leverage: `apps/web/src/lib/api.ts` patterns_
  - _Requirements: (Frontend API foundation)_

- [x] 17. Create useBatch hook for status polling
  - File: `apps/web/src/hooks/useBatch.ts`
  - Fetch batch status with polling (default 2s interval)
  - Stop polling when batch is completed/failed/cancelled/stale
  - Provide cancel function
  - Handle loading and error states
  - _Leverage: `apps/web/src/hooks/useScan.ts` pattern_
  - _Requirements: 2.1, 2.4, 7.1_

- [x] 18. Create useBatchResults hook for results fetching
  - File: `apps/web/src/hooks/useBatchResults.ts`
  - Fetch results when enabled (batch completed)
  - Support pagination for URL results
  - Handle loading and error states
  - _Leverage: `apps/web/src/hooks/useScanResult.ts` pattern_
  - _Requirements: 3.1, 3.3_

- [x] 19. Create BatchProgress component
  - File: `apps/web/src/components/features/batch/BatchProgress.tsx`
  - Overall progress bar showing X/Y scans complete
  - List of URLs with status indicators (pending/running/completed/failed)
  - ARIA live regions for accessibility
  - _Leverage: `ScanProgress` component pattern_
  - _Requirements: 2.1, 2.2, Accessibility NFRs_

- [x] 20. Create BatchSummary component
  - File: `apps/web/src/components/features/batch/BatchSummary.tsx`
  - Show aggregate counts (critical, serious, moderate, minor)
  - Show top 5 URLs with highest critical issues
  - Show passed checks count
  - _Leverage: `ResultsSummary` component pattern_
  - _Requirements: 3.1, 3.2, 3.4, 3.7_

- [x] 21. Create BatchUrlList component
  - File: `apps/web/src/components/features/batch/BatchUrlList.tsx`
  - List of URLs with issue counts
  - Click to expand/collapse individual URL results
  - Failed URLs show error message
  - Link to individual scan result page
  - _Leverage: `IssueList` component pattern_
  - _Requirements: 3.3, 3.5, 3.6_

- [x] 22. Create batch results page with progress state
  - File: `apps/web/src/app/batch/[id]/page.tsx`
  - Use useBatch hook for status polling
  - Show BatchProgress when status is PENDING/RUNNING
  - Handle loading and error states
  - _Leverage: `apps/web/src/app/scan/[id]/page.tsx` pattern_
  - _Requirements: 2.1, 2.4, 2.7_

- [x] 23. Add completed state and results display to batch page
  - File: `apps/web/src/app/batch/[id]/page.tsx`
  - Show BatchSummary and BatchUrlList when status is COMPLETED
  - Handle FAILED batch state with error summary
  - _Leverage: BatchSummary, BatchUrlList components_
  - _Requirements: 3.1, 3.2, 2.6_

- [x] 24. Add stale warning banner to batch page
  - File: `apps/web/src/app/batch/[id]/page.tsx`
  - Display warning banner when batch.status === 'STALE'
  - Message: "This batch scan has been running for over 24 hours and may not complete."
  - Show partial results with cancellation option
  - _Leverage: Alert/banner UI components_
  - _Requirements: 5.5_

- [x] 25. Add cancel functionality to batch page
  - File: `apps/web/src/app/batch/[id]/page.tsx`
  - Show "Cancel Batch" button for PENDING/RUNNING batches
  - Call useBatch.cancelBatch() on click
  - Show confirmation dialog before cancelling
  - Display cancellation summary after cancel
  - _Leverage: useBatch hook, Button component_
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 26. Update ScanForm for batch submission
  - File: `apps/web/src/components/features/scan/ScanForm.tsx`
  - Check sessionStorage for `discovery:selectedPages` (multiple URLs)
  - If multiple URLs, call batch API instead of single scan API
  - Navigate to `/batch/{id}` instead of `/scan/{id}`
  - Show "Starting batch scan for X pages from {homepage}" message
  - _Leverage: batch-api.ts, sessionStorage discovery key_
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 27. Update history page for batch display
  - File: `apps/web/src/app/history/page.tsx`
  - Fetch batches and single scans separately
  - Display batches as grouped entries (homepage, URL count, total issues)
  - Display single scans (batchId = null) separately
  - Click batch navigates to `/batch/{id}`
  - _Leverage: batch-api.ts listBatches, existing history patterns_
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

---

## Phase 5: Export

- [x] 28. Create batch PDF cover page and summary generator
  - File: `apps/worker/src/processors/reporter/batch-pdf-generator.ts`
  - Implement cover page with batch metadata (homepage, URL count, date, WCAG level)
  - Implement executive summary section with aggregate statistics
  - _Leverage: `pdf-generator.ts` utilities, `pdf-templates.ts`_
  - _Requirements: 4.2, 4.5_

- [x] 29. Add per-URL breakdown and issues to batch PDF
  - File: `apps/worker/src/processors/reporter/batch-pdf-generator.ts`
  - Implement per-URL table breakdown with issue counts
  - Implement detailed issues section organized by URL
  - Add transparency disclaimer footer
  - Sanitize HTML content for XSS prevention
  - _Leverage: `pdf-generator.ts` utilities, HTML sanitization_
  - _Requirements: 4.3, 4.6, Security NFRs_

- [x] 30. Create batch export endpoint
  - File: `apps/api/src/modules/batches/batch.controller.ts`
  - GET `/api/v1/batches/:id/export?format=pdf|json`
  - Generate PDF using batch-pdf-generator or JSON
  - Return file download response with correct headers
  - Validate session authorization
  - _Leverage: BatchService, existing export patterns_
  - _Requirements: 4.1, 4.4, 4.5_

- [x] 31. Create BatchExport frontend component
  - File: `apps/web/src/components/features/batch/BatchExport.tsx`
  - Extend ExportButton pattern with PDF/JSON options
  - Download file when clicked
  - Show loading state during generation
  - Integrate into batch results page
  - _Leverage: `ExportButton` component pattern_
  - _Requirements: 4.1, 4.4_

---

## Phase 6: Testing

- [x] 32. Write BatchService unit tests
  - File: `apps/api/src/modules/batches/batch.service.test.ts`
  - Test createBatch - creates batch and scans
  - Test createBatch - rejects > 50 URLs
  - Test rate limit enforcement
  - Test getBatchStatus authorization
  - Test cancelBatch preserves completed results
  - _Leverage: Existing test patterns, vitest_
  - _Requirements: 1.7, 1.8, 1.9, 7.3_

- [x] 33. Write BatchController integration tests
  - File: `apps/api/src/modules/batches/batch.controller.test.ts`
  - Test POST /batches with valid and invalid data
  - Test rate limiting responses
  - Test GET /batches/:id with authorization
  - Test POST /batches/:id/cancel
  - _Leverage: Existing controller test patterns_
  - _Requirements: (Integration validation)_

- [x] 34. Write useBatch hook tests
  - File: `apps/web/src/hooks/useBatch.test.ts`
  - Test polling behavior
  - Test stop polling on completion
  - Test cancel function
  - Test error handling
  - _Leverage: React Testing Library, vitest_
  - _Requirements: 2.1, 2.4, 7.1_

- [x] 35. Write batch E2E test - Discovery to Results flow
  - File: `apps/web/e2e/batch-scan.spec.ts`
  - Discover pages, select multiple, start scan
  - Verify batch progress updates
  - Verify batch results display
  - _Leverage: Playwright, existing E2E patterns_
  - _Requirements: 6.1, 2.1, 3.1_

- [x] 36. Write batch E2E test - Cancellation and Export
  - File: `apps/web/e2e/batch-scan.spec.ts`
  - Start batch, cancel midway, verify partial results
  - Complete batch, export PDF, verify download
  - _Leverage: Playwright_
  - _Requirements: 7.1, 7.5, 4.1_

---

## Task Dependency Graph

```
Phase 1 (Database)
├── Task 1 (BatchScan Model)
├── Task 2 (Scan Model Update)
└── Task 3 (Migration) ─depends→ [1, 2]

Phase 2 (API)
├── Task 4 (BatchRepository)
├── Task 5 (Batch Schemas)
├── Task 6 (createBatch) ─depends→ [3, 4, 5]
├── Task 7 (status/results) ─depends→ [4]
├── Task 8 (cancelBatch) ─depends→ [4]
├── Task 9 (Rate Limiting)
├── Task 10 (Controller create/status) ─depends→ [6, 7, 9]
├── Task 11 (Controller results/cancel) ─depends→ [7, 8]
└── Task 12 (Module Registration) ─depends→ [10, 11]

Phase 3 (Worker)
├── Task 13 (BatchStatusService)
├── Task 14 (Worker Integration) ─depends→ [13]
└── Task 15 (Stale Checker)

Phase 4 (Frontend)
├── Task 16 (Batch API Client) ─depends→ [12]
├── Task 17 (useBatch Hook) ─depends→ [16]
├── Task 18 (useBatchResults) ─depends→ [16]
├── Task 19 (BatchProgress)
├── Task 20 (BatchSummary)
├── Task 21 (BatchUrlList)
├── Task 22 (Page - Progress) ─depends→ [17, 19]
├── Task 23 (Page - Results) ─depends→ [18, 20, 21, 22]
├── Task 24 (Page - Stale) ─depends→ [22]
├── Task 25 (Page - Cancel) ─depends→ [17, 22]
├── Task 26 (ScanForm Update) ─depends→ [16]
└── Task 27 (History Update) ─depends→ [16]

Phase 5 (Export)
├── Task 28 (PDF Cover/Summary)
├── Task 29 (PDF Details) ─depends→ [28]
├── Task 30 (Export Endpoint) ─depends→ [29]
└── Task 31 (Export Component) ─depends→ [30]

Phase 6 (Testing)
├── Task 32 (Service Tests) ─depends→ [8]
├── Task 33 (Controller Tests) ─depends→ [12]
├── Task 34 (Hook Tests) ─depends→ [17]
├── Task 35 (E2E Discovery→Results) ─depends→ [27]
└── Task 36 (E2E Cancel/Export) ─depends→ [25, 31]
```

---

## Implementation Order

**Sprint 1: Foundation (Tasks 1-5)**
- Database models and migration
- Repository and schemas

**Sprint 2: API Core (Tasks 6-12)**
- BatchService methods
- Rate limiting
- Controller endpoints
- Unit tests for service

**Sprint 3: Worker Layer (Tasks 13-15)**
- Worker notification service
- Stale batch detection

**Sprint 4: Frontend Components (Tasks 16-21)**
- API client and hooks
- UI components

**Sprint 5: Frontend Pages (Tasks 22-27)**
- Batch results page
- ScanForm and history updates

**Sprint 6: Export & E2E (Tasks 28-36)**
- PDF generation
- Export endpoint and component
- E2E tests
