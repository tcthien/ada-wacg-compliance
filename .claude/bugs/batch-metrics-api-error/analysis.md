# Bug Analysis

## Root Cause Analysis

### Investigation Summary
Investigated the batch metrics API endpoint that was returning 500 errors. Found an invalid Prisma query in the `getBatchMetrics` function.

### Root Cause
**Invalid Prisma aggregate query trying to average a DateTime field.**

In `batch-admin.service.ts` at line 1534-1542, there's an invalid aggregate query:

```typescript
const completedWithDuration = await prisma.batchScan.aggregate({
  _avg: {
    completedAt: false, // <-- INVALID: Can't average DateTime field
  },
  where: {
    status: 'COMPLETED',
    completedAt: { not: null },
  },
});
```

Issues:
1. `completedAt` is a DateTime field - Prisma's `_avg` only works on numeric fields
2. The value `false` is invalid syntax for aggregation
3. The result `completedWithDuration` is never used - it's dead code
4. This causes a runtime error when Prisma tries to execute the query

### Contributing Factors
1. **Dead code**: The aggregate query result is never used
2. **TypeScript error ignored**: TypeScript error TS2353 was present but not caught during development
3. **Incorrect approach**: Developer may have intended to calculate average processing time but implemented it incorrectly

## Technical Details

### Affected Code Locations

- **File**: `apps/api/src/modules/admin/batch-admin.service.ts`
  - **Lines**: `1534-1542`
  - **Issue**: Invalid Prisma aggregate query on DateTime field

### TypeScript Errors (Pre-existing)
```
src/modules/admin/batch-admin.service.ts(1536,9): error TS2353:
Object literal may only specify known properties, and 'completedAt'
does not exist in type 'BatchScanAvgAggregateInputType'.
```

## Solution Approach

### Fix Strategy
**Remove the dead/invalid code block** - The aggregate query at lines 1534-1542 is:
1. Invalid (can't average DateTime)
2. Unused (result variable is never referenced)
3. Causing runtime errors

The actual processing time calculation is already correctly implemented below (lines 1544-1567) using `findMany` and manual calculation.

### Changes Required

1. **Change 1**: Remove invalid aggregate query
   - File: `apps/api/src/modules/admin/batch-admin.service.ts`
   - Modification: Delete lines 1533-1542 (the comment and the entire aggregate query block)

### Testing Strategy
1. Run TypeScript check - error should be resolved
2. Start the API server
3. Navigate to admin dashboard - batch metrics should load successfully
4. Verify all metric values are displayed correctly

### Rollback Plan
Revert the single file change to `batch-admin.service.ts`
