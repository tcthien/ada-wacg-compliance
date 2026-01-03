# Bug Analysis: Sitemap API "Invalid Request Body"

## Status: APPROVED

## Root Cause

The frontend sends `maxDepth: 0` when fetching a sitemap, but the API schema requires `maxDepth` to be **positive** (> 0).

### Frontend Code (`useDiscoveryFlowV2.ts:265-270`)
```typescript
const { discovery } = await discoveryApi.create({
  homepageUrl: sitemapUrl,
  mode: 'AUTO',
  maxPages: 100,  // Also exceeds limit (max 10)
  maxDepth: 0,    // FAILS: .positive() requires > 0
});
```

### API Schema (`discovery.schema.ts:167-174`)
```typescript
maxDepth: z.coerce
  .number()
  .int('Max depth must be an integer')
  .positive('Max depth must be positive')  // <-- Requires > 0
  .max(1, 'Max depth cannot exceed 1 in MVP')
  .default(1),
```

**The Zod `.positive()` validator requires the number to be strictly greater than 0.** The value `0` fails this validation.

### Secondary Issue
`maxPages: 100` also exceeds the MVP limit of 10, which would cause another validation error.

## Fix Plan

### Option A: Fix Frontend (Recommended)
Change the frontend to send valid values within MVP constraints:
- `maxDepth: 1` (minimum allowed value)
- `maxPages: 10` (maximum allowed in MVP)

**Rationale**: The API schema constraints are intentional for MVP. The frontend should respect these limits.

### Option B: Fix API Schema
Change `.positive()` to `.nonnegative()` to allow 0.

**Not recommended**: This changes the API contract and may have unintended side effects.

## Implementation

**File**: `apps/web/src/hooks/useDiscoveryFlowV2.ts`
**Line**: 265-270

**Change**:
```typescript
// Before
const { discovery } = await discoveryApi.create({
  homepageUrl: sitemapUrl,
  mode: 'AUTO',
  maxPages: 100,
  maxDepth: 0,
});

// After
const { discovery } = await discoveryApi.create({
  homepageUrl: sitemapUrl,
  mode: 'AUTO',
  maxPages: 10,   // MVP limit
  maxDepth: 1,    // Minimum valid value
});
```

## Testing
1. Navigate to `/discovery`
2. Select "Sitemap" input method
3. Enter valid sitemap URL
4. Click "Load Sitemap"
5. Verify no error occurs and flow proceeds to Step 2

## Risk Assessment
- **Low risk**: Simple value change
- **No breaking changes**: Values now comply with existing API schema
- **No side effects**: Only affects sitemap loading flow
