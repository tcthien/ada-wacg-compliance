import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Full Scan Flow
 *
 * Tests the complete user journey for scanning a website:
 * 1. Submit URL from landing page
 * 2. View scan progress
 * 3. View results when complete
 * 4. Export results (PDF/JSON)
 *
 * Also tests error handling for invalid URLs
 */

test.describe('Scan Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the landing page
    await page.goto('/');
  });

  test('should display landing page with scan form', async ({ page }) => {
    // Check page title and heading
    await expect(page).toHaveTitle(/ADAShield/i);
    await expect(
      page.getByRole('heading', { name: /free website accessibility testing/i })
    ).toBeVisible();

    // Check scan form elements are present
    await expect(page.getByLabel(/website url/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /scan website/i })).toBeVisible();

    // Check WCAG level selector
    await expect(page.getByText(/wcag conformance level/i)).toBeVisible();
    await expect(page.getByRole('radio', { name: /level aa/i })).toBeChecked();
  });

  test('should show error for invalid URL', async ({ page }) => {
    // Enter invalid URL
    const urlInput = page.getByLabel(/website url/i);
    await urlInput.fill('not-a-valid-url');

    // Submit form
    await page.getByRole('button', { name: /scan website/i }).click();

    // Wait for error message
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/valid url/i);
  });

  test('should show error for non-HTTP protocol', async ({ page }) => {
    // Enter URL with invalid protocol
    const urlInput = page.getByLabel(/website url/i);
    await urlInput.fill('ftp://example.com');

    // Submit form
    await page.getByRole('button', { name: /scan website/i }).click();

    // Wait for error message
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/http/i);
  });

  test('should require email consent when email is provided', async ({ page }) => {
    // Fill in URL
    await page.getByLabel(/website url/i).fill('https://example.com');

    // Fill in email without consent
    await page.getByLabel(/email/i).fill('test@example.com');

    // Submit form
    await page.getByRole('button', { name: /scan website/i }).click();

    // Should show error about consent
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/consent/i);
  });

  test('should allow WCAG level selection', async ({ page }) => {
    // Check default is AA
    await expect(page.getByRole('radio', { name: /level aa/i })).toBeChecked();

    // Select Level A
    await page.getByRole('radio', { name: /level a$/i }).check();
    await expect(page.getByRole('radio', { name: /level a$/i })).toBeChecked();

    // Select Level AAA
    await page.getByRole('radio', { name: /level aaa/i }).check();
    await expect(page.getByRole('radio', { name: /level aaa/i })).toBeChecked();
  });

  test('should submit valid URL and navigate to scan page', async ({ page }) => {
    // Fill in valid URL
    const urlInput = page.getByLabel(/website url/i);
    await urlInput.fill('https://example.com');

    // Mock the API call to create a scan
    await page.route('**/api/scans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId: 'test-scan-id-123',
          status: 'queued',
          url: 'https://example.com',
          wcagLevel: 'AA',
        }),
      });
    });

    // Mock reCAPTCHA
    await page.addInitScript(() => {
      (window as any).grecaptcha = {
        ready: (callback: () => void) => callback(),
        execute: () => Promise.resolve('mock-recaptcha-token'),
      };
    });

    // Submit form
    await page.getByRole('button', { name: /scan website/i }).click();

    // Should navigate to scan results page
    await expect(page).toHaveURL(/\/scan\/test-scan-id-123/);
  });

  test('should show scan progress while scanning', async ({ page }) => {
    // Navigate to a mock scan in progress
    const scanId = 'mock-scan-in-progress';

    // Mock the scan status API
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'processing',
          progress: 50,
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Check for progress indicators
    await expect(page.getByText(/scanning in progress/i)).toBeVisible();
    await expect(page.getByText(/scan id:/i)).toBeVisible();
    await expect(page.getByText(scanId)).toBeVisible();

    // Check for auto-update message
    await expect(
      page.getByText(/automatically update when the scan is complete/i)
    ).toBeVisible();
  });

  test('should display scan results when complete', async ({ page }) => {
    const scanId = 'mock-scan-complete';

    // Mock completed scan status
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'completed',
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock scan results
    await page.route(`**/api/scans/${scanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          url: 'https://example.com',
          wcagLevel: 'AA',
          timestamp: new Date().toISOString(),
          summary: {
            totalIssues: 5,
            critical: 1,
            serious: 2,
            moderate: 1,
            minor: 1,
            passedTests: 45,
            wcagCompliance: {
              levelA: 90,
              levelAA: 85,
              levelAAA: 75,
            },
          },
          issues: [
            {
              id: 'issue-1',
              type: 'error',
              impact: 'critical',
              wcagLevel: 'A',
              wcagCriteria: '1.1.1',
              criteriaName: 'Non-text Content',
              description: 'Images must have alt text',
              element: '<img src="example.jpg">',
              fix: 'Add descriptive alt attribute to the image',
              helpUrl: 'https://example.com/help',
            },
          ],
        }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Check results page elements
    await expect(
      page.getByRole('heading', { name: /accessibility scan results/i })
    ).toBeVisible();
    await expect(page.getByText(/https:\/\/example\.com/)).toBeVisible();

    // Check summary section
    await expect(page.getByText(/summary/i)).toBeVisible();
    await expect(page.getByText(/5/)).toBeVisible(); // Total issues

    // Check issues list
    await expect(page.getByText(/issues found/i)).toBeVisible();
    await expect(page.getByText(/images must have alt text/i)).toBeVisible();
  });

  test('should show no issues message when scan is clean', async ({ page }) => {
    const scanId = 'mock-scan-clean';

    // Mock completed scan
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'completed',
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    // Mock empty results
    await page.route(`**/api/scans/${scanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          url: 'https://example.com',
          wcagLevel: 'AA',
          timestamp: new Date().toISOString(),
          summary: {
            totalIssues: 0,
            critical: 0,
            serious: 0,
            moderate: 0,
            minor: 0,
            passedTests: 50,
            wcagCompliance: { levelA: 100, levelAA: 100, levelAAA: 100 },
          },
          issues: [],
        }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Check for success message
    await expect(page.getByText(/no issues detected/i)).toBeVisible();
    await expect(page.getByText(/great job/i)).toBeVisible();
  });

  test('should handle failed scan gracefully', async ({ page }) => {
    const scanId = 'mock-scan-failed';

    // Mock failed scan
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'failed',
          error: 'Unable to access the URL. Please check if the website is accessible.',
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Check error display
    await expect(page.getByRole('heading', { name: /scan failed/i })).toBeVisible();
    await expect(
      page.getByText(/unable to access the url/i)
    ).toBeVisible();

    // Check action buttons
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reload/i })).toBeVisible();
  });

  test('should allow export of results', async ({ page }) => {
    const scanId = 'mock-scan-export';

    // Setup completed scan with results (same as previous test)
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'completed',
          url: 'https://example.com',
          wcagLevel: 'AA',
        }),
      });
    });

    await page.route(`**/api/scans/${scanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          url: 'https://example.com',
          summary: { totalIssues: 1 },
          issues: [],
        }),
      });
    });

    // Mock export endpoints
    const downloadPromise = page.waitForEvent('download');
    await page.route(`**/api/scans/${scanId}/export/json`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Content-Disposition': `attachment; filename="scan-${scanId}.json"`,
        },
        body: JSON.stringify({ scanId, results: {} }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Find and click export button
    const exportButton = page.getByRole('button', { name: /export/i }).first();
    await exportButton.click();

    // Click JSON export option
    await page.getByRole('menuitem', { name: /json/i }).click();

    // Verify download initiated
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should navigate to history from results page', async ({ page }) => {
    const scanId = 'mock-scan-nav';

    // Setup completed scan
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ scanId, status: 'completed' }),
      });
    });

    await page.route(`**/api/scans/${scanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          summary: { totalIssues: 0 },
          issues: [],
        }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Click "View History" button
    await page.getByRole('button', { name: /view history/i }).click();

    // Should navigate to history page
    await expect(page).toHaveURL(/\/history/);
  });
});
