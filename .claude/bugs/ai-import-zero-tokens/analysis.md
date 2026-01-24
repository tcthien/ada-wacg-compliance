# Bug Analysis

## Root Cause Analysis

### Investigation Summary

The bug is a simple validation constraint issue. The `tokens_used` field in the CSV import schema uses Zod's `.positive()` validator, which requires values strictly greater than 0. This rejects the legitimate value of `0` when AI scan results are served from cache.

### Root Cause

**Single-line fix needed**: The validation constraint `.positive()` should be `.nonnegative()`.

```typescript
// Current (ai-campaign.schema.ts:263)
.positive('Tokens used must be positive')  // Requires > 0

// Should be
.nonnegative('Tokens used must be zero or positive')  // Allows >= 0
```

### Why This Wasn't Caught

1. The caching feature was added to the AI scan CLI after the schema was defined
2. Original assumption was that all AI scans consume tokens
3. No test case for `tokens_used = 0` scenario

## Technical Details

### Affected Code Location

| File | Line | Issue |
|------|------|-------|
| `apps/api/src/modules/ai-campaign/ai-campaign.schema.ts` | 263 | `.positive()` rejects 0 |

### Data Flow

```
AI Scan CLI (with cache)
    ↓
tokens_used = 0 (cached result)
    ↓
CSV Export
    ↓
Admin Import API
    ↓
csvImportRowSchema validation
    ↓
.positive() check FAILS ❌
```

## Solution Approach

### Fix Strategy

**Minimal change**: Replace `.positive()` with `.nonnegative()` in the Zod schema.

### Changes Required

1. **Schema Change** (`ai-campaign.schema.ts:263`)
   ```typescript
   // Before
   .positive('Tokens used must be positive')

   // After
   .nonnegative('Tokens used must be zero or positive')
   ```

2. **Update JSDoc Comment** (`ai-campaign.schema.ts:254`)
   ```typescript
   // Before
   * Required - positive integer less than 100000

   // After
   * Required - non-negative integer less than 100000 (0 allowed for cached results)
   ```

3. **Update Test** (`ai-queue.service.test.ts:276`)
   - Rename test: "should validate tokens_used is a non-negative number"
   - Keep testing that negative values (-100) are rejected
   - Add test that 0 is accepted

### Testing Strategy

1. Existing test should still pass (negative tokens rejected)
2. Add new test case for `tokens_used = 0`
3. Verify import works with cached results

## Impact Analysis

### Risk Assessment

- **Risk Level**: Low
- **Scope**: Only affects validation of `tokens_used` field
- **Backwards Compatibility**: ✅ All previously valid values remain valid
- **Side Effects**: None expected

### Rollback Plan

Revert the single line change if issues arise.
