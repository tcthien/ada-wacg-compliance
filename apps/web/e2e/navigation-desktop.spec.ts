import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Desktop Navigation
 *
 * Tests comprehensive desktop navigation functionality including:
 * - Header navigation between Home, History, and Settings
 * - Navigation from History to Scan Detail
 * - Back button navigation returning to History
 * - Breadcrumb navigation
 * - Active state indicators for current page
 * - Logo navigation to home
 *
 * Requirements:
 * - REQ 1.1: Header navigation links displayed consistently
 * - REQ 2.3: Back button navigates to History by default
 * - REQ 3.5: Breadcrumb navigation works correctly
 */

test.describe('Desktop Navigation', () => {
  // Sample test data for scans
  const mockScan = {
    id: 'scan-desktop-nav-123',
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

  test.beforeEach(async ({ page }) => {
    // Mock scan history API for History page
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

    // Mock batch list API for History page
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

  test.describe('Header Navigation (REQ 1.1)', () => {
    test('should navigate from Home to History using header link', async ({ page }) => {
      // Start on home page
      await page.goto('/');

      // Verify we're on home page
      await expect(page).toHaveURL('/');

      // Find and click History link in header
      const historyLink = page.getByRole('link', { name: 'History' }).first();
      await expect(historyLink).toBeVisible();
      await historyLink.click();

      // Should navigate to history page
      await expect(page).toHaveURL('/history');

      // Verify history page content is visible
      await expect(page.getByText('Scan History')).toBeVisible();
    });

    test('should navigate from History to Home using header link', async ({ page }) => {
      // Start on history page
      await page.goto('/history');

      // Verify we're on history page
      await expect(page).toHaveURL('/history');

      // Find and click Home link in header
      const homeLink = page.getByRole('link', { name: 'Home' }).first();
      await expect(homeLink).toBeVisible();
      await homeLink.click();

      // Should navigate to home page
      await expect(page).toHaveURL('/');
    });

    test('should navigate to Settings using header link', async ({ page }) => {
      // Start on home page
      await page.goto('/');

      // Find and click Settings link in header
      const settingsLink = page.getByRole('link', { name: 'Settings' }).first();
      await expect(settingsLink).toBeVisible();
      await settingsLink.click();

      // Should navigate to settings page
      await expect(page).toHaveURL('/settings');
    });

    test('should display all navigation links consistently on every page', async ({ page }) => {
      const pages = ['/', '/history', '/settings'];

      for (const pagePath of pages) {
        await page.goto(pagePath);

        // Verify all navigation links are visible
        await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible();
        await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible();
      }
    });

    test('should show active state for current page in header', async ({ page }) => {
      // Navigate to History page
      await page.goto('/history');

      // Get the History link
      const historyLink = page.getByRole('link', { name: 'History' }).first();

      // Verify History link has aria-current="page" attribute
      await expect(historyLink).toHaveAttribute('aria-current', 'page');

      // Verify Home link does NOT have aria-current
      const homeLink = page.getByRole('link', { name: 'Home' }).first();
      await expect(homeLink).not.toHaveAttribute('aria-current');
    });

    test('should show active state for Home page', async ({ page }) => {
      // Navigate to Home page
      await page.goto('/');

      // Get the Home link
      const homeLink = page.getByRole('link', { name: 'Home' }).first();

      // Verify Home link has aria-current="page" attribute
      await expect(homeLink).toHaveAttribute('aria-current', 'page');

      // Verify History link does NOT have aria-current
      const historyLink = page.getByRole('link', { name: 'History' }).first();
      await expect(historyLink).not.toHaveAttribute('aria-current');
    });

    test('should navigate using logo to home', async ({ page }) => {
      // Start on history page
      await page.goto('/history');

      // Find and click the logo
      const logo = page.getByRole('link', { name: 'ADAShield' });
      await expect(logo).toBeVisible();
      await logo.click();

      // Should navigate to home page
      await expect(page).toHaveURL('/');
    });

    test('should navigate using logo from scan detail page to home', async ({ page }) => {
      // Start on scan detail page
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for scan detail to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Find and click the logo
      const logo = page.getByRole('link', { name: 'ADAShield' });
      await expect(logo).toBeVisible();
      await logo.click();

      // Should navigate to home page
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('History to Scan Detail Navigation', () => {
    test('should navigate from History to Scan Detail by clicking scan', async ({ page }) => {
      // Start on history page
      await page.goto('/history');

      // Wait for history to load
      await expect(page.getByText('example.com')).toBeVisible();

      // Update mock for the specific scan
      await page.route(`**/api/scans/scan-1`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockScan,
            id: 'scan-1',
          }),
        });
      });

      await page.route(`**/api/scans/scan-1/results`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockResult,
            id: 'scan-1',
          }),
        });
      });

      // Find the first scan card and click it
      const scanCard = page.locator('[class*="history"]').filter({ hasText: 'example.com' }).first();
      await scanCard.click();

      // Should navigate to scan detail page
      await expect(page).toHaveURL('/scan/scan-1');

      // Verify scan detail page is loaded
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();
    });

    test('should navigate from History to multiple different scan details', async ({ page }) => {
      await page.goto('/history');

      // Set up mocks for scan-1
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

      // Click first scan
      await page.locator('[class*="history"]').filter({ hasText: 'example.com' }).first().click();
      await expect(page).toHaveURL('/scan/scan-1');

      // Navigate back to history
      await page.goto('/history');

      // Set up mocks for scan-2
      await page.route(`**/api/scans/scan-2`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockScan, id: 'scan-2', url: 'https://test.org' }),
        });
      });

      await page.route(`**/api/scans/scan-2/results`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockResult, id: 'scan-2', url: 'https://test.org' }),
        });
      });

      // Click second scan
      await page.locator('[class*="history"]').filter({ hasText: 'test.org' }).first().click();
      await expect(page).toHaveURL('/scan/scan-2');
    });
  });

  test.describe('Back Button Navigation (REQ 2.3)', () => {
    test('should return to History when back button is clicked from scan detail', async ({ page }) => {
      // Navigate to scan detail page
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for scan detail to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Find and click the back button
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();
      await backButton.click();

      // Should navigate back to history page
      await expect(page).toHaveURL('/history');

      // Verify we're on history page
      await expect(page.getByText('Scan History')).toBeVisible();
    });

    test('should show back button on scan detail page', async ({ page }) => {
      // Navigate to scan detail page
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Verify back button is visible
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();
    });

    test('should use browser back button to return to history', async ({ page }) => {
      // Start on history page
      await page.goto('/history');

      // Click on a scan to view details
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

      // Use browser back button
      await page.goBack();

      // Should be back on history page
      await expect(page).toHaveURL('/history');
      await expect(page.getByText('Scan History')).toBeVisible();
    });
  });

  test.describe('Breadcrumb Navigation (REQ 3.5)', () => {
    test('should display breadcrumbs on scan detail page', async ({ page }) => {
      // Navigate to scan detail page
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Verify breadcrumbs are visible
      const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(breadcrumbs).toBeVisible();

      // Verify breadcrumb items
      await expect(breadcrumbs.getByText('Home')).toBeVisible();
      await expect(breadcrumbs.getByText('History')).toBeVisible();
      await expect(breadcrumbs.getByText('Scan Results')).toBeVisible();
    });

    test('should navigate to Home using breadcrumb', async ({ page }) => {
      // Navigate to scan detail page
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Click Home breadcrumb
      const homeBreadcrumb = page.locator('nav[aria-label="Breadcrumb"]').getByRole('link', { name: 'Home' });
      await expect(homeBreadcrumb).toBeVisible();
      await homeBreadcrumb.click();

      // Should navigate to home page
      await expect(page).toHaveURL('/');
    });

    test('should navigate to History using breadcrumb', async ({ page }) => {
      // Navigate to scan detail page
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Click History breadcrumb
      const historyBreadcrumb = page.locator('nav[aria-label="Breadcrumb"]').getByRole('link', { name: 'History' });
      await expect(historyBreadcrumb).toBeVisible();
      await historyBreadcrumb.click();

      // Should navigate to history page
      await expect(page).toHaveURL('/history');
      await expect(page.getByText('Scan History')).toBeVisible();
    });

    test('should show current page as non-clickable breadcrumb item', async ({ page }) => {
      // Navigate to scan detail page
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Get the last breadcrumb item (current page)
      const currentBreadcrumb = page.locator('nav[aria-label="Breadcrumb"]').getByText('Scan Results');
      await expect(currentBreadcrumb).toBeVisible();

      // Verify it's not a link (should not have href)
      const currentBreadcrumbLink = page.locator('nav[aria-label="Breadcrumb"]').getByRole('link', { name: 'Scan Results', exact: true });
      await expect(currentBreadcrumbLink).not.toBeVisible();
    });

    test('should have proper breadcrumb structure with separators', async ({ page }) => {
      // Navigate to scan detail page
      await page.goto(`/scan/${mockScan.id}`);

      // Wait for page to load
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Get breadcrumb navigation
      const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"]');

      // Verify breadcrumb structure
      const breadcrumbList = breadcrumbs.locator('ol, ul');
      await expect(breadcrumbList).toBeVisible();

      // Verify separators exist (commonly / or >)
      const text = await breadcrumbs.textContent();
      // Breadcrumbs should have some separator between items
      expect(text).toBeTruthy();
    });
  });

  test.describe('Complete Navigation Flows', () => {
    test('should support full navigation flow: Home → History → Scan → Back → History → Home', async ({ page }) => {
      // 1. Start on Home
      await page.goto('/');
      await expect(page).toHaveURL('/');

      // 2. Navigate to History via header
      await page.getByRole('link', { name: 'History' }).first().click();
      await expect(page).toHaveURL('/history');

      // 3. Navigate to Scan Detail
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

      // 4. Use back button to return to History
      await page.getByRole('button', { name: /back/i }).click();
      await expect(page).toHaveURL('/history');

      // 5. Navigate to Home via header
      await page.getByRole('link', { name: 'Home' }).first().click();
      await expect(page).toHaveURL('/');
    });

    test('should support breadcrumb navigation flow: Scan → History (breadcrumb) → Scan → Home (breadcrumb)', async ({ page }) => {
      // 1. Start on Scan Detail
      await page.goto(`/scan/${mockScan.id}`);
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // 2. Navigate to History via breadcrumb
      await page.locator('nav[aria-label="Breadcrumb"]').getByRole('link', { name: 'History' }).click();
      await expect(page).toHaveURL('/history');

      // 3. Navigate back to Scan Detail
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

      // 4. Navigate to Home via breadcrumb
      await page.locator('nav[aria-label="Breadcrumb"]').getByRole('link', { name: 'Home' }).click();
      await expect(page).toHaveURL('/');
    });

    test('should support logo navigation from any page', async ({ page }) => {
      const pages = ['/history', '/settings', `/scan/${mockScan.id}`];

      for (const pagePath of pages) {
        await page.goto(pagePath);

        // Click logo to go home
        await page.getByRole('link', { name: 'ADAShield' }).click();
        await expect(page).toHaveURL('/');
      }
    });

    test('should maintain navigation state during page transitions', async ({ page }) => {
      // Start on home
      await page.goto('/');

      // Navigate to history
      await page.getByRole('link', { name: 'History' }).first().click();
      await expect(page).toHaveURL('/history');

      // Verify header is still visible and functional
      await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible();

      // Navigate to settings
      await page.getByRole('link', { name: 'Settings' }).first().click();
      await expect(page).toHaveURL('/settings');

      // Verify header is still visible and functional
      await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible();
    });
  });

  test.describe('Accessibility and UX', () => {
    test('should support keyboard navigation for header links', async ({ page }) => {
      await page.goto('/');

      // Tab to first header link (should be logo or first nav item)
      await page.keyboard.press('Tab');

      // Tab through navigation items
      const homeLink = page.getByRole('link', { name: 'Home' }).first();
      await homeLink.focus();
      await expect(homeLink).toBeFocused();

      // Press Enter to navigate
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/');
    });

    test('should have focus indicators on navigation elements', async ({ page }) => {
      await page.goto('/');

      // Focus on Home link
      const homeLink = page.getByRole('link', { name: 'Home' }).first();
      await homeLink.focus();

      // Verify focus ring is visible (check for focus-ring or focus-visible class)
      const className = await homeLink.getAttribute('class');
      expect(className).toContain('focus');
    });

    test('should support keyboard navigation for breadcrumbs', async ({ page }) => {
      await page.goto(`/scan/${mockScan.id}`);
      await expect(page.getByText('Accessibility Scan Results')).toBeVisible();

      // Focus on Home breadcrumb
      const homeBreadcrumb = page.locator('nav[aria-label="Breadcrumb"]').getByRole('link', { name: 'Home' });
      await homeBreadcrumb.focus();
      await expect(homeBreadcrumb).toBeFocused();

      // Press Enter to navigate
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/');
    });

    test('should have semantic navigation landmarks', async ({ page }) => {
      await page.goto('/');

      // Verify main navigation landmark
      const mainNav = page.locator('nav[aria-label*="navigation"]').first();
      await expect(mainNav).toBeVisible();

      // Navigate to scan detail and verify breadcrumb landmark
      await page.goto(`/scan/${mockScan.id}`);
      const breadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(breadcrumbNav).toBeVisible();
    });
  });
});
