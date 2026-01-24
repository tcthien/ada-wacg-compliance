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
  UNTESTABLE_CRITERIA,
  type WCAGLevel,
} from '@adashield/core/constants';
import type { Issue, WcagLevel, CriteriaVerification, CriteriaStatus, CriteriaVerificationSummary, EnhancedCoverageMetrics, BuildCriteriaVerificationsInput } from '@adashield/core/types';

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

  /**
   * Build criteria verifications from scan data, issues, and AI results
   *
   * This creates a verification record for each WCAG criterion:
   * 1. Maps axe-core passed rules to criteria (status: PASS)
   * 2. Maps issues to criteria (status: FAIL)
   * 3. Merges AI verifications (AI takes precedence for verified criteria)
   * 4. Marks remaining as NOT_TESTED
   *
   * @param input - Input data for building verifications
   * @returns Array of criteria verifications
   */
  buildCriteriaVerifications(input: BuildCriteriaVerificationsInput): CriteriaVerification[] {
    const { issues, wcagLevel, passedChecks = [], aiVerifications = [], aiModel } = input;
    const normalizedLevel = wcagLevel.toUpperCase() as WCAGLevel;

    // Get all criteria for the WCAG level
    const allCriteria = getCriteriaUpToLevel(normalizedLevel);
    const criteriaMap = new Map<string, CriteriaVerification>();

    // Initialize all criteria as NOT_TESTED
    for (const criterion of allCriteria) {
      criteriaMap.set(criterion.id, {
        criterionId: criterion.id,
        status: 'NOT_TESTED',
        scanner: 'N/A',
      });
    }

    // Map axe-core passed rules to criteria (status: PASS)
    const passedCriteria = this.mapPassedChecksToCriteria(passedChecks);
    for (const criterionId of passedCriteria) {
      if (criteriaMap.has(criterionId)) {
        criteriaMap.set(criterionId, {
          criterionId,
          status: 'PASS',
          scanner: 'axe-core',
        });
      }
    }

    // Map issues to criteria (status: FAIL)
    const issueByCriteria = this.groupIssuesByCriteria(issues);
    for (const [criterionId, issueList] of issueByCriteria) {
      if (criteriaMap.has(criterionId)) {
        criteriaMap.set(criterionId, {
          criterionId,
          status: 'FAIL',
          scanner: 'axe-core',
          issueIds: issueList.map(i => i.id),
        });
      }
    }

    // Merge AI verifications (AI takes precedence)
    for (const aiVerification of aiVerifications) {
      if (criteriaMap.has(aiVerification.criterionId)) {
        const existing = criteriaMap.get(aiVerification.criterionId)!;
        const isAiStatus = aiVerification.status === 'AI_VERIFIED_PASS' || aiVerification.status === 'AI_VERIFIED_FAIL';

        if (isAiStatus) {
          // AI verification takes precedence, but preserve issue links if it's a FAIL
          const scanner = existing.scanner === 'axe-core' && isAiStatus
            ? 'axe-core + AI'
            : aiModel || 'AI';

          criteriaMap.set(aiVerification.criterionId, {
            criterionId: aiVerification.criterionId,
            status: aiVerification.status,
            scanner,
            issueIds: existing.issueIds || aiVerification.issueIds,
            confidence: aiVerification.confidence,
            reasoning: aiVerification.reasoning,
          });
        }
      }
    }

    return Array.from(criteriaMap.values());
  }

  /**
   * Map passed axe-core check rule IDs to WCAG criteria IDs
   */
  private mapPassedChecksToCriteria(passedChecks: string[]): Set<string> {
    const criteria = new Set<string>();

    for (const ruleId of passedChecks) {
      const wcagIds = AXE_RULE_TO_WCAG[ruleId];
      if (wcagIds) {
        for (const id of wcagIds) {
          criteria.add(id);
        }
      }
    }

    return criteria;
  }

  /**
   * Group issues by their WCAG criteria
   */
  private groupIssuesByCriteria(issues: Array<{ id: string; wcagCriteria: string[] }>): Map<string, Array<{ id: string; wcagCriteria: string[] }>> {
    const byCriteria = new Map<string, Array<{ id: string; wcagCriteria: string[] }>>();

    for (const issue of issues) {
      if (issue.wcagCriteria && Array.isArray(issue.wcagCriteria)) {
        for (const criterionId of issue.wcagCriteria) {
          if (criterionId && WCAG_CRITERIA[criterionId]) {
            if (!byCriteria.has(criterionId)) {
              byCriteria.set(criterionId, []);
            }
            byCriteria.get(criterionId)!.push(issue);
          }
        }
      }
    }

    return byCriteria;
  }

  /**
   * Calculate coverage metrics from criteria verifications
   *
   * This computes ACTUAL coverage percentage based on verified criteria,
   * not theoretical percentages (e.g., "57%" or "75-85%").
   *
   * Formula: coveragePercentage = (criteriaChecked / criteriaTotal) * 100
   * Where criteriaChecked = PASS + FAIL + AI_VERIFIED_PASS + AI_VERIFIED_FAIL
   *
   * @param verifications - Array of criteria verifications
   * @param wcagLevel - Target WCAG conformance level
   * @returns Enhanced coverage metrics with actual computed values
   */
  calculateCoverageFromVerifications(
    verifications: CriteriaVerification[],
    wcagLevel: WcagLevel
  ): EnhancedCoverageMetrics {
    const normalizedLevel = wcagLevel.toUpperCase() as WCAGLevel;
    const criteriaTotal = getCriteriaUpToLevel(normalizedLevel).length;

    // Count by status
    let passed = 0;
    let failed = 0;
    let aiPassed = 0;
    let aiFailed = 0;
    let notTested = 0;

    for (const v of verifications) {
      switch (v.status) {
        case 'PASS':
          passed++;
          break;
        case 'FAIL':
          failed++;
          break;
        case 'AI_VERIFIED_PASS':
          aiPassed++;
          break;
        case 'AI_VERIFIED_FAIL':
          aiFailed++;
          break;
        case 'NOT_TESTED':
          notTested++;
          break;
      }
    }

    const criteriaChecked = passed + failed + aiPassed + aiFailed;
    const criteriaWithIssues = failed + aiFailed;
    const criteriaPassed = passed + aiPassed;
    const criteriaAiVerified = aiPassed + aiFailed;
    const isAiEnhanced = criteriaAiVerified > 0;

    // ACTUAL percentage - not theoretical
    const coveragePercentage = criteriaTotal > 0
      ? Math.round((criteriaChecked / criteriaTotal) * 100)
      : 0;

    const summary: CriteriaVerificationSummary = {
      criteriaChecked,
      criteriaTotal,
      criteriaWithIssues,
      criteriaPassed,
      criteriaAiVerified,
      criteriaNotTested: notTested,
    };

    return {
      coveragePercentage,
      criteriaChecked,
      criteriaTotal,
      isAiEnhanced,
      criteriaVerifications: verifications,
      summary,
    };
  }

  /**
   * Compute criteria verifications from legacy scan data
   *
   * For old scans without stored CriteriaVerification records, this method
   * computes verifications from issues and passed checks.
   *
   * This is a backward compatibility method that produces the same output
   * as buildCriteriaVerifications but without AI data.
   *
   * @param scanResult - Legacy scan result data
   * @param issues - Issues from the scan
   * @param wcagLevel - Target WCAG conformance level
   * @param passedRuleIds - Array of axe rule IDs that passed (optional)
   * @returns Array of computed criteria verifications
   */
  computeVerificationsFromLegacyData(
    scanResult: ScanResultData,
    issues: Array<{ id: string; wcagCriteria: string[] }>,
    wcagLevel: WcagLevel,
    passedRuleIds: string[] = []
  ): CriteriaVerification[] {
    const normalizedLevel = wcagLevel.toUpperCase() as WCAGLevel;
    const allCriteria = getCriteriaUpToLevel(normalizedLevel);
    const criteriaMap = new Map<string, CriteriaVerification>();

    // Initialize all criteria as NOT_TESTED
    for (const criterion of allCriteria) {
      criteriaMap.set(criterion.id, {
        criterionId: criterion.id,
        status: 'NOT_TESTED',
        scanner: 'N/A',
      });
    }

    // If we have specific passed rule IDs, map them
    if (passedRuleIds.length > 0) {
      const passedCriteria = this.mapPassedChecksToCriteria(passedRuleIds);
      for (const criterionId of passedCriteria) {
        if (criteriaMap.has(criterionId)) {
          criteriaMap.set(criterionId, {
            criterionId,
            status: 'PASS',
            scanner: 'axe-core',
          });
        }
      }
    } else if (scanResult.passedChecks > 0) {
      // Fallback: estimate passed criteria from count
      // This uses heuristic based on passed check count
      const estimatedPassedRatio = Math.min(scanResult.passedChecks / Object.keys(AXE_RULE_TO_WCAG).length, 1);
      const allAxeCriteria = new Set<string>();

      for (const wcagIds of Object.values(AXE_RULE_TO_WCAG)) {
        for (const id of wcagIds) {
          if (criteriaMap.has(id)) {
            allAxeCriteria.add(id);
          }
        }
      }

      // Mark some criteria as PASS based on ratio (deterministic using sort)
      const sortedCriteria = Array.from(allAxeCriteria).sort();
      const numToPass = Math.round(sortedCriteria.length * estimatedPassedRatio);

      for (let i = 0; i < numToPass; i++) {
        const criterionId = sortedCriteria[i];
        if (criterionId) {
          criteriaMap.set(criterionId, {
            criterionId,
            status: 'PASS',
            scanner: 'axe-core',
          });
        }
      }
    }

    // Map issues to criteria (status: FAIL)
    const issueByCriteria = this.groupIssuesByCriteria(issues);
    for (const [criterionId, issueList] of issueByCriteria) {
      if (criteriaMap.has(criterionId)) {
        criteriaMap.set(criterionId, {
          criterionId,
          status: 'FAIL',
          scanner: 'axe-core',
          issueIds: issueList.map(i => i.id),
        });
      }
    }

    return Array.from(criteriaMap.values());
  }
}

/**
 * Singleton instance for convenience
 */
export const coverageService = new CoverageService();
