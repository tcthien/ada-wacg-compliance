# Implementation Plan: Email Scan Notification

## Task Overview

This implementation adds email notification capability for scan completion, extending the existing email infrastructure with AWS SES support and multi-provider routing. Tasks are organized in dependency order: configuration → providers → routing → templates → integration → testing.

## Steering Document Compliance

- **structure.md**: All files follow kebab-case naming, placed in appropriate module directories
- **tech.md**: Uses BullMQ for jobs, TypeScript interfaces, factory pattern for providers

## Atomic Task Requirements

Each task meets these criteria:
- **File Scope**: 1-3 related files
- **Time Boxing**: 15-30 minutes
- **Single Purpose**: One testable outcome
- **Specific Files**: Exact paths provided
- **Agent-Friendly**: Clear input/output

---

## Phase 1: Configuration

- [x] 1. Create email routing configuration loader
  - File: `apps/worker/src/config/email-routing.config.ts`
  - Define `EmailRoutingConfig` interface with defaultProvider and patterns
  - Implement `loadEmailRoutingConfig()` to read from .env variables
  - Parse `EMAIL_DEFAULT_PROVIDER`, `EMAIL_SENDGRID_PATTERNS`, `EMAIL_SES_PATTERNS`
  - Purpose: Load email provider routing configuration at startup
  - _Leverage: Existing env loading patterns in `apps/worker/src/config/`_
  - _Requirements: 6.2, 6.6_

- [x] 2. Add YAML configuration support (optional)
  - File: `apps/worker/src/config/email-routing.config.ts`
  - Add `js-yaml` dependency to worker package
  - Implement YAML parsing fallback if .env vars not set
  - Load from `config/email-routing.yml` if exists
  - Purpose: Support YAML-based configuration alternative
  - _Leverage: `js-yaml` package for parsing_
  - _Requirements: 6.2_

- [x] 3. Add email routing environment variables to .env.example
  - Files: `apps/worker/.env.example`, `apps/api/.env.example`
  - Add `EMAIL_DEFAULT_PROVIDER=SES`
  - Add `EMAIL_SENDGRID_PATTERNS=*@microsoft.com,*@outlook.com`
  - Add `EMAIL_SES_PATTERNS=*@*.edu`
  - Add AWS SES credentials placeholders
  - Purpose: Document required environment variables
  - _Leverage: Existing .env.example patterns_
  - _Requirements: 6.2_

---

## Phase 2: AWS SES Provider

- [x] 4. Install AWS SES SDK dependency
  - File: `apps/worker/package.json`
  - Add `@aws-sdk/client-ses` dependency
  - Run `pnpm install` to update lockfile
  - Purpose: Add AWS SES client library
  - _Requirements: 6.1_

- [x] 5. Create SESProvider class
  - File: `apps/worker/src/processors/notifier/ses-provider.ts`
  - Define `SESConfig` interface (region, accessKeyId?, secretAccessKey?, fromEmail)
  - Implement `SESProvider` class implementing `EmailProvider` interface
  - Constructor initializes SESClient with config
  - Purpose: AWS SES email provider implementation
  - _Leverage: `EmailProvider` interface from `email-sender.ts:22`_
  - _Requirements: 6.1_

- [x] 6. Implement SESProvider.send() method
  - File: `apps/worker/src/processors/notifier/ses-provider.ts`
  - Create `SendEmailCommand` with HTML and text body
  - Handle SES-specific error responses
  - Return `{ messageId }` on success
  - Purpose: Send emails via AWS SES
  - _Leverage: AWS SDK SendEmailCommand pattern_
  - _Requirements: 6.1_

- [x] 7. Add unit tests for SESProvider
  - File: `apps/worker/src/processors/notifier/ses-provider.test.ts`
  - Mock `@aws-sdk/client-ses` SESClient
  - Test successful send returns messageId
  - Test error handling for SES failures
  - Purpose: Verify SES provider functionality
  - _Leverage: Vitest mocking patterns_
  - _Requirements: 6.1_

---

## Phase 3: Email Router

- [x] 8. Install minimatch for pattern matching
  - File: `apps/worker/package.json`
  - Add `minimatch` dependency (^9.x)
  - Run `pnpm install` to update lockfile
  - Purpose: Enable glob pattern matching for email routing
  - _Requirements: 6.3_

- [x] 9. Create EmailRouter class
  - File: `apps/worker/src/processors/notifier/email-router.ts`
  - Define `EmailRouter` class with constructor taking `EmailRoutingConfig`
  - Initialize provider instances (SendGridProvider, SESProvider)
  - Store providers in Map by provider name
  - Purpose: Central router for email provider selection
  - _Leverage: Existing provider classes_
  - _Requirements: 6.4_

- [x] 10. Implement EmailRouter.route() method
  - File: `apps/worker/src/processors/notifier/email-router.ts`
  - Use minimatch to test email against each pattern
  - Check patterns in order: first match wins
  - Return default provider if no pattern matches
  - Pattern matching must be case-insensitive
  - Purpose: Select provider based on email address
  - _Requirements: 6.3, 6.4_

- [x] 11. Implement EmailRouter.send() method
  - File: `apps/worker/src/processors/notifier/email-router.ts`
  - Call `route()` to get provider
  - Call provider's `send()` method
  - Return `{ messageId, provider }` for logging
  - Do NOT fallback on provider failure (per Req 6.5)
  - Purpose: Route and send email through selected provider
  - _Leverage: `EmailContent` interface from `email-templates.ts`_
  - _Requirements: 6.4, 6.5_

- [x] 12. Add unit tests for EmailRouter
  - File: `apps/worker/src/processors/notifier/email-router.test.ts`
  - Test pattern matching for various email formats
  - Test case-insensitive matching
  - Test default provider selection when no match
  - Test no fallback on provider error
  - Purpose: Verify routing logic
  - _Requirements: 6.3, 6.4, 6.5_

---

## Phase 4: Batch Email Template

- [x] 13. Export escapeHtml function
  - File: `apps/worker/src/processors/notifier/email-templates.ts`
  - Change `function escapeHtml` to `export function escapeHtml`
  - Purpose: Make escapeHtml available for batch template
  - _Leverage: Existing function at `email-templates.ts` (private)_
  - _Note: Required per design doc v1.1_

- [x] 14. Export EmailContent interface
  - File: `apps/worker/src/processors/notifier/email-templates.ts`
  - Add `export` keyword to `EmailContent` interface at line 32
  - Purpose: Make interface available for EmailRouter
  - _Leverage: Existing interface at `email-templates.ts:32`_
  - _Note: Required per design doc v1.1_

- [x] 15. Create BatchCompleteEmailData interface
  - File: `apps/worker/src/processors/notifier/email-templates.ts`
  - Define interface with: homepageUrl, totalUrls, completedCount, failedCount
  - Add severity counts: totalIssues, criticalCount, seriousCount, moderateCount, minorCount
  - Add passedChecks, topCriticalUrls array, resultsUrl, pdfReportUrl?
  - Purpose: Type definition for batch email data
  - _Requirements: 4.3_

- [x] 16. Implement getBatchCompleteEmail function
  - File: `apps/worker/src/processors/notifier/email-templates.ts`
  - Generate HTML email with batch summary header
  - Include aggregate statistics by severity
  - List top 5 URLs with critical issues
  - Include links to view results and download PDF
  - Generate plain text alternative
  - Purpose: Create batch completion email content
  - _Leverage: Existing `getScanCompleteEmail` template pattern_
  - _Requirements: 4.3_

- [x] 17. Add unit tests for batch email template
  - File: `apps/worker/src/processors/notifier/email-templates.test.ts`
  - Test getBatchCompleteEmail generates valid HTML
  - Test all data fields are properly escaped
  - Test subject line includes homepage URL
  - Purpose: Verify batch template correctness
  - _Leverage: Existing template test patterns_
  - _Requirements: 4.3_

---

## Phase 5: Email Job Queue Integration

- [x] 18. Update EmailJobData type
  - File: `apps/api/src/shared/queue/types.ts`
  - Replace existing EmailJobData (at line 54-65) with new type
  - Add fields: scanId?, batchId?, email, type
  - Type union: 'scan_complete' | 'scan_failed' | 'batch_complete'
  - Purpose: Define job payload for email notifications
  - _Leverage: Existing `EmailJobData` at `types.ts:54-65` (unused, safe to replace)_
  - _Note: Breaking change to unused type per design doc_

- [x] 19. Create email queue instance in worker
  - File: `apps/worker/src/jobs/email-queue.ts`
  - Import Queue from BullMQ
  - Import getBullMQConnection from config
  - Create `sendEmailQueue` with name 'send-email'
  - Export queue for use by notification functions
  - Purpose: Enable worker to add jobs to email queue
  - _Leverage: `getBullMQConnection` from worker config_
  - _Requirements: 5.1_

- [x] 20. Implement queueEmailNotification function
  - File: `apps/worker/src/jobs/scan-page.job.ts`
  - Replace TODO placeholder with actual implementation
  - Import sendEmailQueue from email-queue.ts
  - Add job with scanId, email, type to queue
  - Log job ID for debugging
  - Purpose: Queue email on scan completion
  - _Leverage: Existing TODO at line 75_
  - _Requirements: 2.1, 3.1_

- [x] 21. Update BatchCompletionResult interface
  - File: `apps/worker/src/services/batch-status.service.ts`
  - Add `email?: string` field to interface or return type
  - Modify query to include email field from BatchScan
  - Purpose: Make batch email available for notification
  - _Requirements: 4.2_

- [x] 22. Implement queueBatchEmailNotification function
  - File: `apps/worker/src/services/batch-status.service.ts`
  - Create function accepting batchId and email
  - Add job to sendEmailQueue with type 'batch_complete'
  - Call from notifyScanComplete when batch completes and email exists
  - Purpose: Queue email on batch completion
  - _Requirements: 4.2_

---

## Phase 6: Extended Email Processor

- [x] 23. Initialize EmailRouter in processor
  - File: `apps/worker/src/processors/send-email.processor.ts`
  - Import EmailRouter and loadEmailRoutingConfig
  - Initialize router at module level (singleton)
  - Handle config loading errors gracefully
  - Purpose: Set up email routing for processor
  - _Requirements: 6.4_

- [x] 24. Update processSendEmail for scan emails with 30-second threshold
  - File: `apps/worker/src/processors/send-email.processor.ts`
  - Check job.data.type for 'scan_complete' or 'scan_failed'
  - Fetch scan data using scanId
  - **Check if scan.durationMs < 30000 → skip email (user still on page, per Req 2.3)**
  - Generate email content using existing templates
  - Send via EmailRouter instead of direct provider
  - Log provider used for debugging
  - Purpose: Route single scan emails through router with duration check
  - _Leverage: Existing processSendEmail logic, scan.durationMs field_
  - _Requirements: 2.1, 2.3, 3.1, 5.2, 6.4_

- [x] 25. Add batch email processing
  - File: `apps/worker/src/processors/send-email.processor.ts`
  - Handle 'batch_complete' type
  - Fetch batch data with aggregate statistics
  - Generate email using getBatchCompleteEmail
  - Send via EmailRouter
  - Purpose: Process batch completion emails
  - _Requirements: 4.2, 4.3_

- [x] 26. Add GDPR email nullification
  - File: `apps/worker/src/processors/send-email.processor.ts`
  - After successful send, nullify email in Scan or BatchScan record
  - Also nullify on permanent failure (all retries exhausted)
  - Log nullification for audit trail
  - Purpose: GDPR compliance - delete email after use
  - _Requirements: 2.4, 3.3, 4.4, 5.3_

- [x] 27. Add email processor unit tests
  - File: `apps/worker/src/processors/send-email.processor.test.ts`
  - Test scan_complete processing
  - Test scan_failed processing
  - Test batch_complete processing
  - **Test 30-second threshold skips email (Req 2.3)**
  - Test GDPR nullification on success and failure
  - Test EmailRouter integration
  - **Test error logging on provider failure (Req 5.2)**
  - Purpose: Verify processor logic including edge cases
  - _Leverage: Vitest mocking for Prisma and EmailRouter_
  - _Requirements: 2.1, 2.3, 3.1, 4.2, 5.2, 5.3, 6.4_

---

## Phase 7: Integration Testing

- [x] 28. Add integration tests for email routing
  - File: `apps/worker/src/processors/notifier/email-router.integration.test.ts`
  - Test configuration loading from .env
  - Test provider selection for various email patterns
  - Test end-to-end send with stubbed providers
  - Purpose: Verify routing works with real config
  - _Requirements: 6.2, 6.4_

- [x] 29. Add integration tests for email job flow
  - File: `apps/worker/src/jobs/email-notification.integration.test.ts`
  - Test queueEmailNotification creates correct job
  - Test queueBatchEmailNotification creates correct job
  - Test job processing with mocked providers
  - Purpose: Verify end-to-end job flow
  - _Requirements: 2.1, 4.2, 5.1_

---

## Phase 8: Documentation

- [x] 30. Update README with email configuration
  - File: `apps/worker/README.md` or `apps/api/README.md`
  - Document EMAIL_* environment variables
  - Provide example .env configuration
  - Document YAML configuration alternative
  - Explain pattern matching syntax
  - Purpose: Document email notification setup
  - _Requirements: 6.2_

---

## Task Dependencies

```
Phase 1 (Configuration)
    └── Phase 2 (SES Provider)
    └── Phase 3 (Email Router)
         └── Phase 4 (Batch Template)
              └── Phase 5 (Queue Integration)
                   └── Phase 6 (Email Processor)
                        └── Phase 7 (Integration Testing)
                             └── Phase 8 (Documentation)
```

---

## Implementation Notes

### Existing Infrastructure Leveraged

| Component | Location | Status |
|-----------|----------|--------|
| EmailProvider interface | `email-sender.ts:22` | Reuse |
| SendGridProvider | `email-sender.ts` | Reuse |
| getScanCompleteEmail | `email-templates.ts` | Reuse |
| getScanFailedEmail | `email-templates.ts` | Reuse |
| sendEmailQueue | `apps/api/.../queues.ts` | Reference |
| BatchScan.email | Prisma schema | Exists |
| Scan.email | Prisma schema | Exists |

### Key Design Decisions

1. **No Provider Fallback**: Per Req 6.5, if a provider fails, retry same provider - do not auto-fallback
2. **GDPR Nullification**: Email deleted after send OR after all retries exhausted
3. **Worker Queue Access**: Worker creates own queue instance pointing to same Redis queue
4. **30-Second Threshold**: Skip email if scan completes in <30s (user still on page)

---

*Tasks Version: 1.1*
*Created: December 30, 2025*
*Updated: December 30, 2025*
*Total Tasks: 30*

### Changelog

**v1.1** - Validation fixes:
- Added leverage reference to Task 3
- Added leverage references to Tasks 13, 14
- Updated Task 18 with specific line numbers
- Updated Task 24 to include Requirement 2.3 (30-second threshold)
- Updated Task 27 to include 30-second threshold and error logging tests
- Added Requirement 5.2 (failure logging) coverage to Task 24

**v1.0** - Initial task breakdown
