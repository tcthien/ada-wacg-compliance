# Implementation Plan: Google Analytics Integration

## Task Overview

This implementation plan breaks down the Google Analytics integration into atomic, agent-friendly tasks. Each task is designed to be completed in 15-30 minutes, touching 1-3 files maximum, with a single testable outcome.

## Steering Document Compliance

- **structure.md**: All new files follow kebab-case naming, components in PascalCase
- **tech.md**: TypeScript strict mode, React 18 hooks, Next.js 14 patterns

## Atomic Task Requirements

**Each task must meet these criteria for optimal agent execution:**
- **File Scope**: Touches 1-3 related files maximum
- **Time Boxing**: Completable in 15-30 minutes
- **Single Purpose**: One testable outcome per task
- **Specific Files**: Must specify exact files to create/modify
- **Agent-Friendly**: Clear input/output with minimal context switching

## Task Format Guidelines

- Use checkbox format: `- [ ] Task number. Task description`
- **Specify files**: Always include exact file paths to create/modify
- **Include implementation details** as bullet points
- Reference requirements using: `_Requirements: X.Y, Z.A_`
- Reference existing code to leverage using: `_Leverage: path/to/file.ts_`
- Focus only on coding tasks (no deployment, user testing, etc.)

## Implementation Phases

```
Phase 1: Core Infrastructure (Tasks 1-6)
Phase 2: React Integration (Tasks 7-13)
Phase 3: Consent System (Tasks 14-17)
Phase 4: Event Tracking (Tasks 18-27)
Phase 5: Testing & Polish (Tasks 28-33)
```

## Tasks

### Phase 1: Core Infrastructure

- [x] 1. Create analytics type definitions
  - **File**: `apps/web/src/lib/analytics.types.ts`
  - Define `BaseAnalyticsEvent` interface with event, timestamp, sessionId
  - Define `ScanInitiatedEvent`, `ScanCompletedEvent` interfaces
  - Define `ReportExportedEvent`, `FunnelEvent`, `ErrorEvent` interfaces
  - Define `AnalyticsEvent` union type combining all event types
  - Purpose: Establish type safety for all analytics operations
  - _Leverage: apps/web/src/types/*.ts (existing type patterns)_
  - _Requirements: 4, 5, 6_

- [x] 2. Create consent type definitions
  - **File**: `apps/web/src/lib/analytics.types.ts` (append to task 1)
  - Define `ConsentStatus` interface with essential, analytics, marketing, timestamp, version
  - Define `DataLayerEvent` interface
  - Add Window interface augmentation for dataLayer and gtag
  - Purpose: Type safety for consent and GTM integration
  - _Requirements: 3_

- [x] 3. Add analytics environment configuration
  - **File**: `apps/web/src/lib/env.ts` (modify existing)
  - Add `gtmId: process.env['NEXT_PUBLIC_GTM_ID'] || ''`
  - Add `gaMeasurementId: process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] || ''`
  - Add `analyticsEnabled: process.env['NEXT_PUBLIC_ANALYTICS_ENABLED'] !== 'false'`
  - Add `analyticsDebug: process.env['NODE_ENV'] === 'development'`
  - Add validation warnings for missing config
  - Purpose: Enable environment-based analytics configuration
  - _Leverage: apps/web/src/lib/env.ts (existing pattern)_
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 4. Update .env.example files with analytics variables
  - **File**: `apps/web/.env.example` (modify)
  - **File**: `.env.example` (modify root file)
  - Add `NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX`
  - Add `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
  - Add `NEXT_PUBLIC_ANALYTICS_ENABLED=true`
  - Add comments explaining each variable
  - Purpose: Document required environment variables
  - _Requirements: 8_

- [x] 5. Create analytics constants
  - **File**: `apps/web/src/lib/analytics.constants.ts`
  - Define `CONSENT_STORAGE_KEY = 'adashield:consent'`
  - Define `DEFAULT_CONSENT` object with all fields set to defaults
  - Define `ANALYTICS_EVENTS` object with all event name strings
  - Define `GTM_DOMAINS` array for CSP configuration
  - Purpose: Centralize analytics configuration constants
  - _Requirements: 3, 4, 5_

- [x] 6. Create core analytics dataLayer functions
  - **File**: `apps/web/src/lib/analytics.ts`
  - Implement `initializeDataLayer()` to create window.dataLayer array
  - Implement `pushToDataLayer(event: DataLayerEvent)` with type safety
  - Implement `safeAnalyticsCall<T>(operation, fallback, context)` error wrapper
  - Log errors to console in debug mode only
  - Purpose: Provide core GTM/dataLayer interface
  - _Leverage: apps/web/src/lib/recaptcha.ts (error handling pattern)_
  - _Requirements: 1.2, 1.3_

### Phase 2: React Integration

- [x] 7. Create PII sanitization utilities
  - **File**: `apps/web/src/lib/analytics.ts` (append to task 6)
  - Implement `sanitizeUrl(url: string)` to remove query parameters
  - Implement `sanitizeError(message: string)` to remove email patterns and URLs
  - Both should handle invalid input gracefully
  - Purpose: Protect user privacy in analytics events
  - _Requirements: 6.1, 6.2, Security NFR_

- [x] 8. Create consent storage utilities
  - **File**: `apps/web/src/lib/consent.ts`
  - Implement `getConsent(): ConsentStatus` to read from localStorage
  - Implement `setConsent(status: ConsentStatus)` to save to localStorage
  - Handle JSON parse errors gracefully with default consent
  - Purpose: Manage consent state persistence
  - _Leverage: apps/web/src/components/features/privacy/CookieConsent.tsx (localStorage pattern)_
  - _Requirements: 3.2, 3.6_

- [x] 9. Create consent utility functions
  - **File**: `apps/web/src/lib/consent.ts` (append to task 8)
  - Implement `clearAnalyticsCookies()` to remove GA cookies (_ga, _gid, etc.)
  - Implement `migrateOldConsent()` to convert old 'cookieConsent' key to new format
  - Clean up old localStorage key after migration
  - Purpose: Cookie management and backward compatibility
  - _Requirements: 3.5, 3.6_

- [x] 10. Create GTMScript component
  - **File**: `apps/web/src/components/features/analytics/GTMScript.tsx`
  - Use Next.js Script component with `strategy="afterInteractive"`
  - Accept `gtmId` and `enabled` props
  - Conditionally render based on enabled and gtmId availability
  - Call `initializeDataLayer()` before rendering script
  - Return null if gtmId is empty or not enabled (no errors)
  - Purpose: Load GTM script with consent gating
  - _Leverage: apps/web/src/lib/recaptcha.ts (script loading pattern)_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 11. Create AnalyticsContext definition
  - **File**: `apps/web/src/components/features/analytics/AnalyticsProvider.tsx`
  - Create `AnalyticsContextValue` interface
  - Create `AnalyticsContext` with React.createContext
  - Export `useAnalyticsContext` hook to consume context
  - Purpose: Establish analytics context structure
  - _Requirements: 4_

- [x] 12. Implement AnalyticsProvider component
  - **File**: `apps/web/src/components/features/analytics/AnalyticsProvider.tsx` (continue task 11)
  - Implement provider component managing consent state
  - Implement `track()` method that checks consent before pushing to dataLayer
  - Implement `trackPageView()` method for page view events
  - Implement `setConsent()` method that updates state and storage
  - Include GTMScript as conditional child
  - Purpose: Provide analytics context to application
  - _Leverage: apps/web/src/hooks/useBatch.ts (context provider pattern)_
  - _Requirements: 1, 2, 3, 4_

- [x] 13. Create analytics barrel export
  - **File**: `apps/web/src/components/features/analytics/index.ts`
  - Export `AnalyticsProvider` component
  - Export `GTMScript` component
  - Export `useAnalyticsContext` hook
  - Export types from analytics.types.ts
  - Purpose: Clean public API for analytics module
  - _Requirements: 4_

### Phase 3: Consent System

- [x] 14. Create useAnalytics hook
  - **File**: `apps/web/src/hooks/useAnalytics.ts`
  - Consume AnalyticsContext using useAnalyticsContext
  - Provide type-safe `track<T extends AnalyticsEventName>()` method
  - Provide `trackPageView(path, title?)` method
  - Expose `isEnabled` boolean
  - Purpose: Easy-to-use analytics hook for components
  - _Leverage: apps/web/src/hooks/useScanEvents.ts (hook pattern)_
  - _Requirements: 4, 5, 6_

- [x] 15. Enhance CookieConsent UI for granular consent
  - **File**: `apps/web/src/components/features/privacy/CookieConsent.tsx` (modify)
  - Add analytics consent toggle/checkbox
  - Update banner text to mention analytics tracking
  - Keep essential cookies always enabled
  - Style toggle consistently with existing design
  - Purpose: Enable granular analytics consent control
  - _Leverage: apps/web/src/components/features/privacy/CookieConsent.tsx_
  - _Requirements: 3.1_

- [x] 16. Integrate consent utilities in CookieConsent
  - **File**: `apps/web/src/components/features/privacy/CookieConsent.tsx` (modify)
  - Import consent utilities from `lib/consent.ts`
  - Call `getConsent()` on mount to check existing consent
  - Call `setConsent()` when user accepts/declines
  - Call `clearAnalyticsCookies()` when analytics declined
  - Run `migrateOldConsent()` on component mount
  - Purpose: Connect UI to consent management
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 17. Integrate AnalyticsProvider in layout
  - **File**: `apps/web/src/app/layout.tsx` (modify)
  - Import AnalyticsProvider from features/analytics
  - Wrap children with AnalyticsProvider inside body
  - Ensure CookieConsent is included in the tree
  - Purpose: Enable analytics throughout the application
  - _Leverage: apps/web/src/app/layout.tsx_
  - _Requirements: 1, 2_

### Phase 4: Event Tracking Integration

- [x] 18. Create PageViewTracker component
  - **File**: `apps/web/src/components/features/analytics/PageViewTracker.tsx`
  - Use `usePathname()` from next/navigation to detect route changes
  - Use `useEffect` to call `trackPageView()` on pathname change
  - Handle initial page load tracking
  - Only track when analytics enabled
  - Purpose: Automatic page view tracking for SPA
  - _Leverage: apps/web/src/app/layout.tsx (usePathname usage if exists)_
  - _Requirements: 2.1, 2.2_

- [x] 19. Add PageViewTracker to AnalyticsProvider
  - **File**: `apps/web/src/components/features/analytics/AnalyticsProvider.tsx` (modify)
  - Import and include PageViewTracker component
  - Render only when consent.analytics is true
  - Purpose: Enable automatic page view tracking
  - _Requirements: 2.1, 2.2_

- [x] 20. Add scan form submission tracking
  - **File**: `apps/web/src/components/features/scan/ScanForm.tsx` (modify)
  - Import `useAnalytics` hook
  - Track `scan_initiated` in handleSubmit with wcagLevel, scanType, urlCount
  - Track `funnel_scan_submitted` on successful API call
  - Purpose: Track scan initiation events
  - _Leverage: apps/web/src/components/features/scan/ScanForm.tsx_
  - _Requirements: 4.1, 5.1_

- [x] 21. Add scan form view tracking
  - **File**: `apps/web/src/components/features/scan/ScanForm.tsx` (modify)
  - Track `funnel_scan_form_viewed` on component mount using useEffect
  - Track `funnel_scan_url_entered` on URL input blur (not every keystroke)
  - Generate and store `funnel_session_id` in sessionStorage for correlation
  - Purpose: Track scan funnel stages
  - _Requirements: 5.1, 5.3_

- [x] 22. Add scan results tracking
  - **File**: `apps/web/src/app/scan/[id]/page.tsx` (modify)
  - Import `useAnalytics` hook
  - Track `scan_completed` when scan status becomes 'completed'
  - Include duration, issue counts by severity (critical, serious, moderate, minor), wcagLevel
  - Track `funnel_scan_results_viewed` on page load
  - Purpose: Track scan completion and results viewing
  - _Leverage: apps/web/src/app/scan/[id]/page.tsx_
  - _Requirements: 4.2, 5.1_

- [x] 23. Add export button tracking
  - **File**: `apps/web/src/components/features/export/ExportButton.tsx` (modify)
  - Import `useAnalytics` hook
  - Track `report_exported` on successful export with format (pdf/json) and reportType
  - Track `funnel_report_downloaded` for funnel analysis
  - Purpose: Track report export behavior
  - _Leverage: apps/web/src/components/features/export/ExportButton.tsx_
  - _Requirements: 4.3, 5.1_

- [x] 24. Add API error tracking
  - **File**: `apps/web/src/lib/api.ts` (modify)
  - Import analytics utilities (pushToDataLayer, sanitizeError, getConsent)
  - Track `error_api` in catch block with sanitized error details
  - Include endpoint path (strip query params), error code
  - Only track if analytics consent granted
  - Purpose: Enable API error tracking
  - _Leverage: apps/web/src/lib/api.ts_
  - _Requirements: 6.1_

- [x] 25. Create error boundary with JS error tracking
  - **File**: `apps/web/src/components/ErrorBoundary.tsx`
  - Create React error boundary component
  - Track `error_js` events with sanitized error message and type
  - Include component context from error info
  - Show fallback UI on error
  - Purpose: Capture and track JavaScript errors
  - _Requirements: 6.2_

- [x] 26. Add Core Web Vitals tracking
  - **File**: `apps/web/src/lib/web-vitals.ts`
  - Install and import `web-vitals` library
  - Implement `reportWebVitals(metric)` function
  - Push LCP, FID, CLS metrics to dataLayer when measured
  - Only track when analytics consent granted
  - Purpose: Track Core Web Vitals for performance monitoring
  - _Requirements: 6.3_

- [x] 27. Integrate Web Vitals in layout
  - **File**: `apps/web/src/app/layout.tsx` (modify)
  - Import and call `reportWebVitals` setup function
  - Ensure it runs on client side only
  - Purpose: Enable Core Web Vitals tracking
  - _Requirements: 6.3_

### Phase 5: Testing & Polish

- [x] 28. Create analytics dataLayer unit tests
  - **File**: `apps/web/src/lib/__tests__/analytics.test.ts`
  - Test `initializeDataLayer()` creates window.dataLayer array
  - Test `pushToDataLayer()` adds events correctly
  - Test `safeAnalyticsCall()` catches errors and returns fallback
  - Purpose: Ensure core analytics utilities work correctly
  - _Leverage: apps/web/src/hooks/useDiscovery.test.ts (test pattern)_
  - _Requirements: 1, 4_

- [x] 29. Create PII sanitization unit tests
  - **File**: `apps/web/src/lib/__tests__/analytics.test.ts` (append)
  - Test `sanitizeUrl()` removes query parameters
  - Test `sanitizeUrl()` handles invalid URLs gracefully
  - Test `sanitizeError()` removes email patterns
  - Test `sanitizeError()` removes URLs with query strings
  - Purpose: Ensure PII protection works correctly
  - _Requirements: 6, Security NFR_

- [x] 30. Create useAnalytics hook unit tests
  - **File**: `apps/web/src/hooks/__tests__/useAnalytics.test.ts`
  - Test hook returns correct context values
  - Test `track()` pushes to dataLayer when consent granted
  - Test `track()` does nothing when consent denied
  - Test `trackPageView()` sends correct event structure
  - Purpose: Ensure hook behavior matches requirements
  - _Leverage: apps/web/src/hooks/useDiscovery.test.ts (test pattern)_
  - _Requirements: 3, 4_

- [x] 31. Create consent E2E tests
  - **File**: `apps/web/e2e/analytics-consent.spec.ts`
  - Test GTM script loads after consent acceptance
  - Test GTM script does NOT load when consent declined
  - Test consent persists across page reloads
  - Test declining clears analytics cookies
  - Purpose: Validate consent flow end-to-end
  - _Leverage: apps/web/e2e/batch-scan.spec.ts (E2E pattern)_
  - _Requirements: 1, 3_

- [x] 32. Create event tracking E2E tests
  - **File**: `apps/web/e2e/analytics-events.spec.ts`
  - Test `scan_initiated` event pushed on form submission
  - Test page view events tracked on navigation
  - Test `report_exported` event on download
  - Verify event payloads contain expected properties
  - Purpose: Validate event tracking end-to-end
  - _Leverage: apps/web/e2e/batch-scan.spec.ts (E2E pattern)_
  - _Requirements: 2, 4_

- [x] 33. Update next.config.js with CSP headers
  - **File**: `apps/web/next.config.js` (modify)
  - Add `www.googletagmanager.com` to script-src
  - Add `www.google-analytics.com`, `analytics.google.com` to connect-src
  - Add `www.google-analytics.com` to img-src
  - Purpose: Enable GTM/GA4 without CSP violations
  - _Requirements: Security NFR_

## Task Dependencies

```
Task 1 ──► Task 2 ──► Task 5 ──► Task 6 ──► Task 7
                                    │
Task 3 ──────────────────────────────┤
                                    │
Task 4 ─────────────────────────────┘

Task 6 ──► Task 8 ──► Task 9

Task 10 ──► Task 11 ──► Task 12 ──► Task 13

Task 8, 12 ──► Task 14

Task 15 ──► Task 16

Task 12, 16 ──► Task 17

Task 14, 17 ──► Task 18 ──► Task 19

Task 14 ──► Tasks 20-27 (parallel)

Tasks 6, 7 ──► Tasks 28, 29

Task 14 ──► Task 30

Task 17 ──► Tasks 31, 32

Task 33 (independent)
```

## Verification Checklist

After completing all tasks, verify:

- [ ] GTM loads only after user accepts analytics consent
- [ ] GTM does NOT load when user declines consent
- [ ] Page views are tracked on every navigation
- [ ] `scan_initiated` fires with correct parameters on form submit
- [ ] `scan_completed` fires with issue counts when scan finishes
- [ ] `report_exported` fires when user downloads PDF/JSON
- [ ] API errors are tracked with sanitized messages
- [ ] JavaScript errors are captured by error boundary
- [ ] Core Web Vitals (LCP, FID, CLS) are tracked
- [ ] All events include timestamp
- [ ] No PII is sent in any events
- [ ] App works normally if analytics fails to load
- [ ] Existing users' consent is migrated correctly
- [ ] CSP headers allow GTM/GA4 domains
- [ ] All unit tests pass
- [ ] All E2E tests pass

## Out of Scope (Deferred to Future Tasks)

The following items from requirements are deferred to separate implementation tasks:

1. **Requirement 7: Admin Analytics Dashboard** - Separate spec for admin features
2. **Requirement 4.4, 4.5: Auth events** - Requires auth system integration
3. **Requirement 5.2: Signup funnel** - Requires auth system integration
4. **Requirement 8.5: Test mode mocking** - Can be added when test infrastructure matures

---

*Created: December 2024*
*Version: 1.1*
*Status: Draft - Pending Review*
