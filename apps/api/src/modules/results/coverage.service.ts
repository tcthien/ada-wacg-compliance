/**
 * Coverage Service
 *
 * Calculates WCAG criteria coverage metrics for scan results.
 * Provides differentiated coverage percentages based on scan type (standard vs AI-enhanced).
 */

import {
  WCAG_CRITERIA,
  AXE_RULE_TO_WCAG,
  getCriteriaUpToLevel,
  type WCAGLevel,
} from '@adashield/core/constants';
import type { Issue, WcagLevel } from '@adashield/core/types';

/**
 * AI scan status values
 */
export type AiStatus = 'PENDING' | 'DOWNLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Coverage breakdown by criteria status
 */
export interface CoverageBreakdown {
  /** Number of criteria with issues found */
  criteriaWithIssues: number;
  /** Number of criteria that passed */
  criteriaPassed: number;
  /** Number of criteria not testable by automation */
  criteriaNotTestable: number;
}

/**
 * Coverage metrics for scan results
 */
export interface CoverageMetrics {
  /** Coverage percentage (57 for standard, 80 for AI-enhanced) */
  coveragePercentage: number;
  /** Number of unique WCAG criteria checked */
  criteriaChecked: number;
  /** Total WCAG criteria for the conformance level */
  criteriaTotal: number;
  /** Whether the scan is AI-enhanced */
  isAiEnhanced: boolean;
  /** Breakdown by criteria status */
  breakdown: CoverageBreakdown;
}

/**
 * Scan result data needed for coverage calculation
 */
export interface ScanResultData {
  /** Number of passed accessibility checks */
  passedChecks: number;
  /** Number of inapplicable checks */
  inapplicableChecks: number;
}

/**
 * Coverage percentage constants
 * Based on research: axe-core detects ~57%, AI-enhanced reaches ~75-85%
 */
const STANDARD_COVERAGE_PERCENTAGE = 57;
const AI_ENHANCED_COVERAGE_PERCENTAGE = 80; // Midpoint of 75-85 range

/**
 * Coverage Service
 *
 * Calculates WCAG criteria coverage and detection percentages for scan results.
 */
export class CoverageService {
  /**
   * Calculate coverage metrics for a scan result
   *
   * @param scanResult - Scan result data with passed/inapplicable checks
   * @param issues - Array of issues from the scan
   * @param wcagLevel - Target WCAG conformance level
   * @param aiEnabled - Whether AI enhancement was requested
   * @param aiStatus - Current AI processing status (null if not applicable)
   * @returns Coverage metrics including percentage, criteria counts, and breakdown
   *
   * @example
   * ```typescript
   * const service = new CoverageService();
   * const metrics = service.calculateCoverage(
   *   { passedChecks: 50, inapplicableChecks: 10 },
   *   issues,
   *   'AA',
   *   true,
   *   'COMPLETED'
   * );
   * console.log(`Coverage: ${metrics.coveragePercentage}%`);
   * console.log(`Criteria: ${metrics.criteriaChecked}/${metrics.criteriaTotal}`);
   * ```
   */
  calculateCoverage(
    scanResult: ScanResultData,
    issues: Issue[],
    wcagLevel: WcagLevel,
    aiEnabled: boolean,
    aiStatus: AiStatus | null
  ): CoverageMetrics {
    // Determine if AI enhancement is completed
    const isAiEnhanced = aiEnabled && aiStatus === 'COMPLETED';

    // Get coverage percentage based on scan type
    const coveragePercentage = isAiEnhanced
      ? AI_ENHANCED_COVERAGE_PERCENTAGE
      : STANDARD_COVERAGE_PERCENTAGE;

    // Get total criteria for the WCAG level
    const criteriaTotal = this.getCriteriaCountForLevel(wcagLevel);

    // Calculate unique criteria from issues
    const criteriaWithIssues = this.getUniqueCriteriaFromIssues(issues);

    // Calculate criteria from passed checks (mapped from axe rules)
    const criteriaPassed = this.estimateCriteriaFromPassedChecks(scanResult.passedChecks);

    // Calculate criteria not testable by automation
    const criteriaNotTestable = criteriaTotal - criteriaWithIssues.size - criteriaPassed;

    // Total criteria checked = issues + passed (no overlap assumed)
    const criteriaChecked = criteriaWithIssues.size + criteriaPassed;

    return {
      coveragePercentage,
      criteriaChecked: Math.min(criteriaChecked, criteriaTotal), // Cap at total
      criteriaTotal,
      isAiEnhanced,
      breakdown: {
        criteriaWithIssues: criteriaWithIssues.size,
        criteriaPassed,
        criteriaNotTestable: Math.max(0, criteriaNotTestable), // Ensure non-negative
      },
    };
  }

  /**
   * Get WCAG criteria count for a conformance level
   *
   * @param level - WCAG conformance level (A, AA, AAA)
   * @returns Number of criteria for that level
   */
  getCriteriaCountForLevel(level: WcagLevel): number {
    const normalizedLevel = level.toUpperCase() as WCAGLevel;
    const criteria = getCriteriaUpToLevel(normalizedLevel);
    return criteria.length;
  }

  /**
   * Extract unique WCAG criteria IDs from issues
   *
   * @param issues - Array of issues with wcagCriteria field
   * @returns Set of unique WCAG criteria IDs
   */
  private getUniqueCriteriaFromIssues(issues: Issue[]): Set<string> {
    const criteria = new Set<string>();

    for (const issue of issues) {
      if (issue.wcagCriteria && Array.isArray(issue.wcagCriteria)) {
        for (const criterion of issue.wcagCriteria) {
          if (criterion && WCAG_CRITERIA[criterion]) {
            criteria.add(criterion);
          }
        }
      }
    }

    return criteria;
  }

  /**
   * Estimate number of criteria covered by passed checks
   *
   * This uses a heuristic based on the number of passed checks and
   * the known axe-core rule-to-WCAG mapping. Each passed check may
   * cover multiple criteria.
   *
   * @param passedChecks - Number of passed accessibility checks
   * @returns Estimated number of unique criteria covered
   */
  private estimateCriteriaFromPassedChecks(passedChecks: number): number {
    if (passedChecks === 0) {
      return 0;
    }

    // Get unique criteria from all axe rules
    const uniqueCriteria = new Set<string>();
    for (const wcagIds of Object.values(AXE_RULE_TO_WCAG)) {
      for (const id of wcagIds) {
        uniqueCriteria.add(id);
      }
    }

    const totalAxeRules = Object.keys(AXE_RULE_TO_WCAG).length;
    const totalMappedCriteria = uniqueCriteria.size;

    // Estimate: ratio of passed checks to total rules × mapped criteria
    // This is a rough estimate since we don't know which specific rules passed
    const estimatedRatio = Math.min(passedChecks / totalAxeRules, 1);
    return Math.round(estimatedRatio * totalMappedCriteria);
  }
}

/**
 * Singleton instance for convenience
 */
export const coverageService = new CoverageService();
