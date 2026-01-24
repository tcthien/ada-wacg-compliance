/**
 * Result Service
 *
 * Formats scan results with fix recommendations for client consumption.
 * Enriches issues with curated fix guides and provides comprehensive metadata.
 */

import { getFixGuideByRuleId } from '@adashield/core/utils';
import type { FixGuide } from '@adashield/core/constants';
import type { Issue, IssueImpact, WcagLevel, CriteriaVerification, CriteriaVerificationSummary, EnhancedCoverageMetrics } from '@adashield/core/types';
import { getScanById, type ScanWithResult } from '../scans/scan.repository.js';
import { coverageService, type CoverageMetrics, type AiStatus } from './coverage.service.js';

/**
 * Coverage disclaimer for automated testing limitations
 * Source: Deque axe-core research and WCAG compliance standards
 */
const COVERAGE_NOTE = 'Automated testing detects approximately 57% of WCAG issues. Manual testing is recommended for complete compliance.';

/**
 * Current tool version for metadata
 */
const TOOL_VERSION = '1.0.0';

/**
 * WCAG version supported by the tool
 */
const WCAG_VERSION = '2.1';

/**
 * Result Service Error
 */
export class ResultServiceError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'ResultServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Enriched issue with optional fix guide
 */
export interface EnrichedIssue extends Issue {
  /** Curated fix guide for this issue (if available) */
  fixGuide?: FixGuide;
}

/**
 * Summary statistics for scan results
 */
export interface ResultSummary {
  /** Total number of issues detected */
  totalIssues: number;
  /** Number of critical severity issues */
  critical: number;
  /** Number of serious severity issues */
  serious: number;
  /** Number of moderate severity issues */
  moderate: number;
  /** Number of minor severity issues */
  minor: number;
  /** Number of passed accessibility checks */
  passed: number;
}

/**
 * Issues grouped by severity impact
 */
export interface IssuesByImpact {
  /** Critical severity issues (immediate action required) */
  critical: EnrichedIssue[];
  /** Serious severity issues (high priority) */
  serious: EnrichedIssue[];
  /** Moderate severity issues (medium priority) */
  moderate: EnrichedIssue[];
  /** Minor severity issues (low priority) */
  minor: EnrichedIssue[];
}

/**
 * Metadata about the scan and results
 */
export interface ResultMetadata {
  /** Disclaimer about automated testing coverage */
  coverageNote: string;
  /** WCAG version used for testing */
  wcagVersion: string;
  /** Tool version that performed the scan */
  toolVersion: string;
  /** Scan execution duration in milliseconds */
  scanDuration: number;
  /** Number of inapplicable checks */
  inapplicableChecks: number;
}

/**
 * Re-export CoverageMetrics for API consumers
 */
export type { CoverageMetrics };

/**
 * Enhanced coverage response with criteria verifications
 */
export interface EnhancedCoverageResponse {
  /** Actual computed coverage percentage: (criteriaChecked / criteriaTotal) * 100 */
  coveragePercentage: number;
  /** Number of unique WCAG criteria checked */
  criteriaChecked: number;
  /** Total WCAG criteria for the conformance level */
  criteriaTotal: number;
  /** Whether the scan is AI-enhanced */
  isAiEnhanced: boolean;
  /** AI model name if AI-enhanced (e.g., 'claude-opus-4') */
  aiModel?: string;
  /** Breakdown by criteria status */
  breakdown: {
    /** Number of criteria with issues found */
    criteriaWithIssues: number;
    /** Number of criteria that passed */
    criteriaPassed: number;
    /** Number of criteria verified by AI */
    criteriaAiVerified: number;
    /** Number of criteria not testable by automation */
    criteriaNotTested: number;
  };
  /** Full list of criteria verifications (for criteria table) */
  criteriaVerifications: CriteriaVerification[];
}

/**
 * Formatted scan result with enriched issues and metadata
 */
export interface FormattedResult {
  /** Unique scan identifier */
  scanId: string;
  /** URL that was scanned */
  url: string;
  /** Target WCAG conformance level */
  wcagLevel: WcagLevel;
  /** Timestamp when scan completed */
  completedAt: Date;
  /** Summary statistics */
  summary: ResultSummary;
  /** Issues grouped by severity impact */
  issuesByImpact: IssuesByImpact;
  /** Additional metadata about the scan */
  metadata: ResultMetadata;
  /** Legacy coverage metrics (for backward compatibility) */
  coverage: CoverageMetrics;
  /** Enhanced coverage with criteria verifications */
  enhancedCoverage: EnhancedCoverageResponse;
}

/**
 * Enrich an issue with its fix guide if available
 *
 * @param issue - Raw issue from scan result
 * @returns Enriched issue with optional fix guide
 *
 * @example
 * ```typescript
 * const enriched = enrichIssueWithFixGuide(issue);
 * if (enriched.fixGuide) {
 *   console.log(enriched.fixGuide.summary);
 *   console.log(enriched.fixGuide.steps);
 * }
 * ```
 */
function enrichIssueWithFixGuide(issue: Issue): EnrichedIssue {
  const fixGuide = getFixGuideByRuleId(issue.ruleId);

  return {
    ...issue,
    ...(fixGuide && { fixGuide }),
  };
}

/**
 * Group issues by their severity impact
 *
 * @param issues - Array of enriched issues
 * @returns Issues grouped by impact level
 *
 * @example
 * ```typescript
 * const grouped = groupIssuesByImpact(enrichedIssues);
 * console.log(`Critical: ${grouped.critical.length}`);
 * console.log(`Serious: ${grouped.serious.length}`);
 * ```
 */
function groupIssuesByImpact(issues: EnrichedIssue[]): IssuesByImpact {
  const grouped: IssuesByImpact = {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
  };

  for (const issue of issues) {
    const impactKey = issue.impact.toLowerCase() as Lowercase<IssueImpact>;
    grouped[impactKey]?.push(issue);
  }

  return grouped;
}

/**
 * Calculate summary statistics from scan result
 *
 * @param scanWithResult - Scan with result data
 * @returns Summary statistics
 *
 * @example
 * ```typescript
 * const summary = calculateSummary(scan);
 * console.log(`Total: ${summary.totalIssues}, Passed: ${summary.passed}`);
 * ```
 */
function calculateSummary(scanWithResult: ScanWithResult): ResultSummary {
  const result = scanWithResult.scanResult;

  if (!result) {
    return {
      totalIssues: 0,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      passed: 0,
    };
  }

  return {
    totalIssues: result.totalIssues,
    critical: result.criticalCount,
    serious: result.seriousCount,
    moderate: result.moderateCount,
    minor: result.minorCount,
    passed: result.passedChecks,
  };
}

/**
 * Format scan result with enriched issues and metadata
 *
 * @param scanResult - Raw scan with result data
 * @returns Formatted result ready for client consumption
 * @throws ResultServiceError if scan is not completed or missing result data
 *
 * @example
 * ```typescript
 * const scan = await getScanById('scan-123');
 * if (scan) {
 *   const formatted = await formatResult(scan);
 *   console.log(`Found ${formatted.summary.totalIssues} issues`);
 *   console.log(`Critical: ${formatted.issuesByImpact.critical.length}`);
 * }
 * ```
 */
export function formatResult(scanResult: ScanWithResult): FormattedResult {
  // Validate scan is completed
  if (scanResult.status !== 'COMPLETED') {
    throw new ResultServiceError(
      `Cannot format result for scan ${scanResult.id}: scan status is ${scanResult.status}`,
      'SCAN_NOT_COMPLETED'
    );
  }

  // Validate result data exists
  if (!scanResult.scanResult) {
    throw new ResultServiceError(
      `Cannot format result for scan ${scanResult.id}: scan result data is missing`,
      'RESULT_DATA_MISSING'
    );
  }

  // Validate completedAt exists
  if (!scanResult.completedAt) {
    throw new ResultServiceError(
      `Cannot format result for scan ${scanResult.id}: completedAt timestamp is missing`,
      'COMPLETED_AT_MISSING'
    );
  }

  // Enrich all issues with fix guides
  // Cast Prisma issues to Issue type (nodes field is JsonValue in Prisma, IssueNode[] in type)
  const enrichedIssues = scanResult.scanResult.issues.map(issue =>
    enrichIssueWithFixGuide(issue as unknown as Issue)
  );

  // Group issues by severity
  const issuesByImpact = groupIssuesByImpact(enrichedIssues);

  // Calculate summary statistics
  const summary = calculateSummary(scanResult);

  // Calculate scan duration (use durationMs or calculate from timestamps)
  const scanDuration = scanResult.durationMs ??
    (scanResult.completedAt.getTime() - scanResult.createdAt.getTime());

  // Calculate legacy coverage metrics (backward compatibility)
  const coverage = coverageService.calculateCoverage(
    {
      passedChecks: scanResult.scanResult.passedChecks,
      inapplicableChecks: scanResult.scanResult.inapplicableChecks,
    },
    scanResult.scanResult.issues as unknown as Issue[],
    scanResult.wcagLevel,
    scanResult.aiEnabled ?? false,
    (scanResult.aiStatus as AiStatus) ?? null
  );

  // Use stored criteria verifications if available (from AI import)
  // Otherwise, compute from legacy data for backward compatibility
  let criteriaVerifications: CriteriaVerification[];

  const storedVerifications = scanResult.scanResult.criteriaVerifications;

  if (storedVerifications && storedVerifications.length > 0) {
    // Use stored AI verifications from the database
    criteriaVerifications = storedVerifications.map(v => ({
      criterionId: v.criterionId,
      status: v.status as CriteriaVerification['status'],
      scanner: v.scanner,
      confidence: v.confidence ?? undefined,
      reasoning: v.reasoning ?? undefined,
      // Note: issueIds could be resolved from the relation if needed in future
    }));
  } else {
    // Legacy fallback: compute from issues/passed checks for scans without stored verifications
    const issues = scanResult.scanResult.issues.map(issue => ({
      id: issue.id,
      wcagCriteria: issue.wcagCriteria,
    }));

    criteriaVerifications = coverageService.computeVerificationsFromLegacyData(
      {
        passedChecks: scanResult.scanResult.passedChecks,
        inapplicableChecks: scanResult.scanResult.inapplicableChecks,
      },
      issues,
      scanResult.wcagLevel,
      scanResult.scanResult.passedRuleIds ?? [] // Use stored passedRuleIds for accurate PASS status mapping
    );
  }

  // Calculate enhanced coverage metrics from verifications
  const enhancedMetrics = coverageService.calculateCoverageFromVerifications(
    criteriaVerifications,
    scanResult.wcagLevel
  );

  // Build enhanced coverage response
  const enhancedCoverage: EnhancedCoverageResponse = {
    coveragePercentage: enhancedMetrics.coveragePercentage,
    criteriaChecked: enhancedMetrics.criteriaChecked,
    criteriaTotal: enhancedMetrics.criteriaTotal,
    isAiEnhanced: enhancedMetrics.isAiEnhanced,
    aiModel: scanResult.aiModel ?? undefined,
    breakdown: {
      criteriaWithIssues: enhancedMetrics.summary.criteriaWithIssues,
      criteriaPassed: enhancedMetrics.summary.criteriaPassed,
      criteriaAiVerified: enhancedMetrics.summary.criteriaAiVerified,
      criteriaNotTested: enhancedMetrics.summary.criteriaNotTested,
    },
    criteriaVerifications,
  };

  // Build formatted result
  const formattedResult: FormattedResult = {
    scanId: scanResult.id,
    url: scanResult.url,
    wcagLevel: scanResult.wcagLevel,
    completedAt: scanResult.completedAt,
    summary,
    issuesByImpact,
    metadata: {
      coverageNote: COVERAGE_NOTE,
      wcagVersion: WCAG_VERSION,
      toolVersion: TOOL_VERSION,
      scanDuration,
      inapplicableChecks: scanResult.scanResult.inapplicableChecks,
    },
    coverage,
    enhancedCoverage,
  };

  return formattedResult;
}

/**
 * Get formatted result for a scan by ID
 *
 * @param scanId - Scan identifier
 * @returns Formatted result or null if scan not found
 * @throws ResultServiceError if scan exists but cannot be formatted
 *
 * @example
 * ```typescript
 * const result = await getFormattedResult('scan-123');
 * if (result) {
 *   console.log(`Scan completed at ${result.completedAt}`);
 *   console.log(`Total issues: ${result.summary.totalIssues}`);
 * }
 * ```
 */
export async function getFormattedResult(scanId: string): Promise<FormattedResult | null> {
  try {
    // Fetch scan with result data
    const scan = await getScanById(scanId);

    if (!scan) {
      return null;
    }

    // Format and return result
    return formatResult(scan);
  } catch (error) {
    // Re-throw ResultServiceError as-is
    if (error instanceof ResultServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    throw new ResultServiceError(
      `Failed to get formatted result for scan ${scanId}`,
      'GET_RESULT_FAILED',
      err
    );
  }
}
