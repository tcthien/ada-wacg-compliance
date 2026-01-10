# Bug Analysis

## Root Cause Analysis

### Investigation Summary

The UI inconsistency between `/admin/scans` and `/admin/batches` is caused by different implementations of the table components:

1. **ScanTable.tsx** - Does NOT have row click navigation
2. **BatchTable.tsx** - HAS row click navigation but MISSING delete action

### Root Cause

**Issue 1: Missing Row Click in ScanTable**

**File:** `apps/web/src/components/admin/ScanTable.tsx`
**Line:** 355

The `<tr>` element has no `onClick` handler or `cursor-pointer` class:

```tsx
// Current (BROKEN)
<tr key={scan.id} className="hover:bg-gray-50 transition-colors">
```

**Reference Implementation (BatchTable.tsx lines 395-399):**
```tsx
// Correct behavior
<tr
  key={batch.id}
  onClick={() => handleRowClick(batch.id)}
  className="hover:bg-gray-50 transition-colors cursor-pointer"
>
```

**Issue 2: Missing Delete Action in BatchTable**

**File:** `apps/web/src/components/admin/BatchTable.tsx`

The BatchTable has no Actions column with delete button, unlike ScanTable which has:
- Actions column header (line ~319)
- Delete button in each row (lines 439-446)

The API already supports batch deletion via `adminApi.batches.delete(batchId)` (admin-api.ts:987-990).

### Contributing Factors

- Components were likely developed at different times
- No shared base table component for consistency
- Missing UI consistency review

## Technical Details

### Affected Code Locations

| File | Issue | Lines |
|------|-------|-------|
| `apps/web/src/components/admin/ScanTable.tsx` | Missing onClick on `<tr>` | ~355 |
| `apps/web/src/components/admin/BatchTable.tsx` | Missing Actions column & delete button | ~395-450 |

### API Support

- **Scan Delete**: ✅ `adminApi.scans.delete(scanId)` - Already exists
- **Batch Delete**: ✅ `adminApi.batches.delete(batchId)` - Already exists (lines 987-990)

## Solution Approach

### Fix Strategy

**Fix 1: Add row click to ScanTable.tsx**

1. Add `handleRowClick` function using `useRouter`
2. Add `onClick` handler to `<tr>` element
3. Add `cursor-pointer` class to `<tr>`

```tsx
// Add to ScanTable component
const router = useRouter();
const handleRowClick = (scanId: string) => {
  router.push(`/admin/scans/${scanId}`);
};

// Update <tr>
<tr
  key={scan.id}
  onClick={() => handleRowClick(scan.id)}
  className="hover:bg-gray-50 transition-colors cursor-pointer"
>
```

**Fix 2: Add delete action to BatchTable.tsx**

1. Add Actions column header to `<thead>`
2. Add delete button to each row
3. Add delete confirmation dialog (similar to ScanTable)
4. Implement `handleDelete` function using existing `adminApi.batches.delete()`

### Testing Strategy

1. Navigate to `/admin/scans` - verify row click navigates to detail
2. Navigate to `/admin/batches` - verify row click still works (regression)
3. On `/admin/batches` - verify delete action appears and works
4. Verify confirmation dialog appears before delete
5. Verify list refreshes after successful delete

### Risk Assessment

- **Fix Risk:** Low - Adding functionality without modifying existing behavior
- **Regression Risk:** Low - Row click in BatchTable should remain unchanged

---

*Status: Analysis Complete - Ready for Fix*
*Analyzed: 2026-01-03*
