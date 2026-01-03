import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Issue Expand/Collapse and Filter Interactions
 *
 * PREREQUISITE: Dev server must be running on http://localhost:3080
 * Run: npm run dev (from apps/web directory)
 *
 * Tests the issue list interaction functionality:
 * 1. Expand All button expands all issue cards
 * 2. Collapse All button collapses all issue cards
 * 3. Individual issue card expand/collapse
 * 4. Severity filter chips filter the issue list
 * 5. Scroll position preservation when expanding issues
 *
 * Coverage:
 * - Requirements 3.1: Expand All and Collapse All buttons
 * - Requirements 3.2: Scroll position preservation
 * - Requirements 3.4: Severity filtering for >20 issues
 *
 * @see apps/web/src/components/features/results/IssueList.tsx
 * @see apps/web/src/components/features/results/IssueListControls.tsx
 * @see apps/web/src/stores/issue-filter-store.ts
 */

test.describe('Issue List Interactions', () => {
  /**
   * Helper function to mock scan details API with completed status
   */
  const mockCompletedScan = async (page: any, scanId: string) => {
    await page.route(`**/api/scans/${scanId}`, async (route: any) => {
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
  };

  /**
   * Helper function to generate mock issues for testing
   */
  const generateMockIssues = (count: number) => {
    const severities = ['critical', 'serious', 'moderate', 'minor'] as const;
    const issues: any = {
      critical: [],
      serious: [],
      moderate: [],
      minor: [],
    };

    for (let i = 0; i < count; i++) {
      const severity = severities[i % 4];
      issues[severity].push({
        id: `issue-${i}`,
        impact: severity,
        description: `Test issue ${i} description`,
        help: `Test issue ${i} - ${severity} impact`,
        helpUrl: `https://dequeuniversity.com/rules/axe/4.4/test-${i}`,
        tags: ['wcag2a', 'wcag21a', 'cat.test'],
        nodes: [
          {
            html: `<div id="test-${i}">Test HTML</div>`,
            target: [`#test-${i}`],
            failureSummary: `Test failure summary for issue ${i}`,
          },
        ],
      });
    }

    return issues;
  };

  /**
   * Helper function to mock scan results with specified number of issues
   */
  const mockScanResults = async (page: any, scanId: string, issueCount: number = 25) => {
    const issuesByImpact = generateMockIssues(issueCount);
    const totalIssues = issueCount;
    const critical = issuesByImpact.critical.length;
    const serious = issuesByImpact.serious.length;
    const moderate = issuesByImpact.moderate.length;
    const minor = issuesByImpact.minor.length;

    await page.route(`**/api/scans/${scanId}/results`, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId,
          url: 'https://example.com',
          wcagLevel: 'AA',
          completedAt: new Date().toISOString(),
          summary: {
            totalIssues,
            critical,
            serious,
            moderate,
            minor,
            passedTests: 45,
            wcagCompliance: { levelA: 95, levelAA: 90, levelAAA: 80 },
          },
          issuesByImpact,
        }),
      });
    });
  };

  test.beforeEach(async ({ page }) => {
    // Mock reCAPTCHA for any form submissions
    await page.addInitScript(() => {
      (window as any).grecaptcha = {
        ready: (callback: () => void) => callback(),
        execute: () => Promise.resolve('mock-recaptcha-token'),
      };
    });
  });

  test.describe('Expand All / Collapse All Buttons', () => {
    test('should expand all issue cards when clicking Expand All button', async ({ page }) => {
      const scanId = 'test-scan-expand-all';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 10); // 10 issues for testing

      await page.goto(`/scan/${scanId}`);

      // Wait for results to load
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Verify Expand All button exists
      const expandAllButton = page.getByRole('button', { name: /expand all/i });
      await expect(expandAllButton).toBeVisible();

      // Initially, all cards should be collapsed (no expanded content visible)
      const firstIssueDetails = page.getByText(/How to Fix/i).first();
      await expect(firstIssueDetails).not.toBeVisible();

      // Click Expand All
      await expandAllButton.click();

      // Wait a bit for expansion animation
      await page.waitForTimeout(300);

      // Verify all issue cards are expanded by checking for expanded content
      // Look for multiple "How to Fix" sections (one per issue)
      const fixSections = page.getByText(/How to Fix/i);
      const fixCount = await fixSections.count();
      expect(fixCount).toBeGreaterThan(0);

      // Verify aria-expanded attribute is set correctly on issue buttons
      const issueButtons = page.locator('button[aria-expanded="true"]');
      const expandedCount = await issueButtons.count();
      expect(expandedCount).toBeGreaterThan(0);
    });

    test('should collapse all issue cards when clicking Collapse All button', async ({ page }) => {
      const scanId = 'test-scan-collapse-all';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 10);

      await page.goto(`/scan/${scanId}`);

      // Wait for results to load
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // First expand all issues
      await page.getByRole('button', { name: /expand all/i }).click();
      await page.waitForTimeout(300);

      // Verify some issues are expanded
      await expect(page.getByText(/How to Fix/i).first()).toBeVisible();

      // Click Collapse All
      const collapseAllButton = page.getByRole('button', { name: /collapse all/i });
      await expect(collapseAllButton).toBeVisible();
      await collapseAllButton.click();

      // Wait for collapse animation
      await page.waitForTimeout(300);

      // Verify all issue cards are collapsed
      const fixSections = page.getByText(/How to Fix/i);
      const visibleFixSections = await fixSections.count();

      // All "How to Fix" sections should be hidden
      for (let i = 0; i < visibleFixSections; i++) {
        await expect(fixSections.nth(i)).not.toBeVisible();
      }

      // Verify aria-expanded=false on issue buttons
      const collapsedButtons = page.locator('button[aria-expanded="false"]');
      const collapsedCount = await collapsedButtons.count();
      expect(collapsedCount).toBeGreaterThan(0);
    });

    test('should toggle between expand all and collapse all states', async ({ page }) => {
      const scanId = 'test-scan-toggle-all';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 8);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      const expandAllButton = page.getByRole('button', { name: /expand all/i });
      const collapseAllButton = page.getByRole('button', { name: /collapse all/i });

      // Expand all
      await expandAllButton.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/How to Fix/i).first()).toBeVisible();

      // Collapse all
      await collapseAllButton.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/How to Fix/i).first()).not.toBeVisible();

      // Expand all again
      await expandAllButton.click();
      await page.waitForTimeout(300);
      await expect(page.getByText(/How to Fix/i).first()).toBeVisible();
    });
  });

  test.describe('Individual Issue Expand/Collapse', () => {
    test('should expand individual issue card when clicked', async ({ page }) => {
      const scanId = 'test-scan-individual-expand';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 5);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Find the first issue card button
      const firstIssueButton = page.locator('button[aria-expanded]').first();
      await expect(firstIssueButton).toBeVisible();

      // Verify it's initially collapsed
      await expect(firstIssueButton).toHaveAttribute('aria-expanded', 'false');

      // Click to expand
      await firstIssueButton.click();
      await page.waitForTimeout(200);

      // Verify it's now expanded
      await expect(firstIssueButton).toHaveAttribute('aria-expanded', 'true');

      // Verify expanded content is visible
      await expect(page.getByText(/How to Fix/i).first()).toBeVisible();
    });

    test('should collapse individual issue card when clicked again', async ({ page }) => {
      const scanId = 'test-scan-individual-collapse';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 5);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      const firstIssueButton = page.locator('button[aria-expanded]').first();

      // Expand the issue
      await firstIssueButton.click();
      await page.waitForTimeout(200);
      await expect(firstIssueButton).toHaveAttribute('aria-expanded', 'true');

      // Click again to collapse
      await firstIssueButton.click();
      await page.waitForTimeout(200);

      // Verify it's collapsed
      await expect(firstIssueButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('should allow multiple issues to be expanded simultaneously', async ({ page }) => {
      const scanId = 'test-scan-multiple-expand';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 5);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Expand first three issues
      const issueButtons = page.locator('button[aria-expanded]');
      await issueButtons.nth(0).click();
      await page.waitForTimeout(100);
      await issueButtons.nth(1).click();
      await page.waitForTimeout(100);
      await issueButtons.nth(2).click();
      await page.waitForTimeout(200);

      // Verify all three are expanded
      await expect(issueButtons.nth(0)).toHaveAttribute('aria-expanded', 'true');
      await expect(issueButtons.nth(1)).toHaveAttribute('aria-expanded', 'true');
      await expect(issueButtons.nth(2)).toHaveAttribute('aria-expanded', 'true');

      // Verify multiple "How to Fix" sections are visible
      const fixSections = page.getByText(/How to Fix/i);
      const visibleCount = await fixSections.count();
      expect(visibleCount).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Severity Filter', () => {
    test('should show severity filter chips when there are more than 20 issues', async ({ page }) => {
      const scanId = 'test-scan-filter-visible';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 25); // More than 20 issues

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Verify filter chips are visible
      const filterGroup = page.getByRole('group', { name: /filter by severity/i });
      await expect(filterGroup).toBeVisible();

      // Verify severity chips exist
      await expect(page.getByRole('button', { name: /critical/i }).first()).toBeVisible();
    });

    test('should NOT show severity filter chips when there are 20 or fewer issues', async ({ page }) => {
      const scanId = 'test-scan-filter-hidden';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 15); // 20 or fewer issues

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Verify filter chips are NOT visible
      const filterGroup = page.getByRole('group', { name: /filter by severity/i });
      await expect(filterGroup).not.toBeVisible();
    });

    test('should filter issues when clicking severity chip', async ({ page }) => {
      const scanId = 'test-scan-filter-apply';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 24); // 6 of each severity

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Count initial visible issues
      const allIssues = page.locator('button[aria-expanded]');
      const initialCount = await allIssues.count();
      expect(initialCount).toBe(24);

      // Click critical filter chip
      const criticalChip = page.getByRole('button', { name: /critical.*\(6\)/i });
      await expect(criticalChip).toBeVisible();
      await criticalChip.click();
      await page.waitForTimeout(300);

      // Verify aria-pressed is set to true
      await expect(criticalChip).toHaveAttribute('aria-pressed', 'true');

      // Verify filtered count (should only show 6 critical issues)
      const filteredIssues = page.locator('button[aria-expanded]');
      const filteredCount = await filteredIssues.count();
      expect(filteredCount).toBe(6);
    });

    test('should allow multiple severity filters to be applied', async ({ page }) => {
      const scanId = 'test-scan-filter-multiple';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 24);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Click critical chip (6 issues)
      await page.getByRole('button', { name: /critical.*\(6\)/i }).click();
      await page.waitForTimeout(200);

      // Click serious chip (6 issues)
      await page.getByRole('button', { name: /serious.*\(6\)/i }).click();
      await page.waitForTimeout(300);

      // Verify filtered count (should show 12 issues: critical + serious)
      const filteredIssues = page.locator('button[aria-expanded]');
      const filteredCount = await filteredIssues.count();
      expect(filteredCount).toBe(12);
    });

    test('should clear filters when clicking Clear filters button', async ({ page }) => {
      const scanId = 'test-scan-filter-clear';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 24);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Apply critical filter
      await page.getByRole('button', { name: /critical.*\(6\)/i }).click();
      await page.waitForTimeout(300);

      // Verify filter is applied
      let filteredIssues = page.locator('button[aria-expanded]');
      let filteredCount = await filteredIssues.count();
      expect(filteredCount).toBe(6);

      // Click Clear filters button
      const clearButton = page.getByRole('button', { name: /clear all filters/i });
      await expect(clearButton).toBeVisible();
      await clearButton.click();
      await page.waitForTimeout(300);

      // Verify all issues are visible again
      filteredIssues = page.locator('button[aria-expanded]');
      filteredCount = await filteredIssues.count();
      expect(filteredCount).toBe(24);
    });

    test('should remove filter when clicking active severity chip again', async ({ page }) => {
      const scanId = 'test-scan-filter-toggle';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 24);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      const criticalChip = page.getByRole('button', { name: /critical.*\(6\)/i });

      // Click to apply filter
      await criticalChip.click();
      await page.waitForTimeout(300);
      await expect(criticalChip).toHaveAttribute('aria-pressed', 'true');

      // Click again to remove filter
      await criticalChip.click();
      await page.waitForTimeout(300);
      await expect(criticalChip).toHaveAttribute('aria-pressed', 'false');

      // Verify all issues are visible
      const allIssues = page.locator('button[aria-expanded]');
      const count = await allIssues.count();
      expect(count).toBe(24);
    });
  });

  test.describe('Scroll Position Preservation', () => {
    test('should preserve scroll position when expanding an issue', async ({ page }) => {
      const scanId = 'test-scan-scroll-preserve';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 20); // Enough issues to require scrolling

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Scroll down to the middle of the page
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(200);

      // Get current scroll position
      const scrollBefore = await page.evaluate(() => window.scrollY);
      expect(scrollBefore).toBeGreaterThan(0);

      // Find and expand an issue that's in view
      const issueButtons = page.locator('button[aria-expanded]');
      const middleIssue = issueButtons.nth(5);
      await middleIssue.click();
      await page.waitForTimeout(300);

      // Get scroll position after expansion
      const scrollAfter = await page.evaluate(() => window.scrollY);

      // Scroll position should be preserved (within reasonable tolerance)
      const scrollDiff = Math.abs(scrollAfter - scrollBefore);
      expect(scrollDiff).toBeLessThan(50); // Allow small variance for layout shifts
    });

    test('should preserve scroll position when collapsing an issue', async ({ page }) => {
      const scanId = 'test-scan-scroll-collapse';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 20);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Expand an issue first
      const issueButtons = page.locator('button[aria-expanded]');
      const targetIssue = issueButtons.nth(5);
      await targetIssue.click();
      await page.waitForTimeout(300);

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(200);

      // Get scroll position before collapse
      const scrollBefore = await page.evaluate(() => window.scrollY);
      expect(scrollBefore).toBeGreaterThan(0);

      // Collapse the issue
      await targetIssue.click();
      await page.waitForTimeout(300);

      // Get scroll position after collapse
      const scrollAfter = await page.evaluate(() => window.scrollY);

      // Scroll position should be preserved
      const scrollDiff = Math.abs(scrollAfter - scrollBefore);
      expect(scrollDiff).toBeLessThan(50);
    });

    test('should preserve scroll position during Expand All operation', async ({ page }) => {
      const scanId = 'test-scan-scroll-expand-all';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 15);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Scroll to a specific position
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(200);

      const scrollBefore = await page.evaluate(() => window.scrollY);

      // Click Expand All
      await page.getByRole('button', { name: /expand all/i }).click();
      await page.waitForTimeout(500); // Allow time for all expansions

      const scrollAfter = await page.evaluate(() => window.scrollY);

      // Scroll position should be relatively preserved
      // Note: Large layout shifts may cause some movement
      const scrollDiff = Math.abs(scrollAfter - scrollBefore);
      expect(scrollDiff).toBeLessThan(100);
    });
  });

  test.describe('Combined Interactions', () => {
    test('should maintain filter state when expanding and collapsing issues', async ({ page }) => {
      const scanId = 'test-scan-combined-filter';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 24);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Apply critical filter
      await page.getByRole('button', { name: /critical.*\(6\)/i }).click();
      await page.waitForTimeout(300);

      // Verify filter is applied
      let visibleIssues = page.locator('button[aria-expanded]');
      let count = await visibleIssues.count();
      expect(count).toBe(6);

      // Expand all filtered issues
      await page.getByRole('button', { name: /expand all/i }).click();
      await page.waitForTimeout(300);

      // Verify filter is still applied (still only 6 issues visible)
      visibleIssues = page.locator('button[aria-expanded]');
      count = await visibleIssues.count();
      expect(count).toBe(6);

      // Verify they are expanded
      await expect(page.getByText(/How to Fix/i).first()).toBeVisible();
    });

    test('should work correctly with filters and individual expand/collapse', async ({ page }) => {
      const scanId = 'test-scan-combined-individual';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 24);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Apply serious filter
      await page.getByRole('button', { name: /serious.*\(6\)/i }).click();
      await page.waitForTimeout(300);

      // Expand first issue in filtered list
      const firstIssue = page.locator('button[aria-expanded]').first();
      await firstIssue.click();
      await page.waitForTimeout(200);

      // Verify it's expanded
      await expect(firstIssue).toHaveAttribute('aria-expanded', 'true');

      // Change filter to critical
      await page.getByRole('button', { name: /serious.*\(6\)/i }).click();
      await page.waitForTimeout(200);
      await page.getByRole('button', { name: /critical.*\(6\)/i }).click();
      await page.waitForTimeout(300);

      // Verify different issues are now shown
      const newVisibleIssues = page.locator('button[aria-expanded]');
      const newCount = await newVisibleIssues.count();
      expect(newCount).toBe(6);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes on Expand/Collapse buttons', async ({ page }) => {
      const scanId = 'test-scan-aria';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 10);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Check Expand All button
      const expandAllButton = page.getByRole('button', { name: /expand all/i });
      await expect(expandAllButton).toHaveAttribute('aria-label', 'Expand all issues');

      // Check Collapse All button
      const collapseAllButton = page.getByRole('button', { name: /collapse all/i });
      await expect(collapseAllButton).toHaveAttribute('aria-label', 'Collapse all issues');

      // Check individual issue buttons have aria-expanded
      const issueButton = page.locator('button[aria-expanded]').first();
      await expect(issueButton).toHaveAttribute('aria-expanded');
    });

    test('should have proper ARIA attributes on severity filter chips', async ({ page }) => {
      const scanId = 'test-scan-aria-filters';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 25);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Check filter group has proper role and label
      const filterGroup = page.getByRole('group', { name: /filter by severity/i });
      await expect(filterGroup).toBeVisible();

      // Check severity chips have aria-pressed
      const criticalChip = page.getByRole('button', { name: /critical.*\(6\)/i });
      await expect(criticalChip).toHaveAttribute('aria-pressed', 'false');

      // Click to activate
      await criticalChip.click();
      await page.waitForTimeout(200);

      // Verify aria-pressed updated
      await expect(criticalChip).toHaveAttribute('aria-pressed', 'true');
    });

    test('should be keyboard navigable', async ({ page }) => {
      const scanId = 'test-scan-keyboard';

      await mockCompletedScan(page, scanId);
      await mockScanResults(page, scanId, 5);

      await page.goto(`/scan/${scanId}`);
      await expect(page.getByText(/total issues/i)).toBeVisible({ timeout: 10000 });

      // Tab to Expand All button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Find which element is focused
      const expandButton = page.getByRole('button', { name: /expand all/i });
      const collapseButton = page.getByRole('button', { name: /collapse all/i });

      // Either Expand All or Collapse All should be focusable
      const isExpandFocused = await expandButton.evaluate(el => document.activeElement === el);
      const isCollapseFocused = await collapseButton.evaluate(el => document.activeElement === el);

      expect(isExpandFocused || isCollapseFocused).toBe(true);
    });
  });
});
