import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Scan Console (Public View)
 *
 * Tests the real-time scan console functionality:
 * 1. Console appears when scan starts
 * 2. Events appear in real-time
 * 3. Console persists after scan completion
 * 4. Collapse/expand functionality works correctly
 * 5. Event filtering (admin-only events are hidden)
 * 6. Auto-scroll behavior
 *
 * Coverage:
 * - Requirements 1.1-1.9: Console visibility and event streaming
 * - Requirements 5.1-5.3: Collapse/expand interactions
 *
 * @see apps/web/src/components/features/scan/ScanConsole.tsx
 */

test.describe('Scan Console - Public View', () => {
  // Helper function to mock scan events API
  const mockScanEventsAPI = async (page: any, scanId: string, events: any[] = []) => {
    await page.route(`**/api/scans/${scanId}/events`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events }),
      });
    });
  };

  // Helper function to create a mock scan event
  const createEvent = (
    eventType: string,
    message: string,
    metadata: any = {},
    adminOnly: boolean = false
  ) => ({
    id: `event-${Date.now()}-${Math.random()}`,
    scanId: 'test-scan-123',
    eventType,
    message,
    metadata,
    adminOnly,
    timestamp: new Date().toISOString(),
  });

  test.beforeEach(async ({ page }) => {
    // Mock reCAPTCHA for form submissions
    await page.addInitScript(() => {
      (window as any).grecaptcha = {
        ready: (callback: () => void) => callback(),
        execute: () => Promise.resolve('mock-recaptcha-token'),
      };
    });
  });

  test('should display console when scan starts', async ({ page }) => {
    const scanId = 'test-scan-console-visible';

    // Mock scan creation API
    await page.route('**/api/scans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'PENDING',
          url: 'https://example.com',
          wcagLevel: 'AA',
        }),
      });
    });

    // Mock scan status API (running)
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          progress: 50,
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    // Mock empty events initially
    await mockScanEventsAPI(page, scanId, []);

    // Navigate to home and submit scan
    await page.goto('/');
    await page.getByLabel(/website url/i).fill('https://example.com');
    await page.getByRole('button', { name: /scan website/i }).click();

    // Wait for navigation to scan page
    await page.waitForURL(`/scan/${scanId}`);

    // Console should be visible
    await expect(page.getByText(/scan console/i)).toBeVisible();
    await expect(page.getByText(`ID: ${scanId.slice(0, 8)}`)).toBeVisible();

    // Terminal icon should be visible
    await expect(page.locator('[aria-label*="Scan Console"]').first()).toBeVisible();
  });

  test('should display events in real-time', async ({ page }) => {
    const scanId = 'test-scan-events';

    // Initial events
    const initialEvents = [
      createEvent('SCAN_INIT', 'Scan initialized'),
      createEvent('FETCH_START', 'Fetching URL: https://example.com'),
    ];

    // Mock scan status
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          progress: 50,
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    // Mock events API with progressive updates
    let callCount = 0;
    await page.route(`**/api/scans/${scanId}/events`, async (route) => {
      callCount++;

      // First call: 2 events
      if (callCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ events: initialEvents }),
        });
      }
      // Second call: 4 events (2 new)
      else if (callCount === 2) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [
              ...initialEvents,
              createEvent('PAGE_LOAD', 'Page loaded successfully'),
              createEvent('ANALYSIS_START', 'Starting accessibility analysis'),
            ],
          }),
        });
      }
      // Third call: 5 events (1 new)
      else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [
              ...initialEvents,
              createEvent('PAGE_LOAD', 'Page loaded successfully'),
              createEvent('ANALYSIS_START', 'Starting accessibility analysis'),
              createEvent('ANALYSIS_COMPLETE', 'Analysis complete'),
            ],
          }),
        });
      }
    });

    await page.goto(`/scan/${scanId}`);

    // Wait for initial events to appear
    await expect(page.getByText('Scan initialized')).toBeVisible();
    await expect(page.getByText(/Fetching URL/i)).toBeVisible();

    // Wait for additional events (polling should fetch them)
    await expect(page.getByText('Page loaded successfully')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Starting accessibility analysis')).toBeVisible({ timeout: 5000 });
  });

  test('should filter out admin-only events in public view', async ({ page }) => {
    const scanId = 'test-scan-admin-filter';

    // Events with mix of public and admin-only
    const events = [
      createEvent('SCAN_INIT', 'Scan initialized', {}, false),
      createEvent('INTERNAL_QUEUE', 'Added to processing queue', { queueId: 'queue-123' }, true),
      createEvent('FETCH_START', 'Fetching URL', {}, false),
      createEvent('WORKER_ASSIGNED', 'Worker assigned: worker-5', { workerId: 5 }, true),
      createEvent('PAGE_LOAD', 'Page loaded', {}, false),
    ];

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
          wcagLevel: 'AA',
        }),
      });
    });

    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/scan/${scanId}`);

    // Public events should be visible
    await expect(page.getByText('Scan initialized')).toBeVisible();
    await expect(page.getByText('Fetching URL')).toBeVisible();
    await expect(page.getByText('Page loaded')).toBeVisible();

    // Admin-only events should NOT be visible
    await expect(page.getByText('Added to processing queue')).not.toBeVisible();
    await expect(page.getByText(/Worker assigned/i)).not.toBeVisible();
  });

  test('should persist console after scan completion', async ({ page }) => {
    const scanId = 'test-scan-completed';

    const completedEvents = [
      createEvent('SCAN_INIT', 'Scan initialized'),
      createEvent('FETCH_START', 'Fetching URL'),
      createEvent('PAGE_LOAD', 'Page loaded'),
      createEvent('ANALYSIS_START', 'Starting analysis'),
      createEvent('ANALYSIS_COMPLETE', 'Analysis complete'),
      createEvent('SCAN_COMPLETE', 'Scan completed successfully'),
    ];

    // Mock completed scan
    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'COMPLETED',
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }),
      });
    });

    await mockScanEventsAPI(page, scanId, completedEvents);

    // Mock results to prevent redirect
    await page.route(`**/api/scans/${scanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          url: 'https://example.com',
          wcagLevel: 'AA',
          completedAt: new Date().toISOString(),
          summary: {
            totalIssues: 0,
            critical: 0,
            serious: 0,
            moderate: 0,
            minor: 0,
            passedTests: 50,
            wcagCompliance: { levelA: 100, levelAA: 100, levelAAA: 100 },
          },
          issuesByImpact: {
            critical: [],
            serious: [],
            moderate: [],
            minor: [],
          },
        }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Console should still be visible after completion
    await expect(page.getByText(/scan console/i)).toBeVisible();

    // All events should be visible
    await expect(page.getByText('Scan initialized')).toBeVisible();
    await expect(page.getByText('Scan completed successfully')).toBeVisible();

    // Verify event count in collapsed summary
    await page.getByRole('button', { name: /collapse console/i }).click();
    await expect(page.getByText(/6 events/i)).toBeVisible();
  });

  test('should collapse and expand console correctly', async ({ page }) => {
    const scanId = 'test-scan-collapse';

    const events = [
      createEvent('SCAN_INIT', 'Scan initialized'),
      createEvent('FETCH_START', 'Fetching URL'),
      createEvent('PAGE_LOAD', 'Page loaded'),
    ];

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
          wcagLevel: 'AA',
        }),
      });
    });

    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/scan/${scanId}`);

    // Console should be expanded by default
    const consoleContent = page.locator('#scan-console-content');
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'false');

    // All events should be visible when expanded
    await expect(page.getByText('Scan initialized')).toBeVisible();
    await expect(page.getByText('Fetching URL')).toBeVisible();
    await expect(page.getByText('Page loaded')).toBeVisible();

    // Click to collapse
    await page.getByRole('button', { name: /collapse console/i }).click();

    // Console content should be collapsed
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'true');

    // Should show collapsed summary
    await expect(page.getByText(/3 events/i)).toBeVisible();
    await expect(page.getByText('Page loaded')).toBeVisible(); // Last message shown

    // Event details should not be visible in collapsed state
    const eventMessages = page.getByText('Scan initialized');
    await expect(eventMessages).not.toBeInViewport();

    // Click to expand again
    await page.getByRole('button', { name: /expand console/i }).click();

    // Console should be expanded again
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByText('Scan initialized')).toBeVisible();
  });

  test('should toggle console using keyboard', async ({ page }) => {
    const scanId = 'test-scan-keyboard';

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
        }),
      });
    });

    await mockScanEventsAPI(page, scanId, [
      createEvent('SCAN_INIT', 'Scan initialized'),
    ]);

    await page.goto(`/scan/${scanId}`);

    const consoleHeader = page.locator('[role="button"][aria-expanded]');
    const consoleContent = page.locator('#scan-console-content');

    // Focus the header
    await consoleHeader.focus();

    // Initially expanded
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'false');

    // Press Enter to collapse
    await consoleHeader.press('Enter');
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'true');

    // Press Space to expand
    await consoleHeader.press(' ');
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'false');

    // Press Enter to collapse again
    await consoleHeader.press('Enter');
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'true');
  });

  test('should display empty state when no events', async ({ page }) => {
    const scanId = 'test-scan-no-events';

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          status: 'PENDING',
          url: 'https://example.com',
        }),
      });
    });

    // No events yet
    await mockScanEventsAPI(page, scanId, []);

    await page.goto(`/scan/${scanId}`);

    // Should show empty state message
    await expect(page.getByText(/no events yet/i)).toBeVisible();
    await expect(page.getByText(/waiting for scan to start/i)).toBeVisible();
  });

  test('should handle events API error gracefully', async ({ page }) => {
    const scanId = 'test-scan-error';

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
        }),
      });
    });

    // Mock events API error
    await page.route(`**/api/scans/${scanId}/events`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Should show error state
    await expect(page.getByText(/failed to load events/i)).toBeVisible();
  });

  test('should limit display to 50 most recent events', async ({ page }) => {
    const scanId = 'test-scan-many-events';

    // Create 60 events
    const manyEvents = Array.from({ length: 60 }, (_, i) =>
      createEvent(`EVENT_${i}`, `Event message ${i + 1}`, {}, false)
    );

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
        }),
      });
    });

    await mockScanEventsAPI(page, scanId, manyEvents);

    await page.goto(`/scan/${scanId}`);

    // First 10 events should NOT be visible (only last 50 are displayed)
    await expect(page.getByText('Event message 1')).not.toBeVisible();
    await expect(page.getByText('Event message 10')).not.toBeVisible();

    // Last events should be visible
    await expect(page.getByText('Event message 60')).toBeVisible();
    await expect(page.getByText('Event message 59')).toBeVisible();

    // Collapsed view should show "50 events"
    await page.getByRole('button', { name: /collapse console/i }).click();
    await expect(page.getByText(/50 events/i)).toBeVisible();
  });

  test('should display loading state initially', async ({ page }) => {
    const scanId = 'test-scan-loading';

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
        }),
      });
    });

    // Delay events API response
    await page.route(`**/api/scans/${scanId}/events`, async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ events: [] }),
      });
    });

    await page.goto(`/scan/${scanId}`);

    // Should show loading state briefly
    await expect(page.getByText(/loading events/i)).toBeVisible();
  });

  test('should show scan ID in console header', async ({ page }) => {
    const scanId = 'test-scan-id-display-12345';

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
        }),
      });
    });

    await mockScanEventsAPI(page, scanId, []);

    await page.goto(`/scan/${scanId}`);

    // Should show first 8 characters of scan ID
    await expect(page.getByText(`ID: ${scanId.slice(0, 8)}`)).toBeVisible();
  });

  test('should update collapsed summary with latest event', async ({ page }) => {
    const scanId = 'test-scan-summary';

    const events = [
      createEvent('SCAN_INIT', 'Scan initialized'),
      createEvent('FETCH_START', 'Fetching URL'),
      createEvent('PAGE_LOAD', 'This is the latest event message'),
    ];

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
        }),
      });
    });

    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/scan/${scanId}`);

    // Collapse the console
    await page.getByRole('button', { name: /collapse console/i }).click();

    // Summary should show event count and latest message
    await expect(page.getByText(/3 events/i)).toBeVisible();
    await expect(page.getByText('This is the latest event message')).toBeVisible();
  });

  test('should handle single event correctly', async ({ page }) => {
    const scanId = 'test-scan-single-event';

    await page.route(`**/api/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          scanId,
          status: 'RUNNING',
          url: 'https://example.com',
        }),
      });
    });

    await mockScanEventsAPI(page, scanId, [
      createEvent('SCAN_INIT', 'Scan initialized'),
    ]);

    await page.goto(`/scan/${scanId}`);

    // Collapse console
    await page.getByRole('button', { name: /collapse console/i }).click();

    // Should say "1 event" (singular)
    await expect(page.getByText(/1 event/i)).toBeVisible();
    await expect(page.getByText(/events/i)).not.toBeVisible(); // Should not say "events" (plural)
  });
});
