import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Criteria Coverage Table
 *
 * Tests the WCAG criteria coverage table feature:
 * 1. View scan with tabbed interface (Issues / Criteria Coverage)
 * 2. Switch between tabs
 * 3. View criteria table with verification status
 * 4. Click failed criterion to filter issues
 * 5. Clear filter to show all issues
 * 6. Verify coverage card shows accurate statistics
 */

// Mock scan data with criteria verifications
const mockScanId = 'mock-criteria-coverage-scan';
const mockScanResult = {
  scanId: mockScanId,
  url: 'https://example.com',
  wcagLevel: 'AA',
  pageTitle: 'Example Page',
  timestamp: new Date().toISOString(),
  summary: {
    totalIssues: 3,
    critical: 1,
    serious: 1,
    moderate: 1,
    minor: 0,
    passedTests: 50,
  },
  coverage: {
    coveragePercentage: 42,
    criteriaChecked: 21,
    criteriaTotal: 50,
    passedChecks: 50,
    breakdown: {
      criteriaWithIssues: 3,
      criteriaPassed: 18,
      criteriaNotTestable: 29,
    },
  },
  enhancedCoverage: {
    criteriaVerifications: [
      {
        criterionId: '1.1.1',
        name: 'Non-text Content',
        level: 'A',
        status: 'FAIL',
        scanner: 'axe-core',
        relatedIssueIds: ['issue-1'],
      },
      {
        criterionId: '1.4.3',
        name: 'Contrast (Minimum)',
        level: 'AA',
        status: 'FAIL',
        scanner: 'axe-core',
        relatedIssueIds: ['issue-2'],
      },
      {
        criterionId: '2.4.4',
        name: 'Link Purpose (In Context)',
        level: 'A',
        status: 'FAIL',
        scanner: 'axe-core',
        relatedIssueIds: ['issue-3'],
      },
      {
        criterionId: '1.2.1',
        name: 'Audio-only and Video-only (Prerecorded)',
        level: 'A',
        status: 'PASS',
        scanner: 'axe-core',
      },
      {
        criterionId: '1.3.1',
        name: 'Info and Relationships',
        level: 'A',
        status: 'PASS',
        scanner: 'axe-core',
      },
      {
        criterionId: '1.4.10',
        name: 'Reflow',
        level: 'AA',
        status: 'NOT_TESTED',
        scanner: 'N/A',
      },
      {
        criterionId: '1.4.11',
        name: 'Non-text Contrast',
        level: 'AA',
        status: 'NOT_TESTED',
        scanner: 'N/A',
      },
    ],
    criteriaChecked: 21,
    criteriaTotal: 50,
    aiModel: 'claude-3-5-sonnet',
  },
  issuesByImpact: {
    critical: [
      {
        id: 'issue-1',
        ruleId: 'image-alt',
        description: 'Images must have alt text',
        helpText: 'Add alt text to all images',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/image-alt',
        wcagCriteria: ['1.1.1'],
        nodes: [
          {
            html: '<img src="logo.png">',
            target: ['img[src="logo.png"]'],
          },
        ],
      },
    ],
    serious: [
      {
        id: 'issue-2',
        ruleId: 'color-contrast',
        description: 'Elements must have sufficient color contrast',
        helpText: 'Ensure contrast ratio of at least 4.5:1',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
        wcagCriteria: ['1.4.3'],
        nodes: [
          {
            html: '<p style="color: #999">Low contrast text</p>',
            target: ['p.low-contrast'],
          },
        ],
      },
    ],
    moderate: [
      {
        id: 'issue-3',
        ruleId: 'link-name',
        description: 'Links must have discernible text',
        helpText: 'Add visible text or aria-label to links',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/link-name',
        wcagCriteria: ['2.4.4'],
        nodes: [
          {
            html: '<a href="/page"><img src="arrow.png"></a>',
            target: ['a[href="/page"]'],
          },
        ],
      },
    ],
    minor: [],
  },
};

test.describe('Criteria Coverage Table', () => {
  test.beforeEach(async ({ page }) => {
    // Mock scan status API
    await page.route(`**/api/scans/${mockScanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId: mockScanId,
          status: 'completed',
          url: 'https://example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock scan results API
    await page.route(`**/api/scans/${mockScanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockScanResult),
      });
    });
  });

  test('should display tabbed interface with Issues and Criteria Coverage tabs', async ({
    page,
  }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Check for both tabs
    await expect(page.getByRole('tab', { name: /issues/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /criteria coverage/i })).toBeVisible();

    // Issues tab should be selected by default
    await expect(page.getByRole('tab', { name: /issues/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('should show issues count badge on Issues tab', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Check for issue count badge
    const issuesTab = page.getByRole('tab', { name: /issues/i });
    await expect(issuesTab).toContainText('3'); // Total issues from mock data
  });

  test('should show criteria count badge on Coverage tab', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Check for criteria count badge (21/50 from mock)
    const coverageTab = page.getByRole('tab', { name: /criteria coverage/i });
    await expect(coverageTab).toContainText('21');
    await expect(coverageTab).toContainText('50');
  });

  test('should switch to Criteria Coverage tab and show criteria table', async ({
    page,
  }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Click Criteria Coverage tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Check tab is now selected
    await expect(page.getByRole('tab', { name: /criteria coverage/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Check for criteria table
    await expect(page.getByRole('table')).toBeVisible();

    // Check for table headers
    await expect(page.getByRole('columnheader', { name: /criterion/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /scanner/i })).toBeVisible();
  });

  test('should display criteria with correct status badges', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Switch to criteria tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Check for failed criteria
    await expect(page.getByText('1.1.1')).toBeVisible();
    await expect(page.getByText('Non-text Content')).toBeVisible();

    // Check for pass/fail status indicators
    await expect(page.getByRole('cell', { name: /fail/i }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: /pass/i }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: /not tested/i }).first()).toBeVisible();
  });

  test('should show scanner source for each criterion', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Switch to criteria tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Check for scanner sources
    await expect(page.getByText('axe-core')).toBeVisible();
    await expect(page.getByText('N/A')).toBeVisible();
  });

  test('should filter criteria by status', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Switch to criteria tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Click status filter dropdown
    const statusFilter = page.getByRole('combobox', { name: /filter by status/i });
    if (await statusFilter.isVisible()) {
      await statusFilter.click();

      // Select "Fail" filter
      await page.getByRole('option', { name: /fail/i }).click();

      // Should only show failed criteria
      await expect(page.getByText('1.1.1')).toBeVisible();
      await expect(page.getByText('1.4.3')).toBeVisible();

      // Should show filter count
      await expect(page.getByText(/showing \d+ of \d+ criteria/i)).toBeVisible();
    }
  });

  test('should navigate from failed criterion to filtered issues', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Switch to criteria tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Click on a failed criterion row
    const failedRow = page.getByRole('row', { name: /1\.1\.1/i });
    await failedRow.click();

    // Should switch back to Issues tab
    await expect(page.getByRole('tab', { name: /issues/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Should show filter banner
    await expect(page.getByText(/showing issues for criterion/i)).toBeVisible();
    await expect(page.getByText('1.1.1')).toBeVisible();

    // Should show only the related issue
    await expect(page.getByText(/images must have alt text/i)).toBeVisible();
  });

  test('should clear criterion filter', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}?tab=issues&criterion=1.1.1`);

    // Check filter banner is shown
    await expect(page.getByText(/showing issues for criterion/i)).toBeVisible();

    // Click "Show all issues" to clear filter
    await page.getByRole('button', { name: /show all issues/i }).click();

    // Filter should be cleared
    await expect(page.getByText(/showing issues for criterion/i)).not.toBeVisible();

    // Should show all issues
    await expect(page.getByText(/images must have alt text/i)).toBeVisible();
    await expect(page.getByText(/sufficient color contrast/i)).toBeVisible();
    await expect(page.getByText(/discernible text/i)).toBeVisible();
  });

  test('should persist tab selection in URL', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Switch to criteria tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // URL should update
    await expect(page).toHaveURL(/tab=coverage/);

    // Reload page
    await page.reload();

    // Tab should still be selected
    await expect(page.getByRole('tab', { name: /criteria coverage/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('should display scan coverage card with accurate values', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Check coverage card is visible
    await expect(page.getByRole('region', { name: /scan coverage/i })).toBeVisible();

    // Check coverage percentage
    await expect(page.getByText('42%')).toBeVisible();

    // Check criteria counts
    await expect(page.getByText('21')).toBeVisible(); // criteria checked
    await expect(page.getByText('50')).toBeVisible(); // total criteria

    // Check passed checks count
    await expect(page.getByText('50')).toBeVisible(); // passed checks
  });

  test('should show coverage breakdown in tooltip', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Find and hover over the criteria coverage info
    const coverageInfo = page.locator('[data-testid="criteria-coverage"]').first();
    if (await coverageInfo.isVisible()) {
      await coverageInfo.hover();

      // Check tooltip content
      await expect(page.getByText(/criteria with issues/i)).toBeVisible();
      await expect(page.getByText(/criteria passed/i)).toBeVisible();
    }
  });

  test('should handle scan with no criteria verifications gracefully', async ({ page }) => {
    // Override mock with no criteria data
    await page.route(`**/api/scans/${mockScanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockScanResult,
          enhancedCoverage: undefined,
        }),
      });
    });

    await page.goto(`/scan/${mockScanId}`);

    // Switch to criteria tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Should show empty state message
    await expect(page.getByText(/coverage data not available/i)).toBeVisible();
  });

  test('should sort criteria table by status', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Switch to criteria tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Click status column header to sort
    const statusHeader = page.getByRole('columnheader', { name: /status/i });
    if ((await statusHeader.getAttribute('aria-sort')) !== null) {
      await statusHeader.click();

      // First rows should be failed criteria after sorting
      const firstRow = page.getByRole('row').nth(1); // First data row
      await expect(firstRow).toContainText(/fail/i);
    }
  });

  test('should be keyboard accessible', async ({ page }) => {
    await page.goto(`/scan/${mockScanId}`);

    // Tab to reach the tabs
    await page.keyboard.press('Tab');

    // Use arrow keys to navigate between tabs
    await page.keyboard.press('ArrowRight');

    // Check criteria tab is focused
    const coverageTab = page.getByRole('tab', { name: /criteria coverage/i });
    await expect(coverageTab).toBeFocused();

    // Press Enter to activate
    await page.keyboard.press('Enter');

    // Tab should be selected
    await expect(coverageTab).toHaveAttribute('aria-selected', 'true');
  });
});

/**
 * E2E Tests: Axe-Core Passed Criteria Mapping
 *
 * Tests the integration of axe-core passed rule IDs with criteria coverage:
 * 1. Verify PASS status appears for criteria with passed axe-core rules
 * 2. Verify scanner field shows "axe-core" for passed criteria
 * 3. Verify multiple passed rules mapping to same criterion
 * 4. Verify end-to-end flow from scan results to criteria table display
 *
 * Related requirements: R3 (Display), R4 (Summary Alignment), R5 (Backward Compatibility)
 */
test.describe('Axe-Core Passed Criteria Mapping', () => {
  // Mock scan with comprehensive axe-core passed rule data
  const axeScanId = 'axe-passed-criteria-scan';
  const axeScanResult = {
    scanId: axeScanId,
    url: 'https://accessible-example.com',
    wcagLevel: 'AA',
    pageTitle: 'Accessible Example Page',
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: 1,
      critical: 0,
      serious: 1,
      moderate: 0,
      minor: 0,
      passedTests: 85,
    },
    coverage: {
      coveragePercentage: 58,
      criteriaChecked: 29,
      criteriaTotal: 50,
      passedChecks: 85,
      breakdown: {
        criteriaWithIssues: 1,
        criteriaPassed: 28,
        criteriaNotTestable: 21,
      },
    },
    enhancedCoverage: {
      criteriaVerifications: [
        // Criteria with PASS status from axe-core passed rules
        {
          criterionId: '1.3.1',
          name: 'Info and Relationships',
          level: 'A',
          status: 'PASS',
          scanner: 'axe-core',
        },
        {
          criterionId: '1.4.3',
          name: 'Contrast (Minimum)',
          level: 'AA',
          status: 'PASS',
          scanner: 'axe-core',
        },
        {
          criterionId: '2.1.1',
          name: 'Keyboard',
          level: 'A',
          status: 'PASS',
          scanner: 'axe-core',
        },
        {
          criterionId: '2.4.1',
          name: 'Bypass Blocks',
          level: 'A',
          status: 'PASS',
          scanner: 'axe-core',
        },
        {
          criterionId: '2.4.2',
          name: 'Page Titled',
          level: 'A',
          status: 'PASS',
          scanner: 'axe-core',
        },
        {
          criterionId: '2.4.4',
          name: 'Link Purpose (In Context)',
          level: 'A',
          status: 'PASS',
          scanner: 'axe-core',
        },
        {
          criterionId: '3.1.1',
          name: 'Language of Page',
          level: 'A',
          status: 'PASS',
          scanner: 'axe-core',
        },
        {
          criterionId: '4.1.2',
          name: 'Name, Role, Value',
          level: 'A',
          status: 'PASS',
          scanner: 'axe-core',
        },
        // One criterion with FAIL status
        {
          criterionId: '1.1.1',
          name: 'Non-text Content',
          level: 'A',
          status: 'FAIL',
          scanner: 'axe-core',
          relatedIssueIds: ['issue-1'],
        },
        // Criteria not testable by axe-core
        {
          criterionId: '1.2.1',
          name: 'Audio-only and Video-only (Prerecorded)',
          level: 'A',
          status: 'NOT_TESTED',
          scanner: 'N/A',
        },
        {
          criterionId: '1.4.10',
          name: 'Reflow',
          level: 'AA',
          status: 'NOT_TESTED',
          scanner: 'N/A',
        },
      ],
      criteriaChecked: 29,
      criteriaTotal: 50,
      aiModel: null,
    },
    issuesByImpact: {
      critical: [],
      serious: [
        {
          id: 'issue-1',
          ruleId: 'image-alt',
          description: 'Images must have alt text',
          helpText: 'Add alt text to all images',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/image-alt',
          wcagCriteria: ['1.1.1'],
          nodes: [
            {
              html: '<img src="decorative.png">',
              target: ['img[src="decorative.png"]'],
            },
          ],
        },
      ],
      moderate: [],
      minor: [],
    },
  };

  test.beforeEach(async ({ page }) => {
    // Mock scan status API
    await page.route(`**/api/scans/${axeScanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId: axeScanId,
          status: 'completed',
          url: 'https://accessible-example.com',
          wcagLevel: 'AA',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock scan results API
    await page.route(`**/api/scans/${axeScanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(axeScanResult),
      });
    });
  });

  test('should display PASS status for criteria with axe-core passed rules', async ({
    page,
  }) => {
    await page.goto(`/scan/${axeScanId}`);

    // Switch to Criteria Coverage tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Verify criteria table is visible
    await expect(page.getByRole('table')).toBeVisible();

    // Verify PASS status badges are displayed
    // Multiple criteria should show PASS from axe-core rules
    const passStatuses = page.getByRole('cell', { name: /^pass$/i });
    await expect(passStatuses.first()).toBeVisible();

    // Count should match our mock data (8 PASS criteria)
    await expect(passStatuses).toHaveCount(8);
  });

  test('should show "axe-core" as scanner for passed criteria', async ({ page }) => {
    await page.goto(`/scan/${axeScanId}`);

    // Switch to Criteria Coverage tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Verify axe-core scanner label appears for passed criteria
    const axeCoreLabels = page.getByRole('cell', { name: 'axe-core' });
    await expect(axeCoreLabels.first()).toBeVisible();

    // Count axe-core entries (8 PASS + 1 FAIL = 9 from axe-core)
    const axeCoreCount = await axeCoreLabels.count();
    expect(axeCoreCount).toBe(9);
  });

  test('should show "N/A" scanner for NOT_TESTED criteria', async ({ page }) => {
    await page.goto(`/scan/${axeScanId}`);

    // Switch to Criteria Coverage tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Verify N/A scanner label appears for not tested criteria
    const naLabels = page.getByRole('cell', { name: 'N/A' });
    await expect(naLabels.first()).toBeVisible();

    // Count should match mock data (2 NOT_TESTED criteria)
    await expect(naLabels).toHaveCount(2);
  });

  test('should correctly display specific passed criteria from axe-core rules', async ({
    page,
  }) => {
    await page.goto(`/scan/${axeScanId}`);

    // Switch to Criteria Coverage tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Verify specific criteria that passed from axe-core rules
    // Check for Contrast (Minimum) - criterion 1.4.3 (from color-contrast rule)
    await expect(page.getByText('1.4.3')).toBeVisible();
    await expect(page.getByText('Contrast (Minimum)')).toBeVisible();

    // Check for Language of Page - criterion 3.1.1 (from html-has-lang rule)
    await expect(page.getByText('3.1.1')).toBeVisible();
    await expect(page.getByText('Language of Page')).toBeVisible();

    // Check for Page Titled - criterion 2.4.2 (from document-title rule)
    await expect(page.getByText('2.4.2')).toBeVisible();
    await expect(page.getByText('Page Titled')).toBeVisible();
  });

  test('should show FAIL status when criterion has issues despite other passing rules', async ({
    page,
  }) => {
    await page.goto(`/scan/${axeScanId}`);

    // Switch to Criteria Coverage tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Verify criterion 1.1.1 shows FAIL (has issue even if other rules passed)
    await expect(page.getByText('1.1.1')).toBeVisible();
    await expect(page.getByText('Non-text Content')).toBeVisible();

    // The row with 1.1.1 should show FAIL status
    const failStatuses = page.getByRole('cell', { name: /^fail$/i });
    await expect(failStatuses.first()).toBeVisible();
    await expect(failStatuses).toHaveCount(1); // Only 1 FAIL in our mock
  });

  test('should correctly count criteria in coverage summary', async ({ page }) => {
    await page.goto(`/scan/${axeScanId}`);

    // Check coverage tab badge shows correct counts
    const coverageTab = page.getByRole('tab', { name: /criteria coverage/i });
    await expect(coverageTab).toContainText('29'); // criteria checked
    await expect(coverageTab).toContainText('50'); // total criteria
  });

  test('should filter to show only PASS criteria', async ({ page }) => {
    await page.goto(`/scan/${axeScanId}`);

    // Switch to Criteria Coverage tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Look for status filter
    const statusFilter = page.getByRole('combobox', { name: /filter by status/i });
    if (await statusFilter.isVisible()) {
      await statusFilter.click();

      // Select "Pass" filter
      await page.getByRole('option', { name: /pass/i }).click();

      // Should only show passed criteria (8 items)
      const tableRows = page.getByRole('row');
      // +1 for header row
      const rowCount = await tableRows.count();
      expect(rowCount).toBe(9); // 8 data rows + 1 header

      // All visible rows should have PASS status
      const passStatuses = page.getByRole('cell', { name: /^pass$/i });
      await expect(passStatuses).toHaveCount(8);
    }
  });

  test('should handle scan with no passed rules gracefully', async ({ page }) => {
    // Override mock with no passed criteria
    await page.route(`**/api/scans/${axeScanId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...axeScanResult,
          enhancedCoverage: {
            ...axeScanResult.enhancedCoverage,
            criteriaVerifications: [
              {
                criterionId: '1.1.1',
                name: 'Non-text Content',
                level: 'A',
                status: 'FAIL',
                scanner: 'axe-core',
                relatedIssueIds: ['issue-1'],
              },
              {
                criterionId: '1.4.3',
                name: 'Contrast (Minimum)',
                level: 'AA',
                status: 'NOT_TESTED',
                scanner: 'N/A',
              },
            ],
          },
        }),
      });
    });

    await page.goto(`/scan/${axeScanId}`);

    // Switch to Criteria Coverage tab
    await page.getByRole('tab', { name: /criteria coverage/i }).click();

    // Table should still render with available data
    await expect(page.getByRole('table')).toBeVisible();

    // Should show FAIL and NOT_TESTED but no PASS
    const passStatuses = page.getByRole('cell', { name: /^pass$/i });
    await expect(passStatuses).toHaveCount(0);
  });

  test('should maintain criteria display after page reload', async ({ page }) => {
    await page.goto(`/scan/${axeScanId}?tab=coverage`);

    // Verify table loads correctly
    await expect(page.getByRole('table')).toBeVisible();

    // Check PASS criteria are visible
    const passStatuses = page.getByRole('cell', { name: /^pass$/i });
    await expect(passStatuses.first()).toBeVisible();

    // Reload the page
    await page.reload();

    // Verify data persists after reload
    await expect(page.getByRole('table')).toBeVisible();
    const passStatusesAfterReload = page.getByRole('cell', { name: /^pass$/i });
    await expect(passStatusesAfterReload.first()).toBeVisible();
    await expect(passStatusesAfterReload).toHaveCount(8);
  });
});
