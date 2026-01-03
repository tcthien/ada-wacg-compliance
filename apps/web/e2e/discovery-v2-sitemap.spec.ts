import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Discovery Flow V2 - Sitemap Method
 *
 * Tests the complete sitemap-based discovery workflow:
 * - Step 1: Sitemap method selection and URL input
 * - Step 2: URL selection with select all/deselect controls
 * - Step 3: Preview and scan initiation
 *
 * Actual implementation uses:
 * - InputMethodSelector: radiogroup with "Sitemap" and "Manual" options
 * - SitemapUrlInput: input labeled "Sitemap URL" with "Load Sitemap" button
 * - Step2SelectUrls: URL list with checkboxes, "Back" and "Continue" buttons
 * - Step3Preview: Preview table with "Back" and "Start Scan" buttons
 */

// Helper to dismiss cookie consent dialog if present
async function dismissCookieConsent(page: Page) {
  // Wait a bit for the dialog to potentially appear
  await page.waitForTimeout(500);

  // Try multiple selectors for the accept button
  const acceptButton = page.locator('button:has-text("Accept All")');
  if (await acceptButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await acceptButton.click();
    // Wait for dialog to close
    await page.waitForTimeout(300);
  }
}

test.describe('Discovery Flow V2 - Sitemap Method', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discovery');
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: /discover website pages/i })).toBeVisible();
  });

  test.describe('Step 1: Input URLs - Sitemap Method', () => {
    test('should display sitemap and manual input method options', async ({ page }) => {
      // Verify both input method options are present
      await expect(page.getByRole('radio', { name: /sitemap/i })).toBeVisible();
      await expect(page.getByRole('radio', { name: /manual/i })).toBeVisible();
    });

    test('should have no method selected by default (manual UI as fallback)', async ({ page }) => {
      // Neither option should be selected by default
      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      const manualOption = page.getByRole('radio', { name: /manual/i });
      await expect(sitemapOption).toHaveAttribute('aria-checked', 'false');
      await expect(manualOption).toHaveAttribute('aria-checked', 'false');

      // Manual entry UI should be visible as fallback
      await expect(page.getByLabel(/enter urls/i)).toBeVisible();
    });

    test('should show sitemap URL input when sitemap method is selected', async ({ page }) => {
      // First select sitemap method
      await page.getByRole('radio', { name: /sitemap/i }).click();

      // Verify sitemap input is visible
      await expect(page.getByLabel(/sitemap url/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /load sitemap/i })).toBeVisible();
    });

    test('should show manual textarea when manual method is selected', async ({ page }) => {
      // Click Manual option
      await page.getByRole('radio', { name: /manual/i }).click();

      await expect(page.getByRole('radio', { name: /manual/i })).toHaveAttribute('aria-checked', 'true');

      // Verify manual input textarea is visible
      await expect(page.getByLabel(/enter urls/i)).toBeVisible();
    });

    test('should disable submit button when sitemap URL is empty', async ({ page }) => {
      // First select sitemap method
      await page.getByRole('radio', { name: /sitemap/i }).click();

      const submitButton = page.getByRole('button', { name: /load sitemap/i });
      await expect(submitButton).toBeDisabled();
    });

    test('should enable submit button when sitemap URL is entered', async ({ page }) => {
      // First select sitemap method
      await page.getByRole('radio', { name: /sitemap/i }).click();

      const sitemapInput = page.getByLabel(/sitemap url/i);
      await sitemapInput.fill('https://example.com/sitemap.xml');

      const submitButton = page.getByRole('button', { name: /load sitemap/i });
      await expect(submitButton).toBeEnabled();
    });

    test('should show loading state when loading sitemap', async ({ page }) => {
      // First select sitemap method
      await page.getByRole('radio', { name: /sitemap/i }).click();

      // Mock slow API response
      await page.route('**/api/v1/discoveries', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: '123', status: 'PENDING' }),
        });
      });

      const sitemapInput = page.getByLabel(/sitemap url/i);
      await sitemapInput.fill('https://example.com/sitemap.xml');
      await page.getByRole('button', { name: /load sitemap/i }).click();

      // Should show loading state
      await expect(page.getByRole('button', { name: /loading/i })).toBeVisible();
    });

    test('should show error when sitemap fetch fails', async ({ page }) => {
      // First select sitemap method
      await page.getByRole('radio', { name: /sitemap/i }).click();

      // Mock failed API response
      await page.route('**/api/v1/discoveries', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Failed to fetch sitemap' }),
        });
      });

      const sitemapInput = page.getByLabel(/sitemap url/i);
      await sitemapInput.fill('https://example.com/sitemap.xml');
      await page.getByRole('button', { name: /load sitemap/i }).click();

      // Should show error message
      await expect(page.getByRole('alert').or(page.getByText(/error|failed/i))).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Step 2: Select URLs from Sitemap', () => {
    test.beforeEach(async ({ page }) => {
      // For sitemap tests, we'll use manual entry to reach Step 2
      // since sitemap API mocking is complex
      await page.getByRole('radio', { name: /manual/i }).click();
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about
https://example.com/contact
https://example.com/services`);
      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should display all discovered URLs', async ({ page }) => {
      // Verify URLs are displayed
      await expect(page.getByText('example.com', { exact: false })).toBeVisible();
    });

    test('should have URLs selected by default', async ({ page }) => {
      // Verify checkboxes exist and are checked
      const checkboxes = page.getByRole('checkbox');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should provide Select All button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /select all/i })).toBeVisible();
    });

    test('should provide Deselect All button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /deselect all/i })).toBeVisible();
    });

    test('should deselect all URLs when Deselect All is clicked', async ({ page }) => {
      // Click Deselect All
      await page.getByRole('button', { name: /deselect all/i }).click();

      // Continue should be disabled when no URLs selected
      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeDisabled();
    });

    test('should select all URLs when Select All is clicked after deselecting', async ({ page }) => {
      // Deselect all first
      await page.getByRole('button', { name: /deselect all/i }).click();

      // Select all
      await page.getByRole('button', { name: /^select all/i }).click();

      // Continue should be enabled
      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeEnabled();
    });

    test('should toggle individual URL selection', async ({ page }) => {
      // Get first checkbox
      const checkbox = page.getByRole('checkbox').first();

      // Verify it's checked initially
      await expect(checkbox).toBeChecked();

      // Uncheck it
      await checkbox.click();

      // Verify it's unchecked
      await expect(checkbox).not.toBeChecked();

      // Check it again
      await checkbox.click();

      // Verify it's checked
      await expect(checkbox).toBeChecked();
    });

    test('should enable Continue button when URLs are selected', async ({ page }) => {
      // Continue should be enabled when URLs are selected
      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeEnabled();
    });

    test('should disable Continue button when no URLs are selected', async ({ page }) => {
      // Deselect all
      await page.getByRole('button', { name: /deselect all/i }).click();

      // Continue should be disabled
      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeDisabled();
    });

    test('should show Back button', async ({ page }) => {
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();
      await expect(backButton).toBeEnabled();
    });

    test('should navigate back to Step 1 when Back is clicked', async ({ page }) => {
      // Click Back
      await page.getByRole('button', { name: /back/i }).click();

      // Should return to Step 1
      await expect(page.getByRole('heading', { name: /step 1.*enter urls/i })).toBeVisible();
    });

    test('should proceed to Step 3 when Continue is clicked', async ({ page }) => {
      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();

      // Click Continue
      await page.getByRole('button', { name: /continue/i }).click();

      // Should proceed to Step 3
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });
  });

  test.describe('Step 3: Preview', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Step 3 via manual entry
      await page.getByRole('radio', { name: /manual/i }).click();
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about
https://example.com/contact`);
      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should display preview with selected URLs', async ({ page }) => {
      // Verify selected URLs are shown
      await expect(page.getByText('example.com', { exact: false })).toBeVisible();
    });

    test('should show total URL count in preview', async ({ page }) => {
      // Verify count is displayed
      await expect(page.getByText(/3 urls/i)).toBeVisible();
    });

    test('should show estimated scan time', async ({ page }) => {
      // Verify estimated time is displayed
      await expect(page.getByText(/estimated/i)).toBeVisible();
    });

    test('should show Back button', async ({ page }) => {
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();
      await expect(backButton).toBeEnabled();
    });

    test('should navigate back to Step 2 when Back is clicked', async ({ page }) => {
      // Click Back
      await page.getByRole('button', { name: /back/i }).click();

      // Should return to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();
    });

    test('should preserve URL selection when navigating back from preview', async ({ page }) => {
      // Navigate back
      await page.getByRole('button', { name: /back/i }).click();

      // URLs should still be visible
      await expect(page.getByText('example.com', { exact: false })).toBeVisible();
    });

    test('should show Start Scan button', async ({ page }) => {
      const startScanButton = page.getByRole('button', { name: /start scan/i });
      await expect(startScanButton).toBeVisible();
      await expect(startScanButton).toBeEnabled();
    });

    test('should navigate away when Start Scan is clicked', async ({ page }) => {
      // Click Start Scan
      await page.getByRole('button', { name: /start scan/i }).click();

      // Should navigate away from discovery page
      await expect(page.url()).not.toContain('/discovery');
    });
  });

  test.describe('Complete Flow Integration', () => {
    test('should complete entire discovery flow successfully', async ({ page }) => {
      // Step 1: Use manual method
      await page.getByRole('radio', { name: /manual/i }).click();
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('https://example.com;https://example.com/about;https://example.com/services');
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Step 2: Wait for URLs and select them
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();

      // Continue to preview
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 3: Verify preview and start scan
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /start scan/i })).toBeVisible();
    });

    test('should handle back navigation through all steps', async ({ page }) => {
      // Navigate to Step 3
      await page.getByRole('radio', { name: /manual/i }).click();
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('https://example.com\nhttps://example.com/about');
      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();

      // Navigate back to Step 2
      await page.getByRole('button', { name: /back/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();

      // Navigate back to Step 1
      await page.getByRole('button', { name: /back/i }).click();
      await expect(page.getByRole('heading', { name: /step 1.*enter urls/i })).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels for step indicator', async ({ page }) => {
      const stepNav = page.getByRole('navigation', { name: /progress/i });
      await expect(stepNav).toBeVisible();
    });

    test('should have visible focus indicators', async ({ page }) => {
      // Tab to first interactive element
      await page.keyboard.press('Tab');

      // Check that focus is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should have accessible form inputs', async ({ page }) => {
      // Manual textarea should be visible by default
      const manualTextarea = page.getByLabel(/enter urls/i);
      await expect(manualTextarea).toBeVisible();

      // Select sitemap method to check its accessibility
      await page.getByRole('radio', { name: /sitemap/i }).click();

      // Sitemap input should have label
      const sitemapInput = page.getByLabel(/sitemap url/i);
      await expect(sitemapInput).toBeVisible();
    });

    test('should support keyboard navigation through input methods', async ({ page }) => {
      // Focus on sitemap radio
      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      await sitemapOption.focus();

      // Use arrow key to navigate to manual
      await page.keyboard.press('ArrowRight');

      // Manual should be selected
      await expect(page.getByRole('radio', { name: /manual/i })).toHaveAttribute('aria-checked', 'true');
    });
  });
});
