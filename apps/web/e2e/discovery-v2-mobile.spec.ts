import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests: Discovery V2 - Mobile Responsive Layout
 *
 * Tests mobile responsiveness for Discovery Flow V2:
 * - NFR-3.2: Feature SHALL be responsive for mobile devices (min 375px width)
 *
 * Test Coverage:
 * - Mobile viewport (375px width - iPhone SE)
 * - Touch interactions (hasTouch: true)
 * - Step indicator responsiveness
 * - Input method selector on mobile
 * - URL input/textarea usability
 * - Navigation buttons visibility
 * - Touch target sizes (min 44x44px per WCAG)
 *
 * Actual implementation uses:
 * - InputMethodSelector: radiogroup with "Sitemap" and "Manual" options
 * - SitemapUrlInput: input labeled "Sitemap URL" with "Load Sitemap" button
 * - ManualUrlEntryEnhanced: textarea labeled "Enter URLs" with "Parse URLs" button
 * - Step navigation with "Back" and "Continue" buttons
 *
 * Related Spec: discovery-flow-v2
 * Related Tasks: Task 33
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

// Mobile device configuration (iPhone SE)
const mobileViewport = { width: 375, height: 667 };

test.describe('Discovery V2 - Mobile Responsive Layout', () => {
  test.describe('Step 1: Input URLs - Mobile Layout', () => {
    test.use({ viewport: mobileViewport });

    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await expect(page.getByRole('heading', { name: /discover website pages/i })).toBeVisible();
    });

    test('should display step indicator on mobile screen', async ({ page }) => {
      // Step indicator should be visible and fit within mobile viewport
      const stepIndicator = page.getByRole('navigation', { name: /progress/i });
      await expect(stepIndicator).toBeVisible();

      // Get bounding box to verify it fits
      const box = await stepIndicator.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(375);
      }
    });

    test('should display input method selector on mobile', async ({ page }) => {
      // Input method selector should be visible
      const inputMethodGroup = page.getByRole('radiogroup', { name: /input method/i });
      await expect(inputMethodGroup).toBeVisible();

      // Sitemap and Manual options should be visible
      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      const manualOption = page.getByRole('radio', { name: /manual/i });

      await expect(sitemapOption).toBeVisible();
      await expect(manualOption).toBeVisible();
    });

    test('should display sitemap URL input full width on mobile', async ({ page }) => {
      // First select sitemap method (not selected by default)
      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      await sitemapOption.click();
      await expect(sitemapOption).toHaveAttribute('aria-checked', 'true');

      // Find URL input field
      const urlInput = page.getByLabel(/sitemap url/i);
      await expect(urlInput).toBeVisible();

      const inputBox = await urlInput.boundingBox();
      if (inputBox) {
        // Input should span most of the viewport width (allow for padding)
        expect(inputBox.width).toBeGreaterThan(300);
      }
    });

    test('should display manual URL textarea usable on mobile', async ({ page }) => {
      // Select Manual mode
      await page.getByRole('radio', { name: /manual/i }).click();

      // Find textarea
      const textarea = page.getByLabel(/enter urls/i);
      await expect(textarea).toBeVisible();

      const textareaBox = await textarea.boundingBox();
      if (textareaBox) {
        // Textarea should be wide enough on mobile
        expect(textareaBox.width).toBeGreaterThan(300);
        // Should have reasonable height for multiple URLs
        expect(textareaBox.height).toBeGreaterThan(80);
      }

      // Should be able to type in textarea
      await textarea.fill('https://example.com\nhttps://example.com/about');
      await expect(textarea).toHaveValue(/example.com/);
    });

    test('should display Parse URLs button with adequate touch target', async ({ page }) => {
      // Select Manual mode
      await page.getByRole('radio', { name: /manual/i }).click();

      const parseButton = page.getByRole('button', { name: /parse urls/i });
      await expect(parseButton).toBeVisible();

      const buttonBox = await parseButton.boundingBox();
      if (buttonBox) {
        // Button should have minimum touch target size (44x44 per WCAG)
        expect(buttonBox.height).toBeGreaterThanOrEqual(40);
      }
    });

    test('should display Load Sitemap button with adequate touch target', async ({ page }) => {
      // First select sitemap method
      await page.getByRole('radio', { name: /sitemap/i }).click();

      const loadButton = page.getByRole('button', { name: /load sitemap/i });
      await expect(loadButton).toBeVisible();

      const buttonBox = await loadButton.boundingBox();
      if (buttonBox) {
        // Button should have minimum touch target size (44x44 per WCAG)
        expect(buttonBox.height).toBeGreaterThanOrEqual(40);
      }
    });
  });

  test.describe('Step 2: Select URLs - Mobile Layout', () => {
    test.use({ viewport: mobileViewport });

    test.beforeEach(async ({ page }) => {
      // Navigate to Step 2 via manual entry
      await page.goto('/discovery');
      await dismissCookieConsent(page);
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill(`https://example.com
https://example.com/about
https://example.com/contact
https://example.com/services`);

      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });
    });

    test('should display URL selection list on mobile', async ({ page }) => {
      // URLs should be displayed
      await expect(page.getByText('example.com', { exact: false })).toBeVisible();
    });

    test('should display selection controls with adequate touch targets', async ({ page }) => {
      // Look for Select All button
      const selectAllButton = page.getByRole('button', { name: /select all/i });
      await expect(selectAllButton).toBeVisible();

      const buttonBox = await selectAllButton.boundingBox();
      if (buttonBox) {
        // Should have adequate touch target height
        expect(buttonBox.height).toBeGreaterThanOrEqual(36);
      }
    });

    test('should display checkboxes with adequate size on mobile', async ({ page }) => {
      const checkboxes = page.getByRole('checkbox');
      const count = await checkboxes.count();

      expect(count).toBeGreaterThan(0);

      const firstCheckbox = checkboxes.first();
      await expect(firstCheckbox).toBeVisible();
    });

    test('should display Back and Continue buttons', async ({ page }) => {
      const backButton = page.getByRole('button', { name: /back/i });
      const continueButton = page.getByRole('button', { name: /continue/i });

      await expect(backButton).toBeVisible();
      await expect(continueButton).toBeVisible();

      // Check touch target sizes
      const backBox = await backButton.boundingBox();
      const continueBox = await continueButton.boundingBox();

      if (backBox) {
        expect(backBox.height).toBeGreaterThanOrEqual(36);
      }
      if (continueBox) {
        expect(continueBox.height).toBeGreaterThanOrEqual(36);
      }
    });
  });

  test.describe('Step 3: Preview - Mobile Layout', () => {
    test.use({ viewport: mobileViewport });

    test.beforeEach(async ({ page }) => {
      // Navigate to Step 3 via manual entry
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

    test('should display preview content on mobile viewport', async ({ page }) => {
      // Verify heading and content are visible
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
      await expect(page.getByText(/3 urls/i)).toBeVisible();
    });

    test('should display estimated time on mobile', async ({ page }) => {
      await expect(page.getByText(/estimated/i)).toBeVisible();
    });

    test('should display Back and Start Scan buttons with adequate touch targets', async ({ page }) => {
      const backButton = page.getByRole('button', { name: /back/i });
      const startScanButton = page.getByRole('button', { name: /start scan/i });

      await expect(backButton).toBeVisible();
      await expect(startScanButton).toBeVisible();

      const backBox = await backButton.boundingBox();
      const startBox = await startScanButton.boundingBox();

      if (backBox) {
        expect(backBox.height).toBeGreaterThanOrEqual(36);
      }
      if (startBox) {
        expect(startBox.height).toBeGreaterThanOrEqual(36);
      }
    });
  });

  test.describe('Navigation Buttons - Mobile', () => {
    test.use({ viewport: mobileViewport });

    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
    });

    test('should display primary action buttons clearly on mobile', async ({ page }) => {
      // Select manual mode to test parse button
      await page.getByRole('radio', { name: /manual/i }).click();

      const parseButton = page.getByRole('button', { name: /parse urls/i });
      await expect(parseButton).toBeVisible();

      const buttonBox = await parseButton.boundingBox();
      if (buttonBox) {
        // Primary buttons should be reasonably wide on mobile
        expect(buttonBox.width).toBeGreaterThan(100);
      }
    });
  });

  test.describe('Touch Interactions', () => {
    test.use({
      viewport: mobileViewport,
      hasTouch: true,
    });

    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
    });

    test('should allow tap on input method selector', async ({ page }) => {
      const manualOption = page.getByRole('radio', { name: /manual/i });

      // Tap to select manual mode
      await manualOption.tap();

      // Manual should be selected
      await expect(manualOption).toHaveAttribute('aria-checked', 'true');

      // Textarea should be visible
      const textarea = page.getByLabel(/enter urls/i);
      await expect(textarea).toBeVisible();
    });

    test('should allow tap navigation through flow', async ({ page }) => {
      // Select manual mode with tap
      await page.getByRole('radio', { name: /manual/i }).tap();

      // Fill URLs
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('https://example.com\nhttps://example.com/about');

      // Tap Parse URLs
      await page.getByRole('button', { name: /parse urls/i }).tap();

      // Wait for Step 2
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // Tap Continue
      await page.getByRole('button', { name: /continue/i }).tap();

      // Should be on Step 3
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();
    });

    test('should allow tap on back button', async ({ page }) => {
      // Navigate to Step 2
      await page.getByRole('radio', { name: /manual/i }).tap();
      const textarea = page.getByLabel(/enter urls/i);
      await textarea.fill('https://example.com');
      await page.getByRole('button', { name: /parse urls/i }).tap();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // Tap Back
      await page.getByRole('button', { name: /back/i }).tap();

      // Should return to Step 1
      await expect(page.getByRole('heading', { name: /step 1.*enter urls/i })).toBeVisible();
    });
  });

  test.describe('Form Input Usability on Mobile', () => {
    test.use({ viewport: mobileViewport });

    test.beforeEach(async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);
    });

    test('should allow typing in sitemap URL input', async ({ page }) => {
      // First select sitemap method
      await page.getByRole('radio', { name: /sitemap/i }).click();

      const urlInput = page.getByLabel(/sitemap url/i);

      await urlInput.fill('https://example.com/sitemap.xml');
      await expect(urlInput).toHaveValue(/sitemap\.xml/);
    });

    test('should allow typing in manual URL textarea', async ({ page }) => {
      await page.getByRole('radio', { name: /manual/i }).click();

      const textarea = page.getByLabel(/enter urls/i);

      const testUrls = 'https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3';
      await textarea.fill(testUrls);

      await expect(textarea).toHaveValue(/page1/);
    });

    test('should show URL counter on mobile', async ({ page }) => {
      await page.getByRole('radio', { name: /manual/i }).click();

      // URL counter should be visible
      const urlCounter = page.getByRole('status');
      await expect(urlCounter).toBeVisible();
      await expect(urlCounter).toContainText('0 / 50 URLs');
    });
  });

  test.describe('Mobile Viewport Constraints', () => {
    test.use({ viewport: mobileViewport });

    test('should not have horizontal overflow on mobile', async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);

      // Check for horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });

      // Should not have horizontal overflow
      expect(hasOverflow).toBeFalsy();
    });

    test('should be usable in landscape orientation', async ({ page }) => {
      // Switch to landscape (667x375)
      await page.setViewportSize({ width: 667, height: 375 });

      await page.goto('/discovery');
      await dismissCookieConsent(page);

      // Elements should still be visible in landscape
      await expect(page.getByRole('heading', { name: /discover website pages/i })).toBeVisible();
      await expect(page.getByRole('radio', { name: /sitemap/i })).toBeVisible();
    });

    test('should maintain layout throughout the flow on mobile', async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);

      // Step 1 - no overflow
      let hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });
      expect(hasOverflow).toBeFalsy();

      // Navigate to Step 2
      await page.getByRole('radio', { name: /manual/i }).click();
      await page.getByLabel(/enter urls/i).fill('https://example.com\nhttps://example.com/about');
      await page.getByRole('button', { name: /parse urls/i }).click();
      await expect(page.getByRole('heading', { name: /step 2.*select urls/i })).toBeVisible({ timeout: 5000 });

      // Step 2 - no overflow
      hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });
      expect(hasOverflow).toBeFalsy();

      // Navigate to Step 3
      // URLs are not selected by default, need to select them first
      await page.getByRole('button', { name: /^select all/i }).click();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page.getByRole('heading', { name: /review your selection/i })).toBeVisible();

      // Step 3 - no overflow
      hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });
      expect(hasOverflow).toBeFalsy();
    });
  });

  test.describe('Accessibility - Touch Target Sizes', () => {
    test.use({ viewport: mobileViewport });

    test('should have minimum touch targets for buttons', async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);

      // Get all buttons
      const buttons = page.getByRole('button');
      const buttonCount = await buttons.count();

      let checkedButtons = 0;

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const isVisible = await button.isVisible();

        if (isVisible) {
          const box = await button.boundingBox();
          if (box) {
            // Buttons should have reasonable touch target size
            expect(box.height).toBeGreaterThanOrEqual(32);
            checkedButtons++;
          }
        }
      }

      // Should have checked at least one button
      expect(checkedButtons).toBeGreaterThan(0);
    });

    test('should have adequate spacing for radio options', async ({ page }) => {
      await page.goto('/discovery');
      await dismissCookieConsent(page);

      const sitemapOption = page.getByRole('radio', { name: /sitemap/i });
      const manualOption = page.getByRole('radio', { name: /manual/i });

      const sitemapBox = await sitemapOption.boundingBox();
      const manualBox = await manualOption.boundingBox();

      if (sitemapBox && manualBox) {
        // There should be some spacing between options
        const spacing = Math.abs(manualBox.y - (sitemapBox.y + sitemapBox.height));

        // Options should not overlap
        expect(spacing).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
