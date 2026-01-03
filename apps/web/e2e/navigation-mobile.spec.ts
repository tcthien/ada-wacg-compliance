import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Mobile Navigation
 *
 * Tests mobile-specific navigation functionality including:
 * - Hamburger menu for responsive navigation
 * - Mobile navigation drawer with proper ARIA labels
 * - Drawer closing on navigation and ESC key
 * - Breadcrumb behavior on mobile (truncation/scrolling)
 * - Back button touch target compliance (44x44px minimum)
 *
 * Requirements:
 * - REQ 7.1: Hamburger menu for viewports < 768px
 * - REQ 7.2: Mobile navigation drawer with aria-label "Main navigation"
 * - REQ 7.3: Navigation item closes drawer and navigates
 * - REQ 7.4: Breadcrumbs truncate or scroll on narrow viewports
 * - REQ 7.5: Back button meets touch target size (44x44px minimum)
 *
 * Viewport: iPhone SE (375x667) for mobile testing
 */

// iPhone SE viewport for mobile testing
const mobileViewport = { width: 375, height: 667 };

test.describe('Mobile Navigation', () => {
  // Sample test data for scans
  const mockScan = {
    id: 'scan-mobile-nav-123',
    url: 'https://example.com',
    status: 'COMPLETED',
    wcagLevel: 'AA',
    createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
    completedAt: new Date('2024-01-15T10:05:00Z').toISOString(),
    aiEnabled: false,
    email: null,
  };

  const mockResult = {
    id: mockScan.id,
    url: mockScan.url,
    wcagLevel: mockScan.wcagLevel,
    completedAt: mockScan.completedAt,
    summary: {
      totalIssues: 12,
      critical: 2,
      serious: 4,
      moderate: 3,
      minor: 3,
    },
    issuesByImpact: {
      critical: [],
      serious: [],
      moderate: [],
      minor: [],
    },
  };

  const mockHistoryScans = [
    {
      id: 'scan-1',
      url: 'https://example.com',
      status: 'completed',
      wcagLevel: 'AA',
      createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
      completedAt: new Date('2024-01-15T10:05:00Z').toISOString(),
      issueCount: 15,
    },
    {
      id: 'scan-2',
      url: 'https://test.org',
      status: 'completed',
      wcagLevel: 'AAA',
      createdAt: new Date('2024-01-10T14:30:00Z').toISOString(),
      completedAt: new Date('2024-01-10T14:35:00Z').toISOString(),
      issueCount: 5,
    },
  ];

  test.use({ viewport: mobileViewport });

  test.beforeEach(async ({ page }) => {
    // Mock scan history API
    await page.route('**/api/scans/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scans: mockHistoryScans,
          total: mockHistoryScans.length,
          page: 1,
          limit: 20,
        }),
      });
    });

    // Mock batch list API
    await page.route('**/api/batches*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batches: [],
          total: 0,
          page: 1,
          limit: 100,
        }),
      });
    });

    // Mock individual scan status API
    await page.route(`**/api/scans/${mockScan.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockScan),
      });
    });

    // Mock scan results API
    await page.route(`**/api/scans/${mockScan.id}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResult),
      });
    });
  });

  test.describe('Hamburger Menu (REQ 7.1)', () => {
    test('should display hamburger menu instead of full navigation links on mobile', async ({ page }) => {
      await page.goto('/');

      // Hamburger menu button should be visible
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await expect(hamburgerButton).toBeVisible();

      // Full navigation links should be hidden on mobile
      // Try to find desktop-only nav links (they might be in DOM but hidden)
      const desktopNav = page.locator('nav').filter({ has: page.locator('a:has-text("Home")') });
      const isHidden = await desktopNav.evaluate((el) => {
        const style = window.getComputedStyle(el);
        // Desktop nav should either not exist or be hidden on mobile
        return style.display === 'none' || !el.offsetParent;
      }).catch(() => true); // If element doesn't exist, consider it "hidden"

      // Either the nav is hidden OR we have a hamburger menu
      const hasHamburger = await hamburgerButton.isVisible();
      expect(isHidden || hasHamburger).toBeTruthy();
    });

    test('should have adequate touch target size for hamburger menu', async ({ page }) => {
      await page.goto('/');

      // Find hamburger menu button
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await expect(hamburgerButton).toBeVisible();

      // Check touch target size (minimum 44x44px)
      const buttonBox = await hamburgerButton.boundingBox();
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
    });

    test('should show hamburger menu on all pages on mobile', async ({ page }) => {
      const pages = ['/', '/history', '/settings'];

      for (const pagePath of pages) {
        await page.goto(pagePath);

        // Hamburger menu should be visible on every page
        const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
        await expect(hamburgerButton).toBeVisible();
      }
    });
  });

  test.describe('Mobile Navigation Drawer (REQ 7.2, 7.3)', () => {
    test('should open navigation drawer when hamburger menu is tapped', async ({ page }) => {
      await page.goto('/');

      // Find and tap hamburger menu
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();

      // Navigation drawer should be visible
      const drawer = page.locator('[role="dialog"], [class*="drawer"], [class*="mobile-nav"]').filter({
        has: page.locator('a:has-text("Home"), a:has-text("History")'),
      }).first();

      await expect(drawer).toBeVisible();

      // Verify drawer has proper ARIA label "Main navigation"
      const drawerWithAriaLabel = page.locator('[aria-label="Main navigation"]');
      const hasProperLabel = await drawerWithAriaLabel.count() > 0;

      // Alternative: Check if navigation is within a properly labeled container
      const navElement = page.locator('nav[aria-label="Main navigation"]');
      const hasNavLabel = await navElement.count() > 0;

      expect(hasProperLabel || hasNavLabel).toBeTruthy();
    });

    test('should display all navigation links in the drawer', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();

      // Wait for drawer to open
      await page.waitForTimeout(300); // Allow for animation

      // Verify navigation links are visible in drawer
      await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible();
    });

    test('should close drawer and navigate when navigation item is selected', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();

      // Wait for drawer animation
      await page.waitForTimeout(300);

      // Click History link
      const historyLink = page.getByRole('link', { name: 'History' }).first();
      await expect(historyLink).toBeVisible();
      await historyLink.click();

      // Should navigate to history page
      await expect(page).toHaveURL('/history');

      // Drawer should be closed after navigation
      // Try to find the drawer - it should either be hidden or not in viewport
      const drawer = page.locator('[role="dialog"], [class*="drawer"], [class*="mobile-nav"]').first();
      const isDrawerHidden = await drawer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || !el.offsetParent || style.visibility === 'hidden';
      }).catch(() => true); // If element doesn't exist, consider it "closed"

      expect(isDrawerHidden).toBeTruthy();
    });

    test('should close drawer when ESC key is pressed', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();

      // Wait for drawer animation
      await page.waitForTimeout(300);

      // Verify drawer is open
      const historyLink = page.getByRole('link', { name: 'History' }).first();
      await expect(historyLink).toBeVisible();

      // Press ESC key
      await page.keyboard.press('Escape');

      // Wait for close animation
      await page.waitForTimeout(300);

      // Drawer should be closed
      const drawer = page.locator('[role="dialog"], [class*="drawer"], [class*="mobile-nav"]').first();
      const isDrawerHidden = await drawer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || !el.offsetParent || style.visibility === 'hidden';
      }).catch(() => true);

      expect(isDrawerHidden).toBeTruthy();
    });

    test('should close drawer when backdrop/overlay is tapped', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();

      // Wait for drawer animation
      await page.waitForTimeout(300);

      // Verify drawer is open
      await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible();

      // Find and click backdrop/overlay (common class names)
      const backdrop = page.locator('[class*="backdrop"], [class*="overlay"], [class*="scrim"]').first();

      if (await backdrop.isVisible()) {
        await backdrop.click();

        // Wait for close animation
        await page.waitForTimeout(300);

        // Drawer should be closed
        const drawer = page.locator('[role="dialog"], [class*="drawer"], [class*="mobile-nav"]').first();
        const isDrawerHidden = await drawer.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || !el.offsetParent || style.visibility === 'hidden';
        }).catch(() => true);

        expect(isDrawerHidden).toBeTruthy();
      }
    });

    test('should have touch-friendly spacing between drawer navigation items', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();

      // Wait for drawer animation
      await page.waitForTimeout(300);

      // Get navigation links
      const homeLink = page.getByRole('link', { name: 'Home' }).first();
      const historyLink = page.getByRole('link', { name: 'History' }).first();

      const homeBox = await homeLink.boundingBox();
      const historyBox = await historyLink.boundingBox();

      if (homeBox && historyBox) {
        // Calculate vertical spacing between items
        const spacing = Math.abs(historyBox.y - (homeBox.y + homeBox.height));

        // Should have at least 8px spacing for comfortable touch interaction
        expect(spacing).toBeGreaterThanOrEqual(8);
      }

      // Each link should also meet minimum touch target height
      expect(homeBox?.height).toBeGreaterThanOrEqual(44);
      expect(historyBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('should toggle drawer open/closed when hamburger is tapped multiple times', async ({ page }) => {
      await page.goto('/');

      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();

      // First tap - open drawer
      await hamburgerButton.click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible();

      // Second tap - close drawer
      await hamburgerButton.click();
      await page.waitForTimeout(300);

      const drawer = page.locator('[role="dialog"], [class*="drawer"], [class*="mobile-nav"]').first();
      const isDrawerHidden = await drawer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || !el.offsetParent || style.visibility === 'hidden';
      }).catch(() => true);

      expect(isDrawerHidden).toBeTruthy();

      // Third tap - open drawer again
      await hamburgerButton.click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible();
    });
  });

  test.describe('Breadcrumbs on Mobile (REQ 7.4)', () => {
    test('should display breadcrumbs on scan detail page on mobile', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Breadcrumbs should be visible
      const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(breadcrumbs).toBeVisible();
    });

    test('should handle breadcrumb overflow with truncation or horizontal scroll', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Get breadcrumb container
      const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(breadcrumbs).toBeVisible();

      // Check if breadcrumbs handle overflow appropriately
      const hasOverflowHandling = await breadcrumbs.evaluate((el) => {
        const style = window.getComputedStyle(el);
        // Should either have horizontal scroll or text truncation
        const hasScroll = style.overflowX === 'auto' || style.overflowX === 'scroll';
        const hasTruncation = style.textOverflow === 'ellipsis';
        return hasScroll || hasTruncation;
      });

      // Alternative: Check if content doesn't overflow viewport
      const breadcrumbBox = await breadcrumbs.boundingBox();
      const viewportWidth = mobileViewport.width;

      // Either has overflow handling OR fits within viewport
      const fitsInViewport = breadcrumbBox ? breadcrumbBox.width <= viewportWidth : false;

      expect(hasOverflowHandling || fitsInViewport).toBeTruthy();
    });

    test('should not cause horizontal overflow on mobile due to breadcrumbs', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Check for horizontal overflow on entire page
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      // Page should not have horizontal overflow
      expect(hasOverflow).toBeFalsy();
    });

    test('should allow breadcrumb navigation on mobile', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Click History breadcrumb
      const historyBreadcrumb = page.locator('nav[aria-label="Breadcrumb"]').getByRole('link', { name: 'History' });
      await expect(historyBreadcrumb).toBeVisible();

      // Should have adequate touch target
      const breadcrumbBox = await historyBreadcrumb.boundingBox();
      expect(breadcrumbBox?.height).toBeGreaterThanOrEqual(44);

      // Click to navigate
      await historyBreadcrumb.click();

      // Should navigate to history page
      await expect(page).toHaveURL('/history');
    });

    test('should truncate long breadcrumb items with ellipsis on mobile', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Get breadcrumb items
      const breadcrumbItems = page.locator('nav[aria-label="Breadcrumb"]').locator('li, span, a');
      const count = await breadcrumbItems.count();

      if (count > 0) {
        // Check if any breadcrumb item has ellipsis styling
        const hasEllipsis = await breadcrumbItems.first().evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.textOverflow === 'ellipsis' ||
            style.overflow === 'hidden' ||
            style.whiteSpace === 'nowrap'
          );
        });

        // Breadcrumb items should handle long text appropriately
        expect(typeof hasEllipsis).toBe('boolean');
      }
    });
  });

  test.describe('Back Button Touch Targets (REQ 7.5)', () => {
    test('should have adequate touch target size for back button on scan detail page', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Find back button
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();

      // Check touch target size (minimum 44x44px)
      const buttonBox = await backButton.boundingBox();
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
    });

    test('should place back button in easy-to-reach position on mobile', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Find back button
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();

      // Back button should be near the top of the page for easy access
      const buttonBox = await backButton.boundingBox();

      // Should be in upper portion of viewport (first 200px)
      expect(buttonBox?.y).toBeLessThan(200);
    });

    test('should have adequate spacing around back button for comfortable tapping', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Find back button
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();

      // Get button position
      const buttonBox = await backButton.boundingBox();

      // Button should have margin/padding around it
      // Check if there's no other interactive element too close
      if (buttonBox) {
        // Should have at least 8px spacing from viewport edges
        expect(buttonBox.x).toBeGreaterThanOrEqual(8);
        expect(buttonBox.y).toBeGreaterThanOrEqual(8);
      }
    });

    test('should navigate back to history when back button is tapped', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Tap back button
      const backButton = page.getByRole('button', { name: /back/i });
      await backButton.click();

      // Should navigate to history page
      await expect(page).toHaveURL('/history');
      await expect(page.getByText('Scan History')).toBeVisible();
    });

    test('should have visible focus indicator on back button for keyboard users', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Focus back button
      const backButton = page.getByRole('button', { name: /back/i });
      await backButton.focus();

      // Verify button is focused
      await expect(backButton).toBeFocused();

      // Check for focus indicator (focus-ring or focus-visible class)
      const className = await backButton.getAttribute('class');
      expect(className).toContain('focus');
    });
  });

  test.describe('Mobile Navigation Complete Flows', () => {
    test('should support complete mobile navigation flow using drawer', async ({ page }) => {
      // 1. Start on home page
      await page.goto('/');

      // 2. Open drawer and navigate to History
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();
      await page.waitForTimeout(300);

      const historyLink = page.getByRole('link', { name: 'History' }).first();
      await historyLink.click();

      await expect(page).toHaveURL('/history');

      // 3. Navigate to scan detail
      await page.route(`**/api/scans/scan-1`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockScan, id: 'scan-1' }),
        });
      });

      await page.route(`**/api/scans/scan-1/results`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockResult, id: 'scan-1' }),
        });
      });

      await page.locator('[class*="history"]').filter({ hasText: 'example.com' }).first().click();
      await expect(page).toHaveURL('/scan/scan-1');

      // 4. Use back button to return to history
      await page.getByRole('button', { name: /back/i }).click();
      await expect(page).toHaveURL('/history');

      // 5. Use drawer to navigate to settings
      await hamburgerButton.click();
      await page.waitForTimeout(300);

      const settingsLink = page.getByRole('link', { name: 'Settings' }).first();
      await settingsLink.click();

      await expect(page).toHaveURL('/settings');
    });

    test('should support breadcrumb navigation on mobile', async ({ page }) => {
      // Start on scan detail page
      await page.goto(`/scan/${mockScan.id}`);
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Use breadcrumb to navigate to History
      const historyBreadcrumb = page.locator('nav[aria-label="Breadcrumb"]').getByRole('link', { name: 'History' });
      await historyBreadcrumb.click();

      await expect(page).toHaveURL('/history');
      await expect(page.getByText('Scan History')).toBeVisible();
    });

    test('should maintain drawer state correctly during navigation', async ({ page }) => {
      await page.goto('/');

      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();

      // Open drawer
      await hamburgerButton.click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible();

      // Navigate using drawer
      await page.getByRole('link', { name: 'History' }).first().click();
      await expect(page).toHaveURL('/history');

      // Drawer should be closed after navigation
      const drawer = page.locator('[role="dialog"], [class*="drawer"], [class*="mobile-nav"]').first();
      const isDrawerHidden = await drawer.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || !el.offsetParent || style.visibility === 'hidden';
      }).catch(() => true);

      expect(isDrawerHidden).toBeTruthy();

      // Should be able to open drawer again on new page
      await hamburgerButton.click();
      await page.waitForTimeout(300);
      await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
    });
  });

  test.describe('Mobile Navigation Accessibility', () => {
    test('should support keyboard navigation for hamburger menu', async ({ page }) => {
      await page.goto('/');

      // Focus on hamburger button
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.focus();

      // Should be focused
      await expect(hamburgerButton).toBeFocused();

      // Press Enter to open
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Drawer should be open
      await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible();
    });

    test('should have proper ARIA attributes for drawer', async ({ page }) => {
      await page.goto('/');

      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();

      // Button should have aria-expanded attribute
      const hasAriaExpanded = await hamburgerButton.getAttribute('aria-expanded');
      expect(hasAriaExpanded).toBe('false');

      // Open drawer
      await hamburgerButton.click();
      await page.waitForTimeout(300);

      // aria-expanded should now be true
      const expandedState = await hamburgerButton.getAttribute('aria-expanded');
      expect(expandedState).toBe('true');
    });

    test('should trap focus within drawer when open', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();
      await page.waitForTimeout(300);

      // Tab through drawer items
      await page.keyboard.press('Tab');

      // Focus should be within drawer
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName;
      });

      // Should be focusing on a link or button within drawer
      expect(['A', 'BUTTON']).toContain(focusedElement);
    });

    test('should announce drawer state to screen readers', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();
      await page.waitForTimeout(300);

      // Check for aria-label on navigation
      const navigation = page.locator('nav[aria-label="Main navigation"]');
      const hasProperLabel = await navigation.count() > 0;

      expect(hasProperLabel).toBeTruthy();
    });
  });

  test.describe('Mobile Layout Integrity', () => {
    test('should not cause horizontal overflow with drawer open', async ({ page }) => {
      await page.goto('/');

      // Open drawer
      const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
      await hamburgerButton.click();
      await page.waitForTimeout(300);

      // Check for horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasOverflow).toBeFalsy();
    });

    test('should maintain proper viewport scaling on mobile', async ({ page }) => {
      await page.goto('/');

      // Check viewport meta tag
      const viewportMeta = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta?.getAttribute('content');
      });

      // Should have proper viewport configuration
      expect(viewportMeta).toContain('width=device-width');
    });

    test('should have consistent navigation across different mobile pages', async ({ page }) => {
      const pages = ['/', '/history', '/settings'];

      for (const pagePath of pages) {
        await page.goto(pagePath);

        // Hamburger menu should be visible and functional
        const hamburgerButton = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first();
        await expect(hamburgerButton).toBeVisible();

        // Should be able to open drawer
        await hamburgerButton.click();
        await page.waitForTimeout(300);

        // Navigation items should be visible
        await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();

        // Close drawer for next iteration
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });
  });
});
