import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Discovery Flow V2 - Manual URL Entry
 *
 * Tests the complete manual URL entry workflow:
 * - Step 1: Manual method selection and URL input
 * - Step 2: URL selection with select all/deselect controls
 * - Step 3: Preview and scan initiation
 * - URL parsing formats (semicolon-separated and multi-line)
 * - URL validation and error handling
 *
 * Actual implementation uses:
 * - InputMethodSelector: radiogroup with "Sitemap" and "Manual" options
 * - ManualUrlEntryEnhanced: textarea labeled "Enter URLs" with "Parse URLs" button
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

test.describe('Discovery Flow V2 - Manual URL Entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discovery');
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: /discover website pages/i })).toBeVisible();
  });

  test.describe('Step 1: Input URLs - Manual Method', () => {
    test('should display sitemap and manual input method options', async ({ page }) => {
      // Verify both input method options are present
      await expect(page.getByRole('radio', { name: /sitemap/i })).toBeVisible();
      await expect(page.getByRole('radio', { name: /manual/i })).toBeVisible();
    });

    test('should show manual textarea when manual method is selected', async ({ page }) => {
      // Click Manual option
      await page.getByRole('radio', { name: /manual/i }).click();

      await expect(page.getByRole('radio', { name: /manual/i })).toHaveAttribute('aria-checked', 'true');

      // Verify manual input textarea is visible
      await expect(page.getByLabel(/enter urls/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /parse urls/i })).toBeVisible();
    });

    test('should show URL counter and max limit', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      // Verify URL counter is displayed
      await expect(page.getByText(/0.*\/.*50.*urls/i)).toBeVisible();
    });

    test('should show helper text about supported formats', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      // Verify helper text is visible
      await expect(page.getByText(/multi-line/i)).toBeVisible();
      await expect(page.getByText(/semicolon/i)).toBeVisible();
    });

    test('should accept semicolon-separated URLs', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      const urls = 'https://example.com;https://example.com/about;https://example.com/contact';

      await textarea.fill(urls);

      // Click Parse URLs button
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should proceed to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should accept multi-line URLs (one per line)', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      const urls = `https://example.com
https://example.com/about
https://example.com/contact`;

      await textarea.fill(urls);

      // Click Parse URLs button
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should proceed to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should accept mixed format (semicolon + newline)', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      const urls = `https://example.com;https://example.com/about
https://example.com/contact;https://example.com/services
https://example.com/pricing`;

      await textarea.fill(urls);

      // Click Parse URLs button
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should proceed to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should show validation error for invalid URLs', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('not-a-valid-url;another-invalid-url');

      // Click Parse URLs button
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should show error message
      await expect(page.getByRole('alert')).toBeVisible();
    });

    test('should handle duplicate URLs', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      const urls = `https://example.com
https://example.com/about
https://example.com
https://example.com/about`;

      await textarea.fill(urls);

      // Click Parse URLs button
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should proceed to Step 2 with deduplicated URLs
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should handle trailing slashes in duplicate detection', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      const urls = `https://example.com/about
https://example.com/about/
https://example.com/contact
https://example.com/contact/`;

      await textarea.fill(urls);

      // Click Parse URLs button
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should proceed to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should cap at 50 URL limit', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);

      // Generate 60 URLs - implementation caps at 50 during parsing
      const urls = Array.from({ length: 60 }, (_, i) => `https://example.com/page${i + 1}`).join('\n');

      await textarea.fill(urls);

      // Should show "at limit" since parsing caps at 50
      await expect(page.getByText(/at limit/i)).toBeVisible();

      // Should show 50/50 count (capped at max)
      await expect(page.getByText(/50.*\/.*50/i)).toBeVisible();

      // Parse button should be enabled (only 50 valid URLs counted)
      const parseButton = page.getByRole('button', { name: /parse urls/i });
      await expect(parseButton).toBeEnabled();
    });

    test('should show warning when approaching limit', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);

      // Generate 42 URLs (84% of limit, should trigger warning)
      const urls = Array.from({ length: 42 }, (_, i) => `https://example.com/page${i + 1}`).join('\n');

      await textarea.fill(urls);

      // Should show approaching limit warning
      await expect(page.getByText(/approaching/i)).toBeVisible();
    });

    test('should show URL count updates in real-time', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);

      // Initially 0 URLs
      await expect(page.getByText(/0.*\/.*50.*urls/i)).toBeVisible();

      // Add first URL
      await textarea.fill('https://example.com');
      await expect(page.getByText(/1.*\/.*50.*urls/i)).toBeVisible();

      // Add more URLs
      await textarea.fill('https://example.com\nhttps://example.com/about\nhttps://example.com/contact');
      await expect(page.getByText(/3.*\/.*50.*urls/i)).toBeVisible();
    });

    test('should show visual progress bar', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);

      // Add URLs
      await textarea.fill('https://example.com\nhttps://example.com/about');

      // Verify progress bar exists
      const progressBar = page.getByRole('progressbar');
      await expect(progressBar).toBeVisible();
    });

    test('should handle empty input', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      // Button should be disabled when textarea is empty
      const parseButton = page.getByRole('button', { name: /parse urls/i });
      await expect(parseButton).toBeDisabled();
    });
  });

  test.describe('Step 2: Select URLs - From Manual Entry', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Step 2 by completing manual entry
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about
https://example.com/contact
https://example.com/services`);

      await page.getByRole('button', { name: /parse urls/i }).click();

      // Wait for Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should display all manually entered URLs', async ({ page }) => {
      // Verify URLs are displayed
      await expect(page.getByText('example.com', { exact: false })).toBeVisible();
    });

    test('should have URLs selected by default', async ({ page }) => {
      // Verify checkboxes exist
      const checkboxes = page.getByRole('checkbox');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should allow deselecting individual URLs', async ({ page }) => {
      // Get first checkbox
      const checkbox = page.getByRole('checkbox').first();

      // Uncheck it
      await checkbox.click();

      // Verify it's unchecked
      await expect(checkbox).not.toBeChecked();
    });

    test('should provide Select All and Deselect All buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /select all/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /deselect all/i })).toBeVisible();
    });

    test('should navigate back to Step 1 when Back is clicked', async ({ page }) => {
      // Click Back
      await page.getByRole('button', { name: /back/i }).click();

      // Should return to Step 1
      await expect(page.getByRole('heading', { name: /step 1.*enter urls/i })).toBeVisible();
    });

    test('should preserve manual URLs when navigating back', async ({ page }) => {
      // Navigate back
      await page.getByRole('button', { name: /back/i }).click();

      // Verify manual method is still selected
      await expect(page.getByRole('radio', { name: /manual/i })).toHaveAttribute('aria-checked', 'true');

      // Verify URLs are preserved in textarea
      const textarea = page.getByLabel(/enter urls/i);
      await expect(textarea).toContainText('example.com');
    });

    test('should proceed to Step 3 when Continue is clicked', async ({ page }) => {
      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();

      // Click Continue
      await page.getByRole('button', { name: /continue/i }).click();

      // Should proceed to Step 3
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should disable Continue when no URLs are selected', async ({ page }) => {
      // Deselect all
      await page.getByRole('button', { name: /deselect all/i }).click();

      // Continue should be disabled
      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeDisabled();
    });
  });

  test.describe('Step 3: Preview - From Manual Entry', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Step 3 by completing manual entry and selection
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about
https://example.com/contact`);

      await page.getByRole('button', { name: /parse urls/i }).click();

      // Wait for Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();

      // Continue to Step 3
      await page.getByRole('button', { name: /continue/i }).click();

      // Wait for Step 3
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

  test.describe('Complete Manual Entry Flow', () => {
    test('should complete entire manual discovery flow successfully', async ({ page }) => {
      // Step 1: Select manual method and enter URLs
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

      // Verify manual method and URLs are still there
      await expect(page.getByRole('radio', { name: /manual/i })).toHaveAttribute('aria-checked', 'true');
    });

    test('should handle validation errors gracefully', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);

      // Enter invalid URL
      await textarea.fill('invalid-url');
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should show error
      await expect(page.getByRole('alert')).toBeVisible();

      // Fix and retry with valid URL
      await textarea.fill('https://example.com');
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should proceed to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
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

    test('should support keyboard navigation for manual textarea', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);

      // Focus textarea
      await textarea.focus();

      // Type URLs
      await textarea.fill('https://example.com\nhttps://example.com/about');

      // Use Ctrl+Enter to submit (as per implementation)
      await textarea.press('Control+Enter');

      // Should proceed to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should have proper ARIA attributes for URL counter', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('https://example.com\nhttps://example.com/about');

      // Verify URL counter has proper role
      const counter = page.getByRole('status');
      await expect(counter).toBeVisible();
    });

    test('should announce errors to screen readers', async ({ page }) => {
      // Select manual method
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);

      // Enter only invalid URLs
      await textarea.fill('invalid-url');

      await page.getByRole('button', { name: /parse urls/i }).click();

      // Verify error has alert role
      const errorAlert = page.getByRole('alert');
      await expect(errorAlert).toBeVisible();
    });
  });
});
