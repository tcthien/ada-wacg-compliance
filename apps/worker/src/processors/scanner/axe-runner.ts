import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { AxeResults } from 'axe-core';
import type { WcagLevel } from '@adashield/core/types';

/**
 * Axe-core Test Runner
 *
 * Orchestrates axe-core accessibility analysis with Playwright.
 * Configures axe-core to test against specific WCAG conformance levels
 * and returns comprehensive results including violations, passes, and inapplicable rules.
 */

/**
 * WCAG tag mapping for axe-core
 *
 * Maps our WCAG levels to axe-core tag sets.
 * Tags are cumulative (AA includes A tags, AAA includes A and AA tags).
 */
const WCAG_TAG_MAPPING: Record<WcagLevel, string[]> = {
  // Level A: Basic web accessibility (WCAG 2.0, 2.1, 2.2)
  A: ['wcag2a', 'wcag21a', 'wcag22a'],

  // Level AA: Enhanced accessibility (most common compliance target)
  AA: ['wcag2a', 'wcag21a', 'wcag22a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],

  // Level AAA: Maximum accessibility (comprehensive coverage)
  AAA: [
    'wcag2a',
    'wcag21a',
    'wcag22a',
    'wcag2aa',
    'wcag21aa',
    'wcag22aa',
    'wcag2aaa',
    'wcag21aaa',
    'wcag22aaa',
  ],
};

/**
 * Get axe-core tags for a specific WCAG conformance level
 *
 * @param level - WCAG conformance level (A, AA, or AAA)
 * @returns Array of axe-core tags to use for analysis
 */
export function getWcagTags(level: WcagLevel): string[] {
  return WCAG_TAG_MAPPING[level];
}

/**
 * Run axe-core accessibility analysis on a Playwright page
 *
 * Configures and executes axe-core with appropriate WCAG tags.
 * Returns comprehensive results including:
 * - violations: Accessibility issues found
 * - passes: Rules that passed
 * - incomplete: Rules that need manual review
 * - inapplicable: Rules that don't apply to this page
 *
 * @param page - Playwright page instance (must be already navigated)
 * @param wcagLevel - WCAG conformance level to test against
 * @returns Promise resolving to axe-core results
 *
 * @throws {Error} If axe-core analysis fails
 *
 * @example
 * ```typescript
 * const page = await browser.newPage();
 * await page.goto('https://example.com');
 * const results = await runAxeAnalysis(page, 'AA');
 * console.log(`Found ${results.violations.length} violations`);
 * ```
 */
export async function runAxeAnalysis(
  page: Page,
  wcagLevel: WcagLevel
): Promise<AxeResults> {
  try {
    // Get WCAG tags for the specified conformance level
    const tags = getWcagTags(wcagLevel);

    // Configure and run axe-core analysis
    const results = await new AxeBuilder({ page })
      .withTags(tags)
      // Additional configuration for better results
      .options({
        runOnly: {
          type: 'tag',
          values: tags,
        },
        // Include best practices for comprehensive coverage
        rules: {
          // Ensure color contrast checks run (can be slow but important)
          'color-contrast': { enabled: true },
        },
      })
      .analyze();

    return results;
  } catch (error) {
    // Wrap axe-core errors with additional context
    throw new Error(
      `axe-core analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Run axe-core analysis with custom rule configuration
 *
 * Advanced method for fine-grained control over which rules run.
 * Useful for testing specific WCAG criteria or debugging.
 *
 * @param page - Playwright page instance
 * @param ruleIds - Array of specific axe-core rule IDs to run
 * @returns Promise resolving to axe-core results
 */
export async function runAxeAnalysisWithRules(
  page: Page,
  ruleIds: string[]
): Promise<AxeResults> {
  try {
    const results = await new AxeBuilder({ page })
      .options({
        runOnly: {
          type: 'rule',
          values: ruleIds,
        },
      })
      .analyze();

    return results;
  } catch (error) {
    throw new Error(
      `axe-core analysis with custom rules failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
