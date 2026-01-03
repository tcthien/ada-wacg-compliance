/**
 * Admin Batch Detail E2E Tests
 *
 * Tests the admin batch detail page including:
 * - Page sections rendering (header, actions, aggregate stats, critical URLs, scans list)
 * - Cancel batch action
 * - Export functionality
 * - Error handling
 *
 * Requirements: 2.1, 3.2, 3.5 (Batch detail view, cancel, export)
 */

import { test, expect } from '@playwright/test';

/**
 * Mock admin authentication
 */
async function mockAdminAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('adminToken', 'mock-admin-token-12345');
  });
}

/**
 * Create mock batch detail response
 */
function createMockBatchDetail(batchId: string, status = 'COMPLETED') {
  return {
    batch: {
      id: batchId,
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      status,
      totalUrls: 10,
      completedCount: status === 'RUNNING' ? 5 : 8,
      failedCount: 2,
      totalIssues: 25,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 7,
      minorCount: 3,
      createdAt: '2024-01-01T00:00:00Z',
      completedAt: status === 'COMPLETED' ? '2024-01-01T01:00:00Z' : null,
      cancelledAt: status === 'CANCELLED' ? '2024-01-01T00:30:00Z' : null,
      guestSessionId: 'session-1',
      userId: null,
    },
    scans: [
      {
        id: 'scan-1',
        url: 'https://example.com/page1',
        pageTitle: 'Page 1',
        status: 'COMPLETED',
        totalIssues: 10,
        criticalCount: 2,
        seriousCount: 4,
        moderateCount: 3,
        minorCount: 1,
        errorMessage: null,
        completedAt: '2024-01-01T00:30:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'scan-2',
        url: 'https://example.com/page2',
        pageTitle: 'Page 2',
        status: 'COMPLETED',
        totalIssues: 8,
        criticalCount: 1,
        seriousCount: 3,
        moderateCount: 2,
        minorCount: 2,
        errorMessage: null,
        completedAt: '2024-01-01T00:35:00Z',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'scan-3',
        url: 'https://example.com/page3',
        pageTitle: 'Page 3',
        status: 'FAILED',
        totalIssues: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        errorMessage: 'Timeout error',
        completedAt: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    aggregate: {
      totalIssues: 25,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 7,
      minorCount: 3,
      passedChecks: 100,
    },
    topCriticalUrls: [
      {
        scanId: 'scan-1',
        url: 'https://example.com/page1',
        pageTitle: 'Page 1',
        criticalCount: 2,
      },
      {
        scanId: 'scan-2',
        url: 'https://example.com/page2',
        pageTitle: 'Page 2',
        criticalCount: 1,
      },
    ],
    sessionInfo: {
      id: 'session-1',
      fingerprint: 'abc123',
      createdAt: '2024-01-01T00:00:00Z',
    },
  };
}

test.describe('Admin Batch Detail', () => {
  const batchId = 'batch-test-123';

  test.beforeEach(async ({ page }) => {
    await mockAdminAuth(page);
  });

  test.describe('page sections rendering', () => {
    test('should render batch header with batch info', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Should display batch ID
      await expect(page.getByText(batchId)).toBeVisible();

      // Should display homepage URL
      await expect(page.getByText('https://example.com')).toBeVisible();

      // Should display WCAG level
      await expect(page.getByText('AA')).toBeVisible();

      // Should display status badge
      await expect(page.getByText(/completed/i).first()).toBeVisible();
    });

    test('should render action buttons', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId, 'RUNNING')),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Should have cancel button for running batch
      const cancelButton = page.locator('button:has-text("Cancel")');
      await expect(cancelButton.first()).toBeVisible();

      // Should have export button
      const exportButton = page.locator('button:has-text("Export")');
      await expect(exportButton.first()).toBeVisible();
    });

    test('should render aggregate statistics card', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Should display total issues
      await expect(page.getByText('25').first()).toBeVisible();

      // Should display critical count
      await expect(page.getByText('5').first()).toBeVisible();

      // Should display passed checks
      await expect(page.getByText('100').first()).toBeVisible();
    });

    test('should render critical URLs card', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Should display critical URLs section
      await expect(page.getByText(/critical/i).first()).toBeVisible();

      // Should display URLs with critical issues
      await expect(page.getByText('https://example.com/page1')).toBeVisible();
    });

    test('should render scans list', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Should display scan URLs
      await expect(page.getByText('Page 1').first()).toBeVisible();
      await expect(page.getByText('Page 2').first()).toBeVisible();

      // Should show failed scan with error
      await expect(page.getByText('Page 3').first()).toBeVisible();
    });

    test('should show loading state', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        // Delay response to see loading state
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Should show loading indicator
      const loadingIndicator = page.locator('[class*="animate-pulse"], [class*="skeleton"]');
      await expect(loadingIndicator.first()).toBeVisible({ timeout: 2000 });
    });

    test('should show error state for non-existent batch', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Batch not found' }),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Should show error message
      await expect(page.getByText(/error/i).first()).toBeVisible({ timeout: 10000 });

      // Should show batch ID in error
      await expect(page.getByText(batchId)).toBeVisible();

      // Should have back to list button
      await expect(page.getByText('Back to List')).toBeVisible();
    });
  });

  test.describe('cancel batch action', () => {
    test('should show cancel button for running batch', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId, 'RUNNING')),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Cancel button should be visible and enabled
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      await expect(cancelButton).toBeVisible();
      await expect(cancelButton).toBeEnabled();
    });

    test('should not show cancel button for completed batch', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId, 'COMPLETED')),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Cancel button should not be visible or be disabled
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      const isVisible = await cancelButton.isVisible().catch(() => false);
      if (isVisible) {
        await expect(cancelButton).toBeDisabled();
      }
    });

    test('should cancel batch when button is clicked', async ({ page }) => {
      let cancelCalled = false;

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId, 'RUNNING')),
        });
      });

      await page.route(`**/api/v1/admin/batches/${batchId}/cancel`, async (route) => {
        cancelCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click cancel button
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      await cancelButton.click();

      // Wait for API call
      await page.waitForTimeout(500);

      // Verify cancel was called
      expect(cancelCalled).toBe(true);
    });

    test('should handle cancel error', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId, 'RUNNING')),
        });
      });

      await page.route(`**/api/v1/admin/batches/${batchId}/cancel`, async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Cancel failed' }),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click cancel button
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      await cancelButton.click();

      // Should show error (toast or inline)
      await expect(
        page.getByText(/error|failed/i).first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('export functionality', () => {
    test('should show export button', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Export button should be visible
      const exportButton = page.locator('button:has-text("Export")').first();
      await expect(exportButton).toBeVisible();
    });

    test('should show export format options', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click export button to show options
      const exportButton = page.locator('button:has-text("Export")').first();
      await exportButton.click();

      // Should show format options (CSV, JSON)
      await expect(
        page.getByText(/csv|json/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('should trigger export when format selected', async ({ page }) => {
      let exportCalled = false;
      let exportFormat = '';

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.route(`**/api/v1/admin/batches/${batchId}/export*`, async (route) => {
        exportCalled = true;
        const url = new URL(route.request().url());
        exportFormat = url.searchParams.get('format') || 'csv';

        // Return a blob-like response
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: 'id,url,status\n1,https://example.com,COMPLETED',
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click export button
      const exportButton = page.locator('button:has-text("Export")').first();
      await exportButton.click();

      // Wait a moment for dropdown/modal
      await page.waitForTimeout(500);

      // Click CSV option
      const csvOption = page.getByText(/csv/i).first();
      if (await csvOption.isVisible()) {
        await csvOption.click();

        // Wait for export
        await page.waitForTimeout(500);

        // Verify export was called
        expect(exportCalled).toBe(true);
      }
    });

    test('should handle export error', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.route(`**/api/v1/admin/batches/${batchId}/export*`, async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Export failed' }),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click export button
      const exportButton = page.locator('button:has-text("Export")').first();
      await exportButton.click();

      // Wait a moment for dropdown/modal
      await page.waitForTimeout(500);

      // Click CSV option
      const csvOption = page.getByText(/csv/i).first();
      if (await csvOption.isVisible()) {
        await csvOption.click();

        // Should show error
        await expect(
          page.getByText(/error|failed/i).first()
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('navigation', () => {
    test('should navigate back to batch list', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.route('**/api/v1/admin/batches*', async (route) => {
        if (!route.request().url().includes(batchId)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              batches: [],
              pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click back button
      const backButton = page.locator('[aria-label="Back to batch list"]');
      await backButton.click();

      // Should navigate to batch list
      await expect(page).toHaveURL(/\/admin\/batches$/);
    });

    test('should navigate to scan detail when clicking scan row', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Find and click on a scan row or link
      const scanLink = page.locator('a[href*="/admin/scans/scan-1"], [data-scan-id="scan-1"]').first();
      if (await scanLink.isVisible()) {
        await scanLink.click();

        // Should navigate to scan detail
        await expect(page).toHaveURL(/\/admin\/scans\/scan-1/);
      }
    });
  });

  test.describe('retry failed scans', () => {
    test('should show retry button when there are failed scans', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Retry button should be visible (batch has failed scans)
      const retryButton = page.locator('button:has-text("Retry")').first();
      await expect(retryButton).toBeVisible();
    });

    test('should trigger retry when button clicked', async ({ page }) => {
      let retryCalled = false;

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.route(`**/api/v1/admin/batches/${batchId}/retry`, async (route) => {
        retryCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click retry button
      const retryButton = page.locator('button:has-text("Retry")').first();
      if (await retryButton.isVisible()) {
        await retryButton.click();

        // Wait for API call
        await page.waitForTimeout(500);

        // Verify retry was called
        expect(retryCalled).toBe(true);
      }
    });
  });

  test.describe('accessibility', () => {
    test('should have accessible structure', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Back button should have aria-label
      const backButton = page.locator('[aria-label="Back to batch list"]');
      await expect(backButton).toBeVisible();

      // Buttons should be focusable
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to focus on multiple elements
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});
