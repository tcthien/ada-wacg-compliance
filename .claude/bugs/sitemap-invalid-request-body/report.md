# Bug Report: Sitemap API Returns "Invalid Request Body"

## Summary
When loading a sitemap URL in the discovery-flow-v2 feature, the API returns "Invalid request body" error.

## Steps to Reproduce
1. Navigate to `/discovery`
2. Select "Sitemap" input method
3. Enter a valid sitemap URL (e.g., `https://www.sitemaps.org/sitemap.xml`)
4. Click "Load Sitemap" button

## Expected Behavior
The sitemap should be fetched and parsed, then navigate to Step 2 (Select URLs).

## Actual Behavior
Error message displayed: "Invalid request body"

Error trace:
```
Error: Invalid request body
  at discoveryApiClient (discovery-api.ts:34)
  at async fetchSitemap (useDiscoveryFlowV2.ts:226)
  at async Step1InputUrls.tsx:89
```

## Environment
- Feature: discovery-flow-v2
- Browser: Chromium (via Playwright MCP)
- API: localhost:3080

## Priority
High - Blocks sitemap-based URL discovery flow

## Related Files
- `apps/web/src/lib/discovery-api.ts`
- `apps/web/src/hooks/useDiscoveryFlowV2.ts`
- `apps/api/src/modules/discovery/discovery.schema.ts`
- `apps/api/src/modules/discovery/discovery.controller.ts`
