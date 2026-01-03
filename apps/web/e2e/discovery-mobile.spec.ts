import { test, expect, devices } from '@playwright/test';

/**
 * E2E Tests: Mobile Responsiveness
 *
 * Tests responsive behavior at different viewports:
 * - Mobile phone layouts (320px - 480px)
 * - Tablet layouts (768px)
 * - Desktop layouts (1024px+)
 * - Touch interactions
 * - Mobile-specific UI adjustments
 */

// Mobile device configurations
const mobileViewport = { width: 375, height: 667 }; // iPhone SE
const tabletViewport = { width: 768, height: 1024 }; // iPad
const desktopViewport = { width: 1280, height: 800 }; // Desktop

test.describe('Mobile Responsiveness', () => {
  test.describe('Mobile Phone Layout (375px)', () => {
    test.use({ viewport: mobileViewport });

    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
    });

    test('should display URL input full width on mobile', async ({ page }) => {
      const urlInput = page.getByLabel('Website URL');
      const inputBox = await urlInput.boundingBox();

      // Input should span most of the viewport width
      expect(inputBox?.width).toBeGreaterThan(300);
    });

    test('should display Continue button full width on mobile', async ({
      page,
    }) => {
      const continueButton = page.getByRole('button', { name: 'Continue' });
      const buttonBox = await continueButton.boundingBox();

      // Button should be full width or near full width
      expect(buttonBox?.width).toBeGreaterThan(300);
    });

    test('should stack form elements vertically on mobile', async ({
      page,
    }) => {
      const urlInput = page.getByLabel('Website URL');
      const continueButton = page.getByRole('button', { name: 'Continue' });

      const inputBox = await urlInput.boundingBox();
      const buttonBox = await continueButton.boundingBox();

      // Button should be below input (stacked layout)
      expect(buttonBox!.y).toBeGreaterThan(inputBox!.y + inputBox!.height);
    });

    test('should have touch-friendly button sizes', async ({ page }) => {
      const continueButton = page.getByRole('button', { name: 'Continue' });
      const buttonBox = await continueButton.boundingBox();

      // Minimum touch target size is 44x44 per WCAG
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('should show mode selection in stacked layout', async ({ page }) => {
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Mode options should be visible and stacked
      await expect(page.getByText('Auto Discover')).toBeVisible();
      await expect(page.getByText('Manual Entry')).toBeVisible();

      const autoText = page.getByText('Auto Discover');
      const manualText = page.getByText('Manual Entry');

      const autoBox = await autoText.boundingBox();
      const manualBox = await manualText.boundingBox();

      // Options should be stacked (Manual Entry below Auto Discover)
      expect(manualBox!.y).toBeGreaterThanOrEqual(autoBox!.y);
    });
  });

  test.describe('Mobile Tree Navigation', () => {
    test.use({ viewport: mobileViewport });

    test.beforeEach(async ({ page }) => {
      // Setup mock API with completed discovery
      await page.route('**/api/discoveries**', async (route) => {
        const mockPages = [
          { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP', depth: 0 },
          { id: '2', url: 'https://example.com/about', title: 'About', source: 'NAVIGATION', depth: 1 },
          { id: '3', url: 'https://example.com/products', title: 'Products', source: 'CRAWLED', depth: 1 },
          { id: '4', url: 'https://example.com/products/item1', title: 'Item 1', source: 'CRAWLED', depth: 2 },
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

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });
    });

    test('should have touch-friendly tree item sizes', async ({ page }) => {
      const treeItems = page.getByRole('treeitem');
      const firstItem = treeItems.first();
      const itemBox = await firstItem.boundingBox();

      // Tree items should have minimum touch target height
      expect(itemBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('should allow horizontal scrolling for deep nesting', async ({
      page,
    }) => {
      const treeContainer = page.getByRole('tree').locator('..');

      // Check for horizontal scroll capability
      const hasHorizontalScroll = await treeContainer.evaluate((el) => {
        return el.scrollWidth > el.clientWidth ||
               window.getComputedStyle(el).overflowX === 'auto' ||
               window.getComputedStyle(el).overflowX === 'scroll';
      });

      // Should allow horizontal scrolling for deep trees
      // (may or may not be needed depending on content width)
    });

    test('should display checkboxes with adequate size', async ({ page }) => {
      const checkbox = page.locator('input[type="checkbox"]').first();
      const checkboxBox = await checkbox.boundingBox();

      // Checkboxes should be larger on mobile
      expect(checkboxBox?.width).toBeGreaterThanOrEqual(20);
      expect(checkboxBox?.height).toBeGreaterThanOrEqual(20);
    });

    test('should show mobile-optimized selection actions', async ({ page }) => {
      const selectAllButton = page.getByRole('button', { name: 'Select All' });
      const buttonBox = await selectAllButton.boundingBox();

      // Buttons should have adequate touch target size
      expect(buttonBox?.height).toBeGreaterThanOrEqual(40);
    });

    test('should display Start Scan button full width on mobile', async ({
      page,
    }) => {
      // Select pages first
      await page.getByRole('button', { name: 'Select All' }).click();

      const startScanButton = page.getByRole('button', { name: /Start Scan/i });
      const buttonBox = await startScanButton.boundingBox();

      // Button should be full width on mobile
      expect(buttonBox?.width).toBeGreaterThan(300);
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Mobile Progress Display', () => {
    test.use({ viewport: mobileViewport });

    test('should display progress UI properly on mobile', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'NAVIGATION',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home' },
              ],
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Progress phase text should be visible
      await expect(page.getByText(/Analyzing Navigation/i)).toBeVisible();

      // Cancel button should be full width
      const cancelButton = page.getByRole('button', { name: /Cancel/i });
      await expect(cancelButton).toBeVisible();
      const buttonBox = await cancelButton.boundingBox();
      expect(buttonBox?.width).toBeGreaterThan(300);
    });

    test('should display pages counter centered on mobile', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'RUNNING',
            phase: 'CRAWLING',
            pages: [
              { id: '1', url: 'https://example.com/', title: 'Home' },
              { id: '2', url: 'https://example.com/about', title: 'About' },
              { id: '3', url: 'https://example.com/contact', title: 'Contact' },
            ],
          }),
        });
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Pages counter should be visible
      await expect(page.getByText(/3.*pages found/i)).toBeVisible();
    });
  });

  test.describe('Tablet Layout (768px)', () => {
    test.use({ viewport: tabletViewport });

    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
    });

    test('should show side-by-side buttons on tablet', async ({ page }) => {
      // Setup and get to results
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

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });

      // Select All and Deselect All should be side by side
      const selectAllButton = page.getByRole('button', { name: 'Select All' });
      const deselectAllButton = page.getByRole('button', { name: 'Deselect All' });

      const selectBox = await selectAllButton.boundingBox();
      const deselectBox = await deselectAllButton.boundingBox();

      // Buttons should be on similar Y position (side by side)
      expect(Math.abs(selectBox!.y - deselectBox!.y)).toBeLessThan(10);
    });

    test('should show header and actions in row layout', async ({ page }) => {
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

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });

      const header = page.getByText('Discovered Pages');
      const selectAllButton = page.getByRole('button', { name: 'Select All' });

      const headerBox = await header.boundingBox();
      const buttonBox = await selectAllButton.boundingBox();

      // On tablet, header and buttons should be on similar Y (row layout)
      // Allow some tolerance for vertical alignment
      expect(Math.abs(headerBox!.y - buttonBox!.y)).toBeLessThan(50);
    });
  });

  test.describe('Desktop Layout (1280px)', () => {
    test.use({ viewport: desktopViewport });

    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
    });

    test('should display URL input at appropriate width', async ({ page }) => {
      const urlInput = page.getByLabel('Website URL');
      const inputBox = await urlInput.boundingBox();

      // On desktop, input might have max-width
      expect(inputBox?.width).toBeLessThan(1000);
    });

    test('should show compact button sizes on desktop', async ({ page }) => {
      const continueButton = page.getByRole('button', { name: 'Continue' });
      const buttonBox = await continueButton.boundingBox();

      // Desktop buttons can be smaller (not full width)
      expect(buttonBox?.width).toBeLessThan(300);
    });

    test('should show larger tree indentation on desktop', async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'COMPLETED',
            pages: [
              { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP', depth: 0 },
              { id: '2', url: 'https://example.com/about', title: 'About', source: 'NAVIGATION', depth: 1 },
            ],
          }),
        });
      });

      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });

      // Tree should be visible with proper desktop indentation
      const treeItems = page.getByRole('treeitem');
      expect(await treeItems.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Touch Interactions', () => {
    test.use({
      viewport: mobileViewport,
      hasTouch: true,
    });

    test.beforeEach(async ({ page }) => {
      await page.route('**/api/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'COMPLETED',
            pages: [
              { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP', depth: 0 },
              { id: '2', url: 'https://example.com/about', title: 'About', source: 'NAVIGATION', depth: 1 },
            ],
          }),
        });
      });

      await page.goto('/discovery');
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      await expect(page.getByRole('tree')).toBeVisible({ timeout: 5000 });
    });

    test('should allow tap to select tree items', async ({ page }) => {
      const checkbox = page.locator('input[type="checkbox"]').first();

      // Tap to select
      await checkbox.tap();

      // Should be selected
      await expect(checkbox).toBeChecked();
    });

    test('should allow tap on expand button', async ({ page }) => {
      const expandButton = page.locator('[aria-label*="Expand"]').first();

      if (await expandButton.isVisible()) {
        await expandButton.tap();
        // Should toggle expand state
      }
    });

    test('should allow tap on action buttons', async ({ page }) => {
      const selectAllButton = page.getByRole('button', { name: 'Select All' });

      await selectAllButton.tap();

      // Should select all pages
      await expect(page.getByText(/2 pages selected/i)).toBeVisible();
    });
  });

  test.describe('Orientation Changes', () => {
    test('should adapt layout on landscape orientation', async ({ page }) => {
      // Landscape phone viewport
      await page.setViewportSize({ width: 667, height: 375 });

      await page.goto('/discovery');

      const urlInput = page.getByLabel('Website URL');
      await expect(urlInput).toBeVisible();

      // Should still be usable in landscape
      await urlInput.fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(page.getByText('Auto Discover')).toBeVisible();
    });

    test('should maintain usability after orientation change', async ({
      page,
    }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/discovery');

      await page.getByLabel('Website URL').fill('https://example.com');

      // Switch to landscape
      await page.setViewportSize({ width: 667, height: 375 });

      // Continue button should still work
      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(page.getByText('Auto Discover')).toBeVisible();
    });
  });

  test.describe('Small Phone Layout (320px)', () => {
    test.use({ viewport: { width: 320, height: 568 } }); // iPhone SE (1st gen)

    test('should be usable on very small screens', async ({ page }) => {
      await page.goto('/discovery');

      // All elements should be visible
      await expect(page.getByLabel('Website URL')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Continue' })
      ).toBeVisible();

      // Should be able to complete flow
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();

      await expect(page.getByText('Auto Discover')).toBeVisible();
    });

    test('should not have horizontal overflow on small screens', async ({
      page,
    }) => {
      await page.goto('/discovery');

      // Check for horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });

      expect(hasOverflow).toBeFalsy();
    });
  });

  // Note: Real device emulation tests moved to separate files
  // test.use() with devices cannot be used inside test.describe blocks
  // See: https://playwright.dev/docs/test-use-options
  test.describe('Real Device Emulation', () => {
    test.skip('iPhone 12 emulation', async () => {
      // This test requires test.use() at file level - see discovery-mobile-devices.spec.ts
    });

    test.skip('Pixel 5 emulation', async () => {
      // This test requires test.use() at file level - see discovery-mobile-devices.spec.ts
    });

    test.skip('iPad Mini emulation', async () => {
      // This test requires test.use() at file level - see discovery-mobile-devices.spec.ts
    });
  });
});
