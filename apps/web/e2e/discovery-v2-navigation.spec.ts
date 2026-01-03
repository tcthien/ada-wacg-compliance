import { test, expect, Page } from '@playwright/test';

/**
 * Discovery Flow V2 - Step Navigation and Accessibility Tests
 *
 * Tests the 3-step discovery flow:
 * - Step 1: Input URLs (Sitemap or Manual method)
 * - Step 2: Select URLs
 * - Step 3: Preview and Start Scan
 *
 * Actual implementation uses:
 * - InputMethodSelector: radiogroup with "Sitemap" and "Manual" options
 * - SitemapUrlInput: labeled "Sitemap URL" with "Load Sitemap" button
 * - ManualUrlEntryEnhanced: labeled "Enter URLs" with "Parse URLs" button
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

test.describe('Discovery Flow V2 - Step Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discovery');
    await dismissCookieConsent(page);
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /discover website pages/i })).toBeVisible();
  });

  test.describe('Step 1: Input Method Selection', () => {
    test('should display step indicator with 3 steps', async ({ page }) => {
      const stepNav = page.getByRole('navigation', { name: /progress/i });
      await expect(stepNav).toBeVisible();

      // Check for step labels
      await expect(page.getByText('Input URLs')).toBeVisible();
      await expect(page.getByText('Select URLs')).toBeVisible();
      await expect(page.getByText('Preview')).toBeVisible();
    });

    test('should display input method selector with Sitemap and Manual options', async ({ page }) => {
      const radioGroup = page.getByRole('radiogroup', { name: /input method/i });
      await expect(radioGroup).toBeVisible();

      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      const manualOption = page.getByRole('radio', { name: /manual/i });

      await expect(sitemapOption).toBeVisible();
      await expect(manualOption).toBeVisible();
    });

    test('should show manual entry by default (no method selected)', async ({ page }) => {
      // Neither option should be selected by default
      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      const manualOption = page.getByRole('radio', { name: /manual/i });
      await expect(sitemapOption).toHaveAttribute('aria-checked', 'false');
      await expect(manualOption).toHaveAttribute('aria-checked', 'false');

      // Manual entry UI should be visible as fallback
      await expect(page.getByLabel(/enter urls/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /parse urls/i })).toBeVisible();
    });

    test('should show sitemap input when sitemap is selected', async ({ page }) => {
      // Click sitemap option to select it
      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      await sitemapOption.click();

      await expect(sitemapOption).toHaveAttribute('aria-checked', 'true');

      // Sitemap URL input should be visible
      await expect(page.getByLabel(/sitemap url/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /load sitemap/i })).toBeVisible();
    });

    test('should switch to manual entry when Manual is selected', async ({ page }) => {
      const manualOption = page.getByRole('radio', { name: /manual/i });
      await manualOption.click();

      await expect(manualOption).toHaveAttribute('aria-checked', 'true');

      // Manual textarea should be visible
      await expect(page.getByLabel(/enter urls/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /parse urls/i })).toBeVisible();
    });

    test('should switch back to sitemap from manual', async ({ page }) => {
      // Switch to manual first
      await page.getByRole('radio', { name: /manual/i }).click();

      // Switch back to sitemap
      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      await sitemapOption.click();

      await expect(sitemapOption).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByLabel(/sitemap url/i)).toBeVisible();
    });
  });

  test.describe('Manual Entry Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Switch to manual mode
      await page.getByRole('radio', { name: /manual/i }).click();
    });

    test('should accept manual URLs and navigate to Step 2', async ({ page }) => {
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('https://example.com\nhttps://example.com/about\nhttps://example.com/contact');

      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should navigate to Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();
    });

    test('should show URL count when typing', async ({ page }) => {
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('https://example.com\nhttps://example.com/about');

      // Should show URL count
      await expect(page.getByText(/2.*\/.*50.*urls/i)).toBeVisible();
    });

    test('should show validation error for invalid URLs', async ({ page }) => {
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('not-a-valid-url');

      await page.getByRole('button', { name: /parse urls/i }).click();

      // Should show error
      await expect(page.getByRole('alert')).toBeVisible();
    });
  });

  test.describe('Step 2: URL Selection', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Step 2 via manual entry
      await page.getByRole('radio', { name: /manual/i }).click();
      await page.getByLabel(/enter urls/i).fill('https://example.com\nhttps://example.com/about\nhttps://example.com/contact');
      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();
    });

    test('should display all entered URLs', async ({ page }) => {
      await expect(page.getByText('https://example.com', { exact: false })).toBeVisible();
      await expect(page.getByText('example.com/about', { exact: false })).toBeVisible();
      await expect(page.getByText('example.com/contact', { exact: false })).toBeVisible();
    });

    test('should have Select All and Deselect All buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /select all/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /deselect all/i })).toBeVisible();
    });

    test('should have Back button that returns to Step 1', async ({ page }) => {
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();

      await backButton.click();

      // Should be back on Step 1
      await expect(page.getByRole('heading', { name: /step 1.*enter urls/i })).toBeVisible();
    });

    test('should preserve manual input when navigating back', async ({ page }) => {
      await page.getByRole('button', { name: /back/i }).click();

      // Manual mode should still be selected
      await expect(page.getByRole('radio', { name: /manual/i })).toHaveAttribute('aria-checked', 'true');

      // URLs should be preserved
      const textarea = page.getByLabel(/enter urls/i);
      await expect(textarea).toContainText('example.com');
    });

    test('should have Continue button that goes to Step 3', async ({ page }) => {
      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();

      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeVisible();
      await expect(continueButton).toBeEnabled();

      await continueButton.click();

      // Should be on Step 3
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should disable Continue when no URLs selected', async ({ page }) => {
      // Continue should already be disabled (no URLs selected by default)
      const continueButton = page.getByRole('button', { name: /continue/i });
      await expect(continueButton).toBeDisabled();

      // Select all URLs
      await page.getByRole('button', { name: /^select all/i }).click();

      // Now Continue should be enabled
      await expect(continueButton).toBeEnabled();

      // Deselect all
      await page.getByRole('button', { name: /deselect all/i }).click();

      // Continue should be disabled again
      await expect(continueButton).toBeDisabled();
    });
  });

  test.describe('Step 3: Preview', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Step 3 via manual entry
      await page.getByRole('radio', { name: /manual/i }).click();
      await page.getByLabel(/enter urls/i).fill('https://example.com\nhttps://example.com/about');
      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();
      // Select all URLs before continuing (URLs are not selected by default)
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should display selected URL count', async ({ page }) => {
      await expect(page.getByText(/2 urls/i)).toBeVisible();
    });

    test('should display estimated scan time', async ({ page }) => {
      await expect(page.getByText(/estimated/i)).toBeVisible();
    });

    test('should have Back button that returns to Step 2', async ({ page }) => {
      await page.getByRole('button', { name: /back/i }).click();

      // Should be back on Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();
    });

    test('should preserve URL selection when navigating back', async ({ page }) => {
      await page.getByRole('button', { name: /back/i }).click();

      // URLs should still be displayed
      await expect(page.getByText('example.com', { exact: false })).toBeVisible();
    });

    test('should have Start Scan button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /start scan/i })).toBeVisible();
    });
  });

  test.describe('Back/Forward Navigation', () => {
    test('should preserve state through multiple back/forward navigations', async ({ page }) => {
      // Step 1: Enter URLs via manual
      await page.getByRole('radio', { name: /manual/i }).click();
      await page.getByLabel(/enter urls/i).fill('https://test.com\nhttps://test.com/page');
      await page.getByRole('button', { name: /parse urls/i }).click();

      // Step 2: Verify, select URLs, and continue
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();
      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();

      // Step 3: Go back twice
      await page.getByRole('button', { name: /back/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();

      await page.getByRole('button', { name: /back/i }).click();
      await expect(page.getByRole('heading', { name: /step 1.*enter urls/i })).toBeVisible();

      // Verify state preserved
      await expect(page.getByRole('radio', { name: /manual/i })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByLabel(/enter urls/i)).toContainText('test.com');

      // Go forward again
      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible();
    });
  });
});

test.describe('Discovery Flow V2 - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discovery');
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: /discover website pages/i })).toBeVisible();
  });

  test('should allow keyboard navigation between input methods', async ({ page }) => {
    // Focus on sitemap radio
    const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
    await sitemapOption.focus();

    // Use arrow key to navigate to manual
    await page.keyboard.press('ArrowRight');

    // Manual should be selected
    await expect(page.getByRole('radio', { name: /manual/i })).toHaveAttribute('aria-checked', 'true');
  });

  test('should allow Enter key to submit sitemap form', async ({ page }) => {
    // First select sitemap method
    await page.getByRole('radio', { name: /sitemap/i }).click();

    const input = page.getByLabel(/sitemap url/i);
    await input.fill('https://example.com/sitemap.xml');
    await input.press('Enter');

    // Should show loading or error (since sitemap doesn't exist)
    // Either loading state or error message should appear
    await expect(page.getByRole('button', { name: /loading/i }).or(page.getByRole('alert'))).toBeVisible({ timeout: 10000 });
  });

  test('should allow Tab navigation through Step 1 elements', async ({ page }) => {
    // Tab through elements
    await page.keyboard.press('Tab');

    // First focusable should be input method selector or sitemap input
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});

test.describe('Discovery Flow V2 - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discovery');
    await dismissCookieConsent(page);
    await expect(page.getByRole('heading', { name: /discover website pages/i })).toBeVisible();
  });

  test('should have accessible step indicator', async ({ page }) => {
    const stepNav = page.getByRole('navigation', { name: /progress/i });
    await expect(stepNav).toBeVisible();
    await expect(stepNav).toHaveAttribute('aria-label', /progress/i);
  });

  test('should have accessible input method radiogroup', async ({ page }) => {
    const radioGroup = page.getByRole('radiogroup');
    await expect(radioGroup).toHaveAttribute('aria-label', /input method/i);
  });

  test('should have accessible form inputs with labels', async ({ page }) => {
    // Manual textarea should be visible by default (fallback)
    const manualTextarea = page.getByLabel(/enter urls/i);
    await expect(manualTextarea).toBeVisible();

    // Switch to sitemap
    await page.getByRole('radio', { name: /sitemap/i }).click();

    // Sitemap input should have label
    const sitemapInput = page.getByLabel(/sitemap url/i);
    await expect(sitemapInput).toBeVisible();
  });

  test('should announce errors to screen readers', async ({ page }) => {
    await page.getByRole('radio', { name: /manual/i }).click();
    await page.getByLabel(/enter urls/i).fill('invalid-url');
    await page.getByRole('button', { name: /parse urls/i }).click();

    // Error should have alert role
    const errorAlert = page.getByRole('alert');
    await expect(errorAlert).toBeVisible();
  });

  test('should have visible focus indicators', async ({ page }) => {
    // Manual textarea is visible by default
    const manualTextarea = page.getByLabel(/enter urls/i);
    await manualTextarea.focus();

    // Check that element has focus ring (visual verification via snapshot would be ideal)
    await expect(manualTextarea).toBeFocused();
  });
});

test.describe('Discovery Flow V2 - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discovery');
    await dismissCookieConsent(page);
  });

  test('should handle empty sitemap URL submission', async ({ page }) => {
    // First select sitemap method
    await page.getByRole('radio', { name: /sitemap/i }).click();

    const submitButton = page.getByRole('button', { name: /load sitemap/i });

    // Button should be disabled when input is empty
    await expect(submitButton).toBeDisabled();
  });

  test('should handle empty manual URL submission', async ({ page }) => {
    await page.getByRole('radio', { name: /manual/i }).click();

    const submitButton = page.getByRole('button', { name: /parse urls/i });

    // Button should be disabled when textarea is empty
    await expect(submitButton).toBeDisabled();
  });

  test('should handle whitespace-only input', async ({ page }) => {
    await page.getByRole('radio', { name: /manual/i }).click();
    await page.getByLabel(/enter urls/i).fill('   \n   \n   ');

    const submitButton = page.getByRole('button', { name: /parse urls/i });
    // Should still be disabled or show error
    await expect(submitButton).toBeDisabled();
  });

  test('should handle rapid method switching', async ({ page }) => {
    const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
    const manualOption = page.getByRole('radio', { name: /manual/i });

    // Rapidly switch between methods
    for (let i = 0; i < 5; i++) {
      await manualOption.click();
      await sitemapOption.click();
    }

    // Should end up on sitemap
    await expect(sitemapOption).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel(/sitemap url/i)).toBeVisible();
  });
});
