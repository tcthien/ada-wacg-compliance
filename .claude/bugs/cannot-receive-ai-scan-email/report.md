# Bug Report: cannot-receive-ai-scan-email

## Summary
After importing AI scan results into the tool, users can see the AI scan results on the results page, but no email notification is sent about the completed AI analysis.

## Environment
- **Environment**: Local development
- **Email Service**: Mailpit (http://localhost:8025/)
- **Date Reported**: 2026-01-17

## Steps to Reproduce
1. Submit a scan with AI enhancement enabled (aiEnabled=true)
2. Wait for standard scan to complete (aiStatus=PENDING)
3. Export pending AI scans via admin panel (CSV export)
4. Process scans with Claude Code CLI locally
5. Import AI results CSV via admin panel
6. Verify AI results appear on the scan results page (aiStatus=COMPLETED)
7. Check Mailpit inbox for email notification

## Expected Behavior
- After AI results import, an email notification should be sent to the user
- Email should contain: AI summary, top priority fixes, link to scan detail page
- Link should point to customer view (`/scan/[id]`) where user can:
  - View full AI analysis results
  - Download report (PDF/JSON export)
- Email should appear in Mailpit inbox within seconds of import

## Actual Behavior
- AI results are successfully imported and visible on results page
- aiStatus is updated to COMPLETED
- **No email notification is received in Mailpit**

## Evidence
- User can see AI scan results on the web interface
- Mailpit inbox at http://localhost:8025/ shows no AI completion emails

## Impact
- **Severity**: Medium
- **User Impact**: Users who requested AI analysis via email won't know when their results are ready
- **Business Impact**: Core feature of AI Early Bird campaign (email delivery) is broken

## Related Components
- `apps/api/src/modules/ai-campaign/ai-queue.service.ts` - Import orchestration
- `apps/worker/src/processors/send-email.processor.ts` - Email job processing
- `apps/worker/src/processors/notifier/email-templates.ts` - AI email template
- `apps/api/src/shared/queue/queue.service.ts` - Job queue

## Initial Hypothesis
Possible causes:
1. Email job not being queued after AI result import
2. Email job queued but worker not processing it
3. Email template or data issue causing silent failure
4. Queue connection or configuration issue

## Additional Context
- Standard scan completion emails may or may not be working (needs verification)
- The AI import process updates database records correctly
- This is part of the AI Early Bird Scan feature (86% complete)
