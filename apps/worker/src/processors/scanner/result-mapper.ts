import type { Result, NodeResult } from 'axe-core';
import type { IssueImpact, IssueNode } from '@adashield/core/types';
import { getWCAGForAxeRule } from '@adashield/core';
import { sanitizeHtml } from './html-sanitizer.js';
import { randomUUID } from 'crypto';

/**
 * Result Mapper for axe-core to ADAShield Issue format
 *
 * Transforms axe-core violation results into our standardized Issue format.
 * Handles:
 * - Impact level mapping (critical/serious/moderate/minor)
 * - WCAG criteria extraction from rule tags
 * - HTML snippet sanitization
 * - Node aggregation for multi-element violations
 */

/**
 * Mapped issue ready for database storage
 * Subset of full Issue type (scanResultId and createdAt added by processor)
 */
export interface MappedIssue {
  id: string;
  ruleId: string;
  impact: IssueImpact;
  description: string;
  helpText: string;
  helpUrl: string;
  wcagCriteria: string[];
  cssSelector: string;
  htmlSnippet: string;
  nodes: IssueNode[];
}

/**
 * Map axe-core impact level to our IssueImpact enum
 *
 * axe-core uses: critical, serious, moderate, minor, null/undefined
 * We normalize to uppercase and default to MODERATE for unknown values
 *
 * @param axeImpact - Impact level from axe-core
 * @returns Normalized IssueImpact enum value
 */
export function mapImpact(axeImpact: string | null | undefined): IssueImpact {
  if (!axeImpact) {
    return 'MODERATE';
  }

  const mapping: Record<string, IssueImpact> = {
    critical: 'CRITICAL',
    serious: 'SERIOUS',
    moderate: 'MODERATE',
    minor: 'MINOR',
  };

  return mapping[axeImpact.toLowerCase()] || 'MODERATE';
}

/**
 * Extract WCAG criteria from axe-core rule tags
 *
 * axe-core tags include: wcag2a, wcag21aa, wcag412, etc.
 * We extract numeric criterion IDs (e.g., "1.1.1", "4.1.2")
 *
 * Also uses our centralized mapping from core package for comprehensive coverage.
 *
 * @param tags - Array of tags from axe-core rule
 * @param ruleId - axe-core rule ID for mapping lookup
 * @returns Array of WCAG criterion IDs (e.g., ["1.1.1", "4.1.2"])
 */
export function extractWcagCriteria(tags: string[], ruleId: string): string[] {
  const criteriaSet = new Set<string>();

  // Method 1: Extract from tags (e.g., "wcag412" -> "4.1.2")
  tags.forEach((tag) => {
    const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
    if (match) {
      const [, major, minor, patch] = match;
      criteriaSet.add(`${major}.${minor}.${patch}`);
    }
  });

  // Method 2: Use centralized mapping from core package
  const mappedCriteria = getWCAGForAxeRule(ruleId);
  mappedCriteria.forEach((criterion) => {
    criteriaSet.add(criterion.id);
  });

  // Return as sorted array for consistency
  return Array.from(criteriaSet).sort();
}

/**
 * Map a single axe-core node result to our IssueNode format
 *
 * @param node - Node result from axe-core
 * @returns Mapped IssueNode with sanitized HTML
 */
export function mapNode(node: NodeResult): IssueNode {
  // Convert axe-core target selector to string array
  // axe-core uses UnlabelledFrameSelector which can be nested arrays
  const target: string[] = node.target.map((selector) => {
    if (typeof selector === 'string') {
      return selector;
    }
    // For nested selectors (iframe contexts), join with ' '
    return Array.isArray(selector) ? selector.join(' ') : String(selector);
  });

  return {
    html: sanitizeHtml(node.html),
    target,
    failureSummary: node.failureSummary || undefined,
  };
}

/**
 * Map axe-core violations to ADAShield Issue format
 *
 * Each axe-core violation can affect multiple DOM nodes.
 * We create ONE issue per violation with all affected nodes included.
 *
 * This approach:
 * - Reduces database bloat (vs. one issue per node)
 * - Groups related issues together
 * - Preserves all node-specific context
 *
 * @param violations - Array of violations from axe-core results
 * @returns Array of mapped issues ready for storage
 *
 * @example
 * ```typescript
 * const axeResults = await runAxeAnalysis(page, 'AA');
 * const issues = mapAxeViolations(axeResults.violations);
 * console.log(`Mapped ${issues.length} issues from ${axeResults.violations.length} violations`);
 * ```
 */
export function mapAxeViolations(
  violations: Result[]
): MappedIssue[] {
  return violations.map((violation: Result): MappedIssue => {
    // Map all affected nodes
    const nodes = violation.nodes.map(mapNode);

    // Use first node's selector as primary (most representative)
    const primaryNode = violation.nodes[0];
    const cssSelector = primaryNode?.target.join(' ') || '';
    const htmlSnippet = primaryNode?.html
      ? sanitizeHtml(primaryNode.html)
      : '';

    // Extract WCAG criteria from tags
    const wcagCriteria = extractWcagCriteria(violation.tags, violation.id);

    return {
      id: randomUUID(),
      ruleId: violation.id,
      impact: mapImpact(violation.impact),
      description: violation.description,
      helpText: violation.help,
      helpUrl: violation.helpUrl,
      wcagCriteria,
      cssSelector,
      htmlSnippet,
      nodes,
    };
  });
}

/**
 * Get summary statistics from mapped issues
 *
 * Useful for reporting and quick assessment of scan results.
 *
 * @param issues - Array of mapped issues
 * @returns Summary object with counts by impact level
 */
export function getIssueSummary(issues: MappedIssue[]): {
  total: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
} {
  const summary = {
    total: issues.length,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  issues.forEach((issue) => {
    switch (issue.impact) {
      case 'CRITICAL':
        summary.critical++;
        break;
      case 'SERIOUS':
        summary.serious++;
        break;
      case 'MODERATE':
        summary.moderate++;
        break;
      case 'MINOR':
        summary.minor++;
        break;
    }
  });

  return summary;
}
