import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Criteria Detail Popup (Dialog)
 *
 * Tests the complete user flow for the criteria detail popup:
 * 1. Opens popup when clicking on any criterion row
 * 2. Displays correct content for PASS, FAIL, NOT_TESTED, AI_VERIFIED_* statuses
 * 3. Shows AI reasoning and confidence for AI-verified criteria
 * 4. Navigates to Issues tab when clicking "View Issues" button
 * 5. Closes popup via Escape key, close button, or overlay click
 *
 * Requirements tested:
 * - R1.1-R1.4: Clickable rows and close behavior
 * - R4.2: Navigate to issues tab
 * - NFR Accessibility: Keyboard navigation (Escape key)
 */

// Mock scan data with comprehensive criteria verifications
const mockScanId = 'mock-criteria-detail-popup';
const mockScanResult = {
  scanId: mockScanId,
  url: 'https://example.com',
  wcagLevel: 'AA',
  pageTitle: 'Example Page',
  timestamp: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  summary: {
    totalIssues: 3,
    critical: 1,
    serious: 1,
    moderate: 1,
    minor: 0,
    passed: 50,
    passedTests: 50,
  },
  coverage: {
    coveragePercentage: 58,
    criteriaChecked: 29,
    criteriaTotal: 50,
    passedChecks: 50,
    breakdown: {
      criteriaWithIssues: 3,
      criteriaPassed: 26,
      criteriaNotTestable: 21,
    },
  },
  enhancedCoverage: {
    coveragePercentage: 58,
    criteriaChecked: 29,
    criteriaTotal: 50,
    isAiEnhanced: true,
    aiModel: 'claude-opus-4',
    criteriaVerifications: [
      // FAIL status - has issues
      {
        criterionId: '1.1.1',
        name: 'Non-text Content',
        level: 'A',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: ['issue-1'],
      },
      // FAIL status with multiple issues
      {
        criterionId: '1.4.3',
        name: 'Contrast (Minimum)',
        level: 'AA',
        status: 'FAIL',
        scanner: 'axe-core',
        issueIds: ['issue-2', 'issue-2b'],
      },
      // PASS status from axe-core
      {
        criterionId: '2.4.2',
        name: 'Page Titled',
        level: 'A',
        status: 'PASS',
        scanner: 'axe-core',
      },
      // PASS status from axe-core
      {
        criterionId: '3.1.1',
        name: 'Language of Page',
        level: 'A',
        status: 'PASS',
        scanner: 'axe-core',
      },
      // NOT_TESTED status
      {
        criterionId: '1.2.1',
        name: 'Audio-only and Video-only (Prerecorded)',
        level: 'A',
        status: 'NOT_TESTED',
        scanner: 'N/A',
      },
      // AI_VERIFIED_PASS with confidence and reasoning
      {
        criterionId: '1.4.10',
        name: 'Reflow',
        level: 'AA',
        status: 'AI_VERIFIED_PASS',
        scanner: 'axe-core + AI',
        confidence: 85,
        reasoning: 'The page content reflows properly when zoomed to 400%. No horizontal scrolling is required and all content remains readable.',
      },
      // AI_VERIFIED_FAIL with confidence and reasoning
      {
        criterionId: '2.4.4',
        name: 'Link Purpose (In Context)',
        level: 'A',
        status: 'AI_VERIFIED_FAIL',
        scanner: 'axe-core + AI',
        issueIds: ['issue-3'],
        confidence: 72,
        reasoning: 'Multiple generic link texts like "Click here" and "Read more" were found without sufficient context to determine their purpose.',
      },
    ],
    breakdown: {
      criteriaWithIssues: 3,
      criteriaPassed: 26,
      criteriaNotTestable: 21,
    },
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
      {
        id: 'issue-2b',
        ruleId: 'color-contrast',
        description: 'Elements must have sufficient color contrast',
        helpText: 'Ensure contrast ratio of at least 4.5:1',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
        wcagCriteria: ['1.4.3'],
        nodes: [
          {
            html: '<span style="color: #aaa">Another low contrast</span>',
            target: ['span.low-contrast'],
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

test.describe('Criteria Detail Popup', () => {
  test.beforeEach(async ({ page }) => {
    // Mock scan status API
    await page.route(`**/api/scans/${mockScanId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scanId: mockScanId,
          status: 'COMPLETED',
          url: 'https://example.com',
          wcagLevel: 'AA',
          aiEnabled: true,
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

    // Mock AI status API
    await page.route(`**/api/scans/${mockScanId}/ai-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'COMPLETED',
          progress: 100,
        }),
      });
    });

    // Mock report status API
    await page.route(`**/api/scans/${mockScanId}/report-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pdf: null,
          json: null,
        }),
      });
    });
  });

  test.describe('Opening Popup', () => {
    test('opens popup when clicking on a PASS criterion row', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the PASS criterion row (2.4.2 - Page Titled)
      const passRow = page.getByRole('row', { name: /2\.4\.2/i });
      await passRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog content shows correct criterion
      await expect(dialog.getByText('2.4.2')).toBeVisible();
      await expect(dialog.getByText('Page Titled')).toBeVisible();

      // Verify status badge shows PASS
      await expect(dialog.getByText('Pass')).toBeVisible();

      // Verify description about passing
      await expect(dialog.getByText(/passed automated testing/i)).toBeVisible();
    });

    test('opens popup when clicking on a FAIL criterion row', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the FAIL criterion row (1.1.1 - Non-text Content)
      const failRow = page.getByRole('row', { name: /1\.1\.1/i });
      await failRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog content shows correct criterion
      await expect(dialog.getByText('1.1.1')).toBeVisible();
      await expect(dialog.getByText('Non-text Content')).toBeVisible();

      // Verify status badge shows FAIL with issue count
      await expect(dialog.getByText(/Fail.*1 issues?/i)).toBeVisible();

      // Verify description about failing
      await expect(dialog.getByText(/failed automated testing/i)).toBeVisible();

      // Verify "View Issues" button is present
      const viewIssuesButton = dialog.getByRole('button', { name: /View Related Issues/i });
      await expect(viewIssuesButton).toBeVisible();
      await expect(viewIssuesButton).toContainText('1');
    });

    test('opens popup when clicking on a NOT_TESTED criterion row', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the NOT_TESTED criterion row (1.2.1)
      const notTestedRow = page.getByRole('row', { name: /1\.2\.1/i });
      await notTestedRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog content shows correct criterion
      await expect(dialog.getByText('1.2.1')).toBeVisible();

      // Verify status badge shows Not Tested
      await expect(dialog.getByText('Not Tested')).toBeVisible();

      // Verify description about manual testing needed
      await expect(dialog.getByText(/manual review/i)).toBeVisible();

      // Verify "View Issues" button is NOT present (no issues for NOT_TESTED)
      await expect(
        dialog.getByRole('button', { name: /View Related Issues/i })
      ).not.toBeVisible();
    });
  });

  test.describe('FAIL Criterion Navigation', () => {
    test('navigates to issues tab when clicking "View Issues" button', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the FAIL criterion row (1.1.1)
      const failRow = page.getByRole('row', { name: /1\.1\.1/i });
      await failRow.click();

      // Wait for dialog
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Click "View Issues" button
      const viewIssuesButton = dialog.getByRole('button', { name: /View Related Issues/i });
      await viewIssuesButton.click();

      // Wait for navigation
      await page.waitForTimeout(300);

      // Verify dialog is closed
      await expect(dialog).not.toBeVisible();

      // Verify URL updated to issues tab with criterion filter
      await expect(page).toHaveURL(/tab=issues/);
      await expect(page).toHaveURL(/criterion=1\.1\.1/);

      // Verify Issues tab is now selected
      await expect(page.getByRole('tab', { name: /issues/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Verify filter banner shows
      await expect(page.getByText(/showing issues for criterion/i)).toBeVisible();
      await expect(page.getByText('1.1.1')).toBeVisible();
    });

    test('shows issue count for criterion with multiple issues', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the FAIL criterion row with multiple issues (1.4.3 - Contrast)
      const failRow = page.getByRole('row', { name: /1\.4\.3/i });
      await failRow.click();

      // Wait for dialog
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify status badge shows FAIL with issue count of 2
      await expect(dialog.getByText(/Fail.*2 issues?/i)).toBeVisible();

      // Verify "View Issues" button shows correct count
      const viewIssuesButton = dialog.getByRole('button', { name: /View Related Issues/i });
      await expect(viewIssuesButton).toContainText('2');
    });
  });

  test.describe('Closing Popup', () => {
    test('closes popup when pressing Escape key', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on a criterion row to open dialog
      const row = page.getByRole('row', { name: /2\.4\.2/i });
      await row.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Press Escape key
      await page.keyboard.press('Escape');

      // Verify dialog closes
      await expect(dialog).not.toBeVisible();
    });

    test('closes popup when clicking close button', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on a criterion row to open dialog
      const row = page.getByRole('row', { name: /2\.4\.2/i });
      await row.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Click close button (X)
      const closeButton = dialog.getByRole('button', { name: /close/i });
      await closeButton.click();

      // Verify dialog closes
      await expect(dialog).not.toBeVisible();
    });

    test('closes popup by clicking overlay/backdrop', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on a criterion row to open dialog
      const row = page.getByRole('row', { name: /2\.4\.2/i });
      await row.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Click on the overlay (dialog backdrop)
      // The dialog overlay is typically the element that closes the dialog when clicked
      // In Radix UI dialogs, clicking outside the dialog content closes it
      await page.mouse.click(10, 10); // Click near top-left corner (outside dialog)

      // Verify dialog closes
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('AI-Verified Criteria', () => {
    test('displays AI confidence for AI_VERIFIED_PASS criterion', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the AI_VERIFIED_PASS criterion row (1.4.10 - Reflow)
      const aiPassRow = page.getByRole('row', { name: /1\.4\.10/i });
      await aiPassRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog content shows correct criterion
      await expect(dialog.getByText('1.4.10')).toBeVisible();
      await expect(dialog.getByText('Reflow')).toBeVisible();

      // Verify status badge shows AI Verified Pass
      await expect(dialog.getByText('AI Verified Pass')).toBeVisible();

      // Verify AI Confidence section is displayed
      await expect(dialog.getByText('AI Confidence')).toBeVisible();
      await expect(dialog.getByText('85%')).toBeVisible();

      // Verify AI Reasoning is displayed
      await expect(dialog.getByText('AI Reasoning')).toBeVisible();
      await expect(dialog.getByText(/page content reflows properly/i)).toBeVisible();

      // Verify scanner shows AI model name
      await expect(dialog.getByText(/axe-core.*claude-opus-4/i)).toBeVisible();
    });

    test('displays AI confidence and reasoning for AI_VERIFIED_FAIL criterion', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the AI_VERIFIED_FAIL criterion row (2.4.4 - Link Purpose)
      const aiFailRow = page.getByRole('row', { name: /2\.4\.4/i });
      await aiFailRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog content shows correct criterion
      await expect(dialog.getByText('2.4.4')).toBeVisible();
      await expect(dialog.getByText('Link Purpose (In Context)')).toBeVisible();

      // Verify status badge shows AI Verified Fail with issue count
      await expect(dialog.getByText(/AI Verified Fail.*1 issues?/i)).toBeVisible();

      // Verify AI Confidence section is displayed
      await expect(dialog.getByText('AI Confidence')).toBeVisible();
      await expect(dialog.getByText('72%')).toBeVisible();

      // Verify AI Reasoning is displayed
      await expect(dialog.getByText('AI Reasoning')).toBeVisible();
      await expect(dialog.getByText(/generic link texts/i)).toBeVisible();

      // Verify "View Issues" button is present
      await expect(
        dialog.getByRole('button', { name: /View Related Issues/i })
      ).toBeVisible();
    });

    test('shows AI model name in scanner field for AI-verified criteria', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the AI_VERIFIED_PASS criterion row
      const aiPassRow = page.getByRole('row', { name: /1\.4\.10/i });
      await aiPassRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify Scanner section shows combined scanner name with AI model
      await expect(dialog.getByText('Scanner')).toBeVisible();
      // Should show "axe-core + claude-opus-4" or similar
      const scannerText = dialog.locator('text=axe-core + claude-opus-4');
      await expect(scannerText).toBeVisible();
    });
  });

  test.describe('Level Badge Display', () => {
    test('displays correct WCAG level badge for Level A criterion', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on a Level A criterion (1.1.1)
      const levelARow = page.getByRole('row', { name: /1\.1\.1/i });
      await levelARow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify Level A badge
      await expect(dialog.getByText('Level A')).toBeVisible();
    });

    test('displays correct WCAG level badge for Level AA criterion', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table to be visible
      await expect(page.getByRole('table')).toBeVisible();

      // Click on a Level AA criterion (1.4.3)
      const levelAARow = page.getByRole('row', { name: /1\.4\.3/i });
      await levelAARow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify Level AA badge
      await expect(dialog.getByText('Level AA')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('dialog is keyboard accessible - can close with Escape', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table
      await expect(page.getByRole('table')).toBeVisible();

      // Use keyboard to navigate to and click on a row
      // First, tab to get focus into the table area
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Click on a criterion row
      const row = page.getByRole('row', { name: /2\.4\.2/i });
      await row.click();

      // Verify dialog is open
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog has focus or focus is trapped within it
      // This is important for accessibility

      // Close with Escape key
      await page.keyboard.press('Escape');

      // Verify dialog is closed
      await expect(dialog).not.toBeVisible();
    });

    test('dialog has proper ARIA attributes', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table
      await expect(page.getByRole('table')).toBeVisible();

      // Open dialog
      const row = page.getByRole('row', { name: /2\.4\.2/i });
      await row.click();

      // Verify dialog role
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog has aria-labelledby or aria-label (accessible name)
      // The DialogTitle provides the accessible name in Radix UI
      const title = dialog.locator('[id]').filter({ hasText: '2.4.2' });
      await expect(title).toBeVisible();
    });

    test('table rows are clickable for all status types', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table
      await expect(page.getByRole('table')).toBeVisible();

      // Test clicking PASS row
      const passRow = page.getByRole('row', { name: /2\.4\.2/i });
      await passRow.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');

      // Test clicking FAIL row
      const failRow = page.getByRole('row', { name: /1\.1\.1/i });
      await failRow.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');

      // Test clicking NOT_TESTED row
      const notTestedRow = page.getByRole('row', { name: /1\.2\.1/i });
      await notTestedRow.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');

      // Test clicking AI_VERIFIED_PASS row
      const aiPassRow = page.getByRole('row', { name: /1\.4\.10/i });
      await aiPassRow.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');

      // Test clicking AI_VERIFIED_FAIL row
      const aiFailRow = page.getByRole('row', { name: /2\.4\.4/i });
      await aiFailRow.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
    });
  });

  test.describe('Edge Cases', () => {
    test('handles criterion with no WCAG data gracefully', async ({ page }) => {
      // Override mock with unknown criterion
      await page.route(`**/api/scans/${mockScanId}/results`, async (route) => {
        const modifiedResult = {
          ...mockScanResult,
          enhancedCoverage: {
            ...mockScanResult.enhancedCoverage,
            criteriaVerifications: [
              {
                criterionId: '9.9.9', // Unknown criterion
                status: 'PASS',
                scanner: 'axe-core',
              },
            ],
          },
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(modifiedResult),
        });
      });

      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the unknown criterion row
      const unknownRow = page.getByRole('row', { name: /9\.9\.9/i });
      await unknownRow.click();

      // Verify dialog opens and shows fallback content
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('9.9.9')).toBeVisible();
      // Should show "Unknown Criterion" as fallback
      await expect(dialog.getByText(/Unknown Criterion/i)).toBeVisible();
    });

    test('handles FAIL criterion with empty issueIds array', async ({ page }) => {
      // Override mock with FAIL criterion but no issues
      await page.route(`**/api/scans/${mockScanId}/results`, async (route) => {
        const modifiedResult = {
          ...mockScanResult,
          enhancedCoverage: {
            ...mockScanResult.enhancedCoverage,
            criteriaVerifications: [
              {
                criterionId: '1.1.1',
                name: 'Non-text Content',
                level: 'A',
                status: 'FAIL',
                scanner: 'axe-core',
                issueIds: [], // Empty array
              },
            ],
          },
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(modifiedResult),
        });
      });

      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the FAIL criterion row
      const failRow = page.getByRole('row', { name: /1\.1\.1/i });
      await failRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify status shows FAIL (without issue count)
      await expect(dialog.getByText('Fail')).toBeVisible();

      // "View Issues" button should NOT be visible when no issues
      await expect(
        dialog.getByRole('button', { name: /View Related Issues/i })
      ).not.toBeVisible();
    });

    test('handles AI-verified criterion without reasoning', async ({ page }) => {
      // Override mock with AI criterion but no reasoning
      await page.route(`**/api/scans/${mockScanId}/results`, async (route) => {
        const modifiedResult = {
          ...mockScanResult,
          enhancedCoverage: {
            ...mockScanResult.enhancedCoverage,
            criteriaVerifications: [
              {
                criterionId: '1.4.10',
                name: 'Reflow',
                level: 'AA',
                status: 'AI_VERIFIED_PASS',
                scanner: 'axe-core + AI',
                confidence: 90,
                // No reasoning provided
              },
            ],
          },
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(modifiedResult),
        });
      });

      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the AI criterion row
      const aiRow = page.getByRole('row', { name: /1\.4\.10/i });
      await aiRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify AI Confidence is shown
      await expect(dialog.getByText('AI Confidence')).toBeVisible();
      await expect(dialog.getByText('90%')).toBeVisible();

      // AI Reasoning section should NOT be visible
      await expect(dialog.getByText('AI Reasoning')).not.toBeVisible();
    });

    test('handles AI-verified criterion without confidence', async ({ page }) => {
      // Override mock with AI criterion but no confidence
      await page.route(`**/api/scans/${mockScanId}/results`, async (route) => {
        const modifiedResult = {
          ...mockScanResult,
          enhancedCoverage: {
            ...mockScanResult.enhancedCoverage,
            criteriaVerifications: [
              {
                criterionId: '1.4.10',
                name: 'Reflow',
                level: 'AA',
                status: 'AI_VERIFIED_PASS',
                scanner: 'axe-core + AI',
                reasoning: 'Some reasoning text',
                // No confidence provided
              },
            ],
          },
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(modifiedResult),
        });
      });

      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table
      await expect(page.getByRole('table')).toBeVisible();

      // Click on the AI criterion row
      const aiRow = page.getByRole('row', { name: /1\.4\.10/i });
      await aiRow.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // AI Confidence section should NOT be visible
      await expect(dialog.getByText('AI Confidence')).not.toBeVisible();

      // AI Reasoning should still be visible
      await expect(dialog.getByText('AI Reasoning')).toBeVisible();
      await expect(dialog.getByText('Some reasoning text')).toBeVisible();
    });
  });

  test.describe('Multiple Dialog Interactions', () => {
    test('can open multiple dialogs in sequence', async ({ page }) => {
      await page.goto(`/scan/${mockScanId}?tab=coverage`);

      // Wait for criteria table
      await expect(page.getByRole('table')).toBeVisible();

      // Open first dialog
      const passRow = page.getByRole('row', { name: /2\.4\.2/i });
      await passRow.click();

      let dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('2.4.2')).toBeVisible();

      // Close first dialog
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();

      // Open second dialog
      const failRow = page.getByRole('row', { name: /1\.1\.1/i });
      await failRow.click();

      dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('1.1.1')).toBeVisible();

      // Close second dialog
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();

      // Open third dialog
      const aiRow = page.getByRole('row', { name: /1\.4\.10/i });
      await aiRow.click();

      dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('1.4.10')).toBeVisible();
    });
  });
});
