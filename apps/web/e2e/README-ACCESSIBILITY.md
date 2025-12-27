# Accessibility Testing Guide

This directory contains accessibility tests for the ADAShield web application using Playwright and @axe-core/playwright.

---

## Overview

As an accessibility testing tool, **ADAShield must be fully accessible itself**. These tests ensure WCAG 2.2 Level AA compliance across all pages.

**Test Coverage:**
- 🤖 **Automated Tests:** 26 test scenarios using axe-core
- 📋 **Manual Tests:** Screen reader and keyboard testing documented in `/docs/accessibility-audit.md`

---

## Running the Tests

### Quick Start

```bash
# Navigate to web app
cd apps/web

# Run accessibility tests
pnpm exec playwright test e2e/accessibility.spec.ts
```

### Development Mode

```bash
# Run with UI (interactive mode)
pnpm exec playwright test e2e/accessibility.spec.ts --ui

# Run in headed mode (see browser)
pnpm exec playwright test e2e/accessibility.spec.ts --headed

# Run specific test
pnpm exec playwright test e2e/accessibility.spec.ts -g "keyboard navigation"
```

### Debug Mode

```bash
# Debug a failing test
pnpm exec playwright test e2e/accessibility.spec.ts --debug

# Debug specific test
pnpm exec playwright test e2e/accessibility.spec.ts --debug -g "color contrast"
```

### View Reports

```bash
# After running tests, view HTML report
pnpm exec playwright show-report
```

---

## Test Structure

### 1. Automated axe-core Tests

Tests all pages against WCAG 2.2 Level AA:

- **Landing Page** (`/`)
- **Scan Results** (`/scan/[id]`)
- **History** (`/history`)
- **Settings** (`/settings`)
- **Privacy Policy** (`/privacy`)

**WCAG Tags Tested:**
- wcag2a
- wcag2aa
- wcag21a
- wcag21aa
- wcag22aa

### 2. Structural Tests

- ✅ Heading hierarchy (h1-h6, no skipped levels)
- ✅ Navigation accessibility
- ✅ Form labels and controls
- ✅ Semantic HTML landmarks
- ✅ List and table structure

### 3. Keyboard Navigation Tests

- ✅ Tab order through all interactive elements
- ✅ Focus visibility
- ✅ Enter/Space key activation
- ✅ Escape key for modals
- ✅ Focus trap in dialogs

### 4. Color Contrast Tests

- ✅ WCAG AA contrast ratios
  - 4.5:1 for normal text
  - 3:1 for large text
  - 3:1 for UI components

### 5. Focus Management Tests

- ✅ Visible focus indicators
- ✅ Focus states on all interactive elements

### 6. Responsive Design Tests

- ✅ 200% zoom usability
- ✅ Mobile viewport compatibility
- ✅ No horizontal scroll

### 7. Images and Icons Tests

- ✅ Alt text for all images
- ✅ ARIA labels for decorative icons

### 8. Form Validation Tests

- ✅ Accessible error messages
- ✅ Field-error associations (aria-describedby, aria-invalid)

---

## Understanding Test Results

### Successful Test

```
✓ Accessibility Tests - Landing Page › should not have WCAG violations
```

### Failed Test with Violations

```
✗ Accessibility Tests - Landing Page › should not have WCAG violations

=== Accessibility Violations on Home Page ===

SERIOUS: Form elements must have labels
  Description: Ensures every form element has a label
  Help URL: https://dequeuniversity.com/rules/axe/4.11/label
  Elements affected: 1
    1. <input type="url" name="url" />
       Target: input[name="url"]
```

**Action Required:**
1. Fix the violation (add label to input)
2. Re-run tests to verify fix
3. Document any remaining issues in `/docs/accessibility-audit.md`

---

## Manual Testing

While automated tests detect ~30% of accessibility issues, manual testing is critical.

### Screen Reader Testing

See `/docs/accessibility-audit.md` for detailed procedures:

1. **Heading Navigation** - Test with screen reader heading shortcuts
2. **Form Labels** - Verify all fields announced correctly
3. **Button Purposes** - Ensure clear, descriptive labels
4. **Landmark Regions** - Verify main, nav, footer announced
5. **Error Messages** - Test validation announcements
6. **Dynamic Content** - Verify loading states announced

**Recommended Tools:**
- **Windows:** NVDA (free) with Firefox
- **macOS:** VoiceOver (built-in) with Safari
- **Linux:** Orca (free)

### Keyboard Testing Checklist

- [ ] Tab through entire page in logical order
- [ ] All interactive elements receive focus
- [ ] Focus indicator clearly visible
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals
- [ ] No keyboard traps
- [ ] Skip links work (if present)

---

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run Accessibility Tests
  run: |
    cd apps/web
    pnpm exec playwright test e2e/accessibility.spec.ts
```

**Recommended:** Run accessibility tests on every PR to prevent regressions.

---

## Common Issues and Fixes

### 1. Missing Form Labels

**Issue:**
```
Form elements must have labels
```

**Fix:**
```tsx
// Before
<input type="text" name="email" />

// After - Option 1: Explicit label
<label htmlFor="email">Email Address</label>
<input type="text" id="email" name="email" />

// After - Option 2: aria-label
<input
  type="text"
  name="email"
  aria-label="Email Address"
/>
```

### 2. Color Contrast Violations

**Issue:**
```
Elements must have sufficient color contrast
```

**Fix:**
- Use WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Ensure 4.5:1 ratio for normal text
- Ensure 3:1 ratio for large text (18pt+ or 14pt+ bold)

### 3. Missing Alt Text

**Issue:**
```
Images must have alternate text
```

**Fix:**
```tsx
// Before
<img src="/logo.png" />

// After - Informative image
<img src="/logo.png" alt="ADAShield Logo" />

// After - Decorative image
<img src="/decorative.png" alt="" />
```

### 4. Improper Heading Order

**Issue:**
```
Heading levels should only increase by one
```

**Fix:**
```tsx
// Before - WRONG (skips h2)
<h1>Main Title</h1>
<h3>Subsection</h3>

// After - CORRECT
<h1>Main Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```

---

## Best Practices

### 1. Test Early and Often

Run accessibility tests during development, not just at the end:

```bash
# Watch mode during development
pnpm exec playwright test e2e/accessibility.spec.ts --watch
```

### 2. Fix Critical Issues First

Prioritize violations by impact:
- **Critical:** Blocks access for some users
- **Serious:** Significantly impacts usability
- **Moderate:** Some impact on accessibility
- **Minor:** Best practice improvements

### 3. Document Acceptable Deviations

If a violation cannot be fixed immediately:
1. Document in `/docs/accessibility-audit.md`
2. Create remediation plan with timeline
3. Track as technical debt

### 4. Combine Automated + Manual Testing

- ✅ Automated tests catch structural issues
- ✅ Manual tests catch UX and cognitive issues
- ✅ User testing with people with disabilities is invaluable

---

## Resources

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation tool
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Chrome DevTools
- [Pa11y](https://pa11y.org/) - CLI accessibility tester

### Guidelines
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Articles](https://webaim.org/articles/)

### Learning
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [Deque University](https://dequeuniversity.com/)
- [A11ycasts (YouTube)](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9LVWWVqvHlYJyqw7g)

---

## Support

For questions or issues:
1. Review `/docs/accessibility-audit.md` for detailed testing procedures
2. Check axe-core rule documentation at violation Help URLs
3. Consult WCAG 2.2 guidelines for specific criteria

---

**Remember:** As an accessibility testing tool, ADAShield must exemplify accessibility best practices. Every violation fixed improves the product and demonstrates our commitment to accessibility.

---

**Last Updated:** December 26, 2024
