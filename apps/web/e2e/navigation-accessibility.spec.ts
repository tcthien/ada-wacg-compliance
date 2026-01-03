import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E Tests: Navigation Accessibility Compliance
 *
 * This test suite verifies WCAG 2.2 AA compliance for navigation and keyboard accessibility:
 * - Skip link functionality (WCAG 2.4.1 Bypass Blocks)
 * - Keyboard navigation through interactive elements
 * - Focus indicators visibility (WCAG 2.4.7)
 * - ARIA landmarks (WCAG 1.3.1, 2.4.1)
 * - Automated accessibility scanning with axe-core
 *
 * Requirements:
 * - 8.1: Skip link is first focusable element
 * - 8.2: Skip link moves focus to main content
 * - 8.3: Skip link hidden visually when not focused
 * - 8.4: Skip link displays with visible focus indicator
 *
 * Test Coverage:
 * 1. Skip link as first focusable element on all pages
 * 2. Skip link visibility on focus
 * 3. Skip link functionality (focus main content)
 * 4. Tab navigation through all interactive elements
 * 5. Focus indicators on all interactive elements
 * 6. ARIA landmarks present (navigation, main)
 * 7. Automated axe-core accessibility scan
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

test.describe('Navigation Accessibility - Skip Link (WCAG 2.4.1)', () => {
  const testPages = [
    { path: '/', name: 'Home Page' },
    { path: '/history', name: 'History Page' },
  ];

  testPages.forEach(({ path, name }) => {
    test(`should have skip link as first focusable element on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Tab to first focusable element
      await page.keyboard.press('Tab');

      // Get the currently focused element
      const focusedElement = page.locator(':focus');

      // Verify it's a skip link
      const text = await focusedElement.textContent();
      expect(text?.toLowerCase()).toContain('skip');

      // Verify it's an anchor element with correct href
      const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
      expect(tagName).toBe('a');

      const href = await focusedElement.getAttribute('href');
      expect(href).toMatch(/#(main|content|main-content)/);
    });

    test(`skip link should be visible when focused on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Get skip link before focusing
      const skipLink = page.locator('a').filter({ hasText: /skip/i }).first();

      // Check initial state - should be visually hidden
      const initialVisible = await skipLink.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);

        // Check if element is in screen reader only mode
        const isSrOnly =
          computed.position === 'absolute' &&
          computed.width === '1px' &&
          computed.height === '1px';

        return !isSrOnly && rect.width > 0 && rect.height > 0;
      });

      // Should be hidden initially (or very small for screen readers)
      expect(initialVisible).toBe(false);

      // Focus the skip link
      await page.keyboard.press('Tab');

      // Verify skip link is now visible with proper dimensions
      const focusedVisible = await skipLink.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);

        // When focused, should be visible and properly sized
        return (
          rect.width >= 44 && // WCAG 2.5.5: Minimum 44x44px touch target
          rect.height >= 44 &&
          computed.visibility !== 'hidden' &&
          computed.display !== 'none'
        );
      });

      expect(focusedVisible).toBe(true);
    });

    test(`skip link should have visible focus indicator on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Tab to skip link
      await page.keyboard.press('Tab');

      const skipLink = page.locator(':focus');

      // Verify focus indicator is visible
      const hasFocusIndicator = await skipLink.evaluate((el) => {
        const computed = window.getComputedStyle(el);

        // Check for various focus indicator styles
        const hasOutline = computed.outline !== 'none' && computed.outline !== '';
        const hasBoxShadow = computed.boxShadow !== 'none' && computed.boxShadow.includes('rgb');
        const hasRing =
          computed.getPropertyValue('--tw-ring-width') !== '0px' ||
          computed.getPropertyValue('box-shadow').includes('ring');

        return hasOutline || hasBoxShadow || hasRing;
      });

      expect(hasFocusIndicator).toBeTruthy();
    });

    test(`skip link should move focus to main content on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Tab to skip link
      await page.keyboard.press('Tab');

      // Get the skip link href to determine target
      const skipLink = page.locator(':focus');
      const href = await skipLink.getAttribute('href');
      const targetId = href?.replace('#', '') || 'main-content';

      // Activate skip link
      await page.keyboard.press('Enter');

      // Wait a bit for focus to move
      await page.waitForTimeout(100);

      // Verify focus is now on main content
      const mainContent = page.locator(`#${targetId}`);
      const isFocused = await mainContent.evaluate((el) => {
        return document.activeElement === el;
      });

      expect(isFocused).toBeTruthy();

      // Verify main content is scrolled into view
      const isInViewport = await mainContent.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.top < window.innerHeight;
      });

      expect(isInViewport).toBeTruthy();
    });
  });
});

test.describe('Navigation Accessibility - Tab Navigation', () => {
  test('should navigate through all header links on home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Skip the skip link
    await page.keyboard.press('Tab');

    // Tab to logo/brand link
    await page.keyboard.press('Tab');
    let focused = page.locator(':focus');
    let text = await focused.textContent();
    expect(text).toContain('ADAShield');

    // Tab through navigation links
    const navLinks = ['Home', 'History', 'Settings'];

    for (const linkText of navLinks) {
      await page.keyboard.press('Tab');
      focused = page.locator(':focus');
      text = await focused.textContent();

      // Check if we reached the expected link (on desktop) or mobile menu (on small screens)
      const isMobileMenu = text?.includes('Menu') || text?.includes('☰');
      const isCorrectLink = text === linkText;

      if (!isMobileMenu && !isCorrectLink) {
        // On desktop, we should find the link
        // On mobile, navigation might be different
        const viewportSize = page.viewportSize();
        if (viewportSize && viewportSize.width >= 768) {
          // Desktop view - expect the link
          expect(text).toBe(linkText);
        }
      }
    }
  });

  test('should navigate through all interactive elements on history page', async ({ page }) => {
    // Mock history data to ensure we have elements to interact with
    await page.route('**/api/scans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'scan-1',
            url: 'https://example.com',
            status: 'COMPLETED',
            issueCount: 5,
            createdAt: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Tab through elements and ensure each receives focus
    const interactiveElements: string[] = [];
    let previousElement: string | null = null;

    // Tab through first 20 elements (should cover main navigation and controls)
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      const isVisible = await focused.isVisible().catch(() => false);

      if (isVisible) {
        const tagName = await focused.evaluate((el) => el.tagName.toLowerCase());
        const ariaLabel = await focused.getAttribute('aria-label');
        const text = await focused.textContent().catch(() => '');

        const elementDesc = ariaLabel || text?.substring(0, 30) || tagName;

        // Only record if different from previous element (avoid infinite loops)
        if (elementDesc !== previousElement) {
          interactiveElements.push(elementDesc);
          previousElement = elementDesc;
        }
      }
    }

    // Verify we found multiple interactive elements
    expect(interactiveElements.length).toBeGreaterThan(5);

    // Verify key navigation elements are present
    const interactiveText = interactiveElements.join(' ').toLowerCase();
    expect(interactiveText).toMatch(/home|history|settings|discover|scan/);
  });

  test('should have Tab order matching visual order', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Collect focus order
    const focusOrder: { element: string; position: { x: number; y: number } }[] = [];

    // Tab through first 10 elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      const isVisible = await focused.isVisible().catch(() => false);

      if (isVisible) {
        const text = await focused.textContent().catch(() => '');
        const position = await focused.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return { x: rect.left, y: rect.top };
        });

        focusOrder.push({ element: text?.substring(0, 20) || 'unknown', position });
      }
    }

    // Verify focus order generally follows top-to-bottom, left-to-right
    for (let i = 1; i < focusOrder.length; i++) {
      const prev = focusOrder[i - 1];
      const curr = focusOrder[i];

      // Current element should be either:
      // 1. Below previous element (y is greater)
      // 2. To the right on same row (y similar, x is greater)
      const isBelow = curr.position.y > prev.position.y - 50; // Allow small variations
      const isRightward =
        Math.abs(curr.position.y - prev.position.y) < 50 &&
        curr.position.x > prev.position.x;

      // At least one of these should be true for logical tab order
      expect(isBelow || isRightward).toBeTruthy();
    }
  });
});

test.describe('Navigation Accessibility - Focus Indicators (WCAG 2.4.7)', () => {
  test('should have visible focus indicators on all navigation links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find all navigation links
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();

    expect(count).toBeGreaterThan(0);

    // Test first few links (at least 3)
    const linksToTest = Math.min(count, 5);

    for (let i = 0; i < linksToTest; i++) {
      const link = navLinks.nth(i);

      // Focus the link
      await link.focus();

      // Verify focus indicator
      const hasFocusIndicator = await link.evaluate((el) => {
        const computed = window.getComputedStyle(el);

        return (
          computed.outline !== 'none' ||
          computed.boxShadow.includes('rgb') ||
          computed.getPropertyValue('box-shadow').includes('ring')
        );
      });

      const linkText = await link.textContent();
      expect(hasFocusIndicator, `Link "${linkText}" should have visible focus indicator`).toBeTruthy();
    }
  });

  test('should have visible focus indicators on all buttons', async ({ page }) => {
    // Mock history data to get some buttons
    await page.route('**/api/scans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'scan-1',
            url: 'https://example.com',
            status: 'COMPLETED',
            issueCount: 5,
            createdAt: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Find all buttons
    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      // Test first few buttons (at least 3 if available)
      const buttonsToTest = Math.min(count, 5);

      for (let i = 0; i < buttonsToTest; i++) {
        const button = buttons.nth(i);
        const isVisible = await button.isVisible().catch(() => false);

        if (isVisible) {
          // Focus the button
          await button.focus();

          // Verify focus indicator
          const hasFocusIndicator = await button.evaluate((el) => {
            const computed = window.getComputedStyle(el);

            return (
              computed.outline !== 'none' ||
              computed.boxShadow.includes('rgb') ||
              computed.getPropertyValue('box-shadow').includes('ring')
            );
          });

          const buttonText = await button.textContent();
          expect(hasFocusIndicator, `Button "${buttonText}" should have visible focus indicator`).toBeTruthy();
        }
      }
    }
  });

  test('should have visible focus indicators on all form inputs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find all input elements
    const inputs = page.locator('input[type="text"], input[type="url"], textarea');
    const count = await inputs.count();

    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const isVisible = await input.isVisible().catch(() => false);

      if (isVisible) {
        // Focus the input
        await input.focus();

        // Verify focus indicator
        const hasFocusIndicator = await input.evaluate((el) => {
          const computed = window.getComputedStyle(el);

          return (
            computed.outline !== 'none' ||
            computed.boxShadow.includes('rgb') ||
            computed.borderColor !== 'rgb(0, 0, 0)' // Default border changes
          );
        });

        const inputId = await input.getAttribute('id');
        expect(hasFocusIndicator, `Input "${inputId}" should have visible focus indicator`).toBeTruthy();
      }
    }
  });
});

test.describe('Navigation Accessibility - ARIA Landmarks (WCAG 1.3.1, 2.4.1)', () => {
  const testPages = [
    { path: '/', name: 'Home Page' },
    { path: '/history', name: 'History Page' },
  ];

  testPages.forEach(({ path, name }) => {
    test(`should have navigation landmark on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Check for navigation landmarks
      const navLandmarks = page.locator('nav, [role="navigation"]');
      const count = await navLandmarks.count();

      expect(count, `${name} should have at least one navigation landmark`).toBeGreaterThan(0);

      // Verify navigation has accessible label
      const firstNav = navLandmarks.first();
      const ariaLabel = await firstNav.getAttribute('aria-label');
      const ariaLabelledBy = await firstNav.getAttribute('aria-labelledby');

      expect(
        ariaLabel || ariaLabelledBy,
        'Navigation landmark should have aria-label or aria-labelledby'
      ).toBeTruthy();
    });

    test(`should have main landmark on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Check for main landmark
      const mainLandmarks = page.locator('main, [role="main"]');
      const count = await mainLandmarks.count();

      expect(count, `${name} should have exactly one main landmark`).toBe(1);

      // Verify main has an id for skip link target
      const main = mainLandmarks.first();
      const id = await main.getAttribute('id');

      expect(id, 'Main landmark should have an id attribute').toBeTruthy();
    });

    test(`should have proper landmark structure on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Verify landmark order: navigation should come before main
      const landmarks = await page.evaluate(() => {
        const nav = document.querySelector('nav, [role="navigation"]');
        const main = document.querySelector('main, [role="main"]');

        if (!nav || !main) return { valid: false, reason: 'Missing landmarks' };

        const navPosition = nav.compareDocumentPosition(main);

        // DOCUMENT_POSITION_FOLLOWING = 4 means main comes after nav
        return {
          valid: (navPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          reason: 'Navigation should come before main'
        };
      });

      expect(landmarks.valid, landmarks.reason).toBeTruthy();
    });
  });
});

test.describe('Navigation Accessibility - Automated Scanning', () => {
  const testPages = [
    { path: '/', name: 'Home Page' },
    { path: '/history', name: 'History Page' },
  ];

  testPages.forEach(({ path, name }) => {
    test(`should pass axe-core accessibility scan on ${name}`, async ({ page }) => {
      // Add route mocking for pages that need it
      if (path === '/history') {
        await page.route('**/api/scans', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: 'scan-1',
                url: 'https://example.com',
                status: 'COMPLETED',
                issueCount: 5,
                createdAt: new Date().toISOString(),
              },
            ]),
          });
        });
      }

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await checkA11y(page, name);

      // No critical or serious violations allowed
      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(
        criticalViolations,
        `Found ${criticalViolations.length} critical/serious accessibility violations on ${name}`
      ).toHaveLength(0);

      // Full report should have no violations for WCAG 2.2 AA
      expect(results.violations, `${name} should have no WCAG violations`).toHaveLength(0);
    });

    test(`should pass keyboard navigation scan on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Run axe-core specifically for keyboard navigation rules
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .include(['nav', 'main', 'a', 'button', 'input'])
        .analyze();

      // Filter for keyboard-specific violations
      const keyboardViolations = results.violations.filter((v) =>
        v.id.includes('tabindex') ||
        v.id.includes('focus') ||
        v.id.includes('keyboard') ||
        v.id.includes('link-name') ||
        v.id.includes('button-name')
      );

      expect(
        keyboardViolations,
        `Found ${keyboardViolations.length} keyboard navigation violations on ${name}`
      ).toHaveLength(0);
    });

    test(`should pass landmark scan on ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Run axe-core specifically for landmark rules
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      // Filter for landmark-specific violations
      const landmarkViolations = results.violations.filter((v) =>
        v.id.includes('landmark') ||
        v.id.includes('region') ||
        v.id.includes('bypass')
      );

      expect(
        landmarkViolations,
        `Found ${landmarkViolations.length} landmark violations on ${name}`
      ).toHaveLength(0);
    });
  });
});

test.describe('Navigation Accessibility - Mobile Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test('should have accessible mobile menu button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find mobile menu button (should be visible on mobile)
    const mobileMenuButton = page.locator('button').filter({
      has: page.locator('[aria-label*="menu" i], [aria-label*="navigation" i]')
    }).or(
      page.locator('button').filter({ hasText: /menu|☰|≡/i })
    ).first();

    // If mobile menu exists, test it
    if (await mobileMenuButton.isVisible()) {
      // Should have accessible name
      const ariaLabel = await mobileMenuButton.getAttribute('aria-label');
      const text = await mobileMenuButton.textContent();

      expect(ariaLabel || text, 'Mobile menu button should have accessible name').toBeTruthy();

      // Should have aria-expanded attribute
      const ariaExpanded = await mobileMenuButton.getAttribute('aria-expanded');
      expect(['true', 'false']).toContain(ariaExpanded);

      // Should be keyboard accessible
      await mobileMenuButton.focus();
      await expect(mobileMenuButton).toBeFocused();
    }
  });

  test('should navigate mobile menu with keyboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for mobile menu button
    const mobileMenuButton = page.locator('button').filter({ hasText: /menu|☰|≡/i }).first();

    if (await mobileMenuButton.isVisible()) {
      // Open menu with keyboard
      await mobileMenuButton.focus();
      await page.keyboard.press('Enter');

      // Wait for menu to open
      await page.waitForTimeout(300);

      // Verify aria-expanded changed to true
      const expanded = await mobileMenuButton.getAttribute('aria-expanded');
      expect(expanded).toBe('true');

      // Tab through menu items
      const menuItems = page.locator('[role="menu"] a, [role="navigation"] a').filter({ hasText: /.+/ });
      const itemCount = await menuItems.count();

      if (itemCount > 0) {
        // First item should be focusable
        await page.keyboard.press('Tab');
        const firstItem = menuItems.first();

        // Verify focus is in menu
        const focusedElement = page.locator(':focus');
        const focusedText = await focusedElement.textContent();
        expect(focusedText).toBeTruthy();
      }
    }
  });
});
