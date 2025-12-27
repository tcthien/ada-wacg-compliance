import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Scan History
 *
 * Tests the scan history functionality:
 * 1. Navigate to history page
 * 2. View list of past scans
 * 3. Click to view scan details
 * 4. Filter/search history (if implemented)
 */

test.describe('Scan History', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the history API to return sample scans
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
              createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
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
              createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
              completedAt: new Date(Date.now() - 86300000).toISOString(),
              summary: {
                totalIssues: 0,
                critical: 0,
                serious: 0,
                moderate: 0,
                minor: 0,
              },
            },
            {
              scanId: 'scan-3',
              url: 'https://test.com',
              status: 'failed',
              wcagLevel: 'AA',
              createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
              error: 'Connection timeout',
            },
            {
              scanId: 'scan-4',
              url: 'https://processing.com',
              status: 'processing',
              wcagLevel: 'AA',
              createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
              progress: 75,
            },
          ],
          total: 4,
          page: 1,
          limit: 20,
        }),
      });
    });
  });

  test('should navigate to history page from header', async ({ page }) => {
    await page.goto('/');

    // Click History link in header
    await page.getByRole('link', { name: /history/i }).click();

    // Should navigate to history page
    await expect(page).toHaveURL(/\/history/);
  });

  test('should display history page with scan list', async ({ page }) => {
    await page.goto('/history');

    // Check page heading
    await expect(
      page.getByRole('heading', { name: /scan history/i })
    ).toBeVisible();

    // Check that scan cards are displayed
    await expect(page.getByText(/example\.com/)).toBeVisible();
    await expect(page.getByText(/example\.org/)).toBeVisible();
    await expect(page.getByText(/test\.com/)).toBeVisible();
  });

  test('should display scan status correctly', async ({ page }) => {
    await page.goto('/history');

    // Check for completed scans
    const completedCards = page.getByText(/completed/i);
    await expect(completedCards.first()).toBeVisible();

    // Check for failed scan
    await expect(page.getByText(/failed/i)).toBeVisible();

    // Check for processing scan
    await expect(page.getByText(/processing/i)).toBeVisible();
  });

  test('should show scan details in cards', async ({ page }) => {
    await page.goto('/history');

    // Check that URLs are displayed
    await expect(page.getByText('https://example.com')).toBeVisible();

    // Check that WCAG levels are displayed
    await expect(page.getByText(/level aa/i).first()).toBeVisible();
    await expect(page.getByText(/level aaa/i)).toBeVisible();

    // Check that issue counts are displayed for completed scans
    await expect(page.getByText(/5 issues/i)).toBeVisible();
    await expect(page.getByText(/0 issues/i)).toBeVisible();
  });

  test('should display relative timestamps', async ({ page }) => {
    await page.goto('/history');

    // Check for relative time indicators
    // These might be displayed as "1 hour ago", "1 day ago", etc.
    await expect(
      page.getByText(/ago/i).first()
    ).toBeVisible();
  });

  test('should navigate to scan details when clicking a scan', async ({ page }) => {
    const scanId = 'scan-1';

    // Mock the individual scan endpoint
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
          summary: { totalIssues: 5 },
          issues: [],
        }),
      });
    });

    await page.goto('/history');

    // Click on the first scan card (example.com)
    const scanCard = page.locator('a', { hasText: 'example.com' }).first();
    await scanCard.click();

    // Should navigate to scan details page
    await expect(page).toHaveURL(new RegExp(`/scan/${scanId}`));
  });

  test('should show empty state when no scans exist', async ({ page }) => {
    // Override the mock to return empty history
    await page.route('**/api/scans/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scans: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto('/history');

    // Check for empty state message
    await expect(
      page.getByText(/no scans yet/i)
    ).toBeVisible();

    // Should have a CTA to start a new scan
    await expect(
      page.getByRole('link', { name: /start.*scan/i })
    ).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/scans/history', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
        }),
      });
    });

    await page.goto('/history');

    // Should show error message
    await expect(
      page.getByText(/error.*loading/i)
    ).toBeVisible();

    // Should have retry option
    await expect(
      page.getByRole('button', { name: /retry/i })
    ).toBeVisible();
  });

  test('should show different visual indicators for scan status', async ({ page }) => {
    await page.goto('/history');

    // Look for status badges or indicators
    // Completed scans might have green/success indicators
    const completedIndicators = page.locator('[class*="success"], [class*="green"]');
    await expect(completedIndicators.first()).toBeVisible();

    // Failed scans might have red/error indicators
    const failedIndicators = page.locator('[class*="error"], [class*="red"]');
    await expect(failedIndicators.first()).toBeVisible();
  });

  test('should allow starting a new scan from history page', async ({ page }) => {
    await page.goto('/history');

    // Look for "New Scan" or similar button
    const newScanButton = page.getByRole('link', { name: /new scan|start scan/i });
    await expect(newScanButton).toBeVisible();

    // Click it
    await newScanButton.click();

    // Should navigate to home page
    await expect(page).toHaveURL(/^\/$|\/$/);
  });

  test('should show processing scans with progress indicator', async ({ page }) => {
    await page.goto('/history');

    // Find the processing scan
    const processingCard = page.locator('text=processing.com').locator('..');

    // Should show progress indicator (spinner, progress bar, etc.)
    await expect(
      processingCard.locator('[class*="progress"], [class*="spin"]').first()
    ).toBeVisible();
  });

  test('should display error message for failed scans', async ({ page }) => {
    await page.goto('/history');

    // Find the failed scan card
    const failedCard = page.locator('text=test.com').locator('..');

    // Should show error message
    await expect(failedCard).toContainText(/connection timeout/i);
  });

  test('should support pagination when many scans exist', async ({ page }) => {
    // Mock large history response
    const scans = Array.from({ length: 25 }, (_, i) => ({
      scanId: `scan-${i}`,
      url: `https://example-${i}.com`,
      status: 'completed',
      wcagLevel: 'AA',
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      summary: { totalIssues: i % 5 },
    }));

    await page.route('**/api/scans/history*', async (route) => {
      const url = new URL(route.request().url());
      const page_num = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const start = (page_num - 1) * limit;
      const end = start + limit;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scans: scans.slice(start, end),
          total: scans.length,
          page: page_num,
          limit,
        }),
      });
    });

    await page.goto('/history');

    // Should show pagination controls
    const nextButton = page.getByRole('button', { name: /next/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();

      // Should load page 2
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test('should refresh history when navigating back from scan details', async ({ page }) => {
    await page.goto('/history');

    // Click on a scan
    const scanId = 'scan-1';
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ scanId, status: 'completed' }),
      });
    });

    await page.route(`**/api/scans/${scanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ scanId, summary: {}, issues: [] }),
      });
    });

    await page.locator('a', { hasText: 'example.com' }).first().click();

    // Navigate back
    await page.goBack();

    // History page should be displayed again
    await expect(page).toHaveURL(/\/history/);
    await expect(
      page.getByRole('heading', { name: /scan history/i })
    ).toBeVisible();
  });
});
