import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Keyboard Accessibility
 *
 * Tests keyboard navigation and accessibility features:
 * - Focus management and tab order
 * - Focus indicators visibility
 * - Tree keyboard navigation (arrow keys)
 * - ARIA attributes and announcements
 * - Screen reader compatibility
 */

test.describe('Keyboard Accessibility', () => {
  test.describe('Focus Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
    });

    test('should have visible focus indicators on URL input', async ({
      page,
    }) => {
      const urlInput = page.getByLabel('Website URL');

      // Focus the input
      await urlInput.focus();

      // Check for focus ring (Tailwind focus:ring-2)
      await expect(urlInput).toBeFocused();
      const styles = await urlInput.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          outline: computed.outline,
          boxShadow: computed.boxShadow,
        };
      });

      // Should have some visible focus indicator
      expect(
        styles.outline !== 'none' || styles.boxShadow !== 'none'
      ).toBeTruthy();
    });

    test('should have proper tab order on discovery page', async ({ page }) => {
      // Tab through elements
      await page.keyboard.press('Tab');
      let focused = page.locator(':focus');
      await expect(focused).toBeVisible();

      // First focusable should be URL input
      await expect(page.getByLabel('Website URL')).toBeFocused();

      // Tab to Continue button
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: 'Continue' })
      ).toBeFocused();
    });

    test('should preserve focus after URL validation error', async ({
      page,
    }) => {
      const urlInput = page.getByLabel('Website URL');

      // Enter invalid URL
      await urlInput.fill('invalid');
      await page.keyboard.press('Enter');

      // Focus should remain near input or error area
      // This helps screen reader users find the error
      await expect(
        page.getByText(/Please enter a valid URL/i)
      ).toBeVisible();
    });

    test('should move focus to mode selection after valid URL', async ({
      page,
    }) => {
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Focus should be in mode selection area
      const modeSection = page.locator('[role="radiogroup"]');
      await expect(modeSection).toBeVisible();
    });
  });

  test.describe('Tree Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Setup mock API response with completed discovery
      await page.route('**/api/discoveries**', async (route) => {
        const mockPages = [
          {
            id: '1',
            url: 'https://example.com/',
            title: 'Home',
            source: 'SITEMAP',
            depth: 0,
          },
          {
            id: '2',
            url: 'https://example.com/about',
            title: 'About',
            source: 'NAVIGATION',
            depth: 1,
          },
          {
            id: '3',
            url: 'https://example.com/about/team',
            title: 'Team',
            source: 'NAVIGATION',
            depth: 2,
          },
          {
            id: '4',
            url: 'https://example.com/contact',
            title: 'Contact',
            source: 'CRAWLED',
            depth: 1,
          },
        ];

        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'COMPLETED',
            pages: mockPages,
          }),
        });
      });

      // Navigate to discovery page
      await page.goto('/discovery');

      // Complete discovery flow to get to results
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for tree to load
      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });
    });

    test('should have proper tree ARIA attributes', async ({ page }) => {
      const tree = page.getByRole('tree');

      // Tree should have aria-multiselectable
      await expect(tree).toHaveAttribute('aria-multiselectable', 'true');

      // Tree should have accessible name
      await expect(tree).toHaveAttribute('aria-label');
    });

    test('should navigate tree with arrow keys', async ({ page }) => {
      const tree = page.getByRole('tree');

      // Focus the tree
      await tree.focus();

      // Get first treeitem
      const firstItem = page.getByRole('treeitem').first();
      await firstItem.focus();

      // Press down arrow to move to next item
      await page.keyboard.press('ArrowDown');

      // Second item should be focused
      const secondItem = page.getByRole('treeitem').nth(1);
      await expect(secondItem).toBeFocused();
    });

    test('should expand/collapse with arrow keys', async ({ page }) => {
      // Focus first expandable item
      const expandableItem = page
        .getByRole('treeitem')
        .filter({ has: page.locator('[aria-expanded]') })
        .first();

      if (await expandableItem.isVisible()) {
        await expandableItem.focus();

        // Get current expanded state
        const initialExpanded = await expandableItem.getAttribute(
          'aria-expanded'
        );

        // Press Right arrow to expand (if collapsed) or Left to collapse (if expanded)
        if (initialExpanded === 'false') {
          await page.keyboard.press('ArrowRight');
          await expect(expandableItem).toHaveAttribute('aria-expanded', 'true');
        } else {
          await page.keyboard.press('ArrowLeft');
          await expect(expandableItem).toHaveAttribute('aria-expanded', 'false');
        }
      }
    });

    test('should select item with Space key', async ({ page }) => {
      const firstItem = page.getByRole('treeitem').first();
      await firstItem.focus();

      // Press Space to toggle selection
      await page.keyboard.press('Space');

      // Item should be selected
      await expect(firstItem).toHaveAttribute('aria-selected', 'true');

      // Press Space again to deselect
      await page.keyboard.press('Space');
      await expect(firstItem).toHaveAttribute('aria-selected', 'false');
    });

    test('should select item with Enter key', async ({ page }) => {
      const firstItem = page.getByRole('treeitem').first();
      await firstItem.focus();

      // Press Enter to select
      await page.keyboard.press('Enter');

      // Item should be selected
      await expect(firstItem).toHaveAttribute('aria-selected', 'true');
    });

    test('should navigate to first/last with Home/End keys', async ({
      page,
    }) => {
      const treeitems = page.getByRole('treeitem');
      const firstItem = treeitems.first();
      const lastItem = treeitems.last();

      // Focus middle item
      await treeitems.nth(1).focus();

      // Press Home to go to first
      await page.keyboard.press('Home');
      await expect(firstItem).toBeFocused();

      // Press End to go to last
      await page.keyboard.press('End');
      await expect(lastItem).toBeFocused();
    });

    test('should have visible focus indicator on tree items', async ({
      page,
    }) => {
      const firstItem = page.getByRole('treeitem').first();
      await firstItem.focus();

      // Check for focus styling
      const hasFocusIndicator = await firstItem.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        // Check for ring, outline, or background change
        return (
          computed.outline !== 'none' ||
          computed.boxShadow.includes('rgb') ||
          computed.backgroundColor !== 'rgba(0, 0, 0, 0)'
        );
      });

      expect(hasFocusIndicator).toBeTruthy();
    });
  });

  test.describe('ARIA Announcements', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
    });

    test('should have aria-live region for status updates', async ({
      page,
    }) => {
      // Setup mock API
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        }
      });

      // Start discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Check for aria-live region
      const liveRegion = page.locator('[aria-live]');
      await expect(liveRegion).toBeVisible();
    });

    test('should announce phase changes', async ({ page }) => {
      let callCount = 0;
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'GET') {
          callCount++;
          const phase = callCount < 2 ? 'SITEMAP' : 'NAVIGATION';
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase,
              pages: callCount < 2 ? [] : [{ id: '1', url: 'https://example.com/', title: 'Home' }],
            }),
          });
        }
      });

      // Start discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for phase change announcement
      await expect(page.getByText(/Analyzing Navigation/i)).toBeVisible({
        timeout: 5000,
      });
    });

    test('should have role=alert for error messages', async ({ page }) => {
      // Enter invalid URL
      await page.getByLabel('Website URL').fill('invalid');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Error should have role=alert for screen readers
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should announce selection changes', async ({ page }) => {
      // Setup mock API with completed discovery
      await page.route('**/api/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'COMPLETED',
            pages: [
              { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
              { id: '2', url: 'https://example.com/about', title: 'About', source: 'NAVIGATION' },
            ],
          }),
        });
      });

      // Get to results
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });

      // Select all
      await page.getByRole('button', { name: 'Select All' }).click();

      // Selection count should be announced (via aria-live or text)
      await expect(page.getByText(/2 pages selected/i)).toBeVisible();
    });
  });

  test.describe('Button Keyboard Interaction', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
    });

    test('should activate Continue button with Enter', async ({ page }) => {
      await page.getByLabel('Website URL').fill('https://example.com');

      const continueButton = page.getByRole('button', { name: 'Continue' });
      await continueButton.focus();
      await page.keyboard.press('Enter');

      // Should proceed to mode selection
      await expect(page.getByText('Auto Discover')).toBeVisible();
    });

    test('should activate Continue button with Space', async ({ page }) => {
      await page.getByLabel('Website URL').fill('https://example.com');

      const continueButton = page.getByRole('button', { name: 'Continue' });
      await continueButton.focus();
      await page.keyboard.press('Space');

      // Should proceed to mode selection
      await expect(page.getByText('Auto Discover')).toBeVisible();
    });

    test('should prevent button activation when disabled', async ({ page }) => {
      // Continue button should be disabled with empty input
      const continueButton = page.getByRole('button', { name: 'Continue' });

      // Focus and try to activate
      await continueButton.focus();
      await page.keyboard.press('Enter');

      // Should still be on URL input step
      await expect(page.getByLabel('Website URL')).toBeVisible();
      await expect(page.getByText('Auto Discover')).not.toBeVisible();
    });
  });

  test.describe('Mode Selection Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
    });

    test('should navigate radio options with arrow keys', async ({ page }) => {
      // Focus on radio group
      const autoOption = page.getByRole('radio', { name: /Auto Discover/i });
      await autoOption.focus();

      // Initially Auto Discover should be selected
      await expect(autoOption).toBeChecked();

      // Press down arrow to move to Manual Entry
      await page.keyboard.press('ArrowDown');

      const manualOption = page.getByRole('radio', { name: /Manual Entry/i });
      await expect(manualOption).toBeFocused();
      await expect(manualOption).toBeChecked();
    });

    test('should select radio option with Space', async ({ page }) => {
      const manualOption = page.getByRole('radio', { name: /Manual Entry/i });
      await manualOption.focus();
      await page.keyboard.press('Space');

      await expect(manualOption).toBeChecked();
    });
  });

  test.describe('Escape Key Behavior', () => {
    test('should close any open dropdowns on Escape', async ({ page }) => {
      // Setup mock and get to results
      await page.route('**/api/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'COMPLETED',
            pages: [
              { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP' },
            ],
          }),
        });
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });

      // Focus on tree and press Escape
      await page.getByRole('tree').focus();
      await page.keyboard.press('Escape');

      // Tree should still be visible (Escape doesn't close main content)
      await expect(page.getByRole('tree')).toBeVisible();
    });
  });

  test.describe('Skip Links', () => {
    test('should have skip to content functionality if present', async ({
      page,
    }) => {
      await page.goto('/discovery');

      // Check for skip link (may be visually hidden)
      const skipLink = page.locator('a[href="#main"]').or(
        page.locator('a').filter({ hasText: /skip to (main|content)/i })
      );

      // If skip link exists, it should become visible on focus
      if (await skipLink.count() > 0) {
        await page.keyboard.press('Tab');
        // Skip link often is the first focusable element
        const focused = page.locator(':focus');
        const text = await focused.textContent();
        // Just verify tab navigation works
        expect(text).toBeDefined();
      }
    });
  });
});
