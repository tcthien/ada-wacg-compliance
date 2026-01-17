# Bug Analysis: cannot-receive-ai-scan-email

## Status: Complete

## Root Cause Identified

**The email address is nullified for GDPR compliance after the standard scan completion email is sent, BEFORE the AI results are imported.**

### Detailed Flow Analysis

1. **User submits scan** with `aiEnabled=true` and provides email address
   - Email stored in `scan.email` field
   - `aiStatus` set to `PENDING`

2. **Standard scan completes** (axe-core analysis)
   - `scan-page.job.ts` line 238-241 queues `scan_complete` email:
     ```javascript
     if (email) {
       await queueEmailNotification(scanId, email, 'scan_complete');
     }
     ```
   - This happens for ALL scans regardless of `aiEnabled` status

3. **Worker processes `scan_complete` email**
   - `send-email.processor.ts` sends the standard scan results email
   - **Lines 370-374**: Email is nullified for GDPR compliance:
     ```javascript
     await prisma.scan.update({
       where: { id: scanId },
       data: { email: null },  // ← EMAIL IS NOW NULL
     });
     ```

4. **Admin imports AI results** (days/hours later)
   - `ai-queue.service.ts` line 712-715 queries for email:
     ```javascript
     const scan = await prisma.scan.findUnique({
       where: { id: row.scan_id },
       select: { email: true, url: true },
     });
     ```
   - **`scan.email` is NULL** → no email queued for AI completion

### Evidence

| File | Line | Code | Issue |
|------|------|------|-------|
| `scan-page.job.ts` | 238-241 | `queueEmailNotification(scanId, email, 'scan_complete')` | Sends email for ALL scans including AI-enabled |
| `send-email.processor.ts` | 370-374 | `data: { email: null }` | Nullifies email after sending |
| `ai-queue.service.ts` | 712-715 | `prisma.scan.findUnique({ select: { email: true } })` | Queries DB for email (already null) |

### Timeline

```
T+0:    User submits scan (email: "user@example.com", aiEnabled: true)
T+30s:  Standard scan completes
T+31s:  scan_complete email sent → email NULLIFIED
T+24h:  Admin imports AI results
T+24h:  Code checks scan.email → NULL → NO EMAIL QUEUED
```

## Solution Options

### Option A: Don't send `scan_complete` email for AI-enabled scans (Recommended)

**Rationale**: Users with `aiEnabled=true` should receive ONE combined email when AI is complete, not two separate emails.

**Changes Required**:
1. Modify `apps/worker/src/jobs/scan-page.job.ts` lines 238-241:
   ```javascript
   // Only queue email notification if NOT AI-enabled
   // AI-enabled scans will get notification when AI processing completes
   if (email && !aiEnabled) {
     await queueEmailNotification(scanId, email, 'scan_complete');
   }
   ```

**Pros**:
- Simple, minimal change
- Better UX (users get one email with complete info)
- No schema changes required
- Email preserved for AI notification

**Cons**:
- Users have to wait for AI to get any email (acceptable per requirements - "within 24 hours")

### Option B: Include email in import CSV and use it directly

**Changes Required**:
1. Add `email` field to `csvImportRowSchema`
2. Modify CLI tool to include email in output CSV
3. Use email from row data instead of DB lookup

**Pros**:
- Works with current flow

**Cons**:
- Requires schema change and CLI modification
- More complex implementation
- Email in CSV creates potential data handling concerns

### Option C: Skip GDPR nullification for AI-enabled scans

**Changes Required**:
1. Modify `send-email.processor.ts` to check `aiEnabled` before nullifying
2. Add additional DB query to check AI status

**Pros**:
- Users get both emails (standard + AI)

**Cons**:
- Complex conditional logic
- Users get two emails which may be confusing
- Extra DB query for every email

## Recommended Fix

**Option A** is recommended because:
1. Simplest implementation (one line change + aiEnabled check)
2. Best user experience (single comprehensive email)
3. Aligns with the AI Early Bird feature design (email contains combined standard + AI results)
4. No schema or CLI changes needed

## Affected Files

| File | Change Type |
|------|-------------|
| `apps/worker/src/jobs/scan-page.job.ts` | Modify email queue condition |

## Testing Plan

1. Submit scan with `aiEnabled=true` and email
2. Verify NO email sent after standard scan completes
3. Export pending AI scans, process with CLI, import results
4. Verify `ai_scan_complete` email IS sent to Mailpit
5. Verify email contains AI summary, link to `/scan/[id]`
6. Verify standard scans (aiEnabled=false) still receive email

## Implementation Notes

- Need to fetch `aiEnabled` flag in scan-page.job.ts (may already be available in job data)
- If `aiEnabled` not in job data, add a DB query or include in job payload
- Update email queuing logic with conditional check
