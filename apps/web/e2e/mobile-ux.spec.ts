import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Mobile UX and Responsiveness
 *
 * Tests mobile-specific UX improvements as per customer-ui-ux-improvement spec:
 * - REQ 8.1: Touch target sizes (44px minimum - WCAG 2.5.5)
 * - REQ 8.2: Full-width issue cards on mobile with adequate spacing
 * - REQ 8.3: Code snippet horizontal scroll with visual indicator
 * - REQ 10.5: Collapsible filters on mobile
 *
 * Viewport: iPhone SE (375x667) for mobile testing
 */

// iPhone SE viewport for mobile testing
const mobileViewport = { width: 375, height: 667 };

test.describe('Mobile UX - Touch Targets and Responsiveness', () => {
  test.use({ viewport: mobileViewport });

  test.describe('History Page - Mobile Filters', () => {
    test.beforeEach(async ({ page }) => {
      // Mock history API with sample data
      await page.route('**/api/scans/history', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            scans: [
              {
                scanId: 'scan-1',
                url: 'https://example.com',
                status: 'completed',
                wcagLevel: 'AA',
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                completedAt: new Date(Date.now() - 3500000).toISOString(),
                summary: {
                  totalIssues: 5,
                  critical: 1,
                  serious: 2,
                  moderate: 1,
                  minor: 1,
                },
              },
              {
                scanId: 'scan-2',
                url: 'https://example.org',
                status: 'completed',
                wcagLevel: 'AAA',
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                completedAt: new Date(Date.now() - 86300000).toISOString(),
                summary: {
                  totalIssues: 0,
                  critical: 0,
                  serious: 0,
                  moderate: 0,
                  minor: 0,
                },
              },
            ],
            total: 2,
            page: 1,
            limit: 20,
          }),
        });
      });

      await page.goto('/history');
    });

    test('should show collapsible filters button on mobile', async ({ page }) => {
      // REQ 10.5: Collapsible filters on mobile
      const filterButton = page.locator('button:has-text("Filters")');
      await expect(filterButton).toBeVisible();

      // Button should have adequate touch target size (44px minimum)
      const buttonBox = await filterButton.boundingBox();
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('should expand filters when button is clicked', async ({ page }) => {
      // Initially collapsed
      const filterButton = page.locator('button:has-text("Filters")');
      await expect(filterButton).toHaveAttribute('aria-expanded', 'false');

      // Filter content should be hidden initially
      const filterContent = page.locator('#filter-content');
      const initialHeight = await filterContent.evaluate((el) => el.clientHeight);
      expect(initialHeight).toBe(0);

      // Click to expand
      await filterButton.click();
      await expect(filterButton).toHaveAttribute('aria-expanded', 'true');

      // Filter content should now be visible with content
      const expandedHeight = await filterContent.evaluate((el) => el.clientHeight);
      expect(expandedHeight).toBeGreaterThan(100);

      // Should show filter controls
      await expect(page.locator('label:has-text("Start Date")')).toBeVisible();
      await expect(page.locator('label:has-text("End Date")')).toBeVisible();
      await expect(page.locator('label:has-text("Scan Type")')).toBeVisible();
      await expect(page.locator('label:has-text("Search by URL")')).toBeVisible();
    });

    test('should show active filter count badge when filters are applied', async ({ page }) => {
      const filterButton = page.locator('button:has-text("Filters")');

      // Initially no badge
      let badge = filterButton.locator('[class*="badge"]');
      await expect(badge).not.toBeVisible();

      // Expand filters
      await filterButton.click();

      // Apply a filter - select start date
      const startDateInput = page.locator('#start-date-filter');
      await startDateInput.fill('2024-01-01');

      // Collapse filters
      await filterButton.click();

      // Should show badge with count "1"
      badge = filterButton.locator('[class*="badge"]');
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('1');

      // Expand again and add another filter
      await filterButton.click();
      const scanTypeButton = page.locator('button:has-text("Single")');
      await scanTypeButton.click();

      // Collapse
      await filterButton.click();

      // Badge should now show "2"
      await expect(badge).toContainText('2');
    });

    test('should have touch-friendly filter controls on mobile', async ({ page }) => {
      const filterButton = page.locator('button:has-text("Filters")');
      await filterButton.click();

      // Date inputs should be touch-friendly
      const startDateInput = page.locator('#start-date-filter');
      const startDateBox = await startDateInput.boundingBox();
      expect(startDateBox?.height).toBeGreaterThanOrEqual(40);

      // Scan type filter buttons should be touch-friendly
      const singleButton = page.locator('button:has-text("Single")');
      const singleBox = await singleButton.boundingBox();
      expect(singleBox?.height).toBeGreaterThanOrEqual(40);
      expect(singleBox?.width).toBeGreaterThanOrEqual(60);

      // Search input should be touch-friendly
      const searchInput = page.locator('#url-search-filter');
      const searchBox = await searchInput.boundingBox();
      expect(searchBox?.height).toBeGreaterThanOrEqual(40);
    });

    test('should have adequate spacing between touch targets', async ({ page }) => {
      const filterButton = page.locator('button:has-text("Filters")');
      await filterButton.click();

      // Get scan type buttons
      const singleButton = page.locator('button:has-text("Single")');
      const batchButton = page.locator('button:has-text("Batch")');

      const singleBox = await singleButton.boundingBox();
      const batchBox = await batchButton.boundingBox();

      // Buttons should have at least 8px spacing
      if (singleBox && batchBox) {
        const spacing = batchBox.x - (singleBox.x + singleBox.width);
        expect(spacing).toBeGreaterThanOrEqual(8);
      }
    });
  });

  test.describe('Scan Results - Issue Cards on Mobile', () => {
    test.beforeEach(async ({ page }) => {
      const scanId = 'test-scan-mobile';

      // Mock scan metadata
      await page.route(`**/api/scans/${scanId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            scanId,
            url: 'https://example.com',
            status: 'completed',
            wcagLevel: 'AA',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }),
        });
      });

      // Mock scan results with various issue types
      await page.route(`**/api/scans/${scanId}/results`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            scanId,
            url: 'https://example.com',
            summary: {
              totalIssues: 3,
              critical: 1,
              serious: 1,
              moderate: 1,
              minor: 0,
            },
            issues: [
              {
                id: 'issue-1',
                impact: 'critical',
                help: 'Images must have alternate text',
                description: 'Ensures <img> elements have alternate text or a role of none or presentation',
                helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
                tags: ['cat.text-alternatives', 'wcag2a', 'wcag111', 'section508'],
                nodes: [
                  {
                    html: '<img src="logo.png">',
                    target: ['#header > img'],
                    failureSummary: 'Fix any of the following:\n  Element does not have an alt attribute',
                  },
                ],
              },
              {
                id: 'issue-2',
                impact: 'serious',
                help: 'Form elements must have labels',
                description: 'Ensures every form element has a label',
                helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/label',
                tags: ['cat.forms', 'wcag2a', 'wcag412', 'section508'],
                nodes: [
                  {
                    html: '<input type="text" name="email">',
                    target: ['#contact-form > input[name="email"]'],
                    failureSummary: 'Fix any of the following:\n  Form element does not have an implicit (wrapped) <label>\n  Form element does not have an explicit <label>',
                  },
                ],
              },
              {
                id: 'issue-3',
                impact: 'moderate',
                help: 'Links must have discernible text',
                description: 'Ensures links have discernible text',
                helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/link-name',
                tags: ['cat.name-role-value', 'wcag2a', 'wcag244', 'wcag412', 'section508'],
                nodes: [
                  {
                    html: '<a href="/contact"><i class="icon-mail"></i></a>',
                    target: ['nav > a:nth-child(3)'],
                    failureSummary: 'Fix all of the following:\n  Element does not have text that is visible to screen readers\n  aria-label attribute does not exist or is empty',
                  },
                ],
              },
            ],
          }),
        });
      });

      await page.goto(`/scan/${scanId}`);
      await page.waitForLoadState('networkidle');
    });

    test('should display issue cards full-width on mobile', async ({ page }) => {
      // REQ 8.2: Full-width cards on mobile
      const issueCards = page.locator('[class*="border"][class*="rounded"]').filter({
        has: page.locator('text=Images must have alternate text, text=Form elements must have labels, text=Links must have discernible text'),
      });

      const firstCard = issueCards.first();
      await expect(firstCard).toBeVisible();

      const cardBox = await firstCard.boundingBox();
      const viewportWidth = mobileViewport.width;

      // Card should span most of viewport width (accounting for container padding)
      // Typically 16px padding on each side = 32px total
      expect(cardBox?.width).toBeGreaterThan(viewportWidth - 40);
    });

    test('should have adequate spacing between issue cards on mobile', async ({ page }) => {
      // Get multiple issue cards
      const issueCards = page.locator('[class*="border"][class*="rounded"]').filter({
        has: page.locator('button[aria-expanded]'),
      });

      const count = await issueCards.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Check spacing between first two cards
      const firstCard = issueCards.nth(0);
      const secondCard = issueCards.nth(1);

      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();

      if (firstBox && secondBox) {
        // Vertical spacing between cards should be at least 8px
        const spacing = secondBox.y - (firstBox.y + firstBox.height);
        expect(spacing).toBeGreaterThanOrEqual(8);
      }
    });

    test('should have touch-friendly expand/collapse buttons on issue cards', async ({ page }) => {
      // REQ 8.1: Touch targets at least 44x44px
      const expandButtons = page.locator('button[aria-expanded]');
      const firstButton = expandButtons.first();

      await expect(firstButton).toBeVisible();

      const buttonBox = await firstButton.boundingBox();

      // Button should meet minimum touch target height
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);

      // Button should be full-width or near full-width for easy tapping
      expect(buttonBox?.width).toBeGreaterThan(300);
    });
  });

  test.describe('Scan Results - Code Snippet Horizontal Scroll', () => {
    test.beforeEach(async ({ page }) => {
      const scanId = 'test-scan-code';

      // Mock scan with long code snippets
      await page.route(`**/api/scans/${scanId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            scanId,
            url: 'https://example.com',
            status: 'completed',
            wcagLevel: 'AA',
            createdAt: new Date().toISOString(),
          }),
        });
      });

      await page.route(`**/api/scans/${scanId}/results`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            scanId,
            url: 'https://example.com',
            summary: { totalIssues: 1, critical: 1 },
            issues: [
              {
                id: 'issue-long-code',
                impact: 'critical',
                help: 'Images must have alternate text',
                description: 'Test issue with long code snippet',
                helpUrl: 'https://example.com',
                tags: ['cat.text-alternatives', 'wcag2a'],
                nodes: [
                  {
                    html: '<img src="https://example.com/very/long/path/to/image/file/that/exceeds/mobile/viewport/width.png" class="responsive-image img-fluid" alt="">',
                    target: ['#main-content > section.hero > div.container > img.responsive-image'],
                    failureSummary: 'Element does not have an alt attribute',
                  },
                ],
              },
            ],
          }),
        });
      });

      await page.goto(`/scan/${scanId}`);
      await page.waitForLoadState('networkidle');
    });

    test('should enable horizontal scroll for code snippets on mobile', async ({ page }) => {
      // REQ 8.3: Horizontal scroll for code snippets
      // Expand the issue card to see code snippet
      const expandButton = page.locator('button[aria-expanded]').first();
      await expandButton.click();

      // Wait for code snippet to be visible
      const codeContainer = page.locator('pre').first();
      await expect(codeContainer).toBeVisible();

      // Check that overflow-x is enabled
      const hasHorizontalScroll = await codeContainer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.overflowX === 'auto' || style.overflowX === 'scroll';
      });

      expect(hasHorizontalScroll).toBeTruthy();
    });

    test('should display gradient fade indicator on code snippets on mobile', async ({ page }) => {
      // REQ 8.3: Visual scroll indicator
      // Expand the issue card
      const expandButton = page.locator('button[aria-expanded]').first();
      await expandButton.click();

      // Find code container parent (relative positioning)
      const codeWrapper = page.locator('pre').first().locator('..');

      // Check for gradient overlay
      const gradientOverlay = codeWrapper.locator('[class*="gradient"]');
      await expect(gradientOverlay).toBeVisible();

      // Verify gradient styling
      const hasGradientClass = await gradientOverlay.evaluate((el) => {
        const classes = el.className;
        return classes.includes('gradient-to-l') || classes.includes('bg-gradient');
      });

      expect(hasGradientClass).toBeTruthy();

      // Gradient should be positioned on the right edge
      const overlayStyle = await gradientOverlay.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          right: style.right,
        };
      });

      expect(overlayStyle.position).toBe('absolute');
      expect(overlayStyle.right).toBe('0px');
    });

    test('should hide gradient indicator on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1024, height: 768 });

      // Expand issue card
      const expandButton = page.locator('button[aria-expanded]').first();
      await expandButton.click();

      // Find gradient overlay
      const codeWrapper = page.locator('pre').first().locator('..');
      const gradientOverlay = codeWrapper.locator('[class*="gradient"]');

      // Should be hidden on desktop (md:hidden class)
      const isHidden = await gradientOverlay.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || !el.offsetParent;
      });

      expect(isHidden).toBeTruthy();
    });

    test('should have scrollable fix example code on mobile', async ({ page }) => {
      // Expand issue card
      const expandButton = page.locator('button[aria-expanded]').first();
      await expandButton.click();

      // Wait for "How to Fix" section
      await expect(page.locator('text=How to Fix')).toBeVisible();

      // Find fix example code block
      const fixCodeBlock = page.locator('pre code').filter({ hasText: 'img' }).first();
      await expect(fixCodeBlock).toBeVisible();

      const codeContainer = fixCodeBlock.locator('..');

      // Should have horizontal scroll capability
      const hasScroll = await codeContainer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.overflowX === 'auto' || style.overflowX === 'scroll';
      });

      expect(hasScroll).toBeTruthy();

      // Should have gradient indicator
      const codeWrapper = codeContainer.locator('..');
      const gradientIndicator = codeWrapper.locator('[class*="gradient"]');
      await expect(gradientIndicator).toBeVisible();
    });
  });

  test.describe('Touch Target Compliance Across Pages', () => {
    test('should have 44px minimum touch targets on home page', async ({ page }) => {
      await page.goto('/');

      // Primary CTA button
      const ctaButton = page.locator('button:has-text("Scan"), button:has-text("Start")').first();
      if (await ctaButton.isVisible()) {
        const box = await ctaButton.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }

      // Header navigation links
      const navLinks = page.locator('header a');
      const count = await navLinks.count();
      for (let i = 0; i < count; i++) {
        const link = navLinks.nth(i);
        if (await link.isVisible()) {
          const box = await link.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should have 44px minimum touch targets on history page', async ({ page }) => {
      await page.route('**/api/scans/history', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ scans: [], total: 0 }),
        });
      });

      await page.goto('/history');

      // "Start new scan" link
      const startScanLink = page.locator('a:has-text("Start"), a:has-text("New Scan")').first();
      if (await startScanLink.isVisible()) {
        const box = await startScanLink.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }

      // Filter button
      const filterButton = page.locator('button:has-text("Filters")');
      if (await filterButton.isVisible()) {
        const box = await filterButton.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
    });

    test('should have adequate spacing between navigation items', async ({ page }) => {
      await page.goto('/');

      const navLinks = page.locator('header a').filter({ hasText: /History|Home|About/ });
      const count = await navLinks.count();

      if (count >= 2) {
        const firstLink = navLinks.nth(0);
        const secondLink = navLinks.nth(1);

        const firstBox = await firstLink.boundingBox();
        const secondBox = await secondLink.boundingBox();

        if (firstBox && secondBox) {
          // Calculate spacing (horizontal or vertical depending on layout)
          const horizontalSpacing = Math.abs(secondBox.x - (firstBox.x + firstBox.width));
          const verticalSpacing = Math.abs(secondBox.y - (firstBox.y + firstBox.height));

          const spacing = Math.min(horizontalSpacing, verticalSpacing);

          // Should have at least 8px spacing
          expect(spacing).toBeGreaterThanOrEqual(8);
        }
      }
    });
  });

  test.describe('Mobile Layout and Overflow', () => {
    test('should not have horizontal overflow on mobile pages', async ({ page }) => {
      const pages = ['/', '/history'];

      for (const path of pages) {
        if (path === '/history') {
          await page.route('**/api/scans/history', async (route) => {
            await route.fulfill({
              status: 200,
              body: JSON.stringify({ scans: [], total: 0 }),
            });
          });
        }

        await page.goto(path);

        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasOverflow).toBeFalsy();
      }
    });

    test('should stack elements vertically on mobile scan results', async ({ page }) => {
      const scanId = 'test-mobile-layout';

      await page.route(`**/api/scans/${scanId}`, async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            scanId,
            status: 'completed',
            url: 'https://example.com',
          }),
        });
      });

      await page.route(`**/api/scans/${scanId}/results`, async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            scanId,
            summary: { totalIssues: 1 },
            issues: [
              {
                id: 'issue-1',
                impact: 'critical',
                help: 'Test issue',
                description: 'Test',
                helpUrl: 'https://example.com',
                tags: ['wcag2a'],
                nodes: [{ html: '<div></div>', target: ['div'], failureSummary: 'Test' }],
              },
            ],
          }),
        });
      });

      await page.goto(`/scan/${scanId}`);
      await page.waitForLoadState('networkidle');

      // Elements should be stacked (Y position increases as we go down)
      const heading = page.locator('h1, h2').first();
      const issueCard = page.locator('[class*="border"][class*="rounded"]').first();

      const headingBox = await heading.boundingBox();
      const cardBox = await issueCard.boundingBox();

      // Issue card should be below heading
      expect(cardBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
    });
  });
});
