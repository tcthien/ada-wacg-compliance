# Implementation Plan: Batch Scan Export

## Task Overview

This implementation adds PDF and JSON export functionality for batch scans, building upon the existing single scan export infrastructure. Tasks are organized in dependency order: database schema → backend services → worker jobs → API endpoints → frontend components → testing.

## Steering Document Compliance

- **structure.md**: All files follow kebab-case naming, placed in appropriate module directories
- **tech.md**: Uses Fastify/Zod for API, BullMQ for jobs, React hooks for frontend state

## Atomic Task Requirements

Each task meets these criteria:
- **File Scope**: 1-3 related files
- **Time Boxing**: 15-30 minutes
- **Single Purpose**: One testable outcome
- **Specific Files**: Exact paths provided
- **Agent-Friendly**: Clear input/output

---

## Phase 1: Database Schema

- [x] 1. Add ReportStatus enum to Prisma schema
  - File: `apps/api/prisma/schema.prisma`
  - Add `ReportStatus` enum with values: PENDING, GENERATING, COMPLETED, FAILED
  - Add `status` field to Report model with default COMPLETED
  - Purpose: Enable tracking of async report generation status
  - _Leverage: Existing Report model at line 214-232_
  - _Requirements: 4.1, 4.2_

- [x] 2. Add batchId field and relation to Report model
  - File: `apps/api/prisma/schema.prisma`
  - Make `scanId` optional (remove @db.Uuid constraint, add ?)
  - Add `batchId String? @db.Uuid` field
  - Add `batch BatchScan? @relation(...)` relation
  - Add `@@unique([batchId, format])` constraint
  - Purpose: Enable Report model to store batch reports
  - _Leverage: Existing Report model, BatchScan model at line 378_
  - _Requirements: 1.1, 2.1_

- [x] 3. Create and run database migration
  - File: `apps/api/prisma/migrations/[timestamp]_add_batch_report_support/`
  - Run `npx prisma migrate dev --name add_batch_report_support`
  - Verify migration creates proper constraints and indexes
  - Purpose: Apply schema changes to database
  - _Leverage: Existing migration patterns in prisma/migrations/_
  - _Requirements: 1.1, 2.1_

---

## Phase 2: Backend - Batch JSON Exporter

- [x] 4. Create BatchJsonReport interface and types
  - File: `apps/worker/src/processors/reporter/batch-json-exporter.ts`
  - Define `BatchJsonReport` interface matching design spec
  - Define `BatchJsonInput` interface for input data
  - Export types for use in other modules
  - Purpose: Establish type definitions for batch JSON export
  - _Leverage: `apps/worker/src/processors/reporter/json-exporter.ts` (JsonReport interface)_
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 5. Implement generateBatchJsonReport function
  - File: `apps/worker/src/processors/reporter/batch-json-exporter.ts`
  - Create function that transforms batch data to BatchJsonReport
  - Include metadata, aggregate stats, per-URL results with issues
  - Add disclaimer text matching single scan export
  - Purpose: Generate JSON report object from batch data
  - _Leverage: `json-exporter.ts` generateJsonReport() pattern_
  - _Requirements: 2.2, 2.3, 2.4, 2.7_

- [x] 6. Implement exportBatchJson and uploadBatchJsonToS3 functions
  - File: `apps/worker/src/processors/reporter/batch-json-exporter.ts`
  - Create `exportBatchJson()` returning buffer and S3 key
  - Create `uploadBatchJsonToS3()` using existing S3 utilities
  - S3 key format: `reports/batch-{batchId}/report.json`
  - Purpose: Generate JSON buffer and upload to S3
  - _Leverage: `json-exporter.ts` exportJsonReport(), uploadJsonToS3()_
  - _Requirements: 2.1, 2.6_

---

## Phase 3: Backend - Batch Report Job

- [x] 7. Create batch report job types and constants
  - File: `apps/worker/src/jobs/batch-report.job.ts`
  - Define `BatchReportJobData` interface
  - Define `BatchReportJobResult` interface
  - Export `BATCH_REPORT_JOB_NAME` constant
  - Purpose: Establish job contract for batch report generation
  - _Leverage: `apps/worker/src/jobs/scan-page.job.ts` pattern_
  - _Requirements: 1.5, 2.5_

- [x] 8. Implement processBatchReportJob function
  - File: `apps/worker/src/jobs/batch-report.job.ts`
  - Fetch batch results from database using existing batch service
  - Call appropriate generator (PDF or JSON) based on format
  - Upload to S3 and return result
  - Purpose: Process batch report generation in worker
  - _Leverage: `apps/api/src/modules/batches/batch.service.ts` getBatchResults()_
  - _Requirements: 1.1, 2.1_

- [x] 9. Register batch report job in worker index
  - File: `apps/worker/src/index.ts`
  - Import processBatchReportJob
  - Register job processor with BullMQ worker
  - Configure job options (attempts: 3, exponential backoff)
  - Purpose: Enable worker to process batch report jobs
  - _Leverage: Existing job registration patterns in worker/src/index.ts_
  - _Requirements: 1.5, 2.5_

---

## Phase 4: Backend - Enhanced Export Service

- [x] 10. Add report repository functions for batch reports
  - File: `apps/api/src/modules/reports/report.repository.ts`
  - Add `getReportByBatchAndFormat(batchId, format)` function
  - Add `createPendingBatchReport(batchId, format)` function
  - Add `updateBatchReportStatus(batchId, format, status, storageKey?)` function
  - Purpose: Database operations for batch report records
  - _Leverage: Existing `getReportByScanAndFormat()` pattern_
  - _Requirements: 1.1, 2.1_

- [x] 11. Add requestBatchExport function to batch export service
  - File: `apps/api/src/modules/batches/batch-export.service.ts`
  - Check if report exists in database
  - If exists with storageKey, generate presigned URL and return
  - If not exists, create pending record and queue job
  - Return status: 'ready' or 'generating'
  - Purpose: Orchestrate batch export request flow
  - _Leverage: Existing `generateBatchPdf()` function, report repository_
  - _Requirements: 1.1, 1.5, 2.1, 2.5_

- [x] 12. Add getBatchExportStatus function to batch export service
  - File: `apps/api/src/modules/batches/batch-export.service.ts`
  - Query report status from database
  - If completed, generate presigned URL
  - Return current status with URL if ready
  - Purpose: Check status of async report generation
  - _Leverage: Report repository, S3 presigned URL utilities_
  - _Requirements: 4.1, 4.2_

---

## Phase 5: Backend - API Endpoints

- [x] 13. Enhance exportBatchHandler for async generation
  - File: `apps/api/src/modules/batches/batch.controller.ts`
  - Modify existing handler to use requestBatchExport service
  - Return 200 with URL if ready, 202 if generating
  - Keep backward compatibility for direct file download
  - Purpose: Support async export with caching
  - _Leverage: Existing exportBatchHandler at line 664_
  - _Requirements: 1.1, 1.4, 2.1, 2.5_

- [x] 14. Add export status endpoint to batch controller
  - File: `apps/api/src/modules/batches/batch.controller.ts`
  - Add `GET /batches/:id/export/status` route
  - Call getBatchExportStatus service
  - Return status with URL if completed
  - Purpose: Enable frontend polling for export status
  - _Leverage: Existing route registration pattern_
  - _Requirements: 4.1, 4.2_

- [x] 15. Add admin batch export endpoint
  - File: `apps/api/src/modules/admin/batch-admin.controller.ts`
  - Add `GET /admin/batches/:id/export` route
  - Bypass session ownership check
  - Log export action for audit
  - Purpose: Enable admin export without session restrictions
  - _Leverage: Existing admin routes pattern, batch export service_
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 16. Add admin export status endpoint
  - File: `apps/api/src/modules/admin/batch-admin.controller.ts`
  - Add `GET /admin/batches/:id/export/status` route
  - Same logic as user endpoint but with admin auth
  - Purpose: Enable admin to check export status
  - _Leverage: Batch export service getBatchExportStatus()_
  - _Requirements: 5.1, 5.2_

---

## Phase 6: Frontend - Batch API Client

- [x] 17. Add batch export API functions
  - File: `apps/web/src/lib/batch-api.ts`
  - Add `requestBatchExport(batchId, format)` function
  - Add `getBatchExportStatus(batchId, format)` function
  - Define response types matching API
  - Purpose: API client functions for batch export
  - _Leverage: Existing batch-api.ts patterns_
  - _Requirements: 1.1, 2.1_

- [x] 18. Add admin batch export API functions
  - File: `apps/web/src/lib/admin-api.ts`
  - Add `adminBatchExport(batchId, format)` function
  - Add `adminBatchExportStatus(batchId, format)` function
  - Purpose: Admin API client for batch export
  - _Leverage: Existing adminApi patterns_
  - _Requirements: 5.1, 5.2_

---

## Phase 7: Frontend - useBatchExport Hook

- [x] 19. Create useBatchExport hook with state management
  - File: `apps/web/src/hooks/useBatchExport.ts`
  - Define UseBatchExportReturn interface
  - Implement state machine: idle → generating → completed | error
  - Add canExport derived state based on batch status
  - Purpose: State management for batch export UI
  - _Leverage: `apps/web/src/hooks/useExport.ts` ExportState pattern_
  - _Requirements: 3.1, 4.1_

- [x] 20. Implement exportBatch function with polling
  - File: `apps/web/src/hooks/useBatchExport.ts`
  - Call requestBatchExport API
  - If generating, poll getBatchExportStatus with exponential backoff
  - On completion, download file using blob approach
  - Purpose: Execute batch export with async support
  - _Leverage: `useExport.ts` pollForReport(), downloadFile() functions_
  - _Requirements: 1.5, 1.6, 2.5, 2.6_

- [x] 21. Add cancel, reset, and success confirmation to hook
  - File: `apps/web/src/hooks/useBatchExport.ts`
  - Implement cancel() with cancelledRef pattern
  - Implement reset() to return to idle state
  - Add showSuccessConfirmation state with auto-dismiss (2s)
  - Purpose: Complete hook functionality for UI control
  - _Leverage: `useExport.ts` cancel/reset patterns_
  - _Requirements: 4.2, 4.3, 4.5_

---

## Phase 8: Frontend - BatchExport Component

- [x] 22. Enhance BatchExport component with useBatchExport hook
  - File: `apps/web/src/components/features/batch/BatchExport.tsx`
  - Replace existing implementation with useBatchExport hook
  - Add format selection (PDF/JSON buttons)
  - Disable buttons when batch not completed
  - Purpose: Connect UI to new export hook
  - _Leverage: Existing BatchExport component_
  - _Requirements: 3.1, 3.2_

- [x] 23. Add accessibility features to BatchExport
  - File: `apps/web/src/components/features/batch/BatchExport.tsx`
  - Add aria-label to export buttons
  - Add tooltip for disabled state explanation
  - Add screen reader live region for status announcements
  - Purpose: Meet WCAG 2.2 AA accessibility requirements
  - _Leverage: ExportModal accessibility patterns_
  - _Requirements: 3.4_

- [x] 24. Integrate ExportModal for status display
  - File: `apps/web/src/components/features/batch/BatchExport.tsx`
  - Show ExportModal during generation
  - Display success confirmation with auto-close
  - Show error state with retry option
  - Purpose: Consistent modal UX matching single scan export
  - _Leverage: `apps/web/src/components/features/export/ExportModal.tsx`_
  - _Requirements: 3.5, 4.1, 4.2, 4.4, 4.5_

---

## Phase 9: Frontend - Admin Integration

- [x] 25. Add export functionality to admin batch detail page
  - File: `apps/web/src/app/admin/batches/[id]/page.tsx`
  - Import and use useBatchExport hook (or admin variant)
  - Add export buttons (PDF/JSON) to batch detail header
  - Purpose: Enable admin batch export from detail page
  - _Leverage: Existing admin batch detail page structure_
  - _Requirements: 3.2, 5.1_

---

## Phase 10: Testing

- [x] 26. Add unit tests for batch JSON exporter
  - File: `apps/worker/src/processors/reporter/batch-json-exporter.test.ts`
  - Test generateBatchJsonReport with various inputs
  - Test JSON structure matches specification
  - Test sanitization of HTML content
  - Purpose: Verify JSON export correctness
  - _Leverage: `apps/worker/src/processors/reporter/pdf-generator.test.ts` patterns_
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 27. Add unit tests for batch export service
  - File: `apps/api/src/modules/batches/__tests__/batch-export.service.test.ts`
  - Test requestBatchExport flow (existing report, new generation)
  - Test getBatchExportStatus responses
  - Test error handling scenarios
  - Purpose: Verify service logic
  - _Leverage: Existing service test patterns_
  - _Requirements: 1.1, 2.1, 4.1_

- [x] 28. Add unit tests for useBatchExport hook
  - File: `apps/web/src/hooks/useBatchExport.test.ts`
  - Test state transitions (idle → generating → completed)
  - Test cancellation behavior
  - Test polling mechanism
  - Purpose: Verify hook behavior
  - _Leverage: `apps/web/src/hooks/useExport.test.ts` patterns_
  - _Requirements: 3.1, 4.1, 4.3_

- [x] 29. Add E2E test for batch export flow
  - File: `apps/web/e2e/batch-export.spec.ts`
  - Test complete user flow: view batch → click export → download
  - Test disabled state for incomplete batch
  - Test cancellation during generation
  - Purpose: Verify end-to-end functionality
  - _Leverage: `apps/web/e2e/batch-scan.spec.ts` patterns_
  - _Requirements: All_

- [x] 30. Add E2E test for admin batch export
  - File: `apps/web/e2e/admin-batch-export.spec.ts`
  - Test admin can export any batch
  - Test export works for guest session batches
  - Purpose: Verify admin export functionality
  - _Leverage: `apps/web/e2e/admin-batch-detail.spec.ts` patterns_
  - _Requirements: 5.1, 5.2, 5.4_

---

## Task Dependencies

```
Phase 1 (Schema)
    └── Phase 2 (JSON Exporter)
    └── Phase 3 (Report Job)
         └── Phase 4 (Export Service)
              └── Phase 5 (API Endpoints)
                   └── Phase 6 (API Client)
                        └── Phase 7 (Hook)
                             └── Phase 8 (Component)
                             └── Phase 9 (Admin)
                                  └── Phase 10 (Testing)
```

---

*Tasks Version: 1.0*
*Created: December 2024*
*Total Tasks: 30*
