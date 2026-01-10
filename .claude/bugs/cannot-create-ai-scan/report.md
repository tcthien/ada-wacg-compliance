# Bug Report

## Bug Summary

When creating a scan with `aiEnabled: true`, the API correctly receives the request but the scan is saved/returned with `aiEnabled: false`.

## Bug Details

### Expected Behavior

1. User submits scan form with AI checkbox enabled
2. Frontend sends POST `/api/v1/scans` with `aiEnabled: true`
3. API creates scan with `aiEnabled: true` in database
4. GET `/api/v1/scans/:id` returns scan with `aiEnabled: true`
5. Results page shows AI pending status

### Actual Behavior

1. User submits scan form with AI checkbox enabled
2. Frontend sends POST `/api/v1/scans` with `aiEnabled: true` ✅
3. API creates scan but `aiEnabled` is `false` in response ❌
4. GET `/api/v1/scans/:id` returns `aiEnabled: false` ❌
5. No AI analysis is queued

### Steps to Reproduce

1. Navigate to main scan form at `/`
2. Enable "AI-Powered Analysis" checkbox
3. Enter URL: `https://coc-layout.com/`
4. Enter email: `thientran1986@gmail.com`
5. Submit the scan
6. Observe network requests:
   - **POST** `/api/v1/scans` request body:
     ```json
     {
       "url": "https://coc-layout.com/",
       "wcagLevel": "AA",
       "recaptchaToken": "local-dev-bypass-token",
       "email": "thientran1986@gmail.com",
       "aiEnabled": true
     }
     ```
     response body:
    ```json
    {"success":true,"data":{"scanId":"f30a766c-94df-4b94-90e1-7d4634fa247c","status":"PENDING","url":"https://coc-layout.com/"}}
    ```
   - **GET** `/api/v1/scans/f30a766c-94df-4b94-90e1-7d4634fa247c` response:
     ```json
     {
       "success": true,
       "data": {
         "scanId": "f30a766c-94df-4b94-90e1-7d4634fa247c",
         "status": "RUNNING",
         "progress": 10,
         "url": "https://coc-layout.com/",
         "createdAt": "2026-01-03T08:32:36.028Z",
         "completedAt": null,
         "errorMessage": null,
         "aiEnabled": false
       }
     }
     ```

### Environment

- **Version**: Current development build
- **Platform**: localhost:3000 (web), localhost:3080 (API)
- **Browser**: Chrome (assumed)

## Impact Assessment

### Severity

- [x] **Critical** - Core AI feature completely broken

Users cannot create AI-enabled scans at all. The AI Early Bird campaign is non-functional.

### Affected Users

- All users attempting to use AI scanning feature

### Affected Features

- AI Early Bird Scan creation
- AI slot reservation
- AI status tracking

## Additional Context

### Error Messages

No explicit error - the request succeeds but `aiEnabled` is silently set to `false`.

### Related Code

Potential areas to investigate:
1. `apps/api/src/modules/scans/scan.controller.ts` - Create scan endpoint
2. `apps/api/src/modules/scans/scan.service.ts` - createScan() function
3. `apps/api/src/modules/scans/scan.schema.ts` - Request validation schema
4. `apps/api/src/modules/scans/scan.repository.ts` - Database operations

### Hypothesis

The issue is likely one of:
1. **Schema validation**: `aiEnabled` not included in Zod schema, stripped during validation
2. **Service layer**: `aiEnabled` not being passed to create function
3. **Repository layer**: `aiEnabled` not included in Prisma create data
4. **Response mapping**: `aiEnabled` not included in GET response

---

*Created: 2026-01-03*
*Reporter: User*
*Status: Open*
