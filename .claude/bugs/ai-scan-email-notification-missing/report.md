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

### Suspected Root Cause (UPDATED)
**GDPR email nullification removes email address before AI import can queue notification.**

The actual root cause is NOT a function signature mismatch (that was fixed in a previous commit). The real issue is:

1. When a scan completes normally, the `scan_complete` email is sent
2. After sending, the email is **nullified** for GDPR compliance (line 370-374 in `send-email.processor.ts`)
3. When AI results are imported later, the import function tries to fetch `scan.email`
4. Since `scan.email` is now `null`, the `if (scan?.email)` check fails
5. **No `ai_scan_complete` email is queued** - silently skipped

```typescript
// In send-email.processor.ts (processSendEmail function):
// After sending scan_complete email:
await prisma.scan.update({
  where: { id: scanId },
  data: { email: null },  // <-- Email is nullified here
});
```

```typescript
// In ai-queue.service.ts (importAiResults function):
const scan = await prisma.scan.findUnique({
  where: { id: row.scan_id },
  select: { email: true, url: true },
});

if (scan?.email) {  // <-- This is null, so email is never queued
  // Queue ai_scan_complete email...
}
```

### Affected Components
- `apps/worker/src/processors/send-email.processor.ts` - Nullifies email after `scan_complete` without checking if AI is enabled

---

## Fix Applied

**Modified**: `apps/worker/src/processors/send-email.processor.ts`

The fix skips email nullification for AI-enabled scans, preserving the email address until the `ai_scan_complete` email is sent:

```typescript
// 5. Nullify email in database (GDPR compliance)
// Skip nullification if AI is enabled - email will be nullified after ai_scan_complete email
let emailNullified = false;
if (scan.aiEnabled) {
  console.log(`⏳ Skipping email nullification - AI processing pending (will nullify after AI email)`);
} else {
  await prisma.scan.update({
    where: { id: scanId },
    data: { email: null },
  });
  emailNullified = true;
  console.log(`🔒 Email address nullified for GDPR compliance`);
}
```

### Impact
- **New AI-enabled scans**: Will correctly receive both `scan_complete` AND `ai_scan_complete` emails
- **Existing scans with nullified emails**: Cannot be fixed retroactively (email is already null)

---

**Report Created**: 2026-01-10
**Fix Applied**: 2026-01-17
**Status**: Fixed - Pending Verification
