import { test, expect } from '@playwright/test';

/**
 * E2E Tests: History Management
 *
 * Tests comprehensive history management functionality including:
 * - Filter application (date range, scan type, URL search)
 * - Sort functionality (by date, issue count, URL)
 * - Bulk selection and deletion
 * - Empty states (no history, no search results)
 *
 * Requirements:
 * - REQ 9.1: Filter by date range
 * - REQ 9.2: Filter by scan type (Single, Batch)
 * - REQ 9.3: Search by URL
 * - REQ 9.4: Sort by date, issue count, or URL
 * - REQ 9.5: Bulk deletion with confirmation
 * - REQ 9.6: Empty state with CTA for first scan
 */

test.describe('History Management', () => {
  // Sample test data
  const mockScans = [
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
    {
      id: 'scan-3',
      url: 'https://sample.net',
      status: 'completed',
      wcagLevel: 'AA',
      createdAt: new Date('2024-01-05T09:00:00Z').toISOString(),
      completedAt: new Date('2024-01-05T09:10:00Z').toISOString(),
      issueCount: 25,
    },
  ];

  const mockBatches = [
    {
      batchId: 'batch-1',
      homepageUrl: 'https://batch-site.com',
      status: 'completed',
      wcagLevel: 'AA',
      createdAt: new Date('2024-01-12T11:00:00Z').toISOString(),
      completedAt: new Date('2024-01-12T11:30:00Z').toISOString(),
      totalUrls: 10,
      completedCount: 10,
      failedCount: 0,
    },
    {
      batchId: 'batch-2',
      homepageUrl: 'https://another-batch.org',
      status: 'completed',
      wcagLevel: 'AAA',
      createdAt: new Date('2024-01-08T16:00:00Z').toISOString(),
      completedAt: new Date('2024-01-08T16:45:00Z').toISOString(),
      totalUrls: 5,
      completedCount: 5,
      failedCount: 0,
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock scan history API
    await page.route('**/api/scans/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scans: mockScans,
          total: mockScans.length,
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
          batches: mockBatches,
          total: mockBatches.length,
          page: 1,
          limit: 100,
        }),
      });
    });

    // Mock session deletion API (for scan deletion)
    await page.route('**/api/sessions/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/history');
  });

  test.describe('Date Range Filtering (REQ 9.1)', () => {
    test('should filter history by start date', async ({ page }) => {
      // Set start date to January 10, 2024
      await page.fill('#start-date-filter', '2024-01-10');

      // Wait for filter to apply
      await page.waitForTimeout(100);

      // Should show only items from Jan 10 onwards
      await expect(page.getByText('example.com')).toBeVisible(); // Jan 15
      await expect(page.getByText('test.org')).toBeVisible(); // Jan 10
      await expect(page.getByText('batch-site.com')).toBeVisible(); // Jan 12

      // Should not show items before Jan 10
      await expect(page.getByText('sample.net')).not.toBeVisible(); // Jan 5
      await expect(page.getByText('another-batch.org')).not.toBeVisible(); // Jan 8
    });

    test('should filter history by end date', async ({ page }) => {
      // Set end date to January 10, 2024
      await page.fill('#end-date-filter', '2024-01-10');

      // Wait for filter to apply
      await page.waitForTimeout(100);

      // Should show only items up to Jan 10
      await expect(page.getByText('test.org')).toBeVisible(); // Jan 10
      await expect(page.getByText('sample.net')).toBeVisible(); // Jan 5
      await expect(page.getByText('another-batch.org')).toBeVisible(); // Jan 8

      // Should not show items after Jan 10
      await expect(page.getByText('example.com')).not.toBeVisible(); // Jan 15
      await expect(page.getByText('batch-site.com')).not.toBeVisible(); // Jan 12
    });

    test('should filter history by date range (start and end)', async ({ page }) => {
      // Set date range: Jan 8 to Jan 12
      await page.fill('#start-date-filter', '2024-01-08');
      await page.fill('#end-date-filter', '2024-01-12');

      // Wait for filters to apply
      await page.waitForTimeout(100);

      // Should show only items in the range
      await expect(page.getByText('test.org')).toBeVisible(); // Jan 10
      await expect(page.getByText('batch-site.com')).toBeVisible(); // Jan 12
      await expect(page.getByText('another-batch.org')).toBeVisible(); // Jan 8

      // Should not show items outside the range
      await expect(page.getByText('example.com')).not.toBeVisible(); // Jan 15
      await expect(page.getByText('sample.net')).not.toBeVisible(); // Jan 5
    });

    test('should clear date filters when Clear All is clicked', async ({ page }) => {
      // Apply date filters
      await page.fill('#start-date-filter', '2024-01-10');
      await page.fill('#end-date-filter', '2024-01-12');
      await page.waitForTimeout(100);

      // Click Clear All button
      await page.getByRole('button', { name: /clear all/i }).click();

      // All items should be visible again
      await expect(page.getByText('example.com')).toBeVisible();
      await expect(page.getByText('test.org')).toBeVisible();
      await expect(page.getByText('sample.net')).toBeVisible();
      await expect(page.getByText('batch-site.com')).toBeVisible();
      await expect(page.getByText('another-batch.org')).toBeVisible();

      // Date inputs should be cleared
      await expect(page.locator('#start-date-filter')).toHaveValue('');
      await expect(page.locator('#end-date-filter')).toHaveValue('');
    });
  });

  test.describe('Scan Type Filtering (REQ 9.2)', () => {
    test('should filter by Single scan type', async ({ page }) => {
      // Click Single filter chip
      await page.getByRole('button', { name: 'Single' }).click();

      // Wait for filter to apply
      await page.waitForTimeout(100);

      // Should show only single scans
      await expect(page.getByText('example.com')).toBeVisible();
      await expect(page.getByText('test.org')).toBeVisible();
      await expect(page.getByText('sample.net')).toBeVisible();

      // Should not show batch scans
      await expect(page.getByText('batch-site.com')).not.toBeVisible();
      await expect(page.getByText('another-batch.org')).not.toBeVisible();
    });

    test('should filter by Batch scan type', async ({ page }) => {
      // Click Batch filter chip
      await page.getByRole('button', { name: 'Batch' }).click();

      // Wait for filter to apply
      await page.waitForTimeout(100);

      // Should show only batch scans
      await expect(page.getByText('batch-site.com')).toBeVisible();
      await expect(page.getByText('another-batch.org')).toBeVisible();

      // Should not show single scans
      await expect(page.getByText('example.com')).not.toBeVisible();
      await expect(page.getByText('test.org')).not.toBeVisible();
      await expect(page.getByText('sample.net')).not.toBeVisible();
    });

    test('should show all items when both scan types are selected', async ({ page }) => {
      // Click both filter chips
      await page.getByRole('button', { name: 'Single' }).click();
      await page.getByRole('button', { name: 'Batch' }).click();

      // Wait for filters to apply
      await page.waitForTimeout(100);

      // Should show all items
      await expect(page.getByText('example.com')).toBeVisible();
      await expect(page.getByText('test.org')).toBeVisible();
      await expect(page.getByText('sample.net')).toBeVisible();
      await expect(page.getByText('batch-site.com')).toBeVisible();
      await expect(page.getByText('another-batch.org')).toBeVisible();
    });

    test('should toggle scan type filter on/off', async ({ page }) => {
      // Click Single to enable filter
      const singleButton = page.getByRole('button', { name: 'Single' });
      await singleButton.click();
      await page.waitForTimeout(100);

      // Verify filter is active
      await expect(page.getByText('batch-site.com')).not.toBeVisible();

      // Click Single again to disable filter
      await singleButton.click();
      await page.waitForTimeout(100);

      // All items should be visible again
      await expect(page.getByText('batch-site.com')).toBeVisible();
    });
  });

  test.describe('URL Search (REQ 9.3)', () => {
    test('should filter by URL search query', async ({ page }) => {
      // Type in search input
      await page.fill('#url-search-filter', 'example');

      // Wait for debounce (300ms)
      await page.waitForTimeout(400);

      // Should show only matching URL
      await expect(page.getByText('example.com')).toBeVisible();

      // Should not show non-matching URLs
      await expect(page.getByText('test.org')).not.toBeVisible();
      await expect(page.getByText('sample.net')).not.toBeVisible();
      await expect(page.getByText('batch-site.com')).not.toBeVisible();
    });

    test('should search case-insensitively', async ({ page }) => {
      // Type uppercase search query
      await page.fill('#url-search-filter', 'BATCH');

      // Wait for debounce
      await page.waitForTimeout(400);

      // Should match batch sites
      await expect(page.getByText('batch-site.com')).toBeVisible();
      await expect(page.getByText('another-batch.org')).toBeVisible();

      // Should not show non-matching URLs
      await expect(page.getByText('example.com')).not.toBeVisible();
    });

    test('should search partial URL matches', async ({ page }) => {
      // Search for domain extension
      await page.fill('#url-search-filter', '.org');

      // Wait for debounce
      await page.waitForTimeout(400);

      // Should show all .org domains
      await expect(page.getByText('test.org')).toBeVisible();
      await expect(page.getByText('another-batch.org')).toBeVisible();

      // Should not show .com or .net domains
      await expect(page.getByText('example.com')).not.toBeVisible();
      await expect(page.getByText('sample.net')).not.toBeVisible();
      await expect(page.getByText('batch-site.com')).not.toBeVisible();
    });

    test('should clear search when input is emptied', async ({ page }) => {
      // Type search query
      await page.fill('#url-search-filter', 'example');
      await page.waitForTimeout(400);

      // Clear search
      await page.fill('#url-search-filter', '');
      await page.waitForTimeout(400);

      // All items should be visible again
      await expect(page.getByText('example.com')).toBeVisible();
      await expect(page.getByText('test.org')).toBeVisible();
      await expect(page.getByText('sample.net')).toBeVisible();
      await expect(page.getByText('batch-site.com')).toBeVisible();
    });
  });

  test.describe('Sort Functionality (REQ 9.4)', () => {
    test('should sort by date (newest first by default)', async ({ page }) => {
      // Get all history cards
      const cards = page.locator('[class*="history"]').filter({ hasText: 'https://' });

      // First card should be the newest (Jan 15)
      const firstCard = cards.first();
      await expect(firstCard).toContainText('example.com');
    });

    test('should sort by date ascending', async ({ page }) => {
      // Date is default sort, click toggle to change to ascending
      await page.getByRole('button', { name: /sort order/i }).click();

      // Wait for sort to apply
      await page.waitForTimeout(100);

      // First card should be the oldest (Jan 5)
      const cards = page.locator('[class*="history"]').filter({ hasText: 'https://' });
      const firstCard = cards.first();
      await expect(firstCard).toContainText('sample.net');
    });

    test('should sort by issue count descending', async ({ page }) => {
      // Select "Issue Count" from sort dropdown
      await page.getByRole('combobox', { name: /select sort field/i }).click();
      await page.getByRole('option', { name: 'Issue Count' }).click();

      // Wait for sort to apply
      await page.waitForTimeout(100);

      // First card should have most issues (25 issues - sample.net)
      const cards = page.locator('[class*="history"]').filter({ hasText: 'https://' });
      const firstCard = cards.first();
      await expect(firstCard).toContainText('sample.net');
    });

    test('should sort by issue count ascending', async ({ page }) => {
      // Select "Issue Count" from sort dropdown
      await page.getByRole('combobox', { name: /select sort field/i }).click();
      await page.getByRole('option', { name: 'Issue Count' }).click();

      // Click toggle for ascending order
      await page.getByRole('button', { name: /sort order/i }).click();

      // Wait for sort to apply
      await page.waitForTimeout(100);

      // First single scan card should have least issues (5 issues - test.org)
      const cards = page.locator('[class*="history"]').filter({ hasText: 'https://' });
      const firstCard = cards.first();
      await expect(firstCard).toContainText('test.org');
    });

    test('should sort by URL alphabetically', async ({ page }) => {
      // Select "URL" from sort dropdown
      await page.getByRole('combobox', { name: /select sort field/i }).click();
      await page.getByRole('option', { name: 'URL' }).click();

      // Click toggle for ascending order (A-Z)
      await page.getByRole('button', { name: /sort order/i }).click();

      // Wait for sort to apply
      await page.waitForTimeout(100);

      // First card should start with 'a' (another-batch.org)
      const cards = page.locator('[class*="history"]').filter({ hasText: 'https://' });
      const firstCard = cards.first();
      await expect(firstCard).toContainText('another-batch.org');
    });

    test('should toggle sort order with button', async ({ page }) => {
      // Initial state: descending (newest first)
      let cards = page.locator('[class*="history"]').filter({ hasText: 'https://' });
      let firstCard = cards.first();
      await expect(firstCard).toContainText('example.com'); // Jan 15

      // Click toggle button
      await page.getByRole('button', { name: /sort order/i }).click();
      await page.waitForTimeout(100);

      // Should now be ascending (oldest first)
      cards = page.locator('[class*="history"]').filter({ hasText: 'https://' });
      firstCard = cards.first();
      await expect(firstCard).toContainText('sample.net'); // Jan 5
    });
  });

  test.describe('Bulk Selection and Deletion (REQ 9.5)', () => {
    test('should allow selecting individual items', async ({ page }) => {
      // Find and click first checkbox
      const checkboxes = page.locator('input[type="checkbox"]');
      const firstCheckbox = checkboxes.first();
      await firstCheckbox.click();

      // Should show bulk actions bar
      await expect(page.getByText(/1 item selected/i)).toBeVisible();
    });

    test('should allow selecting multiple items', async ({ page }) => {
      // Click multiple checkboxes
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();
      await checkboxes.nth(2).click();

      // Should show count of selected items
      await expect(page.getByText(/3 items selected/i)).toBeVisible();
    });

    test('should allow deselecting items', async ({ page }) => {
      // Select two items
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();

      // Verify 2 items selected
      await expect(page.getByText(/2 items selected/i)).toBeVisible();

      // Deselect one item
      await checkboxes.nth(0).click();

      // Should show 1 item selected
      await expect(page.getByText(/1 item selected/i)).toBeVisible();
    });

    test('should show bulk actions bar when items are selected', async ({ page }) => {
      // Initially, bulk actions should not be visible
      await expect(page.getByText(/selected/i)).not.toBeVisible();

      // Select an item
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.first().click();

      // Bulk actions bar should appear
      await expect(page.getByRole('button', { name: /delete selected/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /clear selection/i })).toBeVisible();
    });

    test('should clear selection when Clear Selection is clicked', async ({ page }) => {
      // Select items
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();

      // Click Clear Selection
      await page.getByRole('button', { name: /clear selection/i }).click();

      // Bulk actions bar should disappear
      await expect(page.getByText(/selected/i)).not.toBeVisible();

      // Checkboxes should be unchecked
      await expect(checkboxes.nth(0)).not.toBeChecked();
      await expect(checkboxes.nth(1)).not.toBeChecked();
    });

    test('should show confirmation dialog when Delete Selected is clicked', async ({ page }) => {
      // Select items
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();

      // Click Delete Selected
      await page.getByRole('button', { name: /delete selected/i }).click();

      // Confirmation dialog should appear
      await expect(page.getByText(/are you sure you want to delete/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /^delete$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    });

    test('should cancel deletion when Cancel is clicked in confirmation dialog', async ({ page }) => {
      // Select and start deletion
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.first().click();
      await page.getByRole('button', { name: /delete selected/i }).click();

      // Click Cancel in dialog
      await page.getByRole('button', { name: /cancel/i }).click();

      // Dialog should close
      await expect(page.getByText(/are you sure you want to delete/i)).not.toBeVisible();

      // Item should still be selected
      await expect(page.getByText(/1 item selected/i)).toBeVisible();
    });

    test('should delete items when confirmed in dialog', async ({ page }) => {
      // Select items
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.first().click();

      // Click Delete Selected
      await page.getByRole('button', { name: /delete selected/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /^delete$/i }).click();

      // Page should reload (as per implementation)
      await page.waitForURL('/history');

      // Selection should be cleared after reload
      // Note: In real implementation, page reloads so we're back to initial state
    });

    test('should display correct count in bulk actions bar', async ({ page }) => {
      const checkboxes = page.locator('input[type="checkbox"]');

      // Select 1 item
      await checkboxes.nth(0).click();
      await expect(page.getByText(/1 item selected/i)).toBeVisible();

      // Select 2nd item
      await checkboxes.nth(1).click();
      await expect(page.getByText(/2 items selected/i)).toBeVisible();

      // Select 3rd item
      await checkboxes.nth(2).click();
      await expect(page.getByText(/3 items selected/i)).toBeVisible();
    });
  });

  test.describe('Empty States (REQ 9.6)', () => {
    test('should show empty history state when no scans exist', async ({ page }) => {
      // Override mocks to return empty data
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

      await page.goto('/history');

      // Should show empty state
      await expect(page.getByText(/no scans yet/i)).toBeVisible();
      await expect(
        page.getByText(/start your first accessibility scan/i)
      ).toBeVisible();

      // Should have CTA button
      const ctaButton = page.getByRole('button', { name: /start your first scan/i });
      await expect(ctaButton).toBeVisible();
    });

    test('should navigate to home page when CTA is clicked in empty state', async ({ page }) => {
      // Override mocks to return empty data
      await page.route('**/api/scans/history', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ scans: [], total: 0, page: 1, limit: 20 }),
        });
      });

      await page.route('**/api/batches*', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ batches: [], total: 0, page: 1, limit: 100 }),
        });
      });

      await page.goto('/history');

      // Click CTA button
      await page.getByRole('button', { name: /start your first scan/i }).click();

      // Should navigate to home page
      await expect(page).toHaveURL('/');
    });

    test('should show empty search results when filters return no items', async ({ page }) => {
      // Apply a search that returns no results
      await page.fill('#url-search-filter', 'nonexistent-url.xyz');

      // Wait for debounce
      await page.waitForTimeout(400);

      // Should show empty search state
      await expect(page.getByText(/no results found/i)).toBeVisible();
      await expect(
        page.getByText(/try adjusting your search terms or filters/i)
      ).toBeVisible();

      // Should have Clear Filters button
      await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible();
    });

    test('should clear filters when Clear Filters is clicked in empty search state', async ({ page }) => {
      // Apply a filter that returns no results
      await page.fill('#url-search-filter', 'nonexistent');
      await page.waitForTimeout(400);

      // Verify empty state
      await expect(page.getByText(/no results found/i)).toBeVisible();

      // Click Clear Filters button
      await page.getByRole('button', { name: /clear filters/i }).click();

      // All items should be visible again
      await expect(page.getByText('example.com')).toBeVisible();
      await expect(page.getByText('test.org')).toBeVisible();
      await expect(page.getByText('sample.net')).toBeVisible();

      // Search input should be cleared
      await expect(page.locator('#url-search-filter')).toHaveValue('');
    });

    test('should show empty search state when date range excludes all items', async ({ page }) => {
      // Set date range that excludes all items
      await page.fill('#start-date-filter', '2025-01-01');
      await page.fill('#end-date-filter', '2025-01-31');

      // Wait for filter to apply
      await page.waitForTimeout(100);

      // Should show empty search state
      await expect(page.getByText(/no results found/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible();
    });
  });

  test.describe('Combined Filters', () => {
    test('should apply multiple filters simultaneously', async ({ page }) => {
      // Apply date filter
      await page.fill('#start-date-filter', '2024-01-08');
      await page.fill('#end-date-filter', '2024-01-12');

      // Apply scan type filter
      await page.getByRole('button', { name: 'Batch' }).click();

      // Wait for filters to apply
      await page.waitForTimeout(100);

      // Should show only batch scans in date range
      await expect(page.getByText('batch-site.com')).toBeVisible(); // Jan 12, Batch
      await expect(page.getByText('another-batch.org')).toBeVisible(); // Jan 8, Batch

      // Should not show single scans or items outside date range
      await expect(page.getByText('example.com')).not.toBeVisible(); // Single
      await expect(page.getByText('test.org')).not.toBeVisible(); // Single
      await expect(page.getByText('sample.net')).not.toBeVisible(); // Outside date range
    });

    test('should combine search with sort', async ({ page }) => {
      // Apply search filter
      await page.fill('#url-search-filter', 'org');
      await page.waitForTimeout(400);

      // Change sort to URL ascending
      await page.getByRole('combobox', { name: /select sort field/i }).click();
      await page.getByRole('option', { name: 'URL' }).click();
      await page.getByRole('button', { name: /sort order/i }).click();

      // Wait for sort to apply
      await page.waitForTimeout(100);

      // Should show .org domains in alphabetical order
      const cards = page.locator('[class*="history"]').filter({ hasText: '.org' });
      const firstCard = cards.first();
      await expect(firstCard).toContainText('another-batch.org'); // Alphabetically first
    });

    test('should maintain filters when toggling sort order', async ({ page }) => {
      // Apply filter
      await page.getByRole('button', { name: 'Single' }).click();
      await page.waitForTimeout(100);

      // Change sort order
      await page.getByRole('button', { name: /sort order/i }).click();
      await page.waitForTimeout(100);

      // Filter should still be active
      await expect(page.getByText('example.com')).toBeVisible();
      await expect(page.getByText('batch-site.com')).not.toBeVisible();
    });

    test('should maintain sort when applying filters', async ({ page }) => {
      // Change sort to URL
      await page.getByRole('combobox', { name: /select sort field/i }).click();
      await page.getByRole('option', { name: 'URL' }).click();
      await page.getByRole('button', { name: /sort order/i }).click();

      // Apply filter
      await page.fill('#url-search-filter', 'batch');
      await page.waitForTimeout(400);

      // Items should still be sorted by URL
      const cards = page.locator('[class*="history"]').filter({ hasText: 'batch' });
      const firstCard = cards.first();
      await expect(firstCard).toContainText('another-batch.org'); // Alphabetically first
    });
  });
});
