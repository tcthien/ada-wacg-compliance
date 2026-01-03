# Bug Verification: Sitemap API "Invalid Request Body"

## Status: VERIFIED FIXED

## Fix Applied
**File**: `apps/web/src/hooks/useDiscoveryFlowV2.ts` (lines 264-271)

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
  maxDepth: 1,    // Minimum valid value (API requires positive)
});
```

## Verification Steps

### Test 1: Sitemap Loading (PASSED)
1. Navigated to `/discovery`
2. Selected "Sitemap" input method
3. Entered sitemap URL: `https://www.sitemaps.org/sitemap.xml`
4. Clicked "Load Sitemap" button
5. **Result**: Successfully loaded 10 URLs and navigated to Step 2

### Before Fix
- Error: "Invalid request body" appeared immediately after clicking "Load Sitemap"

### After Fix
- Loading spinner shown while processing
- Successfully navigated to Step 2 with 10 URLs:
  - https://www.sitemaps.org/
  - https://www.sitemaps.org/protocol.html
  - https://www.sitemaps.org/faq.html
  - https://www.sitemaps.org/terms.html
  - https://www.sitemaps.org/da/
  - https://www.sitemaps.org/da/protocol.html
  - https://www.sitemaps.org/da/faq.html
  - https://www.sitemaps.org/da/terms.html
  - https://www.sitemaps.org/de/
  - https://www.sitemaps.org/de/protocol.html

## Root Cause Confirmed
The API schema requires `maxDepth` to be a **positive integer** (> 0). The frontend was sending `maxDepth: 0`, which failed Zod's `.positive()` validation.

## Verification Date
2026-01-03

## Verified By
Playwright MCP automated testing
