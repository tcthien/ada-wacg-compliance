import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Discovery V2 - Step 3 Preview Table
 *
 * Tests the preview table functionality in Step 3 of Discovery Flow V2:
 * - FR-3.1: Display final URL selection in table format
 * - FR-3.2: Show estimated scan duration
 * - FR-3.3: Provide confirmation before proceeding
 * - FR-3.4: Allow navigation back to previous steps
 *
 * Actual implementation uses:
 * - Step3Preview: Container component for Step 3
 * - PreviewTable: Table with #, URL, Title columns
 * - EstimatedTime: Shows estimated scan duration
 * - "Back" button to return to Step 2
 * - "Start Scan" button to begin scanning
 *
 * Related User Story: US-4 - Preview Step
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

test.describe('Discovery V2 - Step 3 Preview Table', () => {
  test.describe('Preview Table Display (FR-3.1)', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Step 3 via manual entry
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about
https://example.com/contact
https://example.com/products
https://example.com/services`);

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should display preview table with selected URLs', async ({ page }) => {
      // Verify table is displayed
      await expect(page.getByRole('table')).toBeVisible();

      // Verify table headers
      await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'URL' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    });

    test('should display all 5 selected URLs in table', async ({ page }) => {
      // Verify all URLs are displayed
      await expect(page.getByText('https://example.com', { exact: false })).toBeVisible();
      await expect(page.getByText('https://example.com/about', { exact: false })).toBeVisible();
      await expect(page.getByText('https://example.com/contact', { exact: false })).toBeVisible();
      await expect(page.getByText('https://example.com/products', { exact: false })).toBeVisible();
      await expect(page.getByText('https://example.com/services', { exact: false })).toBeVisible();

      // Verify row count (5 URLs)
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(5);
    });

    test('should show row numbers in table', async ({ page }) => {
      // Verify row numbers are displayed
      const firstCell = page.locator('tbody tr').first().locator('td').first();
      await expect(firstCell).toContainText('1');
    });

    test('should show URL count in summary', async ({ page }) => {
      // Verify count is displayed
      await expect(page.getByText(/5 urls/i)).toBeVisible();
    });
  });

  test.describe('URL Selection Verification', () => {
    test('should only show URLs that were selected in Step 2', async ({ page }) => {
      // Navigate to Step 2
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about
https://example.com/contact`);

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, select all first
      await page.getByRole('button', { name: /^select all/i }).click();

      // Deselect one URL (uncheck first checkbox)
      const checkboxes = page.getByRole('checkbox');
      const count = await checkboxes.count();
      if (count > 0) {
        await checkboxes.first().click();
      }

      // Continue to Step 3
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();

      // Verify only 2 URLs are shown (one was deselected)
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(2);
      await expect(page.getByText(/2 urls/i)).toBeVisible();
    });

    test('should display URLs with preserved order', async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://first.com
https://second.com
https://third.com`);

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();

      // Verify URLs are in order
      const rows = page.locator('tbody tr');
      await expect(rows.nth(0)).toContainText('first.com');
      await expect(rows.nth(1)).toContainText('second.com');
      await expect(rows.nth(2)).toContainText('third.com');
    });
  });

  test.describe('Estimated Time Display (FR-3.2)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
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

    test('should display estimated scan time', async ({ page }) => {
      // Verify estimated time is shown
      await expect(page.getByText(/estimated/i)).toBeVisible();
    });

    test('should show ready to scan message with URL count', async ({ page }) => {
      // Verify ready message
      await expect(page.getByText(/ready to scan 3 url/i)).toBeVisible();
    });
  });

  test.describe('Navigation Controls (FR-3.4)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about`);

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should display Back button', async ({ page }) => {
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();
      await expect(backButton).toBeEnabled();
    });

    test('should display Start Scan button', async ({ page }) => {
      const startScanButton = page.getByRole('button', { name: /start scan/i });
      await expect(startScanButton).toBeVisible();
      await expect(startScanButton).toBeEnabled();
    });

    test('should navigate back to Step 2 when Back is clicked', async ({ page }) => {
      await page.getByRole('button', { name: /back/i }).click();

      // Should return to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();

      // URLs should still be visible
      await expect(page.getByText('example.com', { exact: false })).toBeVisible();
    });

    test('should preserve URL selection after navigating back', async ({ page }) => {
      // Go back to Step 2
      await page.getByRole('button', { name: /back/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();

      // Continue again to Step 3
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();

      // Should still have 2 URLs
      await expect(page.getByText(/2 urls/i)).toBeVisible();
    });
  });

  test.describe('Start Scan Action (FR-3.3)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about`);

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should navigate away when Start Scan is clicked', async ({ page }) => {
      await page.getByRole('button', { name: /start scan/i }).click();

      // Should navigate away from discovery page
      await page.waitForURL((url) => !url.pathname.includes('/discovery'), { timeout: 10000 });
      expect(page.url()).not.toContain('/discovery');
    });

    test('should show loading state when starting scan', async ({ page }) => {
      // Click Start Scan
      await page.getByRole('button', { name: /start scan/i }).click();

      // Should show loading state or navigate
      // Either button shows loading or page navigates
      const buttonOrNavigation = await Promise.race([
        page.getByText(/starting|loading|submitting/i).isVisible().catch(() => false),
        page.waitForURL((url) => !url.pathname.includes('/discovery'), { timeout: 5000 }).then(() => true).catch(() => false),
      ]);

      expect(buttonOrNavigation).toBeTruthy();
    });
  });

  test.describe('Empty State', () => {
    test('should handle case when all URLs are deselected in Step 2', async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about`);

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // Deselect all URLs
      await page.getByRole('button', { name: /deselect all/i }).click();

      // Continue button should be disabled
      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeDisabled();
    });
  });

  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
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

    test('should have accessible table structure', async ({ page }) => {
      // Table should have proper role
      await expect(page.getByRole('table')).toBeVisible();

      // Table should have headers
      const headers = page.getByRole('columnheader');
      await expect(headers).toHaveCount(3);
    });

    test('should have accessible Back button with aria-label', async ({ page }) => {
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();
    });

    test('should have accessible Start Scan button with aria-label', async ({ page }) => {
      const startScanButton = page.getByRole('button', { name: /start scan/i });
      await expect(startScanButton).toBeVisible();
    });

    test('should have review heading for screen readers', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Tab through interactive elements
      await page.keyboard.press('Tab');

      // Should be able to focus on Back or Start Scan button
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Single URL Handling', () => {
    test('should handle single URL correctly', async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('https://example.com');

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();

      // Should show singular "URL" not "URLs"
      await expect(page.getByText(/1 url/i)).toBeVisible();

      // Table should have 1 row
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(1);
    });
  });

  test.describe('Large URL Count', () => {
    test('should handle many URLs in preview', async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      // Create 10 URLs
      const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/page${i + 1}`).join('\n');

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(urls);

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();

      // Should show correct count
      await expect(page.getByText(/10 urls/i)).toBeVisible();

      // Table should be scrollable or all URLs visible
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount(10);
    });
  });
});
