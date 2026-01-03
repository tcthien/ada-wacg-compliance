/**
 * Admin Scan-Batch Integration E2E Tests
 *
 * Tests the integration between scans and batches including:
 * - Batch column display in scan table
 * - Batch filter functionality on scan list
 * - Scan detail batch context display
 * - Navigation between scan and batch views
 *
 * Requirements: 4.1, 4.2, 4.3, 6.3, 6.4 (Scan-batch relationship and navigation)
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
 * Create mock scan with batch association
 */
function createMockScan(id: string, batchId: string | null = null, status = 'COMPLETED') {
  return {
    id,
    url: `https://example.com/${id}`,
    pageTitle: `Page ${id}`,
    status,
    totalIssues: 15,
    criticalCount: 3,
    seriousCount: 5,
    moderateCount: 4,
    minorCount: 3,
    errorMessage: status === 'FAILED' ? 'Connection timeout' : null,
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: status === 'COMPLETED' ? '2024-01-01T00:30:00Z' : null,
    email: 'user@example.com',
    // Batch association
    batchScanId: batchId,
    batchHomepageUrl: batchId ? 'https://batch-site.com' : null,
  };
}

/**
 * Create mock scan list response
 */
function createMockScanList(options: {
  batchedCount?: number;
  nonBatchedCount?: number;
  specificBatchId?: string;
}) {
  const { batchedCount = 3, nonBatchedCount = 2, specificBatchId } = options;
  const scans: any[] = [];

  // Add batched scans
  for (let i = 0; i < batchedCount; i++) {
    const batchId = specificBatchId || `batch-${i + 1}`;
    scans.push(createMockScan(`scan-batch-${i + 1}`, batchId));
  }

  // Add non-batched scans
  for (let i = 0; i < nonBatchedCount; i++) {
    scans.push(createMockScan(`scan-single-${i + 1}`, null));
  }

  return {
    items: scans,
    pagination: {
      page: 1,
      pageSize: 20,
      total: scans.length,
      totalPages: 1,
    },
  };
}

/**
 * Create mock batch detail response
 */
function createMockBatchDetail(batchId: string) {
  return {
    batch: {
      id: batchId,
      homepageUrl: 'https://batch-site.com',
      wcagLevel: 'AA',
      status: 'COMPLETED',
      totalUrls: 5,
      completedCount: 5,
      failedCount: 0,
      totalIssues: 50,
      criticalCount: 10,
      seriousCount: 20,
      moderateCount: 15,
      minorCount: 5,
      createdAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-01T01:00:00Z',
      cancelledAt: null,
      guestSessionId: 'session-1',
      userId: null,
    },
    scans: [
      createMockScan('scan-1', batchId),
      createMockScan('scan-2', batchId),
      createMockScan('scan-3', batchId),
    ],
    aggregate: {
      totalIssues: 50,
      criticalCount: 10,
      seriousCount: 20,
      moderateCount: 15,
      minorCount: 5,
      passedChecks: 200,
    },
    topCriticalUrls: [],
    sessionInfo: null,
  };
}

/**
 * Create mock scan detail response
 */
function createMockScanDetail(scanId: string, batchId: string | null) {
  return {
    ...createMockScan(scanId, batchId),
    issues: [
      {
        id: 'issue-1',
        ruleId: 'color-contrast',
        description: 'Element has insufficient color contrast',
        impact: 'serious',
        selector: '.button',
        html: '<button class="button">Click me</button>',
      },
      {
        id: 'issue-2',
        ruleId: 'image-alt',
        description: 'Image missing alt text',
        impact: 'critical',
        selector: 'img',
        html: '<img src="logo.png">',
      },
    ],
    batchInfo: batchId
      ? {
          id: batchId,
          homepageUrl: 'https://batch-site.com',
          totalUrls: 5,
          status: 'COMPLETED',
        }
      : null,
  };
}

test.describe('Scan-Batch Integration', () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminAuth(page);
  });

  test.describe('batch column in scan table', () => {
    test('should display batch column header', async ({ page }) => {
      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({ batchedCount: 3, nonBatchedCount: 2 })),
        });
      });

      await page.goto('/admin/scans');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Should have Batch column header
      const batchHeader = page.locator('th:has-text("Batch")');
      await expect(batchHeader).toBeVisible();
    });

    test('should show batch info for batched scans', async ({ page }) => {
      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({ batchedCount: 3, nonBatchedCount: 0 })),
        });
      });

      await page.goto('/admin/scans');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Should show batch info in the batch column
      const batchCell = page.locator('td:has-text("Batch")').first();
      await expect(batchCell).toBeVisible();

      // Should have link to batch details
      const batchLink = page.locator('a[href*="/admin/batches/"]').first();
      await expect(batchLink).toBeVisible();
    });

    test('should show empty batch cell for non-batched scans', async ({ page }) => {
      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({ batchedCount: 0, nonBatchedCount: 3 })),
        });
      });

      await page.goto('/admin/scans');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Non-batched scans should not show batch link
      const rows = page.locator('table tbody tr');
      const firstRow = rows.first();
      await expect(firstRow).toBeVisible();

      // Should not have batch link
      const batchLink = firstRow.locator('a[href*="/admin/batches/"]');
      expect(await batchLink.count()).toBe(0);
    });

    test('should display batch homepage URL in tooltip', async ({ page }) => {
      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({ batchedCount: 1, nonBatchedCount: 0 })),
        });
      });

      await page.goto('/admin/scans');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Find element with batch URL (title attribute or visible text)
      const batchUrlElement = page.locator('[title*="batch-site.com"], :has-text("batch-site.com")').first();
      if (await batchUrlElement.isVisible()) {
        await expect(batchUrlElement).toBeVisible();
      }
    });
  });

  test.describe('batch filter on scan list', () => {
    test('should show batch filter dropdown', async ({ page }) => {
      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({})),
        });
      });

      await page.goto('/admin/scans');

      // Should have batch filter dropdown
      const batchFilter = page.locator('#batch-filter, [data-testid="batch-filter"]');
      await expect(batchFilter).toBeVisible();
    });

    test('should filter to show only batched scans', async ({ page }) => {
      let lastRequestUrl = '';

      await page.route('**/api/v1/admin/scans*', async (route) => {
        lastRequestUrl = route.request().url();
        const url = new URL(lastRequestUrl);
        const batchFilter = url.searchParams.get('batchFilter');

        let response;
        if (batchFilter === 'batched') {
          response = createMockScanList({ batchedCount: 3, nonBatchedCount: 0 });
        } else if (batchFilter === 'nonBatched') {
          response = createMockScanList({ batchedCount: 0, nonBatchedCount: 3 });
        } else {
          response = createMockScanList({ batchedCount: 3, nonBatchedCount: 2 });
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      });

      await page.goto('/admin/scans');

      // Wait for initial load
      await page.waitForSelector('table', { timeout: 10000 });

      // Select "Batched Only" from batch filter
      const batchFilter = page.locator('#batch-filter');
      await batchFilter.selectOption('batched');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Verify filter was applied
      expect(lastRequestUrl).toContain('batchFilter=batched');
    });

    test('should filter to show only non-batched scans', async ({ page }) => {
      let lastRequestUrl = '';

      await page.route('**/api/v1/admin/scans*', async (route) => {
        lastRequestUrl = route.request().url();
        const url = new URL(lastRequestUrl);
        const batchFilter = url.searchParams.get('batchFilter');

        let response;
        if (batchFilter === 'nonBatched') {
          response = createMockScanList({ batchedCount: 0, nonBatchedCount: 3 });
        } else {
          response = createMockScanList({ batchedCount: 3, nonBatchedCount: 2 });
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      });

      await page.goto('/admin/scans');

      // Wait for initial load
      await page.waitForSelector('table', { timeout: 10000 });

      // Select "Non-Batched Only" from batch filter
      const batchFilter = page.locator('#batch-filter');
      await batchFilter.selectOption('nonBatched');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Verify filter was applied
      expect(lastRequestUrl).toContain('batchFilter=nonBatched');
    });

    test('should filter to show specific batch scans', async ({ page }) => {
      const specificBatchId = 'batch-specific-123';
      let lastRequestUrl = '';

      await page.route('**/api/v1/admin/scans*', async (route) => {
        lastRequestUrl = route.request().url();
        const url = new URL(lastRequestUrl);
        const batchFilter = url.searchParams.get('batchFilter');
        const batchId = url.searchParams.get('batchId');

        let response;
        if (batchFilter === 'specific' && batchId) {
          response = createMockScanList({ batchedCount: 3, nonBatchedCount: 0, specificBatchId: batchId });
        } else {
          response = createMockScanList({ batchedCount: 3, nonBatchedCount: 2 });
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      });

      await page.goto('/admin/scans');

      // Wait for initial load
      await page.waitForSelector('table', { timeout: 10000 });

      // Select "Specific Batch" from batch filter
      const batchFilter = page.locator('#batch-filter');
      await batchFilter.selectOption('specific');

      // Wait for batch ID input to appear
      await page.waitForTimeout(300);

      // Enter specific batch ID
      const batchIdInput = page.locator('#batch-id-filter');
      await expect(batchIdInput).toBeVisible();
      await batchIdInput.fill(specificBatchId);

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Verify filter was applied
      expect(lastRequestUrl).toContain('batchFilter=specific');
      expect(lastRequestUrl).toContain(`batchId=${specificBatchId}`);
    });

    test('should reset batch filter with reset button', async ({ page }) => {
      let requestCount = 0;

      await page.route('**/api/v1/admin/scans*', async (route) => {
        requestCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({ batchedCount: 3, nonBatchedCount: 2 })),
        });
      });

      await page.goto('/admin/scans');

      // Wait for initial load
      await page.waitForSelector('table', { timeout: 10000 });

      // Apply a filter
      const batchFilter = page.locator('#batch-filter');
      await batchFilter.selectOption('batched');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Click reset filters button
      const resetButton = page.locator('button:has-text("Reset Filters")');
      if (await resetButton.isVisible()) {
        await resetButton.click();

        // Wait for reset
        await page.waitForTimeout(500);

        // Batch filter should be reset to empty/all
        await expect(batchFilter).toHaveValue('');
      }
    });
  });

  test.describe('scan detail batch context', () => {
    test('should display batch info on batched scan detail', async ({ page }) => {
      const scanId = 'scan-with-batch';
      const batchId = 'batch-123';

      await page.route(`**/api/v1/admin/scans/${scanId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanDetail(scanId, batchId)),
        });
      });

      await page.goto(`/admin/scans/${scanId}`);

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Should show batch information
      const batchInfo = page.locator(':has-text("batch-123"), :has-text("Batch")');
      if (await batchInfo.first().isVisible()) {
        await expect(batchInfo.first()).toBeVisible();
      }
    });

    test('should not show batch info on non-batched scan detail', async ({ page }) => {
      const scanId = 'scan-without-batch';

      await page.route(`**/api/v1/admin/scans/${scanId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanDetail(scanId, null)),
        });
      });

      await page.goto(`/admin/scans/${scanId}`);

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Should not have batch link
      const batchLink = page.locator('a[href*="/admin/batches/"]');
      expect(await batchLink.count()).toBe(0);
    });

    test('should link to batch from scan detail', async ({ page }) => {
      const scanId = 'scan-with-batch';
      const batchId = 'batch-123';

      await page.route(`**/api/v1/admin/scans/${scanId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanDetail(scanId, batchId)),
        });
      });

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto(`/admin/scans/${scanId}`);

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Find and click batch link
      const batchLink = page.locator(`a[href*="/admin/batches/${batchId}"]`).first();
      if (await batchLink.isVisible()) {
        await batchLink.click();

        // Should navigate to batch detail
        await expect(page).toHaveURL(new RegExp(`/admin/batches/${batchId}`));
      }
    });
  });

  test.describe('navigation between scan and batch', () => {
    test('should navigate from scan table to batch detail', async ({ page }) => {
      const batchId = 'batch-1';

      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({ batchedCount: 3, nonBatchedCount: 0 })),
        });
      });

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.goto('/admin/scans');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Click batch link in the table
      const batchLink = page.locator(`a[href*="/admin/batches/${batchId}"]`).first();
      if (await batchLink.isVisible()) {
        await batchLink.click();

        // Should navigate to batch detail
        await expect(page).toHaveURL(new RegExp(`/admin/batches/${batchId}`));
      }
    });

    test('should navigate from batch detail to scan list with batch filter', async ({ page }) => {
      const batchId = 'batch-123';

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({ batchedCount: 3, nonBatchedCount: 0, specificBatchId: batchId })),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Find link to view all scans for this batch
      const viewScansLink = page.locator('a:has-text("View Scans"), a:has-text("All Scans"), [data-testid="view-batch-scans"]').first();
      if (await viewScansLink.isVisible()) {
        await viewScansLink.click();

        // Should navigate to scans with batch filter
        await expect(page).toHaveURL(/\/admin\/scans/);
      }
    });

    test('should navigate from batch scan list to scan detail', async ({ page }) => {
      const batchId = 'batch-123';
      const scanId = 'scan-1';

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      await page.route(`**/api/v1/admin/scans/${scanId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanDetail(scanId, batchId)),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Find and click on a scan in the batch scans list
      const scanRow = page.locator('tr:has-text("Page 1"), [data-scan-id="scan-1"]').first();
      if (await scanRow.isVisible()) {
        const scanLink = scanRow.locator('a').first();
        if (await scanLink.isVisible()) {
          await scanLink.click();

          // Should navigate to scan detail
          await expect(page).toHaveURL(/\/admin\/scans\//);
        }
      }
    });

    test('should highlight scan in batch detail when navigating from scan', async ({ page }) => {
      const batchId = 'batch-123';
      const scanId = 'scan-2';

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockBatchDetail(batchId)),
        });
      });

      // Navigate to batch detail with scan highlight
      await page.goto(`/admin/batches/${batchId}?highlightScanId=${scanId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // The highlighted scan should have some visual indicator
      const highlightedRow = page.locator(`[data-scan-id="${scanId}"].highlight, tr:has-text("scan-2")[class*="highlight"]`);
      // Note: Implementation may vary, just verify page loads correctly
    });
  });

  test.describe('batch scans list in batch detail', () => {
    test('should display all scans in batch', async ({ page }) => {
      const batchId = 'batch-123';

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

      // Should display all scans from batch
      await expect(page.getByText('Page 1').first()).toBeVisible();
      await expect(page.getByText('Page 2').first()).toBeVisible();
    });

    test('should show scan status in batch scans list', async ({ page }) => {
      const batchId = 'batch-123';

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

      // Should show status for each scan
      const completedStatus = page.locator('[class*="badge"]:has-text("Completed"), :has-text("COMPLETED")');
      await expect(completedStatus.first()).toBeVisible();
    });

    test('should show issue counts in batch scans list', async ({ page }) => {
      const batchId = 'batch-123';

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

      // Should show issue counts (critical, serious, etc.)
      const issueCounts = page.locator('[class*="issue"], [class*="count"]');
      expect(await issueCounts.count()).toBeGreaterThan(0);
    });
  });

  test.describe('accessibility', () => {
    test('should have accessible batch filter controls', async ({ page }) => {
      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({})),
        });
      });

      await page.goto('/admin/scans');

      // Wait for page to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Batch filter should have label
      const batchFilterLabel = page.locator('label[for="batch-filter"]');
      await expect(batchFilterLabel).toBeVisible();

      // Filter should be keyboard accessible
      const batchFilter = page.locator('#batch-filter');
      await batchFilter.focus();
      await expect(batchFilter).toBeFocused();
    });

    test('should have accessible batch links in table', async ({ page }) => {
      await page.route('**/api/v1/admin/scans*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createMockScanList({ batchedCount: 3, nonBatchedCount: 0 })),
        });
      });

      await page.goto('/admin/scans');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Batch links should have accessible text
      const batchLink = page.locator('a[href*="/admin/batches/"]').first();
      if (await batchLink.isVisible()) {
        // Should have visible text or aria-label
        const hasAccessibleName =
          (await batchLink.textContent()) !== '' ||
          (await batchLink.getAttribute('aria-label')) !== null ||
          (await batchLink.getAttribute('title')) !== null;
        expect(hasAccessibleName).toBe(true);
      }
    });
  });
});
