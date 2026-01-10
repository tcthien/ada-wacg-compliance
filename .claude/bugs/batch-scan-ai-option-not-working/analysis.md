# Bug Analysis: Batch Scan AI Option Not Working

## Status
**FIXED** - Implementation complete (see verification.md)

## Root Cause Analysis

### Investigation Summary
Traced the AI opt-in flow from single scan implementation through batch scan creation. Found that **AI support was never implemented for batch scans** - the `aiEnabled` and `email` fields are missing from the entire batch scan pipeline.

### Root Cause
**The batch scan flow does not pass `aiEnabled` or `email` fields at any layer.**

The single scan flow correctly handles AI:
1. Frontend collects `aiEnabled` and `email` in `ScanForm.tsx`
2. Frontend passes these to API via `creating/page.tsx`
3. API's `scan.service.ts` reserves AI slot and sets `aiStatus: 'PENDING'`
4. Individual scan is created with `aiEnabled: true` and `aiStatus: 'PENDING'`
5. After scan completes, worker adds scan to AI queue if `aiEnabled: true`
6. Admin can export pending AI scans via `ai-queue.service.ts`

The batch scan flow **skips all AI-related logic**:
1. Frontend stores batch data WITHOUT `aiEnabled` or `email`
2. Frontend sends batch request WITHOUT these fields
3. API's `batch.service.ts` creates scans with `email: null` and no AI fields
4. Scans are never flagged for AI processing
5. No AI queue entries are created

### Working Flow (Single Scan)

```
[ScanForm.tsx] - Stores { aiEnabled, email } in session
         ↓
[creating/page.tsx] - Passes { aiEnabled, email } to API
         ↓
[scan.controller.ts] - Validates request
         ↓
[scan.service.ts] - Calls checkAndReserveSlotAtomic()
         ↓                Sets aiEnabled=true, aiStatus='PENDING'
[scan.repository.ts] - Creates scan with AI fields
         ↓
[Worker completes scan]
         ↓
[AI Queue] - Scan visible in admin export
```

### Broken Flow (Batch Scan)

```
[ScanForm.tsx] - Stores { urls, wcagLevel } - NO aiEnabled!
         ↓
[creating/page.tsx] - Passes { urls, wcagLevel } - NO aiEnabled!
         ↓
[batch.controller.ts] - Schema has NO aiEnabled field
         ↓
[batch.service.ts] - Creates scans with email: null, NO AI fields
         ↓
[scan.repository.ts] - Creates scan WITHOUT aiEnabled
         ↓
[Worker completes scan]
         ↓
[AI Queue] - Scan NOT in export (aiEnabled=false)
```

## Technical Details

### Affected Code Locations

#### 1. Frontend - ScanForm.tsx
**File**: `apps/web/src/components/features/scan/ScanForm.tsx`
**Issue**: Batch pending data does not include `aiEnabled` or `email`

```typescript
// Lines 289-313 - MISSING AI fields
const pendingScanData = {
  type: 'batch' as const,
  urls,
  wcagLevel,
  recaptchaToken,
  discoveryId: discoveryData.discoveryId,
  pageTitles,
  homepageUrl,
  timestamp: Date.now(),
  // ❌ NO aiEnabled
  // ❌ NO email
};
```

Compare to single scan (lines 348-356):
```typescript
const pendingScanData = {
  type: 'single' as const,
  url: validatedUrl,
  wcagLevel,
  recaptchaToken,
  email: emailConsent && email.trim() ? email.trim() : undefined,
  aiEnabled: aiEnabled || undefined,  // ✅ Present
  timestamp: Date.now(),
};
```

#### 2. Frontend - creating/page.tsx
**File**: `apps/web/src/app/scan/creating/page.tsx`
**Issue**: Batch request does not pass `aiEnabled` or `email`

```typescript
// Lines 81-104 - MISSING AI fields
const batchRequest: Parameters<typeof batchApi.create>[0] = {
  urls: pendingData.urls,
  wcagLevel: pendingData.wcagLevel,
  recaptchaToken: pendingData.recaptchaToken,
  // ❌ NO aiEnabled
  // ❌ NO email
};
```

Compare to single scan (lines 119-126):
```typescript
const singleRequest: Parameters<typeof scanApi.create>[0] = {
  url: pendingData.url!,
  wcagLevel: pendingData.wcagLevel,
  recaptchaToken: pendingData.recaptchaToken,
  email: pendingData.email,
  aiEnabled: pendingData.aiEnabled,  // ✅ Present
};
```

#### 3. Frontend API - batch-api.ts
**File**: `apps/web/src/lib/batch-api.ts`
**Issue**: `CreateBatchRequest` interface missing AI fields

```typescript
// Lines 19-25
export interface CreateBatchRequest {
  urls: string[];
  wcagLevel?: 'A' | 'AA' | 'AAA';
  recaptchaToken: string;
  discoveryId?: string;
  pageTitles?: Record<string, string>;
  // ❌ NO aiEnabled
  // ❌ NO email
}
```

#### 4. Backend Schema - batch.schema.ts
**File**: `apps/api/src/modules/batches/batch.schema.ts`
**Issue**: `CreateBatchRequestSchema` missing AI validation

```typescript
// Lines 46-105
export const CreateBatchRequestSchema = z.object({
  urls: z.array(...),
  wcagLevel: WcagLevelSchema.default('AA'),
  recaptchaToken: z.string(...),
  // ❌ NO aiEnabled field
  // ❌ NO email field
});
```

#### 5. Backend Service - batch.service.ts
**File**: `apps/api/src/modules/batches/batch.service.ts`
**Issue**: `CreateBatchInput` missing AI fields, explicitly sets `email: null`

```typescript
// Lines 46-53
export interface CreateBatchInput {
  urls: string[];
  wcagLevel?: WcagLevel;
  homepageUrl?: string;
  guestSessionId?: string;
  userId?: string;
  discoveryId?: string;
  // ❌ NO aiEnabled
  // ❌ NO email
}

// Lines 189-199 - Creates scans WITHOUT AI
const scanData: CreateScanData = {
  url,
  wcagLevel: input.wcagLevel ?? 'AA',
  guestSessionId: input.guestSessionId ?? null,
  userId: input.userId ?? null,
  email: null,  // ❌ Explicitly null!
  batchId: batch.id,
  pageTitle: null,
  // ❌ NO aiEnabled
  // ❌ NO aiStatus
};
```

## Impact Analysis

### Direct Impact
- Batch scans cannot be AI-enhanced
- Users see AI toggle but it has no effect for batch scans
- Admin AI Queue shows no batch scan jobs
- No CSV export available for batch scan AI processing

### Business Impact
- Feature inconsistency between single and batch scans
- User confusion - AI toggle appears but doesn't work
- Lost revenue from AI-enhanced batch scans

## Solution Approach

### Implementation Strategy
Add `aiEnabled` and `email` fields throughout the batch scan pipeline, reusing the existing AI slot reservation logic from single scans.

### Key Design Decisions

1. **Email for batch**: Use a single email for the entire batch (not per-URL)
   - Simpler UX - user enters email once
   - Email notification sent when batch AI processing completes

2. **AI slot reservation**: Reserve one slot per URL in batch
   - Each scan needs its own AI processing
   - If slots run out mid-batch, remaining scans proceed without AI

3. **AI status tracking**: Each scan in batch gets its own `aiStatus`
   - Individual scans can be at different AI stages
   - Batch completion email sent when all AI processing done

## Implementation Plan

### Phase 1: Frontend Changes

#### Change 1.1: Update ScanForm.tsx batch pending data
**File**: `apps/web/src/components/features/scan/ScanForm.tsx`
**Lines**: ~289-313

Add `aiEnabled` and `email` to batch pending data:
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
  email: emailConsent && email.trim() ? email.trim() : undefined,  // ADD
  aiEnabled: aiEnabled || undefined,  // ADD
};
```

#### Change 1.2: Update creating/page.tsx batch request
**File**: `apps/web/src/app/scan/creating/page.tsx`
**Lines**: ~81-104

Pass `aiEnabled` and `email` in batch request:
```typescript
const batchRequest: Parameters<typeof batchApi.create>[0] = {
  urls: pendingData.urls,
  wcagLevel: pendingData.wcagLevel,
  recaptchaToken: pendingData.recaptchaToken,
  email: pendingData.email,  // ADD
  aiEnabled: pendingData.aiEnabled,  // ADD
};
```

#### Change 1.3: Update batch-api.ts interface
**File**: `apps/web/src/lib/batch-api.ts`
**Lines**: ~19-25

Add fields to `CreateBatchRequest`:
```typescript
export interface CreateBatchRequest {
  urls: string[];
  wcagLevel?: 'A' | 'AA' | 'AAA';
  recaptchaToken: string;
  discoveryId?: string;
  pageTitles?: Record<string, string>;
  email?: string;  // ADD
  aiEnabled?: boolean;  // ADD
}
```

### Phase 2: Backend Schema Changes

#### Change 2.1: Update batch.schema.ts
**File**: `apps/api/src/modules/batches/batch.schema.ts`

Add `aiEnabled` and `email` to `CreateBatchRequestSchema`:
```typescript
export const CreateBatchRequestSchema = z.object({
  urls: z.array(...),
  wcagLevel: WcagLevelSchema.default('AA'),
  recaptchaToken: z.string(...),

  // ADD: Email for AI notification
  email: z
    .string()
    .transform((email) => email.trim().toLowerCase())
    .pipe(z.string().email('Invalid email format'))
    .optional(),

  // ADD: AI enabled flag
  aiEnabled: z.boolean().optional(),
}).refine(
  (data) => {
    // Email required when AI enabled
    if (data.aiEnabled === true && !data.email) {
      return false;
    }
    return true;
  },
  {
    message: 'Email is required when AI validation is enabled',
    path: ['email'],
  },
);
```

### Phase 3: Backend Service Changes

#### Change 3.1: Update batch.service.ts interface
**File**: `apps/api/src/modules/batches/batch.service.ts`
**Lines**: ~46-53

Add fields to `CreateBatchInput`:
```typescript
export interface CreateBatchInput {
  urls: string[];
  wcagLevel?: WcagLevel;
  homepageUrl?: string;
  guestSessionId?: string;
  userId?: string;
  discoveryId?: string;
  email?: string;  // ADD
  aiEnabled?: boolean;  // ADD
}
```

#### Change 3.2: Update batch.service.ts createBatch function
**File**: `apps/api/src/modules/batches/batch.service.ts`
**Lines**: ~105-297

Add AI slot reservation logic and pass fields to scan creation:
```typescript
export async function createBatch(input: CreateBatchInput): Promise<CreateBatchResult> {
  // ... existing validation ...

  // ADD: Import AI campaign service
  const { checkAndReserveSlotAtomic } = await import('../ai-campaign/ai-campaign.service.js');

  // Step 3: Create individual Scan records for each URL
  for (const url of validatedUrls) {
    // ADD: Handle AI opt-in per scan
    let aiEnabled = false;
    let aiStatus: AiStatus | undefined = undefined;

    if (input.aiEnabled) {
      try {
        const tempScanId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const reservation = await checkAndReserveSlotAtomic(tempScanId);

        if (reservation.reserved) {
          aiEnabled = true;
          aiStatus = 'PENDING';
        }
      } catch (error) {
        console.warn(`⚠️ Batch Service: AI slot reservation failed for ${url}`);
      }
    }

    const scanData: CreateScanData = {
      url,
      wcagLevel: input.wcagLevel ?? 'AA',
      guestSessionId: input.guestSessionId ?? null,
      userId: input.userId ?? null,
      email: input.email ?? null,  // CHANGE: Use batch email
      batchId: batch.id,
      pageTitle: null,
      aiEnabled,  // ADD
      aiStatus,   // ADD
    };

    const scan = await createScanInRepo(scanData);
    // ...
  }
  // ...
}
```

#### Change 3.3: Update batch.controller.ts
**File**: `apps/api/src/modules/batches/batch.controller.ts`

Pass `email` and `aiEnabled` from validated request to service:
```typescript
const result = await createBatch({
  urls: validatedData.urls,
  wcagLevel: validatedData.wcagLevel,
  homepageUrl,
  guestSessionId: session.sessionId,
  discoveryId,
  email: validatedData.email,  // ADD
  aiEnabled: validatedData.aiEnabled,  // ADD
});
```

### Phase 4: Verification

After implementation, verify:
1. [ ] Create batch scan with AI enabled - all scans get `aiEnabled: true`
2. [ ] Admin AI Queue shows pending batch scan jobs
3. [ ] Export pending AI scans includes batch scan entries
4. [ ] Import AI results works for batch scan entries
5. [ ] Email notification sent after batch AI processing

## Testing Strategy

### Unit Tests
1. Update `batch.service.test.ts`:
   - Test batch creation with `aiEnabled: true`
   - Test AI slot reservation per scan
   - Test email passed to individual scans

2. Update `batch.schema.test.ts`:
   - Test schema validation with AI fields
   - Test email required when AI enabled

### Integration Tests
1. Create batch with AI via API
2. Verify scans have `aiEnabled: true` and `aiStatus: 'PENDING'`
3. Verify admin AI queue shows pending scans

### Manual Testing
1. Start local environment
2. Create batch scan with AI enabled
3. Check admin AI Queue - should show pending scans
4. Export pending scans - should include batch scans
5. Process with AI CLI tool
6. Import results - should update batch scans

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| AI slots exhausted mid-batch | Log warning, continue batch without AI for remaining scans |
| Batch too large for AI quota | Validate total URLs against available slots before starting |
| Email notifications overwhelm | Single notification when entire batch AI completes |

## Rollback Plan
Revert changes in reverse order:
1. Backend service changes
2. Backend schema changes
3. Frontend API client
4. Frontend form/page changes

---

**Analysis Complete**: 2026-01-10
**Ready for**: `/bug-fix` phase
