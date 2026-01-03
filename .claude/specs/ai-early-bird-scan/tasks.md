# AI Early Bird Scan - Implementation Plan

## Task Overview

This implementation plan breaks down the AI Early Bird Scan feature into atomic, agent-friendly tasks. The feature extends existing Scan and Issue models with AI fields, adds a new AiCampaign model, and integrates AI enhancement opt-in into the existing scan workflow.

**Total Tasks:** 73 atomic tasks across 11 phases
**Estimated Implementation:** Sequential execution by AI agents

## Steering Document Compliance

### Structure.md Conventions
- New module: `apps/api/src/modules/ai-campaign/`
- File naming: `ai-campaign.service.ts`, `ai-campaign.controller.ts`, etc.
- Frontend components: `apps/web/src/components/features/ai/`
- Hooks: `apps/web/src/hooks/useCampaignStatus.ts`
- Tests colocated with source files

### Tech.md Patterns
- Three-layer architecture: Controller → Service → Repository
- Prisma ORM for database operations
- Zod for validation schemas
- BullMQ for email queue
- Redis for caching with key builder pattern

## Atomic Task Requirements

**Each task meets these criteria:**
- **File Scope**: 1-3 related files maximum
- **Time Boxing**: 15-30 minutes per task
- **Single Purpose**: One testable outcome
- **Specific Files**: Exact paths specified
- **Agent-Friendly**: Clear input/output

---

## Phase 1: Database Schema & Migrations

### Task 1.1a: Add core AI fields to Scan model
- [x] **Files**: `apps/api/prisma/schema.prisma`
- Add `aiEnabled Boolean @default(false)` field
- Add `aiStatus AiStatus?` field (enum reference - defined in Task 1.2)
- Add `aiSummary String? @db.Text` field
- Add `aiRemediationPlan String? @db.Text` field
- Add `aiProcessedAt DateTime?` field
- _Leverage: existing Scan model structure in schema.prisma_
- _Requirements: REQ-5 AC 1_

### Task 1.1b: Add AI token tracking fields to Scan model
- [x] **Files**: `apps/api/prisma/schema.prisma`
- Add `aiInputTokens Int?` field
- Add `aiOutputTokens Int?` field
- Add `aiTotalTokens Int?` field
- Add `aiModel String?` field
- Add `aiProcessingTime Int?` field (seconds)
- _Leverage: existing Scan model structure_
- _Requirements: REQ-5 AC 1_

### Task 1.1c: Add AI indexes to Scan model
- [x] **Files**: `apps/api/prisma/schema.prisma`
- Add `@@index([aiEnabled, aiStatus])` for filtering AI scans
- Add `@@index([aiEnabled, createdAt])` for sorting by date
- _Leverage: existing index patterns_
- _Requirements: REQ-5 AC 1_

### Task 1.2: Add AiStatus enum to Prisma schema
- [x] **Files**: `apps/api/prisma/schema.prisma`
- Add `enum AiStatus { PENDING DOWNLOADED PROCESSING COMPLETED FAILED }`
- Place after existing enum definitions
- _Leverage: existing ScanStatus enum pattern_
- _Requirements: REQ-5 AC 1_

### Task 1.3: Add AI fields to Issue model in Prisma schema
- [x] **Files**: `apps/api/prisma/schema.prisma`
- Add `aiExplanation String? @db.Text` field
- Add `aiFixSuggestion String? @db.Text` field
- Add `aiPriority Int?` field (1-10 business impact score)
- _Leverage: existing Issue model structure_
- _Requirements: REQ-5 AC 2_

### Task 1.4: Create AiCampaign model in Prisma schema
- [x] **Files**: `apps/api/prisma/schema.prisma`
- Create `model AiCampaign` with fields: id, name, totalTokenBudget, usedTokens, reservedSlots, avgTokensPerScan, status, startsAt, endsAt, createdAt, updatedAt
- Add `enum AiCampaignStatus { ACTIVE PAUSED DEPLETED ENDED }`
- Add relation to AiCampaignAudit
- Add index `@@index([status, startsAt])`
- _Requirements: REQ-5 AC 3_

### Task 1.5: Create AiCampaignAudit model in Prisma schema
- [x] **Files**: `apps/api/prisma/schema.prisma`
- Create `model AiCampaignAudit` with fields: id, campaignId, action, details (Json), adminId, createdAt
- Add relation to AiCampaign
- Add index `@@index([campaignId, createdAt])`
- _Leverage: existing audit pattern if any_
- _Requirements: REQ-8 AC 3_

### Task 1.6: Generate and apply Prisma migration
- [x] **Files**: `apps/api/prisma/migrations/[timestamp]_add_ai_early_bird/migration.sql`
- Run `pnpm prisma migrate dev --name add_ai_early_bird`
- Verify migration creates all AI fields and new models
- Run `pnpm prisma generate` to update client
- _Leverage: existing migration patterns_
- _Requirements: REQ-5_

---

## Phase 2: Backend - AI Campaign Module

### Task 2.1: Create AI Campaign types file
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.types.ts`
- Define `CampaignStatusResponse` interface
- Define `SlotReservationResult` interface
- Define `CampaignMetrics` interface
- Define `UpdateCampaignData` interface
- Define `AiScanFilters` interface
- Define `ImportResult` interface
- Export all types
- _Leverage: apps/api/src/modules/admin/admin.types.ts patterns_
- _Requirements: REQ-3, REQ-4_

### Task 2.2: Create AI Campaign error classes
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.errors.ts`
- Create `AiCampaignError` class extending Error with `code` property
- Create `AiCampaignErrorCode` enum with: CAMPAIGN_NOT_FOUND, CAMPAIGN_INACTIVE, QUOTA_DEPLETED, INVALID_CSV, SCAN_NOT_FOUND, SCAN_NOT_AI_ENABLED, IMPORT_FAILED
- _Leverage: apps/api/src/modules/scans/scan.repository.ts ScanRepositoryError pattern_
- _Requirements: Design error handling section_

### Task 2.3: Create AI Campaign Zod schemas
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.schema.ts`
- Create `updateCampaignSchema` with totalTokenBudget, avgTokensPerScan, status validation
- Create `aiScanFiltersSchema` with status array, dateFrom, dateTo, cursor, limit
- Create `csvImportRowSchema` with scan_id, ai_summary, tokens_used validation
- _Leverage: apps/api/src/modules/admin/admin.schema.ts patterns_
- _Requirements: REQ-3, REQ-4_

### Task 2.4: Create AI Campaign repository
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.repository.ts`
- Create `getActiveCampaign()` - fetch campaign where status=ACTIVE and startsAt <= now
- Create `updateCampaignTokens(campaignId, tokensUsed)` - atomic token update
- Create `createAuditLog(campaignId, action, details, adminId)` - audit logging
- Create `getCampaignById(id)` - fetch single campaign
- _Leverage: apps/api/src/modules/scans/scan.repository.ts patterns_
- _Requirements: REQ-3, REQ-8_

### Task 2.5: Create AI Campaign service - core methods
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.service.ts`
- Create `AiCampaignService` class
- Implement `getCampaignStatus()` with Redis caching (5 min TTL)
- Implement urgency level calculation based on quota percentage
- Add private `calculateSlotsRemaining()` helper
- _Leverage: apps/api/src/modules/scans/scan.service.ts caching pattern, apps/api/src/shared/constants/redis-keys.ts_
- _Requirements: REQ-3 AC 1-3_

### Task 2.6: Create AI Campaign service - slot reservation
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.service.ts` (continue)
- Implement `checkAndReserveSlotAtomic()` using Redis Lua script
- Implement `releaseSlot(scanId)` for failed scans
- Add Redis key initialization from database on cache miss
- _Leverage: Redis client from apps/api/src/config/redis.ts_
- _Requirements: REQ-3 AC 2, Design atomic slot reservation_

### Task 2.7: Create AI Campaign service - token management
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.service.ts` (continue)
- Implement `deductTokens(scanId, tokensUsed)` - update DB and invalidate cache
- Implement `getCampaignMetrics()` for admin dashboard
- Implement `updateCampaign(data)` with audit logging
- _Leverage: existing repository methods_
- _Requirements: REQ-3 AC 2, REQ-8 AC 1_

### Task 2.8: Create AI Campaign controller
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.controller.ts`
- Register routes with Fastify
- Create `GET /api/v1/ai-campaign/status` - public endpoint with rate limiting
- Create `GET /api/v1/admin/ai-campaign` - admin metrics endpoint
- Create `PATCH /api/v1/admin/ai-campaign` - update campaign
- Create `POST /api/v1/admin/ai-campaign/pause` and `/resume` endpoints
- _Leverage: apps/api/src/modules/admin/admin.controller.ts middleware pattern_
- _Requirements: REQ-3 AC 4, REQ-8 AC 3_

### Task 2.9: Add Redis keys for AI Campaign
- [x] **Files**: `apps/api/src/shared/constants/redis-keys.ts`
- Add `AI_CAMPAIGN_STATUS` key builder with 5 min TTL
- Add `AI_CAMPAIGN_SLOTS` key builder with 1 hour TTL
- Add `AI_SCAN_STATUS` key builder with 24 hour TTL
- _Leverage: existing RedisKeys pattern_
- _Requirements: Design Redis cache keys section_

### Task 2.10: Create AI Campaign module index
- [x] **Files**: `apps/api/src/modules/ai-campaign/index.ts`
- Export all types, schemas, service, controller
- Create module registration function for Fastify
- _Leverage: apps/api/src/modules/admin/index.ts pattern_
- _Requirements: Structure.md module pattern_

---

## Phase 3: Backend - AI Queue Service

### Task 3.1: Create AI Queue service - export functionality
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-queue.service.ts`
- Create `AiQueueService` class
- Implement `exportPendingScans()` - query scans with aiEnabled=true, aiStatus=PENDING
- Format CSV with columns: scan_id, url, email, wcag_level, issues_json, created_at, page_title
- Update exported scans to aiStatus=DOWNLOADED atomically
- Return { csv: string, count: number, scanIds: string[] }
- _Leverage: existing Prisma transaction patterns_
- _Requirements: REQ-4 AC 1-2_

### Task 3.2a: Create AI Queue service - CSV parsing and validation
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-queue.service.ts` (continue)
- Implement `parseAndValidateCsv(csv: string)` helper method
- Parse CSV using csv-parse or similar library
- Validate each row against csvImportRowSchema (from Task 2.3)
- Return array of validated row objects or throw validation errors
- _Leverage: apps/api/src/modules/ai-campaign/ai-campaign.schema.ts_
- _Requirements: REQ-4 AC 3_

### Task 3.2b: Create AI Queue service - Scan record validation
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-queue.service.ts` (continue)
- Implement `validateScanEligibility(scanId: string)` helper
- Check scan exists in database
- Verify aiEnabled=true and aiStatus=DOWNLOADED
- Return validation result with error message if invalid
- _Leverage: existing Prisma patterns_
- _Requirements: REQ-4 AC 3-4_

### Task 3.2c: Create AI Queue service - record updates
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-queue.service.ts` (continue)
- Implement `updateScanWithAiResults(tx, scanId, aiData)` helper
- Update Scan with aiSummary, aiRemediationPlan, aiProcessedAt, token fields
- Implement `updateIssuesWithAi(tx, scanId, aiIssuesJson)` helper
- Update Issue records with aiExplanation, aiFixSuggestion, aiPriority
- Use Prisma transaction (tx) for atomic updates
- _Leverage: existing Prisma transaction patterns_
- _Requirements: REQ-5 AC 1-2_

### Task 3.2d: Create AI Queue service - import orchestration
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-queue.service.ts` (continue)
- Implement main `importAiResults(csv: string)` method
- Use prisma.$transaction for atomic all-or-nothing import
- For each row: validate scan → update records → track success/failure
- Call AiCampaignService.deductTokens() for total tokens used
- Set aiStatus=COMPLETED for successful rows
- Queue email job via QueueService for each completed scan
- Return ImportResult with success/failed counts and errors
- _Leverage: apps/api/src/shared/queue/queue.service.ts for email job_
- _Requirements: REQ-4 AC 3-4_

### Task 3.3: Create AI Queue service - queue management
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-queue.service.ts` (continue)
- Implement `getQueueStats()` - counts by aiStatus, total tokens used
- Implement `listAiScans(filters)` - paginated list with status/date filters
- Implement `retryFailedScan(scanId)` - reset aiStatus to PENDING
- _Leverage: apps/api/src/modules/scans/scan.repository.ts pagination pattern_
- _Requirements: REQ-4 AC 5, REQ-8 AC 2_

### Task 3.4: Create AI Queue controller
- [x] **Files**: `apps/api/src/modules/ai-campaign/ai-queue.controller.ts`
- Create `GET /api/v1/admin/ai-queue` - list AI scans with filters
- Create `GET /api/v1/admin/ai-queue/export` - download pending scans CSV
- Create `POST /api/v1/admin/ai-queue/import` - upload AI results CSV (multipart)
- Create `GET /api/v1/admin/ai-queue/stats` - queue statistics
- Create `POST /api/v1/admin/ai-queue/:scanId/retry` - retry failed scan
- Add admin authentication middleware to all routes
- _Leverage: apps/api/src/modules/admin/admin.controller.ts patterns_
- _Requirements: REQ-4, REQ-8 AC 2_

---

## Phase 4: Backend - Extend Scan Module

### Task 4.1: Extend Scan types with AI fields
- [x] **Files**: `apps/api/src/modules/scans/scan.types.ts` (create if not exists)
- Add `aiEnabled?: boolean` to CreateScanData interface
- Extend ScanWithResult to include all AI fields
- Add `AiScanData` interface for AI-specific response
- _Leverage: existing type definitions_
- _Requirements: REQ-5_

### Task 4.2: Extend Scan repository with AI queries
- [x] **Files**: `apps/api/src/modules/scans/scan.repository.ts`
- Update `createScan()` to accept aiEnabled parameter
- Add `updateAiStatus(scanId, status)` method
- Add `getAiStatus(scanId)` method returning AI fields only
- _Leverage: existing repository methods_
- _Requirements: REQ-1 AC 4, REQ-6_

### Task 4.3: Extend Scan service for AI opt-in
- [x] **Files**: `apps/api/src/modules/scans/scan.service.ts`
- Modify `createScan()` to handle aiEnabled flag
- If aiEnabled=true: call `campaignService.checkAndReserveSlotAtomic()`
- If slot reserved: set aiStatus=PENDING, else throw error or disable AI
- Add `getAiStatus(scanId)` method for polling endpoint
- _Leverage: inject AiCampaignService dependency_
- _Requirements: REQ-1 AC 4-5, REQ-6 AC 1_

### Task 4.4: Extend Scan controller with AI status endpoint
- [x] **Files**: `apps/api/src/modules/scans/scan.controller.ts`
- Add `GET /api/v1/scans/:id/ai-status` endpoint
- Return aiStatus, aiSummary (if completed), email confirmation
- Add appropriate caching headers
- _Leverage: existing controller patterns_
- _Requirements: REQ-6 AC 2_

### Task 4.5: Extend Scan schema for AI validation
- [x] **Files**: `apps/api/src/modules/scans/scan.schema.ts`
- Add `aiEnabled: z.boolean().optional()` to createScanSchema
- Ensure email is required when aiEnabled=true
- _Leverage: existing Zod schema patterns_
- _Requirements: REQ-1 AC 2_

---

## Phase 5: Backend - Email & Security

### Task 5.0: Create email encryption utility
- [x] **Files**: `apps/api/src/shared/utils/encryption.ts`
- Create `encryptEmail(email: string)` function using AES-256-GCM
- Create `decryptEmail(encryptedEmail: string)` function
- Use `EMAIL_ENCRYPTION_KEY` from environment variables
- Format: `iv:authTag:encryptedData` (all hex encoded)
- _Leverage: Node.js crypto module_
- _Requirements: Design Security - Email Encryption Implementation_

### Task 5.1: Create AI report email template
- [x] **Files**: `apps/worker/src/processors/notifier/email-templates.ts`
- Add `AiScanCompleteEmailData` interface extending existing ScanCompleteEmailData
- Add aiSummary, topPriorityFixes, estimatedFixTime, remediation preview fields
- Create `getAiScanCompleteEmail(data)` function returning EmailContent
- Include AI sections with visual distinction (badges, icons)
- Include link to full web report
- _Leverage: existing getScanCompleteEmail template pattern, escapeHtml utility_
- _Requirements: REQ-7 AC 1-2_

### Task 5.2: Add AI email job type to queue
- [x] **Files**: `apps/api/src/shared/queue/types.ts`
- Add `'ai_scan_complete'` to EmailJobData type union
- Add `AiEmailJobData` interface with scanId, email, aiSummary fields
- _Leverage: existing EmailJobData pattern_
- _Requirements: REQ-7_

### Task 5.3: Handle AI email in send-email processor
- [x] **Files**: `apps/worker/src/processors/send-email.processor.ts`
- Add case for `'ai_scan_complete'` email type
- Fetch scan with AI data from database
- Call `getAiScanCompleteEmail()` template
- Send via EmailRouter
- _Leverage: existing email processing pattern_
- _Requirements: REQ-7 AC 2_

### Task 5.4: Create AiEmailService for report generation
- [x] **Files**: `apps/worker/src/processors/notifier/ai-email.service.ts`
- Create `AiEmailService` class
- Implement `generateCombinedReportEmail(scan: ScanWithAiResult)` method
- Fetch scan with issues and AI data from database
- Build email content with combined standard + AI sections
- Implement `queueAiReportEmail(scanId, email)` method
- Add to QueueService for email delivery
- _Leverage: apps/worker/src/processors/notifier/email-templates.ts_
- _Requirements: REQ-7 AC 1-2_

---

## Phase 6: Frontend - Hooks & API

### Task 6.1: Add AI campaign API functions
- [x] **Files**: `apps/web/src/lib/api.ts`
- Add `getCampaignStatus()` function calling GET /api/v1/ai-campaign/status
- Add `getAiStatus(scanId)` function calling GET /api/v1/scans/:id/ai-status
- Define response types inline or import from shared types
- _Leverage: existing API client pattern_
- _Requirements: REQ-1, REQ-6_

### Task 6.2: Create useCampaignStatus hook
- [x] **Files**: `apps/web/src/hooks/useCampaignStatus.ts`
- Create hook using React Query with 30s stale time
- Return { status, isLoading, error, refetch }
- Handle campaign inactive/depleted states
- _Leverage: apps/web/src/hooks/useScan.ts patterns_
- _Requirements: REQ-1 AC 1, REQ-3_

### Task 6.3: Create useAiScanStatus hook
- [x] **Files**: `apps/web/src/hooks/useAiScanStatus.ts`
- Implement polling with exponential backoff (30s initial, 2min max)
- Stop polling when status is COMPLETED or FAILED
- Handle network errors with retry logic (3 retries, 5s delay)
- Return { aiStatus, aiData, isPolling, stopPolling }
- _Leverage: Design polling mechanism specification_
- _Requirements: REQ-6 AC 2, AC 5_

### Task 6.4: Extend CreateScanRequest type
- [x] **Files**: `apps/web/src/lib/api.ts`
- Add `aiEnabled?: boolean` to CreateScanRequest interface
- Update createScan function to pass aiEnabled
- _Requirements: REQ-1 AC 4_

---

## Phase 7: Frontend - Components

### Task 7.1: Create AiEnhancementSection component
- [x] **Files**: `apps/web/src/components/features/ai/AiEnhancementSection.tsx`
- Create component with checkbox "Enable AI-Powered Analysis"
- Display Early Bird badge and campaign status (slots remaining)
- Show AI benefits description and email delivery warning
- Call useCampaignStatus hook for quota display
- Props: enabled, onEnabledChange, onEmailRequired, preSelected
- Handle depleted state (disabled checkbox, "Campaign ended" message)
- _Leverage: apps/web/src/components/features/scan/ScanForm.tsx patterns, shadcn/ui components_
- _Requirements: REQ-1 AC 1, AC 6-7_

### Task 7.2: Create urgency messaging component
- [x] **Files**: `apps/web/src/components/features/ai/CampaignQuotaDisplay.tsx`
- Display progress bar with slots remaining
- Apply urgency styling based on level (normal, limited, almost_gone, final)
- Show appropriate messaging per quota threshold
- _Leverage: shadcn/ui Progress component_
- _Requirements: REQ-3 AC 3_

### Task 7.3a: Add AI state management to ScanForm
- [x] **Files**: `apps/web/src/components/features/scan/ScanForm.tsx`
- Add `aiEnabled` state with useState(false)
- Add `setEmailRequired` callback for AiEnhancementSection
- Import AiEnhancementSection component
- Render AiEnhancementSection below URL input with state props
- Conditionally make email field required when aiEnabled=true
- _Leverage: existing form state management_
- _Requirements: REQ-1 AC 2-3_

### Task 7.3b: Add query param detection for AI pre-selection
- [x] **Files**: `apps/web/src/components/features/scan/ScanForm.tsx`
- Use useSearchParams() to detect ?ai=1 query parameter
- Pre-select AI checkbox if ?ai=1 present
- Focus email input when pre-selected
- Pass preSelected prop to AiEnhancementSection
- _Leverage: Next.js useSearchParams hook_
- _Requirements: REQ-2 AC 4_

### Task 7.3c: Extend form submission for AI and progress messages
- [x] **Files**: `apps/web/src/components/features/scan/ScanForm.tsx`
- Pass aiEnabled to createScan API call
- Update progress messages to include AI status:
  - 95-99%: "Allocating resources for AI analysis..." (when aiEnabled and scan completing)
- Handle quota depleted error (409) gracefully with fallback message
- _Leverage: existing form submission logic_
- _Requirements: REQ-1 AC 4-6_

### Task 7.4: Create AiStatusBadge component
- [x] **Files**: `apps/web/src/components/features/ai/AiStatusBadge.tsx`
- Display status icon and message based on aiStatus
- PENDING: spinner + "Allocating resources..."
- DOWNLOADED: clock + "Queued for processing..."
- PROCESSING: spinner + "AI analyzing..."
- COMPLETED: checkmark + "AI analysis complete"
- FAILED: error + "AI unavailable" with retry option
- Include email confirmation text
- _Leverage: shadcn/ui Badge, Spinner components_
- _Requirements: REQ-6 AC 2_

### Task 7.5: Create AiIssueEnhancement component
- [x] **Files**: `apps/web/src/components/features/ai/AiIssueEnhancement.tsx`
- Display AI explanation with plain-language description
- Display fix suggestion with code examples
- Display priority score (1-10) with visual indicator
- Show skeleton loader when AI pending
- Include AI badge to distinguish from standard content
- _Leverage: existing issue display components_
- _Requirements: REQ-6 AC 3-4_

### Task 7.6: Create AiSummarySection component
- [x] **Files**: `apps/web/src/components/features/ai/AiSummarySection.tsx`
- Display executive summary (aiSummary)
- Display remediation roadmap (aiRemediationPlan)
- Include AI attribution badge
- Collapsible/expandable sections
- _Leverage: shadcn/ui Accordion component_
- _Requirements: REQ-6 AC 4_

### Task 7.7a: Add AI status tracking to results page
- [x] **Files**: `apps/web/src/app/scan/[id]/page.tsx`
- Import useAiScanStatus hook
- Call useAiScanStatus(scanId, scan.aiEnabled) to get AI status
- Import AiStatusBadge component
- Display AiStatusBadge in status section alongside standard scan status
- Show email confirmation: "AI results will also be sent to {email}"
- _Leverage: existing results page structure_
- _Requirements: REQ-6 AC 1-2, AC 6_

### Task 7.7b: Add AI summary section to results page
- [x] **Files**: `apps/web/src/app/scan/[id]/page.tsx`
- Import AiSummarySection component
- Conditionally render AiSummarySection when aiStatus=COMPLETED
- Pass aiSummary and aiRemediationPlan from aiData to component
- Position below status section, above issue list
- _Leverage: existing results page layout_
- _Requirements: REQ-6 AC 4_

### Task 7.7c: Integrate AI enhancements into issue display
- [x] **Files**: `apps/web/src/app/scan/[id]/page.tsx`, `apps/web/src/components/features/results/IssueCard.tsx`, `apps/web/src/components/features/results/IssueList.tsx`, `apps/web/src/lib/api.ts`
- Import AiIssueEnhancement component
- Map aiData.issues to match with existing issues by ID
- Render AiIssueEnhancement within each issue card
- Show skeleton loader when aiStatus is PENDING/DOWNLOADED/PROCESSING
- Show full AI content when aiStatus=COMPLETED
- _Leverage: existing issue list rendering_
- _Requirements: REQ-6 AC 3-4_

### Task 7.8: Create component index file
- [x] **Files**: `apps/web/src/components/features/ai/index.ts`
- Export all AI components
- _Requirements: Structure.md conventions_

---

## Phase 8: Frontend - Early Bird Landing Page

### Task 8.1: Create Early Bird landing page
- [x] **Files**: `apps/web/src/app/early-bird/page.tsx`
- Create hero section with value proposition
- Add "How it works" section (Scan → AI Analysis → Email)
- List feature benefits (explanations, fix suggestions, priority ranking)
- Display campaign quota with CampaignQuotaDisplay component
- Add CTA button linking to scan form with ?ai=1 parameter
- Handle campaign ended state with waitlist signup
- _Leverage: existing page layout patterns_
- _Requirements: REQ-2 AC 1-4_

### Task 8.2: Add Early Bird route metadata
- [x] **Files**: `apps/web/src/app/early-bird/layout.tsx`
- Add page metadata (title, description) for SEO
- Add OpenGraph tags for social sharing
- _Leverage: Next.js metadata patterns_
- _Requirements: REQ-2_

---

## Phase 9: Admin Dashboard

### Task 9.1: Add AI campaign API to admin client
- [x] **Files**: `apps/web/src/lib/admin-api.ts`
- Add `getAiCampaignMetrics()` function
- Add `getAiQueueList(filters)` function
- Add `exportAiQueue()` function returning CSV blob
- Add `importAiResults(file)` function with FormData
- Add `pauseCampaign()` and `resumeCampaign()` functions
- Add `retryAiScan(scanId)` function
- _Leverage: existing admin API patterns_
- _Requirements: REQ-4, REQ-8_

### Task 9.2: Create useAdminAiCampaign hook
- [x] **Files**: `apps/web/src/hooks/useAdminAiCampaign.ts`
- Fetch campaign metrics with React Query
- Return { metrics, isLoading, error, refetch }
- _Leverage: apps/web/src/hooks/useAdminBatches.ts pattern_
- _Requirements: REQ-8 AC 1_

### Task 9.3: Create useAdminAiQueue hook
- [x] **Files**: `apps/web/src/hooks/useAdminAiQueue.ts`
- Fetch AI scan list with filters
- Handle CSV export download
- Handle CSV import with progress
- Return { scans, stats, exportCsv, importCsv, retryFailedScan }
- _Leverage: existing admin hooks_
- _Requirements: REQ-4 AC 5, REQ-8 AC 2_

### Task 9.4: Create AI Campaign dashboard component
- [x] **Files**: `apps/web/src/components/admin/AiCampaignDashboard.tsx`
- Display campaign overview card (name, status, dates)
- Display token usage chart (used vs remaining)
- Display scan count metrics (completed, pending, failed)
- Display average tokens per scan
- Show estimated remaining scans
- _Leverage: apps/web/src/components/admin/DashboardCharts.tsx patterns_
- _Requirements: REQ-8 AC 1_

### Task 9.5a: Create AI Queue table base component
- [x] **Files**: `apps/web/src/components/admin/AiQueueTable.tsx`
- Create basic table component with columns: Scan ID, URL, Email, Status, Tokens, Requested At, Processed At
- Accept scans array and loading state as props
- Add sortable column headers
- Apply status badge styling (color-coded by AI status)
- _Leverage: apps/web/src/components/admin/ScanTable.tsx pattern_
- _Requirements: REQ-8 AC 2_

### Task 9.5b: Add filters to AI Queue table
- [x] **Files**: `apps/web/src/components/admin/AiQueueTable.tsx` (continue)
- Add status filter dropdown (PENDING, DOWNLOADED, COMPLETED, FAILED, All)
- Add date range picker filter (from/to dates)
- Wire filters to parent component via onChange callback
- _Leverage: apps/web/src/components/admin/BatchFilters.tsx pattern_
- _Requirements: REQ-8 AC 2_

### Task 9.5c: Add CSV export/import to AI Queue table
- [x] **Files**: `apps/web/src/components/admin/AiQueueTable.tsx` (continue)
- Add "Export Pending" button that calls exportCsv() from hook
- Add "Import Results" button with hidden file input
- Handle file selection and call importCsv(file) from hook
- Show import progress/error feedback
- _Leverage: existing file upload patterns_
- _Requirements: REQ-4 AC 1-4_

### Task 9.5d: Add retry action to AI Queue table
- [x] **Files**: `apps/web/src/components/admin/AiQueueTable.tsx` (continue)
- Add action column with retry button (visible for FAILED status only)
- Call retryFailedScan(scanId) from hook on click
- Show loading state during retry
- Refresh table after successful retry
- _Leverage: existing action button patterns_
- _Requirements: REQ-4 AC 5_

### Task 9.6: Create AI admin page
- [x] **Files**: `apps/web/src/app/admin/ai-campaign/page.tsx`
- Layout with AiCampaignDashboard at top
- AiQueueTable below for queue management
- Add pause/resume campaign toggle
- _Leverage: existing admin page patterns_
- _Requirements: REQ-8_

### Task 9.7: Add AI campaign link to admin sidebar
- [x] **Files**: `apps/web/src/components/admin/AdminSidebar.tsx`
- Add "AI Campaign" navigation item with icon
- Link to /admin/ai-campaign
- _Leverage: existing sidebar navigation_
- _Requirements: REQ-8_

---

## Phase 10: Testing

### Task 10.1: Create AI Campaign service unit tests
- [ ] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.service.test.ts`
- Test getCampaignStatus() with cache hit/miss scenarios
- Test checkAndReserveSlotAtomic() with available/depleted slots
- Test releaseSlot() restores slot count
- Test deductTokens() updates DB and invalidates cache
- Test urgency level calculation
- Mock Prisma and Redis
- _Leverage: existing test patterns_
- _Requirements: REQ-3_

### Task 10.2: Create AI Queue service unit tests
- [ ] **Files**: `apps/api/src/modules/ai-campaign/ai-queue.service.test.ts`
- Test exportPendingScans() generates correct CSV
- Test exportPendingScans() updates status to DOWNLOADED
- Test importAiResults() with valid CSV
- Test importAiResults() with invalid scan_id (should fail)
- Test importAiResults() atomic rollback on error
- Test retryFailedScan() resets status
- _Leverage: existing test patterns_
- _Requirements: REQ-4_

### Task 10.3: Create AI Campaign controller tests
- [ ] **Files**: `apps/api/src/modules/ai-campaign/ai-campaign.controller.test.ts`
- Test public status endpoint returns correct data
- Test admin endpoints require authentication
- Test pause/resume updates campaign status
- _Leverage: existing controller test patterns_
- _Requirements: REQ-3, REQ-8_

### Task 10.4: Create frontend hook tests
- [ ] **Files**: `apps/web/src/hooks/useCampaignStatus.test.ts`, `apps/web/src/hooks/useAiScanStatus.test.ts`
- Test useCampaignStatus fetches and caches status
- Test useAiScanStatus polling behavior
- Test polling stops on COMPLETED/FAILED
- Test error retry logic
- _Leverage: existing hook test patterns_
- _Requirements: REQ-1, REQ-6_

### Task 10.5: Create E2E test for AI scan flow
- [ ] **Files**: `apps/web/e2e/ai-early-bird.spec.ts`
- Test campaign status displays on scan form
- Test AI checkbox enables email requirement
- Test scan submission with AI creates PENDING status
- Test results page shows AI status badge
- Test landing page displays quota
- _Leverage: existing Playwright E2E patterns_
- _Requirements: REQ-1, REQ-2, REQ-6_

### Task 10.6: Create E2E test for admin AI queue
- [ ] **Files**: `apps/web/e2e/ai-admin-queue.spec.ts`
- Test admin can view AI campaign metrics
- Test admin can export pending scans
- Test admin can import AI results
- Test admin can pause/resume campaign
- _Leverage: existing admin E2E patterns_
- _Requirements: REQ-4, REQ-8_

### Task 10.7: Create E2E error scenario tests
- [ ] **Files**: `apps/web/e2e/ai-early-bird-errors.spec.ts`
- Test quota depletion during scan submission
- Test CSV import validation errors
- Test campaign ended state UI
- Test network error during AI status polling
- _Leverage: Design error scenario E2E tests_
- _Requirements: Design error handling_

---

## Phase 11: Integration & Finalization

### Task 11.1: Register AI Campaign module in API
- [ ] **Files**: `apps/api/src/index.ts`
- Import AI Campaign module
- Register routes with Fastify app
- _Leverage: existing module registration pattern_
- _Requirements: All_

### Task 11.2: Add environment variables
- [ ] **Files**: `apps/api/.env.example`, `apps/web/.env.example`
- Add `AI_EARLY_BIRD_ENABLED=false` feature flag
- Add `EMAIL_ENCRYPTION_KEY` placeholder
- Add documentation comments
- _Leverage: existing env patterns_
- _Requirements: Design migration strategy_

### Task 11.3: Add stale slot cleanup job
- [ ] **Files**: `apps/api/src/jobs/ai-stale-cleanup.job.ts`
- Create job to find PENDING scans older than 48 hours
- Release slots and set status to FAILED
- Schedule to run every 6 hours
- _Leverage: apps/api/src/jobs/batch-stale-checker.job.ts pattern_
- _Requirements: Design slot lifecycle management_

### Task 11.4: Create seed data for AI campaign
- [ ] **Files**: `apps/api/prisma/seed.ts` (modify)
- Add seed for initial AI campaign with test token budget
- Set campaign to ACTIVE status
- _Leverage: existing seed patterns_
- _Requirements: Development setup_

---

## Task Dependencies

```
Phase 1 (Schema) → Phase 2 (Campaign Module) → Phase 3 (Queue Service)
                                             ↘
Phase 4 (Extend Scan) ←                       Phase 5 (Email)
          ↓
Phase 6 (Frontend Hooks) → Phase 7 (Components) → Phase 8 (Landing Page)
          ↓
Phase 9 (Admin Dashboard)
          ↓
Phase 10 (Testing) → Phase 11 (Integration)
```

---

## Progress Tracking

- [ ] Phase 1: Database Schema (8 tasks: 1.1a, 1.1b, 1.1c, 1.2, 1.3, 1.4, 1.5, 1.6)
- [ ] Phase 2: AI Campaign Module (10 tasks: 2.1-2.10)
- [ ] Phase 3: AI Queue Service (7 tasks: 3.1, 3.2a-d, 3.3, 3.4)
- [ ] Phase 4: Extend Scan Module (5 tasks: 4.1-4.5)
- [ ] Phase 5: Email & Security (5 tasks: 5.0-5.4)
- [ ] Phase 6: Frontend Hooks (4 tasks: 6.1-6.4)
- [ ] Phase 7: Frontend Components (11 tasks: 7.1, 7.2, 7.3a-c, 7.4-7.6, 7.7a-c, 7.8)
- [ ] Phase 8: Landing Page (2 tasks: 8.1-8.2)
- [ ] Phase 9: Admin Dashboard (10 tasks: 9.1-9.4, 9.5a-d, 9.6-9.7)
- [ ] Phase 10: Testing (7 tasks: 10.1-10.7)
- [ ] Phase 11: Integration (4 tasks: 11.1-11.4)

**Total: 73 atomic tasks**

---

*Tasks Version: 1.1*
*Last Updated: January 2025*
*Aligned with: requirements.md v1.0, design.md v1.1*
*Validation: Addressed atomicity feedback from spec-task-validator*
