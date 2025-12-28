import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Admin Scan Console
 *
 * PREREQUISITE: Dev server must be running on http://localhost:3001
 * Run: npm run dev (from apps/web directory)
 *
 * Tests the admin-specific scan console functionality:
 * 1. Admin can access scan detail page
 * 2. Admin console appears with DEBUG events
 * 3. View toggle works (Full View / User View)
 * 4. Admin-only events visible in Full View
 * 5. Admin-only events hidden in User View
 * 6. Admin-only events have purple background
 * 7. Copy log functionality works
 * 8. Metadata expansion works (admin feature)
 *
 * Coverage:
 * - Requirements 4.1: Display AdminScanConsole on admin scan detail page
 * - Requirements 4.2: Show all events including DEBUG level
 * - Requirements 4.3: Show admin-only events (adminOnly: true)
 * - Requirements 4.4: Enable metadata expansion toggle
 * - Requirements 4.5: View mode toggle (Full View / User View)
 * - Requirements 4.6: Purple background for admin-only events
 * - Requirements 4.7: Copy log to clipboard functionality
 * - Requirements 4.8: Auto-expand console by default
 *
 * @see apps/web/src/components/admin/ScanConsole.tsx
 * @see apps/web/src/app/admin/scans/[id]/page.tsx
 */

test.describe('Admin Scan Console', () => {
  // Helper function to mock admin authentication
  const mockAdminAuth = async (page: any) => {
    // Mock admin session/authentication
    // In a real app, this would set cookies or localStorage for admin authentication
    await page.addInitScript(() => {
      // Mock admin session
      (window as any).__ADMIN_SESSION__ = {
        isAdmin: true,
        userId: 'admin-user-123',
        email: 'admin@example.com',
      };
    });
  };

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
    level: 'DEBUG' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
    message: string,
    metadata: any = {},
    adminOnly: boolean = false
  ) => ({
    id: `event-${Date.now()}-${Math.random()}`,
    scanId: 'test-scan-123',
    level,
    message,
    metadata,
    adminOnly,
    createdAt: new Date().toISOString(),
  });

  // Helper function to mock scan details API
  const mockScanDetailsAPI = async (page: any, scanId: string, status: string = 'RUNNING') => {
    await page.route(`**/api/admin/scans/${scanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: scanId,
          url: 'https://example.com',
          status,
          wcagLevel: 'AA',
          email: 'user@example.com',
          createdAt: new Date().toISOString(),
          completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
          scanResult: status === 'COMPLETED' ? {
            id: 'result-123',
            totalIssues: 5,
            criticalCount: 1,
            seriousCount: 2,
            moderateCount: 1,
            minorCount: 1,
            passedChecks: 45,
            inapplicableChecks: 10,
            createdAt: new Date().toISOString(),
            issues: [],
          } : null,
        }),
      });
    });
  };

  test.beforeEach(async ({ page }) => {
    // Mock admin authentication for all tests
    await mockAdminAuth(page);
  });

  test('should display admin console with DEBUG events', async ({ page }) => {
    const scanId = 'test-scan-admin-debug';

    // Events with DEBUG level (admin-only level)
    const events = [
      createEvent('DEBUG', 'Internal debug message', { debugInfo: 'test' }, false),
      createEvent('INFO', 'Scan initialized', {}, false),
      createEvent('DEBUG', 'Queue processing started', { queueId: 'queue-123' }, false),
      createEvent('SUCCESS', 'Page loaded', {}, false),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Admin console should be visible
    await expect(page.getByText('Admin Scan Console')).toBeVisible();
    await expect(page.getByText(`ID: ${scanId.slice(0, 8)}`)).toBeVisible();

    // Admin badge should be visible
    await expect(page.getByText('ADMIN')).toBeVisible();

    // DEBUG events should be visible
    await expect(page.getByText('Internal debug message')).toBeVisible();
    await expect(page.getByText('Queue processing started')).toBeVisible();

    // DEBUG badges should be visible
    const debugBadges = page.locator('span:has-text("DEBUG")');
    await expect(debugBadges).toHaveCount(2);
  });

  test('should display admin-only events in Full View', async ({ page }) => {
    const scanId = 'test-scan-admin-events';

    // Mix of public and admin-only events
    const events = [
      createEvent('INFO', 'Scan initialized', {}, false),
      createEvent('DEBUG', 'Worker assigned: worker-5', { workerId: 5 }, true),
      createEvent('INFO', 'Fetching URL', {}, false),
      createEvent('DEBUG', 'Queue position: 3', { position: 3 }, true),
      createEvent('SUCCESS', 'Page loaded', {}, false),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Should be in Full View by default
    await expect(page.getByRole('button', { name: 'Switch to full view' })).toHaveAttribute('aria-pressed', 'true');

    // All events should be visible (including admin-only)
    await expect(page.getByText('Scan initialized')).toBeVisible();
    await expect(page.getByText('Worker assigned: worker-5')).toBeVisible();
    await expect(page.getByText('Fetching URL')).toBeVisible();
    await expect(page.getByText('Queue position: 3')).toBeVisible();
    await expect(page.getByText('Page loaded')).toBeVisible();
  });

  test('should hide admin-only events in User View', async ({ page }) => {
    const scanId = 'test-scan-user-view';

    // Mix of public and admin-only events
    const events = [
      createEvent('INFO', 'Scan initialized', {}, false),
      createEvent('DEBUG', 'Worker assigned: worker-5', { workerId: 5 }, true),
      createEvent('INFO', 'Fetching URL', {}, false),
      createEvent('DEBUG', 'Queue position: 3', { position: 3 }, true),
      createEvent('SUCCESS', 'Page loaded', {}, false),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Click User View button
    await page.getByRole('button', { name: 'Switch to user view' }).click();

    // User View button should be active
    await expect(page.getByRole('button', { name: 'Switch to user view' })).toHaveAttribute('aria-pressed', 'true');

    // Public events should be visible
    await expect(page.getByText('Scan initialized')).toBeVisible();
    await expect(page.getByText('Fetching URL')).toBeVisible();
    await expect(page.getByText('Page loaded')).toBeVisible();

    // Admin-only events should NOT be visible
    await expect(page.getByText('Worker assigned: worker-5')).not.toBeVisible();
    await expect(page.getByText('Queue position: 3')).not.toBeVisible();
  });

  test('should toggle between Full View and User View', async ({ page }) => {
    const scanId = 'test-scan-view-toggle';

    const events = [
      createEvent('INFO', 'Public event 1', {}, false),
      createEvent('DEBUG', 'Admin event 1', {}, true),
      createEvent('INFO', 'Public event 2', {}, false),
      createEvent('DEBUG', 'Admin event 2', {}, true),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Initially in Full View - all 4 events visible
    await expect(page.getByText('Public event 1')).toBeVisible();
    await expect(page.getByText('Admin event 1')).toBeVisible();
    await expect(page.getByText('Public event 2')).toBeVisible();
    await expect(page.getByText('Admin event 2')).toBeVisible();

    // Switch to User View
    await page.getByRole('button', { name: 'Switch to user view' }).click();

    // Only public events visible
    await expect(page.getByText('Public event 1')).toBeVisible();
    await expect(page.getByText('Public event 2')).toBeVisible();
    await expect(page.getByText('Admin event 1')).not.toBeVisible();
    await expect(page.getByText('Admin event 2')).not.toBeVisible();

    // Switch back to Full View
    await page.getByRole('button', { name: 'Switch to full view' }).click();

    // All events visible again
    await expect(page.getByText('Public event 1')).toBeVisible();
    await expect(page.getByText('Admin event 1')).toBeVisible();
    await expect(page.getByText('Public event 2')).toBeVisible();
    await expect(page.getByText('Admin event 2')).toBeVisible();
  });

  test('should display admin-only events with purple background', async ({ page }) => {
    const scanId = 'test-scan-purple-background';

    const events = [
      createEvent('INFO', 'Regular event', {}, false),
      createEvent('DEBUG', 'Admin-only event', {}, true),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Find the admin-only event container
    const adminEventContainer = page.locator('[role="log"]:has-text("Admin-only event")');

    // Check if it has purple background classes
    const classList = await adminEventContainer.getAttribute('class');
    expect(classList).toContain('bg-purple-900/20');
    expect(classList).toContain('hover:bg-purple-900/30');

    // Regular event should not have purple background
    const regularEventContainer = page.locator('[role="log"]:has-text("Regular event")');
    const regularClassList = await regularEventContainer.getAttribute('class');
    expect(regularClassList).not.toContain('bg-purple-900/20');
  });

  test('should copy log to clipboard', async ({ page }) => {
    const scanId = 'test-scan-copy-log';

    const events = [
      createEvent('INFO', 'First event', {}, false),
      createEvent('DEBUG', 'Second event', {}, true),
      createEvent('SUCCESS', 'Third event', {}, false),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto(`/admin/scans/${scanId}`);

    // Click the copy button
    await page.getByRole('button', { name: 'Copy log to clipboard' }).click();

    // Should show "Copied!" feedback
    await expect(page.getByText('Copied!')).toBeVisible();

    // Get clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // Verify clipboard contains all events
    expect(clipboardText).toContain('INFO: First event');
    expect(clipboardText).toContain('[ADMIN] DEBUG: Second event');
    expect(clipboardText).toContain('SUCCESS: Third event');

    // Success message should disappear after 2 seconds
    await expect(page.getByText('Copied!')).not.toBeVisible({ timeout: 3000 });
  });

  test('should update event count in User View when toggling', async ({ page }) => {
    const scanId = 'test-scan-event-count';

    const events = [
      createEvent('INFO', 'Public 1', {}, false),
      createEvent('INFO', 'Public 2', {}, false),
      createEvent('DEBUG', 'Admin 1', {}, true),
      createEvent('DEBUG', 'Admin 2', {}, true),
      createEvent('DEBUG', 'Admin 3', {}, true),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Collapse console to see event count
    await page.getByRole('button', { name: 'Collapse console' }).click();

    // Should show 5 events in Full View
    await expect(page.getByText(/5 events/i)).toBeVisible();

    // Expand console
    await page.getByRole('button', { name: 'Expand console' }).click();

    // Switch to User View
    await page.getByRole('button', { name: 'Switch to user view' }).click();

    // Collapse again
    await page.getByRole('button', { name: 'Collapse console' }).click();

    // Should show 2 events in User View (only public events)
    await expect(page.getByText(/2 events/i)).toBeVisible();
  });

  test('should enable metadata expansion for admin', async ({ page }) => {
    const scanId = 'test-scan-metadata';

    const events = [
      createEvent('DEBUG', 'Event with metadata', {
        workerId: 5,
        queuePosition: 3,
        retryCount: 0
      }, true),
      createEvent('INFO', 'Event without metadata', {}, false),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Find the event with metadata
    const eventWithMetadata = page.locator('[role="log"]:has-text("Event with metadata")');

    // Should have metadata toggle button
    const metadataButton = eventWithMetadata.getByRole('button', { name: /metadata/i });
    await expect(metadataButton).toBeVisible();

    // Click to expand metadata
    await metadataButton.click();

    // Metadata should be visible
    await expect(eventWithMetadata.getByText('"workerId": 5')).toBeVisible();
    await expect(eventWithMetadata.getByText('"queuePosition": 3')).toBeVisible();
    await expect(eventWithMetadata.getByText('"retryCount": 0')).toBeVisible();

    // Click to collapse metadata
    await metadataButton.click();

    // Metadata should be hidden
    await expect(eventWithMetadata.getByText('"workerId": 5')).not.toBeVisible();
  });

  test('should auto-expand console by default', async ({ page }) => {
    const scanId = 'test-scan-auto-expand';

    const events = [
      createEvent('INFO', 'Scan initialized', {}, false),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Console content should be visible (not collapsed)
    const consoleContent = page.locator('#admin-scan-console-content');
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'false');

    // Events should be visible
    await expect(page.getByText('Scan initialized')).toBeVisible();
  });

  test('should collapse and expand console correctly', async ({ page }) => {
    const scanId = 'test-scan-collapse-expand';

    const events = [
      createEvent('INFO', 'Event 1', {}, false),
      createEvent('DEBUG', 'Event 2', {}, true),
      createEvent('SUCCESS', 'Event 3', {}, false),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    const consoleContent = page.locator('#admin-scan-console-content');

    // Initially expanded
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByText('Event 1')).toBeVisible();

    // Collapse
    await page.getByRole('button', { name: 'Collapse console' }).click();
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'true');

    // Should show summary
    await expect(page.getByText(/3 events/i)).toBeVisible();

    // Expand again
    await page.getByRole('button', { name: 'Expand console' }).click();
    await expect(consoleContent).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByText('Event 1')).toBeVisible();
  });

  test('should disable copy button when no events', async ({ page }) => {
    const scanId = 'test-scan-no-events-copy';

    await mockScanDetailsAPI(page, scanId, 'PENDING');
    await mockScanEventsAPI(page, scanId, []);

    await page.goto(`/admin/scans/${scanId}`);

    // Copy button should be disabled
    const copyButton = page.getByRole('button', { name: 'Copy log to clipboard' });
    await expect(copyButton).toBeDisabled();
  });

  test('should display empty state when no events', async ({ page }) => {
    const scanId = 'test-scan-empty-state';

    await mockScanDetailsAPI(page, scanId, 'PENDING');
    await mockScanEventsAPI(page, scanId, []);

    await page.goto(`/admin/scans/${scanId}`);

    // Should show empty state
    await expect(page.getByText(/no events yet/i)).toBeVisible();
    await expect(page.getByText(/waiting for scan to start/i)).toBeVisible();
  });

  test('should handle error loading events', async ({ page }) => {
    const scanId = 'test-scan-error';

    await mockScanDetailsAPI(page, scanId, 'RUNNING');

    // Mock error response
    await page.route(`**/api/scans/${scanId}/events`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto(`/admin/scans/${scanId}`);

    // Should show error state
    await expect(page.getByText(/failed to load events/i)).toBeVisible();
  });

  test('should show scan ID in console header', async ({ page }) => {
    const scanId = 'test-scan-id-display-123456';

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, []);

    await page.goto(`/admin/scans/${scanId}`);

    // Should show first 8 characters of scan ID
    await expect(page.getByText(`ID: ${scanId.slice(0, 8)}`)).toBeVisible();
  });

  test('should persist view mode when toggling collapse', async ({ page }) => {
    const scanId = 'test-scan-persist-view';

    const events = [
      createEvent('INFO', 'Public event', {}, false),
      createEvent('DEBUG', 'Admin event', {}, true),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Switch to User View
    await page.getByRole('button', { name: 'Switch to user view' }).click();
    await expect(page.getByText('Admin event')).not.toBeVisible();

    // Collapse console
    await page.getByRole('button', { name: 'Collapse console' }).click();

    // Expand console
    await page.getByRole('button', { name: 'Expand console' }).click();

    // Should still be in User View (admin event should not be visible)
    await expect(page.getByText('Public event')).toBeVisible();
    await expect(page.getByText('Admin event')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch to user view' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('should display loading state initially', async ({ page }) => {
    const scanId = 'test-scan-loading';

    await mockScanDetailsAPI(page, scanId, 'RUNNING');

    // Delay events API response
    await page.route(`**/api/scans/${scanId}/events`, async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      });
    });

    await page.goto(`/admin/scans/${scanId}`);

    // Should show loading state briefly
    await expect(page.getByText(/loading events/i)).toBeVisible();
  });

  test('should update collapsed summary with latest event message', async ({ page }) => {
    const scanId = 'test-scan-summary-message';

    const events = [
      createEvent('INFO', 'First event', {}, false),
      createEvent('DEBUG', 'Second event', {}, true),
      createEvent('SUCCESS', 'This is the latest event message', {}, false),
    ];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, events);

    await page.goto(`/admin/scans/${scanId}`);

    // Collapse console
    await page.getByRole('button', { name: 'Collapse console' }).click();

    // Summary should show latest message
    await expect(page.getByText('This is the latest event message')).toBeVisible();
  });

  test('should show correct event count with singular/plural', async ({ page }) => {
    const scanId = 'test-scan-singular-plural';

    // Start with single event
    const singleEvent = [createEvent('INFO', 'Single event', {}, false)];

    await mockScanDetailsAPI(page, scanId, 'RUNNING');
    await mockScanEventsAPI(page, scanId, singleEvent);

    await page.goto(`/admin/scans/${scanId}`);

    // Collapse console
    await page.getByRole('button', { name: 'Collapse console' }).click();

    // Should say "1 event" (singular)
    await expect(page.getByText(/1 event/i)).toBeVisible();

    // Add more events by re-mocking
    const multipleEvents = [
      createEvent('INFO', 'Event 1', {}, false),
      createEvent('INFO', 'Event 2', {}, false),
      createEvent('INFO', 'Event 3', {}, false),
    ];

    await mockScanEventsAPI(page, scanId, multipleEvents);

    // Wait for polling to update
    await page.waitForTimeout(2500);

    // Should say "3 events" (plural)
    await expect(page.getByText(/3 events/i)).toBeVisible();
  });
});
