# Bug Report

## Bug Summary

AI-enabled scans complete with success status without displaying AI pending state to customers, and admin UI lacks mechanism to view/query pending AI scans for CLI processing.

## Bug Details

### Expected Behavior

Based on the AI Early Bird Scan spec (REQ-1, REQ-4, REQ-6):

**Customer Experience:**
1. After standard scan completes (95-99% progress), show: "Allocating resources for AI analysis..." with spinner
2. On results page, display:
   - Standard scan: ✅ Complete
   - AI Analysis: "Allocating resources for AI analysis..." with spinner (when `aiStatus=PENDING`)
3. Show informative message: "AI results will also be sent to {email}" with expected timeframe "within 24 hours"

**Admin Experience:**
1. Admin AI Queue page (`/admin/ai-campaign`) should display:
   - List of all scans with `aiEnabled=true`
   - Filter by `aiStatus` (PENDING, DOWNLOADED, PROCESSING, COMPLETED, FAILED)
   - Export to CSV button for pending scans
   - Queue statistics (pending count, processing count, etc.)
2. Admin can export pending scans and process them via local Claude Code CLI

### Actual Behavior

**Customer Experience:**
1. Scan worker executes only the common axe-core scan
2. Responds with success immediately without showing AI pending state
3. No "Allocating AI resources..." message displayed at 95-99% progress
4. No email notification message shown to customer
5. Results page does not indicate AI scan is pending

**Admin Experience:**
1. Admin UI at `/admin/ai-campaign` shows "2 pending" but processing queue appears empty
2. No mechanism to query/load the list of scans waiting for AI processing
3. Cannot export pending AI scans for CLI processing
4. Dashboard metrics don't properly reflect pending AI scans

### Steps to Reproduce

1. Navigate to main scan form at `/`
2. Enable "AI-Powered Analysis" checkbox (AI Early Bird feature)
3. Enter a valid URL and email address
4. Submit the scan
5. Observe: Scan completes and shows success without AI pending indication
6. Navigate to `/admin/ai-campaign` (as admin)
7. Observe: Shows "2 pending" but cannot view or interact with pending scans

### Environment

- **Version**: Current development build
- **Platform**: Web (localhost:3000 / production)
- **Configuration**: AI Early Bird campaign enabled

## Impact Assessment

### Severity

- [x] High - Major functionality broken

The AI Early Bird feature is a key differentiator for ADAShield (per product.md). Users who opt-in to AI scanning:
- Don't know their AI scan is queued
- Don't receive expected feedback about email notification
- May think the feature is broken

Operators cannot process AI scans because:
- Cannot view which scans need AI processing
- Cannot export pending scans for CLI processing
- Campaign appears non-functional

### Affected Users

- **Customers**: All users who enable AI scanning checkbox
- **Operators/Admins**: Cannot process AI queue, campaign appears broken

### Affected Features

1. AI Scan Progress Display (REQ-1, criterion 4)
2. Results Page AI Status (REQ-6, criteria 1-6)
3. Admin AI Queue Management (REQ-4, criteria 1-5)
4. Admin Dashboard AI Metrics (REQ-8)

## Additional Context

### Error Messages

No explicit errors - the issue is missing functionality:
- No "Allocating resources for AI analysis..." message
- No AI status section on results page
- Empty queue view in admin despite pending count

### Screenshots/Media

N/A - functional gap, not visual error

### Related Issues

- Spec: `.claude/specs/ai-early-bird-scan/requirements.md`
- Spec: `.claude/specs/ai-early-bird-scan/design.md`
- Admin route: `/admin/ai-campaign`

## Initial Analysis

### Suspected Root Cause

Based on the spec design, there appear to be multiple gaps:

1. **Scan Worker**: Not properly setting `aiStatus=PENDING` after standard scan completes, or not including AI status in response
2. **Frontend Progress**: Missing the 95-99% "Allocating AI resources..." progress state
3. **Results Page**: Missing `useAiScanStatus` hook integration or `AiStatusBadge` component rendering
4. **Admin Queue API**: Missing or incomplete endpoints:
   - `GET /api/v1/admin/ai-queue` (list AI scans with filters)
   - `GET /api/v1/admin/ai-queue/export` (export pending scans CSV)
   - `GET /api/v1/admin/ai-queue/stats` (queue statistics)
5. **Admin UI**: Missing queue table and export functionality in `/admin/ai-campaign`

### Affected Components

**Backend:**
- `apps/api/src/modules/scans/scan.service.ts` - AI status setting
- `apps/api/src/modules/ai-campaign/ai-queue.service.ts` - Queue management
- `apps/api/src/modules/ai-campaign/ai-queue.controller.ts` - Queue API endpoints
- `apps/worker/src/jobs/scan-page.job.ts` - AI status after scan

**Frontend:**
- `apps/web/src/components/features/scan/ScanProgress.tsx` - 95-99% AI state
- `apps/web/src/app/scan/[id]/page.tsx` - Results page AI integration
- `apps/web/src/components/features/ai/AiStatusBadge.tsx` - Status display
- `apps/web/src/hooks/useAiScanStatus.ts` - Polling for AI status
- `apps/web/src/app/admin/ai-campaign/page.tsx` - Admin queue UI
- `apps/web/src/hooks/useAdminAiQueue.ts` - Admin queue data

---

*Created: 2026-01-03*
*Reporter: User*
*Status: Open*
