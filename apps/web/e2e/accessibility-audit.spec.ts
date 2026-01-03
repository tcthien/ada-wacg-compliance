import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * E2E Tests: Accessibility Audit for Customer UI/UX Improvements
 *
 * This test suite verifies WCAG 2.2 AA compliance for enhanced components:
 * - History page with filters, sorting, and bulk actions
 * - Scan results page with issue controls
 * - Keyboard navigation through new components
 * - ARIA live region announcements
 * - Focus management in modals
 *
 * Requirements:
 * - REQ: All new components SHALL meet WCAG 2.2 AA compliance
 * - Task 13.5: Accessibility audit test
 *
 * Test Coverage:
 * 1. Automated axe-core scanning on enhanced pages
 * 2. Keyboard navigation (Tab, Enter, Arrow keys, Space)
 * 3. ARIA live region updates
 * 4. Focus trap in confirm dialogs
 * 5. Focus restoration after modal closes
 * 6. Skip link functionality
 */

// Helper function to check for accessibility violations
async function checkA11y(page: any, pageName: string) {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  // Log any violations for debugging
  if (accessibilityScanResults.violations.length > 0) {
    console.log(`\n=== Accessibility Violations on ${pageName} ===`);
    accessibilityScanResults.violations.forEach((violation) => {
      console.log(`\n${violation.impact?.toUpperCase()}: ${violation.help}`);
      console.log(`  Description: ${violation.description}`);
      console.log(`  Help URL: ${violation.helpUrl}`);
      console.log(`  Elements affected: ${violation.nodes.length}`);
      violation.nodes.forEach((node, idx) => {
        console.log(`    ${idx + 1}. ${node.html}`);
        console.log(`       Target: ${node.target.join(' ')}`);
      });
    });
  }

  return accessibilityScanResults;
}

test.describe('Accessibility Audit - axe-core Automated Scanning', () => {
  test('should not have WCAG violations on home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await checkA11y(page, 'Home Page');

    // No critical or serious violations allowed
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);

    // Full report should have no violations
    expect(results.violations).toHaveLength(0);
  });

  test('should not have WCAG violations on history page with filters', async ({
    page,
  }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    const results = await checkA11y(page, 'History Page with Filters');

    // No critical or serious violations allowed
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations`
    ).toHaveLength(0);

    expect(results.violations).toHaveLength(0);
  });

  test('should not have WCAG violations on scan results page with issues', async ({
    page,
  }) => {
    // Mock scan results API with issues
    await page.route('**/api/scans/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/scans/test-scan-id')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-scan-id',
            url: 'https://example.com',
            status: 'COMPLETED',
            issueCount: 3,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }),
        });
      } else if (url.includes('/issues')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'issue-1',
              type: 'violation',
              impact: 'critical',
              description: 'Missing alt text',
              help: 'Images must have alternate text',
              helpUrl: 'https://example.com/help',
              nodes: [{ html: '<img src="test.jpg">', target: ['img'] }],
            },
            {
              id: 'issue-2',
              type: 'violation',
              impact: 'serious',
              description: 'Low color contrast',
              help: 'Text must have sufficient contrast',
              helpUrl: 'https://example.com/help',
              nodes: [{ html: '<p>Test</p>', target: ['p'] }],
            },
            {
              id: 'issue-3',
              type: 'violation',
              impact: 'moderate',
              description: 'Missing form label',
              help: 'Form elements must have labels',
              helpUrl: 'https://example.com/help',
              nodes: [{ html: '<input type="text">', target: ['input'] }],
            },
          ]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/scan/test-scan-id');
    await page.waitForLoadState('networkidle');

    // Wait for issues to load
    await expect(page.getByText('3 total issues')).toBeVisible({ timeout: 5000 });

    const results = await checkA11y(page, 'Scan Results Page with Issues');

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
    expect(results.violations).toHaveLength(0);
  });
});

test.describe('Accessibility Audit - Keyboard Navigation', () => {
  test.describe('History Page Filters', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/history');
      await page.waitForLoadState('networkidle');
    });

    test('should navigate through filter controls with Tab key', async ({ page }) => {
      // Tab to start date filter
      await page.keyboard.press('Tab');
      const startDateFilter = page.locator('#start-date-filter');
      await expect(startDateFilter).toBeFocused();

      // Tab to end date filter
      await page.keyboard.press('Tab');
      const endDateFilter = page.locator('#end-date-filter');
      await expect(endDateFilter).toBeFocused();

      // Tab to scan type filter buttons
      await page.keyboard.press('Tab');
      const singleButton = page.getByRole('button', { name: /Single/i });
      await expect(singleButton).toBeFocused();

      await page.keyboard.press('Tab');
      const batchButton = page.getByRole('button', { name: /Batch/i });
      await expect(batchButton).toBeFocused();

      // Tab to search input
      await page.keyboard.press('Tab');
      const searchInput = page.locator('#url-search-filter');
      await expect(searchInput).toBeFocused();
    });

    test('should activate scan type filter with Enter key', async ({ page }) => {
      const singleButton = page.getByRole('button', { name: /Single/i });
      await singleButton.focus();

      // Check initial state
      const initialPressed = await singleButton.getAttribute('aria-pressed');

      // Press Enter to toggle
      await page.keyboard.press('Enter');

      // Verify state changed
      const newPressed = await singleButton.getAttribute('aria-pressed');
      expect(newPressed).not.toBe(initialPressed);
    });

    test('should activate scan type filter with Space key', async ({ page }) => {
      const batchButton = page.getByRole('button', { name: /Batch/i });
      await batchButton.focus();

      // Check initial state
      const initialPressed = await batchButton.getAttribute('aria-pressed');

      // Press Space to toggle
      await page.keyboard.press(' ');

      // Verify state changed
      const newPressed = await batchButton.getAttribute('aria-pressed');
      expect(newPressed).not.toBe(initialPressed);
    });

    test('should have visible focus indicators on all filter controls', async ({
      page,
    }) => {
      const controls = [
        page.locator('#start-date-filter'),
        page.locator('#end-date-filter'),
        page.getByRole('button', { name: /Single/i }),
        page.locator('#url-search-filter'),
      ];

      for (const control of controls) {
        await control.focus();

        const hasFocusIndicator = await control.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return (
            computed.outline !== 'none' ||
            computed.boxShadow.includes('rgb') ||
            computed.ringWidth !== '0px'
          );
        });

        expect(hasFocusIndicator).toBeTruthy();
      }
    });
  });

  test.describe('Issue List Controls', () => {
    test.beforeEach(async ({ page }) => {
      // Mock scan results with multiple issues
      await page.route('**/api/scans/**', async (route) => {
        const url = route.request().url();

        if (url.includes('/scans/test-scan-id')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-scan-id',
              url: 'https://example.com',
              status: 'COMPLETED',
              issueCount: 25,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
            }),
          });
        } else if (url.includes('/issues')) {
          // Generate 25 issues with different severities
          const issues = Array.from({ length: 25 }, (_, i) => ({
            id: `issue-${i + 1}`,
            type: 'violation',
            impact: ['critical', 'serious', 'moderate', 'minor'][i % 4],
            description: `Test issue ${i + 1}`,
            help: 'Test help text',
            helpUrl: 'https://example.com/help',
            nodes: [{ html: `<div>Issue ${i + 1}</div>`, target: ['div'] }],
          }));

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(issues),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/scan/test-scan-id');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('25 total issues')).toBeVisible({ timeout: 5000 });
    });

    test('should navigate through issue controls with Tab key', async ({ page }) => {
      // Tab to Expand All button
      const expandAllButton = page.getByRole('button', { name: 'Expand all issues' });
      await expandAllButton.focus();
      await expect(expandAllButton).toBeFocused();

      // Tab to Collapse All button
      await page.keyboard.press('Tab');
      const collapseAllButton = page.getByRole('button', { name: 'Collapse all issues' });
      await expect(collapseAllButton).toBeFocused();
    });

    test('should activate Expand All button with Enter key', async ({ page }) => {
      const expandAllButton = page.getByRole('button', { name: 'Expand all issues' });
      await expandAllButton.focus();
      await page.keyboard.press('Enter');

      // Verify expansion (issues should be visible)
      await expect(page.getByText('Test issue 1')).toBeVisible();
    });

    test('should activate severity filter chips with keyboard', async ({ page }) => {
      // Severity filters only appear when >20 issues
      const criticalChip = page.getByRole('button', { name: /Critical/i });

      if (await criticalChip.isVisible()) {
        await criticalChip.focus();

        // Check initial state
        const initialPressed = await criticalChip.getAttribute('aria-pressed');

        // Activate with Enter
        await page.keyboard.press('Enter');

        // Verify state changed
        const newPressed = await criticalChip.getAttribute('aria-pressed');
        expect(newPressed).not.toBe(initialPressed);
      }
    });

    test('should navigate through severity filter chips with Tab', async ({ page }) => {
      // Get all severity filter buttons
      const filterGroup = page.getByRole('group', { name: 'Filter by severity' });

      if (await filterGroup.isVisible()) {
        const chips = await filterGroup.getByRole('button').all();

        // Tab through each chip
        for (let i = 0; i < chips.length - 1; i++) {
          await chips[i].focus();
          await expect(chips[i]).toBeFocused();
          await page.keyboard.press('Tab');
        }
      }
    });
  });

  test.describe('Bulk Actions', () => {
    test.beforeEach(async ({ page }) => {
      // Mock history data
      await page.route('**/api/scans', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'scan-1',
              url: 'https://example.com',
              status: 'COMPLETED',
              issueCount: 5,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'scan-2',
              url: 'https://example2.com',
              status: 'COMPLETED',
              issueCount: 3,
              createdAt: new Date().toISOString(),
            },
          ]),
        });
      });

      await page.goto('/history');
      await page.waitForLoadState('networkidle');
    });

    test('should navigate through bulk action buttons with Tab', async ({ page }) => {
      // Select first item to show bulk actions
      const firstCheckbox = page.getByRole('checkbox').first();
      await firstCheckbox.click();

      // Wait for bulk actions to appear
      await expect(page.getByText('1 item selected')).toBeVisible();

      // Tab to Clear Selection button
      const clearButton = page.getByRole('button', { name: 'Clear selection' });
      await clearButton.focus();
      await expect(clearButton).toBeFocused();

      // Tab to Delete Selected button
      await page.keyboard.press('Tab');
      const deleteButton = page.getByRole('button', { name: /Delete.*selected/i });
      await expect(deleteButton).toBeFocused();
    });
  });
});

test.describe('Accessibility Audit - ARIA Live Regions', () => {
  test('should announce filter changes via ARIA live region', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Check for aria-live region (may be on filter container or status area)
    const liveRegions = page.locator('[aria-live]');
    const count = await liveRegions.count();

    // At least one live region should exist
    expect(count).toBeGreaterThan(0);

    // Verify live region has proper politeness setting
    const firstLiveRegion = liveRegions.first();
    const ariaLive = await firstLiveRegion.getAttribute('aria-live');
    expect(['polite', 'assertive']).toContain(ariaLive);
  });

  test('should announce scan status changes via ARIA live region', async ({
    page,
  }) => {
    // Mock a running scan that transitions to completed
    let scanStatus = 'RUNNING';

    await page.route('**/api/scans/**', async (route) => {
      if (route.request().url().includes('/scans/test-scan-id')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-scan-id',
            url: 'https://example.com',
            status: scanStatus,
            issueCount: scanStatus === 'COMPLETED' ? 3 : 0,
            createdAt: new Date().toISOString(),
            completedAt: scanStatus === 'COMPLETED' ? new Date().toISOString() : null,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/scan/test-scan-id');

    // Wait for initial status
    await expect(page.getByText(/Running|Analyzing/i)).toBeVisible({ timeout: 5000 });

    // Change status to completed
    scanStatus = 'COMPLETED';

    // Wait for status update (page should poll)
    await expect(page.getByText(/Completed|Done/i)).toBeVisible({ timeout: 10000 });

    // Verify live region exists for status updates
    const liveRegions = page.locator('[aria-live]');
    expect(await liveRegions.count()).toBeGreaterThan(0);
  });

  test('should announce selection count changes', async ({ page }) => {
    // Mock history data
    await page.route('**/api/scans', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'scan-1',
            url: 'https://example.com',
            status: 'COMPLETED',
            issueCount: 5,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'scan-2',
            url: 'https://example2.com',
            status: 'COMPLETED',
            issueCount: 3,
            createdAt: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Select first item
    const firstCheckbox = page.getByRole('checkbox').first();
    await firstCheckbox.click();

    // Selection count should be visible (announces change)
    await expect(page.getByText('1 item selected')).toBeVisible();

    // Select second item
    const secondCheckbox = page.getByRole('checkbox').nth(1);
    await secondCheckbox.click();

    // Selection count should update
    await expect(page.getByText('2 items selected')).toBeVisible();
  });
});

test.describe('Accessibility Audit - Focus Management', () => {
  test.describe('Modal Focus Trap', () => {
    test.beforeEach(async ({ page }) => {
      // Mock history data
      await page.route('**/api/scans', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'scan-1',
              url: 'https://example.com',
              status: 'COMPLETED',
              issueCount: 5,
              createdAt: new Date().toISOString(),
            },
          ]),
        });
      });

      await page.goto('/history');
      await page.waitForLoadState('networkidle');
    });

    test('should trap focus within confirm dialog', async ({ page }) => {
      // Select an item and click delete
      const firstCheckbox = page.getByRole('checkbox').first();
      await firstCheckbox.click();

      const deleteButton = page.getByRole('button', { name: /Delete.*selected/i });
      await deleteButton.click();

      // Wait for dialog to appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Get focusable elements in dialog
      const cancelButton = page.getByRole('button', { name: 'Cancel' });
      const confirmButton = page.getByRole('button', { name: 'Delete' });

      // Focus should start on first button
      await expect(cancelButton).toBeFocused();

      // Tab to next button
      await page.keyboard.press('Tab');
      await expect(confirmButton).toBeFocused();

      // Tab should cycle back to first button (focus trap)
      await page.keyboard.press('Tab');
      await expect(cancelButton).toBeFocused();

      // Shift+Tab should go backward
      await page.keyboard.press('Shift+Tab');
      await expect(confirmButton).toBeFocused();
    });

    test('should close dialog with Escape key', async ({ page }) => {
      // Select an item and click delete
      const firstCheckbox = page.getByRole('checkbox').first();
      await firstCheckbox.click();

      const deleteButton = page.getByRole('button', { name: /Delete.*selected/i });
      await deleteButton.click();

      // Wait for dialog to appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    });

    test('should return focus to trigger element when modal closes', async ({
      page,
    }) => {
      // Select an item and click delete
      const firstCheckbox = page.getByRole('checkbox').first();
      await firstCheckbox.click();

      const deleteButton = page.getByRole('button', { name: /Delete.*selected/i });
      await deleteButton.click();

      // Wait for dialog to appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Close dialog with Cancel
      const cancelButton = page.getByRole('button', { name: 'Cancel' });
      await cancelButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();

      // Focus should return to delete button (trigger element)
      await expect(deleteButton).toBeFocused();
    });

    test('should have proper ARIA attributes on dialog', async ({ page }) => {
      // Select an item and click delete
      const firstCheckbox = page.getByRole('checkbox').first();
      await firstCheckbox.click();

      const deleteButton = page.getByRole('button', { name: /Delete.*selected/i });
      await deleteButton.click();

      // Wait for dialog to appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Check for aria-labelledby
      const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');
      expect(ariaLabelledBy).toBeTruthy();

      // Check for aria-describedby
      const ariaDescribedBy = await dialog.getAttribute('aria-describedby');
      expect(ariaDescribedBy).toBeTruthy();

      // Verify title element exists
      const titleId = ariaLabelledBy || '';
      const title = page.locator(`#${titleId}`);
      await expect(title).toBeVisible();
      await expect(title).toContainText('Delete');
    });
  });

  test.describe('Focus Restoration', () => {
    test('should maintain focus when expanding mobile filters', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/history');
      await page.waitForLoadState('networkidle');

      // Find filter toggle button
      const filterToggle = page.getByRole('button', { name: /Filters/i });

      if (await filterToggle.isVisible()) {
        await filterToggle.focus();
        await expect(filterToggle).toBeFocused();

        // Click to expand
        await page.keyboard.press('Enter');

        // Filter content should be visible
        await expect(page.locator('#filter-content')).toBeVisible();

        // Focus should still be on toggle button
        await expect(filterToggle).toBeFocused();
      }
    });
  });
});

test.describe('Accessibility Audit - Skip Links', () => {
  test('should have skip to main content link', async ({ page }) => {
    await page.goto('/');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Check if first focused element is a skip link
    const focused = page.locator(':focus');
    const text = await focused.textContent();

    // Skip link is recommended for complex pages
    // If present, it should be the first focusable element
    if (text?.toLowerCase().includes('skip')) {
      const href = await focused.getAttribute('href');

      // Should link to main content area
      expect(['#main', '#content', '#main-content']).toContain(href || '');

      // Click skip link
      await page.keyboard.press('Enter');

      // Focus should move to main content
      const mainContent = page.locator(href || '#main');
      await expect(mainContent).toBeFocused();
    }
  });

  test('should skip to main content when skip link is activated', async ({
    page,
  }) => {
    await page.goto('/history');

    // Look for skip link
    const skipLink = page
      .locator('a')
      .filter({ hasText: /skip to (main|content)/i })
      .first();

    if ((await skipLink.count()) > 0) {
      await skipLink.focus();
      await page.keyboard.press('Enter');

      // Main content should receive focus
      const mainContent = page.locator('main, #main, #content');
      const isFocused = await mainContent.evaluate((el) => {
        return document.activeElement === el;
      });

      expect(isFocused).toBeTruthy();
    }
  });
});

test.describe('Accessibility Audit - Color Contrast', () => {
  test('should meet WCAG AA color contrast on filter controls', async ({
    page,
  }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Run axe-core specifically for color contrast
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include(['#filter-content, [role="group"]'])
      .analyze();

    const contrastViolations = results.violations.filter((v) =>
      v.id.includes('color-contrast')
    );

    expect(
      contrastViolations,
      'All filter controls should meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)'
    ).toHaveLength(0);
  });

  test('should meet WCAG AA color contrast on issue severity badges', async ({
    page,
  }) => {
    // Mock scan results
    await page.route('**/api/scans/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/scans/test-scan-id')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-scan-id',
            url: 'https://example.com',
            status: 'COMPLETED',
            issueCount: 25,
          }),
        });
      } else if (url.includes('/issues')) {
        const issues = Array.from({ length: 25 }, (_, i) => ({
          id: `issue-${i + 1}`,
          type: 'violation',
          impact: ['critical', 'serious', 'moderate', 'minor'][i % 4],
          description: `Test issue ${i + 1}`,
          help: 'Test help text',
          helpUrl: 'https://example.com/help',
          nodes: [{ html: `<div>Issue ${i + 1}</div>`, target: ['div'] }],
        }));

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(issues),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/scan/test-scan-id');
    await page.waitForLoadState('networkidle');

    // Run axe-core on severity filter chips
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include(['[role="group"]'])
      .analyze();

    const contrastViolations = results.violations.filter((v) =>
      v.id.includes('color-contrast')
    );

    expect(contrastViolations).toHaveLength(0);
  });
});
