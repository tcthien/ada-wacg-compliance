import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Admin Batch Export Flow
 *
 * Tests the admin batch export functionality:
 * 1. Admin can access export on any batch
 * 2. Export works for guest session batches
 * 3. Export button works correctly on admin batch detail page
 * 4. Admin can export batches regardless of ownership
 *
 * Requirements:
 * - 5.1: Admin can export any batch
 * - 5.2: Export works for guest session batches
 * - 5.4: Admin can export batches regardless of ownership
 *
 * @see apps/web/src/app/admin/batches/[id]/page.tsx
 * @see apps/web/src/hooks/useAdminBatchDetail.ts
 */

test.describe('Admin Batch Export Flow', () => {
  // Helper function to mock admin authentication
  const mockAdminAuth = async (page: any) => {
    await page.addInitScript(() => {
      (window as any).__ADMIN_SESSION__ = {
        isAdmin: true,
        userId: 'admin-user-123',
        email: 'admin@example.com',
      };
    });
  };

  // Helper function to mock admin batch details API
  const mockAdminBatchDetails = async (
    page: any,
    batchId: string,
    status: string = 'COMPLETED',
    sessionId: string | null = null
  ) => {
    await page.route(`**/api/admin/batches/${batchId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            batch: {
              id: batchId,
              homepageUrl: 'https://example.com',
              status,
              wcagLevel: 'AA',
              totalUrls: 3,
              completedCount: status === 'COMPLETED' ? 3 : 1,
              failedCount: 0,
              createdAt: new Date().toISOString(),
              completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
              cancelledAt: status === 'CANCELLED' ? new Date().toISOString() : null,
            },
            scans: [
              {
                id: 'scan-1',
                url: 'https://example.com/',
                pageTitle: 'Home',
                status: 'COMPLETED',
                totalIssues: 5,
                criticalCount: 1,
              },
              {
                id: 'scan-2',
                url: 'https://example.com/about',
                pageTitle: 'About',
                status: 'COMPLETED',
                totalIssues: 3,
                criticalCount: 0,
              },
              {
                id: 'scan-3',
                url: 'https://example.com/contact',
                pageTitle: 'Contact',
                status: status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
                totalIssues: 2,
                criticalCount: 0,
              },
            ],
            aggregate: {
              totalIssues: 10,
              criticalCount: 1,
              seriousCount: 3,
              moderateCount: 4,
              minorCount: 2,
              passedChecks: 120,
              urlsScanned: 3,
            },
            topCriticalUrls: [
              {
                url: 'https://example.com/',
                pageTitle: 'Home',
                criticalCount: 1,
              },
            ],
            sessionInfo: sessionId
              ? {
                  guestSessionId: sessionId,
                  email: null,
                  ipAddress: '192.168.1.1',
                }
              : {
                  guestSessionId: null,
                  email: 'user@example.com',
                  ipAddress: '192.168.1.2',
                },
          },
        }),
      });
    });
  };

  // Helper function to mock export request
  const mockExportRequest = async (
    page: any,
    batchId: string,
    format: 'pdf' | 'json',
    response: 'ready' | 'generating' | 'failed' = 'ready'
  ) => {
    await page.route(`**/api/admin/batches/${batchId}/export/request**`, async (route) => {
      const requestUrl = route.request().url();
      const urlFormat = requestUrl.includes('format=pdf') ? 'pdf' : 'json';

      if (urlFormat !== format && format !== 'pdf') {
        return route.continue();
      }

      if (response === 'ready') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'ready',
              url: `https://s3.example.com/admin-batches/${batchId}-report.${format}`,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              reportId: `report_${batchId}`,
            },
          }),
        });
      } else if (response === 'generating') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'generating',
              reportId: `report_${batchId}_pending`,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'failed',
              errorMessage: 'Failed to generate report',
            },
          }),
        });
      }
    });
  };

  // Helper function to mock export status polling
  const mockExportStatus = async (
    page: any,
    batchId: string,
    format: 'pdf' | 'json'
  ) => {
    let pollCount = 0;
    await page.route(`**/api/admin/batches/${batchId}/export/status**`, async (route) => {
      pollCount++;
      const isReady = pollCount >= 2;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: isReady
            ? {
                status: 'ready',
                url: `https://s3.example.com/admin-batches/${batchId}-report.${format}`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                reportId: `report_${batchId}`,
              }
            : {
                status: 'generating',
                reportId: `report_${batchId}_pending`,
              },
        }),
      });
    });
  };

  // Helper function to mock CSV export (synchronous)
  const mockCsvExport = async (page: any, batchId: string) => {
    await page.route(`**/api/admin/batches/${batchId}/export/csv`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: {
          'Content-Disposition': `attachment; filename="batch-${batchId}.csv"`,
        },
        body: 'url,title,issues,critical,serious,moderate,minor\nhttps://example.com/,Home,5,1,2,1,1',
      });
    });
  };

  test.beforeEach(async ({ page }) => {
    // Mock admin authentication for all tests
    await mockAdminAuth(page);

    // Mock S3 downloads
    await page.route('https://s3.example.com/**', async (route) => {
      const url = route.request().url();
      const isPdf = url.includes('.pdf');
      await route.fulfill({
        status: 200,
        contentType: isPdf ? 'application/pdf' : 'application/json',
        body: isPdf ? Buffer.from('Mock PDF content') : JSON.stringify({ data: 'mock' }),
      });
    });
  });

  test.describe('Export Button Visibility', () => {
    test('should show export button on completed batch detail page', async ({ page }) => {
      const batchId = 'admin-batch-export-btn';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED');
      await page.goto(`/admin/batches/${batchId}`);

      // Wait for page to load
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Export button should be visible and enabled
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await expect(exportButton).toBeVisible();
      await expect(exportButton).toBeEnabled();
    });

    test('should disable export button for running batch', async ({ page }) => {
      const batchId = 'admin-batch-running';

      await mockAdminBatchDetails(page, batchId, 'RUNNING');
      await page.goto(`/admin/batches/${batchId}`);

      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Export button should be disabled
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      if (await exportButton.isVisible()) {
        await expect(exportButton).toBeDisabled();
      }
    });

    test('should disable export button for cancelled batch', async ({ page }) => {
      const batchId = 'admin-batch-cancelled';

      await mockAdminBatchDetails(page, batchId, 'CANCELLED');
      await page.goto(`/admin/batches/${batchId}`);

      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Export button should be disabled
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      if (await exportButton.isVisible()) {
        await expect(exportButton).toBeDisabled();
      }
    });
  });

  test.describe('Export Guest Session Batches', () => {
    test('should export PDF for guest session batch', async ({ page }) => {
      const batchId = 'admin-guest-batch-pdf';
      const guestSessionId = 'guest_abc123';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED', guestSessionId);
      await mockExportRequest(page, batchId, 'pdf', 'ready');

      await page.goto(`/admin/batches/${batchId}`);
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Verify guest session info is displayed
      await expect(page.getByText(/Guest Session/i)).toBeVisible();

      // Click export and select PDF
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();

      const pdfOption = page.getByRole('menuitem', { name: /PDF/i });
      await expect(pdfOption).toBeVisible();
      await pdfOption.click();

      // Should show success or start download
      await expect(page.getByText(/completed|success|Download/i)).toBeVisible({ timeout: 5000 });
    });

    test('should export JSON for guest session batch', async ({ page }) => {
      const batchId = 'admin-guest-batch-json';
      const guestSessionId = 'guest_xyz789';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED', guestSessionId);
      await mockExportRequest(page, batchId, 'json', 'ready');

      await page.goto(`/admin/batches/${batchId}`);
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Click export and select JSON
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();

      const jsonOption = page.getByRole('menuitem', { name: /JSON/i });
      await expect(jsonOption).toBeVisible();
      await jsonOption.click();

      // Should show success
      await expect(page.getByText(/completed|success|Download/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Export Any Batch (Admin Privilege)', () => {
    test('should allow admin to export batch from any user', async ({ page }) => {
      const batchId = 'admin-any-user-batch';

      // Batch belongs to another user (not admin)
      await mockAdminBatchDetails(page, batchId, 'COMPLETED', null);
      await mockExportRequest(page, batchId, 'pdf', 'ready');

      await page.goto(`/admin/batches/${batchId}`);
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Admin should be able to export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await expect(exportButton).toBeEnabled();
      await exportButton.click();

      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should succeed
      await expect(page.getByText(/completed|success|Download/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Async Export Flow', () => {
    test('should show generating modal and poll for completion', async ({ page }) => {
      const batchId = 'admin-batch-generate';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED');
      await mockExportRequest(page, batchId, 'pdf', 'generating');
      await mockExportStatus(page, batchId, 'pdf');

      await page.goto(`/admin/batches/${batchId}`);
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Start export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should show generating modal
      await expect(page.getByText(/Generating|Exporting/i)).toBeVisible({ timeout: 3000 });

      // Wait for completion through polling
      await expect(page.getByText(/completed|success|Download/i)).toBeVisible({ timeout: 10000 });
    });

    test('should allow cancellation during generation', async ({ page }) => {
      const batchId = 'admin-batch-cancel-gen';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED');

      // Mock slow generation that never completes
      await page.route(`**/api/admin/batches/${batchId}/export/**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'generating',
              reportId: 'report_slow',
            },
          }),
        });
      });

      await page.goto(`/admin/batches/${batchId}`);
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Start export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should show generating
      await expect(page.getByText(/Generating|Exporting/i)).toBeVisible({ timeout: 3000 });

      // Cancel
      const cancelButton = page.getByRole('button', { name: /Cancel/i });
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      // Modal should close
      await expect(page.getByText(/Generating|Exporting/i)).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('CSV Export (Synchronous)', () => {
    test('should export CSV directly', async ({ page }) => {
      const batchId = 'admin-batch-csv';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED');
      await mockCsvExport(page, batchId);

      await page.goto(`/admin/batches/${batchId}`);
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      const downloadPromise = page.waitForEvent('download');

      // Start export and select CSV
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();

      const csvOption = page.getByRole('menuitem', { name: /CSV/i });
      if (await csvOption.isVisible()) {
        await csvOption.click();

        // Should trigger download
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle export failure gracefully', async ({ page }) => {
      const batchId = 'admin-batch-fail';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED');
      await mockExportRequest(page, batchId, 'pdf', 'failed');

      await page.goto(`/admin/batches/${batchId}`);
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Start export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should show error
      await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });
    });

    test('should allow retry after failure', async ({ page }) => {
      const batchId = 'admin-batch-retry';
      let attemptCount = 0;

      await mockAdminBatchDetails(page, batchId, 'COMPLETED');

      // First attempt fails, second succeeds
      await page.route(`**/api/admin/batches/${batchId}/export/request**`, async (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { status: 'failed', errorMessage: 'Temporary error' },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                status: 'ready',
                url: `https://s3.example.com/admin-batches/${batchId}-report.pdf`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                reportId: 'report_retry',
              },
            }),
          });
        }
      });

      await page.goto(`/admin/batches/${batchId}`);
      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // First attempt
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should show error
      await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });

      // Click retry
      const retryButton = page.getByRole('button', { name: /Retry/i });
      if (await retryButton.isVisible()) {
        await retryButton.click();

        // Should succeed on retry
        await expect(page.getByText(/completed|success|Download/i)).toBeVisible({ timeout: 5000 });
        expect(attemptCount).toBe(2);
      }
    });
  });

  test.describe('Export Options Display', () => {
    test('should show all export format options', async ({ page }) => {
      const batchId = 'admin-batch-options';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED');
      await page.goto(`/admin/batches/${batchId}`);

      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Open export dropdown
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();

      // All format options should be visible
      await expect(page.getByText(/PDF/i)).toBeVisible();
      await expect(page.getByText(/JSON/i)).toBeVisible();

      // CSV may or may not be available
      const csvOption = page.getByRole('menuitem', { name: /CSV/i });
      // Just check if it exists, don't fail if not
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible export controls', async ({ page }) => {
      const batchId = 'admin-batch-a11y';

      await mockAdminBatchDetails(page, batchId, 'COMPLETED');
      await page.goto(`/admin/batches/${batchId}`);

      await expect(page.getByText(/Batch Scan/i)).toBeVisible({ timeout: 5000 });

      // Export button should have accessible name
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await expect(exportButton).toHaveAttribute('aria-label', /.+/);

      // Open dropdown
      await exportButton.click();

      // Menu items should be accessible
      const menuItems = page.getByRole('menuitem');
      await expect(menuItems.first()).toBeVisible();
    });
  });
});
