# Bug Report: AI Import Fails When tokens_used = 0

## Bug Information

| Field | Value |
|-------|-------|
| Bug ID | ai-import-zero-tokens |
| Reported Date | 2026-01-18 |
| Severity | Medium |
| Status | Open |

## Summary

The AI scan result import fails when `tokens_used = 0` in the CSV file. This happens because the AI scan CLI tool supports a caching layer that can return cached results without consuming any tokens, but the import validation schema requires `tokens_used` to be a positive integer (> 0).

## Steps to Reproduce

1. Run an AI scan using the CLI tool with caching enabled
2. If the result is served from cache, `tokens_used` will be `0`
3. Export the results to CSV
4. Attempt to import the CSV via the admin API
5. **Result**: Import fails with validation error "Tokens used must be positive"

## Expected Behavior

The import should succeed when `tokens_used = 0`, as this is a valid scenario when:
- Results are served from the AI scan CLI cache
- No API calls were made to the AI provider
- The scan data is still valid and should be imported

## Actual Behavior

The import fails with a Zod validation error:
```
Tokens used must be positive
```

## Root Cause

The validation schema in `ai-campaign.schema.ts` line 263 uses:
```typescript
tokens_used: z
  .number()
  .int('Tokens used must be an integer')
  .positive('Tokens used must be positive')  // <-- This rejects 0
  .max(100000, 'Tokens used cannot exceed 100000'),
```

The `.positive()` validator requires values > 0, but cached results legitimately have `tokens_used = 0`.

## Affected Files

- `apps/api/src/modules/ai-campaign/ai-campaign.schema.ts` - Line 263
- `tools/ai-scan-cli/src/csv-writer.ts` - Generates CSV with tokens_used = 0 for cached results

## Impact

- **User Impact**: Admins cannot import AI scan results that were served from cache
- **Business Impact**: Valid scan data is rejected, requiring manual workarounds
- **Workaround**: Currently must manually edit CSV to set tokens_used > 0, which is inaccurate

## Proposed Fix

Change the validation from `.positive()` to `.nonnegative()` to allow zero:
```typescript
tokens_used: z
  .number()
  .int('Tokens used must be an integer')
  .nonnegative('Tokens used must be zero or positive')  // Allow 0
  .max(100000, 'Tokens used cannot exceed 100000'),
```

## Additional Context

The AI scan CLI tool implements caching to:
- Reduce API costs by reusing previous results
- Speed up processing for duplicate URLs
- Allow re-running failed imports without re-processing

When a cached result is used, no tokens are consumed, making `tokens_used = 0` a legitimate value.
