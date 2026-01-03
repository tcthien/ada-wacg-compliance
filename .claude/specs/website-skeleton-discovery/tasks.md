# Implementation Plan: Website Skeleton Discovery

## Task Overview

This implementation plan breaks down the website-skeleton-discovery feature into atomic, agent-executable tasks. The feature enables users to discover website structure (sitemap, navigation) before running accessibility scans.

**Implementation Order:**
1. Database schema & migrations
2. Backend repository layer
3. Backend service layer
4. Backend worker (BullMQ)
5. Backend controller/API
6. Frontend API client
7. Frontend hooks
8. Frontend components
9. Integration & E2E tests

## Steering Document Compliance

- **structure.md**: All files follow existing module patterns (`apps/api/src/modules/discovery/`)
- **tech.md**: Uses Fastify, Prisma, BullMQ, Zod, React patterns from existing codebase

## Atomic Task Requirements

**Each task meets these criteria:**
- **File Scope**: Touches 1-3 related files maximum
- **Time Boxing**: Completable in 15-30 minutes
- **Single Purpose**: One testable outcome per task
- **Specific Files**: Exact file paths specified
- **Agent-Friendly**: Clear input/output

---

## Phase 1: Database Schema

- [ ] 1.1. Create Prisma enum types for discovery feature
  - File: `apps/api/prisma/schema.prisma`
  - Add `DiscoveryStatus` enum: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  - Add `DiscoveryMode` enum: AUTO, MANUAL
  - Add `DiscoveryPhase` enum: SITEMAP, NAVIGATION, CRAWLING
  - Add `PageSource` enum: SITEMAP, NAVIGATION, CRAWLED, MANUAL
  - Purpose: Define enum types before model creation
  - _Leverage: Existing enum patterns in schema.prisma_
  - _Requirements: 1, 2, 3, 4_

- [x] 1.2. Create Discovery model in Prisma schema
  - File: `apps/api/prisma/schema.prisma`
  - Add `Discovery` model with fields: id, sessionId, homepageUrl, mode, status, phase, maxPages, maxDepth, partialResults, timestamps, error fields
  - Add indexes on sessionId+createdAt and status
  - Purpose: Main discovery entity for tracking discovery jobs
  - _Leverage: Existing model patterns (Scan model)_
  - _Requirements: 1, 8, 11_

- [x] 1.3. Create DiscoveredPage model in Prisma schema
  - File: `apps/api/prisma/schema.prisma`
  - Add `DiscoveredPage` model with fields: id, discoveryId, url, title, source, depth, httpStatus, contentType, createdAt
  - Add relation to Discovery with cascade delete
  - Add unique constraint on [discoveryId, url]
  - Purpose: Store discovered page URLs with metadata
  - _Leverage: Existing relation patterns_
  - _Requirements: 2, 3, 4, 6_

- [x] 1.4. Create DiscoveryUsage model in Prisma schema
  - File: `apps/api/prisma/schema.prisma`
  - Add `DiscoveryUsage` model with fields: id, sessionId, guestSessionId, customerId, month, discoveryCount, pagesDiscovered, timestamps
  - Add unique constraints on [customerId, month] and [guestSessionId, month]
  - Purpose: Track monthly usage for limit enforcement
  - _Leverage: Existing usage tracking patterns_
  - _Requirements: 11_

- [x] 1.5. Generate and run Prisma migration
  - Files: `apps/api/prisma/migrations/[timestamp]_add_discovery/migration.sql`
  - Run `npx prisma migrate dev --name add_discovery`
  - Verify migration applies cleanly
  - Purpose: Apply schema changes to database
  - _Leverage: Existing migration workflow_
  - _Requirements: All_

---

## Phase 2: Backend Types & Schemas

- [ ] 2.1. Create discovery TypeScript types
  - File: `apps/api/src/modules/discovery/discovery.types.ts`
  - Define types: DiscoveryStatus, DiscoveryMode, DiscoveryPhase, PageSource
  - Define interfaces: Discovery, DiscoveredPage, DiscoveryWithPages
  - Define interfaces: CreateDiscoveryInput, AddUrlResult, UsageLimitResult
  - Export type guards: isDiscoveryStatus, isDiscoveryMode
  - Purpose: Type safety for discovery module
  - _Leverage: `modules/scans/scan.types.ts` patterns_
  - _Requirements: 1, 2, 3, 4_

- [x] 2.2. Create discovery Zod validation schemas
  - File: `apps/api/src/modules/discovery/discovery.schema.ts`
  - Create `safeUrlSchema` with SSRF protection (block private IPs)
  - Create `createDiscoverySchema` for POST /discoveries
  - Create `addManualUrlSchema` for single URL addition
  - Create `addMultipleUrlsSchema` for batch URL addition
  - Create `discoveryIdParamSchema` and `pageIdParamSchema`
  - Purpose: Runtime validation for API requests
  - _Leverage: `modules/scans/scan.schema.ts` patterns_
  - _Requirements: 1, 4_

- [x] 2.3. Create discovery error classes
  - File: `apps/api/src/modules/discovery/discovery.errors.ts`
  - Create `DiscoveryRepositoryError` with error codes
  - Create `DiscoveryServiceError` with error codes
  - Create `DiscoveryWorkerError` with error codes
  - Define error codes: INVALID_URL, DOMAIN_MISMATCH, USAGE_LIMIT_EXCEEDED, etc.
  - Purpose: Structured error handling across layers
  - _Leverage: Existing error class patterns_
  - _Requirements: 8, 11_

---

## Phase 3: Backend Repository Layer

- [x] 3.1. Create discovery repository - basic CRUD operations
  - File: `apps/api/src/modules/discovery/discovery.repository.ts`
  - Implement `create(data)`: Create new discovery record
  - Implement `findById(id)`: Find discovery by ID
  - Implement `findByIdWithPages(id)`: Find discovery with pages relation
  - Implement `updateStatus(id, status, error?)`: Update discovery status
  - Purpose: Data access layer for Discovery entity
  - _Leverage: `modules/scans/scan.repository.ts` patterns_
  - _Requirements: 1, 8_

- [x] 3.2. Create discovery repository - page operations
  - File: `apps/api/src/modules/discovery/discovery.repository.ts`
  - Implement `addPages(discoveryId, pages[])`: Batch insert pages
  - Implement `addPage(discoveryId, page)`: Single page insert
  - Implement `removePage(discoveryId, pageId)`: Delete single page
  - Implement `findPageByUrl(discoveryId, url)`: Check for duplicates
  - Purpose: Page CRUD operations for discovery
  - _Leverage: Existing repository patterns_
  - _Requirements: 4, 6_

- [x] 3.3. Create discovery repository - usage tracking
  - File: `apps/api/src/modules/discovery/discovery.repository.ts`
  - Implement `getMonthlyUsage(identifier, month)`: Get usage record by customerId or guestSessionId
  - Implement `getOrCreateUsage(identifier, month)`: Upsert usage record (atomic upsert)
  - Implement `incrementUsage(identifier, month)`: Increment discoveryCount atomically
  - Implement `getMonthKey(date)`: Return first day of month as Date (e.g., 2025-01-01)
  - Handle month boundary: auto-reset counter when month changes
  - Support both customerId (registered) and guestSessionId (guest) lookups
  - Purpose: Usage tracking for limit enforcement
  - _Leverage: Prisma upsert, Date utility patterns_
  - _Requirements: 11.AC1-4 (Usage tracking, month reset)_

- [ ] 3.4. Create discovery repository unit tests
  - File: `apps/api/src/modules/discovery/discovery.repository.test.ts`
  - Test CRUD operations with mocked Prisma client
  - Test usage tracking with month boundaries
  - Test cascade delete behavior
  - Purpose: Ensure repository reliability
  - _Leverage: Existing test patterns_
  - _Requirements: 1, 4, 11_

---

## Phase 4: Backend Service Layer

- [ ] 4.1. Create discovery service - core operations
  - File: `apps/api/src/modules/discovery/discovery.service.ts`
  - Implement `createDiscovery(sessionId, input)`: Create discovery and queue job
  - Implement `getDiscovery(discoveryId)`: Get discovery with caching
  - Implement `cancelDiscovery(discoveryId)`: Cancel running discovery
  - Import and use repository, queue service, Redis client
  - Purpose: Business logic for discovery operations
  - _Leverage: `modules/scans/scan.service.ts` patterns_
  - _Requirements: 1, 8_

- [ ] 4.2. Create discovery service - manual URL operations
  - File: `apps/api/src/modules/discovery/discovery.service.ts`
  - Implement `addManualUrl(discoveryId, url)`: Add single URL with validation
  - Implement `addManualUrls(discoveryId, urls[])`: Batch add with partial success
  - Implement `removeManualUrl(discoveryId, pageId)`: Remove URL
  - Implement `isSameDomain(homepageUrl, targetUrl)`: Domain validation
  - Invalidate cache on URL changes
  - Purpose: Manual URL management
  - _Leverage: URL parsing utilities_
  - _Requirements: 4_

- [ ] 4.3. Create discovery service - usage limit checking
  - File: `apps/api/src/modules/discovery/discovery.service.ts`
  - Implement `checkUsageLimit(sessionId)`: Check monthly limit
  - Implement `incrementUsage(sessionId)`: Increment after successful discovery
  - Define MVP_LIMITS constant: { discoveriesPerMonth: 3, maxPages: 10, maxDepth: 1 }
  - Purpose: Enforce free tier limits
  - _Leverage: Existing limit patterns_
  - _Requirements: 11_

- [x] 4.4. Create discovery service - basic caching operations
  - File: `apps/api/src/modules/discovery/discovery.service.ts`
  - Implement `getCachedDiscovery(discoveryId)`: Check Redis cache
  - Implement `cacheDiscoveryResult(discovery)`: Store in Redis with 24h TTL
  - Implement `invalidateCache(discoveryId)`: Remove from cache
  - Define cache key pattern: `discovery:{id}:result`
  - Include cachedAt timestamp in cached data
  - Purpose: Redis caching for performance
  - _Leverage: Existing Redis patterns_
  - _Requirements: 9.AC1-3 (Basic caching)_

- [x] 4.5. Create discovery service - cache integrity and expiration
  - File: `apps/api/src/modules/discovery/discovery.service.ts`
  - Implement `verifyCacheIntegrity(cached, discoveryId)`: Validate cached data structure
  - Implement `getCacheMetadata(discoveryId)`: Return cachedAt, expiresAt, pageCount
  - Implement `shouldRefreshCache(cachedAt)`: Check if approaching expiration (>20h)
  - Handle corrupted cache gracefully (delete and return null)
  - Purpose: Cache reliability and expiration handling
  - _Leverage: Existing Redis patterns, JSON validation_
  - _Requirements: 9.AC6-7 (Cache expiration and integrity)_

- [ ] 4.6. Create discovery service unit tests
  - File: `apps/api/src/modules/discovery/discovery.service.test.ts`
  - Test createDiscovery with usage limit scenarios
  - Test manual URL validation (same domain, duplicates)
  - Test caching hit/miss/expiration scenarios
  - Test cache integrity verification (valid, corrupted, expired)
  - Mock repository, Redis, and queue service
  - Purpose: Ensure service logic correctness
  - _Leverage: Existing test patterns, vitest_
  - _Requirements: 1.AC1-5, 4.AC1-6, 9.AC1-7, 11.AC1-4_

---

## Phase 5: Backend Worker (BullMQ)

- [ ] 5.1. Create discovery worker - BullMQ registration and job setup
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Define DISCOVERY_JOB_OPTIONS: attempts=3, backoff exponential, timeout=30000ms
  - Configure removeOnComplete=100 and removeOnFail=500 for cleanup
  - Define TIMEOUT_HIERARCHY: sitemap=10000ms, navigation=5000ms, page=3000ms
  - Register worker with BullMQ queue
  - Implement `processDiscoveryJob(job)`: Main job handler that orchestrates phases
  - Purpose: Worker registration and job configuration
  - _Leverage: Existing worker patterns in codebase, BullMQ docs_
  - _Requirements: 8.AC1-3 (Discovery lifecycle management)_

- [x] 5.2. Create discovery worker - sitemap URL discovery
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `findSitemapUrls(baseUrl)`: Check standard locations (/sitemap.xml, /sitemap_index.xml)
  - Get sitemap URLs from robots.txt if present
  - Return array of potential sitemap URLs to try
  - Purpose: Discover sitemap locations
  - _Leverage: URL parsing utilities_
  - _Requirements: 2.AC1-2 (Sitemap detection)_

- [x] 5.3. Create discovery worker - sitemap fetching with timeout
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `fetchSitemap(url)`: Fetch with 10s timeout, 5MB size limit
  - Handle redirect chains (max 5 redirects)
  - Validate SSRF on each redirect (check domain stays same or allowed)
  - Return null on timeout/error (graceful failure)
  - Purpose: Fetch sitemap with security protections
  - _Leverage: Existing fetch patterns, AbortController_
  - _Requirements: 2.AC3-4, Security (SSRF protection on redirects)_

- [x] 5.4. Create discovery worker - sitemap XML parsing
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `parseSitemap(xml)`: Parse with fast-xml-parser
  - Handle sitemap index (nested sitemaps) recursively
  - Extract loc, lastmod, changefreq, priority from entries
  - Filter to internal URLs only (same domain)
  - Purpose: Parse sitemap XML to page list
  - _Leverage: fast-xml-parser library_
  - _Requirements: 2.AC5-7 (Sitemap parsing, internal URLs only)_

- [x] 5.5. Create discovery worker - homepage fetching
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `fetchHomepage(url)`: Fetch with 5s timeout
  - Handle redirects with same-domain SSRF validation
  - Return HTML content or null on error
  - Purpose: Fetch homepage for navigation extraction
  - _Leverage: Existing fetch patterns_
  - _Requirements: 3.AC1-2 (Homepage fetch)_

- [x] 5.6. Create discovery worker - navigation extraction with selector priority
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `extractNavigation(html)`: Parse with cheerio
  - Define selector priority: nav, [role=navigation], header nav, .nav, .menu, .navigation
  - Extract href and text from anchor elements
  - Filter internal links only, deduplicate by normalized URL
  - Purpose: Extract navigation links from homepage
  - _Leverage: cheerio library_
  - _Requirements: 3.AC3-7 (Navigation extraction, selector priority)_

- [x] 5.7. Create discovery worker - robots.txt parsing
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `fetchRobotsTxt(url)`: Fetch robots.txt with 3s timeout
  - Implement `parseRobotsTxt(content)`: Extract User-agent, Disallow, Sitemap directives
  - Return { disallowedPaths[], crawlDelay, sitemapUrls[] }
  - Purpose: Parse robots.txt for crawling rules
  - _Leverage: robots-parser library or custom implementation_
  - _Requirements: 2.AC2 (Sitemap from robots.txt), Security (respect robots.txt)_

- [x] 5.8. Create discovery worker - rate limiting and path checking
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement rate limiter using p-limit (10 concurrent, 100ms delay between requests)
  - Implement `isPathAllowed(path, robotsRules)`: Check if crawling allowed for path
  - Purpose: Respect robots.txt rules and rate limits
  - _Leverage: p-limit library_
  - _Requirements: Security (Respect robots.txt, rate limiting)_

- [x] 5.9. Create discovery worker - URL validation and SSRF protection
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `isPrivateIP(hostname)`: Block 10.x, 172.16-31.x, 192.168.x, localhost, 127.x
  - Implement `validateUrl(url, homepageUrl)`: Check same domain, not private IP
  - Implement `normalizeUrl(url)`: Lowercase hostname, remove trailing slash, handle www
  - Purpose: Security - prevent SSRF attacks
  - _Leverage: node:net isIP, URL class_
  - _Requirements: Security.AC1-4 (SSRF prevention)_

- [x] 5.10. Create discovery worker - deduplication and sanitization
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `deduplicateUrls(urls[])`: Remove duplicates by normalized URL
  - Implement `sanitizeTitle(title)`: XSS prevention with DOMPurify
  - Implement `isSameDomain(url1, url2)`: With www-prefix normalization
  - Purpose: Data quality and XSS prevention
  - _Leverage: isomorphic-dompurify library_
  - _Requirements: 6.AC6 (Deduplication), Security (XSS prevention)_

- [x] 5.11. Create discovery worker - job completion and result saving
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `completeDiscovery(discoveryId, pages[])`: Save pages, update status to COMPLETED
  - Implement `cacheDiscoveryResult(discovery)`: Store in Redis with 24h TTL
  - Increment usage counter on success
  - Purpose: Save discovery results
  - _Leverage: Repository patterns, Redis client_
  - _Requirements: 8.AC4-5 (Completion handling), 9.AC1-3 (Caching)_

- [x] 5.12. Create discovery worker - error handling and partial results
  - File: `apps/api/src/modules/discovery/discovery.worker.ts`
  - Implement `failDiscovery(discoveryId, error)`: Set status FAILED, store error message
  - Implement `handlePartialResults(discoveryId, pages[], error)`: Save partial results on timeout
  - Set partialResults=true flag for interrupted discoveries
  - Implement retry logic with exponential backoff (1s, 2s, 4s)
  - Purpose: Graceful error handling
  - _Leverage: Existing error handling patterns_
  - _Requirements: 8.AC6-8 (Error handling, partial results)_

- [ ] 5.13. Create discovery worker unit tests
  - File: `apps/api/src/modules/discovery/discovery.worker.test.ts`
  - Test sitemap parsing (valid, malformed, empty, sitemap index)
  - Test navigation extraction (various HTML structures, selector priority)
  - Test SSRF protection (private IPs, redirect chains)
  - Test robots.txt parsing (disallow rules, sitemap extraction)
  - Test rate limiting behavior
  - Purpose: Ensure worker reliability
  - _Leverage: Existing test patterns, vitest_
  - _Requirements: 2.AC1-7, 3.AC1-7, Security_

---

## Phase 6: Backend Controller/API

- [x] 6.1. Create discovery controller - POST /discoveries endpoint
  - File: `apps/api/src/modules/discovery/discovery.controller.ts`
  - Implement `createDiscoveryHandler`: Validate input, check usage, call service
  - Return 201 with discovery data or 429 for limit exceeded
  - Add session middleware, rate limit middleware (10/min)
  - Purpose: Create discovery API endpoint
  - _Leverage: `modules/scans/scan.controller.ts` patterns_
  - _Requirements: 1, 8, 11_

- [x] 6.2. Create discovery controller - GET /discoveries/:id endpoint
  - File: `apps/api/src/modules/discovery/discovery.controller.ts`
  - Implement `getDiscoveryHandler`: Validate params, handle refresh query param
  - Return discovery with pages, include cache metadata in response
  - Add rate limit headers to response
  - Purpose: Get discovery status and results
  - _Leverage: Existing controller patterns_
  - _Requirements: 6, 9_

- [ ] 6.3. Create discovery controller - DELETE /discoveries/:id endpoint
  - File: `apps/api/src/modules/discovery/discovery.controller.ts`
  - Implement `cancelDiscoveryHandler`: Validate params, call service
  - Return 200 with updated discovery status
  - Purpose: Cancel running discovery
  - _Leverage: Existing controller patterns_
  - _Requirements: 8_

- [x] 6.4. Create discovery controller - manual URL endpoints
  - File: `apps/api/src/modules/discovery/discovery.controller.ts`
  - Implement `addManualUrlHandler` for POST /discoveries/:id/pages
  - Implement `addManualUrlsBatchHandler` for POST /discoveries/:id/pages/batch
  - Implement `removeManualUrlHandler` for DELETE /discoveries/:id/pages/:pageId
  - Purpose: Manual URL management endpoints
  - _Leverage: Existing controller patterns_
  - _Requirements: 4_

- [ ] 6.5. Create discovery route registration
  - File: `apps/api/src/modules/discovery/index.ts`
  - Export `registerDiscoveryRoutes(fastify)` function
  - Register all discovery endpoints with appropriate middleware
  - Add to main app route registration
  - Purpose: Wire up discovery routes to Fastify
  - _Leverage: Existing route registration patterns_
  - _Requirements: All_

- [x] 6.6. Create discovery controller integration tests
  - File: `apps/api/src/modules/discovery/discovery.controller.test.ts`
  - Test POST /discoveries with valid/invalid input
  - Test GET /discoveries/:id with cache scenarios
  - Test manual URL endpoints with domain validation
  - Test rate limiting behavior
  - Purpose: API contract verification
  - _Leverage: Existing integration test patterns_
  - _Requirements: 1, 4, 9_

---

## Phase 7: Frontend API Client

- [ ] 7.1. Create discovery API client types
  - File: `apps/web/src/lib/discovery-api.types.ts`
  - Define types matching backend: Discovery, DiscoveredPage, DiscoveryWithPages
  - Define request types: CreateDiscoveryInput, AddUrlInput
  - Define response types: DiscoveryResponse, AddUrlResponse
  - Purpose: Type safety for API calls
  - _Leverage: `lib/api.ts` type patterns_
  - _Requirements: 1, 4, 6_

- [ ] 7.2. Create discovery API client functions
  - File: `apps/web/src/lib/discovery-api.ts`
  - Implement `createDiscovery(input)`: POST /discoveries
  - Implement `getDiscovery(id, refresh?)`: GET /discoveries/:id
  - Implement `cancelDiscovery(id)`: DELETE /discoveries/:id
  - Implement `addManualUrl(id, url)`: POST /discoveries/:id/pages
  - Implement `addManualUrls(id, urls)`: POST /discoveries/:id/pages/batch
  - Implement `removeManualUrl(id, pageId)`: DELETE /discoveries/:id/pages/:pageId
  - Purpose: Centralized API client for discovery
  - _Leverage: `lib/api.ts` patterns, fetch with credentials_
  - _Requirements: 1, 4, 9_

---

## Phase 8: Frontend Hooks

- [ ] 8.1. Create useDiscovery hook - core state management
  - File: `apps/web/src/hooks/useDiscovery.ts`
  - Manage state: discovery, isLoading, error
  - Implement `createDiscovery(input)`: Create and set discoveryId
  - Implement `refetch()`: Manual refresh
  - Return discovery data and loading states
  - Purpose: Discovery state management
  - _Leverage: `hooks/useScan.ts` patterns_
  - _Requirements: 1, 8_

- [ ] 8.2. Create useDiscovery hook - polling logic
  - File: `apps/web/src/hooks/useDiscovery.ts`
  - Add polling with configurable interval (default 2000ms)
  - Stop polling on terminal states (COMPLETED, FAILED, CANCELLED)
  - Handle cleanup on unmount
  - Purpose: Real-time discovery status updates
  - _Leverage: `hooks/useScanEvents.ts` polling patterns_
  - _Requirements: 8_

- [ ] 8.3. Create useDiscovery hook - manual URL operations
  - File: `apps/web/src/hooks/useDiscovery.ts`
  - Implement `addManualUrl(url)`: Add single URL, refetch
  - Implement `addManualUrls(urls)`: Batch add, return results
  - Implement `removeManualUrl(pageId)`: Remove URL, refetch
  - Implement `cancelDiscovery()`: Cancel and update state
  - Purpose: Manual URL management in hook
  - _Leverage: Existing hook patterns_
  - _Requirements: 4_

- [ ] 8.4. Create useDiscovery hook - session persistence
  - File: `apps/web/src/hooks/useDiscovery.ts`
  - Implement `persistSelection(selectedIds)`: Save to sessionStorage
  - Implement `loadPersistedSelection()`: Restore from sessionStorage on mount
  - Persist selection keyed by discoveryId: `discovery:${id}:selection`
  - Clear persisted selection when discovery changes or scan starts
  - Purpose: Preserve selection across page refreshes
  - _Leverage: sessionStorage API, React useEffect_
  - _Requirements: 7.AC11-12 (Session persistence of selection)_

- [ ] 8.5. Create useDiscovery hook unit tests
  - File: `apps/web/src/hooks/useDiscovery.test.ts`
  - Test initial load and polling behavior
  - Test manual URL operations
  - Test session persistence (mock sessionStorage)
  - Test error handling
  - Mock API client
  - Purpose: Ensure hook reliability
  - _Leverage: Existing hook test patterns, vitest_
  - _Requirements: 1.AC1-5, 4.AC1-6, 7.AC11-12, 8.AC1-8_

---

## Phase 9: Frontend Components - Core

- [ ] 9.1. Create DiscoveryModeSelector component
  - File: `apps/web/src/components/features/discovery/DiscoveryModeSelector.tsx`
  - Render two options: "Auto Discover" and "Manual Entry"
  - Handle mode selection with onChange callback
  - Add ARIA radio group attributes for accessibility
  - Style with existing button/toggle patterns
  - Purpose: Mode selection UI
  - _Leverage: Existing UI component patterns_
  - _Requirements: 1, 12_

- [ ] 9.2. Create DiscoveryProgress component
  - File: `apps/web/src/components/features/discovery/DiscoveryProgress.tsx`
  - Display current phase: "Checking sitemap...", "Analyzing navigation..."
  - Show pages found counter
  - Add Cancel button with onCancel callback
  - Add ARIA live region for screen reader announcements
  - Purpose: Discovery progress display
  - _Leverage: Existing progress component patterns_
  - _Requirements: 8, 12_

- [ ] 9.3. Create CachedResultsPrompt component
  - File: `apps/web/src/components/features/discovery/CachedResultsPrompt.tsx`
  - Display "Use cached results from [date]?" message
  - Render "Use Cached" and "Refresh" buttons
  - Handle button clicks with callbacks
  - Show loading state on Refresh button
  - Purpose: Cache usage prompt
  - _Leverage: Existing dialog/prompt patterns_
  - _Requirements: 9, 12_

- [ ] 9.4. Create ManualUrlEntry component
  - File: `apps/web/src/components/features/discovery/ManualUrlEntry.tsx`
  - Render URL input field with validation
  - Show "Add URL" button
  - Support paste multiple URLs (textarea mode)
  - Display error messages for invalid URLs
  - Add ARIA labels and error announcements
  - Purpose: Manual URL input UI
  - _Leverage: Existing form component patterns_
  - _Requirements: 4, 12_

---

## Phase 10: Frontend Components - PageTree

- [ ] 10.1. Create PageTreeNode component
  - File: `apps/web/src/components/features/discovery/PageTreeNode.tsx`
  - Render single tree node with checkbox, expand/collapse arrow, label
  - Display source badges (sitemap, nav, crawled, manual) with distinct colors
  - Handle checkbox change, expand/collapse click callbacks
  - Add ARIA treeitem attributes: aria-expanded, aria-selected, aria-level
  - Add tabIndex management for roving tabindex pattern
  - Purpose: Individual tree node rendering
  - _Leverage: Existing list item patterns_
  - _Requirements: 6.AC1-5 (Page display), 7.AC1-3 (Checkboxes), 12.AC1-3 (ARIA)_

- [ ] 10.2. Create PageTree component - tree structure building
  - File: `apps/web/src/components/features/discovery/PageTree.tsx`
  - Implement `buildTreeFromPages(pages[])`: Convert flat list to tree by URL path segments
  - Handle edge cases: root pages, deep nesting, orphan paths
  - Memoize tree building with useMemo for performance
  - Purpose: Transform flat page list to hierarchical structure
  - _Leverage: URL parsing, recursive tree building algorithms_
  - _Requirements: 6.AC1-2 (Hierarchical display)_

- [ ] 10.3. Create PageTree component - rendering and expand/collapse
  - File: `apps/web/src/components/features/discovery/PageTree.tsx`
  - Render PageTreeNode for each tree item recursively
  - Manage expand/collapse state per node in useState/useReducer
  - Add ARIA tree role with aria-label="Discovered pages"
  - Add aria-multiselectable="true" attribute
  - Purpose: Hierarchical page tree display
  - _Leverage: Existing tree/list patterns_
  - _Requirements: 6.AC1-3 (Tree display), 12.AC1-3 (ARIA tree)_

- [ ] 10.4. Create PageTree component - selection logic
  - File: `apps/web/src/components/features/discovery/PageTree.tsx`
  - Track selected page IDs in Set for O(1) lookup
  - Implement `toggleSelection(pageId)`: Toggle individual page
  - Implement `selectChildren(nodeId)`: Select all descendants
  - Implement `deselectChildren(nodeId)`: Deselect all descendants
  - Calculate indeterminate state for partial selection of children
  - Lift selection state to parent via onChange callback
  - Purpose: Page selection functionality
  - _Leverage: Existing selection patterns_
  - _Requirements: 7.AC1-6 (Selection behavior)_

- [ ] 10.5. Create PageTree component - keyboard navigation
  - File: `apps/web/src/components/features/discovery/PageTree.tsx`
  - Implement onKeyDown handler with ARIA tree keyboard patterns
  - ArrowDown/ArrowUp: Move to next/previous visible item
  - ArrowRight: Expand node if collapsed, else move to first child
  - ArrowLeft: Collapse node if expanded, else move to parent
  - Enter/Space: Toggle selection on focused item
  - Home/End: Move to first/last visible item
  - Manage focus with useRef and roving tabindex
  - Purpose: Full keyboard accessibility per ARIA APG tree pattern
  - _Leverage: W3C ARIA Authoring Practices Guide (APG) tree pattern_
  - _Requirements: 12.AC4-7 (Keyboard navigation)_

- [ ] 10.6. Create PageTree component - virtual scrolling
  - File: `apps/web/src/components/features/discovery/PageTree.tsx`
  - Integrate react-window VariableSizeList for virtualization
  - Flatten visible tree nodes for virtualization (only expanded nodes visible)
  - Calculate item heights: base height (40px) + indent per level
  - Pass nodeData (page, depth, expanded, selected) to PageTreeNode
  - Handle dynamic list sizing on expand/collapse
  - Purpose: Performance for large trees (100+ pages)
  - _Leverage: react-window library, VariableSizeList component_
  - _Requirements: 6.AC7 (Performance for large page counts)_

- [ ] 10.7. Create PageTree component - live announcements
  - File: `apps/web/src/components/features/discovery/PageTree.tsx`
  - Add visually hidden div with aria-live="polite" and aria-atomic="true"
  - Announce expand/collapse: "[Page] expanded" / "[Page] collapsed"
  - Announce selection: "[Page] selected" / "[Page] deselected"
  - Implement throttling: max 1 announcement per 5 seconds for bulk operations
  - Use useRef + setTimeout for throttle implementation
  - Purpose: Screen reader accessibility for dynamic changes
  - _Leverage: ARIA live region patterns_
  - _Requirements: 12.AC8-10 (Screen reader announcements)_

---

## Phase 11: Frontend Components - Results Container

- [ ] 11.1. Create DiscoveryResults component - layout
  - File: `apps/web/src/components/features/discovery/DiscoveryResults.tsx`
  - Layout: CachedResultsPrompt (if cached) + PageTree + action buttons
  - Display selection summary: "X pages selected"
  - Display estimated scan time
  - Purpose: Main results container
  - _Leverage: Existing layout patterns_
  - _Requirements: 6, 7, 9_

- [ ] 11.2. Create DiscoveryResults component - actions
  - File: `apps/web/src/components/features/discovery/DiscoveryResults.tsx`
  - Add "Select All" and "Deselect All" buttons
  - Add "Start Scan" button (disabled when no selection)
  - Show warning for large scans (>30 min estimated)
  - Handle onStartScan callback with selected page IDs
  - Purpose: Result actions UI
  - _Leverage: Existing button patterns_
  - _Requirements: 7, 10_

- [ ] 11.3. Create estimated scan time utility
  - File: `apps/web/src/components/features/discovery/utils.ts`
  - Implement `estimateScanTime(pageCount)`: Calculate estimated time
  - Format as "About X minutes" or "Less than 1 minute"
  - Constants: AVG_SCAN_TIME_PER_PAGE = 15s, PARALLEL_FACTOR = 3
  - Purpose: Scan time estimation display
  - _Leverage: Existing utility patterns_
  - _Requirements: 7_

---

## Phase 12: Frontend Component Index & Integration

- [x] 12.1. Create discovery components index
  - File: `apps/web/src/components/features/discovery/index.ts`
  - Export all discovery components: DiscoveryModeSelector, DiscoveryProgress, CachedResultsPrompt, ManualUrlEntry, PageTree, PageTreeNode, DiscoveryResults
  - Purpose: Clean imports for discovery components
  - _Leverage: Existing index patterns_
  - _Requirements: 1.AC1, 6.AC1, 7.AC1_

- [x] 12.2. Create discovery page layout and URL input section
  - File: `apps/web/src/app/discovery/page.tsx`
  - Create page structure: Header, URL input form, content area
  - Add URL input with validation (required, valid URL format)
  - Add "Start Discovery" button
  - Wire initial state management
  - Purpose: Discovery page entry point
  - _Leverage: Existing page layout patterns_
  - _Requirements: 1.AC1-3 (URL input), 8.AC1 (Start discovery)_

- [x] 12.3. Create discovery page flow orchestration
  - File: `apps/web/src/app/discovery/page.tsx`
  - Wire up useDiscovery hook to page
  - Handle flow states: input → mode selection → progress → results
  - Compose DiscoveryModeSelector, DiscoveryProgress, DiscoveryResults components
  - Handle CachedResultsPrompt display when cache exists
  - Purpose: Orchestrate discovery flow
  - _Leverage: Existing page patterns, React state management_
  - _Requirements: 1.AC4-5 (Mode selection), 8.AC2-5 (Progress), 9.AC1-5 (Caching)_

- [x] 12.4. Integrate discovery with scan creation page
  - File: `apps/web/src/app/page.tsx` (home page is scan creation)
  - Add "Discover Pages First" button/option at top of scan creation form
  - When clicked, redirect to discovery page with return URL parameter
  - Purpose: Entry point to discovery from scan creation
  - _Leverage: Existing scan creation page, Next.js router_
  - _Requirements: 10.AC5-6 (Discovery option in scan creation)_

- [x] 12.5. Create "Use Discovered Pages" option in scan creation
  - File: `apps/web/src/app/scans/new/page.tsx` (modify existing)
  - Check for completed discovery in session/URL params
  - Display "Use Discovered Pages" button when discovery exists
  - Show summary: "X pages discovered from [domain]"
  - Pre-fill scan URL list from selected discovered pages
  - Purpose: Use discovery results for scan
  - _Leverage: Existing scan form patterns, sessionStorage_
  - _Requirements: 10.AC1-4 (Use discovered pages for scan)_

- [x] 12.6. Handle scan creation with discovery error recovery
  - File: `apps/web/src/app/scans/new/page.tsx` (modify existing)
  - If scan creation fails, preserve page selection in sessionStorage
  - Display "Retry with selection" option
  - Allow user to modify selection before retry
  - Purpose: Graceful error handling for scan creation
  - _Leverage: Existing error handling patterns_
  - _Requirements: 10.AC4 (Selection preservation on error)_

---

## Phase 13: Mobile Responsiveness

- [ ] 13.1. Create responsive PageTree layout
  - File: `apps/web/src/components/features/discovery/PageTree.tsx`
  - Add responsive container with max-width constraints
  - Implement horizontal scrolling for deep nesting on mobile
  - Adjust indentation per level: desktop 24px, mobile 16px
  - Purpose: Mobile-friendly tree layout
  - _Leverage: Tailwind CSS responsive utilities_
  - _Requirements: 13.AC1-2 (Responsive layout, horizontal scroll)_

- [ ] 13.2. Create touch-friendly PageTree interactions
  - File: `apps/web/src/components/features/discovery/PageTreeNode.tsx`
  - Increase touch target size to minimum 44x44px on mobile
  - Add spacing between interactive elements (checkbox, expand arrow, label)
  - Implement touch-friendly checkbox hit area
  - Purpose: Mobile touch accessibility
  - _Leverage: Tailwind CSS, media queries_
  - _Requirements: 13.AC3 (Touch targets ≥44px)_

- [ ] 13.3. Create swipe gestures for PageTree
  - File: `apps/web/src/components/features/discovery/PageTree.tsx`
  - Implement swipe-left to deselect page
  - Implement swipe-right to select page
  - Add visual feedback during swipe (color change, animation)
  - Use touch events or react-swipeable library
  - Purpose: Mobile gesture support
  - _Leverage: Touch events API or react-swipeable library_
  - _Requirements: 13.AC4 (Swipe gestures)_

- [ ] 13.4. Create mobile-optimized discovery progress UI
  - File: `apps/web/src/components/features/discovery/DiscoveryProgress.tsx`
  - Stack progress elements vertically on mobile
  - Make Cancel button full-width on mobile
  - Increase font sizes for mobile readability
  - Purpose: Mobile-friendly progress display
  - _Leverage: Tailwind CSS responsive utilities_
  - _Requirements: 13.AC5 (Mobile progress layout)_

- [ ] 13.5. Create mobile-optimized action buttons
  - File: `apps/web/src/components/features/discovery/DiscoveryResults.tsx`
  - Stack "Select All", "Deselect All", "Start Scan" buttons vertically on mobile
  - Make buttons full-width on mobile screens
  - Add adequate spacing between buttons for touch
  - Purpose: Mobile-friendly action buttons
  - _Leverage: Tailwind CSS responsive utilities, flexbox/grid_
  - _Requirements: 13.AC6 (Mobile button layout)_

- [ ] 13.6. Create mobile breakpoint optimizations
  - File: `apps/web/src/components/features/discovery/*.tsx` (all components)
  - Define breakpoints: mobile (<640px), tablet (640-1024px), desktop (>1024px)
  - Apply component-specific responsive adjustments
  - Test layout on common mobile viewport sizes (375px, 390px, 428px)
  - Purpose: Consistent mobile experience
  - _Leverage: Tailwind CSS breakpoints, existing responsive patterns_
  - _Requirements: 13.AC7 (Viewport optimization)_

---

## Phase 14: Testing

- [ ] 14.1. Create discovery E2E test - auto discovery flow
  - File: `apps/web/e2e/discovery-auto.spec.ts`
  - Test: Enter URL → Select Auto Discover → View progress → See results
  - Verify tree displays pages with correct source badges
  - Verify page selection and deselection works
  - Verify "Start Scan" integrates with scan creation
  - Purpose: E2E test for auto discovery flow
  - _Leverage: Existing E2E test patterns, Playwright_
  - _Requirements: 1.AC1-5, 2.AC1-7, 3.AC1-7, 6.AC1-7, 7.AC1-6_

- [ ] 14.2. Create discovery E2E test - manual entry flow
  - File: `apps/web/e2e/discovery-manual.spec.ts`
  - Test: Enter URL → Select Manual → Add URLs → View tree
  - Test domain validation (reject different domain URLs)
  - Test duplicate URL detection and error message
  - Test batch URL addition
  - Purpose: E2E test for manual entry flow
  - _Leverage: Existing E2E test patterns, Playwright_
  - _Requirements: 1.AC1-5, 4.AC1-6_

- [ ] 14.3. Create discovery E2E test - keyboard accessibility
  - File: `apps/web/e2e/discovery-a11y.spec.ts`
  - Test keyboard navigation: ArrowUp/Down, ArrowLeft/Right, Home/End
  - Test selection with Enter/Space keys
  - Test focus visible indicators
  - Verify ARIA tree attributes (role, aria-expanded, aria-selected, aria-level)
  - Use Playwright accessibility tree inspection
  - Purpose: Keyboard accessibility testing
  - _Leverage: Playwright accessibility testing, @axe-core/playwright_
  - _Requirements: 12.AC1-10 (All accessibility requirements)_

- [ ] 14.4. Create discovery E2E test - error scenarios
  - File: `apps/web/e2e/discovery-errors.spec.ts`
  - Test invalid URL handling (error message displayed)
  - Test usage limit exceeded (429 response, upgrade prompt)
  - Test network error handling (retry option)
  - Test discovery cancellation
  - Test partial results display on timeout
  - Purpose: Error scenario testing
  - _Leverage: Existing E2E test patterns, Playwright network interception_
  - _Requirements: 8.AC6-8 (Error handling), 11.AC1-4 (Usage limits)_

- [ ] 14.5. Create discovery E2E test - mobile responsiveness
  - File: `apps/web/e2e/discovery-mobile.spec.ts`
  - Test on mobile viewport (375x667, 390x844)
  - Verify touch targets are ≥44px
  - Verify horizontal scrolling for deep trees
  - Verify button stacking on mobile
  - Purpose: Mobile responsiveness testing
  - _Leverage: Playwright viewport emulation_
  - _Requirements: 13.AC1-7 (All mobile responsiveness requirements)_

- [ ] 14.6. Create discovery E2E test - caching behavior
  - File: `apps/web/e2e/discovery-cache.spec.ts`
  - Test cached results prompt appears on revisit
  - Test "Use Cached" loads results immediately
  - Test "Refresh" triggers new discovery
  - Test cache metadata display (cached timestamp)
  - Purpose: Cache behavior testing
  - _Leverage: Existing E2E test patterns, Playwright_
  - _Requirements: 9.AC1-7 (All caching requirements)_

---

## Task Summary

| Phase | Tasks | Files | Focus |
|-------|-------|-------|-------|
| 1. Database | 5 | 1-2 | Prisma schema, migrations |
| 2. Types | 3 | 3 | TypeScript types, Zod schemas |
| 3. Repository | 4 | 2 | Data access layer |
| 4. Service | 6 | 2 | Business logic, caching |
| 5. Worker | 13 | 2 | BullMQ job processing |
| 6. Controller | 6 | 2 | API endpoints |
| 7. API Client | 2 | 2 | Frontend API client |
| 8. Hooks | 5 | 2 | React hooks, session persistence |
| 9. Components Core | 4 | 4 | Basic UI components |
| 10. PageTree | 7 | 2 | Tree component, accessibility |
| 11. Results | 3 | 2 | Results container, actions |
| 12. Integration | 6 | 3 | Page integration, scan flow |
| 13. Mobile | 6 | 5 | Responsive design, touch |
| 14. Testing | 6 | 6 | E2E tests, accessibility |

**Total: 76 atomic tasks**

## Requirements Coverage

| Requirement | Tasks |
|-------------|-------|
| REQ-1 (Discovery Mode) | 1.1-1.2, 2.1-2.2, 4.1, 6.1, 7.1-7.2, 8.1, 9.1, 12.2-12.3, 14.1 |
| REQ-2 (Sitemap Parsing) | 1.1, 5.2-5.4, 5.13, 14.1 |
| REQ-3 (Navigation Extraction) | 1.1, 5.5-5.6, 5.13, 14.1 |
| REQ-4 (Manual URL Entry) | 1.1, 2.2, 3.2, 4.2, 6.4, 7.2, 8.3, 9.4, 14.2 |
| REQ-6 (Page Display) | 1.3, 3.2, 6.2, 7.1, 10.1-10.3, 11.1, 14.1 |
| REQ-7 (Page Selection) | 10.1, 10.4, 8.4, 11.1-11.2, 14.1 |
| REQ-8 (Discovery Progress) | 1.2, 2.3, 4.1, 5.1, 5.11-5.12, 6.1-6.3, 8.1-8.2, 9.2, 14.4 |
| REQ-9 (Caching) | 4.4-4.5, 5.11, 6.2, 9.3, 12.3, 14.6 |
| REQ-10 (Scan Integration) | 11.2, 12.4-12.6, 14.1 |
| REQ-11 (Usage Tracking) | 1.4, 3.3, 4.3, 6.1, 14.4 |
| REQ-12 (Accessibility) | 9.1-9.4, 10.1, 10.3, 10.5, 10.7, 14.3 |
| REQ-13 (Mobile) | 13.1-13.6, 14.5 |
