# Implementation Plan - Discovery Flow V2

## Task Overview

Implementation of a redesigned 3-step discovery flow (Input URLs → Select URLs → Preview) with two input methods (Sitemap and Manual), and a new BatchUrlTable component with show more/less functionality for the main scanner form.

**Implementation Approach:**
1. Build foundation (types, utilities, state management)
2. Create Step 1 components (input methods)
3. Create Step 2 components (URL selection)
4. Create Step 3 components (preview)
5. Create BatchUrlTable for ScanForm
6. Integrate with discovery page
7. Add tests

## Steering Document Compliance

- **Structure**: All components in `apps/web/src/components/features/discovery/`
- **Hooks**: Custom hooks in `apps/web/src/hooks/`
- **Stores**: Zustand store in `apps/web/src/stores/`
- **Utilities**: URL utilities in `apps/web/src/lib/`
- **Types**: Shared types in component files or dedicated type files
- **Tests**: Unit tests co-located, E2E in `apps/web/e2e/`

## Atomic Task Requirements

**Each task must meet these criteria:**
- **File Scope**: Touches 1-3 related files maximum
- **Time Boxing**: Completable in 15-30 minutes
- **Single Purpose**: One testable outcome per task
- **Specific Files**: Must specify exact files to create/modify
- **Agent-Friendly**: Clear input/output with minimal context switching

---

## Phase 1: Foundation (Types & Utilities)

- [x] 1. Create discovery error types in types file
  - File: `apps/web/src/types/discovery-errors.ts` (create)
  - Define `DiscoveryErrorType` union type
  - Define `DiscoveryError` interface with type, message, retryable, details
  - Export all types for use in hooks and components
  - Purpose: Establish typed error handling for discovery flow
  - _Requirements: FR-1.7, Error Handling section_

- [x] 2. Create URL validation utilities
  - File: `apps/web/src/lib/url-utils.ts` (create)
  - Implement `validateUrl(url: string): boolean` using URL constructor
  - Implement `normalizeUrl(url: string): string` for consistent formatting
  - Implement `generateId(): string` for unique URL identifiers
  - Implement `sanitizeUrlForDisplay(url: string): string` for XSS prevention
  - Purpose: Provide URL validation and sanitization utilities
  - _Requirements: FR-1.6, Security section_

- [x] 3. Create manual URL parsing function
  - File: `apps/web/src/lib/url-utils.ts` (modify from task 2)
  - Add `ValidationResult` and `ValidationError` interfaces
  - Implement `parseManualUrls(input: string): ValidationResult`
  - Support semicolon-separated and multi-line formats
  - Deduplicate URLs and track validation errors
  - Purpose: Parse and validate manual URL input
  - _Leverage: `apps/web/src/lib/url-utils.ts` (validateUrl, normalizeUrl, generateId)_
  - _Requirements: FR-1.4, FR-1.5, US-2_

- [x] 4. Create URL utilities unit tests
  - File: `apps/web/src/lib/__tests__/url-utils.test.ts` (create)
  - Test validateUrl with valid/invalid URLs
  - Test normalizeUrl output consistency
  - Test parseManualUrls with semicolon and newline formats
  - Test duplicate URL handling and error reporting
  - Purpose: Ensure URL utilities work correctly
  - _Leverage: `apps/web/src/lib/url-utils.ts`_
  - _Requirements: FR-1.4, FR-1.5, FR-1.6_

---

## Phase 2: State Management

- [x] 5. Create Zustand store for discovery flow V2
  - File: `apps/web/src/stores/discovery-flow-v2-store.ts` (create)
  - Define `DiscoveryFlowV2Store` interface with state and actions
  - Implement store with `create()` and `persist()` middleware
  - Add actions: setCurrentStep, setInputMethod, setParsedUrls, toggleSelection, selectAll, deselectAll
  - Add computed: canProceedToSelect, canProceedToPreview, getSelectedUrls
  - Purpose: Centralized state management for discovery flow
  - _Leverage: `apps/web/src/stores/discovery-store.ts` (existing pattern)_
  - _Requirements: FR-5.1, FR-5.2_

- [x] 6. Create useDiscoveryFlowV2 hook base structure
  - File: `apps/web/src/hooks/useDiscoveryFlowV2.ts` (create)
  - Import `useDiscoveryFlowV2Store` and `useRouter`
  - Create hook function returning store state
  - Add basic navigation helpers: `goBack()`, `goToPreview()`
  - Purpose: Foundation for discovery flow business logic
  - _Leverage: `apps/web/src/stores/discovery-flow-v2-store.ts`_
  - _Requirements: US-6_

- [x] 7. Add fetchSitemap function to hook
  - File: `apps/web/src/hooks/useDiscoveryFlowV2.ts` (modify from task 6)
  - Implement `fetchSitemap()` with API call to discovery endpoint
  - Add polling logic with exponential backoff (max 30 attempts)
  - Handle success: set parsed URLs and navigate to select step
  - Handle errors: set error state with retryable flag
  - Purpose: Enable sitemap URL fetching and parsing
  - _Leverage: `apps/web/src/lib/discovery-api.ts`_
  - _Requirements: US-1, NFR-1.1_

- [x] 8. Add parseManual and submitSelection to hook
  - File: `apps/web/src/hooks/useDiscoveryFlowV2.ts` (modify from task 7)
  - Implement `parseManual()` using parseManualUrls from url-utils
  - Implement `submitSelection()` to save to sessionStorage
  - Navigate to home page after submission
  - Purpose: Complete hook functionality for manual flow and submission
  - _Leverage: `apps/web/src/lib/url-utils.ts`_
  - _Requirements: US-2, FR-5.1_

- [x] 9. Add analytics tracking to useDiscoveryFlowV2 hook
  - File: `apps/web/src/hooks/useDiscoveryFlowV2.ts` (modify from task 8)
  - Import `useAnalytics` hook
  - Add tracking calls in fetchSitemap, parseManual, submitSelection
  - Track step navigation events (back, preview viewed)
  - Purpose: Enable analytics for discovery flow
  - _Leverage: `apps/web/src/hooks/useAnalytics.ts`_
  - _Requirements: Design Analytics Events section_

---

## Phase 3: Step 1 Components (Input URLs)

- [x] 10. Create InputMethodSelector component
  - File: `apps/web/src/components/features/discovery/InputMethodSelector.tsx` (create)
  - Create radio button group with "Sitemap" and "Manual" options
  - Accept props: value, onChange, disabled
  - Style with existing card/radio patterns
  - Add aria-labels for accessibility
  - Purpose: Allow user to choose input method
  - _Leverage: `apps/web/src/components/features/discovery/DiscoveryModeSelector.tsx` (styling pattern)_
  - _Requirements: FR-1.1, NFR-2.2_

- [x] 11. Create SitemapUrlInput component
  - File: `apps/web/src/components/features/discovery/SitemapUrlInput.tsx` (create)
  - Create single URL input field with label
  - Accept props: value, onChange, onSubmit, error, isLoading
  - Show inline validation error
  - Add loading spinner on submit button
  - Purpose: Capture sitemap URL from user
  - _Leverage: `apps/web/src/components/ui/input.tsx`, `apps/web/src/components/ui/button.tsx`_
  - _Requirements: FR-1.2, FR-1.6, FR-1.7, US-1_

- [x] 12. Create ManualUrlEntryEnhanced component
  - File: `apps/web/src/components/features/discovery/ManualUrlEntryEnhanced.tsx` (create)
  - Create textarea for multi-URL entry
  - Accept props: value, onChange, onSubmit, error, urlCount, maxUrls
  - Show URL count and max limit (50)
  - Display helper text about supported formats
  - Purpose: Capture multiple URLs from user
  - _Leverage: `apps/web/src/components/features/discovery/ManualUrlEntry.tsx` (pattern)_
  - _Requirements: FR-1.3, FR-1.4, FR-1.5, FR-1.8, US-2_

- [x] 13. Create Step1InputUrls container component
  - File: `apps/web/src/components/features/discovery/Step1InputUrls.tsx` (create)
  - Compose InputMethodSelector, SitemapUrlInput, ManualUrlEntryEnhanced
  - Accept props: onContinue, isLoading
  - Manage local state for input method switching
  - Show appropriate input based on selected method
  - Add "Continue" button with validation
  - Purpose: Container for Step 1 of discovery flow
  - _Leverage: InputMethodSelector, SitemapUrlInput, ManualUrlEntryEnhanced_
  - _Requirements: FR-1.1, FR-1.2, FR-1.3, US-1, US-2_

---

## Phase 4: Step 2 Components (Select URLs)

- [x] 14. Create UrlSelectionList component
  - File: `apps/web/src/components/features/discovery/UrlSelectionList.tsx` (create)
  - Create scrollable list with checkbox for each URL
  - Accept props: urls, selectedIds, onToggle, maxHeight (default: '400px')
  - Display URL and title (if available) for each item
  - Use VirtualizedList component when urls.length > 20
  - Purpose: Display selectable list of URLs efficiently
  - _Leverage: `apps/web/src/components/ui/virtualized-list.tsx`_
  - _Requirements: FR-2.1, FR-2.2, NFR-1.2_

- [x] 15. Create SelectAllControls component
  - File: `apps/web/src/components/features/discovery/SelectAllControls.tsx` (create)
  - Create buttons for "Select All" and "Deselect All"
  - Accept props: onSelectAll, onDeselectAll, selectedCount, totalCount
  - Display count: "X of Y selected"
  - Purpose: Bulk selection controls for URL list
  - _Leverage: `apps/web/src/components/ui/button.tsx`_
  - _Requirements: FR-2.3, FR-2.4, FR-2.5_

- [x] 16. Create Step2SelectUrls container component
  - File: `apps/web/src/components/features/discovery/Step2SelectUrls.tsx` (create)
  - Compose UrlSelectionList, SelectAllControls
  - Accept props: urls, selectedIds, onSelectionChange, onBack, onContinue
  - Add "Back" and "Continue" buttons
  - Disable Continue if no URLs selected
  - Purpose: Container for Step 2 of discovery flow
  - _Leverage: UrlSelectionList, SelectAllControls, `apps/web/src/components/ui/selection-counter.tsx`_
  - _Requirements: FR-2.1 through FR-2.6, US-3, US-6_

---

## Phase 5: Step 3 Components (Preview)

- [x] 17. Create PreviewTable component
  - File: `apps/web/src/components/features/discovery/PreviewTable.tsx` (create)
  - Create table showing selected URLs
  - Display columns: #, URL, Title
  - Accept props: urls
  - Use table styling from UI library
  - Purpose: Display final URL selection summary
  - _Leverage: `apps/web/src/components/ui/table.tsx`_
  - _Requirements: FR-3.1_

- [x] 18. Create EstimatedTime component
  - File: `apps/web/src/components/features/discovery/EstimatedTime.tsx` (create)
  - Calculate estimated scan duration: Math.ceil(urlCount * 30 / 60) minutes
  - Accept props: urlCount
  - Display formatted time (e.g., "~5 minutes")
  - Purpose: Show estimated scan duration
  - _Requirements: FR-3.2_

- [x] 19. Create Step3Preview container component
  - File: `apps/web/src/components/features/discovery/Step3Preview.tsx` (create)
  - Compose PreviewTable, EstimatedTime
  - Accept props: selectedUrls, onBack, onStartScan, isSubmitting
  - Add "Back" and "Start Scan" buttons
  - Show loading state on Start Scan
  - Purpose: Container for Step 3 of discovery flow
  - _Leverage: PreviewTable, EstimatedTime_
  - _Requirements: FR-3.1 through FR-3.4, US-4_

---

## Phase 6: Batch URL Table (ScanForm Integration)

- [x] 20. Create ShowMoreLess reusable component
  - File: `apps/web/src/components/ui/show-more-less.tsx` (create)
  - Create toggle button component
  - Accept props: isExpanded, onToggle, hiddenCount, className
  - Show "Show more (+N more)" when collapsed
  - Show "Show less" when expanded
  - Use chevron icons for visual indication
  - Purpose: Reusable expand/collapse toggle
  - _Leverage: `apps/web/src/components/ui/button.tsx`_
  - _Requirements: FR-4.7, FR-4.8, FR-4.9_

- [x] 21. Create BatchUrlTable component
  - File: `apps/web/src/components/features/batch/BatchUrlTable.tsx` (create)
  - Create compact table for batch URLs
  - Accept props: urls, onRemove, onClearAll, initialDisplayCount (default: 3)
  - Display columns: URL, Title, Remove action
  - Integrate ShowMoreLess for expansion
  - Show "Clear All" button in header
  - Display total URL count (e.g., "5 URLs selected")
  - Purpose: Compact batch URL display for ScanForm
  - _Leverage: `apps/web/src/components/ui/table.tsx`, ShowMoreLess_
  - _Requirements: FR-4.1 through FR-4.10, US-5_

- [x] 22. Create BatchUrlTable unit tests
  - File: `apps/web/src/components/features/batch/BatchUrlTable.test.tsx` (create)
  - Test initial display shows only 3 URLs (5 test cases)
  - Test "Show more" expands to show all URLs
  - Test "Show less" collapses back to 3
  - Test remove URL functionality
  - Test clear all functionality
  - Purpose: Ensure BatchUrlTable works correctly
  - _Leverage: `apps/web/src/components/features/batch/BatchUrlTable.tsx`_
  - _Requirements: FR-4.6, FR-4.7, FR-4.8, FR-4.9, US-5_

- [x] 23. Integrate BatchUrlTable into ScanForm
  - File: `apps/web/src/components/features/scan/ScanForm.tsx` (modify)
  - Import BatchUrlTable component
  - Add state for batchUrls and isBatchMode
  - Load batch URLs from sessionStorage on mount
  - Replace textarea display with BatchUrlTable when in batch mode
  - Add handleRemoveUrl and handleClearAll callbacks
  - Revert to single URL mode when all URLs removed
  - Purpose: Use new BatchUrlTable in main scanner form
  - _Leverage: BatchUrlTable, existing ScanForm code_
  - _Requirements: FR-4.1, FR-4.10, US-5_

- [x] 24. Add discovery data cleanup after scan submission
  - File: `apps/web/src/components/features/scan/ScanForm.tsx` (modify from task 23)
  - In form submit handler, clear sessionStorage after successful submission
  - Remove 'discovery:selectedPages' key
  - Reset batch mode state
  - Purpose: Prevent stale data persistence
  - _Leverage: existing submit handler_
  - _Requirements: FR-5.3_

---

## Phase 7: Discovery Page Integration

- [x] 25. Create DiscoveryFlowV2 component structure
  - File: `apps/web/src/components/features/discovery/DiscoveryFlowV2.tsx` (create)
  - Use useDiscoveryFlowV2 hook for state
  - Add StepIndicator with 3 steps: ["Input URLs", "Select URLs", "Preview"]
  - Add basic step rendering logic with conditional display
  - Purpose: Main orchestration component structure
  - _Leverage: useDiscoveryFlowV2, `apps/web/src/components/ui/step-indicator.tsx`_
  - _Requirements: US-1 through US-6_

- [x] 26. Add step transition handlers to DiscoveryFlowV2
  - File: `apps/web/src/components/features/discovery/DiscoveryFlowV2.tsx` (modify from task 25)
  - Wire up onContinue handlers for Step1, Step2
  - Add back button functionality for Step2, Step3
  - Implement error display for each step
  - Purpose: Complete step navigation logic
  - _Leverage: Step1InputUrls, Step2SelectUrls, Step3Preview_
  - _Requirements: US-6_

- [x] 27. Update discovery page to use V2 flow
  - File: `apps/web/src/app/discovery/page.tsx` (modify)
  - Import DiscoveryFlowV2 component
  - Wrap in ErrorBoundary with fallback
  - Add Suspense boundary with skeleton loader
  - Replace existing flow with new V2 component
  - Purpose: Enable new discovery flow on page
  - _Leverage: DiscoveryFlowV2, `apps/web/src/components/ErrorBoundary.tsx`_
  - _Requirements: All User Stories_

- [x] 28. Add feature flag for V2 discovery flow
  - File: `apps/web/src/lib/feature-flags.ts` (create)
  - Create `useFeatureFlags()` hook
  - Add `discoveryV2Enabled` flag from `NEXT_PUBLIC_DISCOVERY_V2_ENABLED`
  - File: `apps/web/.env.example` (modify)
  - Add `NEXT_PUBLIC_DISCOVERY_V2_ENABLED=false` with documentation
  - Purpose: Enable gradual rollout and A/B testing
  - _Requirements: Design Migration Strategy section_

---

## Phase 8: End-to-End Tests

- [x] 29. Create E2E test for sitemap discovery flow
  - File: `apps/web/e2e/discovery-v2-sitemap.spec.ts` (create)
  - Test selecting sitemap method
  - Test entering sitemap URL and fetching
  - Test URL selection step with select all/deselect
  - Test preview and start scan
  - Purpose: Validate sitemap discovery flow works end-to-end
  - _Requirements: US-1, US-3, US-4_

- [x] 30. Create E2E test for manual URL entry flow
  - File: `apps/web/e2e/discovery-v2-manual.spec.ts` (create)
  - Test selecting manual method
  - Test entering multiple URLs (semicolon format)
  - Test entering multiple URLs (newline format)
  - Test URL validation errors display
  - Test selection and preview steps
  - Purpose: Validate manual URL entry flow works end-to-end
  - _Requirements: US-2, US-3, US-4_

- [x] 31. Create E2E test for batch URL table
  - File: `apps/web/e2e/discovery-v2-batch-table.spec.ts` (create)
  - Test batch URLs display in ScanForm (5 URLs, shows 3)
  - Test "Show more (+2 more)" expands to show all
  - Test "Show less" collapses back to 3
  - Test remove individual URL updates count
  - Test clear all URLs reverts to single URL mode
  - Purpose: Validate BatchUrlTable works correctly in ScanForm
  - _Requirements: US-5, FR-4.6 through FR-4.10_

- [x] 32. Create E2E test for step navigation and accessibility
  - File: `apps/web/e2e/discovery-v2-navigation.spec.ts` (create)
  - Test back button on Step 2 returns to Step 1
  - Test back button on Step 3 returns to Step 2
  - Test step indicator shows correct progress (1/3, 2/3, 3/3)
  - Test state preservation when navigating back
  - Test keyboard navigation (Tab through inputs, Enter to submit)
  - Purpose: Validate navigation and accessibility
  - _Requirements: US-6, NFR-2.2_

- [x] 33. Create E2E test for mobile responsive layout
  - File: `apps/web/e2e/discovery-v2-mobile.spec.ts` (create)
  - Test on 375px mobile viewport
  - Test touch interactions on mobile
  - Test batch table display on mobile
  - Test form inputs are usable on mobile
  - Purpose: Ensure mobile usability
  - _Requirements: NFR-3.2_

---

## Task Dependencies

```
1 → 2 → 3 → 4 (URL utilities)
5 → 6 → 7 → 8 → 9 (State management)
10, 11, 12 → 13 (Step 1 components)
14, 15 → 16 (Step 2 components)
17, 18 → 19 (Step 3 components)
20 → 21 → 22, 23 → 24 (Batch URL table)
13, 16, 19 → 25 → 26 → 27 (Discovery page)
28 (Feature flag - can be parallel)
27 → 29, 30, 31, 32, 33 (E2E tests)
```

## Estimated Total Time

- Phase 1: ~2 hours (4 tasks)
- Phase 2: ~2 hours (4 tasks)
- Phase 3: ~2 hours (4 tasks)
- Phase 4: ~1.5 hours (3 tasks)
- Phase 5: ~1.5 hours (3 tasks)
- Phase 6: ~2.5 hours (5 tasks)
- Phase 7: ~2 hours (4 tasks)
- Phase 8: ~2.5 hours (5 tasks)

**Total: ~16 hours (33 tasks)**
