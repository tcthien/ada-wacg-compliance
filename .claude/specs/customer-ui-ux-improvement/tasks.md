# Customer UI/UX Improvement - Implementation Plan

## Task Overview

This implementation plan breaks down the UI/UX improvements into atomic, agent-friendly tasks. Tasks are organized by feature area and ordered by dependency. Each task touches 1-3 files and can be completed in 15-30 minutes.

## Steering Document Compliance

- All components follow structure.md conventions (components/ui/, components/features/, hooks/, lib/)
- TypeScript strict mode with proper interfaces
- TailwindCSS + shadcn/ui patterns
- Vitest for unit tests, Playwright for E2E

## Atomic Task Requirements

- **File Scope**: 1-3 related files per task
- **Time Boxing**: 15-30 minutes each
- **Single Purpose**: One testable outcome
- **Specific Files**: Exact paths provided
- **Agent-Friendly**: Clear inputs/outputs

---

## Phase 1: Shared UI Components

### 1.1 Skeleton Component

- [x] 1.1.1. Create base Skeleton component with shimmer animation
  - File: `apps/web/src/components/ui/skeleton.tsx`
  - Create Skeleton component with props: variant, width, height, animation
  - Add shimmer keyframe animation using Tailwind
  - Support 'pulse', 'wave', 'none' animation modes
  - Add reduced-motion media query support
  - _Requirements: 1.1, 1.2_

- [x] 1.1.2. Create skeleton variant components for common layouts
  - File: `apps/web/src/components/ui/skeleton.tsx` (extend)
  - Add IssueCardSkeleton matching IssueCard layout
  - Add HistoryItemSkeleton matching HistoryCard layout
  - Add BatchUrlSkeleton matching BatchUrlList item
  - Add ResultsSummarySkeleton matching 4-card grid
  - _Leverage: existing IssueCard.tsx, HistoryCard.tsx for layout reference_
  - _Requirements: 1.1_

- [x] 1.1.3. Create Skeleton component unit tests
  - File: `apps/web/src/components/ui/skeleton.test.tsx`
  - Test all variants render correctly
  - Test animation classes are applied
  - Test reduced-motion styles
  - _Requirements: 1.1_

### 1.2 Copy Button Component

- [x] 1.2.1. Create CopyButton component with clipboard API
  - File: `apps/web/src/components/ui/copy-button.tsx`
  - Implement copyToClipboard async function with try/catch
  - Create CopyButton with icon/button/inline variants
  - Add success state with configurable duration (default 2000ms)
  - Show "Copied!" tooltip on success
  - _Leverage: components/ui/button.tsx_
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 1.2.2. Create clipboard fallback modal for permission denied
  - File: `apps/web/src/components/ui/copy-button.tsx` (extend)
  - File: `apps/web/src/components/ui/copy-fallback-modal.tsx`
  - Detect SecurityError from clipboard API
  - Show modal with selectable text input
  - Add "Select All" button for easy selection
  - _Requirements: 7.5_

- [x] 1.2.3. Create CopyButton unit tests
  - File: `apps/web/src/components/ui/copy-button.test.tsx`
  - Mock clipboard API for success/failure
  - Test success feedback timing
  - Test fallback modal trigger
  - _Requirements: 7.1, 7.3, 7.5_

### 1.3 Step Indicator Component

- [x] 1.3.1. Create StepIndicator component for multi-step flows
  - File: `apps/web/src/components/ui/step-indicator.tsx`
  - Implement horizontal/vertical variants
  - Show completed (checkmark), current (highlighted), upcoming (muted) states
  - Support sm/md/lg sizes
  - Add keyboard navigation between steps
  - _Requirements: 4.1_

- [x] 1.3.2. Create StepIndicator unit tests
  - File: `apps/web/src/components/ui/step-indicator.test.tsx`
  - Test step rendering for all states
  - Test click handlers and navigation
  - Test keyboard accessibility (arrow keys)
  - _Requirements: 4.1_

### 1.4 Empty State Component

- [x] 1.4.1. Create EmptyState component with icon and CTA
  - File: `apps/web/src/components/ui/empty-state.tsx`
  - Accept icon, title, description, action props
  - Support primary/secondary action buttons
  - Use Lucide icons (FolderOpen, Search, CheckCircle, Globe)
  - Center content with appropriate spacing
  - _Requirements: 9.6, 10.4_

- [x] 1.4.2. Create predefined empty state configurations
  - File: `apps/web/src/components/ui/empty-state.tsx` (extend)
  - Add EmptyHistory config ("No scans yet")
  - Add EmptyIssues config ("No issues found!" - success)
  - Add EmptyDiscovery config ("Enter a URL")
  - Add EmptySearchResults config ("No results found")
  - _Requirements: 9.6_

### 1.5 Confirm Dialog Component

- [x] 1.5.1. Create ConfirmDialog component for destructive actions
  - File: `apps/web/src/components/ui/confirm-dialog.tsx`
  - Use Radix UI Dialog as base
  - Support danger/warning/default variants with appropriate colors
  - Add loading state for async confirmations
  - Implement focus trap and keyboard escape
  - _Leverage: existing Dialog patterns from Radix_
  - _Requirements: 9.5_

### 1.6 Selection Counter Component

- [x] 1.6.1. Create SelectionCounter for bulk selection display
  - File: `apps/web/src/components/ui/selection-counter.tsx`
  - Show "X of Y items selected" format
  - Add Clear Selection and Select All buttons
  - Support sticky positioning for mobile
  - Animate in/out based on selection count
  - _Requirements: 4.5, 9.5_

### 1.7 Share Button Component

- [x] 1.7.1. Create ShareButton component for scan results
  - File: `apps/web/src/components/ui/share-button.tsx`
  - Generate share URL: /scan/{id}?shared=true or /batch/{id}?shared=true
  - Use CopyButton internally for clipboard functionality
  - Support icon/button variants
  - Track share event with analytics
  - _Leverage: components/ui/copy-button.tsx_
  - _Requirements: 7.4_

---

## Phase 2: Error Handling Utilities

- [x] 2.1. Create error classification utility functions
  - File: `apps/web/src/lib/error-utils.ts`
  - Implement classifyError function (network, timeout, server, unknown)
  - Implement getErrorMessage function with title, description, action
  - Export ErrorType type definition
  - _Requirements: 2.1, 2.2_

- [x] 2.2. Create ErrorDisplay component for error UI
  - File: `apps/web/src/components/ui/error-display.tsx`
  - Accept title, description, actionLabel, onRetry props
  - Show error icon with appropriate color
  - Include optional "Show Details" for development
  - Announce error to screen readers with aria-live
  - _Requirements: 2.1, 2.2_

- [x] 2.3. Enhance existing ErrorBoundary with error utilities
  - File: `apps/web/src/components/ErrorBoundary.tsx` (modify)
  - Import classifyError and getErrorMessage from error-utils
  - Update render method to use ErrorDisplay component
  - Preserve existing analytics integration
  - _Leverage: existing ErrorBoundary.tsx_
  - _Requirements: 2.1, 2.2_

- [x] 2.4. Create error utilities unit tests
  - File: `apps/web/src/lib/error-utils.test.ts`
  - Test error classification for all types
  - Test message generation accuracy
  - Test edge cases (empty messages, unknown errors)
  - _Requirements: 2.1_

---

## Phase 3: Issue List Enhancements

### 3.1 Issue Filter Store

- [x] 3.1.1. Create Zustand store for issue list state
  - File: `apps/web/src/stores/issue-filter-store.ts`
  - Define IssueFilterStore interface
  - Implement expandedIssueIds as Set
  - Implement selectedSeverities array
  - Add actions: toggleExpand, expandAll, collapseAll, setSeverityFilter
  - _Requirements: 3.1, 3.4_

- [x] 3.1.2. Create issue filter store unit tests
  - File: `apps/web/src/stores/issue-filter-store.test.ts`
  - Test expand/collapse individual issues
  - Test expand all / collapse all
  - Test severity filter changes
  - Test resetFilters action
  - _Requirements: 3.1, 3.4_

### 3.2 Issue List Controls

- [x] 3.2.1. Create IssueListControls component with expand/collapse buttons
  - File: `apps/web/src/components/features/results/IssueListControls.tsx`
  - Add "Expand All" and "Collapse All" buttons
  - Show issue count by severity (e.g., "3 Critical, 5 Serious")
  - Add severity filter chips (toggle on/off)
  - Connect to issueFilterStore
  - _Requirements: 3.1, 3.3, 3.4_

- [x] 3.2.2. Add copy code button to IssueCard code snippets
  - File: `apps/web/src/components/features/results/IssueCard.tsx` (modify)
  - Add CopyButton to code snippet sections
  - Position button in top-right corner of code block
  - Track copy event with analytics
  - _Leverage: components/ui/copy-button.tsx_
  - _Requirements: 3.5_

### 3.3 Enhanced Issue List

- [x] 3.3.1. Enhance IssueList with controls and filtering
  - File: `apps/web/src/components/features/results/IssueList.tsx` (modify)
  - Add IssueListControls above issue cards
  - Filter issues based on issueFilterStore.selectedSeverities
  - Control expand state from issueFilterStore.expandedIssueIds
  - Show loading skeleton when isLoading
  - _Leverage: existing IssueList.tsx, IssueCard.tsx_
  - _Requirements: 3.1, 3.3, 3.4_

- [x] 3.3.2. Add scroll position preservation on issue expand
  - File: `apps/web/src/components/features/results/IssueList.tsx` (modify)
  - Store scroll position before expand
  - Restore scroll position after expand animation
  - Use useLayoutEffect for synchronous updates
  - _Requirements: 3.2_

- [x] 3.3.3. Install react-window dependency for virtualization
  - File: `apps/web/package.json` (modify)
  - Run: pnpm add react-window @types/react-window
  - Verify installation successful
  - _Requirements: Non-functional (Performance)_

- [x] 3.3.4. Create virtualized list wrapper component
  - File: `apps/web/src/components/ui/virtualized-list.tsx`
  - Create VirtualizedList wrapper around react-window FixedSizeList
  - Accept itemCount, itemSize, renderItem props
  - Add SSR fallback (render all items on server)
  - _Requirements: Non-functional (Performance)_

- [x] 3.3.5. Integrate virtualization with IssueList
  - File: `apps/web/src/components/features/results/IssueList.tsx` (modify)
  - Conditionally use VirtualizedList when issues > 50
  - Pass expand/collapse state to virtualized items
  - Ensure scroll position works with virtualization
  - _Leverage: components/ui/virtualized-list.tsx_
  - _Requirements: Non-functional (Performance)_

---

## Phase 4: Discovery Flow Enhancements

### 4.1 Discovery Store Enhancement

- [x] 4.1.1. Enhance discovery flow store with step tracking
  - File: `apps/web/src/stores/discovery-store.ts` (create or modify)
  - Add currentStep state (0-3)
  - Add stepHistory array for back navigation
  - Implement goToStep, goBack, canGoBack actions
  - Preserve selectedPages across step changes
  - _Leverage: existing sessionStorage usage_
  - _Requirements: 4.1, 4.2_

### 4.2 Discovery Page Updates

- [x] 4.2.1. Add StepIndicator to Discovery page
  - File: `apps/web/src/app/discovery/page.tsx` (modify)
  - Define discovery steps: ["Enter URL", "Select Mode", "Discovering", "Select Pages"]
  - Add StepIndicator at top of page
  - Connect currentStep from discovery store
  - Update on step changes
  - _Leverage: components/ui/step-indicator.tsx_
  - _Requirements: 4.1_

- [x] 4.2.2. Add SelectionCounter to Discovery results
  - File: `apps/web/src/components/features/discovery/DiscoveryResults.tsx` (modify)
  - Add SelectionCounter showing selected/total pages
  - Position sticky at bottom on mobile
  - Connect to selectedPages from discovery store
  - Add Clear Selection and Select All functionality
  - _Leverage: components/ui/selection-counter.tsx_
  - _Requirements: 4.5_

- [x] 4.2.3. Enhance cached results prompt with age display
  - File: `apps/web/src/components/features/discovery/CachedResultsPrompt.tsx` (modify)
  - Calculate and display cache age ("Discovered 2 hours ago")
  - Add "Refresh" button to re-run discovery
  - Improve visual distinction between cached and fresh results
  - _Requirements: 4.4_

- [x] 4.2.4. Add discovery summary before batch scan
  - File: `apps/web/src/components/features/discovery/DiscoveryResults.tsx` (modify)
  - Show summary card: "15 pages discovered, 5 selected"
  - Display before "Start Batch Scan" button
  - Include estimated scan time based on page count
  - _Requirements: 4.3_

---

## Phase 5: Batch Progress Enhancements

### 5.1 Batch Results Preview

- [x] 5.1.1. Create BatchResultsPreview component for partial results
  - File: `apps/web/src/components/features/batch/BatchResultsPreview.tsx`
  - Show completed scans as they finish
  - Display issue count and severity summary per URL
  - Add "View Details" link to individual scan results
  - Show progress: "5 of 12 complete"
  - _Requirements: 5.5_

- [x] 5.1.2. Create useBatchResults hook for partial results
  - File: `apps/web/src/hooks/useBatchResults.ts` (create or modify)
  - Fetch completed results from batch
  - Use React Query with polling interval
  - Filter by status=completed
  - Calculate aggregate statistics
  - _Requirements: 5.5_

### 5.2 Enhanced Batch Progress

- [x] 5.2.1. Add status grouping to BatchProgress
  - File: `apps/web/src/components/features/batch/BatchProgress.tsx` (modify)
  - Group URLs by status: Pending, Scanning, Completed, Failed
  - Use collapsible sections for each group
  - Show count badge for each group
  - Highlight Failed group with red styling
  - _Requirements: 5.1_

- [x] 5.2.2. Add aggregate statistics to BatchProgress
  - File: `apps/web/src/components/features/batch/BatchProgress.tsx` (modify)
  - Calculate total issues, average per page, worst performers
  - Display in summary card at top
  - Update in real-time as scans complete
  - Show severity breakdown chart
  - _Leverage: existing BatchSummary.tsx patterns_
  - _Requirements: 5.2_

- [x] 5.2.3. Add sorting controls to batch results
  - File: `apps/web/src/components/features/batch/BatchUrlList.tsx` (modify)
  - Add sort dropdown: by issue count, severity, URL
  - Persist sort preference in session
  - Apply sort to completed scans only
  - _Requirements: 5.3_

- [x] 5.2.4. Add inline failure reasons for failed URLs
  - File: `apps/web/src/components/features/batch/BatchUrlList.tsx` (modify)
  - Display failure reason next to failed URL
  - Use error-display patterns for consistency
  - Add retry button for individual failed URLs
  - _Requirements: 5.4_

---

## Phase 6: WCAG Level Selector

- [x] 6.1. Create WcagLevelSelector component with tooltips
  - File: `apps/web/src/components/features/scan/WcagLevelSelector.tsx`
  - Implement radio group with A, AA, AAA options
  - Add info icon with tooltip for each level
  - Include expandable "Learn more" section
  - Use WCAG_LEVEL_INFO content from design
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6.2. Integrate WcagLevelSelector into ScanForm
  - File: `apps/web/src/components/features/scan/ScanForm.tsx` (modify)
  - Replace existing WCAG level radio buttons
  - Pass value and onChange to WcagLevelSelector
  - Track help view with analytics
  - _Leverage: existing ScanForm.tsx_
  - _Requirements: 6.1_

- [ ] 6.3. Create WcagLevelSelector unit tests
  - File: `apps/web/src/components/features/scan/WcagLevelSelector.test.tsx`
  - Test all three level options render
  - Test tooltip content appears on hover/focus
  - Test expandable section toggle
  - Test keyboard accessibility
  - _Requirements: 6.1, 6.5_

---

## Phase 7: History Page Enhancements

### 7.1 History Filter Store

- [x] 7.1.1. Create Zustand store for history filters
  - File: `apps/web/src/stores/history-filter-store.ts`
  - Define HistoryFilterStore interface
  - Implement dateRange, scanTypes, searchQuery, sortBy, sortOrder
  - Add selectedIds Set for bulk selection
  - Implement all filter/sort/selection actions
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

### 7.2 History Filter Components

- [x] 7.2.1. Create HistoryFilters component
  - File: `apps/web/src/components/features/history/HistoryFilters.tsx`
  - Add date range picker (start/end date)
  - Add scan type filter chips (Single, Batch, Discovery)
  - Add search input with debounce
  - Connect to historyFilterStore
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 7.2.2. Create HistorySortControls component
  - File: `apps/web/src/components/features/history/HistorySortControls.tsx`
  - Add sort dropdown (date, issues, URL)
  - Add ascending/descending toggle
  - Connect to historyFilterStore
  - _Requirements: 9.4_

- [x] 7.2.3. Create HistoryBulkActions component
  - File: `apps/web/src/components/features/history/HistoryBulkActions.tsx`
  - Show when selectedIds.size > 0
  - Add "Delete Selected" button with confirm dialog
  - Add "Clear Selection" button
  - Show selection count
  - _Leverage: components/ui/confirm-dialog.tsx_
  - _Requirements: 9.5_

### 7.3 Enhanced History Page

- [x] 7.3.1. Add HistoryFilters to History page
  - File: `apps/web/src/app/history/page.tsx` (modify)
  - Import and add HistoryFilters component at top of page
  - Connect to historyFilterStore for filter state
  - Apply filters to history data query
  - _Leverage: components/features/history/HistoryFilters.tsx_
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 7.3.2. Add HistorySortControls to History page
  - File: `apps/web/src/app/history/page.tsx` (modify)
  - Import and add HistorySortControls next to filters
  - Connect to historyFilterStore for sort state
  - Apply sorting to history data
  - _Leverage: components/features/history/HistorySortControls.tsx_
  - _Requirements: 9.4_

- [x] 7.3.3. Add HistoryBulkActions to History page
  - File: `apps/web/src/app/history/page.tsx` (modify)
  - Import and add HistoryBulkActions component
  - Conditionally show when selectedIds.size > 0
  - Connect to historyFilterStore for selection state
  - _Leverage: components/features/history/HistoryBulkActions.tsx_
  - _Requirements: 9.5_

- [x] 7.3.4. Add selection checkboxes to HistoryCard
  - File: `apps/web/src/components/features/history/HistoryCard.tsx` (modify)
  - Add checkbox for bulk selection
  - Connect to historyFilterStore.selectedIds
  - Show selected state with highlight
  - _Requirements: 9.5_

- [x] 7.3.5. Add empty state to History page
  - File: `apps/web/src/app/history/page.tsx` (modify)
  - Show EmptyHistory when no scans exist
  - Show EmptySearchResults when filters return nothing
  - Include CTA to start first scan
  - _Leverage: components/ui/empty-state.tsx_
  - _Requirements: 9.6_

- [x] 7.3.6. Add loading skeleton to History page
  - File: `apps/web/src/app/history/page.tsx` (modify)
  - Show HistoryItemSkeleton while loading
  - Show 5 skeleton items
  - Use Suspense boundary or loading state
  - _Leverage: components/ui/skeleton.tsx_
  - _Requirements: 1.1_

---

## Phase 8: API Endpoints

- [ ] 8.1. Create bulk delete API endpoint
  - File: `apps/api/src/modules/scans/scan.controller.ts` (modify)
  - Add DELETE /api/v1/scans/bulk route
  - Accept { scanIds: string[] } body
  - Validate user owns all scans
  - Return { deleted: number, failed: [] }
  - _Requirements: 9.5_

- [ ] 8.2. Create bulk delete service method
  - File: `apps/api/src/modules/scans/scan.service.ts` (modify)
  - Implement bulkDelete method
  - Delete scans in transaction
  - Handle partial failures gracefully
  - _Requirements: 9.5_

- [ ] 8.3. Create bulk delete API tests
  - File: `apps/api/src/modules/scans/scan.controller.test.ts` (modify)
  - Test successful bulk delete
  - Test partial failure handling
  - Test authorization (user owns scans)
  - _Requirements: 9.5_

- [ ] 8.4. Create batch partial results API endpoint
  - File: `apps/api/src/modules/batches/batch.controller.ts` (modify)
  - Add GET /api/v1/batches/:id/results?status=completed
  - Return completed scans with issue summaries
  - Include aggregate statistics
  - _Requirements: 5.5_

---

## Phase 9: Analytics Integration

- [x] 9.1. Add UI/UX analytics event constants
  - File: `apps/web/src/lib/analytics.constants.ts` (modify)
  - Add UI_UX_EVENTS object with all new events
  - Include issue, clipboard, discovery, batch, history events
  - Export for use in components
  - _Design: Analytics Integration section_

- [x] 9.2. Add analytics tracking to Issue components
  - File: `apps/web/src/components/features/results/IssueList.tsx` (modify)
  - File: `apps/web/src/components/features/results/IssueCard.tsx` (modify)
  - Track expand/collapse individual and all
  - Track filter changes
  - Track code copy
  - _Leverage: hooks/useAnalytics.ts_
  - _Design: Analytics Integration section_

- [x] 9.3. Add analytics tracking to Discovery flow
  - File: `apps/web/src/app/discovery/page.tsx` (modify)
  - File: `apps/web/src/components/features/discovery/DiscoveryResults.tsx` (modify)
  - Track step changes
  - Track page select/deselect
  - _Design: Analytics Integration section_

- [x] 9.4. Add analytics tracking to History page
  - File: `apps/web/src/app/history/page.tsx` (modify)
  - Track filter changes
  - Track sort changes
  - Track bulk select/delete
  - _Design: Analytics Integration section_

---

## Phase 10: Mobile Optimizations

- [x] 10.1. Update form inputs with mobile-appropriate types
  - File: `apps/web/src/components/features/scan/ScanForm.tsx` (modify)
  - Add inputMode="url" to URL input
  - Add inputMode="email" to email input
  - Add autoCapitalize="none", autoCorrect="off"
  - _Requirements: 8.4_

- [x] 10.2. Audit and fix touch target sizes
  - File: `apps/web/src/components/ui/button.tsx` (modify)
  - Ensure minimum 44x44px for all button sizes
  - Add touch-target utility class
  - Apply to icon buttons and small actions
  - _Requirements: 8.1_

- [x] 10.3. Add responsive code snippet handling
  - File: `apps/web/src/components/features/results/IssueCard.tsx` (modify)
  - Add horizontal scroll with visual indicator
  - Add gradient fade on right edge for mobile
  - Hide gradient on desktop
  - _Requirements: 8.3_

- [x] 10.4. Make BatchUrlList mobile-friendly
  - File: `apps/web/src/components/features/batch/BatchUrlList.tsx` (modify)
  - Collapse URL details by default on mobile
  - Add tap-to-expand interaction
  - Use full-width cards with adequate spacing
  - _Requirements: 8.5_

- [x] 10.5. Add collapsible filters for mobile History
  - File: `apps/web/src/components/features/history/HistoryFilters.tsx` (modify)
  - Wrap filters in collapsible section on mobile
  - Show "Filters" button with active filter count
  - Expand to full-width filter form
  - _Design: Responsive Breakpoints table_

---

## Phase 11: Visual Consistency

- [x] 11.1. Create centralized severity color constants
  - File: `apps/web/src/lib/severity-colors.ts`
  - Export SEVERITY_COLORS object from design
  - Include bg, text, border, icon variants
  - Support dark mode classes
  - _Requirements: 10.1_

- [x] 11.2. Create centralized status color constants
  - File: `apps/web/src/lib/status-colors.ts`
  - Export STATUS_COLORS object from design
  - Include pending, scanning, completed, failed
  - Support dark mode classes
  - _Requirements: 10.2_

- [x] 11.3. Update IssueCard to use severity color constants
  - File: `apps/web/src/components/features/results/IssueCard.tsx` (modify)
  - Import SEVERITY_COLORS from lib/severity-colors
  - Replace hardcoded severity color classes
  - Verify dark mode support works correctly
  - _Leverage: lib/severity-colors.ts_
  - _Requirements: 10.1_

- [x] 11.4. Update BatchUrlList to use status color constants
  - File: `apps/web/src/components/features/batch/BatchUrlList.tsx` (modify)
  - Import STATUS_COLORS from lib/status-colors
  - Replace hardcoded status color classes
  - Verify dark mode support works correctly
  - _Leverage: lib/status-colors.ts_
  - _Requirements: 10.2_

- [x] 11.5. Update Badge component to use color constants
  - File: `apps/web/src/components/ui/badge.tsx` (modify)
  - Import SEVERITY_COLORS and STATUS_COLORS
  - Add severity and status badge variants
  - Ensure consistent styling across badge usages
  - _Leverage: lib/severity-colors.ts, lib/status-colors.ts_
  - _Requirements: 10.1, 10.2_

- [x] 11.6. Add loading spinner to buttons with loading state
  - File: `apps/web/src/components/ui/button.tsx` (modify)
  - Add spinner inside button when loading=true
  - Maintain button width during loading
  - Disable pointer events during loading
  - _Requirements: 10.3_

---

## Phase 12: Integration & Polish

- [x] 12.1. Add ShareButton to scan results page
  - File: `apps/web/src/app/scan/[id]/page.tsx` (modify)
  - Add ShareButton next to Export button in header
  - Pass scanId and scanType="single"
  - _Leverage: components/ui/share-button.tsx_
  - _Requirements: 7.4_

- [x] 12.2. Add ShareButton to batch results page
  - File: `apps/web/src/app/batch/[id]/page.tsx` (modify)
  - Add ShareButton next to Export button in header
  - Pass batchId and scanType="batch"
  - _Requirements: 7.4_

- [x] 12.3. Add CopyButton to discovered URLs
  - File: `apps/web/src/components/features/discovery/PageTreeNode.tsx` (modify)
  - Add small CopyButton next to each URL
  - Use icon-only variant
  - _Leverage: components/ui/copy-button.tsx_
  - _Requirements: 7.1_

- [x] 12.4. Add contextual loading messages
  - File: `apps/web/src/components/features/scan/ScanProgress.tsx` (modify)
  - Replace generic "Loading..." with contextual messages
  - Use messages: "Connecting...", "Analyzing page...", "Generating report..."
  - Rotate messages based on scan stage
  - _Requirements: 1.2_

---

## Phase 13: Testing

- [x] 13.1. Create E2E test for issue expand/collapse flow
  - File: `apps/web/e2e/issue-interactions.spec.ts`
  - Test expand all / collapse all buttons
  - Test individual issue expand
  - Test severity filter application
  - Test scroll position preservation
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 13.2. Create E2E test for discovery step flow
  - File: `apps/web/e2e/discovery-steps.spec.ts`
  - Test step indicator updates
  - Test back navigation preserves state
  - Test selection counter updates
  - _Requirements: 4.1, 4.2, 4.5_

- [x] 13.3. Create E2E test for history management
  - File: `apps/web/e2e/history-management.spec.ts`
  - Test filter application
  - Test sort functionality
  - Test bulk selection and delete
  - Test empty states
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 13.4. Create E2E test for mobile responsiveness
  - File: `apps/web/e2e/mobile-ux.spec.ts`
  - Test touch target sizes (44px minimum)
  - Test collapsible filters on mobile
  - Test code snippet horizontal scroll
  - Run in mobile viewport
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 13.5. Create accessibility audit test
  - File: `apps/web/e2e/accessibility-audit.spec.ts`
  - Run axe-core on enhanced pages
  - Test keyboard navigation through new components
  - Test ARIA live region announcements
  - Test focus management in modals
  - _Requirements: Non-functional (Accessibility)_

---

## Task Summary

| Phase | Tasks | Files Affected |
|-------|-------|----------------|
| 1. Shared UI Components | 12 | 8 new, 0 modified |
| 2. Error Handling | 4 | 3 new, 1 modified |
| 3. Issue List | 9 | 2 new, 2 modified |
| 4. Discovery Flow | 5 | 1 new, 3 modified |
| 5. Batch Progress | 6 | 1 new, 2 modified |
| 6. WCAG Selector | 3 | 1 new, 1 modified |
| 7. History Page | 10 | 4 new, 2 modified |
| 8. API Endpoints | 4 | 0 new, 3 modified |
| 9. Analytics | 4 | 0 new, 5 modified |
| 10. Mobile | 5 | 0 new, 5 modified |
| 11. Visual Consistency | 6 | 2 new, 3 modified |
| 12. Integration | 4 | 0 new, 5 modified |
| 13. Testing | 5 | 5 new, 0 modified |
| **Total** | **77** | **27 new, 32 modified** |

---

*Version: 1.0*
*Created: January 2026*
