# Bug Verification

## Fix Summary

### Changes Made

**File: `apps/api/src/modules/scans/scan.controller.ts`**

1. **Line 130**: Added `aiEnabled: body.aiEnabled` to scanInput object
2. **Lines 35-44**: Updated JSDoc to document `aiEnabled` in request body
3. **Lines 47-52**: Updated JSDoc to document `aiEnabled` in response
4. **Line 144**: Added `aiEnabled: scan.aiEnabled` to response data

**File: `apps/api/src/modules/scans/scan.controller.test.ts`**

1. Added test: `should include aiEnabled when provided` - Verifies creating scan with aiEnabled=true
2. Added test: `should default aiEnabled to undefined when not provided` - Verifies default behavior
3. Updated existing tests to include `aiEnabled` in mock responses

**File: `apps/api/src/modules/scans/scan.service.ts`**

1. **Lines 231-232**: Added `aiEnabled` and `email` to the initial Redis cache when creating a scan

**File: `apps/worker/src/processors/scan-page.processor.ts`**

1. **Lines 46-47**: Added `aiEnabled` and `email` parameters to `updateRedisStatus` function
2. **Lines 59-60**: Included `aiEnabled` and `email` in the Redis status cache data
3. **Line 345**: Updated scan query to include `aiEnabled` and `email`
4. **Line 359**: Pass `aiEnabled` and `email` when setting status to RUNNING
5. **Line 583**: Pass `aiEnabled` and `email` when setting status to COMPLETED
6. **Line 672**: Updated failedScan query to include `aiEnabled` and `email`
7. **Line 686**: Pass `aiEnabled` and `email` when setting status to FAILED

### Root Cause

Two issues were identified:

1. **Controller Issue**: The `createScanHandler` function was not passing `aiEnabled` from the validated request body to the service layer.

2. **Redis Cache Issue**: Even after the database correctly stored `aiEnabled=true`, the Redis cache was being updated by the worker without preserving the `aiEnabled` field. This caused subsequent GET requests to return `aiEnabled: false` (the default fallback).

### Fix Applied

1. Added `aiEnabled: body.aiEnabled` to the `scanInput` object in the controller
2. Added `aiEnabled` and `email` to the initial Redis cache in `scan.service.ts`
3. Updated the worker's `updateRedisStatus` function to accept and preserve `aiEnabled` and `email`

## Verification Steps

### Manual Testing

1. Start the API server:
   ```bash
   ./app-start.sh
   ```

2. Create a scan with AI enabled:
   ```bash
   curl -X POST http://localhost:3080/api/v1/scans \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://example.com",
       "wcagLevel": "AA",
       "email": "test@example.com",
       "aiEnabled": true,
       "recaptchaToken": "local-dev-bypass-token"
     }'
   ```

3. Expected response:
   ```json
   {
     "success": true,
     "data": {
       "scanId": "<uuid>",
       "status": "PENDING",
       "url": "https://example.com",
       "aiEnabled": true
     }
   }
   ```

4. Verify with GET request:
   ```bash
   curl http://localhost:3080/api/v1/scans/<scanId>
   ```

5. Expected: Response should show `"aiEnabled": true`

### Automated Testing

Run the scan controller tests:
```bash
cd apps/api && pnpm test -- src/modules/scans/scan.controller.test.ts --run
```

aiEnabled-specific tests should pass:
- `should include aiEnabled when provided` ✓
- `should default aiEnabled to undefined when not provided` ✓

Note: There are 11 pre-existing test failures unrelated to this fix (scan ID format validation issues).

## Verification Checklist

- [x] `aiEnabled` passed from controller to service
- [x] `aiEnabled` included in API response
- [x] JSDoc updated with aiEnabled in request/response examples
- [x] Tests added for aiEnabled functionality
- [x] Tests pass for aiEnabled-specific cases

---

*Verified: 2026-01-03*
*Status: Fixed*
