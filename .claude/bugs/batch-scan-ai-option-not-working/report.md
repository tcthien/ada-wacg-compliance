# Bug Report: Batch Scan AI Option Not Working

## Status
**FIXED** - Implementation complete

## Summary
When submitting a batch scan with the AI Scan option enabled, the AI status is not visible after submission and is not recorded in the admin panel. The AI functionality that works for single scans does not work for batch scans.

## Bug Details

| Field | Value |
|-------|-------|
| **Reported Date** | 2026-01-10 |
| **Reported By** | User |
| **Severity** | High |
| **Component** | Batch Scan / AI Integration |
| **Environment** | Development (localhost) |

## Description

### User Report
> Cannot use AI function for the batch scan. As a user, when I submit batch scan with AI Scan option, after submitting, I cannot see the AI scan status. I also login with admin account & see that the batch scan was not still recorded with ai scan.

### Expected Behavior
1. User enables AI Scan option when creating a batch scan
2. User submits batch scan with multiple URLs
3. Batch scan is created with `aiEnabled: true` flag
4. Individual scans within the batch are queued for AI processing
5. AI status is visible in the UI for the batch and its scans
6. Admin panel shows the batch scan with AI scan status
7. **Admin can see the AI scans in the AI Queue/Jobs list**
8. **Admin can download/export the AI jobs for offline AI processing**

### Actual Behavior
1. User enables AI Scan option when creating a batch scan
2. User submits batch scan with multiple URLs
3. Batch scan is created **WITHOUT** any AI-related fields
4. Individual scans are created as regular scans (no AI processing)
5. AI status is not visible anywhere in the UI
6. Admin panel shows batch scan without any AI information
7. **AI Queue shows no pending AI jobs for batch scans**
8. **No batch AI jobs available for download/export**

## Investigation Findings

### Root Cause
**AI support was never implemented for batch scans.** The `aiEnabled` and `email` fields are missing from the entire batch scan flow.

### Affected Code Locations

#### Frontend - ScanForm.tsx
**File**: `apps/web/src/components/features/scan/ScanForm.tsx`

Single scan includes AI fields (lines 348-356):
```typescript
const pendingScanData = {
  type: 'single' as const,
  url: validatedUrl,
  wcagLevel,
  recaptchaToken,
  email: emailConsent && email.trim() ? email.trim() : undefined,
  aiEnabled: aiEnabled || undefined,  // ✅ AI field present
  timestamp: Date.now(),
};
```

Batch scan does NOT include AI fields (lines 289-313):
```typescript
const pendingScanData = {
  type: 'batch' as const,
  urls,
  wcagLevel,
  recaptchaToken,
  discoveryId: discoveryData.discoveryId,
  pageTitles,
  homepageUrl,
  timestamp: Date.now(),
  // ❌ NO aiEnabled field!
  // ❌ NO email field!
};
```

#### Frontend - creating/page.tsx
**File**: `apps/web/src/app/scan/creating/page.tsx`

Single scan passes AI fields (lines 119-121):
```typescript
const singleRequest: Parameters<typeof scanApi.create>[0] = {
  url: pendingData.url!,
  wcagLevel: pendingData.wcagLevel,
  recaptchaToken: pendingData.recaptchaToken,
  email: pendingData.email,
  aiEnabled: pendingData.aiEnabled,  // ✅ AI field passed
};
```

Batch scan does NOT pass AI fields (lines 81-104):
```typescript
const batchRequest: Parameters<typeof batchApi.create>[0] = {
  urls: pendingData.urls,
  wcagLevel: pendingData.wcagLevel,
  recaptchaToken: pendingData.recaptchaToken,
  // ❌ NO aiEnabled!
  // ❌ NO email!
};
```

#### Frontend API Client - batch-api.ts
**File**: `apps/web/src/lib/batch-api.ts`

`CreateBatchRequest` interface has NO AI fields (lines 19-25):
```typescript
export interface CreateBatchRequest {
  urls: string[];
  wcagLevel?: 'A' | 'AA' | 'AAA';
  recaptchaToken: string;
  discoveryId?: string;
  pageTitles?: Record<string, string>;
  // ❌ NO aiEnabled!
  // ❌ NO email!
}
```

#### Backend - batch.schema.ts
**File**: `apps/api/src/modules/batches/batch.schema.ts`

`CreateBatchRequestSchema` has NO AI-related fields.

#### Backend - batch.service.ts
**File**: `apps/api/src/modules/batches/batch.service.ts`

`CreateBatchInput` interface has NO AI fields (lines 46-53):
```typescript
export interface CreateBatchInput {
  urls: string[];
  wcagLevel?: WcagLevel;
  homepageUrl?: string;
  guestSessionId?: string;
  userId?: string;
  discoveryId?: string;
  // ❌ NO aiEnabled!
  // ❌ NO email!
}
```

### Missing Implementation Summary

| Layer | File | Missing Fields |
|-------|------|----------------|
| Frontend Form | `ScanForm.tsx` | `aiEnabled`, `email` in batch pending data |
| Frontend Page | `creating/page.tsx` | `aiEnabled`, `email` in batch request |
| Frontend API | `batch-api.ts` | `aiEnabled`, `email` in `CreateBatchRequest` |
| Backend Schema | `batch.schema.ts` | `aiEnabled`, `email` in validation schema |
| Backend Service | `batch.service.ts` | `aiEnabled`, `email` in `CreateBatchInput` |
| Backend Controller | `batch.controller.ts` | Logic to handle AI fields |
| Worker Processor | (various) | AI job queuing for batch scans |

## Reproduction Steps

1. Navigate to http://localhost:3000
2. Enter a website URL in the scan form
3. Click "Discover Pages" and select multiple pages for batch scan
4. Enable the "AI Enhanced Scan" toggle
5. Optionally enter email for notifications
6. Submit the batch scan
7. **Observe**: Redirected to results page without AI status indicators
8. Login to admin panel at http://localhost:3000/admin
9. Navigate to Batches or Scans
10. **Observe**: Batch scan shows no AI-related information

## Impact

- **User Experience**: Users expect AI functionality to work for batch scans as it does for single scans
- **Feature Parity**: Single scans support AI but batch scans do not
- **Business Impact**: AI-enhanced scanning is a premium feature that doesn't work for batch operations

## Proposed Solution

Implement AI support for batch scans by:

1. **Frontend**: Add `aiEnabled` and `email` fields to batch scan flow in `ScanForm.tsx` and `creating/page.tsx`
2. **Frontend API**: Add fields to `CreateBatchRequest` interface in `batch-api.ts`
3. **Backend Schema**: Add `aiEnabled` and `email` to batch validation schema
4. **Backend Service**: Update `CreateBatchInput` and batch creation logic
5. **Backend Controller**: Handle AI fields and pass to individual scans
6. **Worker**: Ensure individual scans within batch are queued for AI processing
7. **AI Queue Integration**: When batch scans with AI complete, add them to the AI queue (`ai_queue` table) so admin can:
   - View pending AI jobs in the AI Queue admin page
   - Export/download AI jobs as CSV for offline AI processing
   - Import AI results back after offline processing

## Related Files

### Frontend
- `apps/web/src/components/features/scan/ScanForm.tsx`
- `apps/web/src/app/scan/creating/page.tsx`
- `apps/web/src/lib/batch-api.ts`

### Backend - Batch Module
- `apps/api/src/modules/batches/batch.schema.ts`
- `apps/api/src/modules/batches/batch.service.ts`
- `apps/api/src/modules/batches/batch.controller.ts`

### Backend - AI Queue Integration
- `apps/api/src/modules/ai-campaign/ai-queue.service.ts`
- `apps/worker/src/processors/scan-page.processor.ts`

### Admin UI (for AI Queue visibility)
- `apps/web/src/components/admin/AiQueueTable.tsx`
- `apps/web/src/app/admin/ai-queue/page.tsx`

## Notes

- The AI toggle UI appears in the scan form regardless of single/batch mode, giving users the impression AI works for batch scans
- This is a feature gap, not a regression - AI was never implemented for batch scans

---

**Report Status**: Ready for `/bug-analyze` phase
