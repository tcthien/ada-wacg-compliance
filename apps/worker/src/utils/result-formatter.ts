/**
 * Result Formatter Utility
 *
 * Converts Prisma scan data to FormattedResult type for report generation.
 * This is a worker-specific version that doesn't depend on API services.
 */

import { getFixGuideByRuleId } from '@adashield/core/utils';
import type { FixGuide } from '@adashield/core/constants';
import type { IssueImpact, WcagLevel } from '@adashield/core/types';

/**
 * IssueNode type for proper typing
 */
interface IssueNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

/**
 * Simplified Issue type for result formatting
 * Does not include scanResultId or createdAt as those are DB-specific
 */
interface FormatterIssue {
  id: string;
  ruleId: string;
  wcagCriteria: string[];
  impact: IssueImpact;
  description: string;
  helpText: string;
  helpUrl: string;
  htmlSnippet: string;
  cssSelector: string;
  nodes: IssueNode[];
}

/**
 * Prisma-like types for scan data
 * These mirror the Prisma-generated types but don't require @prisma/client import
 */
interface PrismaIssue {
  id: string;
  ruleId: string;
  wcagCriteria: string[];
  impact: string;
  description: string;
  helpText: string;
  helpUrl: string;
  htmlSnippet: string;
  cssSelector: string;
  nodes: unknown[];
  scanResultId: string;
  createdAt: Date;
}

interface PrismaScanResult {
  id: string;
  scanId: string;
  totalIssues: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  passedChecks: number;
  inapplicableChecks: number;
  createdAt: Date;
  issues: PrismaIssue[];
}

interface PrismaScan {
  id: string;
  url: string;
  email: string | null;
  wcagLevel: string;
  status: string;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
  completedAt: Date | null;
  userId: string | null;
  guestSessionId: string;
}

/**
 * Coverage disclaimer for automated testing limitations
 */
const COVERAGE_NOTE =
  'Automated testing detects approximately 57% of WCAG issues. Manual testing is recommended for complete compliance.';

/**
 * Current tool version for metadata
 */
const TOOL_VERSION = '1.0.0';

/**
 * WCAG version supported by the tool
 */
const WCAG_VERSION = '2.1';

/**
 * Enriched issue with optional fix guide
 */
export interface EnrichedIssue extends FormatterIssue {
  /** Curated fix guide for this issue (if available) */
  fixGuide?: FixGuide;
}

/**
 * Summary statistics for scan results
 */
export interface ResultSummary {
  totalIssues: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  passed: number;
}

/**
 * Issues grouped by severity impact
 */
export interface IssuesByImpact {
  critical: EnrichedIssue[];
  serious: EnrichedIssue[];
  moderate: EnrichedIssue[];
  minor: EnrichedIssue[];
}

/**
 * Metadata about the scan and results
 */
export interface ResultMetadata {
  coverageNote: string;
  wcagVersion: string;
  toolVersion: string;
  scanDuration: number;
  inapplicableChecks: number;
}

/**
 * Formatted scan result with enriched issues and metadata
 */
export interface FormattedResult {
  scanId: string;
  url: string;
  wcagLevel: WcagLevel;
  completedAt: Date;
  summary: ResultSummary;
  issuesByImpact: IssuesByImpact;
  metadata: ResultMetadata;
}

/**
 * Scan with related result data (from Prisma)
 */
export interface ScanWithResult extends PrismaScan {
  scanResult: PrismaScanResult | null;
}

/**
 * Convert Prisma issue to formatter issue type
 */
function prismaIssueToCore(issue: PrismaIssue): FormatterIssue {
  return {
    id: issue.id,
    ruleId: issue.ruleId,
    wcagCriteria: issue.wcagCriteria,
    impact: issue.impact as IssueImpact,
    description: issue.description,
    helpText: issue.helpText,
    helpUrl: issue.helpUrl,
    htmlSnippet: issue.htmlSnippet,
    cssSelector: issue.cssSelector,
    nodes: issue.nodes as IssueNode[],
  };
}

/**
 * Enrich an issue with its fix guide if available
 */
function enrichIssueWithFixGuide(issue: PrismaIssue): EnrichedIssue {
  const coreIssue = prismaIssueToCore(issue);
  const fixGuide = getFixGuideByRuleId(issue.ruleId);

  return {
    ...coreIssue,
    ...(fixGuide && { fixGuide }),
  };
}

/**
 * Group issues by their severity impact
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
 * @param scanResult - Raw scan with result data from Prisma
 * @returns Formatted result ready for report generation
 * @throws Error if scan is not completed or missing result data
 */
export function formatResult(scanResult: ScanWithResult): FormattedResult {
  // Validate scan is completed
  if (scanResult.status !== 'COMPLETED') {
    throw new Error(
      `Cannot format result for scan ${scanResult.id}: scan status is ${scanResult.status}`
    );
  }

  // Validate result data exists
  if (!scanResult.scanResult) {
    throw new Error(
      `Cannot format result for scan ${scanResult.id}: scan result data is missing`
    );
  }

  // Validate completedAt exists
  if (!scanResult.completedAt) {
    throw new Error(
      `Cannot format result for scan ${scanResult.id}: completedAt timestamp is missing`
    );
  }

  // Enrich all issues with fix guides
  const enrichedIssues = scanResult.scanResult.issues.map(enrichIssueWithFixGuide);

  // Group issues by severity
  const issuesByImpact = groupIssuesByImpact(enrichedIssues);

  // Calculate summary statistics
  const summary = calculateSummary(scanResult);

  // Calculate scan duration
  const scanDuration =
    scanResult.durationMs ?? scanResult.completedAt.getTime() - scanResult.createdAt.getTime();

  // Build formatted result
  return {
    scanId: scanResult.id,
    url: scanResult.url,
    wcagLevel: scanResult.wcagLevel as WcagLevel,
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
  };
}
