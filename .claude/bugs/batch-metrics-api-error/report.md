# Bug Report

## Bug Summary
Dashboard fails to load batch metrics with error "Failed to get batch metrics" from the admin API.

## Bug Details

### Expected Behavior
When an admin logs in and views the dashboard at `/admin/dashboard`, the batch metrics section should display:
1. Totals (today, this week, this month)
2. Averages (URLs per batch, processing time, completion rate)
3. Recent batches list
4. Trend data chart

### Actual Behavior
- The batch metrics API call fails with error: "Failed to get batch metrics"
- Error originates from `adminApiClient` in `apps/web/src/lib/admin-api.ts`
- Backend returns 500 error from `/api/v1/admin/dashboard/batches` endpoint

### Steps to Reproduce
1. Log in to the admin panel at `/admin`
2. Navigate to Dashboard (default landing page)
3. Observe console error: "Failed to fetch batch metrics: Error: Failed to get batch metrics"

### Environment
- **Version**: Development build
- **Platform**: Web browser (Chrome/Firefox)
- **Configuration**: Local development environment

## Impact Assessment

### Severity
- [x] Medium - Feature partially broken (dashboard still loads but missing batch metrics)

### Affected Users
Admin users viewing the dashboard

### Affected Features
- Dashboard batch metrics display
- Dashboard charts that depend on batch metrics
- Admin overview of batch scan activity

## Additional Context

### Error Messages
```
Failed to fetch batch metrics: Error: Failed to get batch metrics
    adminApiClient webpack-internal:///(app-pages-browser)/./src/lib/admin-api.ts:23
```

### Related Code
- Frontend: `apps/web/src/components/admin/DashboardBatchMetrics.tsx:119`
- Frontend: `apps/web/src/components/admin/DashboardCharts.tsx:88`
- Backend: `apps/api/src/modules/admin/batch-admin.controller.ts:816-864`
- Backend: `apps/api/src/modules/admin/batch-admin.service.ts:1425-1649`

## Initial Analysis

### Suspected Root Cause
The `getBatchMetrics` function in `batch-admin.service.ts` is throwing an error during database query execution. Possible causes:
1. Missing or incorrect database table/column names
2. Prisma query issues
3. Database connection problems
4. Raw SQL query compatibility issues

### Affected Components
- `apps/api/src/modules/admin/batch-admin.service.ts` - getBatchMetrics function
- `apps/api/src/modules/admin/batch-admin.controller.ts` - getBatchMetricsHandler
- `apps/web/src/components/admin/DashboardBatchMetrics.tsx` - Frontend component
- `apps/web/src/components/admin/DashboardCharts.tsx` - Frontend component
