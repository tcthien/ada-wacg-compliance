# Implementation Plan: History & Scan Navigation UX Improvement

## Task Overview

This implementation creates a unified navigation system for all public-facing pages. The approach follows a bottom-up strategy: first creating foundational components (config, utilities), then individual navigation components, then the unified layout, and finally migrating each page. This ensures each component is testable in isolation before integration.

## Steering Document Compliance

- **structure.md**: All new components follow `apps/web/src/components/` conventions
- **tech.md**: React 18, Next.js 14, TypeScript strict mode, TailwindCSS, shadcn/ui patterns

## Atomic Task Requirements

**Each task meets these criteria:**
- **File Scope**: 1-3 related files maximum
- **Time Boxing**: 15-30 minutes per task
- **Single Purpose**: One testable outcome
- **Specific Files**: Exact paths provided
- **Agent-Friendly**: Clear input/output

---

## Phase 1: Foundation (Config & Utilities)

- [x] 1. Create navigation configuration file
  - **File**: `apps/web/src/lib/navigation-config.ts`
  - Define `NavItem` interface with label, href, optional icon
  - Define `BreadcrumbItem` interface with label, optional href
  - Create `navigationConfig` object with mainNav items (Home, History, Settings)
  - Create `breadcrumbTemplates` record for route patterns
  - Export all types and config
  - **Purpose**: Centralized navigation configuration for all components
  - _Leverage: None (new file)_
  - _Requirements: 1.1, 3.1, 6.2_

- [x] 2. Create useNavigationProgress hook
  - **File**: `apps/web/src/hooks/useNavigationProgress.ts`
  - Import `useRouter` and `usePathname` from `next/navigation`
  - Create state for `isNavigating` with 200ms threshold timer
  - Listen to pathname changes to detect navigation start/end
  - Return `{ isNavigating, startNavigation, endNavigation }`
  - **Purpose**: Track navigation state for progress indicator
  - _Leverage: `apps/web/src/hooks/useScan.ts` (hook patterns)_
  - _Requirements: 9.1, 9.2, 9.3_

---

## Phase 2: Core Navigation Components

- [x] 3. Create SkipLink component
  - **File**: `apps/web/src/components/navigation/SkipLink.tsx`
  - Create component with `targetId` prop (default: "main-content")
  - Style with `sr-only focus:not-sr-only` pattern for visibility on focus
  - Add focus styles: `focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:ring-2`
  - Handle click to focus target element
  - **Purpose**: Accessibility skip link for keyboard users (WCAG requirement)
  - _Leverage: None (new component, follows WCAG patterns)_
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 4. Create HeaderNav component
  - **File**: `apps/web/src/components/navigation/HeaderNav.tsx`
  - Import `NavItem` from navigation-config
  - Import `Link` from `next/link` and `usePathname` from `next/navigation`
  - Create `HeaderNavProps` interface with optional `items` array and `className`
  - Map nav items to `Link` components with proper styling
  - Add active state detection using pathname matching
  - Add `aria-current="page"` for active link
  - Style: `text-sm text-muted-foreground hover:text-foreground transition-colors`
  - **Purpose**: Desktop header navigation links
  - _Leverage: `apps/web/src/components/admin/AdminSidebar.tsx` (active state pattern lines 15-20)_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5. Create Breadcrumbs component
  - **File**: `apps/web/src/components/navigation/Breadcrumbs.tsx`
  - Create `BreadcrumbsProps` interface with items array, optional separator, optional maxLabelLength
  - Import `Link` from `next/link` and `cn` from utils
  - Render `<nav aria-label="Breadcrumb">` with `<ol role="list">`
  - Map items to `<li>` elements with separators (default: ">")
  - Render clickable items as `Link`, current page as `<span aria-current="page">`
  - Add truncation for long labels using CSS `truncate` class
  - Style: breadcrumbs smaller text, separators muted
  - **Purpose**: Hierarchical page navigation
  - _Leverage: `apps/web/src/lib/utils.ts` (cn utility)_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Create BackButton component
  - **File**: `apps/web/src/components/navigation/BackButton.tsx`
  - Import `useRouter` from `next/navigation`
  - Import `ArrowLeft` from `lucide-react`
  - Import `Button` from `@/components/ui/button`
  - Import `Tooltip` from `@/components/ui/tooltip` (or create inline tooltip if not exists)
  - Create props: `href?: string`, `label?: string`, `useBrowserBack?: boolean`
  - Default href to `/history`, default label to "Back to History"
  - Handle click: use `router.back()` if useBrowserBack, else `router.push(href)`
  - Wrap button in Tooltip with label
  - Style: icon button with hover state
  - **Purpose**: Consistent back navigation for detail pages
  - _Leverage: `apps/web/src/components/admin/BatchDetailHeader.tsx` (back button pattern)_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Create MobileNav component
  - **File**: `apps/web/src/components/navigation/MobileNav.tsx`
  - Import `useState` from React
  - Import `Menu`, `X` from `lucide-react`
  - Import `Link` from `next/link`, `usePathname` from `next/navigation`
  - Create hamburger button with `aria-expanded`, `aria-controls`, `aria-label`
  - Create drawer overlay with `role="dialog"`, `aria-modal="true"`
  - Map nav items with active state detection
  - Handle ESC key to close drawer
  - Handle click-outside to close drawer
  - Close drawer on navigation
  - Ensure 44x44px touch targets
  - **Purpose**: Mobile-friendly navigation drawer
  - _Leverage: `apps/web/src/components/admin/AdminSidebar.tsx` (nav item patterns)_
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Create NavigationProgress component
  - **File**: `apps/web/src/components/navigation/NavigationProgress.tsx`
  - Import `useNavigationProgress` hook
  - Create thin progress bar at top of viewport
  - Show only when `isNavigating` is true
  - Use CSS animation for indeterminate progress
  - Add `prefers-reduced-motion` support
  - Style: fixed position, blue gradient, 2px height
  - **Purpose**: Visual feedback during page transitions
  - _Leverage: `apps/web/src/components/ui/progress.tsx` (if exists)_
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 9. Create navigation components barrel export
  - **File**: `apps/web/src/components/navigation/index.ts`
  - Export all components: SkipLink, HeaderNav, Breadcrumbs, BackButton, MobileNav, NavigationProgress
  - Export types from navigation-config
  - **Purpose**: Clean import paths for navigation components
  - _Leverage: `apps/web/src/components/features/history/index.ts` (barrel pattern)_
  - _Requirements: 6.2_

---

## Phase 3: PublicLayout Component

- [x] 10. Create PublicLayout component - structure
  - **File**: `apps/web/src/components/layouts/PublicLayout.tsx`
  - Define `PublicLayoutProps` interface with all props from design
  - Import all navigation components from `@/components/navigation`
  - Create basic layout structure: SkipLink, header, main, footer
  - Add `id="main-content"` to main element
  - Add `role="main"` to main element
  - Pass children to main content area
  - **Purpose**: Unified layout wrapper structure
  - _Leverage: `apps/web/src/components/layouts/MainLayout.tsx` (basic structure)_
  - _Requirements: 6.1, 6.2_

- [x] 11. Add PublicLayout header section
  - **File**: `apps/web/src/components/layouts/PublicLayout.tsx` (modify)
  - Add sticky header with `position: sticky` and `top: 0`
  - Add logo link to home (/)
  - Conditionally render HeaderNav on desktop (hidden on mobile)
  - Conditionally render MobileNav toggle on mobile
  - Add NavigationProgress at top of header
  - Style header: white background, border-bottom, z-index for sticky
  - **Purpose**: Complete header with desktop/mobile navigation
  - _Leverage: `apps/web/src/app/page.tsx` (header styling lines 78-98)_
  - _Requirements: 1.1, 5.5, 7.1_

- [x] 12. Add PublicLayout secondary header bar
  - **File**: `apps/web/src/components/layouts/PublicLayout.tsx` (modify)
  - Create secondary bar below main header
  - Conditionally render BackButton if `showBackButton` prop is true
  - Conditionally render Breadcrumbs if `breadcrumbs` prop is provided
  - Render `headerActions` slot on the right side
  - Add proper spacing and alignment
  - **Purpose**: Breadcrumbs, back button, and actions bar
  - _Leverage: Design document UI specifications_
  - _Requirements: 2.1, 3.1, 4.1, 5.1, 5.2_

- [x] 13. Add PublicLayout footer section
  - **File**: `apps/web/src/components/layouts/PublicLayout.tsx` (modify)
  - Add footer with copyright and links
  - Include Privacy Policy and Settings links
  - Match existing HomePage footer styling
  - Ensure footer stays at bottom (flex layout)
  - **Purpose**: Consistent footer across all pages
  - _Leverage: `apps/web/src/app/page.tsx` (footer lines 347-364)_
  - _Requirements: 6.2_

- [x] 14. Update layouts barrel export
  - **File**: `apps/web/src/components/layouts/index.ts`
  - Add export for PublicLayout
  - Keep MainLayout export (for backward compatibility)
  - Add deprecation comment on MainLayout
  - **Purpose**: Clean exports for layout components
  - _Leverage: Existing index.ts pattern_
  - _Requirements: 6.2_

---

## Phase 4: Component Tests

- [x] 15. Create SkipLink unit tests
  - **File**: `apps/web/src/components/navigation/__tests__/SkipLink.test.tsx`
  - Test: renders with default targetId
  - Test: renders with custom targetId
  - Test: visible when focused (accessibility)
  - Test: clicking focuses target element
  - Test: has correct accessibility attributes
  - **Purpose**: Ensure SkipLink accessibility compliance
  - _Leverage: `apps/web/src/components/ui/step-indicator.test.tsx` (test patterns)_
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 16. Create HeaderNav unit tests
  - **File**: `apps/web/src/components/navigation/__tests__/HeaderNav.test.tsx`
  - Test: renders all navigation items
  - Test: applies active state to current route
  - Test: links navigate to correct destinations
  - Test: has aria-current on active link
  - Test: accepts custom className
  - **Purpose**: Ensure HeaderNav renders correctly with active states
  - _Leverage: Testing patterns from existing tests_
  - _Requirements: 1.1, 1.5_

- [x] 17. Create Breadcrumbs unit tests
  - **File**: `apps/web/src/components/navigation/__tests__/Breadcrumbs.test.tsx`
  - Test: renders all breadcrumb items
  - Test: last item is not a link (aria-current="page")
  - Test: middle items are clickable links
  - Test: custom separator renders correctly
  - Test: long labels are truncated
  - Test: has proper nav landmark with aria-label
  - **Purpose**: Ensure Breadcrumbs navigation and accessibility
  - _Leverage: Testing patterns from existing tests_
  - _Requirements: 3.5, 3.6_

- [x] 18. Create BackButton unit tests
  - **File**: `apps/web/src/components/navigation/__tests__/BackButton.test.tsx`
  - Test: renders with default href (/history)
  - Test: renders with custom href
  - Test: shows tooltip on hover
  - Test: calls router.push when clicked
  - Test: calls router.back when useBrowserBack is true
  - **Purpose**: Ensure BackButton navigates correctly
  - _Leverage: Testing patterns from existing tests_
  - _Requirements: 2.3, 2.4_

- [x] 19. Create MobileNav unit tests
  - **File**: `apps/web/src/components/navigation/__tests__/MobileNav.test.tsx`
  - Test: hamburger button toggles drawer
  - Test: drawer has correct ARIA attributes
  - Test: ESC key closes drawer
  - Test: clicking link closes drawer and navigates
  - Test: active state shown for current route
  - **Purpose**: Ensure MobileNav accessibility and behavior
  - _Leverage: Testing patterns from existing tests_
  - _Requirements: 7.2, 7.3_

- [x] 20. Create PublicLayout integration tests
  - **File**: `apps/web/src/components/layouts/__tests__/PublicLayout.test.tsx`
  - Test: renders children in main content area
  - Test: SkipLink is first focusable element
  - Test: breadcrumbs render when prop provided
  - Test: back button renders when showBackButton is true
  - Test: headerActions slot renders custom content
  - Test: has correct landmark roles
  - **Purpose**: Ensure PublicLayout integrates components correctly
  - _Leverage: Testing patterns from existing tests_
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

---

## Phase 5: Page Migrations

- [x] 21. Migrate History page to PublicLayout
  - **File**: `apps/web/src/app/history/page.tsx`
  - Replace `MainLayout` import with `PublicLayout`
  - Add breadcrumbs prop: `[{ label: 'Home', href: '/' }, { label: 'History' }]`
  - Add headerActions with "New Scan" button linking to `/`
  - Add "Discover Pages" button linking to `/discovery`
  - Remove old layout wrapper
  - **Purpose**: First page migration to validate PublicLayout
  - _Leverage: `apps/web/src/app/history/page.tsx` (current structure)_
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 22. Migrate Discovery page to PublicLayout
  - **File**: `apps/web/src/app/discovery/page.tsx`
  - Import `PublicLayout`
  - Add breadcrumbs: `[{ label: 'Home', href: '/' }, { label: 'Discover Pages' }]`
  - Remove inline header navigation
  - Keep existing discovery flow content
  - **Purpose**: Migrate discovery page for consistent navigation
  - _Leverage: `apps/web/src/app/discovery/page.tsx` (current structure)_
  - _Requirements: 3.4, 6.1_

- [x] 23. Migrate Scan Detail page to PublicLayout
  - **File**: `apps/web/src/app/scan/[id]/page.tsx`
  - Import `PublicLayout`
  - Add breadcrumbs: `[{ label: 'Home', href: '/' }, { label: 'History', href: '/history' }, { label: 'Scan Results' }]`
  - Add `showBackButton={true}` prop
  - Move Export and Share buttons to `headerActions` slot
  - Remove inline header if present
  - Keep scan result content
  - **Purpose**: Add consistent navigation to scan detail page
  - _Leverage: `apps/web/src/app/scan/[id]/page.tsx` (current structure)_
  - _Requirements: 2.1, 3.1, 5.1, 5.3, 5.4_

- [x] 24. Migrate Batch Detail page to PublicLayout
  - **File**: `apps/web/src/app/batch/[id]/page.tsx`
  - Import `PublicLayout`
  - Add breadcrumbs: `[{ label: 'Home', href: '/' }, { label: 'History', href: '/history' }, { label: 'Batch Results' }]`
  - Add `showBackButton={true}` prop
  - Move Export button to `headerActions` slot
  - Remove inline header if present
  - Keep batch result content
  - **Purpose**: Add consistent navigation to batch detail page
  - _Leverage: `apps/web/src/app/batch/[id]/page.tsx` (current structure)_
  - _Requirements: 2.2, 3.2, 5.2_

- [x] 25. Update HomePage with PublicLayout header pattern
  - **File**: `apps/web/src/app/page.tsx`
  - Keep hero section and unique homepage content
  - Replace inline header with imported HeaderNav and MobileNav components
  - Add SkipLink as first element
  - Keep existing footer or use PublicLayout footer pattern
  - Ensure homepage retains unique visual identity while getting consistent nav
  - **Purpose**: Consistent navigation on homepage without full PublicLayout wrapper
  - _Leverage: `apps/web/src/app/page.tsx` (current structure)_
  - _Requirements: 1.1, 7.1, 8.1_

---

## Phase 6: E2E Tests

- [x] 26. Create desktop navigation E2E test
  - **File**: `apps/web/e2e/navigation-desktop.spec.ts`
  - Test: Navigate Home → History using header link
  - Test: Navigate History → Scan Detail by clicking scan
  - Test: Back button returns to History
  - Test: Breadcrumb navigation works
  - Test: Active state shown for current page
  - Test: Logo navigates to home
  - **Purpose**: Verify desktop navigation flow
  - _Leverage: `apps/web/e2e/history-management.spec.ts` (E2E patterns)_
  - _Requirements: 1.1, 2.3, 3.5_

- [x] 27. Create mobile navigation E2E test
  - **File**: `apps/web/e2e/navigation-mobile.spec.ts`
  - Set viewport to 375x667 (iPhone SE)
  - Test: Hamburger menu opens drawer
  - Test: Navigation link closes drawer and navigates
  - Test: ESC key closes drawer
  - Test: Breadcrumbs visible and functional on mobile
  - Test: Back button has adequate touch target
  - **Purpose**: Verify mobile navigation UX
  - _Leverage: `apps/web/e2e/mobile-ux.spec.ts` (mobile testing patterns)_
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 28. Create accessibility navigation E2E test
  - **File**: `apps/web/e2e/navigation-accessibility.spec.ts`
  - Test: Skip link is first focusable element
  - Test: Skip link visible on focus
  - Test: Skip link focuses main content when activated
  - Test: Tab navigation reaches all interactive elements
  - Test: Focus indicators visible on all links
  - Test: ARIA landmarks present (navigation, main)
  - Run axe-core accessibility scan on each page
  - **Purpose**: Verify WCAG 2.2 AA compliance for navigation
  - _Leverage: `apps/web/e2e/accessibility-audit.spec.ts` (accessibility patterns)_
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

---

## Task Dependencies

```
Phase 1: [1] → [2]
Phase 2: [1] → [3, 4, 5, 6, 7, 8] → [9]
Phase 3: [9] → [10] → [11] → [12] → [13] → [14]
Phase 4: [3-8] → [15-19], [14] → [20]
Phase 5: [14] → [21] → [22] → [23] → [24] → [25]
Phase 6: [21-25] → [26, 27, 28]
```

## Estimated Total Implementation Time

- **Phase 1**: 2 tasks (~1 hour)
- **Phase 2**: 7 tasks (~3 hours)
- **Phase 3**: 5 tasks (~2 hours)
- **Phase 4**: 6 tasks (~2.5 hours)
- **Phase 5**: 5 tasks (~2 hours)
- **Phase 6**: 3 tasks (~1.5 hours)

**Total**: 28 tasks (~12 hours of development)
