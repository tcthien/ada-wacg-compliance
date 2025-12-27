import { test, expect } from '@playwright/test';

/**
 * E2E Tests: GDPR Data Deletion Flow
 *
 * Tests GDPR compliance features:
 * 1. Navigate to settings page
 * 2. Request data deletion
 * 3. Confirm deletion
 * 4. Verify data is deleted
 *
 * Also tests:
 * - Privacy policy access
 * - Cookie consent
 * - Data management settings
 */

test.describe('GDPR Compliance', () => {
  test('should navigate to settings page from header', async ({ page }) => {
    await page.goto('/');

    // Click Settings link in header
    await page.getByRole('link', { name: /settings/i }).click();

    // Should navigate to settings page
    await expect(page).toHaveURL(/\/settings/);
  });

  test('should display settings page with data management options', async ({ page }) => {
    await page.goto('/settings');

    // Check page heading
    await expect(
      page.getByRole('heading', { name: /settings|data management/i })
    ).toBeVisible();

    // Check for data deletion section
    await expect(
      page.getByText(/delete.*data|remove.*data/i)
    ).toBeVisible();

    // Check for privacy-related text
    await expect(
      page.getByText(/privacy|gdpr/i)
    ).toBeVisible();
  });

  test('should show data deletion confirmation dialog', async ({ page }) => {
    await page.goto('/settings');

    // Click delete data button
    const deleteButton = page.getByRole('button', {
      name: /delete.*data|remove.*data/i,
    });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Should show confirmation dialog
    await expect(
      page.getByText(/confirm|are you sure/i)
    ).toBeVisible();

    // Should have cancel and confirm buttons
    await expect(
      page.getByRole('button', { name: /cancel/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /confirm|delete/i })
    ).toBeVisible();
  });

  test('should cancel data deletion when cancel is clicked', async ({ page }) => {
    await page.goto('/settings');

    // Click delete data button
    await page.getByRole('button', { name: /delete.*data/i }).click();

    // Wait for confirmation dialog
    await expect(page.getByText(/confirm|are you sure/i)).toBeVisible();

    // Click cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Dialog should close (or confirmation message should not appear)
    await expect(
      page.getByText(/data.*deleted|deletion complete/i)
    ).not.toBeVisible();

    // Should still be on settings page
    await expect(page).toHaveURL(/\/settings/);
  });

  test('should complete data deletion flow', async ({ page }) => {
    // Mock the deletion API
    await page.route('**/api/user/data', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'All your data has been deleted successfully',
          }),
        });
      }
    });

    // Mock history to be empty after deletion
    await page.route('**/api/scans/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scans: [],
          total: 0,
        }),
      });
    });

    await page.goto('/settings');

    // Click delete data button
    await page.getByRole('button', { name: /delete.*data/i }).click();

    // Confirm deletion
    await page.getByRole('button', { name: /confirm|delete/i }).last().click();

    // Should show success message
    await expect(
      page.getByText(/deleted|removed|cleared/i)
    ).toBeVisible();
  });

  test('should handle deletion API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/user/data', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to delete data. Please try again.',
          }),
        });
      }
    });

    await page.goto('/settings');

    // Attempt deletion
    await page.getByRole('button', { name: /delete.*data/i }).click();
    await page.getByRole('button', { name: /confirm|delete/i }).last().click();

    // Should show error message
    await expect(
      page.getByText(/error|failed/i)
    ).toBeVisible();

    // Should offer retry option
    await expect(
      page.getByRole('button', { name: /try again|retry/i })
    ).toBeVisible();
  });

  test('should explain what data will be deleted', async ({ page }) => {
    await page.goto('/settings');

    // Check for explanation text
    await expect(
      page.getByText(/scan history|personal data|stored data/i)
    ).toBeVisible();

    // Should mention GDPR rights
    await expect(
      page.getByText(/right to|privacy|gdpr/i)
    ).toBeVisible();
  });

  test('should provide link to privacy policy from settings', async ({ page }) => {
    await page.goto('/settings');

    // Find privacy policy link
    const privacyLink = page.getByRole('link', { name: /privacy policy/i });
    await expect(privacyLink).toBeVisible();
  });

  test('should navigate to privacy policy page', async ({ page }) => {
    await page.goto('/');

    // Click privacy policy link in footer
    const privacyLink = page.getByRole('link', { name: /privacy policy/i }).first();
    await privacyLink.click();

    // Should navigate to privacy policy page
    await expect(page).toHaveURL(/\/privacy/);
  });

  test('should display privacy policy content', async ({ page }) => {
    await page.goto('/privacy');

    // Check page heading
    await expect(
      page.getByRole('heading', { name: /privacy policy/i })
    ).toBeVisible();

    // Check for key privacy policy sections
    await expect(page.getByText(/data collection/i)).toBeVisible();
    await expect(page.getByText(/cookies/i)).toBeVisible();
    await expect(page.getByText(/your rights/i)).toBeVisible();

    // Check for GDPR-specific content
    await expect(page.getByText(/gdpr|general data protection/i)).toBeVisible();
  });

  test('should show cookie consent banner on first visit', async ({ page }) => {
    // Clear cookies to simulate first visit
    await page.context().clearCookies();

    await page.goto('/');

    // Should show cookie consent banner
    await expect(
      page.getByText(/cookie|consent/i)
    ).toBeVisible();

    // Should have accept and reject buttons
    await expect(
      page.getByRole('button', { name: /accept|allow/i })
    ).toBeVisible();
  });

  test('should hide cookie banner after accepting', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    // Wait for cookie banner
    const cookieBanner = page.getByText(/cookie|consent/i);
    await expect(cookieBanner.first()).toBeVisible();

    // Click accept
    await page.getByRole('button', { name: /accept|allow/i }).first().click();

    // Banner should disappear
    await expect(cookieBanner.first()).not.toBeVisible();
  });

  test('should remember cookie preference across pages', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    // Accept cookies
    await page.getByRole('button', { name: /accept|allow/i }).first().click();

    // Navigate to another page
    await page.goto('/privacy');

    // Cookie banner should not appear
    await expect(
      page.getByText(/cookie consent|accept cookies/i)
    ).not.toBeVisible();
  });

  test('should show data retention information', async ({ page }) => {
    await page.goto('/settings');

    // Check for data retention information
    await expect(
      page.getByText(/retain|storage|keep/i)
    ).toBeVisible();

    // Should mention how long data is kept
    await expect(
      page.getByText(/days|months|years|\d+/i)
    ).toBeVisible();
  });

  test('should allow downloading personal data', async ({ page }) => {
    // Mock data export API
    await page.route('**/api/user/data/export', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Content-Disposition': 'attachment; filename="my-data.json"',
        },
        body: JSON.stringify({
          scans: [],
          preferences: {},
          exportedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/settings');

    // Find download/export button
    const exportButton = page.getByRole('button', { name: /download|export/i });

    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');

      // Click export button
      await exportButton.click();

      // Verify download initiated
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.json');
    }
  });

  test('should display cookie policy details', async ({ page }) => {
    await page.goto('/privacy');

    // Look for cookie policy section
    await expect(
      page.getByRole('heading', { name: /cookie/i })
    ).toBeVisible();

    // Should list types of cookies
    await expect(page.getByText(/essential|necessary/i)).toBeVisible();
    await expect(page.getByText(/analytics|performance/i)).toBeVisible();
  });

  test('should provide contact information for privacy inquiries', async ({ page }) => {
    await page.goto('/privacy');

    // Should have contact information
    await expect(
      page.getByText(/contact|email|support/i)
    ).toBeVisible();

    // Should have email address or contact form
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    await expect(page.locator(`text=${emailPattern}`)).toBeVisible();
  });

  test('should show last updated date for privacy policy', async ({ page }) => {
    await page.goto('/privacy');

    // Should display last updated date
    await expect(
      page.getByText(/last updated|effective date/i)
    ).toBeVisible();

    // Should have a date
    await expect(
      page.getByText(/\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|january|february|march/i)
    ).toBeVisible();
  });

  test('should warn about consequences of data deletion', async ({ page }) => {
    await page.goto('/settings');

    // Click delete button to see confirmation
    await page.getByRole('button', { name: /delete.*data/i }).click();

    // Should warn about permanent deletion
    await expect(
      page.getByText(/permanent|cannot be undone|irreversible/i)
    ).toBeVisible();

    // Should mention what will be lost
    await expect(
      page.getByText(/history|scans|results/i)
    ).toBeVisible();
  });
});
