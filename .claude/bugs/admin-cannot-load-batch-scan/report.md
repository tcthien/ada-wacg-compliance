# Bug Report

## Bug Summary
Admin users can see the total batch count in the summary bar but the batch list table is empty - no batch scan results are displayed.

## Bug Details

### Expected Behavior
When an admin logs in and navigates to the Batches menu (`/admin/batches`), they should see:
1. Summary bar with total batches count and aggregate statistics
2. A table listing all batch scans with their details (homepage URL, status, issue counts, etc.)
3. Pagination controls if there are more than 20 batches

### Actual Behavior
- The summary bar shows the total count correctly
- The batch table appears empty - no rows are displayed
- The pagination info may show "Showing 1 to X of Y results" but no actual data rows appear

### Steps to Reproduce
1. Log in to the admin panel at `/admin` with admin credentials
2. Click on "Batches" in the sidebar menu
3. Observe the Batches page loads
4. Notice the summary bar shows batch count but table is empty

### Environment
- **Version**: Development build
- **Platform**: Web browser (Chrome/Firefox)
- **Configuration**: Local development environment

## Impact Assessment

### Severity
- [x] High - Major functionality broken

### Affected Users
Admin users who need to view and manage batch scan results

### Affected Features
- Batch list viewing
- Batch management (cannot click on batches to view details)
- Admin oversight of scan operations

## Additional Context

### Error Messages
```
TypeError: can't access property "reduce", batches is undefined
Source: src/app/admin/batches/page.tsx (88:5)
```

### Screenshots/Media
N/A - Error occurs on page load

### Related Issues
- Previously fixed undefined batches error in useMemo calculations
- May be related to API response handling or hook initialization

## Initial Analysis

### Suspected Root Cause
The `useAdminBatches` hook may not be returning the batch data correctly, or there's a mismatch between:
1. How the page component passes filters to the hook
2. How the hook manages its internal state vs external filters
3. The API response structure vs what the components expect

### Affected Components
- `apps/web/src/app/admin/batches/page.tsx` - Main batch list page
- `apps/web/src/hooks/useAdminBatches.ts` - Data fetching hook
- `apps/web/src/components/admin/BatchTable.tsx` - Table display component
- `apps/web/src/lib/admin-api.ts` - API client for batch endpoints
