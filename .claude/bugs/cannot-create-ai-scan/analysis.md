# Bug Analysis

## Root Cause Analysis

### Investigation Summary

The bug has **two root causes**:

1. **Controller Omission**: The `aiEnabled` field is:
   - ✅ Validated in the schema (`scan.schema.ts:121`)
   - ✅ Defined in the `CreateScanInput` interface (`scan.service.ts:51`)
   - ❌ **NOT passed** from controller to service (`scan.controller.ts:126-130`)

2. **Redis Cache Overwrite**: Even after fixing the controller:
   - ✅ Database correctly stores `aiEnabled: true`
   - ❌ **Worker overwrites Redis cache** without `aiEnabled` (`scan-page.processor.ts:50-57`)
   - ❌ Subsequent GET requests return `aiEnabled: false` (default fallback)

### Root Cause #1: Controller

**File:** `apps/api/src/modules/scans/scan.controller.ts`
**Lines:** 126-130

The `createScanHandler` function builds the `scanInput` object but **omits the `aiEnabled` field**:

```typescript
// Current code (BROKEN)
const scanInput: CreateScanInput = {
  url: body.url,
  email: body.email,
  wcagLevel: body.wcagLevel,
  // aiEnabled is MISSING!
};
```

### Root Cause #2: Redis Cache

**File:** `apps/worker/src/processors/scan-page.processor.ts`
**Lines:** 50-57

The `updateRedisStatus` function updates the Redis cache when status changes (RUNNING, COMPLETED, FAILED) but **does not include `aiEnabled`**:

```typescript
// Current code (BROKEN)
const statusData = {
  scanId,
  status,
  url,
  createdAt: createdAt.toISOString(),
  completedAt: completedAt?.toISOString() ?? null,
  errorMessage,
  // aiEnabled is MISSING!
};
```

### Data Flow (Before Fix)

```
1. Frontend sends: { url, email, wcagLevel, aiEnabled: true }
2. Schema validates: aiEnabled ✅
3. Controller builds scanInput: { url, email, wcagLevel } ❌ (aiEnabled dropped!)
4. Service receives: { url, email, wcagLevel } - no aiEnabled
5. Database creates scan with aiEnabled: false (default)
6. GET response returns aiEnabled: false
```

### Data Flow (After Controller Fix, Before Redis Fix)

```
1. Frontend sends: { url, email, wcagLevel, aiEnabled: true }
2. Schema validates: aiEnabled ✅
3. Controller builds scanInput: { url, email, wcagLevel, aiEnabled: true } ✅
4. Database creates scan with aiEnabled: true ✅
5. Initial Redis cache includes aiEnabled: true ✅
6. Worker starts, sets status to RUNNING, overwrites Redis cache WITHOUT aiEnabled ❌
7. GET response returns aiEnabled: false (fallback)
```

## Technical Details

### Affected Code Location

**File:** `apps/api/src/modules/scans/scan.controller.ts`
**Function:** `createScanHandler`
**Lines:** 126-130

### Fix Required

Add `aiEnabled` to the `scanInput` object:

```typescript
// Fixed code
const scanInput: CreateScanInput = {
  url: body.url,
  email: body.email,
  wcagLevel: body.wcagLevel,
  aiEnabled: body.aiEnabled,  // <-- ADD THIS LINE
};
```

## Impact Analysis

### Direct Impact
- **All AI scans fail** - Users cannot create AI-enabled scans
- **AI Early Bird campaign is broken** - No AI slots are being reserved

### Risk Assessment
- **Fix Risk:** Very Low - Single line addition
- **Regression Risk:** None - This is additive, doesn't change existing behavior

## Implementation Plan

### Changes Required

1. **Single file change:** `apps/api/src/modules/scans/scan.controller.ts`
2. **Single line addition:** Add `aiEnabled: body.aiEnabled` to scanInput object

### Testing Strategy

1. Create scan with `aiEnabled: true` via API
2. Verify GET scan response shows `aiEnabled: true`
3. Verify scan appears in admin AI queue

---

*Analysis Version: 1.0*
*Analyzed: 2026-01-03*
*Status: Ready for Fix*
