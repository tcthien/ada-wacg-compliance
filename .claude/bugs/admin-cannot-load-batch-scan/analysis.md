# Bug Analysis

## Root Cause Analysis

### Investigation Summary
Investigated the data flow from page component → hook → API → table component. Found a critical design mismatch between how the page uses the hook and how the hook is designed to work.

### Root Cause
**The `useAdminBatches` hook ignores filter changes from the parent component after initial render.**

The page component (`page.tsx`) manages its own filter state and passes it to `useAdminBatches(filters)` on every render. However, the hook only uses `initialFilters` once during initialization:

```typescript
// Hook: apps/web/src/hooks/useAdminBatches.ts (lines 82-99)
const defaultFilters: BatchListFilters = {
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  ...initialFilters,  // Only used once!
};

const [filters, setFilters] = useState<BatchListFilters>(defaultFilters);
```

The hook's internal `filters` state is never updated when the parent component's filters change, causing:
1. Initial API call uses empty/default filters
2. Subsequent filter changes in the page are ignored
3. Data never syncs with the page's filter state

### Contributing Factors
1. **Design mismatch**: The hook was designed for "controlled internally" pattern but the page uses "controlled externally" pattern
2. **Missing useEffect**: No effect to sync external `initialFilters` with internal `filters` state
3. **Similar hook works differently**: `useAdminBatchDetail` uses React Query which handles this correctly

## Technical Details

### Affected Code Locations

- **File**: `apps/web/src/app/admin/batches/page.tsx`
  - **Lines**: `42-73`
  - **Issue**: Page builds `filters` in useMemo and passes to hook, expecting hook to use them

- **File**: `apps/web/src/hooks/useAdminBatches.ts`
  - **Lines**: `80-99`
  - **Issue**: Hook only uses `initialFilters` once, ignores subsequent changes

### Data Flow Analysis
```
Page Component                    Hook
===============                   ====
filterState (useState) ─────┐
page (useState) ─────────────┼──► filters (useMemo) ──► useAdminBatches(filters)
                             │                                   │
                             │                    ┌──────────────┘
                             │                    ▼
                             │    initialFilters (only used once)
                             │                    │
                             │                    ▼
                             │    const [filters] = useState(defaultFilters)
                             │    // Internal state - never updated!
                             │                    │
                             │                    ▼
                             │    useEffect(() => fetchBatches(), [filters])
                             │    // Uses stale internal filters
                             │                    │
                             └────────── X ───────┘ (Disconnect!)
```

## Solution Approach

### Fix Strategy
**Option A (Recommended)**: Sync external filters with internal state using useEffect

Add a useEffect to the hook that updates internal filters when initialFilters changes:

```typescript
// Add after line 99 in useAdminBatches.ts
useEffect(() => {
  if (initialFilters) {
    setFilters(prev => ({
      ...prev,
      ...initialFilters,
    }));
  }
}, [initialFilters?.page, initialFilters?.status, initialFilters?.startDate,
    initialFilters?.endDate, initialFilters?.sessionId, initialFilters?.sortBy,
    initialFilters?.sortOrder, initialFilters?.pageSize]);
```

### Alternative Solutions
**Option B**: Refactor to use React Query like `useAdminBatchDetail`
- More work but cleaner architecture
- Better caching and state management
- Consistent with other hooks in the codebase

**Option C**: Remove internal filter state, use initialFilters directly
- Simpler but changes hook's API contract
- May break other consumers of this hook

### Risks and Trade-offs
- **Option A**: Minimal change, but adds complexity with dependency array management
- **Option B**: More work, but better long-term solution
- **Option C**: Breaking change if hook is used elsewhere

## Implementation Plan

### Changes Required

1. **Change 1**: Add useEffect to sync external filters
   - File: `apps/web/src/hooks/useAdminBatches.ts`
   - Modification: Add useEffect after line 99 to sync `initialFilters` with internal `filters` state

### Testing Strategy
1. Navigate to `/admin/batches` - should display batch list
2. Change filters (status, date range) - list should update
3. Change pages using pagination - data should refresh
4. Verify summary bar shows correct totals
5. Verify table shows correct batch rows

### Rollback Plan
Revert the single file change to `useAdminBatches.ts`

---

## Additional Root Cause (Discovered During Verification)

### Issue 2: API Response Structure Mismatch

**The API returns `items` but the frontend expects `batches`.**

API Response:
```json
{
  "success": true,
  "data": {
    "items": [...],  // <-- API returns "items"
    "pagination": {...}
  }
}
```

Frontend Type Definition (`AdminBatchListResponse`):
```typescript
{
  batches: AdminBatchSummary[];  // <-- Frontend expects "batches"
  pagination: {...}
}
```

Hook code that fails:
```typescript
// apps/web/src/hooks/useAdminBatches.ts:138
setBatches(response.batches);  // undefined because API returns "items"
```

### Fix Required
Change the API controller to return `batches` instead of `items`:

```typescript
// apps/api/src/modules/admin/batch-admin.controller.ts:148-154
return reply.code(200).send({
  success: true,
  data: {
    batches: items,  // Changed from "items" to "batches"
    pagination: result.pagination,
  },
});
```
