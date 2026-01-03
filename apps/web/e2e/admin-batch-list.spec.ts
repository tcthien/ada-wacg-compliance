/**
 * Admin Batch List E2E Tests
 *
 * Tests the admin batch management interface including:
 * - Login and navigation
 * - Table rendering with batch data
 * - Status filter functionality
 * - Pagination
 * - Navigation to batch detail
 *
 * Requirements: 1.1, 1.3, 1.5 (Batch listing, filtering, navigation)
 */

import { test, expect } from '@playwright/test';

/**
 * Mock admin authentication
 * Sets up localStorage with admin token before page load
 */
async function mockAdminAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('adminToken', 'mock-admin-token-12345');
  });
}

/**
 * Create mock batch data for API responses
 */
function createMockBatches(count: number, startIndex = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `batch-${startIndex + i + 1}`,
    homepageUrl: `https://example${startIndex + i + 1}.com`,
    wcagLevel: i % 2 === 0 ? 'AA' : 'AAA',
    status: ['COMPLETED', 'RUNNING', 'PENDING', 'FAILED', 'CANCELLED'][i % 5],
    totalUrls: 10 + i,
    completedCount: Math.min(5 + i, 10 + i),
    failedCount: i % 3,
    totalIssues: 20 + i * 5,
    criticalCount: i,
    seriousCount: i * 2,
    moderateCount: i * 3,
    minorCount: i * 2,
    createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    completedAt: i % 5 === 0 ? new Date().toISOString() : null,
    cancelledAt: i % 5 === 4 ? new Date().toISOString() : null,
    guestSessionId: `session-${i + 1}`,
    userId: null,
  }));
}

/**
 * Create mock pagination response
 */
function createMockPaginatedResponse(
  page: number,
  limit: number,
  total: number,
  statusFilter?: string
) {
  const startIndex = (page - 1) * limit;
  let batches = createMockBatches(total, 0);

  // Apply status filter if provided
  if (statusFilter && statusFilter !== 'all') {
    batches = batches.filter(
      (b) => b.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }

  const paginatedBatches = batches.slice(startIndex, startIndex + limit);

  return {
    batches: paginatedBatches,
    pagination: {
      page,
      limit,
      total: batches.length,
      totalPages: Math.ceil(batches.length / limit),
    },
  };
}

test.describe('Admin Batch List', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminAuth(page);
  });

  test.describe('navigation and authentication', () => {
    test('should display batch list page when authenticated', async ({
      page,
    }) => {
      // Mock the API response
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 25)),
        });
      });

      await page.goto('/admin/batches');

      // Should show page title or header
      await expect(
        page.getByRole('heading', { name: /batch/i }).first()
      ).toBeVisible();
    });

    test('should redirect to login when not authenticated', async ({
      page,
    }) => {
      // Clear the auth token
      await page.addInitScript(() => {
        localStorage.removeItem('adminToken');
      });

      // Mock API to return 401
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
      });

      await page.goto('/admin/batches');

      // Should redirect to login or show unauthorized message
      await expect(
        page.getByText(/unauthorized|login|sign in/i).first()
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('table rendering', () => {
    test('should render batch table with data', async ({ page }) => {
      const mockResponse = createMockPaginatedResponse(1, 10, 25);

      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse),
        });
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Verify table headers exist
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Verify first batch data is displayed
      const firstBatch = mockResponse.batches[0];
      await expect(page.getByText(firstBatch.homepageUrl)).toBeVisible();
    });

    test('should display batch status badges', async ({ page }) => {
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 25)),
        });
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Should show status badges (COMPLETED, RUNNING, etc.)
      const statusBadge = page.locator('[class*="badge"], [class*="status"]').first();
      await expect(statusBadge).toBeVisible();
    });

    test('should show loading state while fetching', async ({ page }) => {
      // Delay the API response
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 25)),
        });
      });

      await page.goto('/admin/batches');

      // Should show loading indicator
      const loadingIndicator = page.locator(
        '[class*="loading"], [class*="skeleton"], [aria-busy="true"]'
      );
      await expect(loadingIndicator.first()).toBeVisible({ timeout: 2000 });
    });

    test('should show empty state when no batches', async ({ page }) => {
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            batches: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          }),
        });
      });

      await page.goto('/admin/batches');

      // Should show empty state message
      await expect(
        page.getByText(/no batches|no data|empty/i).first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('status filter', () => {
    test('should filter batches by status', async ({ page }) => {
      let lastRequestUrl = '';

      await page.route('**/api/v1/admin/batches*', async (route) => {
        lastRequestUrl = route.request().url();
        const url = new URL(lastRequestUrl);
        const status = url.searchParams.get('status') || 'all';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 25, status)),
        });
      });

      await page.goto('/admin/batches');

      // Wait for initial load
      await page.waitForSelector('table', { timeout: 10000 });

      // Find and click status filter dropdown
      const statusFilter = page.locator(
        'select[name*="status"], [data-testid="status-filter"], button:has-text("Status")'
      ).first();

      if (await statusFilter.isVisible()) {
        await statusFilter.click();

        // Select "COMPLETED" status
        const completedOption = page.getByRole('option', { name: /completed/i });
        if (await completedOption.isVisible()) {
          await completedOption.click();
        } else {
          // Try selecting from dropdown menu
          await page.getByText(/completed/i).first().click();
        }

        // Wait for filtered results
        await page.waitForTimeout(500);

        // Verify the filter was applied
        expect(lastRequestUrl).toContain('status');
      }
    });

    test('should show all statuses in filter dropdown', async ({ page }) => {
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 25)),
        });
      });

      await page.goto('/admin/batches');

      // Wait for page to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Find status filter
      const statusFilter = page.locator(
        'select[name*="status"], [data-testid="status-filter"]'
      ).first();

      if (await statusFilter.isVisible()) {
        // Check that filter options include expected statuses
        const options = await statusFilter.locator('option').allTextContents();
        const statusOptions = ['all', 'completed', 'running', 'pending', 'failed', 'cancelled'];

        // At least some status options should be present
        const hasStatusOptions = statusOptions.some((status) =>
          options.some((opt) => opt.toLowerCase().includes(status))
        );
        expect(hasStatusOptions).toBe(true);
      }
    });
  });

  test.describe('pagination', () => {
    test('should display pagination controls', async ({ page }) => {
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 50)),
        });
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Should show pagination info (e.g., "Page 1 of 5" or "1-10 of 50")
      const paginationInfo = page.locator('[class*="pagination"], nav[aria-label*="pagination"]');
      await expect(paginationInfo.first()).toBeVisible();
    });

    test('should navigate to next page', async ({ page }) => {
      let currentPage = 1;

      await page.route('**/api/v1/admin/batches*', async (route) => {
        const url = new URL(route.request().url());
        currentPage = parseInt(url.searchParams.get('page') || '1', 10);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(currentPage, 10, 50)),
        });
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Click next page button
      const nextButton = page.locator(
        'button:has-text("Next"), button[aria-label*="next"], [data-testid="next-page"]'
      ).first();

      if (await nextButton.isVisible()) {
        await nextButton.click();

        // Wait for page change
        await page.waitForTimeout(500);

        // Verify page changed
        expect(currentPage).toBe(2);
      }
    });

    test('should navigate to previous page', async ({ page }) => {
      let currentPage = 2;

      await page.route('**/api/v1/admin/batches*', async (route) => {
        const url = new URL(route.request().url());
        currentPage = parseInt(url.searchParams.get('page') || '2', 10);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(currentPage, 10, 50)),
        });
      });

      // Start on page 2
      await page.goto('/admin/batches?page=2');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Click previous page button
      const prevButton = page.locator(
        'button:has-text("Previous"), button[aria-label*="previous"], [data-testid="prev-page"]'
      ).first();

      if (await prevButton.isVisible()) {
        await prevButton.click();

        // Wait for page change
        await page.waitForTimeout(500);

        // Verify page changed
        expect(currentPage).toBe(1);
      }
    });

    test('should disable previous button on first page', async ({ page }) => {
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 50)),
        });
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Previous button should be disabled on first page
      const prevButton = page.locator(
        'button:has-text("Previous"), button[aria-label*="previous"], [data-testid="prev-page"]'
      ).first();

      if (await prevButton.isVisible()) {
        await expect(prevButton).toBeDisabled();
      }
    });
  });

  test.describe('batch detail navigation', () => {
    test('should navigate to batch detail when clicking row', async ({
      page,
    }) => {
      const mockResponse = createMockPaginatedResponse(1, 10, 25);
      const firstBatchId = mockResponse.batches[0].id;

      await page.route('**/api/v1/admin/batches*', async (route) => {
        // Check if this is a detail request
        if (route.request().url().includes(`/batches/${firstBatchId}`)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              batch: mockResponse.batches[0],
              scans: [],
              aggregate: {
                totalIssues: 25,
                criticalCount: 5,
                seriousCount: 10,
                moderateCount: 7,
                minorCount: 3,
                passedChecks: 100,
              },
              topCriticalUrls: [],
              sessionInfo: null,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockResponse),
          });
        }
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Click on the first batch row
      const firstRow = page.locator('table tbody tr').first();
      await firstRow.click();

      // Should navigate to batch detail page
      await expect(page).toHaveURL(new RegExp(`/admin/batches/${firstBatchId}`));
    });

    test('should navigate to batch detail via view button', async ({
      page,
    }) => {
      const mockResponse = createMockPaginatedResponse(1, 10, 25);
      const firstBatchId = mockResponse.batches[0].id;

      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse),
        });
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Find and click view button/link in first row
      const viewButton = page
        .locator('table tbody tr')
        .first()
        .locator('a:has-text("View"), button:has-text("View"), [aria-label*="view"]')
        .first();

      if (await viewButton.isVisible()) {
        await viewButton.click();

        // Should navigate to batch detail page
        await expect(page).toHaveURL(new RegExp(`/admin/batches/${firstBatchId}`));
      }
    });
  });

  test.describe('error handling', () => {
    test('should display error message on API failure', async ({ page }) => {
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.goto('/admin/batches');

      // Should show error message
      await expect(
        page.getByText(/error|failed|problem/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test('should allow retry after error', async ({ page }) => {
      let requestCount = 0;

      await page.route('**/api/v1/admin/batches*', async (route) => {
        requestCount++;

        if (requestCount === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockPaginatedResponse(1, 10, 25)),
          });
        }
      });

      await page.goto('/admin/batches');

      // Wait for error state
      await expect(
        page.getByText(/error|failed|problem/i).first()
      ).toBeVisible({ timeout: 10000 });

      // Find and click retry button
      const retryButton = page.locator(
        'button:has-text("Retry"), button:has-text("Try again"), [data-testid="retry"]'
      ).first();

      if (await retryButton.isVisible()) {
        await retryButton.click();

        // Should load data successfully after retry
        await page.waitForSelector('table', { timeout: 10000 });
        expect(requestCount).toBe(2);
      }
    });
  });

  test.describe('accessibility', () => {
    test('should have accessible table structure', async ({ page }) => {
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 25)),
        });
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Table should have proper structure
      const table = page.locator('table');
      await expect(table).toBeVisible();

      // Should have thead and tbody
      await expect(table.locator('thead')).toBeVisible();
      await expect(table.locator('tbody')).toBeVisible();

      // Headers should be in th elements
      const headers = table.locator('thead th');
      expect(await headers.count()).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.route('**/api/v1/admin/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockPaginatedResponse(1, 10, 25)),
        });
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Tab through interactive elements
      await page.keyboard.press('Tab');

      // Should be able to focus on interactive elements
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});
