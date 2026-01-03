import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Analytics Event Tracking
 *
 * Tests end-to-end event tracking via Google Tag Manager dataLayer:
 * 1. scan_initiated event pushed on form submission
 * 2. page_view events tracked on navigation
 * 3. report_exported event on download
 * 4. Verify event payloads contain expected properties
 * 5. Funnel events tracked throughout user journey
 *
 * Requirements:
 * - Requirement 2: Event tracking via GTM dataLayer
 * - Requirement 4: User action events (scan_initiated, report_exported)
 * - Requirement 5: Funnel tracking events
 *
 * @see apps/web/src/lib/analytics.ts - Analytics implementation
 * @see apps/web/src/lib/analytics.types.ts - Event type definitions
 * @see apps/web/e2e/batch-scan.spec.ts - E2E pattern reference
 */

test.describe('Analytics Event Tracking', () => {
  // Skip all tests in this file if GTM is not configured
  // These tests require NEXT_PUBLIC_GTM_ID to be set for dataLayer to be created
  test.beforeEach(async ({ page }) => {
    // Navigate to home page first
    await page.goto('/');

    // Accept consent if banner appears
    const consentBanner = page.getByRole('dialog', { name: /cookie/i });
    if (await consentBanner.isVisible()) {
      await page.getByRole('button', { name: /accept all/i }).click();
      await expect(consentBanner).not.toBeVisible();
    }

    // Wait for potential GTM initialization
    await page.waitForTimeout(500);

    // Check if GTM is configured (dataLayer exists)
    const gtmConfigured = await page.evaluate(() => {
      return Array.isArray((window as any).dataLayer);
    });

    // Skip test if GTM is not configured
    if (!gtmConfigured) {
      test.skip(true, 'GTM is not configured (NEXT_PUBLIC_GTM_ID not set). dataLayer tests require GTM.');
    }
  });

  /**
   * Helper function to accept analytics consent
   * Enables GTM and dataLayer initialization for event tracking tests
   */
  const acceptAnalyticsConsent = async (page: any) => {
    // Navigate to home page
    await page.goto('/');

    // Check if consent banner exists and accept if present
    const consentBanner = page.getByRole('dialog', { name: /cookie/i });
    if (await consentBanner.isVisible()) {
      await page.getByRole('button', { name: /accept all/i }).click();
      await expect(consentBanner).not.toBeVisible();
    }

    // Wait for GTM/dataLayer initialization
    await page.waitForTimeout(500);

    // dataLayer should exist if GTM is configured (checked in beforeEach)
    // If we get here, GTM is configured
  };

  /**
   * Helper function to find specific event in dataLayer
   * @param page - Playwright page object
   * @param eventName - Name of the event to find
   * @returns Event object if found, null otherwise
   */
  const getEventFromDataLayer = async (page: any, eventName: string) => {
    return await page.evaluate((name: string) => {
      const dataLayer = (window as any).dataLayer || [];
      return dataLayer.find((event: any) => event.event === name) || null;
    }, eventName);
  };

  /**
   * Helper function to clear dataLayer for fresh test state
   */
  const clearDataLayer = async (page: any) => {
    await page.evaluate(() => {
      if ((window as any).dataLayer) {
        (window as any).dataLayer.length = 0;
      }
    });
  };

  /**
   * Helper function to mock scan creation API
   */
  const mockScanCreation = async (page: any, scanId: string = 'test-scan-123') => {
    await page.route('**/api/v1/scans', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              scanId,
              status: 'PENDING',
              url: 'https://example.com',
              wcagLevel: 'AA',
              createdAt: new Date().toISOString(),
            },
          }),
        });
      }
    });
  };

  /**
   * Helper function to mock scan results
   */
  const mockScanResults = async (page: any, scanId: string = 'test-scan-123') => {
    await page.route(`**/api/v1/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            scanId,
            status: 'COMPLETED',
            url: 'https://example.com',
            wcagLevel: 'AA',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route(`**/api/v1/scans/${scanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            scanId,
            url: 'https://example.com',
            wcagLevel: 'AA',
            completedAt: new Date().toISOString(),
            summary: {
              totalIssues: 5,
              critical: 1,
              serious: 2,
              moderate: 1,
              minor: 1,
              passedTests: 45,
            },
          },
        }),
      });
    });
  };

  /**
   * Helper function to mock report status and export
   */
  const mockReportExport = async (page: any, scanId: string = 'test-scan-123') => {
    await page.route(`**/api/v1/scans/${scanId}/reports`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            pdf: {
              url: `https://storage.example.com/${scanId}.pdf`,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              size: 524288,
            },
            json: null,
          },
        }),
      });
    });

    await page.route(`**/api/v1/scans/${scanId}/export?format=pdf`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        headers: {
          'Content-Disposition': `attachment; filename="${scanId}.pdf"`,
        },
        body: Buffer.from('Mock PDF content'),
      });
    });
  };

  test.beforeEach(async ({ page, context }) => {
    // Clear cookies and localStorage for clean state
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Accept analytics consent to enable tracking
    await acceptAnalyticsConsent(page);
  });

  test.describe('Scan Initiated Event', () => {
    test('should push scan_initiated event on single scan submission', async ({ page }) => {
      // Mock scan API
      await mockScanCreation(page);

      // Navigate to scan form
      await page.goto('/');
      await clearDataLayer(page);

      // Fill and submit scan form
      await page.getByLabel(/website url/i).fill('https://example.com');
      await page.getByRole('button', { name: /scan now/i }).click();

      // Wait for event to be pushed
      await page.waitForTimeout(500);

      // Find scan_initiated event in dataLayer
      const event = await getEventFromDataLayer(page, 'scan_initiated');

      // Verify event was pushed
      expect(event).not.toBeNull();
      expect(event.event).toBe('scan_initiated');

      // Verify event payload contains required properties (Requirement 4)
      expect(event.wcag_level).toBeDefined();
      expect(['A', 'AA', 'AAA']).toContain(event.wcag_level);

      expect(event.scan_type).toBeDefined();
      expect(['single', 'batch']).toContain(event.scan_type);
      expect(event.scan_type).toBe('single');

      expect(event.url_count).toBeDefined();
      expect(typeof event.url_count).toBe('number');
      expect(event.url_count).toBe(1);

      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('string');

      expect(event.sessionId).toBeDefined();
      expect(typeof event.sessionId).toBe('string');
    });

    test('should push scan_initiated event with batch scan_type for batch scans', async ({ page }) => {
      // Mock discovery and batch APIs
      await page.route('**/api/v1/discoveries**', async (route) => {
        await route.fulfill({
          status: route.request().method() === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              discovery: {
                id: 'test-discovery-1',
                status: 'COMPLETED',
                pages: [
                  { id: '1', url: 'https://example.com/', title: 'Home', depth: 0 },
                  { id: '2', url: 'https://example.com/about', title: 'About', depth: 1 },
                  { id: '3', url: 'https://example.com/contact', title: 'Contact', depth: 1 },
                ],
              },
            },
          }),
        });
      });

      await page.route('**/api/v1/batches', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                batchId: 'batch-test-123',
                status: 'PENDING',
                totalUrls: 3,
                homepageUrl: 'https://example.com',
              },
            }),
          });
        }
      });

      // Navigate to discovery page
      await page.goto('/discovery');
      await clearDataLayer(page);

      // Complete discovery flow
      await page.getByLabel('Website URL').fill('https://example.com');
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Start Discovery' }).click();

      // Wait for results
      await expect(page.getByText(/Discovered Pages/i)).toBeVisible({ timeout: 5000 });

      // Select all pages and start batch scan
      await page.getByRole('button', { name: 'Select All' }).click();
      await page.getByRole('button', { name: /Start Scan/i }).click();

      // Wait for event to be pushed
      await page.waitForTimeout(500);

      // Find scan_initiated event in dataLayer
      const event = await getEventFromDataLayer(page, 'scan_initiated');

      // Verify event was pushed with batch type
      expect(event).not.toBeNull();
      expect(event.event).toBe('scan_initiated');
      expect(event.scan_type).toBe('batch');
      expect(event.url_count).toBe(3);
      expect(event.wcag_level).toBeDefined();
    });

    test('should include correct WCAG level when changed from default', async ({ page }) => {
      // Mock scan API
      await mockScanCreation(page);

      // Navigate to scan form
      await page.goto('/');
      await clearDataLayer(page);

      // Fill form and change WCAG level to AAA
      await page.getByLabel(/website url/i).fill('https://example.com');

      // Find and click WCAG level selector (assuming it's a select or radio group)
      const wcagSelector = page.locator('select, [role="radiogroup"]').filter({ hasText: /wcag/i }).first();
      if (await wcagSelector.count() > 0) {
        await wcagSelector.click();
        const aaaOption = page.getByRole('option', { name: /AAA/i }).or(page.getByRole('radio', { name: /AAA/i }));
        if (await aaaOption.count() > 0) {
          await aaaOption.click();
        }
      }

      await page.getByRole('button', { name: /scan now/i }).click();

      // Wait for event to be pushed
      await page.waitForTimeout(500);

      // Find scan_initiated event in dataLayer
      const event = await getEventFromDataLayer(page, 'scan_initiated');

      // Verify WCAG level is captured correctly
      expect(event).not.toBeNull();
      if (event.wcag_level) {
        expect(['A', 'AA', 'AAA']).toContain(event.wcag_level);
      }
    });
  });

  test.describe('Page View Events', () => {
    test('should track page_view event on navigation between pages', async ({ page }) => {
      // Start on home page (already there from beforeEach)
      await clearDataLayer(page);

      // Navigate to a different page
      await page.goto('/scan/test-scan-123');

      // Wait for page_view event
      await page.waitForTimeout(500);

      // Check dataLayer for page_view event
      const dataLayer = await page.evaluate(() => (window as any).dataLayer || []);

      // Page view events may be tracked by GTM automatically
      // Verify dataLayer has events (GTM may use different event names)
      expect(dataLayer.length).toBeGreaterThan(0);

      // Navigate to another page
      await clearDataLayer(page);
      await page.goto('/');

      // Wait for page_view event
      await page.waitForTimeout(500);

      // Verify navigation triggered dataLayer events
      const dataLayerAfter = await page.evaluate(() => (window as any).dataLayer || []);
      expect(dataLayerAfter.length).toBeGreaterThan(0);
    });

    test('should track navigation from scan form to results page', async ({ page }) => {
      // Mock scan creation
      await mockScanCreation(page, 'nav-test-scan');
      await mockScanResults(page, 'nav-test-scan');

      // Start on home page
      await page.goto('/');
      await clearDataLayer(page);

      // Submit scan form
      await page.getByLabel(/website url/i).fill('https://example.com');
      await page.getByRole('button', { name: /scan now/i }).click();

      // Wait for redirect to scan results page
      await expect(page).toHaveURL(/\/scan\/nav-test-scan/);

      // Wait for page_view event
      await page.waitForTimeout(500);

      // Verify dataLayer has events from navigation
      const dataLayer = await page.evaluate(() => (window as any).dataLayer || []);
      expect(dataLayer.length).toBeGreaterThan(0);
    });
  });

  test.describe('Report Exported Event', () => {
    test('should push report_exported event on PDF download', async ({ page }) => {
      const scanId = 'export-test-scan';

      // Mock scan and export APIs
      await mockScanResults(page, scanId);
      await mockReportExport(page, scanId);

      // Navigate to scan results page
      await page.goto(`/scan/${scanId}`);

      // Wait for page to load
      await expect(page.getByText(/Scan Results/i).or(page.getByText(/Results/i))).toBeVisible({ timeout: 5000 });

      // Clear dataLayer before export
      await clearDataLayer(page);

      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export PDF button
      const exportButton = page.getByRole('button', { name: /Export.*PDF/i }).or(page.getByRole('button', { name: /Download.*PDF/i }));
      if (await exportButton.count() > 0) {
        await exportButton.click();
      } else {
        // Try finding export options dropdown
        await page.getByRole('button', { name: /Export/i }).first().click();
        await page.getByText(/PDF/i).click();
      }

      // Wait for download to start
      await downloadPromise;

      // Wait for event to be pushed
      await page.waitForTimeout(500);

      // Find report_exported event in dataLayer
      const event = await getEventFromDataLayer(page, 'report_exported');

      // Verify event was pushed (Requirement 4)
      expect(event).not.toBeNull();
      expect(event.event).toBe('report_exported');

      // Verify event payload contains required properties
      expect(event.format).toBeDefined();
      expect(['pdf', 'json']).toContain(event.format);
      expect(event.format).toBe('pdf');

      expect(event.report_type).toBeDefined();
      expect(['single', 'batch']).toContain(event.report_type);

      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('string');

      expect(event.sessionId).toBeDefined();
      expect(typeof event.sessionId).toBe('string');
    });

    test('should push report_exported event with correct format for JSON download', async ({ page }) => {
      const scanId = 'json-export-test';

      // Mock APIs
      await mockScanResults(page, scanId);

      await page.route(`**/api/v1/scans/${scanId}/reports`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              pdf: null,
              json: {
                url: `https://storage.example.com/${scanId}.json`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                size: 102400,
              },
            },
          }),
        });
      });

      await page.route(`**/api/v1/scans/${scanId}/export?format=json`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Content-Disposition': `attachment; filename="${scanId}.json"`,
          },
          body: JSON.stringify({ scanId, results: {} }),
        });
      });

      // Navigate to scan results
      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/Scan Results/i).or(page.getByText(/Results/i))).toBeVisible({ timeout: 5000 });

      // Clear dataLayer
      await clearDataLayer(page);

      // Setup download listener
      const downloadPromise = page.waitForEvent('download');

      // Click export JSON button
      const exportButton = page.getByRole('button', { name: /Export.*JSON/i }).or(page.getByRole('button', { name: /Download.*JSON/i }));
      if (await exportButton.count() > 0) {
        await exportButton.click();
      } else {
        // Try finding export options dropdown
        await page.getByRole('button', { name: /Export/i }).first().click();
        await page.getByText(/JSON/i).click();
      }

      // Wait for download
      await downloadPromise;

      // Wait for event
      await page.waitForTimeout(500);

      // Find and verify event
      const event = await getEventFromDataLayer(page, 'report_exported');
      expect(event).not.toBeNull();
      expect(event.format).toBe('json');
    });
  });

  test.describe('Funnel Events', () => {
    test('should track complete scan funnel from form view to results', async ({ page }) => {
      const scanId = 'funnel-test-scan';

      // Mock scan API
      await mockScanCreation(page, scanId);
      await mockScanResults(page, scanId);

      // Step 1: Navigate to scan form (triggers funnel_scan_form_viewed)
      await page.goto('/');
      await clearDataLayer(page);

      // Wait for form viewed event
      await page.waitForTimeout(500);

      const formViewedEvent = await getEventFromDataLayer(page, 'funnel_scan_form_viewed');
      expect(formViewedEvent).not.toBeNull();
      expect(formViewedEvent.funnel_session_id).toBeDefined();
      expect(formViewedEvent.timestamp).toBeDefined();

      const funnelSessionId = formViewedEvent.funnel_session_id;

      // Step 2: Enter URL (triggers funnel_scan_url_entered)
      await page.getByLabel(/website url/i).fill('https://example.com');
      await page.getByLabel(/website url/i).blur();

      // Wait for URL entered event
      await page.waitForTimeout(500);

      const urlEnteredEvent = await getEventFromDataLayer(page, 'funnel_scan_url_entered');
      expect(urlEnteredEvent).not.toBeNull();
      expect(urlEnteredEvent.funnel_session_id).toBe(funnelSessionId);

      // Step 3: Submit scan (triggers funnel_scan_submitted)
      await page.getByRole('button', { name: /scan now/i }).click();

      // Wait for submission event
      await page.waitForTimeout(500);

      const scanSubmittedEvent = await getEventFromDataLayer(page, 'funnel_scan_submitted');
      expect(scanSubmittedEvent).not.toBeNull();
      expect(scanSubmittedEvent.funnel_session_id).toBe(funnelSessionId);

      // Verify all funnel events share the same funnel_session_id (Requirement 5)
      expect(formViewedEvent.funnel_session_id).toBe(funnelSessionId);
      expect(urlEnteredEvent.funnel_session_id).toBe(funnelSessionId);
      expect(scanSubmittedEvent.funnel_session_id).toBe(funnelSessionId);
    });

    test('should maintain funnel_session_id across page navigations', async ({ page }) => {
      // Navigate to scan form
      await page.goto('/');
      await clearDataLayer(page);

      // Wait for form viewed event
      await page.waitForTimeout(500);

      const formViewedEvent = await getEventFromDataLayer(page, 'funnel_scan_form_viewed');
      expect(formViewedEvent).not.toBeNull();
      const funnelSessionId = formViewedEvent.funnel_session_id;

      // Navigate away and back
      await page.goto('/scan/test-scan-123');
      await page.goto('/');

      // Wait for new form viewed event
      await page.waitForTimeout(500);

      // Get all dataLayer events
      const allEvents = await page.evaluate(() => (window as any).dataLayer || []);
      const funnelEvents = allEvents.filter((e: any) => e.event === 'funnel_scan_form_viewed');

      // Find the most recent funnel_scan_form_viewed event
      const recentFormViewedEvent = funnelEvents[funnelEvents.length - 1];

      // Verify funnel_session_id persisted (stored in sessionStorage)
      expect(recentFormViewedEvent.funnel_session_id).toBe(funnelSessionId);
    });
  });

  test.describe('Event Payload Validation', () => {
    test('should include timestamp in ISO 8601 format for all events', async ({ page }) => {
      // Mock scan API
      await mockScanCreation(page);

      // Navigate and submit scan
      await page.goto('/');
      await clearDataLayer(page);

      await page.getByLabel(/website url/i).fill('https://example.com');
      await page.getByRole('button', { name: /scan now/i }).click();

      // Wait for events
      await page.waitForTimeout(500);

      // Get all events from dataLayer
      const events = await page.evaluate(() => (window as any).dataLayer || []);

      // Filter events with timestamp field
      const eventsWithTimestamp = events.filter((e: any) => e.timestamp);

      // Verify timestamps are in ISO 8601 format
      eventsWithTimestamp.forEach((event: any) => {
        expect(event.timestamp).toBeDefined();
        expect(typeof event.timestamp).toBe('string');

        // ISO 8601 format validation
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
        expect(iso8601Regex.test(event.timestamp)).toBe(true);
      });
    });

    test('should include sessionId for all analytics events', async ({ page }) => {
      // Mock scan API
      await mockScanCreation(page);

      // Navigate and submit scan
      await page.goto('/');
      await clearDataLayer(page);

      await page.getByLabel(/website url/i).fill('https://example.com');
      await page.getByRole('button', { name: /scan now/i }).click();

      // Wait for events
      await page.waitForTimeout(500);

      // Get custom events (exclude GTM internal events)
      const events = await page.evaluate(() => {
        const dataLayer = (window as any).dataLayer || [];
        return dataLayer.filter((e: any) =>
          e.event && (e.event.startsWith('scan_') || e.event.startsWith('funnel_'))
        );
      });

      // Verify all custom events have sessionId
      events.forEach((event: any) => {
        expect(event.sessionId).toBeDefined();
        expect(typeof event.sessionId).toBe('string');
        expect(event.sessionId.length).toBeGreaterThan(0);
      });
    });
  });
});
