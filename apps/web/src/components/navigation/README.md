# Navigation Components

Accessible navigation components for WCAG 2.2 AA compliance.

## SkipLink

The `SkipLink` component provides keyboard users with a way to bypass repetitive navigation and jump directly to main content, meeting WCAG 2.4.1 (Bypass Blocks) requirements.

### Features

- **WCAG 2.4.1 Compliance**: Bypass Blocks - Level A
- **WCAG 2.4.7 Compliance**: Focus Visible - Level AA
- **WCAG 2.5.5 Compliance**: 44x44px minimum touch target size
- **Screen Reader Only**: Visually hidden until focused (`sr-only` pattern)
- **Focus Visible**: Appears with clear visual indicator when tabbed to
- **Keyboard Accessible**: Full keyboard navigation support
- **Smooth Scrolling**: Automatically scrolls target into view

### Usage

#### Basic Usage

```tsx
import { SkipLink } from '@/components/navigation';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* SkipLink should be the FIRST focusable element on the page */}
        <SkipLink />

        <header>
          {/* Navigation content */}
        </header>

        {/* Main content MUST have id="main-content" */}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
```

#### Custom Target

```tsx
<SkipLink targetId="page-content">
  Skip to page content
</SkipLink>

{/* Target element */}
<div id="page-content" tabIndex={-1}>
  {/* Content */}
</div>
```

#### Multiple Skip Links

```tsx
{/* Skip to main content */}
<SkipLink targetId="main-content">
  Skip to main content
</SkipLink>

{/* Skip to navigation */}
<SkipLink targetId="main-nav">
  Skip to navigation
</SkipLink>

{/* Skip to search */}
<SkipLink targetId="search">
  Skip to search
</SkipLink>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `targetId` | `string` | `"main-content"` | ID of the element to skip to |
| `children` | `ReactNode` | `"Skip to main content"` | Text to display in the link |
| `className` | `string` | `undefined` | Additional CSS classes |

### Integration Checklist

- [ ] Add `<SkipLink />` as the **first element** in your layout
- [ ] Ensure main content has `id="main-content"` (or custom targetId)
- [ ] Add `tabIndex={-1}` to the target element if it's not naturally focusable
- [ ] Test keyboard navigation (press Tab on page load)
- [ ] Verify skip link appears when focused
- [ ] Confirm focus moves to target element when activated

### Accessibility Notes

1. **Positioning**: The skip link MUST be the first focusable element on the page
2. **Target Element**: Must have an `id` that matches the `targetId` prop
3. **Focus Management**: Target element should have `tabIndex={-1}` if not naturally focusable
4. **Visual Design**: Skip link is hidden until focused, then appears in top-left with high contrast
5. **Multiple Skip Links**: Consider providing multiple skip links for complex layouts

### Testing

#### Manual Testing

1. **Keyboard Navigation**:
   - Press Tab on page load
   - Skip link should be the first focused element
   - Link should be visually visible when focused

2. **Activation**:
   - Press Enter or Space on focused skip link
   - Focus should move to target element
   - Page should scroll target into view

3. **Screen Reader**:
   - Skip link should be announced as first element
   - Should announce as link with proper text

#### Automated Testing

```bash
# Run component tests
pnpm test SkipLink.test.tsx

# Run E2E accessibility tests
pnpm test:e2e accessibility-audit.spec.ts
```

### WCAG Success Criteria

| Criterion | Level | Description | Implementation |
|-----------|-------|-------------|----------------|
| 2.4.1 Bypass Blocks | A | Mechanism to bypass repeated content | Skip link as first focusable element |
| 2.4.7 Focus Visible | AA | Keyboard focus indicator visible | `focus:ring-2 focus:ring-primary` |
| 2.5.5 Target Size | AAA | 44x44px minimum touch target | `focus:min-h-[44px] focus:min-w-[44px]` |

### Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

### Related Components

- **MainContent**: Wrapper component for main content area
- **Navigation**: Accessible navigation component
- **Header**: Site header with skip link integration
