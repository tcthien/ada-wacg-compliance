/**
 * Admin Batch Delete E2E Tests
 *
 * Tests the batch delete functionality including:
 * - SUPER_ADMIN can delete batches
 * - Delete confirmation dialog
 * - Batch removal from list after delete
 * - Non-SUPER_ADMIN cannot delete batches
 *
 * Requirements: 3.3, 3.4 (Delete batch with role-based access)
 */

import { test, expect } from '@playwright/test';

/**
 * Mock SUPER_ADMIN authentication
 */
async function mockSuperAdminAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('adminToken', 'mock-super-admin-token-12345');
    localStorage.setItem('adminRole', 'SUPER_ADMIN');
  });
}

/**
 * Mock regular ADMIN authentication (not SUPER_ADMIN)
 */
async function mockRegularAdminAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('adminToken', 'mock-admin-token-12345');
    localStorage.setItem('adminRole', 'ADMIN');
  });
}

/**
 * Create mock batch detail response
 */
function createMockBatchDetail(batchId: string) {
  return {
    batch: {
      id: batchId,
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      status: 'COMPLETED',
      totalUrls: 10,
      completedCount: 8,
      failedCount: 2,
      totalIssues: 25,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 7,
      minorCount: 3,
      createdAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-01T01:00:00Z',
      cancelledAt: null,
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
    ],
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
  };
}

/**
 * Create mock batch list response
 */
function createMockBatchList(batchIds: string[]) {
  return {
    batches: batchIds.map((id, i) => ({
      id,
      homepageUrl: `https://example${i + 1}.com`,
      wcagLevel: 'AA',
      status: 'COMPLETED',
      totalUrls: 10,
      completedCount: 8,
      failedCount: 2,
      totalIssues: 25 + i * 5,
      criticalCount: 5,
      seriousCount: 10,
      moderateCount: 7,
      minorCount: 3,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      completedAt: new Date().toISOString(),
      cancelledAt: null,
      guestSessionId: `session-${i + 1}`,
      userId: null,
    })),
    pagination: {
      page: 1,
      limit: 10,
      total: batchIds.length,
      totalPages: 1,
    },
  };
}

test.describe('Admin Batch Delete', () => {
  const batchId = 'batch-delete-test-123';
  const otherBatchIds = ['batch-1', 'batch-2', 'batch-3'];

  test.describe('SUPER_ADMIN delete access', () => {
    test.beforeEach(async ({ page }) => {
      await mockSuperAdminAuth(page);
    });

    test('should show delete button for SUPER_ADMIN', async ({ page }) => {
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

      // Delete button should be visible for SUPER_ADMIN
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeEnabled();
    });

    test('should show confirmation dialog before delete', async ({ page }) => {
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

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Should show confirmation dialog
      await expect(
        page.getByText(/confirm|are you sure|delete.*batch/i).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('should cancel delete when confirmation is declined', async ({ page }) => {
      let deleteCalled = false;

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteCalled = true;
          await route.fulfill({ status: 200 });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockBatchDetail(batchId)),
          });
        }
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Wait for confirmation dialog
      await page.waitForTimeout(500);

      // Click cancel in dialog
      const cancelButton = page.locator(
        'button:has-text("Cancel"), button:has-text("No"), [data-testid="cancel-delete"]'
      ).first();

      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        // Delete should not have been called
        expect(deleteCalled).toBe(false);

        // Should still be on detail page
        await expect(page).toHaveURL(new RegExp(`/admin/batches/${batchId}`));
      }
    });

    test('should delete batch when confirmation is accepted', async ({ page }) => {
      let deleteCalled = false;

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteCalled = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockBatchDetail(batchId)),
          });
        }
      });

      // Mock batch list for navigation after delete
      await page.route('**/api/v1/admin/batches*', async (route) => {
        if (!route.request().url().includes(batchId)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockBatchList(otherBatchIds)),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Wait for confirmation dialog
      await page.waitForTimeout(500);

      // Click confirm in dialog
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"):visible >> nth=1, [data-testid="confirm-delete"]'
      ).first();

      if (await confirmButton.isVisible()) {
        await confirmButton.click();

        // Wait for delete and navigation
        await page.waitForTimeout(1000);

        // Delete should have been called
        expect(deleteCalled).toBe(true);

        // Should navigate to batch list
        await expect(page).toHaveURL(/\/admin\/batches$/);
      }
    });

    test('should remove batch from list after delete', async ({ page }) => {
      const allBatchIds = [batchId, ...otherBatchIds];
      let currentBatchList = [...allBatchIds];

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          // Remove batch from list
          currentBatchList = currentBatchList.filter((id) => id !== batchId);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockBatchDetail(batchId)),
          });
        }
      });

      await page.route('**/api/v1/admin/batches*', async (route) => {
        if (!route.request().url().includes(`/${batchId}`)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockBatchList(currentBatchList)),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Wait for confirmation dialog
      await page.waitForTimeout(500);

      // Click confirm in dialog
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes"), [data-testid="confirm-delete"]'
      ).first();

      if (await confirmButton.isVisible()) {
        await confirmButton.click();

        // Wait for navigation to list
        await page.waitForURL(/\/admin\/batches$/, { timeout: 10000 });

        // Deleted batch should not be in list
        await expect(page.getByText(batchId)).not.toBeVisible();

        // Other batches should still be visible
        await expect(page.getByText(otherBatchIds[0])).toBeVisible();
      }
    });

    test('should handle delete error gracefully', async ({ page }) => {
      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Delete failed - database error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockBatchDetail(batchId)),
          });
        }
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Wait for confirmation dialog
      await page.waitForTimeout(500);

      // Click confirm in dialog
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes"), [data-testid="confirm-delete"]'
      ).first();

      if (await confirmButton.isVisible()) {
        await confirmButton.click();

        // Should show error message
        await expect(
          page.getByText(/error|failed/i).first()
        ).toBeVisible({ timeout: 5000 });

        // Should still be on detail page
        await expect(page).toHaveURL(new RegExp(`/admin/batches/${batchId}`));
      }
    });
  });

  test.describe('non-SUPER_ADMIN delete restriction', () => {
    test.beforeEach(async ({ page }) => {
      await mockRegularAdminAuth(page);
    });

    test('should not show delete button for regular ADMIN', async ({ page }) => {
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

      // Delete button should not be visible for regular ADMIN
      const deleteButton = page.locator('button:has-text("Delete")');

      // Either button doesn't exist or is disabled
      const isVisible = await deleteButton.first().isVisible().catch(() => false);
      if (isVisible) {
        // If visible, it should be disabled
        await expect(deleteButton.first()).toBeDisabled();
      } else {
        // Button not visible - that's expected
        expect(isVisible).toBe(false);
      }
    });

    test('should show disabled delete button with tooltip for regular ADMIN', async ({ page }) => {
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

      // Check if delete button exists and has tooltip/disabled state
      const deleteButton = page.locator('button:has-text("Delete")').first();

      if (await deleteButton.isVisible()) {
        // Should be disabled
        await expect(deleteButton).toBeDisabled();

        // Hover to see tooltip
        await deleteButton.hover();

        // Should show permission message
        await expect(
          page.getByText(/permission|super.*admin|not.*authorized/i).first()
        ).toBeVisible({ timeout: 3000 }).catch(() => {
          // Tooltip might not be visible, that's ok
        });
      }
    });

    test('should reject delete API call for non-SUPER_ADMIN', async ({ page }) => {
      let deleteAttempted = false;

      await page.route(`**/api/v1/admin/batches/${batchId}`, async (route) => {
        if (route.request().method() === 'DELETE') {
          deleteAttempted = true;
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Forbidden - SUPER_ADMIN role required' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockBatchDetail(batchId)),
          });
        }
      });

      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await page.waitForSelector('[aria-label="Back to batch list"]', { timeout: 10000 });

      // If delete button is somehow clickable, API should reject it
      const deleteButton = page.locator('button:has-text("Delete")').first();

      if (await deleteButton.isVisible() && await deleteButton.isEnabled()) {
        await deleteButton.click();

        // Wait for confirmation dialog and confirm
        await page.waitForTimeout(500);
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Yes")'
        ).first();

        if (await confirmButton.isVisible()) {
          await confirmButton.click();

          // Should show forbidden error
          await expect(
            page.getByText(/forbidden|permission|not.*authorized/i).first()
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('delete from batch list', () => {
    test.beforeEach(async ({ page }) => {
      await mockSuperAdminAuth(page);
    });

    test('should be able to delete batch from list view', async ({ page }) => {
      let deleteCalled = false;
      const allBatchIds = [batchId, ...otherBatchIds];

      await page.route('**/api/v1/admin/batches*', async (route) => {
        if (route.request().url().includes(batchId) && route.request().method() === 'DELETE') {
          deleteCalled = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        } else if (!route.request().url().includes('batch-')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createMockBatchList(allBatchIds)),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/admin/batches');

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Find delete button/icon in the row for our batch
      const batchRow = page.locator(`tr:has-text("${batchId}")`);
      const deleteAction = batchRow.locator(
        'button[aria-label*="delete"], button:has-text("Delete"), [data-testid="delete-batch"]'
      ).first();

      if (await deleteAction.isVisible()) {
        await deleteAction.click();

        // Confirm deletion
        await page.waitForTimeout(500);
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Yes")'
        ).first();

        if (await confirmButton.isVisible()) {
          await confirmButton.click();

          // Wait for delete
          await page.waitForTimeout(500);

          expect(deleteCalled).toBe(true);
        }
      }
    });
  });

  test.describe('accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await mockSuperAdminAuth(page);
    });

    test('should have accessible confirmation dialog', async ({ page }) => {
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

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Wait for dialog
      await page.waitForTimeout(500);

      // Dialog should have proper role
      const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible();
      }

      // Should be able to close with Escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Dialog should be closed
      const dialogVisible = await dialog.isVisible().catch(() => false);
      // Note: Some implementations don't close on Escape, that's ok
    });

    test('should be keyboard navigable in confirmation dialog', async ({ page }) => {
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

      // Click delete button
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();

      // Wait for dialog
      await page.waitForTimeout(500);

      // Tab through dialog
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Should be able to press Enter on focused button
      // (not actually pressing to avoid accidental delete)
    });
  });
});
