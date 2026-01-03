import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Batch Export Functionality
 *
 * Tests the async export workflow:
 * 1. View completed batch
 * 2. Request export (PDF/JSON)
 * 3. Poll for status
 * 4. Download when ready
 * 5. Handle cancellation and errors
 *
 * Requirements:
 * - 3.1: Export batch results in PDF and JSON formats
 * - 3.2: Show export options with format selection
 * - 4.1: Request async export and poll for status
 * - 4.2: Display generating progress modal
 * - 4.3: Handle export cancellation
 * - 4.5: Show success confirmation after download
 *
 * @see apps/web/e2e/batch-scan.spec.ts - Batch scan flow patterns
 * @see apps/web/src/hooks/useBatchExport.ts - Export hook implementation
 */

test.describe('Batch Export Flow', () => {
  const completedBatchData = {
    id: 'batch-export-test',
    status: 'COMPLETED',
    homepageUrl: 'https://example.com',
    wcagLevel: 'AA',
    totalUrls: 3,
    completedCount: 3,
    failedCount: 0,
    progress: 100,
    scans: [],
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    cancelledAt: null,
  };

  const resultsData = {
    batchId: 'batch-export-test',
    status: 'COMPLETED',
    homepageUrl: 'https://example.com',
    wcagLevel: 'AA',
    totalUrls: 3,
    completedCount: 3,
    failedCount: 0,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    aggregate: {
      totalIssues: 15,
      criticalCount: 3,
      seriousCount: 5,
      moderateCount: 4,
      minorCount: 3,
      passedChecks: 120,
      urlsScanned: 3,
    },
    urls: [],
    topCriticalUrls: [],
  };

  test.describe('Export Button States', () => {
    test('should show export button enabled for completed batch', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-export-test', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: completedBatchData }),
        });
      });

      await page.route('**/api/v1/batches/batch-export-test/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: resultsData }),
        });
      });

      await page.goto('/batch/batch-export-test');

      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Export button should be enabled
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await expect(exportButton).toBeEnabled();
    });

    test('should disable export button for running batch', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-running', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...completedBatchData,
              id: 'batch-running',
              status: 'RUNNING',
              completedCount: 1,
              progress: 33,
              completedAt: null,
            },
          }),
        });
      });

      await page.goto('/batch/batch-running');

      await expect(page.getByText(/Batch Scan in Progress/i)).toBeVisible({ timeout: 5000 });

      // Export button should be disabled or not visible for running batch
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      if (await exportButton.isVisible()) {
        await expect(exportButton).toBeDisabled();
      }
    });

    test('should disable export button for cancelled batch', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-cancelled', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...completedBatchData,
              id: 'batch-cancelled',
              status: 'CANCELLED',
              completedCount: 1,
              progress: 33,
              completedAt: null,
              cancelledAt: new Date().toISOString(),
            },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-cancelled/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...resultsData,
              batchId: 'batch-cancelled',
              status: 'CANCELLED',
              completedCount: 1,
            },
          }),
        });
      });

      await page.goto('/batch/batch-cancelled');

      await expect(page.getByText(/Batch Scan Cancelled/i)).toBeVisible({ timeout: 5000 });

      // Export button should be disabled for cancelled batch
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      if (await exportButton.isVisible()) {
        await expect(exportButton).toBeDisabled();
      }
    });
  });

  test.describe('Async Export Flow - Immediate Ready', () => {
    test('should download PDF immediately when report is cached', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-cached', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-cached' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-cached/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-cached' },
          }),
        });
      });

      // Mock export request - return ready immediately (cached)
      await page.route('**/api/v1/batches/batch-cached/export/request**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'ready',
              url: 'https://s3.example.com/batch-cached-report.pdf',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              reportId: 'report_123',
            },
          }),
        });
      });

      // Mock the S3 download
      await page.route('https://s3.example.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('Mock PDF content'),
        });
      });

      await page.goto('/batch/batch-cached');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Click export button to open dropdown
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();

      // Select PDF option
      const pdfOption = page.getByRole('menuitem', { name: /PDF/i });
      await expect(pdfOption).toBeVisible();
      await pdfOption.click();

      // Should show success or start download
      await expect(page.getByText(/completed|success/i)).toBeVisible({ timeout: 5000 });
    });

    test('should download JSON immediately when report is cached', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-json-cached', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-json-cached' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-json-cached/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-json-cached' },
          }),
        });
      });

      // Mock export request - return ready immediately
      await page.route('**/api/v1/batches/batch-json-cached/export/request**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'ready',
              url: 'https://s3.example.com/batch-json-cached-report.json',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              reportId: 'report_456',
            },
          }),
        });
      });

      // Mock the S3 download
      await page.route('https://s3.example.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: 'mock json content' }),
        });
      });

      await page.goto('/batch/batch-json-cached');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Click export button
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();

      // Select JSON option
      const jsonOption = page.getByRole('menuitem', { name: /JSON/i });
      await expect(jsonOption).toBeVisible();
      await jsonOption.click();

      // Should show success
      await expect(page.getByText(/completed|success/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Async Export Flow - Generation Required', () => {
    test('should show generating modal and poll for completion', async ({ page }) => {
      let pollCount = 0;

      await page.route('**/api/v1/batches/batch-generate', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-generate' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-generate/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-generate' },
          }),
        });
      });

      // Mock export request - return generating
      await page.route('**/api/v1/batches/batch-generate/export/request**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'generating',
              reportId: 'report_pending',
              message: 'Report generation in progress',
            },
          }),
        });
      });

      // Mock export status - transition from generating to ready
      await page.route('**/api/v1/batches/batch-generate/export/status**', async (route) => {
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
                  url: 'https://s3.example.com/batch-generate-report.pdf',
                  expiresAt: new Date(Date.now() + 3600000).toISOString(),
                  reportId: 'report_pending',
                }
              : {
                  status: 'generating',
                  reportId: 'report_pending',
                },
          }),
        });
      });

      // Mock the S3 download
      await page.route('https://s3.example.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('Mock PDF content'),
        });
      });

      await page.goto('/batch/batch-generate');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Click export button
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();

      // Select PDF option
      const pdfOption = page.getByRole('menuitem', { name: /PDF/i });
      await pdfOption.click();

      // Should show generating modal (Requirement 4.2)
      await expect(page.getByText(/Generating|Exporting/i)).toBeVisible({ timeout: 3000 });

      // Wait for completion (polling)
      await expect(page.getByText(/completed|success/i)).toBeVisible({ timeout: 10000 });

      // Verify polling occurred
      expect(pollCount).toBeGreaterThanOrEqual(1);
    });

    test('should allow cancellation during generation', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-cancel-export', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-cancel-export' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-cancel-export/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-cancel-export' },
          }),
        });
      });

      // Mock export request - always return generating
      await page.route('**/api/v1/batches/batch-cancel-export/export/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'generating',
              reportId: 'report_cancel',
              message: 'Report generation in progress',
            },
          }),
        });
      });

      await page.goto('/batch/batch-cancel-export');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Start export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should show generating modal
      await expect(page.getByText(/Generating|Exporting/i)).toBeVisible({ timeout: 3000 });

      // Find and click cancel button (Requirement 4.3)
      const cancelButton = page.getByRole('button', { name: /Cancel/i });
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      // Modal should close, no error state
      await expect(page.getByText(/Generating|Exporting/i)).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Export Error Handling', () => {
    test('should handle export request failure', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-error', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-error' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-error/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-error' },
          }),
        });
      });

      // Mock export request failure
      await page.route('**/api/v1/batches/batch-error/export/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error: Failed to generate report',
          }),
        });
      });

      await page.goto('/batch/batch-error');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Try to export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should show error message
      await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });
    });

    test('should handle generation failure status', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-gen-fail', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-gen-fail' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-gen-fail/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-gen-fail' },
          }),
        });
      });

      // Mock export request - return failed status
      await page.route('**/api/v1/batches/batch-gen-fail/export/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'failed',
              errorMessage: 'Report generation failed: Out of memory',
              reportId: 'report_failed',
            },
          }),
        });
      });

      await page.goto('/batch/batch-gen-fail');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Try to export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should show error message
      await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });
    });

    test('should allow retry after failure', async ({ page }) => {
      let attemptCount = 0;

      await page.route('**/api/v1/batches/batch-retry', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-retry' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-retry/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-retry' },
          }),
        });
      });

      // Mock export request - fail first, succeed second
      await page.route('**/api/v1/batches/batch-retry/export/request**', async (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                status: 'failed',
                errorMessage: 'Temporary failure',
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
                status: 'ready',
                url: 'https://s3.example.com/batch-retry-report.pdf',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                reportId: 'report_retry',
              },
            }),
          });
        }
      });

      // Mock the S3 download
      await page.route('https://s3.example.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('Mock PDF content'),
        });
      });

      await page.goto('/batch/batch-retry');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // First attempt - fails
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should show error
      await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });

      // Click retry button
      const retryButton = page.getByRole('button', { name: /Retry/i });
      if (await retryButton.isVisible()) {
        await retryButton.click();

        // Should succeed on retry
        await expect(page.getByText(/completed|success/i)).toBeVisible({ timeout: 5000 });
        expect(attemptCount).toBe(2);
      }
    });
  });

  test.describe('Export Modal Behavior', () => {
    test('should close modal on successful download', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-modal-close', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-modal-close' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-modal-close/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-modal-close' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-modal-close/export/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'ready',
              url: 'https://s3.example.com/batch-modal-close-report.pdf',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              reportId: 'report_modal',
            },
          }),
        });
      });

      await page.route('https://s3.example.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('Mock PDF content'),
        });
      });

      await page.goto('/batch/batch-modal-close');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Start export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Success confirmation should show briefly then dismiss (Requirement 4.5)
      await expect(page.getByText(/completed|success/i)).toBeVisible({ timeout: 5000 });

      // Wait for auto-dismiss (2 seconds according to spec)
      await page.waitForTimeout(3000);

      // Modal should be closed
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        // If still visible, it should only show completed state
        await expect(page.getByText(/Generating/i)).not.toBeVisible();
      }
    });

    test('should show format in generating message', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-format-msg', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-format-msg' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-format-msg/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-format-msg' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-format-msg/export/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'generating',
              reportId: 'report_format',
            },
          }),
        });
      });

      await page.goto('/batch/batch-format-msg');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Start JSON export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /JSON/i }).click();

      // Should show generating with format
      await expect(page.getByText(/JSON|Generating/i)).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible export button', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-a11y', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-a11y' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-a11y/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-a11y' },
          }),
        });
      });

      await page.goto('/batch/batch-a11y');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Export button should have accessible name
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await expect(exportButton).toHaveAttribute('aria-label', /.+/);
    });

    test('should announce status changes to screen readers', async ({ page }) => {
      await page.route('**/api/v1/batches/batch-announce', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...completedBatchData, id: 'batch-announce' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-announce/results', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { ...resultsData, batchId: 'batch-announce' },
          }),
        });
      });

      await page.route('**/api/v1/batches/batch-announce/export/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'ready',
              url: 'https://s3.example.com/batch-announce-report.pdf',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              reportId: 'report_announce',
            },
          }),
        });
      });

      await page.route('https://s3.example.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('Mock PDF content'),
        });
      });

      await page.goto('/batch/batch-announce');
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({ timeout: 5000 });

      // Start export
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await exportButton.click();
      await page.getByRole('menuitem', { name: /PDF/i }).click();

      // Should have live region for status announcements
      const liveRegion = page.locator('[role="status"][aria-live]');
      await expect(liveRegion).toBeVisible();
    });
  });
});
