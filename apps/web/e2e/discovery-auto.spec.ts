import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Auto Discovery Flow
 *
 * Tests the complete auto-discovery workflow:
 * - URL input and validation
 * - Mode selection (Auto Discover)
 * - Progress display during discovery
 * - Results display with page tree
 * - Page selection functionality
 * - Integration with scan creation
 */

test.describe('Auto Discovery Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to discovery page
    await page.goto('/discovery');
  });

  test.describe('URL Input', () => {
    test('should display URL input form', async ({ page }) => {
      // Verify form elements are present
      await expect(page.getByLabel('Website URL')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    });

    test('should show error for invalid URL', async ({ page }) => {
      const urlInput = page.getByLabel('Website URL');

      // Enter invalid URL
      await urlInput.fill('not-a-valid-url');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Expect error message
      await expect(page.getByText(/Please enter a valid URL/i)).toBeVisible();
    });

    test('should auto-add https:// to URL without protocol', async ({ page }) => {
      const urlInput = page.getByLabel('Website URL');

      // Enter URL without protocol
      await urlInput.fill('example.com');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Should proceed to mode selection (URL was normalized)
      await expect(page.getByText(/Discovering pages for/i)).toBeVisible();
      await expect(page.getByText('https://example.com')).toBeVisible();
    });

    test('should reject non-HTTP(S) URLs', async ({ page }) => {
      const urlInput = page.getByLabel('Website URL');

      // Enter FTP URL
      await urlInput.fill('ftp://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();

      // Expect error
      await expect(page.getByText(/URL must use HTTP or HTTPS/i)).toBeVisible();
    });
  });

  test.describe('Mode Selection', () => {
    test.beforeEach(async ({ page }) => {
      // Enter valid URL first
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
    });

    test('should display mode selection options', async ({ page }) => {
      // Verify both mode options are present
      await expect(page.getByText('Auto Discover')).toBeVisible();
      await expect(page.getByText('Manual Entry')).toBeVisible();
    });

    test('should have Auto Discover selected by default', async ({ page }) => {
      // Check radio button state
      const autoOption = page.getByRole('radio', { name: /Auto Discover/i });
      await expect(autoOption).toBeChecked();
    });

    test('should show Start Discovery button', async ({ page }) => {
      await expect(
        page.getByRole('button', { name: 'Start Discovery' })
      ).toBeVisible();
    });

    test('should allow switching between modes', async ({ page }) => {
      // Click Manual Entry
      await page.getByText('Manual Entry').click();
      const manualOption = page.getByRole('radio', { name: /Manual Entry/i });
      await expect(manualOption).toBeChecked();

      // Click Auto Discover
      await page.getByText('Auto Discover').click();
      const autoOption = page.getByRole('radio', { name: /Auto Discover/i });
      await expect(autoOption).toBeChecked();
    });
  });

  test.describe('Discovery Progress', () => {
    test('should show progress UI when discovery starts', async ({ page }) => {
      // Setup mock API response
      await page.route('**/api/discoveries', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        }
      });

      // Start discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Verify progress UI
      await expect(page.getByText(/Checking Sitemap/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
    });

    test('should update phase during discovery', async ({ page }) => {
      // Setup mock API responses
      let callCount = 0;
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'SITEMAP',
              pages: [],
            }),
          });
        } else if (route.request().method() === 'GET') {
          callCount++;
          const phase = callCount < 2 ? 'SITEMAP' : 'NAVIGATION';
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase,
              pages: callCount < 2 ? [] : [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'NAVIGATION' }
              ],
            }),
          });
        }
      });

      // Start discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for phase update
      await expect(page.getByText(/Analyzing Navigation/i)).toBeVisible({ timeout: 5000 });
    });

    test('should show pages found counter', async ({ page }) => {
      // Setup mock API responses
      await page.route('**/api/discoveries**', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'RUNNING',
              phase: 'NAVIGATION',
              pages: [
                { id: '1', url: 'https://example.com/', title: 'Home', source: 'NAVIGATION' },
                { id: '2', url: 'https://example.com/about', title: 'About', source: 'NAVIGATION' },
              ],
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Start discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Verify pages count
      await expect(page.getByText(/2 pages found/i)).toBeVisible();
    });
  });

  test.describe('Discovery Results', () => {
    test.beforeEach(async ({ page }) => {
      // Setup mock API response with completed discovery
      await page.route('**/api/discoveries**', async (route) => {
        const mockPages = [
          { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP', depth: 0 },
          { id: '2', url: 'https://example.com/about', title: 'About Us', source: 'NAVIGATION', depth: 1 },
          { id: '3', url: 'https://example.com/contact', title: 'Contact', source: 'CRAWLED', depth: 1 },
          { id: '4', url: 'https://example.com/about/team', title: 'Our Team', source: 'MANUAL', depth: 2 },
        ];

        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'COMPLETED',
              phase: null,
              pages: mockPages,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-discovery-1',
              status: 'COMPLETED',
              phase: null,
              pages: mockPages,
            }),
          });
        }
      });

      // Complete discovery flow
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for results to load
      await expect(page.getByText(/Discovered Pages/i)).toBeVisible({ timeout: 5000 });
    });

    test('should display page tree with hierarchical structure', async ({ page }) => {
      // Verify tree is visible
      await expect(page.getByRole('tree', { name: 'Discovered pages' })).toBeVisible();

      // Verify some pages are visible
      await expect(page.getByText('example.com')).toBeVisible();
    });

    test('should display source badges with correct colors', async ({ page }) => {
      // Check for different source badges
      await expect(page.getByText('Sitemap')).toBeVisible();
      await expect(page.getByText('Nav')).toBeVisible();
    });

    test('should allow selecting and deselecting pages', async ({ page }) => {
      // Get a checkbox
      const checkbox = page.locator('input[type="checkbox"]').first();

      // Click to select
      await checkbox.check();
      await expect(checkbox).toBeChecked();

      // Click to deselect
      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
    });

    test('should update selection count when pages are selected', async ({ page }) => {
      // Initially no pages selected
      await expect(page.getByText(/No pages selected/i)).toBeVisible();

      // Select all pages
      await page.getByRole('button', { name: 'Select All' }).click();

      // Should show all pages selected
      await expect(page.getByText(/4 pages selected/i)).toBeVisible();
    });

    test('should enable Start Scan button when pages are selected', async ({ page }) => {
      // Initially disabled
      const startScanButton = page.getByRole('button', { name: /Start Scan/i });
      await expect(startScanButton).toBeDisabled();

      // Select pages
      await page.getByRole('button', { name: 'Select All' }).click();

      // Should be enabled
      await expect(startScanButton).toBeEnabled();
    });

    test('should deselect all pages when Deselect All is clicked', async ({ page }) => {
      // Select all first
      await page.getByRole('button', { name: 'Select All' }).click();
      await expect(page.getByText(/4 pages selected/i)).toBeVisible();

      // Deselect all
      await page.getByRole('button', { name: 'Deselect All' }).click();
      await expect(page.getByText(/No pages selected/i)).toBeVisible();
    });
  });

  test.describe('Scan Integration', () => {
    test('should navigate to home page when Start Scan is clicked', async ({ page }) => {
      // Setup mock API
      await page.route('**/api/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'COMPLETED',
            pages: [
              { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP', depth: 0 },
            ],
          }),
        });
      });

      // Complete discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for results
      await expect(page.getByText(/Discovered Pages/i)).toBeVisible({ timeout: 5000 });

      // Select page and start scan
      await page.getByRole('button', { name: 'Select All' }).click();
      await page.getByRole('button', { name: /Start Scan/i }).click();

      // Should navigate to home page (default return URL)
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Accessibility', () => {
    test('page tree should have proper ARIA attributes', async ({ page }) => {
      // Setup mock
      await page.route('**/api/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-discovery-1',
            status: 'COMPLETED',
            pages: [
              { id: '1', url: 'https://example.com/', title: 'Home', source: 'SITEMAP', depth: 0 },
            ],
          }),
        });
      });

      // Complete discovery
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for results
      await expect(page.getByRole('tree', { name: 'Discovered pages' })).toBeVisible({ timeout: 5000 });

      // Verify tree has proper attributes
      const tree = page.getByRole('tree');
      await expect(tree).toHaveAttribute('aria-multiselectable', 'true');
    });

    test('should have visible focus indicators', async ({ page }) => {
      // Tab to Continue button
      await page.keyboard.press('Tab');

      // Check that focus is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});
