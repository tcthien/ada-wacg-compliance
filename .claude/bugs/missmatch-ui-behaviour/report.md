# Bug Report

## Bug Summary

UI inconsistency between Admin Batches List (`/admin/batches`) and Admin Scans List (`/admin/scans`): Users can click on table rows to open batch details, but must click on a specific view icon for scan details. Additionally, the batches list is missing a delete action that exists in the scans list.

## Bug Details

### Expected Behavior

1. **Row Click Navigation**: Both `/admin/batches` and `/admin/scans` tables should allow users to click anywhere on a row to navigate to the detail page
2. **Delete Action**: The batches list should have a delete action similar to the scans list for consistency

### Actual Behavior

1. **Row Click Navigation**:
   - `/admin/batches`: Clicking on a row navigates to batch detail page - CORRECT
   - `/admin/scans`: Clicking on a row does nothing; user must click on the view icon - INCONSISTENT

2. **Delete Action**:
   - `/admin/scans`: Has delete action available
   - `/admin/batches`: Missing delete action - INCONSISTENT

### Steps to Reproduce

**For Row Click Issue:**
1. Navigate to `/admin/batches`
2. Click on any batch row - navigates to detail page (works)
3. Navigate to `/admin/scans`
4. Click on any scan row - nothing happens (broken)
5. Must click on the view icon to see scan details

**For Delete Action Issue:**
1. Navigate to `/admin/batches`
2. Observe there is no delete action available for batch rows
3. Navigate to `/admin/scans`
4. Observe delete action is available for scan rows

### Environment

- **Version**: Current development build
- **Platform**: localhost:3000 (Admin Panel)
- **Pages Affected**: `/admin/scans`, `/admin/batches`

## Impact Assessment

### Severity

- [x] Medium - Feature impaired but workaround exists

Users can still access scan details via the view icon, but the inconsistent behavior creates confusion and a poor user experience.

### Affected Users

- All admin users managing scans and batches

### Affected Features

- Admin Scans List table row interaction
- Admin Batches List delete functionality

## Additional Context

### Error Messages

None - this is a UX inconsistency, not a functional error.

### Related Code

**Scans List:**
- `apps/web/src/components/admin/ScanTable.tsx` - Scan table component

**Batches List:**
- `apps/web/src/components/admin/BatchTable.tsx` - Batch table component (reference for expected behavior)

## Initial Analysis

### Suspected Root Cause

1. **Row Click**: The `ScanTable.tsx` component likely doesn't have an `onClick` handler on the table rows, unlike `BatchTable.tsx`
2. **Delete Action**: The `BatchTable.tsx` or batch list page is missing the delete action button/handler that exists in the scan components

### Affected Components

- `apps/web/src/components/admin/ScanTable.tsx` - Needs row click handler
- `apps/web/src/components/admin/BatchTable.tsx` - Needs delete action
- `apps/web/src/app/admin/scans/page.tsx` - May need updates for navigation
- `apps/web/src/app/admin/batches/page.tsx` - May need delete handler

---

*Created: 2026-01-03*
*Reporter: User*
*Status: Open*
