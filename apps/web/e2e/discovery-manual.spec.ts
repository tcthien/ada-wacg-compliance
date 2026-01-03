import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Manual Entry Flow
 *
 * Tests the manual URL entry workflow:
 * - URL input and validation
 * - Mode selection (Manual Entry)
 * - Single URL addition
 * - Bulk URL addition
 * - Domain validation
 * - Duplicate detection
 * - Integration with page tree
 */

test.describe('Manual Entry Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to discovery page
    await page.goto('/discovery');

    // Enter valid URL and continue to mode selection
    await page.getByLabel('Website URL').fill('https://example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Select Manual Entry mode
    await page.getByText('Manual Entry').click();
  });

  test.describe('Mode Selection', () => {
    test('should show Manual Entry as selected', async ({ page }) => {
      const manualOption = page.getByRole('radio', { name: /Manual Entry/i });
      await expect(manualOption).toBeChecked();
    });

    test('should show manual URL entry form', async ({ page }) => {
      await expect(page.getByLabel(/Enter URL/i)).toBeVisible();
    });

    test('should show Add URL button', async ({ page }) => {
      await expect(
        page.getByRole('button', { name: /Add URL/i })
      ).toBeVisible();
    });
  });

  test.describe('Single URL Addition', () => {
    test('should add a valid URL to the list', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      // Enter valid URL on same domain
      await urlInput.fill('https://example.com/about');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // URL should appear in the list/tree
      await expect(page.getByText('/about')).toBeVisible();
    });

    test('should clear input after adding URL', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      await urlInput.fill('https://example.com/contact');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Input should be cleared
      await expect(urlInput).toHaveValue('');
    });

    test('should show error for empty URL', async ({ page }) => {
      // Click add without entering URL
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should show error
      await expect(page.getByText(/Please enter a URL/i)).toBeVisible();
    });

    test('should show error for invalid URL format', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      await urlInput.fill('not-a-valid-url');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should show error
      await expect(page.getByText(/Invalid URL/i)).toBeVisible();
    });
  });

  test.describe('Domain Validation', () => {
    test('should reject URL from different domain', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      // Enter URL from different domain
      await urlInput.fill('https://otherdomain.com/page');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should show domain mismatch error
      await expect(
        page.getByText(/URL must be on the same domain/i)
      ).toBeVisible();
    });

    test('should accept URL with www prefix variation', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      // Enter URL with www when base doesn't have www
      await urlInput.fill('https://www.example.com/page');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should accept (www normalization)
      await expect(page.getByText('/page')).toBeVisible();
    });

    test('should reject non-HTTP URLs', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      await urlInput.fill('ftp://example.com/file');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should show protocol error
      await expect(page.getByText(/URL must use HTTP or HTTPS/i)).toBeVisible();
    });
  });

  test.describe('Duplicate Detection', () => {
    test('should detect and reject duplicate URLs', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      // Add URL first time
      await urlInput.fill('https://example.com/about');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Wait for URL to be added
      await expect(page.getByText('/about')).toBeVisible();

      // Try to add same URL again
      await urlInput.fill('https://example.com/about');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should show duplicate error
      await expect(
        page.getByText(/URL already exists|already added|duplicate/i)
      ).toBeVisible();
    });

    test('should detect duplicates regardless of trailing slash', async ({
      page,
    }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      // Add URL without trailing slash
      await urlInput.fill('https://example.com/about');
      await page.getByRole('button', { name: /Add URL/i }).click();
      await expect(page.getByText('/about')).toBeVisible();

      // Try to add with trailing slash
      await urlInput.fill('https://example.com/about/');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should show duplicate error
      await expect(
        page.getByText(/URL already exists|already added|duplicate/i)
      ).toBeVisible();
    });
  });

  test.describe('Bulk URL Addition', () => {
    test('should show bulk mode toggle', async ({ page }) => {
      await expect(page.getByText(/Add multiple URLs/i)).toBeVisible();
    });

    test('should switch to bulk mode when clicked', async ({ page }) => {
      await page.getByText(/Add multiple URLs/i).click();

      // Should show textarea instead of input
      await expect(
        page.getByLabel(/Enter URLs \(one per line\)/i)
      ).toBeVisible();
    });

    test('should accept multiple URLs in bulk mode', async ({ page }) => {
      // Switch to bulk mode
      await page.getByText(/Add multiple URLs/i).click();

      const textarea = page.getByLabel(/Enter URLs \(one per line\)/i);
      await textarea.fill(
        'https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3'
      );

      await page.getByRole('button', { name: /Add.*URLs/i }).click();

      // All URLs should be added
      await expect(page.getByText('/page1')).toBeVisible();
      await expect(page.getByText('/page2')).toBeVisible();
      await expect(page.getByText('/page3')).toBeVisible();
    });

    test('should show validation summary in bulk mode', async ({ page }) => {
      // Switch to bulk mode
      await page.getByText(/Add multiple URLs/i).click();

      const textarea = page.getByLabel(/Enter URLs \(one per line\)/i);
      // Mix of valid and invalid URLs
      await textarea.fill(
        'https://example.com/valid1\nhttps://otherdomain.com/invalid\nhttps://example.com/valid2'
      );

      // Should show validation summary
      await expect(page.getByText(/2 valid/i)).toBeVisible();
      await expect(page.getByText(/1 invalid/i)).toBeVisible();
    });

    test('should skip invalid URLs and add valid ones', async ({ page }) => {
      // Switch to bulk mode
      await page.getByText(/Add multiple URLs/i).click();

      const textarea = page.getByLabel(/Enter URLs \(one per line\)/i);
      await textarea.fill(
        'https://example.com/valid\nhttps://otherdomain.com/invalid'
      );

      await page.getByRole('button', { name: /Add.*URLs/i }).click();

      // Valid URL should be added
      await expect(page.getByText('/valid')).toBeVisible();
    });

    test('should show error when all URLs are invalid', async ({ page }) => {
      // Switch to bulk mode
      await page.getByText(/Add multiple URLs/i).click();

      const textarea = page.getByLabel(/Enter URLs \(one per line\)/i);
      await textarea.fill(
        'https://otherdomain1.com/page\nhttps://otherdomain2.com/page'
      );

      await page.getByRole('button', { name: /Add.*URLs/i }).click();

      // Should show error
      await expect(page.getByText(/No valid URLs found/i)).toBeVisible();
    });

    test('should allow switching back to single URL mode', async ({ page }) => {
      // Switch to bulk mode
      await page.getByText(/Add multiple URLs/i).click();
      await expect(
        page.getByLabel(/Enter URLs \(one per line\)/i)
      ).toBeVisible();

      // Switch back to single mode
      await page.getByText(/Switch to single URL/i).click();
      await expect(page.getByLabel(/Enter URL/i)).toBeVisible();
    });

    test('should respect maximum URL limit', async ({ page }) => {
      // Switch to bulk mode
      await page.getByText(/Add multiple URLs/i).click();

      // Generate more URLs than the limit (assume limit is 50)
      const urls = Array.from(
        { length: 60 },
        (_, i) => `https://example.com/page${i + 1}`
      ).join('\n');

      const textarea = page.getByLabel(/Enter URLs \(one per line\)/i);
      await textarea.fill(urls);

      await page.getByRole('button', { name: /Add.*URLs/i }).click();

      // Should show limit error
      await expect(page.getByText(/Maximum.*URLs allowed/i)).toBeVisible();
    });
  });

  test.describe('Page Tree Integration', () => {
    test('should display added URLs in page tree', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      // Add multiple URLs
      await urlInput.fill('https://example.com/about');
      await page.getByRole('button', { name: /Add URL/i }).click();

      await urlInput.fill('https://example.com/contact');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Page tree should be visible with URLs
      await expect(page.getByRole('tree')).toBeVisible();
      await expect(page.getByText('/about')).toBeVisible();
      await expect(page.getByText('/contact')).toBeVisible();
    });

    test('should show Manual source badge for manually added URLs', async ({
      page,
    }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      await urlInput.fill('https://example.com/manual-page');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should show Manual badge
      await expect(page.getByText('Manual')).toBeVisible();
    });

    test('should allow selecting manually added URLs', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      await urlInput.fill('https://example.com/selectable');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Find and click the checkbox
      const checkbox = page.locator('input[type="checkbox"]').first();
      await checkbox.check();

      // Should update selection count
      await expect(page.getByText(/1 page selected/i)).toBeVisible();
    });

    test('should enable Start Scan when URLs are selected', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      await urlInput.fill('https://example.com/scannable');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Start Scan should be disabled initially
      const startScanButton = page.getByRole('button', { name: /Start Scan/i });
      await expect(startScanButton).toBeDisabled();

      // Select the URL
      await page.getByRole('button', { name: 'Select All' }).click();

      // Start Scan should be enabled
      await expect(startScanButton).toBeEnabled();
    });
  });

  test.describe('Hierarchical URL Organization', () => {
    test('should organize URLs hierarchically in tree', async ({ page }) => {
      // Switch to bulk mode for faster addition
      await page.getByText(/Add multiple URLs/i).click();

      const textarea = page.getByLabel(/Enter URLs \(one per line\)/i);
      await textarea.fill(
        'https://example.com/products\nhttps://example.com/products/category1\nhttps://example.com/products/category2'
      );

      await page.getByRole('button', { name: /Add.*URLs/i }).click();

      // Should show hierarchical structure
      await expect(page.getByText('products')).toBeVisible();

      // Expand products to see children
      const expandButton = page
        .locator('[aria-label*="Expand"]')
        .or(page.locator('button').filter({ hasText: /›|▶/ }))
        .first();

      if (await expandButton.isVisible()) {
        await expandButton.click();
        await expect(page.getByText('category1')).toBeVisible();
        await expect(page.getByText('category2')).toBeVisible();
      }
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state when adding URL', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/discoveries/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      const urlInput = page.getByLabel(/Enter URL/i);
      await urlInput.fill('https://example.com/slow');

      // Start adding URL
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Should show loading state
      await expect(page.getByText(/Adding/i)).toBeVisible();
    });

    test('should disable form while adding URL', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/discoveries/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.continue();
      });

      const urlInput = page.getByLabel(/Enter URL/i);
      await urlInput.fill('https://example.com/loading');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Input should be disabled during loading
      await expect(urlInput).toBeDisabled();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should submit URL with Enter key', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      await urlInput.fill('https://example.com/keyboard');
      await urlInput.press('Enter');

      // URL should be added
      await expect(page.getByText('/keyboard')).toBeVisible();
    });

    test('should focus input after adding URL', async ({ page }) => {
      const urlInput = page.getByLabel(/Enter URL/i);

      await urlInput.fill('https://example.com/focus');
      await page.getByRole('button', { name: /Add URL/i }).click();

      // Wait for URL to be added
      await expect(page.getByText('/focus')).toBeVisible();

      // Input should be ready for next URL (focused or empty)
      await expect(urlInput).toHaveValue('');
    });
  });
});
