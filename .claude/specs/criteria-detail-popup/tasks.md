# Implementation Plan: Criteria Detail Popup

## Task Overview

This plan implements the criteria detail popup feature in 6 atomic tasks. The approach is:
1. Create the new `CriteriaDetailDialog` component
2. Modify `CriteriaTable` to manage dialog state and row clicks
3. Export the new component
4. Add tests

**Approach:** Minimal changes - create one new component, modify one existing component, add tests.

## Steering Document Compliance

- **structure.md:** New component in `apps/web/src/components/features/compliance/`
- **tech.md:** React functional component with hooks, TypeScript interfaces, Radix UI Dialog

## Atomic Task Requirements

Each task in this plan meets these criteria:
- **File Scope:** 1-2 files per task
- **Time Boxing:** 15-30 minutes per task
- **Single Purpose:** One testable outcome
- **Specific Files:** Exact paths provided
- **Agent-Friendly:** Clear implementation details with code patterns

## Tasks

### Task 1: Create CriteriaDetailDialog Component

- **File:** `apps/web/src/components/features/compliance/CriteriaDetailDialog.tsx`
- **Purpose:** Create the dialog component that displays criterion details

#### Implementation Details
1. Create new file `CriteriaDetailDialog.tsx`
2. Import Dialog components from `@/components/ui/dialog`
3. Import Badge from `@/components/ui/badge`
4. Import Button from `@/components/ui/button`
5. Import WCAG_CRITERIA from `@/lib/wcag-constants`
6. Import types: CriteriaVerification, CriteriaStatus from local file or define
7. Define `CriteriaDetailDialogProps` interface:
   ```typescript
   interface CriteriaDetailDialogProps {
     open: boolean;
     onClose: () => void;
     criterion: EnrichedVerification | null;
     aiModel?: string;
     onViewIssues?: (criterionId: string) => void;
   }
   ```
8. Implement component with sections:
   - Header: Criterion ID + Title + Level badge
   - Description section
   - Status section with badge (reuse getStatusBadge pattern)
   - Scanner info
   - AI confidence bar (if AI verified)
   - AI reasoning (if available)
   - "View Issues" button (if failed with issues)

#### Acceptance Criteria
- [ ] Component renders criterion ID, title, level, description
- [ ] Status badge displays correctly for all 5 statuses
- [ ] Scanner source displays
- [ ] AI confidence and reasoning show when available
- [ ] "View Issues" button appears only for FAIL/AI_VERIFIED_FAIL with issues
- [ ] Dialog closes via X button, Escape, or overlay click

_Leverage: `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/ui/badge.tsx`, `apps/web/src/components/ui/button.tsx`, `apps/web/src/lib/wcag-constants.ts`_

_Requirements: R1.4, R2.1-R2.5, R3.1-R3.5, R4.1_

---

### Task 2: Modify CriteriaTable State and Row Handler

- **File:** `apps/web/src/components/features/compliance/CriteriaTable.tsx`
- **Purpose:** Add dialog state management and make all rows clickable

#### Implementation Details
1. Import `CriteriaDetailDialog` from `./CriteriaDetailDialog`
2. Add state for selected criterion:
   ```typescript
   const [selectedCriterion, setSelectedCriterion] = useState<
     (typeof enrichedVerifications)[number] | null
   >(null);
   ```
3. Modify `handleRowClick` to open dialog for ANY row (remove status restriction):
   ```typescript
   const handleRowClick = (verification: (typeof enrichedVerifications)[number]) => {
     setSelectedCriterion(verification);
   };
   ```
4. Add new handler for "View Issues" from dialog:
   ```typescript
   const handleViewIssues = (criterionId: string) => {
     setSelectedCriterion(null); // Close dialog first
     onCriterionClick?.(criterionId); // Then navigate
   };
   ```
5. Remove the `isClickable` function restriction - all rows should be clickable
6. Update TableRow className to always show cursor-pointer and hover state

#### Acceptance Criteria
- [ ] State `selectedCriterion` added to component
- [ ] All rows are clickable (not just failed ones)
- [ ] Clicking any row sets selectedCriterion
- [ ] handleViewIssues closes dialog then calls onCriterionClick

_Leverage: existing `handleRowClick`, `enrichedVerifications` in `CriteriaTable.tsx`_

_Requirements: R1.1, R1.2, R4.2_

---

### Task 3: Render CriteriaDetailDialog in CriteriaTable

- **File:** `apps/web/src/components/features/compliance/CriteriaTable.tsx`
- **Purpose:** Add dialog component rendering with proper props

#### Implementation Details
1. Add dialog rendering at the end of the component return, before the closing `</div>`:
   ```typescript
   <CriteriaDetailDialog
     open={selectedCriterion !== null}
     onClose={() => setSelectedCriterion(null)}
     criterion={selectedCriterion}
     aiModel={aiModel}
     onViewIssues={onCriterionClick ? handleViewIssues : undefined}
   />
   ```
2. Ensure dialog receives the enriched verification (with title, description, level)
3. Only pass onViewIssues if onCriterionClick prop exists

#### Acceptance Criteria
- [ ] CriteriaDetailDialog rendered inside CriteriaTable
- [ ] Dialog opens when selectedCriterion is set
- [ ] Dialog closes when onClose is called
- [ ] aiModel prop passed through
- [ ] onViewIssues only provided when onCriterionClick exists

_Leverage: Task 1 component, Task 2 state_

_Requirements: R1.1, R1.4_

---

### Task 4: Export CriteriaDetailDialog from Index

- **File:** `apps/web/src/components/features/compliance/index.ts`
- **Purpose:** Export new component for external use

#### Implementation Details
1. Add export statement:
   ```typescript
   export { CriteriaDetailDialog } from './CriteriaDetailDialog';
   export type { CriteriaDetailDialogProps } from './CriteriaDetailDialog';
   ```

#### Acceptance Criteria
- [ ] CriteriaDetailDialog exported from barrel file
- [ ] CriteriaDetailDialogProps type exported

_Leverage: existing export pattern in `index.ts`_

_Requirements: NFR Maintainability_

---

### Task 5: Add Unit Tests for CriteriaDetailDialog

- **File:** `apps/web/src/components/features/compliance/CriteriaDetailDialog.test.tsx`
- **Purpose:** Test the dialog component in isolation

#### Implementation Details
1. Create test file with Vitest/Jest setup
2. Import component and test utilities
3. Write test cases:
   ```typescript
   describe('CriteriaDetailDialog', () => {
     it('renders criterion ID and title', () => {});
     it('renders WCAG level badge', () => {});
     it('renders criterion description', () => {});
     it('renders status badge with correct styling for PASS', () => {});
     it('renders status badge with correct styling for FAIL', () => {});
     it('renders status badge with correct styling for AI_VERIFIED_PASS', () => {});
     it('renders status badge with correct styling for NOT_TESTED', () => {});
     it('displays scanner source', () => {});
     it('shows AI confidence when available', () => {});
     it('shows AI reasoning when available', () => {});
     it('shows View Issues button for FAIL status with issues', () => {});
     it('hides View Issues button for PASS status', () => {});
     it('calls onViewIssues when button clicked', () => {});
     it('calls onClose when dialog closes', () => {});
     it('handles missing WCAG criterion data gracefully', () => {});
   });
   ```

#### Acceptance Criteria
- [ ] All test cases written and passing
- [ ] Tests cover all status types
- [ ] Tests verify callback invocations
- [ ] Tests verify graceful handling of missing data

_Leverage: existing test patterns in `CriteriaTable.test.tsx`_

_Requirements: R2.5, R3.1-R3.5, R4.1_

---

### Task 6: Add E2E Test for Criteria Detail Popup

- **File:** `apps/web/e2e/criteria-detail-popup.spec.ts`
- **Purpose:** Test the complete user flow with Playwright

#### Implementation Details
1. Create new E2E test file
2. Write test scenarios:
   ```typescript
   import { test, expect } from '@playwright/test';

   test.describe('Criteria Detail Popup', () => {
     test('opens popup when clicking on PASS criterion', async ({ page }) => {
       // Navigate to scan result with coverage tab
       // Click on a PASS criterion row
       // Verify dialog opens with correct content
     });

     test('opens popup when clicking on FAIL criterion', async ({ page }) => {
       // Click on a FAIL criterion row
       // Verify dialog shows issue count
       // Verify "View Issues" button is present
     });

     test('navigates to issues tab when clicking View Issues', async ({ page }) => {
       // Open dialog for failed criterion
       // Click "View Issues" button
       // Verify navigation to issues tab with filter
     });

     test('closes popup with Escape key', async ({ page }) => {
       // Open dialog
       // Press Escape
       // Verify dialog closes
     });

     test('closes popup by clicking overlay', async ({ page }) => {
       // Open dialog
       // Click outside dialog
       // Verify dialog closes
     });

     test('displays AI reasoning for AI-verified criteria', async ({ page }) => {
       // Navigate to scan with AI verification
       // Click on AI_VERIFIED_PASS criterion
       // Verify AI confidence and reasoning displayed
     });
   });
   ```

#### Acceptance Criteria
- [ ] E2E tests written for all major user flows
- [ ] Tests verify dialog open/close behavior
- [ ] Tests verify navigation to issues
- [ ] Tests verify keyboard accessibility (Escape)

_Leverage: existing E2E patterns in `apps/web/e2e/`_

_Requirements: R1.1-R1.4, R4.2, NFR Accessibility_

---

## Completion Checklist

- [x] Task 1: CriteriaDetailDialog component created
- [x] Task 2: CriteriaTable state and handlers modified
- [x] Task 3: Dialog rendered in CriteriaTable
- [x] Task 4: Component exported from index
- [x] Task 5: Unit tests added and passing
- [x] Task 6: E2E tests added and passing

## Notes

- **No API changes required:** All data already available in CriteriaVerification
- **No database changes required:** Frontend-only feature
- **Reuses existing UI components:** Dialog, Badge, Button from shadcn/ui
- **Backward compatible:** Existing onCriterionClick behavior preserved for failed criteria
