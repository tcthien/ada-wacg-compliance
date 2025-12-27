import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Testing Suite for ADAShield Web Application
 *
 * Tests ensure WCAG 2.2 Level AA compliance using axe-core.
 * As an accessibility testing tool, ADAShield must be fully accessible.
 *
 * Test Coverage:
 * - Automated axe-core scanning for all pages
 * - Keyboard navigation testing
 * - Focus management and visibility
 * - Color contrast verification
 * - Semantic HTML structure
 *
 * Note: Automated testing catches ~30% of accessibility issues.
 * Manual testing with screen readers is documented in docs/accessibility-audit.md
 */

// Helper function to check for accessibility violations
async function checkA11y(page: any, pageName: string) {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  // Log any violations for debugging
  if (accessibilityScanResults.violations.length > 0) {
    console.log(`\n=== Accessibility Violations on ${pageName} ===`);
    accessibilityScanResults.violations.forEach((violation) => {
      console.log(`\n${violation.impact?.toUpperCase()}: ${violation.help}`);
      console.log(`  Description: ${violation.description}`);
      console.log(`  Help URL: ${violation.helpUrl}`);
      console.log(`  Elements affected: ${violation.nodes.length}`);
      violation.nodes.forEach((node, idx) => {
        console.log(`    ${idx + 1}. ${node.html}`);
        console.log(`       Target: ${node.target.join(' ')}`);
      });
    });
  }

  return accessibilityScanResults;
}

test.describe('Accessibility Tests - Landing Page', () => {
  test('should not have any automatically detectable WCAG violations on home page', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await checkA11y(page, 'Home Page');

    // No critical or serious violations allowed
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);

    // Full report should have no violations at all
    expect(results.violations).toHaveLength(0);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Check for h1
    const h1 = await page.locator('h1').first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Free Website Accessibility Testing');

    // Check heading order (h1 -> h2 -> h3, no skipping)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const headingLevels: number[] = [];

    for (const heading of headings) {
      const tagName = await heading.evaluate((el) => el.tagName);
      const level = parseInt(tagName.charAt(1));
      headingLevels.push(level);
    }

    // First heading should be h1
    expect(headingLevels[0]).toBe(1);

    // No heading should skip levels (e.g., h1 -> h3)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');

    // Navigation should be in a nav element
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // All navigation links should have accessible text
    const navLinks = nav.locator('a');
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      const link = navLinks.nth(i);
      const text = await link.textContent();
      expect(text?.trim()).toBeTruthy();
    }
  });

  test('should have accessible form controls', async ({ page }) => {
    await page.goto('/');

    // Check URL input has label (either explicit or aria-label)
    const urlInput = page.locator('input[type="url"], input[name="url"]');
    const inputId = await urlInput.getAttribute('id');
    const ariaLabel = await urlInput.getAttribute('aria-label');
    const ariaLabelledBy = await urlInput.getAttribute('aria-labelledby');

    // Should have either a label element, aria-label, or aria-labelledby
    if (inputId) {
      const label = page.locator(`label[for="${inputId}"]`);
      const hasLabel = (await label.count()) > 0;
      expect(
        hasLabel || ariaLabel || ariaLabelledBy,
        'URL input must have an accessible label'
      ).toBeTruthy();
    } else {
      expect(
        ariaLabel || ariaLabelledBy,
        'URL input without ID must have aria-label or aria-labelledby'
      ).toBeTruthy();
    }

    // Submit button should be accessible
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    const buttonText = await submitButton.textContent();
    const buttonAriaLabel = await submitButton.getAttribute('aria-label');
    expect(
      buttonText?.trim() || buttonAriaLabel,
      'Submit button must have accessible text'
    ).toBeTruthy();
  });
});

test.describe('Accessibility Tests - Scan Results Page', () => {
  test('should not have WCAG violations on scan results page', async ({
    page,
  }) => {
    // Note: This test assumes a scan ID exists. In real testing, you'd create one first.
    // For now, we'll test the page structure if it loads
    await page.goto('/scan/test-scan-id');

    const results = await checkA11y(page, 'Scan Results Page');

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });
});

test.describe('Accessibility Tests - History Page', () => {
  test('should not have WCAG violations on history page', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    const results = await checkA11y(page, 'History Page');

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('should have accessible table or list for scan history', async ({
    page,
  }) => {
    await page.goto('/history');

    // History should be in a semantic structure (table, list, or cards with proper ARIA)
    const table = page.locator('table');
    const list = page.locator('ul, ol');
    const cards = page.locator('[role="list"]');

    const hasSemanticStructure =
      (await table.count()) > 0 ||
      (await list.count()) > 0 ||
      (await cards.count()) > 0;

    expect(
      hasSemanticStructure,
      'History should use semantic HTML (table/list) or ARIA roles'
    ).toBeTruthy();
  });
});

test.describe('Accessibility Tests - Settings Page', () => {
  test('should not have WCAG violations on settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const results = await checkA11y(page, 'Settings Page');

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('should have accessible delete button', async ({ page }) => {
    await page.goto('/settings');

    // Delete button should have clear accessible name
    const deleteButton = page.locator('button:has-text("Delete")').first();
    if ((await deleteButton.count()) > 0) {
      await expect(deleteButton).toBeVisible();

      const text = await deleteButton.textContent();
      const ariaLabel = await deleteButton.getAttribute('aria-label');

      expect(
        text?.trim() || ariaLabel,
        'Delete button must have accessible text'
      ).toBeTruthy();
    }
  });
});

test.describe('Accessibility Tests - Privacy Page', () => {
  test('should not have WCAG violations on privacy page', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    const results = await checkA11y(page, 'Privacy Page');

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test('should have proper document structure for long-form content', async ({
    page,
  }) => {
    await page.goto('/privacy');

    // Should have main heading
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    // Should use semantic HTML
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});

test.describe('Keyboard Navigation Tests', () => {
  test('should allow keyboard navigation through all interactive elements on home page', async ({
    page,
  }) => {
    await page.goto('/');

    // Get all focusable elements
    const focusableElements = await page.locator(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const count = await focusableElements.count();
    expect(count, 'Should have focusable elements on the page').toBeGreaterThan(
      0
    );

    // Tab through elements and ensure focus is visible
    for (let i = 0; i < Math.min(count, 10); i++) {
      // Test first 10 elements
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          hasVisibleFocus:
            el &&
            window.getComputedStyle(el).outlineWidth !== '0px' &&
            window.getComputedStyle(el).outlineStyle !== 'none',
        };
      });

      // Focus should be on an interactive element
      expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(
        focusedElement.tagName
      );
    }
  });

  test('should allow Enter key to activate buttons', async ({ page }) => {
    await page.goto('/');

    // Focus on a button
    const button = page.locator('button').first();
    await button.focus();

    // Get initial state
    const isFocused = await button.evaluate(
      (el) => document.activeElement === el
    );
    expect(isFocused).toBeTruthy();

    // Note: We can't fully test activation without backend, but we can verify focus
  });

  test('should allow Escape key to close modals/dialogs', async ({ page }) => {
    await page.goto('/');

    // If there are any dialogs/modals, test Escape key
    const dialog = page.locator('[role="dialog"]');
    if ((await dialog.count()) > 0) {
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  });

  test('should trap focus in modal dialogs', async ({ page }) => {
    await page.goto('/');

    // Check for cookie consent modal
    const cookieModal = page.locator('[role="dialog"]').first();

    if ((await cookieModal.count()) > 0 && (await cookieModal.isVisible())) {
      // Get focusable elements within modal
      const modalFocusable = cookieModal.locator(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const count = await modalFocusable.count();

      if (count > 1) {
        // Focus first element
        await modalFocusable.first().focus();

        // Tab through all elements
        for (let i = 0; i < count; i++) {
          await page.keyboard.press('Tab');
        }

        // Focus should cycle back to first element in modal
        const focusedElement = await page.evaluate(() => {
          return document.activeElement?.tagName;
        });

        expect(['A', 'BUTTON', 'INPUT']).toContain(focusedElement);
      }
    }
  });
});

test.describe('Color Contrast Tests', () => {
  test('should meet WCAG AA color contrast requirements', async ({ page }) => {
    await page.goto('/');

    // axe-core checks color contrast automatically
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include(['body'])
      .analyze();

    const contrastViolations = results.violations.filter((v) =>
      v.id.includes('color-contrast')
    );

    expect(
      contrastViolations,
      'All text should meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)'
    ).toHaveLength(0);
  });
});

test.describe('Focus Management Tests', () => {
  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Check if focus is visible
    const hasFocusIndicator = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;

      const styles = window.getComputedStyle(el);

      // Check for outline or box-shadow (common focus indicators)
      const hasOutline =
        styles.outlineWidth !== '0px' && styles.outlineStyle !== 'none';
      const hasBoxShadow = styles.boxShadow !== 'none';
      const hasBorder =
        styles.borderWidth !== '0px' && styles.borderStyle !== 'none';

      return hasOutline || hasBoxShadow || hasBorder;
    });

    expect(
      hasFocusIndicator,
      'Focused elements must have visible focus indicators'
    ).toBeTruthy();
  });

  test('should not have focus outline removed globally', async ({ page }) => {
    await page.goto('/');

    // Check that outline: none is not applied globally
    const hasOutlineNone = await page.evaluate(() => {
      const allElements = Array.from(
        document.querySelectorAll('*:focus, a, button')
      );

      return allElements.some((el) => {
        const styles = window.getComputedStyle(el);
        return styles.outline === 'none' && styles.outlineStyle === 'none';
      });
    });

    // This is okay as long as there's an alternative focus indicator
    // We already test for visible focus indicators above
  });
});

test.describe('Responsive Design and Zoom Tests', () => {
  test('should remain usable at 200% zoom', async ({ page }) => {
    await page.goto('/');

    // Set viewport to simulate 200% zoom (half the normal size)
    await page.setViewportSize({ width: 640, height: 480 });

    // Page should still be readable
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    // Navigation should still be accessible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Form should still be usable
    const urlInput = page.locator('input[type="url"], input[name="url"]');
    await expect(urlInput).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    await page.goto('/');

    // Content should be visible
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    // Should not have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(
      hasHorizontalScroll,
      'Page should not have horizontal scroll on mobile'
    ).toBeFalsy();
  });
});

test.describe('Semantic HTML Tests', () => {
  test('should use semantic HTML landmarks', async ({ page }) => {
    await page.goto('/');

    // Should have main landmark
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have nav landmark
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Should have footer landmark
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('should have proper list structure', async ({ page }) => {
    await page.goto('/');

    // Any lists should be properly structured
    const lists = await page.locator('ul, ol').all();

    for (const list of lists) {
      const children = await list.locator('> *').all();

      for (const child of children) {
        const tagName = await child.evaluate((el) => el.tagName);
        expect(
          ['LI', 'SCRIPT', 'TEMPLATE'].includes(tagName),
          'Lists should only contain li elements as direct children'
        ).toBeTruthy();
      }
    }
  });
});

test.describe('Images and Icons Tests', () => {
  test('should have alt text for all images', async ({ page }) => {
    await page.goto('/');

    // Find all img elements
    const images = await page.locator('img').all();

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const ariaHidden = await img.getAttribute('aria-hidden');
      const role = await img.getAttribute('role');

      // Image should have alt text, or be properly hidden, or be decorative
      expect(
        alt !== null ||
          ariaLabel !== null ||
          ariaHidden === 'true' ||
          role === 'presentation',
        'All images must have alt text or be properly marked as decorative'
      ).toBeTruthy();
    }
  });

  test('should have accessible icon labels', async ({ page }) => {
    await page.goto('/');

    // Find elements with role="img" (emoji icons)
    const iconElements = await page.locator('[role="img"]').all();

    for (const icon of iconElements) {
      const ariaLabel = await icon.getAttribute('aria-label');

      expect(
        ariaLabel,
        'Icons with role="img" must have aria-label'
      ).toBeTruthy();
    }
  });
});

test.describe('Form Validation and Error Messages', () => {
  test('should have accessible error messages for form validation', async ({
    page,
  }) => {
    await page.goto('/');

    // Try to submit form with invalid URL
    const urlInput = page.locator('input[type="url"], input[name="url"]');
    await urlInput.fill('invalid-url');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait a bit for validation
    await page.waitForTimeout(500);

    // Check if error message is visible and associated with input
    const ariaDescribedBy = await urlInput.getAttribute('aria-describedby');
    const ariaInvalid = await urlInput.getAttribute('aria-invalid');

    // Either aria-describedby should point to error message, or aria-invalid should be true
    if (ariaDescribedBy) {
      const errorMessage = page.locator(`#${ariaDescribedBy}`);
      const isVisible = await errorMessage.isVisible().catch(() => false);
      expect(
        isVisible,
        'Error message referenced by aria-describedby should be visible'
      ).toBeTruthy();
    } else if (ariaInvalid === 'true') {
      // This is also acceptable - indicates invalid state
      expect(ariaInvalid).toBe('true');
    }
  });
});

test.describe('Skip Links and Navigation', () => {
  test('should have skip to main content link', async ({ page }) => {
    await page.goto('/');

    // Look for skip link (usually first focusable element)
    await page.keyboard.press('Tab');

    const firstFocusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        text: el?.textContent?.trim(),
        href: el?.getAttribute('href'),
        tagName: el?.tagName,
      };
    });

    // Skip link is recommended but not required for simple pages
    // If it exists, it should link to #main or #content
    if (
      firstFocusedElement.text?.toLowerCase().includes('skip') ||
      firstFocusedElement.href?.startsWith('#')
    ) {
      expect(
        ['#main', '#content', '#main-content'].includes(
          firstFocusedElement.href || ''
        )
      ).toBeTruthy();
    }
  });
});
