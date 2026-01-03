import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Admin AI Queue Management
 *
 * Tests the admin panel AI queue functionality:
 * 1. AI Campaign dashboard display
 * 2. Queue table with filtering
 * 3. CSV export functionality
 * 4. CSV import functionality
 * 5. Pause/resume campaign controls
 * 6. Failed scan retry functionality
 *
 * Requirements:
 * - REQ-5: Admin dashboard with token usage
 * - REQ-4: Offline AI processing with CSV export/import
 *
 * @see .claude/specs/ai-early-bird-scan/requirements.md
 */

test.describe('Admin AI Queue - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock admin authentication
    await page.route('**/api/v1/admin/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            admin: {
              id: 'admin-123',
              email: 'admin@test.com',
              role: 'ADMIN',
            },
          },
        }),
      });
    });
  });

  test.describe('Campaign Metrics Display', () => {
    test('should display campaign metrics on dashboard', async ({ page }) => {
      // Mock campaign metrics
      await page.route('**/api/v1/admin/ai-campaign', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              totalTokenBudget: 100000,
              usedTokens: 45000,
              remainingTokens: 55000,
              percentUsed: 45,
              reservedSlots: 500,
              completedScans: 450,
              failedScans: 10,
              pendingScans: 40,
              avgTokensPerScan: 100,
              projectedSlotsRemaining: 550,
              campaignStatus: 'ACTIVE',
              startsAt: '2025-01-01T00:00:00Z',
              endsAt: '2025-02-01T00:00:00Z',
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Verify metrics are displayed
      await expect(page.getByTestId('token-budget')).toContainText('100,000');
      await expect(page.getByTestId('used-tokens')).toContainText('45,000');
      await expect(page.getByTestId('remaining-tokens')).toContainText('55,000');
      await expect(page.getByTestId('campaign-status')).toContainText('ACTIVE');
    });

    test('should display usage percentage progress bar', async ({ page }) => {
      // Mock campaign metrics
      await page.route('**/api/v1/admin/ai-campaign', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              totalTokenBudget: 100000,
              usedTokens: 45000,
              remainingTokens: 55000,
              percentUsed: 45,
              reservedSlots: 500,
              completedScans: 450,
              failedScans: 10,
              pendingScans: 40,
              avgTokensPerScan: 100,
              projectedSlotsRemaining: 550,
              campaignStatus: 'ACTIVE',
              startsAt: '2025-01-01T00:00:00Z',
              endsAt: '2025-02-01T00:00:00Z',
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Verify progress bar
      const progressBar = page.getByTestId('token-usage-progress');
      await expect(progressBar).toBeVisible();
      await expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    });

    test('should display scan statistics', async ({ page }) => {
      // Mock campaign metrics
      await page.route('**/api/v1/admin/ai-campaign', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              totalTokenBudget: 100000,
              usedTokens: 45000,
              remainingTokens: 55000,
              percentUsed: 45,
              reservedSlots: 500,
              completedScans: 450,
              failedScans: 10,
              pendingScans: 40,
              avgTokensPerScan: 100,
              projectedSlotsRemaining: 550,
              campaignStatus: 'ACTIVE',
              startsAt: '2025-01-01T00:00:00Z',
              endsAt: '2025-02-01T00:00:00Z',
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Verify scan stats
      await expect(page.getByTestId('completed-scans')).toContainText('450');
      await expect(page.getByTestId('pending-scans')).toContainText('40');
      await expect(page.getByTestId('failed-scans')).toContainText('10');
    });
  });

  test.describe('Pause/Resume Controls', () => {
    test('should pause active campaign', async ({ page }) => {
      // Mock active campaign
      await page.route('**/api/v1/admin/ai-campaign', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                totalTokenBudget: 100000,
                usedTokens: 45000,
                remainingTokens: 55000,
                percentUsed: 45,
                reservedSlots: 500,
                completedScans: 450,
                failedScans: 10,
                pendingScans: 40,
                avgTokensPerScan: 100,
                projectedSlotsRemaining: 550,
                campaignStatus: 'ACTIVE',
                startsAt: '2025-01-01T00:00:00Z',
                endsAt: '2025-02-01T00:00:00Z',
              },
            }),
          });
        }
      });

      // Mock pause endpoint
      await page.route('**/api/v1/admin/ai-campaign/pause', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'campaign-123',
              status: 'PAUSED',
              message: 'Campaign paused successfully',
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Click pause button
      const pauseButton = page.getByTestId('pause-campaign-button');
      await expect(pauseButton).toBeVisible();
      await pauseButton.click();

      // Verify success message
      await expect(page.getByText('Campaign paused successfully')).toBeVisible();
    });

    test('should resume paused campaign', async ({ page }) => {
      // Mock paused campaign
      await page.route('**/api/v1/admin/ai-campaign', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                totalTokenBudget: 100000,
                usedTokens: 45000,
                remainingTokens: 55000,
                percentUsed: 45,
                reservedSlots: 500,
                completedScans: 450,
                failedScans: 10,
                pendingScans: 40,
                avgTokensPerScan: 100,
                projectedSlotsRemaining: 550,
                campaignStatus: 'PAUSED',
                startsAt: '2025-01-01T00:00:00Z',
                endsAt: '2025-02-01T00:00:00Z',
              },
            }),
          });
        }
      });

      // Mock resume endpoint
      await page.route('**/api/v1/admin/ai-campaign/resume', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'campaign-123',
              status: 'ACTIVE',
              message: 'Campaign resumed successfully',
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Click resume button
      const resumeButton = page.getByTestId('resume-campaign-button');
      await expect(resumeButton).toBeVisible();
      await resumeButton.click();

      // Verify success message
      await expect(page.getByText('Campaign resumed successfully')).toBeVisible();
    });
  });
});

test.describe('Admin AI Queue - Queue Table', () => {
  test.beforeEach(async ({ page }) => {
    // Mock admin authentication
    await page.route('**/api/v1/admin/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            admin: {
              id: 'admin-123',
              email: 'admin@test.com',
              role: 'ADMIN',
            },
          },
        }),
      });
    });
  });

  test.describe('Queue Table Display', () => {
    test('should display AI scans in queue table', async ({ page }) => {
      // Mock AI queue data
      await page.route('**/api/v1/admin/ai-queue**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              scans: [
                {
                  id: 'scan-1',
                  url: 'https://example.com',
                  status: 'PENDING',
                  createdAt: '2025-01-01T10:00:00Z',
                  email: 'user1@example.com',
                },
                {
                  id: 'scan-2',
                  url: 'https://example2.com',
                  status: 'DOWNLOADED',
                  createdAt: '2025-01-01T11:00:00Z',
                  email: 'user2@example.com',
                },
                {
                  id: 'scan-3',
                  url: 'https://example3.com',
                  status: 'COMPLETED',
                  createdAt: '2025-01-01T12:00:00Z',
                  email: null,
                },
              ],
              pagination: {
                page: 1,
                limit: 20,
                total: 3,
                totalPages: 1,
              },
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Switch to Queue tab
      const queueTab = page.getByRole('tab', { name: /queue/i });
      await queueTab.click();

      // Verify table content
      await expect(page.getByText('https://example.com')).toBeVisible();
      await expect(page.getByText('https://example2.com')).toBeVisible();
      await expect(page.getByText('https://example3.com')).toBeVisible();
    });

    test('should filter queue by status', async ({ page }) => {
      // Capture filter request
      let capturedFilter: string | null = null;

      await page.route('**/api/v1/admin/ai-queue**', async (route) => {
        const url = new URL(route.request().url());
        capturedFilter = url.searchParams.get('status');

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              scans: [],
              pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
              },
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Switch to Queue tab
      const queueTab = page.getByRole('tab', { name: /queue/i });
      await queueTab.click();

      // Apply status filter
      const statusFilter = page.getByTestId('status-filter');
      await statusFilter.selectOption('PENDING');

      // Verify filter was applied
      await page.waitForTimeout(500);
      expect(capturedFilter).toBe('PENDING');
    });
  });

  test.describe('CSV Export', () => {
    test('should export pending scans to CSV', async ({ page }) => {
      // Mock export endpoint
      await page.route('**/api/v1/admin/ai-queue/export', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          headers: {
            'Content-Disposition': 'attachment; filename=ai-queue-export.csv',
          },
          body: 'scan_id,url,created_at\nscan-1,https://example.com,2025-01-01T10:00:00Z',
        });
      });

      await page.goto('/admin/ai-campaign');

      // Switch to Queue tab
      const queueTab = page.getByRole('tab', { name: /queue/i });
      await queueTab.click();

      // Click export button
      const exportButton = page.getByTestId('export-csv-button');
      await expect(exportButton).toBeVisible();

      // Verify download starts (we can't fully test file download in E2E)
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toContain('csv');
    });
  });

  test.describe('CSV Import', () => {
    test('should import CSV with AI results', async ({ page }) => {
      // Mock import endpoint
      await page.route('**/api/v1/admin/ai-queue/import', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              imported: 5,
              failed: 1,
              errors: ['Invalid scan_id: scan-invalid'],
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Switch to Queue tab
      const queueTab = page.getByRole('tab', { name: /queue/i });
      await queueTab.click();

      // Click import button
      const importButton = page.getByTestId('import-csv-button');
      await expect(importButton).toBeVisible();
      await importButton.click();

      // Verify import modal/dialog appears
      const importModal = page.getByTestId('import-modal');
      await expect(importModal).toBeVisible();
    });
  });

  test.describe('Failed Scan Retry', () => {
    test('should retry failed scan', async ({ page }) => {
      // Mock AI queue with failed scan
      await page.route('**/api/v1/admin/ai-queue**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              scans: [
                {
                  id: 'scan-failed',
                  url: 'https://failed-example.com',
                  status: 'FAILED',
                  createdAt: '2025-01-01T10:00:00Z',
                  email: 'user@example.com',
                },
              ],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            },
          }),
        });
      });

      // Mock retry endpoint
      await page.route('**/api/v1/admin/ai-queue/scan-failed/retry', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              scanId: 'scan-failed',
              status: 'PENDING',
              message: 'Scan queued for retry',
            },
          }),
        });
      });

      await page.goto('/admin/ai-campaign');

      // Switch to Queue tab
      const queueTab = page.getByRole('tab', { name: /queue/i });
      await queueTab.click();

      // Click retry button for failed scan
      const retryButton = page.getByTestId('retry-button-scan-failed');
      await expect(retryButton).toBeVisible();
      await retryButton.click();

      // Verify success message
      await expect(page.getByText('Scan queued for retry')).toBeVisible();
    });
  });
});

test.describe('Admin AI Queue - Access Control', () => {
  test('should redirect unauthenticated users', async ({ page }) => {
    // Mock no session
    await page.route('**/api/v1/admin/session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Unauthorized',
        }),
      });
    });

    await page.goto('/admin/ai-campaign');

    // Should redirect to login
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('should block non-admin users', async ({ page }) => {
    // Mock non-admin session
    await page.route('**/api/v1/admin/session', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Forbidden',
        }),
      });
    });

    await page.goto('/admin/ai-campaign');

    // Should show access denied or redirect
    await expect(page.getByText(/forbidden|access denied/i)).toBeVisible();
  });
});
