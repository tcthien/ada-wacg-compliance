import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Batch URL Scanning - Discovery to Results Flow
 *
 * Tests the complete batch scanning workflow:
 * 1. Navigate to discovery page
 * 2. Start discovery for a test URL
 * 3. Select multiple pages from discovery results
 * 4. Start batch scan
 * 5. Verify redirect to batch results page
 * 6. Verify progress indicator shows
 * 7. Wait for scan completion
 * 8. Verify results summary displays
 * 9. Verify individual URL results show
 *
 * Requirements:
 * - 6.1: User shall select pages from discovery and start batch scan
 * - 2.1: Frontend shall poll batch status endpoint every 2s
 * - 3.1: Results shall show aggregate statistics across all URLs
 *
 * @see apps/web/e2e/discovery-auto.spec.ts - Discovery flow patterns
 * @see apps/web/e2e/scan-flow.spec.ts - Single scan flow patterns
 */

test.describe('Batch Scan - Discovery to Results Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to discovery page
    await page.goto('/discovery');
  });

  test.describe('Discovery → Batch Scan Creation', () => {
    test('should complete discovery and start batch scan with selected pages', async ({
      page,
    }) => {
      // Setup mock API responses for discovery
      await page.route('**/api/v1/discoveries**', async (route) => {
        const mockPages = [
          {
            id: '1',
            url: 'https://example.com/',
            title: 'Home',
            source: 'SITEMAP',
            depth: 0,
          },
          {
            id: '2',
            url: 'https://example.com/about',
            title: 'About Us',
            source: 'NAVIGATION',
            depth: 1,
          },
          {
            id: '3',
            url: 'https://example.com/contact',
            title: 'Contact',
            source: 'CRAWLED',
            depth: 1,
          },
          {
            id: '4',
            url: 'https://example.com/products',
            title: 'Products',
            source: 'SITEMAP',
            depth: 1,
          },
        ];

        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                discovery: {
                  id: 'test-discovery-1',
                  status: 'COMPLETED',
                  phase: null,
                  pages: mockPages,
                },
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
                discovery: {
                  id: 'test-discovery-1',
                  status: 'COMPLETED',
                  phase: null,
                  pages: mockPages,
                },
              },
            }),
          });
        }
      });

      // Mock batch creation endpoint
      let batchCreated = false;
      await page.route('**/api/v1/batches', async (route) => {
        if (route.request().method() === 'POST') {
          batchCreated = true;
          const requestBody = JSON.parse(route.request().postData() || '{}');

          // Verify request contains selected URLs
          expect(requestBody.urls).toBeDefined();
          expect(requestBody.urls.length).toBeGreaterThan(0);

          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-test-123',
                status: 'PENDING',
                totalUrls: requestBody.urls.length,
                homepageUrl: 'https://example.com',
                scanIds: requestBody.urls.map((_: string, i: number) => `scan-${i}`),
              },
            }),
          });
        }
      });

      // Step 1: Complete discovery flow
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for discovery results
      await expect(page.getByText(/Discovered Pages/i)).toBeVisible({
        timeout: 5000,
      });

      // Step 2: Verify pages are displayed
      await expect(page.getByText('example.com')).toBeVisible();
      await expect(page.getByText('About Us')).toBeVisible();
      await expect(page.getByText('Contact')).toBeVisible();

      // Step 3: Select multiple pages (use Select All for convenience)
      await page.getByRole('button', { name: 'Select All' }).click();

      // Verify selection count updates
      await expect(page.getByText(/4 pages selected/i)).toBeVisible();

      // Step 4: Start batch scan
      const startScanButton = page.getByRole('button', { name: /Start Scan/i });
      await expect(startScanButton).toBeEnabled();
      await startScanButton.click();

      // Step 5: Verify redirect to batch results page
      await expect(page).toHaveURL(/\/batch\/batch-test-123/);

      // Verify batch was created
      expect(batchCreated).toBe(true);
    });

    test('should allow selecting specific pages instead of all', async ({
      page,
    }) => {
      // Setup mock discovery response
      await page.route('**/api/v1/discoveries**', async (route) => {
        const mockPages = [
          {
            id: '1',
            url: 'https://example.com/',
            title: 'Home',
            source: 'SITEMAP',
            depth: 0,
          },
          {
            id: '2',
            url: 'https://example.com/about',
            title: 'About',
            source: 'NAVIGATION',
            depth: 1,
          },
          {
            id: '3',
            url: 'https://example.com/contact',
            title: 'Contact',
            source: 'CRAWLED',
            depth: 1,
          },
        ];

        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              discovery: {
                id: 'test-discovery-2',
                status: 'COMPLETED',
                pages: mockPages,
              },
            },
          }),
        });
      });

      // Mock batch creation
      let selectedUrls: string[] = [];
      await page.route('**/api/v1/batches', async (route) => {
        if (route.request().method() === 'POST') {
          const requestBody = JSON.parse(route.request().postData() || '{}');
          selectedUrls = requestBody.urls;

          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-selective-123',
                status: 'PENDING',
                totalUrls: selectedUrls.length,
                homepageUrl: 'https://example.com',
                scanIds: [],
              },
            }),
          });
        }
      });

      // Complete discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for results
      await expect(page.getByText(/Discovered Pages/i)).toBeVisible({
        timeout: 5000,
      });

      // Select only first two checkboxes
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // Verify selection count
      await expect(page.getByText(/2 pages selected/i)).toBeVisible();

      // Start batch scan
      await page.getByRole('button', { name: /Start Scan/i }).click();

      // Verify only 2 URLs were sent
      await expect(page).toHaveURL(/\/batch\/batch-selective-123/);
      expect(selectedUrls.length).toBe(2);
    });
  });

  test.describe('Batch Progress Monitoring', () => {
    test('should show progress indicator and poll for updates', async ({
      page,
    }) => {
      let pollCount = 0;

      // Mock batch status endpoint with progressive updates
      await page.route('**/api/v1/batches/batch-progress-123', async (route) => {
        if (route.request().method() === 'GET') {
          pollCount++;

          // Simulate progressive completion
          const completedCount = Math.min(pollCount, 3);
          const status = completedCount === 3 ? 'COMPLETED' : 'RUNNING';

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'batch-progress-123',
                status,
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 3,
                completedCount,
                failedCount: 0,
                progress: Math.round((completedCount / 3) * 100),
                scans: [
                  {
                    scanId: 'scan-1',
                    url: 'https://example.com/',
                    pageTitle: 'Home',
                    status: 'COMPLETED',
                  },
                  {
                    scanId: 'scan-2',
                    url: 'https://example.com/about',
                    pageTitle: 'About',
                    status: completedCount >= 2 ? 'COMPLETED' : 'RUNNING',
                  },
                  {
                    scanId: 'scan-3',
                    url: 'https://example.com/contact',
                    pageTitle: 'Contact',
                    status: completedCount >= 3 ? 'COMPLETED' : 'PENDING',
                  },
                ],
                createdAt: new Date().toISOString(),
                completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
                cancelledAt: null,
              },
            }),
          });
        }
      });

      // Navigate directly to batch page
      await page.goto('/batch/batch-progress-123');

      // Verify initial progress display
      await expect(page.getByText(/Batch Scan in Progress/i)).toBeVisible();
      await expect(page.getByText(/example.com/)).toBeVisible();

      // Wait for progress updates (should poll every 2 seconds)
      await page.waitForTimeout(2500); // Wait for at least one poll

      // Verify polling occurred
      expect(pollCount).toBeGreaterThan(1);

      // Verify progress information is displayed
      await expect(page.getByText(/3/)).toBeVisible(); // Total URLs

      // Wait for completion (may need multiple polls)
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({
        timeout: 10000,
      });

      // Verify polling stopped after completion
      const pollsBeforeStop = pollCount;
      await page.waitForTimeout(3000);
      const pollsAfterStop = pollCount;

      // Should not have polled much more after completion
      expect(pollsAfterStop - pollsBeforeStop).toBeLessThanOrEqual(1);
    });

    test('should display individual scan statuses during progress', async ({
      page,
    }) => {
      // Mock batch status with mixed scan statuses
      await page.route('**/api/v1/batches/batch-mixed-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'batch-mixed-123',
              status: 'RUNNING',
              homepageUrl: 'https://example.com',
              wcagLevel: 'AA',
              totalUrls: 4,
              completedCount: 2,
              failedCount: 1,
              progress: 75, // 3 of 4 done (2 completed + 1 failed)
              scans: [
                {
                  scanId: 'scan-1',
                  url: 'https://example.com/',
                  pageTitle: 'Home',
                  status: 'COMPLETED',
                },
                {
                  scanId: 'scan-2',
                  url: 'https://example.com/about',
                  pageTitle: 'About',
                  status: 'COMPLETED',
                },
                {
                  scanId: 'scan-3',
                  url: 'https://example.com/contact',
                  pageTitle: 'Contact',
                  status: 'FAILED',
                  errorMessage: 'Page not accessible',
                },
                {
                  scanId: 'scan-4',
                  url: 'https://example.com/products',
                  pageTitle: 'Products',
                  status: 'RUNNING',
                },
              ],
              createdAt: new Date().toISOString(),
              completedAt: null,
              cancelledAt: null,
            },
          }),
        });
      });

      await page.goto('/batch/batch-mixed-123');

      // Verify batch is in progress
      await expect(page.getByText(/Batch Scan in Progress/i)).toBeVisible();

      // Verify progress percentage
      await expect(page.getByText(/75%/i)).toBeVisible();

      // Verify completion counts
      await expect(page.getByText(/2.*4/)).toBeVisible(); // "2 of 4" or similar
    });
  });

  test.describe('Batch Results Display', () => {
    test('should display aggregate results summary', async ({ page }) => {
      // Mock completed batch status
      await page.route('**/api/v1/batches/batch-complete-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'batch-complete-123',
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
            },
          }),
        });
      });

      // Mock batch results endpoint
      await page.route(
        '**/api/v1/batches/batch-complete-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-complete-123',
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
                urls: [
                  {
                    id: 'scan-1',
                    url: 'https://example.com/',
                    pageTitle: 'Home',
                    status: 'COMPLETED',
                    totalIssues: 5,
                    criticalCount: 1,
                    seriousCount: 2,
                    moderateCount: 1,
                    minorCount: 1,
                    errorMessage: null,
                  },
                  {
                    id: 'scan-2',
                    url: 'https://example.com/about',
                    pageTitle: 'About Us',
                    status: 'COMPLETED',
                    totalIssues: 7,
                    criticalCount: 2,
                    seriousCount: 2,
                    moderateCount: 2,
                    minorCount: 1,
                    errorMessage: null,
                  },
                  {
                    id: 'scan-3',
                    url: 'https://example.com/contact',
                    pageTitle: 'Contact',
                    status: 'COMPLETED',
                    totalIssues: 3,
                    criticalCount: 0,
                    seriousCount: 1,
                    moderateCount: 1,
                    minorCount: 1,
                    errorMessage: null,
                  },
                ],
                topCriticalUrls: [
                  {
                    url: 'https://example.com/about',
                    pageTitle: 'About Us',
                    criticalCount: 2,
                  },
                  {
                    url: 'https://example.com/',
                    pageTitle: 'Home',
                    criticalCount: 1,
                  },
                ],
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-complete-123');

      // Wait for completion
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify aggregate statistics are displayed (Requirement 3.1)
      await expect(page.getByText(/Results Summary/i)).toBeVisible();

      // Check for total issues
      await expect(page.getByText(/15/)).toBeVisible(); // Total issues

      // Check for severity counts (Requirement 3.2)
      await expect(page.getByText(/3/)).toBeVisible(); // Critical
      await expect(page.getByText(/5/)).toBeVisible(); // Serious

      // Verify URLs scanned count
      await expect(page.getByText(/3 URLs/i)).toBeVisible();
    });

    test('should display individual URL results with issue counts', async ({
      page,
    }) => {
      // Mock completed batch status
      await page.route('**/api/v1/batches/batch-urls-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'batch-urls-123',
              status: 'COMPLETED',
              homepageUrl: 'https://example.com',
              wcagLevel: 'AA',
              totalUrls: 2,
              completedCount: 2,
              failedCount: 0,
              progress: 100,
              scans: [],
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              cancelledAt: null,
            },
          }),
        });
      });

      // Mock batch results
      await page.route(
        '**/api/v1/batches/batch-urls-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-urls-123',
                status: 'COMPLETED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 2,
                completedCount: 2,
                failedCount: 0,
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                aggregate: {
                  totalIssues: 8,
                  criticalCount: 2,
                  seriousCount: 3,
                  moderateCount: 2,
                  minorCount: 1,
                  passedChecks: 80,
                  urlsScanned: 2,
                },
                urls: [
                  {
                    id: 'scan-1',
                    url: 'https://example.com/',
                    pageTitle: 'Home Page',
                    status: 'COMPLETED',
                    totalIssues: 5,
                    criticalCount: 2,
                    seriousCount: 2,
                    moderateCount: 1,
                    minorCount: 0,
                    errorMessage: null,
                  },
                  {
                    id: 'scan-2',
                    url: 'https://example.com/about',
                    pageTitle: 'About Page',
                    status: 'COMPLETED',
                    totalIssues: 3,
                    criticalCount: 0,
                    seriousCount: 1,
                    moderateCount: 1,
                    minorCount: 1,
                    errorMessage: null,
                  },
                ],
                topCriticalUrls: [],
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-urls-123');

      // Wait for results
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify individual URL results are displayed (Requirement 3.3)
      await expect(page.getByText('Home Page')).toBeVisible();
      await expect(page.getByText('About Page')).toBeVisible();

      // Verify URLs are displayed
      await expect(page.getByText(/https:\/\/example\.com\//)).toBeVisible();
      await expect(page.getByText(/https:\/\/example\.com\/about/)).toBeVisible();

      // Verify issue counts for each URL
      await expect(page.getByText(/5.*issues/i)).toBeVisible(); // Home page
      await expect(page.getByText(/3.*issues/i)).toBeVisible(); // About page
    });

    test('should handle failed scans in results', async ({ page }) => {
      // Mock batch with failures
      await page.route('**/api/v1/batches/batch-failed-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'batch-failed-123',
              status: 'FAILED',
              homepageUrl: 'https://example.com',
              wcagLevel: 'AA',
              totalUrls: 3,
              completedCount: 1,
              failedCount: 2,
              progress: 100,
              scans: [],
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              cancelledAt: null,
            },
          }),
        });
      });

      // Mock partial results
      await page.route(
        '**/api/v1/batches/batch-failed-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-failed-123',
                status: 'FAILED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 3,
                completedCount: 1,
                failedCount: 2,
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                aggregate: {
                  totalIssues: 5,
                  criticalCount: 1,
                  seriousCount: 2,
                  moderateCount: 1,
                  minorCount: 1,
                  passedChecks: 40,
                  urlsScanned: 1,
                },
                urls: [
                  {
                    id: 'scan-1',
                    url: 'https://example.com/',
                    pageTitle: 'Home',
                    status: 'COMPLETED',
                    totalIssues: 5,
                    criticalCount: 1,
                    seriousCount: 2,
                    moderateCount: 1,
                    minorCount: 1,
                    errorMessage: null,
                  },
                  {
                    id: 'scan-2',
                    url: 'https://example.com/about',
                    pageTitle: 'About',
                    status: 'FAILED',
                    totalIssues: 0,
                    criticalCount: 0,
                    seriousCount: 0,
                    moderateCount: 0,
                    minorCount: 0,
                    errorMessage: 'Page not accessible',
                  },
                  {
                    id: 'scan-3',
                    url: 'https://example.com/contact',
                    pageTitle: 'Contact',
                    status: 'FAILED',
                    totalIssues: 0,
                    criticalCount: 0,
                    seriousCount: 0,
                    moderateCount: 0,
                    minorCount: 0,
                    errorMessage: 'Timeout',
                  },
                ],
                topCriticalUrls: [],
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-failed-123');

      // Verify failed batch header
      await expect(page.getByText(/Batch Scan Failed/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify partial results message
      await expect(page.getByText(/Partial results/i)).toBeVisible();

      // Verify failure count is displayed
      await expect(page.getByText(/2.*failed/i)).toBeVisible();

      // Verify error messages for failed scans
      await expect(page.getByText(/Page not accessible/i)).toBeVisible();
      await expect(page.getByText(/Timeout/i)).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure on results page', async ({
      page,
    }) => {
      // Mock completed batch
      await page.route('**/api/v1/batches/batch-a11y-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'batch-a11y-123',
              status: 'COMPLETED',
              homepageUrl: 'https://example.com',
              wcagLevel: 'AA',
              totalUrls: 1,
              completedCount: 1,
              failedCount: 0,
              progress: 100,
              scans: [],
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              cancelledAt: null,
            },
          }),
        });
      });

      await page.route(
        '**/api/v1/batches/batch-a11y-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-a11y-123',
                status: 'COMPLETED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 1,
                completedCount: 1,
                failedCount: 0,
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                aggregate: {
                  totalIssues: 0,
                  criticalCount: 0,
                  seriousCount: 0,
                  moderateCount: 0,
                  minorCount: 0,
                  passedChecks: 50,
                  urlsScanned: 1,
                },
                urls: [],
                topCriticalUrls: [],
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-a11y-123');

      // Verify h1 heading exists
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible({ timeout: 5000 });

      // Verify h2 headings for sections
      const h2s = page.getByRole('heading', { level: 2 });
      await expect(h2s.first()).toBeVisible();
    });

    test('should have visible focus indicators during discovery', async ({
      page,
    }) => {
      // Setup discovery mock
      await page.route('**/api/v1/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              discovery: {
                id: 'test-discovery-focus',
                status: 'COMPLETED',
                pages: [
                  {
                    id: '1',
                    url: 'https://example.com/',
                    title: 'Home',
                    source: 'SITEMAP',
                    depth: 0,
                  },
                ],
              },
            },
          }),
        });
      });

      // Tab through form elements
      await page.keyboard.press('Tab');

      // Check that focused element is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Batch Cancellation', () => {
    test('should cancel batch scan with confirmation dialog', async ({
      page,
    }) => {
      let pollCount = 0;
      let cancelRequested = false;

      // Mock batch status endpoint - running batch
      await page.route(
        '**/api/v1/batches/batch-cancel-123',
        async (route) => {
          if (route.request().method() === 'GET') {
            pollCount++;

            // Return cancelled status after cancel request
            const status = cancelRequested ? 'CANCELLED' : 'RUNNING';

            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: {
                  id: 'batch-cancel-123',
                  status,
                  homepageUrl: 'https://example.com',
                  wcagLevel: 'AA',
                  totalUrls: 5,
                  completedCount: 2,
                  failedCount: 0,
                  progress: 40,
                  scans: [
                    {
                      scanId: 'scan-1',
                      url: 'https://example.com/',
                      pageTitle: 'Home',
                      status: 'COMPLETED',
                    },
                    {
                      scanId: 'scan-2',
                      url: 'https://example.com/about',
                      pageTitle: 'About',
                      status: 'COMPLETED',
                    },
                    {
                      scanId: 'scan-3',
                      url: 'https://example.com/contact',
                      pageTitle: 'Contact',
                      status: cancelRequested ? 'CANCELLED' : 'RUNNING',
                    },
                    {
                      scanId: 'scan-4',
                      url: 'https://example.com/products',
                      pageTitle: 'Products',
                      status: cancelRequested ? 'CANCELLED' : 'PENDING',
                    },
                    {
                      scanId: 'scan-5',
                      url: 'https://example.com/services',
                      pageTitle: 'Services',
                      status: cancelRequested ? 'CANCELLED' : 'PENDING',
                    },
                  ],
                  createdAt: new Date().toISOString(),
                  completedAt: null,
                  cancelledAt: cancelRequested
                    ? new Date().toISOString()
                    : null,
                },
              }),
            });
          } else if (route.request().method() === 'DELETE') {
            // Handle cancellation request
            cancelRequested = true;
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: {
                  id: 'batch-cancel-123',
                  status: 'CANCELLED',
                  completedCount: 2,
                  cancelledCount: 3,
                },
              }),
            });
          }
        }
      );

      // Navigate to batch page
      await page.goto('/batch/batch-cancel-123');

      // Verify batch is running
      await expect(page.getByText(/Batch Scan in Progress/i)).toBeVisible();
      await expect(page.getByText(/2.*5/)).toBeVisible(); // "2 of 5"

      // Click cancel button
      const cancelButton = page.getByRole('button', { name: /Cancel/i });
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      // Verify confirmation dialog appears (Requirement 7.1)
      await expect(
        page.getByText(/Are you sure.*cancel.*batch scan/i)
      ).toBeVisible();
      await expect(
        page.getByText(/Completed scans will be preserved/i)
      ).toBeVisible();

      // Confirm cancellation
      const confirmButton = page.getByRole('button', { name: /Confirm/i });
      await confirmButton.click();

      // Wait for cancelled status
      await expect(page.getByText(/Batch Scan Cancelled/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify cancellation summary (Requirement 7.1)
      await expect(page.getByText(/2.*completed/i)).toBeVisible(); // Completed count
      await expect(page.getByText(/3.*cancelled/i)).toBeVisible(); // Cancelled count

      // Verify cancel request was made
      expect(cancelRequested).toBe(true);
    });

    test('should preserve partial results after cancellation', async ({
      page,
    }) => {
      // Mock cancelled batch status
      await page.route(
        '**/api/v1/batches/batch-partial-123',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'batch-partial-123',
                status: 'CANCELLED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 4,
                completedCount: 2,
                failedCount: 0,
                progress: 50,
                scans: [],
                createdAt: new Date().toISOString(),
                completedAt: null,
                cancelledAt: new Date().toISOString(),
              },
            }),
          });
        }
      );

      // Mock partial results endpoint (Requirement 7.5)
      await page.route(
        '**/api/v1/batches/batch-partial-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-partial-123',
                status: 'CANCELLED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 4,
                completedCount: 2,
                failedCount: 0,
                createdAt: new Date().toISOString(),
                completedAt: null,
                aggregate: {
                  totalIssues: 8,
                  criticalCount: 2,
                  seriousCount: 3,
                  moderateCount: 2,
                  minorCount: 1,
                  passedChecks: 60,
                  urlsScanned: 2,
                },
                urls: [
                  {
                    id: 'scan-1',
                    url: 'https://example.com/',
                    pageTitle: 'Home',
                    status: 'COMPLETED',
                    totalIssues: 5,
                    criticalCount: 1,
                    seriousCount: 2,
                    moderateCount: 1,
                    minorCount: 1,
                    errorMessage: null,
                  },
                  {
                    id: 'scan-2',
                    url: 'https://example.com/about',
                    pageTitle: 'About',
                    status: 'COMPLETED',
                    totalIssues: 3,
                    criticalCount: 1,
                    seriousCount: 1,
                    moderateCount: 1,
                    minorCount: 0,
                    errorMessage: null,
                  },
                  {
                    id: 'scan-3',
                    url: 'https://example.com/contact',
                    pageTitle: 'Contact',
                    status: 'CANCELLED',
                    totalIssues: 0,
                    criticalCount: 0,
                    seriousCount: 0,
                    moderateCount: 0,
                    minorCount: 0,
                    errorMessage: null,
                  },
                  {
                    id: 'scan-4',
                    url: 'https://example.com/products',
                    pageTitle: 'Products',
                    status: 'CANCELLED',
                    totalIssues: 0,
                    criticalCount: 0,
                    seriousCount: 0,
                    moderateCount: 0,
                    minorCount: 0,
                    errorMessage: null,
                  },
                ],
                topCriticalUrls: [
                  {
                    url: 'https://example.com/',
                    pageTitle: 'Home',
                    criticalCount: 1,
                  },
                  {
                    url: 'https://example.com/about',
                    pageTitle: 'About',
                    criticalCount: 1,
                  },
                ],
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-partial-123');

      // Verify cancelled status
      await expect(page.getByText(/Batch Scan Cancelled/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify partial results message
      await expect(page.getByText(/Partial results available/i)).toBeVisible();

      // Verify aggregate statistics for completed scans (Requirement 7.5)
      await expect(page.getByText(/Results Summary/i)).toBeVisible();
      await expect(page.getByText(/8/)).toBeVisible(); // Total issues
      await expect(page.getByText(/2.*completed/i)).toBeVisible(); // 2 URLs scanned

      // Verify completed scan results are displayed
      await expect(page.getByText('Home')).toBeVisible();
      await expect(page.getByText('About')).toBeVisible();

      // Verify cancelled scans are indicated
      await expect(page.getByText('Contact')).toBeVisible();
      await expect(page.getByText('Products')).toBeVisible();
    });

    test('should allow dismissing cancel confirmation dialog', async ({
      page,
    }) => {
      // Mock running batch
      await page.route(
        '**/api/v1/batches/batch-no-cancel-123',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'batch-no-cancel-123',
                status: 'RUNNING',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 3,
                completedCount: 1,
                failedCount: 0,
                progress: 33,
                scans: [],
                createdAt: new Date().toISOString(),
                completedAt: null,
                cancelledAt: null,
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-no-cancel-123');

      // Click cancel button
      await page.getByRole('button', { name: /Cancel/i }).click();

      // Verify dialog appears
      await expect(
        page.getByText(/Are you sure.*cancel.*batch scan/i)
      ).toBeVisible();

      // Click dismiss/cancel button in dialog
      const dismissButton = page.getByRole('button', {
        name: /Cancel|Dismiss|Close/i,
      });
      await dismissButton.click();

      // Verify dialog is closed and batch continues
      await expect(
        page.getByText(/Are you sure.*cancel.*batch scan/i)
      ).not.toBeVisible();
      await expect(page.getByText(/Batch Scan in Progress/i)).toBeVisible();
    });
  });

  test.describe('Batch Export', () => {
    test('should export batch results as PDF', async ({ page }) => {
      // Mock completed batch
      await page.route('**/api/v1/batches/batch-export-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'batch-export-123',
              status: 'COMPLETED',
              homepageUrl: 'https://example.com',
              wcagLevel: 'AA',
              totalUrls: 2,
              completedCount: 2,
              failedCount: 0,
              progress: 100,
              scans: [],
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              cancelledAt: null,
            },
          }),
        });
      });

      await page.route(
        '**/api/v1/batches/batch-export-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-export-123',
                status: 'COMPLETED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 2,
                completedCount: 2,
                failedCount: 0,
                aggregate: {
                  totalIssues: 10,
                  criticalCount: 2,
                  seriousCount: 4,
                  moderateCount: 3,
                  minorCount: 1,
                  passedChecks: 100,
                  urlsScanned: 2,
                },
                urls: [],
                topCriticalUrls: [],
              },
            }),
          });
        }
      );

      // Mock PDF export endpoint (Requirement 4.1)
      await page.route(
        '**/api/v1/batches/batch-export-123/export?format=pdf',
        async (route) => {
          // Return PDF binary data
          const pdfContent = Buffer.from('Mock PDF content');
          await route.fulfill({
            status: 200,
            contentType: 'application/pdf',
            headers: {
              'Content-Disposition':
                'attachment; filename="batch-export-123.pdf"',
            },
            body: pdfContent,
          });
        }
      );

      await page.goto('/batch/batch-export-123');

      // Wait for results
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({
        timeout: 5000,
      });

      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export PDF button
      const exportButton = page.getByRole('button', { name: /Export.*PDF/i });
      await expect(exportButton).toBeVisible();
      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;

      // Verify download properties
      expect(download.suggestedFilename()).toMatch(/batch.*\.pdf$/i);

      // Verify download completes successfully
      const path = await download.path();
      expect(path).toBeTruthy();
    });

    test('should export batch results as JSON', async ({ page }) => {
      // Mock completed batch
      await page.route('**/api/v1/batches/batch-json-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'batch-json-123',
              status: 'COMPLETED',
              homepageUrl: 'https://example.com',
              wcagLevel: 'AA',
              totalUrls: 1,
              completedCount: 1,
              failedCount: 0,
              progress: 100,
              scans: [],
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              cancelledAt: null,
            },
          }),
        });
      });

      await page.route(
        '**/api/v1/batches/batch-json-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-json-123',
                status: 'COMPLETED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 1,
                completedCount: 1,
                failedCount: 0,
                aggregate: {
                  totalIssues: 5,
                  criticalCount: 1,
                  seriousCount: 2,
                  moderateCount: 1,
                  minorCount: 1,
                  passedChecks: 50,
                  urlsScanned: 1,
                },
                urls: [],
                topCriticalUrls: [],
              },
            }),
          });
        }
      );

      // Mock JSON export endpoint
      await page.route(
        '**/api/v1/batches/batch-json-123/export?format=json',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: {
              'Content-Disposition':
                'attachment; filename="batch-json-123.json"',
            },
            body: JSON.stringify({
              batchId: 'batch-json-123',
              status: 'COMPLETED',
              results: {
                totalIssues: 5,
                criticalCount: 1,
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-json-123');

      // Wait for results
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({
        timeout: 5000,
      });

      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export JSON button (or select from dropdown)
      const exportButton = page.getByRole('button', { name: /Export.*JSON/i });
      await expect(exportButton).toBeVisible();
      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;

      // Verify download properties
      expect(download.suggestedFilename()).toMatch(/batch.*\.json$/i);

      // Verify download completes successfully
      const path = await download.path();
      expect(path).toBeTruthy();
    });

    test('should show export options dropdown', async ({ page }) => {
      // Mock completed batch
      await page.route(
        '**/api/v1/batches/batch-options-123',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'batch-options-123',
                status: 'COMPLETED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 1,
                completedCount: 1,
                failedCount: 0,
                progress: 100,
                scans: [],
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                cancelledAt: null,
              },
            }),
          });
        }
      );

      await page.route(
        '**/api/v1/batches/batch-options-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-options-123',
                status: 'COMPLETED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 1,
                completedCount: 1,
                failedCount: 0,
                aggregate: {
                  totalIssues: 0,
                  criticalCount: 0,
                  seriousCount: 0,
                  moderateCount: 0,
                  minorCount: 0,
                  passedChecks: 50,
                  urlsScanned: 1,
                },
                urls: [],
                topCriticalUrls: [],
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-options-123');

      // Wait for results
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({
        timeout: 5000,
      });

      // Find export button/dropdown
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      await expect(exportButton).toBeVisible();
      await exportButton.click();

      // Verify export options are displayed
      await expect(page.getByText(/PDF/i)).toBeVisible();
      await expect(page.getByText(/JSON/i)).toBeVisible();
    });

    test('should disable export button for partial results', async ({
      page,
    }) => {
      // Mock cancelled batch with partial results
      await page.route(
        '**/api/v1/batches/batch-no-export-123',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'batch-no-export-123',
                status: 'CANCELLED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 3,
                completedCount: 1,
                failedCount: 0,
                progress: 33,
                scans: [],
                createdAt: new Date().toISOString(),
                completedAt: null,
                cancelledAt: new Date().toISOString(),
              },
            }),
          });
        }
      );

      await page.route(
        '**/api/v1/batches/batch-no-export-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-no-export-123',
                status: 'CANCELLED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 3,
                completedCount: 1,
                failedCount: 0,
                aggregate: {
                  totalIssues: 2,
                  criticalCount: 0,
                  seriousCount: 1,
                  moderateCount: 1,
                  minorCount: 0,
                  passedChecks: 20,
                  urlsScanned: 1,
                },
                urls: [],
                topCriticalUrls: [],
              },
            }),
          });
        }
      );

      await page.goto('/batch/batch-no-export-123');

      // Wait for cancelled status
      await expect(page.getByText(/Batch Scan Cancelled/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify export button is disabled or shows warning
      const exportButton = page.getByRole('button', { name: /Export/i }).first();
      if (await exportButton.isVisible()) {
        // Either disabled or shows a message
        const isDisabled = await exportButton.isDisabled();
        if (!isDisabled) {
          // Should show a message about incomplete results
          await expect(
            page.getByText(/Export only available.*complete/i)
          ).toBeVisible();
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle batch creation failure', async ({ page }) => {
      // Setup discovery
      await page.route('**/api/v1/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              discovery: {
                id: 'test-discovery-error',
                status: 'COMPLETED',
                pages: [
                  {
                    id: '1',
                    url: 'https://example.com/',
                    title: 'Home',
                    source: 'SITEMAP',
                    depth: 0,
                  },
                ],
              },
            },
          }),
        });
      });

      // Mock failed batch creation
      await page.route('**/api/v1/batches', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Rate limit exceeded. Please try again later.',
            }),
          });
        }
      });

      // Complete discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for results
      await expect(page.getByText(/Discovered Pages/i)).toBeVisible({
        timeout: 5000,
      });

      // Select pages and try to start scan
      await page.getByRole('button', { name: 'Select All' }).click();
      await page.getByRole('button', { name: /Start Scan/i }).click();

      // Verify error message is displayed
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/Rate limit exceeded/i)).toBeVisible();
    });

    test('should handle batch not found error', async ({ page }) => {
      // Mock 404 response
      await page.route('**/api/v1/batches/nonexistent-batch', async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Batch not found',
          }),
        });
      });

      await page.goto('/batch/nonexistent-batch');

      // Verify error state
      await expect(page.getByText(/Batch Scan Not Found/i)).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByRole('button', { name: /Start New Scan/i })).toBeVisible();
    });

    test('should handle export failure gracefully', async ({ page }) => {
      // Mock completed batch
      await page.route('**/api/v1/batches/batch-fail-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'batch-fail-123',
              status: 'COMPLETED',
              homepageUrl: 'https://example.com',
              wcagLevel: 'AA',
              totalUrls: 1,
              completedCount: 1,
              failedCount: 0,
              progress: 100,
              scans: [],
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              cancelledAt: null,
            },
          }),
        });
      });

      await page.route(
        '**/api/v1/batches/batch-fail-123/results',
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-fail-123',
                status: 'COMPLETED',
                homepageUrl: 'https://example.com',
                wcagLevel: 'AA',
                totalUrls: 1,
                completedCount: 1,
                failedCount: 0,
                aggregate: {
                  totalIssues: 0,
                  criticalCount: 0,
                  seriousCount: 0,
                  moderateCount: 0,
                  minorCount: 0,
                  passedChecks: 50,
                  urlsScanned: 1,
                },
                urls: [],
                topCriticalUrls: [],
              },
            }),
          });
        }
      );

      // Mock failed export endpoint
      await page.route(
        '**/api/v1/batches/batch-fail-123/export?format=pdf',
        async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Failed to generate PDF',
            }),
          });
        }
      );

      await page.goto('/batch/batch-fail-123');

      // Wait for results
      await expect(page.getByText(/Batch Scan Complete/i)).toBeVisible({
        timeout: 5000,
      });

      // Try to export
      const exportButton = page.getByRole('button', { name: /Export.*PDF/i });
      await exportButton.click();

      // Verify error message is displayed
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/Failed to.*export/i)).toBeVisible();
    });
  });
});
