import { test, expect } from '@playwright/test';

/**
 * E2E Tests: User Export Flow
 *
 * PREREQUISITE: Dev server must be running on http://localhost:3080
 * Run: npm run dev (from apps/web directory)
 *
 * Tests the user export functionality:
 * 1. View scan with existing reports
 * 2. Download existing report (PDF/JSON)
 * 3. Generate new report when none exists
 * 4. Modal progress display during generation
 * 5. Error handling and retry
 * 6. Cancellation flow
 *
 * Coverage:
 * - Requirements 6.1: Show download links when reports exist
 * - Requirements 6.2: Direct download for existing reports
 * - Requirements 6.3: Generate option when no reports exist
 * - Requirements 6.4: Modal display during generation
 * - Requirements 6.5: Download completion and auto-dismiss
 * - Requirements 6.6: Error handling with retry option
 *
 * @see apps/web/src/components/features/export/ExportOptions.tsx
 * @see apps/web/src/components/features/export/ExportModal.tsx
 * @see apps/web/src/hooks/useExport.ts
 */

test.describe('User Export Flow', () => {
  // Helper function to mock scan details API with completed status
  const mockCompletedScan = async (page: any, scanId: string) => {
    await page.route(`**/api/scans/${scanId}`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'COMPLETED',
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }),
      });
    });
  };

  // Helper function to mock scan results API
  const mockScanResults = async (page: any, scanId: string) => {
    await page.route(`**/api/scans/${scanId}/results`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          url: 'https://example.com',
          wcagLevel: 'AA',
          completedAt: new Date().toISOString(),
          summary: {
            totalIssues: 5,
            critical: 1,
            serious: 2,
            moderate: 1,
            minor: 1,
            passedTests: 45,
            wcagCompliance: { levelA: 95, levelAA: 90, levelAAA: 80 },
          },
          issuesByImpact: {
            critical: [],
            serious: [],
            moderate: [],
            minor: [],
          },
        }),
      });
    });
  };

  // Helper function to mock report status API
  const mockReportStatus = async (
    page: any,
    scanId: string,
    pdfReady: boolean = false,
    jsonReady: boolean = false
  ) => {
    await page.route(`**/api/scans/${scanId}/reports`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pdf: pdfReady
            ? {
                url: `https://storage.example.com/reports/${scanId}.pdf`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                size: 524288, // 512 KB
              }
            : null,
          json: jsonReady
            ? {
                url: `https://storage.example.com/reports/${scanId}.json`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                size: 102400, // 100 KB
              }
            : null,
        }),
      });
    });
  };

  // Helper function to mock report generation API
  const mockReportGeneration = async (
    page: any,
    scanId: string,
    format: 'pdf' | 'json',
    shouldSucceed: boolean = true
  ) => {
    let callCount = 0;

    await page.route(`**/api/scans/${scanId}/reports/${format}`, async (route: any) => {
      callCount++;

      if (callCount === 1) {
        // First call: Report is generating
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'generating',
            jobId: `job-${scanId}-${format}`,
          }),
        });
      } else if (shouldSucceed) {
        // Subsequent calls: Report is ready
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: `https://storage.example.com/reports/${scanId}.${format}`,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
        });
      } else {
        // Error case
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to generate report',
          }),
        });
      }
    });
  };

  test.beforeEach(async ({ page }) => {
    // Mock reCAPTCHA for any form submissions
    await page.addInitScript(() => {
      (window as any).grecaptcha = {
        ready: (callback: () => void) => callback(),
        execute: () => Promise.resolve('mock-recaptcha-token'),
      };
    });
  });

  test('should show download links when reports exist', async ({ page }) => {
    const scanId = 'test-scan-export-ready';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, true, true); // Both reports ready

    await page.goto(`/scan/${scanId}`);

    // Click export button to open dropdown
    const exportButton = page.getByRole('button', { name: /export/i });
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // PDF option should show "Ready • Download ↓"
    await expect(page.getByText('PDF Report')).toBeVisible();
    await expect(page.getByText(/Ready.*512 KB.*Download/i)).toBeVisible();

    // JSON option should show "Ready • Download ↓"
    await expect(page.getByText('JSON Data')).toBeVisible();
    await expect(page.getByText(/Ready.*100 KB.*Download/i)).toBeVisible();
  });

  test('should download PDF report directly when ready', async ({ page }) => {
    const scanId = 'test-scan-download-pdf';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, true, false); // Only PDF ready

    // Mock the actual PDF file download
    await page.route('**/storage.example.com/reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('PDF content'),
      });
    });

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    await page.goto(`/scan/${scanId}`);

    // Open export dropdown
    await page.getByRole('button', { name: /export/i }).click();

    // Click PDF option
    await page.getByText('PDF Report').click();

    // Should trigger download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should download JSON report directly when ready', async ({ page }) => {
    const scanId = 'test-scan-download-json';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, true); // Only JSON ready

    // Mock the actual JSON file download
    await page.route('**/storage.example.com/reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'test' }),
      });
    });

    // Listen for download event
    const downloadPromise = page.waitForEvent('download');

    await page.goto(`/scan/${scanId}`);

    // Open export dropdown
    await page.getByRole('button', { name: /export/i }).click();

    // Click JSON option
    await page.getByText('JSON Data').click();

    // Should trigger download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should show generate option when no reports exist', async ({ page }) => {
    const scanId = 'test-scan-no-reports';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false); // No reports ready

    await page.goto(`/scan/${scanId}`);

    // Open export dropdown
    await page.getByRole('button', { name: /export/i }).click();

    // PDF option should show "Generate formatted document"
    await expect(page.getByText('PDF Report')).toBeVisible();
    await expect(page.getByText('Generate formatted document')).toBeVisible();

    // JSON option should show "Generate raw scan data"
    await expect(page.getByText('JSON Data')).toBeVisible();
    await expect(page.getByText('Generate raw scan data')).toBeVisible();
  });

  test('should show modal when generating new report', async ({ page }) => {
    const scanId = 'test-scan-generate-modal';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'pdf', true);

    await page.goto(`/scan/${scanId}`);

    // Open export dropdown and click PDF
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    // Modal should appear with generating state
    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Generating PDF Report/i)).toBeVisible();
    await expect(modal.getByText(/This may take a few moments/i)).toBeVisible();

    // Should show spinner animation
    await expect(modal.locator('.animate-spin')).toBeVisible();

    // Should have cancel button
    await expect(modal.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('should complete generation and trigger download', async ({ page }) => {
    const scanId = 'test-scan-complete-generation';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'json', true);

    // Mock the actual JSON file download
    await page.route('**/storage.example.com/reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'test' }),
      });
    });

    const downloadPromise = page.waitForEvent('download');

    await page.goto(`/scan/${scanId}`);

    // Generate JSON report
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('JSON Data').click();

    // Modal should show generating state
    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal.getByText(/Generating JSON Report/i)).toBeVisible();

    // Wait for completion state
    await expect(modal.getByText(/Download started!/i)).toBeVisible({
      timeout: 10000,
    });

    // Should show success icon
    await expect(modal.locator('svg').first()).toBeVisible();

    // Download should be triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');

    // Modal should auto-dismiss after 2 seconds
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('should handle generation errors', async ({ page }) => {
    const scanId = 'test-scan-error';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'pdf', false); // Will fail

    await page.goto(`/scan/${scanId}`);

    // Attempt to generate PDF report
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    // Modal should show error state
    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal.getByText(/Failed to generate report/i)).toBeVisible({
      timeout: 10000,
    });

    // Should show error icon
    await expect(modal.locator('svg').first()).toBeVisible();

    // Should have retry and close buttons
    await expect(modal.getByRole('button', { name: /retry/i })).toBeVisible();
    await expect(modal.getByRole('button', { name: /close/i })).toBeVisible();
  });

  test('should allow retry after error', async ({ page }) => {
    const scanId = 'test-scan-retry';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false);

    let attemptCount = 0;
    await page.route(`**/api/scans/${scanId}/reports/pdf`, async (route) => {
      attemptCount++;

      if (attemptCount === 1) {
        // First attempt: fail
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' }),
        });
      } else if (attemptCount === 2) {
        // Retry: generating
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'generating',
            jobId: 'job-retry',
          }),
        });
      } else {
        // Success
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: `https://storage.example.com/reports/${scanId}.pdf`,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
        });
      }
    });

    await page.goto(`/scan/${scanId}`);

    // Generate PDF (will fail)
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    const modal = page.getByRole('dialog', { name: /export/i });

    // Wait for error state
    await expect(modal.getByText(/Failed to generate report/i)).toBeVisible({
      timeout: 5000,
    });

    // Click retry
    await modal.getByRole('button', { name: /retry/i }).click();

    // Should show generating state again
    await expect(modal.getByText(/Generating PDF Report/i)).toBeVisible();

    // Should eventually succeed
    await expect(modal.getByText(/Download started!/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should allow cancellation during generation', async ({ page }) => {
    const scanId = 'test-scan-cancel';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false);

    // Mock slow generation
    await page.route(`**/api/scans/${scanId}/reports/pdf`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'generating',
          jobId: 'job-slow',
        }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Start generation
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal.getByText(/Generating PDF Report/i)).toBeVisible();

    // Click cancel
    await modal.getByRole('button', { name: /cancel/i }).click();

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('should disable export button when scan is not completed', async ({ page }) => {
    const scanId = 'test-scan-running';

    // Mock running scan
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    // Mock empty events
    await page.route(`**/api/scans/${scanId}/events`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Export button should be disabled or not visible
    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeDisabled();
    }
  });

  test('should close modal when clicking outside', async ({ page }) => {
    const scanId = 'test-scan-click-outside';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'pdf', true);

    await page.goto(`/scan/${scanId}`);

    // Start generation
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal).toBeVisible();

    // Click outside modal (on backdrop)
    await page.locator('.bg-black\\/50').click({ position: { x: 0, y: 0 } });

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('should close modal with ESC key', async ({ page }) => {
    const scanId = 'test-scan-esc-key';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'json', true);

    await page.goto(`/scan/${scanId}`);

    // Start generation
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('JSON Data').click();

    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal).toBeVisible();

    // Press ESC key
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('should trap focus inside modal', async ({ page }) => {
    const scanId = 'test-scan-focus-trap';

    await mockCompletedScan(page, scanId);
    await mockScanResults(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'pdf', false); // Will show error with multiple buttons

    await page.goto(`/scan/${scanId}`);

    // Generate report (will fail to show error state with buttons)
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal.getByText(/Failed to generate report/i)).toBeVisible({
      timeout: 5000,
    });

    // Focus should be on retry button
    const retryButton = modal.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeFocused();

    // Tab to close button
    await page.keyboard.press('Tab');
    const closeButton = modal.getByRole('button', { name: /close/i });
    await expect(closeButton).toBeFocused();

    // Tab again should cycle back to retry button
    await page.keyboard.press('Tab');
    await expect(retryButton).toBeFocused();
  });
});
