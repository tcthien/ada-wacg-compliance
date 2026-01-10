# Bug Report

## Bug Summary
After importing AI scan results via the admin API, the scan status is updated to COMPLETED but the email notification is never sent to the customer. The email job is being queued with incorrect parameters, causing it to fail silently.

## Bug Details

### Expected Behavior
When AI scan results are imported via `/api/v1/admin/ai-queue/import`:
1. The scan's `aiStatus` should be updated to `COMPLETED`
2. An email notification should be queued using the `ai_scan_complete` email type
3. The email should be sent to the customer's email address (visible in Mailsplit in local environment)
4. Customer should receive the AI-enhanced accessibility report email

### Actual Behavior
- The scan's `aiStatus` IS correctly updated to `COMPLETED`
- An email job IS being queued, BUT with incorrect function signature
- The email never arrives (not visible in Mailsplit)
- No obvious error in logs because the email queue failure is silently caught

### Steps to Reproduce
1. Start the local environment (`./app-start.sh`)
2. Create a scan with AI enabled
3. Export pending AI scans from admin panel
4. Process with AI CLI tool: `./dist/cli.js --input pending.csv --output ./results/`
5. Import results via admin panel or API: `POST /api/v1/admin/ai-queue/import`
6. Check Mailsplit (http://localhost:8025) for email
7. Observe: No email notification is received

### Environment
- **Version**: Local development
- **Platform**: Linux 6.8.0-90-generic
- **Configuration**: Mailsplit running on localhost:8025 for SMTP testing

## Impact Assessment

### Severity
- [x] High - Major functionality broken

Customer expects to receive an email notification when their AI-enhanced scan results are ready, but they never receive it. This breaks a key user workflow promise.

### Affected Users
- All customers who submit scans with AI analysis enabled
- Customers expecting email notifications for completed AI scans

### Affected Features
- AI scan email notification delivery
- Customer communication workflow after AI processing completes

## Additional Context

### Error Messages
No explicit error - the failure is silently caught in the import function:

```typescript
// In ai-queue.service.ts importAiResults():
} catch (emailError) {
  // Log email queue failure but don't fail the import
  const err = emailError instanceof Error ? emailError : new Error(String(emailError));
  console.warn(
    `⚠️ AI Queue Service: Failed to queue email for scan ${row.scan_id}:`,
    err.message
  );
}
```

### Screenshots/Media
N/A - Backend issue

### Related Issues
- Related to AI Scan CLI batch processing workflow
- Part of `ai-scan-merge-results` spec implementation

## Initial Analysis

### Suspected Root Cause
**Function signature mismatch between API and Worker email queue functions.**

In `apps/api/src/modules/ai-campaign/ai-queue.service.ts` (lines 718-731), the import function calls:
```typescript
await addEmailJob(
  scan.email,           // to
  'ai-scan-complete',   // template name (NOT 'ai_scan_complete')
  {                     // data object
    scanId: row.scan_id,
    url: scan.url,
    aiSummary: row.ai_summary,
    tokensUsed: row.tokens_used,
    aiModel: row.ai_model,
  },
  {
    subject: 'Your AI-Enhanced Accessibility Scan is Ready',
  }
);
```

This uses the **API's `addEmailJob`** function from `queue.service.ts` which expects:
- `(to: string, template: string, data: object, options?: object)`

However, the **Worker's email processor** (`send-email.processor.ts`) expects `SendEmailJobData`:
```typescript
interface SendEmailJobData {
  scanId?: string;
  email: string;
  type: 'scan_complete' | 'scan_failed' | 'batch_complete' | 'ai_scan_complete';
}
```

**Issues identified:**
1. The API queues jobs with `TemplateEmailJobData` format (template-based)
2. The Worker expects `SendEmailJobData` format (type-based)
3. Template name `'ai-scan-complete'` doesn't match enum value `'ai_scan_complete'`
4. The Worker's `processAiScanCompleteEmail` function won't be called because job data structure doesn't match

### Affected Components
- `apps/api/src/modules/ai-campaign/ai-queue.service.ts` - Import function queuing email incorrectly
- `apps/api/src/shared/queue/queue.service.ts` - API's addEmailJob creates TemplateEmailJobData
- `apps/worker/src/jobs/email-queue.ts` - Worker's addEmailJob creates SendEmailJobData
- `apps/worker/src/processors/send-email.processor.ts` - Expects SendEmailJobData with `type` field

---

**Report Created**: 2026-01-10
**Status**: Ready for Analysis
