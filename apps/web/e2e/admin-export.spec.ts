import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Admin Export Flow
 *
 * PREREQUISITE: Dev server must be running on http://localhost:3080
 * Run: npm run dev (from apps/web directory)
 *
 * Tests the admin export functionality:
 * 1. Admin can access export on any scan
 * 2. Export button works correctly on admin scan detail page
 * 3. Modal progress display works in admin context
 * 4. Admin can export scans regardless of ownership
 * 5. Export is disabled when scan is not completed
 * 6. Error handling in admin context
 *
 * Coverage:
 * - Requirements 7.1: Admin can export any scan
 * - Requirements 7.2: Export button on admin scan detail page
 * - Requirements 7.3: Modal works correctly in admin context
 * - Requirements 7.4: No ownership restrictions for admin
 * - Requirements 7.5: Disabled state for incomplete scans
 *
 * @see apps/web/src/app/admin/scans/[id]/page.tsx
 * @see apps/web/src/hooks/useAdminExport.ts
 */

test.describe('Admin Export Flow', () => {
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

  // Helper function to mock admin scan details API
  const mockAdminScanDetails = async (
    page: any,
    scanId: string,
    status: string = 'COMPLETED',
    userEmail: string = 'user@example.com'
  ) => {
    await page.route(`**/api/admin/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: scanId,
          url: 'https://example.com',
          status,
          wcagLevel: 'AA',
          email: userEmail,
          createdAt: new Date().toISOString(),
          completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
          scanResult:
            status === 'COMPLETED'
              ? {
                  id: 'result-123',
                  totalIssues: 5,
                  criticalCount: 1,
                  seriousCount: 2,
                  moderateCount: 1,
                  minorCount: 1,
                  passedChecks: 45,
                  inapplicableChecks: 10,
                  createdAt: new Date().toISOString(),
                  issues: [],
                }
              : null,
        }),
      });
    });
  };

  // Helper function to mock scan events API
  const mockScanEvents = async (page: any, scanId: string) => {
    await page.route(`**/api/scans/${scanId}/events`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [
            {
              id: 'event-1',
              scanId,
              level: 'INFO',
              message: 'Scan completed',
              metadata: {},
              adminOnly: false,
              createdAt: new Date().toISOString(),
            },
          ],
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
    await page.route(`**/api/scans/${scanId}/reports`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pdf: pdfReady
            ? {
                url: `https://storage.example.com/admin-reports/${scanId}.pdf`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                size: 524288,
              }
            : null,
          json: jsonReady
            ? {
                url: `https://storage.example.com/admin-reports/${scanId}.json`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                size: 102400,
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

    await page.route(`**/api/scans/${scanId}/reports/${format}`, async (route) => {
      callCount++;

      if (callCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'generating',
            jobId: `admin-job-${scanId}-${format}`,
          }),
        });
      } else if (shouldSucceed) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: `https://storage.example.com/admin-reports/${scanId}.${format}`,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
        });
      } else {
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
    // Mock admin authentication for all tests
    await mockAdminAuth(page);
  });

  test('should show export button on admin scan detail page', async ({ page }) => {
    const scanId = 'test-admin-scan-export-button';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);

    await page.goto(`/admin/scans/${scanId}`);

    // Export button should be visible
    const exportButton = page.getByRole('button', { name: /export/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });

  test('should allow exporting any scan regardless of ownership', async ({ page }) => {
    const scanId = 'test-admin-scan-other-user';

    // Scan belongs to different user
    await mockAdminScanDetails(page, scanId, 'COMPLETED', 'otheruser@example.com');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, true, true);

    // Mock file download
    await page.route('**/storage.example.com/admin-reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('PDF content'),
      });
    });

    const downloadPromise = page.waitForEvent('download');

    await page.goto(`/admin/scans/${scanId}`);

    // Admin should be able to export even though they don't own the scan
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    // Download should succeed
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should show modal progress for generation', async ({ page }) => {
    const scanId = 'test-admin-scan-modal';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'pdf', true);

    await page.goto(`/admin/scans/${scanId}`);

    // Click export and generate PDF
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    // Modal should appear
    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Generating PDF Report/i)).toBeVisible();

    // Should show spinner
    await expect(modal.locator('.animate-spin')).toBeVisible();

    // Should have cancel button
    await expect(modal.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('should complete generation and show success', async ({ page }) => {
    const scanId = 'test-admin-scan-success';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'json', true);

    // Mock file download
    await page.route('**/storage.example.com/admin-reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'test' }),
      });
    });

    const downloadPromise = page.waitForEvent('download');

    await page.goto(`/admin/scans/${scanId}`);

    // Generate JSON report
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('JSON Data').click();

    const modal = page.getByRole('dialog', { name: /export/i });

    // Wait for completion
    await expect(modal.getByText(/Download started!/i)).toBeVisible({
      timeout: 10000,
    });

    // Download should be triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');

    // Modal should auto-dismiss
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('should be disabled when scan is not completed', async ({ page }) => {
    const scanId = 'test-admin-scan-running';

    // Scan is still running
    await mockAdminScanDetails(page, scanId, 'RUNNING');
    await mockScanEvents(page, scanId);

    await page.goto(`/admin/scans/${scanId}`);

    // Export button should be disabled
    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeDisabled();
    }
  });

  test('should be disabled when scan is pending', async ({ page }) => {
    const scanId = 'test-admin-scan-pending';

    await mockAdminScanDetails(page, scanId, 'PENDING');
    await mockScanEvents(page, scanId);

    await page.goto(`/admin/scans/${scanId}`);

    // Export button should be disabled
    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeDisabled();
    }
  });

  test('should be disabled when scan failed', async ({ page }) => {
    const scanId = 'test-admin-scan-failed';

    await mockAdminScanDetails(page, scanId, 'FAILED');
    await mockScanEvents(page, scanId);

    await page.goto(`/admin/scans/${scanId}`);

    // Export button should be disabled
    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeDisabled();
    }
  });

  test('should handle generation errors gracefully', async ({ page }) => {
    const scanId = 'test-admin-scan-error';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'pdf', false); // Will fail

    await page.goto(`/admin/scans/${scanId}`);

    // Attempt to generate PDF
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    const modal = page.getByRole('dialog', { name: /export/i });

    // Should show error state
    await expect(modal.getByText(/Failed to generate report/i)).toBeVisible({
      timeout: 10000,
    });

    // Should have retry and close buttons
    await expect(modal.getByRole('button', { name: /retry/i })).toBeVisible();
    await expect(modal.getByRole('button', { name: /close/i })).toBeVisible();
  });

  test('should allow retry after error in admin context', async ({ page }) => {
    const scanId = 'test-admin-scan-retry';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);

    let attemptCount = 0;
    await page.route(`**/api/scans/${scanId}/reports/json`, async (route) => {
      attemptCount++;

      if (attemptCount === 1) {
        // First attempt fails
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
            jobId: 'admin-retry-job',
          }),
        });
      } else {
        // Success
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: `https://storage.example.com/admin-reports/${scanId}.json`,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }),
        });
      }
    });

    await page.goto(`/admin/scans/${scanId}`);

    // Generate JSON (will fail)
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('JSON Data').click();

    const modal = page.getByRole('dialog', { name: /export/i });

    // Wait for error
    await expect(modal.getByText(/Failed to generate report/i)).toBeVisible({
      timeout: 5000,
    });

    // Click retry
    await modal.getByRole('button', { name: /retry/i }).click();

    // Should show generating state
    await expect(modal.getByText(/Generating JSON Report/i)).toBeVisible();

    // Should eventually succeed
    await expect(modal.getByText(/Download started!/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should allow cancellation during generation', async ({ page }) => {
    const scanId = 'test-admin-scan-cancel';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);

    // Mock slow generation
    await page.route(`**/api/scans/${scanId}/reports/pdf`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'generating',
          jobId: 'admin-slow-job',
        }),
      });
    });

    await page.goto(`/admin/scans/${scanId}`);

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

  test('should download existing PDF report directly', async ({ page }) => {
    const scanId = 'test-admin-scan-existing-pdf';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, true, false); // PDF already exists

    // Mock file download
    await page.route('**/storage.example.com/admin-reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('PDF content'),
      });
    });

    const downloadPromise = page.waitForEvent('download');

    await page.goto(`/admin/scans/${scanId}`);

    // Click export
    await page.getByRole('button', { name: /export/i }).click();

    // Should show "Ready" status
    await expect(page.getByText(/Ready.*512 KB.*Download/i)).toBeVisible();

    // Click PDF option
    await page.getByText('PDF Report').click();

    // Should download directly without modal
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should download existing JSON report directly', async ({ page }) => {
    const scanId = 'test-admin-scan-existing-json';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, true); // JSON already exists

    // Mock file download
    await page.route('**/storage.example.com/admin-reports/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'test' }),
      });
    });

    const downloadPromise = page.waitForEvent('download');

    await page.goto(`/admin/scans/${scanId}`);

    // Click export
    await page.getByRole('button', { name: /export/i }).click();

    // Should show "Ready" status
    await expect(page.getByText(/Ready.*100 KB.*Download/i)).toBeVisible();

    // Click JSON option
    await page.getByText('JSON Data').click();

    // Should download directly
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should close modal with ESC key in admin context', async ({ page }) => {
    const scanId = 'test-admin-scan-esc';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'pdf', true);

    await page.goto(`/admin/scans/${scanId}`);

    // Start generation
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal).toBeVisible();

    // Press ESC
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('should close modal when clicking outside in admin context', async ({ page }) => {
    const scanId = 'test-admin-scan-click-outside';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);
    await mockReportGeneration(page, scanId, 'json', true);

    await page.goto(`/admin/scans/${scanId}`);

    // Start generation
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('JSON Data').click();

    const modal = page.getByRole('dialog', { name: /export/i });
    await expect(modal).toBeVisible();

    // Click backdrop
    await page.locator('.bg-black\\/50').click({ position: { x: 0, y: 0 } });

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test('should show correct file sizes for existing reports', async ({ page }) => {
    const scanId = 'test-admin-scan-file-sizes';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, true, true); // Both reports exist

    await page.goto(`/admin/scans/${scanId}`);

    // Open export dropdown
    await page.getByRole('button', { name: /export/i }).click();

    // PDF should show 512 KB
    await expect(page.getByText(/PDF Report/i)).toBeVisible();
    await expect(page.getByText(/512 KB/i)).toBeVisible();

    // JSON should show 100 KB
    await expect(page.getByText(/JSON Data/i)).toBeVisible();
    await expect(page.getByText(/100 KB/i)).toBeVisible();
  });

  test('should handle timeout during report generation', async ({ page }) => {
    const scanId = 'test-admin-scan-timeout';

    await mockAdminScanDetails(page, scanId, 'COMPLETED');
    await mockScanEvents(page, scanId);
    await mockReportStatus(page, scanId, false, false);

    // Mock generation that never completes (always returns generating)
    await page.route(`**/api/scans/${scanId}/reports/pdf`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'generating',
          jobId: 'timeout-job',
        }),
      });
    });

    await page.goto(`/admin/scans/${scanId}`);

    // Start generation
    await page.getByRole('button', { name: /export/i }).click();
    await page.getByText('PDF Report').click();

    const modal = page.getByRole('dialog', { name: /export/i });

    // Should eventually show timeout error
    await expect(modal.getByText(/Failed to generate report/i)).toBeVisible({
      timeout: 60000, // 60 seconds for timeout
    });

    // Error message should mention timeout
    await expect(modal.getByText(/timed out/i)).toBeVisible();
  });
});
