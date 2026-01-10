# Bug Analysis

## Status
**ANALYSIS COMPLETE** - Ready for fix implementation

## Root Cause Analysis

### Investigation Summary
Traced the email notification flow from the `importAiResults` function through to the email processor. Found a critical **function signature mismatch** between the API's `addEmailJob` helper and the Worker's expected job format.

### Root Cause
**The API's `addEmailJob` function creates jobs with `TemplateEmailJobData` format, but the Worker's email processor expects `SendEmailJobData` format with a `type` field.**

Two incompatible interfaces exist:

1. **API's TemplateEmailJobData** (what `addEmailJob` creates):
```typescript
interface TemplateEmailJobData {
  to: string;
  template: string;
  data: Record<string, unknown>;
  subject?: string;
  from?: string;
}
```

2. **Worker's SendEmailJobData** (what processor expects):
```typescript
interface SendEmailJobData {
  scanId?: string;
  batchId?: string;
  email: string;
  type: 'scan_complete' | 'scan_failed' | 'batch_complete' | 'ai_scan_complete';
}
```

When the Worker processor receives the job, it destructures:
```typescript
const { scanId, batchId, email, type } = job.data;
```

But the actual job data has `{to, template, data, subject}` fields, so:
- `scanId` → `undefined`
- `email` → `undefined`
- `type` → `undefined`

This causes the processor to fail silently because `type` doesn't match any expected value.

### Contributing Factors
1. **Naming confusion**: Two `addEmailJob` functions exist with different signatures
2. **Type casting bypass**: API's `addEmailJob` uses `as unknown as` to force job data onto queue
3. **Silent failure handling**: The import function catches email errors and only logs a warning
4. **No integration test** for the full import→email flow

## Technical Details

### Affected Code Locations

- **File**: `apps/api/src/modules/ai-campaign/ai-queue.service.ts`
  - **Function**: `importAiResults()`
  - **Lines**: `718-731`
  - **Issue**: Calls API's `addEmailJob` with wrong format

```typescript
// CURRENT (broken):
await addEmailJob(
  scan.email,           // to (string)
  'ai-scan-complete',   // template (string) - wrong!
  {                     // data (object)
    scanId: row.scan_id,
    url: scan.url,
    ...
  },
  { subject: '...' }    // options
);
```

- **File**: `apps/api/src/shared/queue/queue.service.ts`
  - **Function**: `addEmailJob()`
  - **Lines**: `170-217`
  - **Issue**: Creates `TemplateEmailJobData` format jobs

- **File**: `apps/worker/src/processors/send-email.processor.ts`
  - **Function**: `processSendEmail()`
  - **Lines**: `233-416`
  - **Issue**: Expects `SendEmailJobData` format with `type` field

### Data Flow Analysis

```
[importAiResults]
    ↓ calls addEmailJob(email, 'ai-scan-complete', data, options)
[API addEmailJob - queue.service.ts]
    ↓ creates {to, template, data, subject}
[sendEmailQueue.add()]
    ↓ job enqueued with wrong format
[Worker send-email processor]
    ↓ extracts {scanId, email, type} - all undefined!
[No type match → no email sent]
```

### Working Pattern (for comparison)
The Worker's own code correctly uses the format:

```typescript
// In scan-page.processor.ts (lines 652-656):
const emailJob = await addEmailJob({
  scanId,
  email,
  type: 'scan_complete',  // ← correct format!
});
```

## Impact Analysis

### Direct Impact
- AI scan completion emails are never delivered
- Customers don't receive notification when their AI-enhanced results are ready
- The AiStatusBadge shows "Completed" but user never gets email

### Indirect Impact
- User trust erosion - promised email notification doesn't arrive
- Support tickets likely increase asking about missing emails
- Feature appears broken from customer perspective

### Risk Assessment
- **Severity**: High - core customer-facing feature broken
- **Scope**: All AI-enabled scans imported via CLI batch process
- **Urgency**: Should fix before next AI batch import

## Solution Approach

### Fix Strategy
**Directly add jobs to `sendEmailQueue` with correct `SendEmailJobData` format**, bypassing the API's `addEmailJob` helper function.

```typescript
// FIXED approach:
import { sendEmailQueue } from '../../shared/queue/queues.js';
import type { EmailJobData } from '../../shared/queue/types.js';

// In importAiResults:
const emailJobData: EmailJobData = {
  scanId: row.scan_id,
  email: scan.email,
  type: 'ai_scan_complete',
};

await sendEmailQueue.add('send-email', emailJobData, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
});
```

### Alternative Solutions

1. **Create a dedicated `addScanEmailJob` function** - More verbose but explicit
2. **Modify API's `addEmailJob` to support both formats** - Risky, could break other callers
3. **Use Worker's `addEmailJob` via shared package** - Would require package restructuring

### Risks and Trade-offs
- **Chosen approach**: Direct queue access is slightly lower-level but guaranteed to work
- **Trade-off**: Bypasses the API's abstraction layer, but that layer has the wrong interface anyway

## Implementation Plan

### Changes Required

1. **Change 1**: Update `importAiResults` in `ai-queue.service.ts`
   - File: `apps/api/src/modules/ai-campaign/ai-queue.service.ts`
   - Replace `addEmailJob()` call with direct `sendEmailQueue.add()` using correct format
   - Import `sendEmailQueue` from `../../shared/queue/queues.js`

### Testing Strategy

1. **Unit Test**: Add/update test for email job format in `ai-queue.service.test.ts`
2. **Manual Test**:
   - Start local environment with Mailsplit
   - Create AI scan, export pending, process with CLI, import
   - Verify email arrives in Mailsplit (http://localhost:8025)
3. **Verification Checklist**:
   - [ ] Email job has correct `type: 'ai_scan_complete'`
   - [ ] Email job has correct `scanId` and `email` fields
   - [ ] Email arrives in Mailsplit
   - [ ] No errors in worker logs

### Rollback Plan
Revert the single file change to `ai-queue.service.ts` if issues arise.

---

**Analysis Complete**: 2026-01-10
**Ready for**: `/bug-fix` phase
