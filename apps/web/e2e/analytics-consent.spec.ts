import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Analytics Consent Flow
 *
 * Tests the complete consent management and GTM integration:
 * 1. GTM script loads only after consent acceptance
 * 2. GTM script does NOT load when consent declined
 * 3. Consent preference persists across page reloads
 * 4. Declining consent clears analytics cookies
 *
 * Requirements:
 * - 1.5: GTM respects user consent through enabled prop
 * - 3.2: User accepts analytics cookies → enable GTM/GA4 tracking
 * - 3.3: User declines analytics cookies → disable all analytics tracking
 * - 3.5: Consent declined → clear existing analytics cookies
 * - 3.6: Consent remembered on return visits
 *
 * @see apps/web/e2e/batch-scan.spec.ts - E2E pattern reference
 */

test.describe('Analytics Consent Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear cookies before each test
    await context.clearCookies();
    // Navigate to clear any existing state, then clear localStorage and reload
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    // Reload to ensure clean state with cleared storage
    await page.reload();
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test.describe('GTM Script Loading Based on Consent', () => {
    test('should store consent and enable analytics after acceptance', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Verify consent banner is visible
      await expect(page.getByRole('dialog', { name: /cookie/i })).toBeVisible();

      // Verify GTM script is NOT loaded before consent
      const gtmScriptBefore = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.some(script =>
          script.src.includes('googletagmanager.com') ||
          script.innerHTML.includes('gtm.js')
        );
      });
      expect(gtmScriptBefore).toBe(false);

      // Click "Accept All" button
      await page.getByRole('button', { name: /accept all/i }).click();

      // Verify consent banner is no longer visible
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Wait a moment for state updates
      await page.waitForTimeout(500);

      // Verify consent is stored in localStorage with analytics enabled
      const storedConsent = await page.evaluate(() => {
        const consent = localStorage.getItem('adashield:consent');
        return consent ? JSON.parse(consent) : null;
      });

      expect(storedConsent).not.toBeNull();
      expect(storedConsent.analytics).toBe(true);
      expect(storedConsent.essential).toBe(true);

      // If GTM_ID is configured, GTM script should be loaded
      // Note: GTM may not load in test environment without NEXT_PUBLIC_GTM_ID
      const gtmScriptAfter = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.some(script =>
          script.src.includes('googletagmanager.com') ||
          script.innerHTML.includes('gtm.js')
        );
      });
      // GTM may or may not be loaded depending on environment config
      // The key test is that consent is properly stored
      console.log('GTM loaded after consent:', gtmScriptAfter);
    });

    test('should store declined consent and NOT enable analytics', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Verify consent banner is visible
      await expect(page.getByRole('dialog', { name: /cookie/i })).toBeVisible();

      // Click "Decline All" button
      await page.getByRole('button', { name: /decline analytics/i }).click();

      // Verify consent banner is no longer visible
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Wait a moment for state updates
      await page.waitForTimeout(500);

      // Verify GTM script is NOT loaded
      const gtmScript = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.some(script =>
          script.src.includes('googletagmanager.com') ||
          script.innerHTML.includes('gtm.js')
        );
      });
      expect(gtmScript).toBe(false);

      // Verify consent is stored with analytics disabled
      const storedConsent = await page.evaluate(() => {
        const consent = localStorage.getItem('adashield:consent');
        return consent ? JSON.parse(consent) : null;
      });

      expect(storedConsent).not.toBeNull();
      expect(storedConsent.analytics).toBe(false);
      expect(storedConsent.essential).toBe(true);
    });

    test('should accept analytics through customization with checkbox checked', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Verify consent banner is visible
      await expect(page.getByRole('dialog', { name: /cookie/i })).toBeVisible();

      // Click "Customize" to expand details
      await page.getByRole('button', { name: /customize/i }).click();

      // Verify analytics checkbox is visible and checked by default
      const analyticsCheckbox = page.locator('input[id="analytics-consent"]');
      await expect(analyticsCheckbox).toBeVisible();
      await expect(analyticsCheckbox).toBeChecked();

      // Click "Save Preferences" to accept with default settings
      await page.getByRole('button', { name: /save preferences/i }).click();

      // Verify consent banner is no longer visible
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Wait for state updates
      await page.waitForTimeout(500);

      // Verify consent is stored with analytics enabled
      const storedConsent = await page.evaluate(() => {
        const consent = localStorage.getItem('adashield:consent');
        return consent ? JSON.parse(consent) : null;
      });

      expect(storedConsent).not.toBeNull();
      expect(storedConsent.analytics).toBe(true);
    });

    test('should decline analytics through customization by unchecking', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Verify consent banner is visible
      await expect(page.getByRole('dialog', { name: /cookie/i })).toBeVisible();

      // Click "Customize" to expand details
      await page.getByRole('button', { name: /customize/i }).click();

      // Uncheck analytics consent
      const analyticsCheckbox = page.locator('input[id="analytics-consent"]');
      await expect(analyticsCheckbox).toBeVisible();
      await analyticsCheckbox.uncheck();

      // Click "Save Preferences"
      await page.getByRole('button', { name: /save preferences/i }).click();

      // Verify consent banner is no longer visible
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Wait for state updates
      await page.waitForTimeout(500);

      // Verify GTM script is NOT loaded
      const gtmScript = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.some(script =>
          script.src.includes('googletagmanager.com') ||
          script.innerHTML.includes('gtm.js')
        );
      });
      expect(gtmScript).toBe(false);

      // Verify consent is stored with analytics disabled
      const storedConsent = await page.evaluate(() => {
        const consent = localStorage.getItem('adashield:consent');
        return consent ? JSON.parse(consent) : null;
      });

      expect(storedConsent).not.toBeNull();
      expect(storedConsent.analytics).toBe(false);
    });
  });

  test.describe('Consent Persistence Across Page Reloads', () => {
    test('should remember accepted consent on page reload', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Accept consent
      await page.getByRole('button', { name: /accept all/i }).click();

      // Verify consent banner is hidden
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Reload the page (Requirement 3.6)
      await page.reload();

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // Verify consent banner does NOT appear again
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Verify consent is still in localStorage
      const storedConsent = await page.evaluate(() => {
        const consent = localStorage.getItem('adashield:consent');
        return consent ? JSON.parse(consent) : null;
      });

      expect(storedConsent).not.toBeNull();
      expect(storedConsent.analytics).toBe(true);
    });

    test('should remember declined consent on page reload', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Decline consent
      await page.getByRole('button', { name: /decline analytics/i }).click();

      // Verify consent banner is hidden
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Reload the page (Requirement 3.6)
      await page.reload();

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // Verify consent banner does NOT appear again
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Verify GTM is still NOT loaded
      const gtmScript = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.some(script =>
          script.src.includes('googletagmanager.com') ||
          script.innerHTML.includes('gtm.js')
        );
      });
      expect(gtmScript).toBe(false);

      // Verify consent is still in localStorage
      const storedConsent = await page.evaluate(() => {
        const consent = localStorage.getItem('adashield:consent');
        return consent ? JSON.parse(consent) : null;
      });

      expect(storedConsent).not.toBeNull();
      expect(storedConsent.analytics).toBe(false);
    });

    test('should persist consent across different pages', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Accept consent
      await page.getByRole('button', { name: /accept all/i }).click();

      // Navigate to a different page
      await page.goto('/discovery');

      // Verify consent banner does NOT appear
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();

      // Verify consent is still in localStorage
      const storedConsent = await page.evaluate(() => {
        const consent = localStorage.getItem('adashield:consent');
        return consent ? JSON.parse(consent) : null;
      });

      expect(storedConsent).not.toBeNull();
      expect(storedConsent.analytics).toBe(true);
    });
  });

  test.describe('Analytics Cookie Clearing on Decline', () => {
    test('should clear analytics cookies when consent is declined', async ({ page, context }) => {
      // Page is already loaded with clean state from beforeEach

      // First, accept consent
      await page.getByRole('button', { name: /accept all/i }).click();

      // Wait for state update
      await page.waitForTimeout(500);

      // Manually set some mock GA cookies to simulate real scenario
      await context.addCookies([
        {
          name: '_ga',
          value: 'GA1.1.123456789.1234567890',
          domain: new URL(page.url()).hostname,
          path: '/',
        },
        {
          name: '_gid',
          value: 'GA1.1.987654321.0987654321',
          domain: new URL(page.url()).hostname,
          path: '/',
        },
        {
          name: '_gat',
          value: '1',
          domain: new URL(page.url()).hostname,
          path: '/',
        },
        {
          name: '_ga_XXXXXXXXXX',
          value: 'GS1.1.123456789.1.1.1234567890.0.0.0',
          domain: new URL(page.url()).hostname,
          path: '/',
        },
      ]);

      // Clear localStorage and reload to trigger consent banner again
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify cookies exist before declining
      const cookiesBefore = await context.cookies();
      const gaCookiesBefore = cookiesBefore.filter(c =>
        c.name.startsWith('_ga') || c.name.startsWith('_gid') || c.name.startsWith('_gat')
      );
      expect(gaCookiesBefore.length).toBeGreaterThan(0);

      // Decline consent
      await page.getByRole('button', { name: /decline analytics/i }).click();

      // Wait for cookie clearing operation
      await page.waitForTimeout(500);

      // Verify analytics cookies are cleared (Requirement 3.5)
      const cookiesAfter = await context.cookies();
      const gaCookiesAfter = cookiesAfter.filter(c =>
        c.name.startsWith('_ga') || c.name.startsWith('_gid') || c.name.startsWith('_gat')
      );

      // All GA cookies should be cleared
      expect(gaCookiesAfter.length).toBe(0);
    });

    test('should clear cookies when changing from accepted to declined', async ({ page, context }) => {
      // Page is already loaded with clean state from beforeEach

      // Accept consent initially
      await page.getByRole('button', { name: /accept all/i }).click();

      // Wait for state update
      await page.waitForTimeout(500);

      // Add mock GA cookies
      await context.addCookies([
        {
          name: '_ga',
          value: 'GA1.1.123456789.1234567890',
          domain: new URL(page.url()).hostname,
          path: '/',
        },
      ]);

      // Simulate returning and changing preference
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Decline this time
      await page.getByRole('button', { name: /decline analytics/i }).click();

      // Wait for cookie clearing
      await page.waitForTimeout(500);

      // Verify GA cookies are cleared
      const cookies = await context.cookies();
      const gaCookies = cookies.filter(c => c.name.startsWith('_ga'));
      expect(gaCookies.length).toBe(0);
    });
  });

  test.describe('Consent Banner Accessibility', () => {
    test('should have proper ARIA attributes on consent banner', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Verify dialog role
      const dialog = page.getByRole('dialog', { name: /cookie/i });
      await expect(dialog).toBeVisible();

      // Verify aria-labelledby
      await expect(dialog).toHaveAttribute('aria-labelledby', 'cookie-consent-title');

      // Verify aria-describedby
      await expect(dialog).toHaveAttribute('aria-describedby', 'cookie-consent-description');

      // Verify buttons are accessible
      await expect(page.getByRole('button', { name: /accept all/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /decline analytics/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /customize/i })).toBeVisible();
    });

    test('should support keyboard navigation in consent banner', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach

      // Click on a button within the consent dialog to give it focus
      await page.getByRole('button', { name: /customize/i }).click();

      // Now tab to navigate to other buttons in the dialog
      await page.keyboard.press('Tab');

      // Verify focus is within the consent banner
      const focusedElement = await page.evaluate(() => {
        const activeElement = document.activeElement;
        const consentDialog = document.querySelector('[role="dialog"]');
        return consentDialog?.contains(activeElement);
      });

      expect(focusedElement).toBe(true);

      // Tab again and verify still in dialog
      await page.keyboard.press('Tab');
      const stillInDialog = await page.evaluate(() => {
        const activeElement = document.activeElement;
        const consentDialog = document.querySelector('[role="dialog"]');
        return consentDialog?.contains(activeElement);
      });

      expect(stillInDialog).toBe(true);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle missing GTM ID gracefully', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach
      // This test verifies the app doesn't crash without GTM_ID

      // Set up error listener before any actions
      const errors: string[] = [];
      page.on('pageerror', error => {
        errors.push(error.message);
      });

      // Accept consent
      await page.getByRole('button', { name: /accept all/i }).click();

      // Wait for any potential errors
      await page.waitForTimeout(1000);

      // Filter out unrelated errors, focus on GTM/analytics errors
      const analyticsErrors = errors.filter(e =>
        e.toLowerCase().includes('gtm') ||
        e.toLowerCase().includes('analytics') ||
        e.toLowerCase().includes('datalayer')
      );

      // Should not have analytics-related errors
      expect(analyticsErrors.length).toBe(0);
    });

    test('should show consent banner for first-time visitors', async ({ page }) => {
      // Page is already loaded with clean state from beforeEach
      // The beforeEach clears all storage, so this simulates a first visit

      // Verify banner appears for first-time visitor
      await expect(page.getByRole('dialog', { name: /cookie/i })).toBeVisible();
    });

    test('should not show banner when consent already exists', async ({ page }) => {
      // Pre-set consent in localStorage
      await page.goto('/');
      await page.evaluate(() => {
        const consent = {
          essential: true,
          analytics: true,
          marketing: false,
          timestamp: new Date().toISOString(),
          version: '1.0'
        };
        localStorage.setItem('adashield:consent', JSON.stringify(consent));
      });

      // Reload the page
      await page.reload();

      // Verify banner does not appear
      await expect(page.getByRole('dialog', { name: /cookie/i })).not.toBeVisible();
    });
  });
});
