# Bug Report: Batch Scan AI Status Display Issues

## Status
**FIXED** - Implementation complete

## Summary
Two related UI issues with AI-enabled batch scans:
1. The batch scan detail page does not show AI resource allocation UI like the single scan page does
2. Individual scans within a batch show "Completed" status even when they are waiting for AI resource allocation (aiStatus: PENDING)

## Bug Details

| Field | Value |
|-------|-------|
| **Reported Date** | 2026-01-10 |
| **Reported By** | User |
| **Severity** | Medium |
| **Component** | Batch Scan UI / AI Status Display |
| **Environment** | Development (localhost) |

## Description

### User Report
> For the batch scan detail, when enable AI scan, I cannot see the AI Scan Resource allocation like single scan like my selected codes. In addition, in the UI of batch scan detail, there are a list of single scan & its status is waiting for AI resource allocating but currently UI is showing completed.

### Issue 1: Missing AI Resource Allocation UI in Batch Scan Detail

**Expected Behavior:**
When viewing a batch scan with AI enabled, individual scans that are at 95%+ progress should display the AI resource allocation UI (purple gradient card showing "AI Analysis in Progress", "Allocating AI Resources", processing steps, email notification, etc.) - similar to how single scans display this in `ScanProgress.tsx`.

**Actual Behavior:**
The batch scan detail page (`BatchScansList.tsx`) only shows a simple status badge ("Completed", "Running", etc.) without any AI-specific allocation messaging or visual indicator for scans that are waiting for AI resources.

### Issue 2: Incorrect Status Badge for AI-Pending Scans

**Expected Behavior:**
When a scan's `status` is "COMPLETED" but `aiStatus` is "PENDING", the UI should indicate that the scan is waiting for AI resource allocation - not show as fully completed.

**Actual Behavior:**
The `StatusBadge` component in `BatchScansList.tsx` only considers the scan's main `status` field and displays "Completed" with a green checkmark, even when `aiStatus: 'PENDING'` indicates AI processing hasn't started yet.

## Technical Analysis

### Single Scan Flow (Working)
In `apps/web/src/app/scan/[id]/page.tsx`:
```typescript
// Lines 234-239
const isAiPending = scan.aiEnabled && (scan.progress || 0) >= 90;
// ...
<ScanProgress
  progress={currentStage.progress}
  stage={stageText}
  aiPending={isAiPending || false}
  aiNotificationEmail={scan.aiEnabled && scan.email ? scan.email : undefined}
/>
```

The `ScanProgress` component (lines 127-206) displays the full AI allocation UI when `aiPending && progress >= 95`.

### Batch Scan Flow (Broken)
In `apps/web/src/components/admin/BatchScansList.tsx`:
- The `StatusBadge` component only handles: PENDING, RUNNING, COMPLETED, FAILED
- No consideration for `aiEnabled` or `aiStatus` fields
- No display of AI resource allocation messaging
- `UrlIssueSummaryDetailed` type may not include `aiEnabled` or `aiStatus` fields

### Missing Data Flow
In `apps/web/src/app/admin/batches/[id]/page.tsx`:
- Lines 162-170 calculate `aiStats` for the header
- Lines 149-160 transform scans to `UrlIssueSummaryDetailed` - NO AI fields passed
- `BatchScansList` receives scans WITHOUT `aiEnabled` or `aiStatus` data

## Reproduction Steps

1. Create a batch scan with AI enabled (use the fix from previous bug)
2. Wait for individual scans to complete their accessibility scan
3. Navigate to Admin → Batches → [batch-id]
4. Observe: Scans show "Completed" even if `aiStatus: 'PENDING'`
5. Compare to single scan page at /scan/[id] which shows AI allocation UI

## Expected Fix

1. **Pass AI fields to BatchScansList**: Update the scan transformation in batch detail page to include `aiEnabled` and `aiStatus` fields
2. **Update StatusBadge**: Consider `aiStatus` when determining display status - if scan status is COMPLETED but aiStatus is PENDING/DOWNLOADING, show "Waiting for AI" or similar
3. **Add AI allocation indicator**: Either add the full `ScanProgress` AI UI or a simplified version showing AI processing state

## Related Files

### Components
- `apps/web/src/components/admin/BatchScansList.tsx` - Needs AI status awareness
- `apps/web/src/components/features/scan/ScanProgress.tsx` - Has working AI allocation UI
- `apps/web/src/components/admin/BatchDetailHeader.tsx` - Already shows aiStats

### Pages
- `apps/web/src/app/admin/batches/[id]/page.tsx` - Needs to pass AI fields to scans
- `apps/web/src/app/scan/[id]/page.tsx` - Reference implementation for single scan

### Types
- `apps/web/src/lib/batch-api.ts` - `UrlIssueSummaryDetailed` type may need AI fields

## Impact

- **User Confusion**: Users see "Completed" status but AI analysis hasn't happened yet
- **Missing Information**: No visibility into AI processing state for batch scans
- **Inconsistent UX**: Single scan shows rich AI allocation UI, batch scan shows nothing

---

**Report Status**: Ready for `/bug-analyze` phase
