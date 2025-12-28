# Implementation Plan - Scan Console Logger

## Task Overview

This implementation plan breaks down the Scan Console Logger feature into atomic, agent-executable tasks. The implementation follows a bottom-up approach: database → backend services → API → frontend components → integration.

## Steering Document Compliance

- **structure.md**: All files follow kebab-case naming, PascalCase for components
- **tech.md**: Uses Fastify, Prisma, React Query, Zod, TailwindCSS, shadcn/ui

## Atomic Task Requirements

Each task meets these criteria:
- **File Scope**: 1-3 related files maximum
- **Time Boxing**: 15-30 minutes completion time
- **Single Purpose**: One testable outcome
- **Specific Files**: Exact paths provided
- **Agent-Friendly**: Clear input/output

## Task Format Guidelines

### Good Task Example
```
- [ ] 1. Create ScanEvent Prisma model
  - **File**: `apps/api/prisma/schema.prisma`
  - Add ScanEvent model with id, scanId, type, level, message fields
  - Add relation to Scan model
  - **Purpose**: Establish database schema for events
  - _Leverage: Existing Scan model pattern_
  - _Requirements: 6.1_
```

### Bad Task Example (Too Broad)
```
- [ ] 1. Implement backend event system
  - Create database model, service, controller, and tests
  - Add Redis caching and cleanup jobs
```

---

## Tasks

### Phase 1: Database & Types

- [x] 1. Create ScanEvent Prisma model and enums
  - **File**: `apps/api/prisma/schema.prisma`
  - Add `ScanEvent` model with id, scanId, type, level, message, metadata, adminOnly, createdAt
  - Add `ScanEventType` enum (INIT, QUEUE, FETCH, ANALYSIS, RESULT, ERROR, DEBUG)
  - Add `LogLevel` enum (DEBUG, INFO, SUCCESS, WARNING, ERROR)
  - Add relation to Scan model and indexes
  - **Purpose**: Establish database schema for event storage
  - _Requirements: 6.1, 6.2_

- [x] 2. Add eventSummary field to Scan model
  - **File**: `apps/api/prisma/schema.prisma`
  - Add `events ScanEvent[]` relation to Scan model
  - Add `eventSummary Json?` field for archived event summary
  - Add index on `[status, updatedAt]` for cleanup queries
  - **Purpose**: Enable event aggregation after archival
  - _Leverage: Existing Scan model in schema.prisma_
  - _Requirements: 5.4_

- [x] 3. Run Prisma migration for ScanEvent
  - **Command**: `pnpm --filter api prisma migrate dev --name add_scan_events`
  - Create migration file with descriptive name
  - Verify migration applies: run `pnpm --filter api prisma studio` and confirm ScanEvent table exists
  - Verify enums are created: ScanEventType, LogLevel
  - **Verification Query**: `SELECT COUNT(*) FROM "ScanEvent";` should return 0
  - **Purpose**: Apply database schema changes
  - _Requirements: 6.1, 6.2_

- [x] 4. Create TypeScript types for scan events
  - **File**: `apps/api/src/modules/scans/scan-event.types.ts`
  - Define `ScanEvent`, `ScanEventType`, `LogLevel` interfaces
  - Define `CreateScanEventInput`, `GetEventsOptions` types
  - Export all types for use across modules
  - **Purpose**: Establish type safety for event handling
  - _Leverage: Pattern from `apps/api/src/modules/scans/scan.types.ts`_
  - _Requirements: 6.1_

- [x] 5. Create Zod validation schemas for events
  - **File**: `apps/api/src/modules/scans/scan-event.schema.ts`
  - Create `scanEventTypeSchema` enum validator
  - Create `logLevelSchema` enum validator
  - Create `createScanEventSchema` for event creation
  - Create `getEventsQuerySchema` for API query params
  - **Purpose**: Validate API inputs and event data
  - _Leverage: Pattern from `apps/api/src/modules/scans/scan.schema.ts`_
  - _Requirements: 6.1, 6.4_

### Phase 2: Backend Service

- [x] 6. Add SCAN_EVENTS key pattern to Redis constants
  - **File**: `apps/api/src/shared/constants/redis-keys.ts`
  - Add `SCAN_EVENTS` pattern: `scan:{scanId}:events`
  - Set TTL to 86400 (24 hours)
  - Add helper function `buildScanEventsKey(scanId)`
  - **Purpose**: Centralize Redis key management for events
  - _Leverage: Existing patterns in redis-keys.ts_
  - _Requirements: 6.5_

- [x] 7. Create ScanEventService - core log method
  - **File**: `apps/api/src/modules/scans/scan-event.service.ts`
  - Create `ScanEventService` class with constructor (prisma, redis)
  - Implement `log(input: CreateScanEventInput)` method
  - Write to database first, then cache to Redis
  - Handle errors gracefully (log but don't throw)
  - **Purpose**: Central service for creating scan events
  - _Leverage: Pattern from `apps/api/src/modules/scans/scan.service.ts`_
  - _Requirements: 6.1, 6.2, 6.5_

- [x] 8. Add getEvents and getEventsSince methods to ScanEventService
  - **File**: `apps/api/src/modules/scans/scan-event.service.ts`
  - Implement `getEvents(scanId, options)` - read from Redis, fallback to DB
  - Implement `getEventsSince(scanId, since, isAdmin)` for polling
  - Filter adminOnly events based on isAdmin parameter
  - Return events sorted by createdAt ascending
  - **Purpose**: Enable event retrieval for frontend polling
  - _Requirements: 6.4, 4.1_

- [x] 9. Add Redis cache hit/miss logging to ScanEventService
  - **File**: `apps/api/src/modules/scans/scan-event.service.ts`
  - In `getEvents`, log DEBUG event when Redis cache hit occurs (adminOnly: true)
  - In `getEvents`, log DEBUG event when Redis cache miss occurs (adminOnly: true)
  - Include cache key in metadata for debugging
  - **Purpose**: Enable admin visibility into cache performance
  - _Requirements: 4.5_

- [x] 10. Add archiveOldEvents method to ScanEventService
  - **File**: `apps/api/src/modules/scans/scan-event.service.ts`
  - Implement `archiveOldEvents(olderThan: Date)` method
  - Before deleting, aggregate summary into Scan.eventSummary
  - Delete events older than specified date
  - Return count of deleted events
  - **Purpose**: Enable scheduled cleanup of old events
  - _Requirements: 5.4 (Data Retention)_

- [x] 11. Create scheduled cleanup job for old events
  - **File**: `apps/api/src/jobs/cleanup-scan-events.job.ts`
  - Create job that runs daily (use node-cron or similar)
  - Call `scanEventService.archiveOldEvents(30 days ago)`
  - Log cleanup results (events deleted count)
  - Register job in main app initialization
  - **Purpose**: Automate data retention policy
  - _Leverage: Existing job patterns if any, or create new pattern_
  - _Requirements: 5.4 (Data Retention - 30 day cleanup)_

### Phase 3: API Endpoints

- [x] 12. Create ScanEventController with GET events endpoint
  - **File**: `apps/api/src/modules/scans/scan-event.controller.ts`
  - Create GET `/api/v1/scans/:scanId/events` endpoint
  - Parse query params with getEventsQuerySchema
  - Check scan ownership or admin status
  - Return events with lastTimestamp for polling
  - **Purpose**: Expose events API for frontend
  - _Leverage: Pattern from `apps/api/src/modules/scans/scan.controller.ts`_
  - _Requirements: 6.4_

- [x] 13. Add rate limiting to events endpoint
  - **File**: `apps/api/src/modules/scans/scan-event.controller.ts`
  - Configure rate limit: 100 requests per minute
  - Apply to GET events endpoint
  - Return 429 with retry-after header when exceeded
  - **Purpose**: Prevent abuse of polling endpoint
  - _Leverage: Existing rate limit middleware pattern_
  - _Requirements: NFR Performance_

- [x] 14. Register scan-event routes in scans module
  - **File**: `apps/api/src/modules/scans/index.ts`
  - Import ScanEventController
  - Register event routes under scans prefix
  - Export ScanEventService for worker use
  - **Purpose**: Integrate events into existing scans module
  - _Leverage: Existing module registration pattern_
  - _Requirements: 6.4_

### Phase 4: Worker Integration

- [x] 15. Create ScanEventService instance for worker
  - **File**: `apps/worker/src/services/scan-event.service.ts`
  - Import ScanEventService class from API module: `import { ScanEventService } from '@api/modules/scans/scan-event.service'`
  - Create and export singleton instance initialized with worker's prisma and redis clients
  - Example: `export const scanEventService = new ScanEventService(prisma, redis)`
  - **Purpose**: Enable worker to log events using shared service
  - _Leverage: Pattern from existing worker services_
  - _Requirements: 6.1_

- [x] 16. Add INIT and QUEUE event logging to scan processor
  - **File**: `apps/worker/src/processors/scan-page.processor.ts`
  - Import scanEventService from worker services
  - Log QUEUE event at processing start with job ID, queue position (adminOnly: true)
  - Log INIT event with scan details: "Initializing scan for {url}"
  - **Purpose**: Track scan initialization in console
  - _Requirements: 1.1, 1.2, 4.2, 4.6_

- [x] 17. Add FETCH event logging to scan processor
  - **File**: `apps/worker/src/processors/scan-page.processor.ts`
  - Log FETCH start event: "Fetching page: {url}"
  - Log FETCH success with load time: "Page loaded successfully ({loadTime}ms)"
  - Log FETCH error with user-friendly message, admin gets stack trace in metadata
  - On error, suggest common causes: "Page might be blocking automated access"
  - **Purpose**: Track page loading in console
  - _Requirements: 1.3, 1.4, 1.9, 3.6_

- [x] 18. Add ANALYSIS start and completion logging to scan processor
  - **File**: `apps/worker/src/processors/scan-page.processor.ts`
  - Log ANALYSIS event: "Running accessibility checks..."
  - Log ANALYSIS completion: "Accessibility analysis complete"
  - **Purpose**: Track analysis phase boundaries
  - _Requirements: 1.5_

- [x] 19. Add per-category ANALYSIS logging to scan processor
  - **File**: `apps/worker/src/processors/scan-page.processor.ts`
  - For each WCAG category being checked, log: "Checking: {categoryName}"
  - After each category, log issues found: "Found {count} issues in {categoryName}"
  - Apply severity indicator based on issue severity (SUCCESS/WARNING/ERROR level)
  - **Purpose**: Track detailed accessibility analysis progress
  - _Requirements: 1.6, 1.7_

- [x] 20. Add RESULT event logging to scan processor
  - **File**: `apps/worker/src/processors/scan-page.processor.ts`
  - Log RESULT event with total issues count: "Scan completed! Found {totalIssues} accessibility issues"
  - Log DEBUG event with performance metrics (adminOnly: true): memory usage, total time
  - **Purpose**: Track scan completion in console
  - _Requirements: 1.8, 4.3_

- [x] 21. Add queue wait time display logging
  - **File**: `apps/worker/src/processors/scan-page.processor.ts`
  - Calculate estimated wait time based on queue position and average processing time
  - Log QUEUE event: "Position in queue: {position}. Estimated wait: {time}"
  - Update periodically if job is waiting
  - **Purpose**: Show users their queue position and wait time
  - _Requirements: 3.5_

### Phase 5: Frontend - Hook & Types

- [x] 22. Create frontend ScanEvent types
  - **File**: `apps/web/src/types/scan-event.ts`
  - Define ScanEvent, ScanEventType, LogLevel types
  - Define GetEventsResponse type
  - Export types for component use
  - **Purpose**: Type safety for frontend event handling
  - _Requirements: 6.1_

- [x] 23. Add getEvents method to API client
  - **File**: `apps/web/src/lib/api.ts`
  - Add `scans.getEvents(scanId, options)` method
  - Handle since and limit query parameters
  - Return typed GetEventsResponse
  - **Purpose**: Enable frontend to fetch events
  - _Leverage: Existing API client pattern_
  - _Requirements: 6.4_

- [x] 24. Create useScanEvents hook with React Query
  - **File**: `apps/web/src/hooks/useScanEvents.ts`
  - Implement hook using useQuery from @tanstack/react-query
  - Accept scanId, scanStatus, and options (pollInterval, isAdmin)
  - Stop polling when scan is COMPLETED or FAILED
  - Accumulate events across polls
  - Return events, isLoading, error, refetch
  - **Purpose**: Manage event polling state
  - _Leverage: Pattern from `apps/web/src/hooks/useScan.ts`_
  - _Requirements: 1.1-1.9, NFR Performance_

### Phase 6: Frontend - Console Components

- [x] 25. Create LogEntry component
  - **File**: `apps/web/src/components/features/scan/LogEntry.tsx`
  - Accept event, isAdmin, showMetadata props
  - Render timestamp in HH:MM:SS format
  - Apply color based on log level (green/amber/red/white)
  - Show metadata expansion for admin view
  - **Purpose**: Render individual log entries
  - _Leverage: shadcn/ui components, Tailwind_
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 26. Create ScanConsole base structure
  - **File**: `apps/web/src/components/features/scan/ScanConsole.tsx`
  - Create component with scanId, scanStatus, isExpanded, onToggle props
  - Render dark terminal-style container (bg-gray-900, font-mono)
  - Set up basic layout structure with header and scroll area
  - **Purpose**: Establish base console component structure
  - _Leverage: shadcn/ui ScrollArea_
  - _Requirements: 2.1_

- [x] 27. Integrate useScanEvents hook into ScanConsole
  - **File**: `apps/web/src/components/features/scan/ScanConsole.tsx`
  - Import and use useScanEvents hook with scanId and scanStatus
  - Map events to LogEntry components
  - Filter out adminOnly events for public view
  - Limit display to 50 most recent entries
  - **Purpose**: Connect console to event data
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 28. Add auto-scroll behavior to ScanConsole
  - **File**: `apps/web/src/components/features/scan/ScanConsole.tsx`
  - Add useRef for scroll container reference
  - Implement auto-scroll to bottom on new entries
  - Detect manual scroll (onScroll handler) and pause auto-scroll
  - Resume auto-scroll when user scrolls to bottom
  - **Purpose**: Improve console UX with smart scrolling
  - _Leverage: React useRef, useEffect patterns_
  - _Requirements: 2.7, 2.8_

- [x] 29. Add collapsible behavior to ScanConsole
  - **File**: `apps/web/src/components/features/scan/ScanConsole.tsx`
  - Add collapse/expand toggle button with icon
  - Show compact summary when collapsed (event count)
  - Animate expand/collapse transition
  - Use useState for expansion state
  - **Purpose**: Allow users to minimize console
  - _Leverage: shadcn/ui Collapsible component_
  - _Requirements: NFR Usability_

- [x] 30. Add virtualization to ScanConsole for large entry counts
  - **File**: `apps/web/src/components/features/scan/ScanConsole.tsx`
  - Install and import react-window or @tanstack/react-virtual
  - Wrap LogEntry list with virtualized container
  - Only render visible entries plus buffer
  - Maintain scroll position during virtualization
  - **Purpose**: Handle 100+ entries without performance degradation
  - _Requirements: 2.9_

- [x] 31. Create AdminScanConsole base with event hook
  - **File**: `apps/web/src/components/admin/ScanConsole.tsx`
  - Create component with scanId, defaultView props
  - Use useScanEvents hook with isAdmin: true
  - Show all events including DEBUG level
  - Reuse LogEntry component with isAdmin prop
  - **Purpose**: Base admin console with full event access
  - _Requirements: 4.1, 4.2_

- [x] 32. Add view toggle to AdminScanConsole
  - **File**: `apps/web/src/components/admin/ScanConsole.tsx`
  - Add view toggle button (User View / Full View)
  - Filter events based on view mode (hide adminOnly in User View)
  - Store view preference in component state
  - **Purpose**: Allow admin to preview user experience
  - _Requirements: 4.8_

- [ ] 33. Add admin styling and copy button to AdminScanConsole
  - **File**: `apps/web/src/components/admin/ScanConsole.tsx`
  - Display adminOnly events with distinct background color (e.g., bg-purple-900/20)
  - Add "Copy Log" button that copies all visible events to clipboard
  - Use navigator.clipboard API with fallback
  - Show toast notification on copy success
  - **Purpose**: Enhanced admin debugging features
  - _Requirements: 4.7_

- [x] 34. Add ARIA accessibility to ScanConsole
  - **File**: `apps/web/src/components/features/scan/ScanConsole.tsx`
  - Add role="log" to container
  - Add aria-live="polite" for screen reader announcements
  - Add aria-label describing the console purpose
  - **Purpose**: Screen reader accessibility
  - _Requirements: NFR Accessibility_

- [x] 35. Add keyboard and color accessibility to LogEntry
  - **File**: `apps/web/src/components/features/scan/LogEntry.tsx`
  - Verify color contrast meets WCAG AA (4.5:1 ratio)
  - Add tabIndex for keyboard navigation
  - Add focus styles for keyboard users
  - Respect prefers-reduced-motion for animations
  - **Purpose**: Keyboard and visual accessibility
  - _Requirements: NFR Accessibility_

### Phase 7: Integration

- [x] 36. Integrate ScanConsole into ScanStatus component
  - **File**: `apps/web/src/components/features/scan/ScanStatus.tsx`
  - Import ScanConsole component
  - Add console below progress indicator
  - Pass props: `scanId={scan.id}`, `scanStatus={scan.status}`
  - Default to expanded state during active scan
  - Verify console appears during scan and shows events
  - **Purpose**: Show console during scan process
  - _Leverage: Existing ScanStatus component_
  - _Requirements: 1.1, 5.1_

- [x] 37. Integrate AdminScanConsole into admin scan detail
  - **File**: `apps/web/src/app/admin/scans/[id]/page.tsx`
  - Import AdminScanConsole component
  - Add console section to scan detail page
  - Pass scanId from route params: `scanId={params.id}`
  - **Purpose**: Show enhanced console in admin view
  - _Requirements: 4.1_

- [x] 38. Update scan module exports
  - **File**: `apps/web/src/components/features/scan/index.ts`
  - Export ScanConsole component
  - Export LogEntry component
  - **Purpose**: Make components available for import
  - _Leverage: Existing export pattern_

### Phase 8: Testing

- [x] 39. Create unit tests for ScanEventService
  - **File**: `apps/api/src/modules/scans/scan-event.service.test.ts`
  - Test log() creates event in DB and caches in Redis
  - Test getEvents() reads from Redis, falls back to DB
  - Test getEventsSince() filters by timestamp
  - Test adminOnly filtering
  - Test Redis cache hit/miss logging
  - Mock Prisma and Redis clients
  - **Purpose**: Ensure service reliability
  - _Leverage: Vitest, existing test patterns_
  - _Requirements: 6.1, 6.2, 4.5_

- [ ] 40. Create unit tests for ScanEventController
  - **File**: `apps/api/src/modules/scans/scan-event.controller.test.ts`
  - Test GET /events returns events with correct format
  - Test query param validation (since, limit)
  - Test rate limiting behavior
  - Test authorization (ownership/admin check)
  - **Purpose**: Ensure API reliability
  - _Leverage: Vitest, Fastify inject_
  - _Requirements: 6.4_

- [ ] 41. Create unit tests for useScanEvents hook
  - **File**: `apps/web/src/hooks/useScanEvents.test.ts`
  - Test polling starts when scan is active
  - Test polling stops when scan completes
  - Test events accumulate correctly
  - Test error handling
  - **Purpose**: Ensure hook reliability
  - _Leverage: Vitest, React Testing Library, MSW_
  - _Requirements: 1.1-1.9_

- [x] 42. Create unit tests for LogEntry component
  - **File**: `apps/web/src/components/features/scan/LogEntry.test.tsx`
  - Test correct color for each log level
  - Test timestamp formatting
  - Test metadata display for admin
  - Test accessibility attributes
  - **Purpose**: Ensure component renders correctly
  - _Leverage: Vitest, React Testing Library_
  - _Requirements: 2.2-2.6_

- [x] 43. Create unit tests for ScanConsole component
  - **File**: `apps/web/src/components/features/scan/ScanConsole.test.tsx`
  - Test events render correctly
  - Test adminOnly events are filtered
  - Test auto-scroll behavior
  - Test collapse/expand
  - Test virtualization with 100+ entries
  - **Purpose**: Ensure console works correctly
  - _Leverage: Vitest, React Testing Library_
  - _Requirements: 2.1, 2.7, 2.8, 2.9, 3.1-3.4_

- [x] 44. Create E2E test for public scan console
  - **File**: `apps/web/e2e/scan-console.spec.ts`
  - Start a scan and verify console appears
  - Verify events appear in real-time
  - Verify console persists after completion
  - Test collapse/expand functionality
  - **Purpose**: Validate end-to-end flow
  - _Leverage: Playwright_
  - _Requirements: 1.1-1.9, 5.1-5.3_

- [x] 45. Create E2E test for admin console
  - **File**: `apps/web/e2e/admin-scan-console.spec.ts`
  - Login as admin and view scan detail
  - Verify debug logs appear
  - Test view toggle (User View / Full View)
  - Verify admin-only events visible
  - Test copy log functionality
  - **Purpose**: Validate admin console flow
  - _Leverage: Playwright_
  - _Requirements: 4.1-4.8_

---

## Task Dependencies

```
Phase 1 (1-5) → Phase 2 (6-11) → Phase 3 (12-14) → Phase 4 (15-21)
                                                         ↓
Phase 5 (22-24) → Phase 6 (25-35) → Phase 7 (36-38) → Phase 8 (39-45)
```

## Estimated Effort

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| 1. Database & Types | 5 | 1.5 hours |
| 2. Backend Service | 6 | 2.5 hours |
| 3. API Endpoints | 3 | 1 hour |
| 4. Worker Integration | 7 | 2.5 hours |
| 5. Frontend Hook | 3 | 1 hour |
| 6. Frontend Components | 11 | 4.5 hours |
| 7. Integration | 3 | 1 hour |
| 8. Testing | 7 | 3.5 hours |
| **Total** | **45** | **~17.5 hours** |
