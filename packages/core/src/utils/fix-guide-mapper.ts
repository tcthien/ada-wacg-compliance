/**
 * Fix Guide Mapper Utility
 *
 * Provides utility functions for retrieving and working with fix guides.
 */

import { FIX_GUIDES, type FixGuide } from '../constants/fix-guides.constants.js';

/**
 * Get a fix guide for a specific axe-core rule ID
 *
 * @param ruleId - The axe-core rule ID (e.g., 'color-contrast', 'image-alt')
 * @returns The fix guide if available, undefined otherwise
 *
 * @example
 * ```typescript
 * const guide = getFixGuideByRuleId('color-contrast');
 * if (guide) {
 *   console.log(guide.summary);
 *   console.log(guide.steps);
 * }
 * ```
 */
export function getFixGuideByRuleId(ruleId: string): FixGuide | undefined {
  return FIX_GUIDES[ruleId];
}

/**
 * Get fix guides for multiple rule IDs
 *
 * @param ruleIds - Array of axe-core rule IDs
 * @returns Array of fix guides (skips rules without guides)
 *
 * @example
 * ```typescript
 * const guides = getFixGuidesByRuleIds(['color-contrast', 'image-alt', 'unknown-rule']);
 * // Returns guides for 'color-contrast' and 'image-alt' only
 * ```
 */
export function getFixGuidesByRuleIds(ruleIds: string[]): FixGuide[] {
  return ruleIds
    .map(ruleId => FIX_GUIDES[ruleId])
    .filter((guide): guide is FixGuide => guide !== undefined);
}

/**
 * Get all available fix guides
 *
 * @returns Array of all fix guides
 *
 * @example
 * ```typescript
 * const allGuides = getAllFixGuides();
 * console.log(`We have ${allGuides.length} fix guides available`);
 * ```
 */
export function getAllFixGuides(): FixGuide[] {
  return Object.values(FIX_GUIDES);
}

/**
 * Check if a fix guide exists for a given rule ID
 *
 * @param ruleId - The axe-core rule ID to check
 * @returns True if a fix guide exists, false otherwise
 *
 * @example
 * ```typescript
 * if (hasFixGuideForRule('color-contrast')) {
 *   // Show fix guide to user
 * } else {
 *   // Show generic WCAG documentation link
 * }
 * ```
 */
export function hasFixGuideForRule(ruleId: string): boolean {
  return ruleId in FIX_GUIDES;
}

/**
 * Get the number of available fix guides
 *
 * @returns The total count of fix guides
 *
 * @example
 * ```typescript
 * const count = getFixGuideCount();
 * console.log(`${count} fix guides available`);
 * ```
 */
export function getFixGuideCount(): number {
  return Object.keys(FIX_GUIDES).length;
}

/**
 * Search fix guides by keyword in summary or steps
 *
 * @param keyword - Search term to look for (case-insensitive)
 * @returns Array of fix guides matching the keyword
 *
 * @example
 * ```typescript
 * const colorGuides = searchFixGuides('color');
 * // Returns guides mentioning 'color' in summary or steps
 * ```
 */
export function searchFixGuides(keyword: string): FixGuide[] {
  const lowerKeyword = keyword.toLowerCase();

  return getAllFixGuides().filter(guide => {
    const summaryMatch = guide.summary.toLowerCase().includes(lowerKeyword);
    const stepsMatch = guide.steps.some(step =>
      step.toLowerCase().includes(lowerKeyword)
    );
    const ruleIdMatch = guide.ruleId.toLowerCase().includes(lowerKeyword);

    return summaryMatch || stepsMatch || ruleIdMatch;
  });
}
