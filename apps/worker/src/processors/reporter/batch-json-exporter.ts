/**
 * Batch JSON Exporter
 *
 * Exports batch scan results in structured JSON format for API consumption,
 * integrations, and automated processing. Provides aggregate statistics
 * and per-URL issue breakdowns.
 */

/**
 * Criteria verification status for export
 */
export type CriteriaExportStatus = 'PASS' | 'FAIL' | 'AI_VERIFIED_PASS' | 'AI_VERIFIED_FAIL' | 'NOT_TESTED';

/**
 * Criteria verification detail for export
 */
export interface CriteriaVerificationExport {
  /** WCAG criterion ID (e.g., "1.1.1") */
  criterionId: string;
  /** Criterion name */
  name: string;
  /** WCAG level (A, AA, AAA) */
  level: string;
  /** Verification status */
  status: CriteriaExportStatus;
  /** Scanner that verified this criterion */
  scanner: 'axe-core' | 'AI' | 'N/A';
  /** AI confidence score (0-100), only for AI-verified criteria */
  confidence?: number;
  /** AI reasoning, only for AI-verified criteria */
  reasoning?: string;
  /** Related issue IDs if status is FAIL */
  relatedIssueIds?: string[];
}

/**
 * Criteria coverage summary for export
 */
export interface CriteriaCoverageSummary {
  /** Total criteria for the WCAG level */
  total: number;
  /** Number of criteria checked */
  checked: number;
  /** Number of criteria passed */
  passed: number;
  /** Number of criteria failed */
  failed: number;
  /** Number of criteria AI-verified */
  aiVerified: number;
  /** Number of criteria not testable */
  notTestable: number;
  /** Coverage percentage */
  coveragePercentage: number;
}

/**
 * Issue detail structure matching single scan export format
 */
export interface BatchIssueDetail {
  id: string;
  ruleId: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  wcagCriteria: string[];
  element: {
    selector: string;
    html: string;
  };
  fixGuide?: {
    summary: string;
    steps: string[];
    codeExample?: {
      before: string;
      after: string;
    };
  };
}

/**
 * Per-URL scan result in batch report
 */
export interface BatchUrlResult {
  scanId: string;
  url: string;
  pageTitle: string | null;
  status: string;
  summary: {
    totalIssues: number;
    bySeverity: {
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    };
    passed: number;
  };
  issues: BatchIssueDetail[];
  /** Criteria coverage summary for this URL */
  criteriaCoverage?: CriteriaCoverageSummary;
  /** Detailed criteria verifications (admin export only) */
  criteriaVerifications?: CriteriaVerificationExport[];
}

/**
 * Batch JSON report structure
 */
export interface BatchJsonReport {
  /** Report format version for future compatibility */
  version: '1.0';
  /** Timestamp when report was generated (ISO 8601) */
  generatedAt: string;
  /** Tool information */
  tool: {
    name: 'ADAShield';
    version: string;
  };
  /** Batch scan information */
  batch: {
    id: string;
    homepageUrl: string;
    wcagLevel: string;
    totalUrls: number;
    completedCount: number;
    failedCount: number;
    createdAt: string;
    completedAt: string;
  };
  /** Aggregate statistics across all URLs */
  aggregate: {
    totalIssues: number;
    bySeverity: {
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    };
    passedChecks: number;
    /** Aggregate criteria coverage across all URLs */
    criteriaCoverage?: CriteriaCoverageSummary;
  };
  /** Coverage disclaimer */
  disclaimer: string;
  /** Per-URL scan results with issues */
  urls: BatchUrlResult[];
}

/**
 * Raw issue from scan result for transformation
 */
interface BatchInputIssue {
  id: string;
  ruleId: string;
  impact: string;
  description: string;
  helpText: string;
  helpUrl: string;
  wcagCriteria: string[];
  htmlSnippet: string;
  cssSelector: string;
  fixGuide?: {
    summary: string;
    steps: string[];
    codeExample?: {
      before: string;
      after: string;
    };
  };
}

/**
 * Input data for batch JSON report generation
 */
export interface BatchJsonInput {
  /** Batch scan ID */
  batchId: string;
  /** Homepage URL that was scanned */
  homepageUrl: string;
  /** WCAG compliance level (A, AA, AAA) */
  wcagLevel: string;
  /** Total number of URLs in batch */
  totalUrls: number;
  /** Number of successfully completed scans */
  completedCount: number;
  /** Number of failed scans */
  failedCount: number;
  /** Batch creation timestamp */
  createdAt: Date;
  /** Batch completion timestamp */
  completedAt: Date | null;
  /** Aggregate issue counts (if pre-computed) */
  aggregateStats?: {
    totalIssues: number;
    criticalCount: number;
    seriousCount: number;
    moderateCount: number;
    minorCount: number;
  };
  /** Include detailed criteria verifications (for admin exports) */
  includeDetailedCriteria?: boolean;
  /** Per-URL scan results */
  urlResults: Array<{
    scanId: string;
    url: string;
    pageTitle: string | null;
    status: string;
    completedAt: Date | null;
    durationMs: number | null;
    result?: {
      totalIssues: number;
      criticalCount: number;
      seriousCount: number;
      moderateCount: number;
      minorCount: number;
      passedChecks: number;
      issues: Array<{
        id: string;
        ruleId: string;
        impact: string;
        description: string;
        helpText: string;
        helpUrl: string;
        wcagCriteria: string[];
        htmlSnippet: string;
        cssSelector: string;
        fixGuide?: {
          summary: string;
          steps: string[];
          codeExample?: {
            before: string;
            after: string;
          };
        };
      }>;
      /** Criteria coverage summary */
      criteriaCoverage?: CriteriaCoverageSummary;
      /** Detailed criteria verifications */
      criteriaVerifications?: CriteriaVerificationExport[];
    };
  }>;
}

/**
 * Tool version for reports
 */
const TOOL_VERSION = '1.0.0';

/**
 * Coverage disclaimer text
 */
const COVERAGE_DISCLAIMER =
  'This automated scan checks for common accessibility issues but cannot detect all problems. ' +
  'Automated testing typically covers 30-40% of WCAG success criteria. ' +
  'Manual testing by accessibility experts is recommended for comprehensive compliance assessment.';

/**
 * Sanitize text for JSON output by removing control characters
 *
 * @param text - Input text to sanitize
 * @returns Sanitized text safe for JSON
 */
function sanitizeText(text: string): string {
  if (!text) return '';
  // Remove control characters except newlines and tabs
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Transform input issue to BatchIssueDetail format
 *
 * @param issue - Raw issue from scan result
 * @returns Formatted issue detail for JSON export
 */
function transformIssue(issue: BatchInputIssue): BatchIssueDetail {
  return {
    id: issue.id,
    ruleId: issue.ruleId,
    impact: issue.impact,
    description: sanitizeText(issue.description),
    help: sanitizeText(issue.helpText),
    helpUrl: issue.helpUrl,
    wcagCriteria: issue.wcagCriteria,
    element: {
      selector: issue.cssSelector,
      html: sanitizeText(issue.htmlSnippet),
    },
    ...(issue.fixGuide && {
      fixGuide: {
        summary: sanitizeText(issue.fixGuide.summary),
        steps: issue.fixGuide.steps.map(sanitizeText),
        ...(issue.fixGuide.codeExample && {
          codeExample: {
            before: sanitizeText(issue.fixGuide.codeExample.before),
            after: sanitizeText(issue.fixGuide.codeExample.after),
          },
        }),
      },
    }),
  };
}

/**
 * Transform URL result to BatchUrlResult format
 *
 * @param urlResult - Raw URL result from input
 * @param includeDetailedCriteria - Whether to include detailed criteria verifications
 * @returns Formatted URL result for JSON export
 */
function transformUrlResult(
  urlResult: BatchJsonInput['urlResults'][0],
  includeDetailedCriteria = false
): BatchUrlResult {
  const result = urlResult.result;

  const baseResult: BatchUrlResult = {
    scanId: urlResult.scanId,
    url: urlResult.url,
    pageTitle: urlResult.pageTitle ? sanitizeText(urlResult.pageTitle) : null,
    status: urlResult.status,
    summary: {
      totalIssues: result?.totalIssues ?? 0,
      bySeverity: {
        critical: result?.criticalCount ?? 0,
        serious: result?.seriousCount ?? 0,
        moderate: result?.moderateCount ?? 0,
        minor: result?.minorCount ?? 0,
      },
      passed: result?.passedChecks ?? 0,
    },
    issues: (result?.issues ?? []).map((issue) => transformIssue(issue as BatchInputIssue)),
  };

  // Add criteria coverage if available
  if (result?.criteriaCoverage) {
    baseResult.criteriaCoverage = result.criteriaCoverage;
  }

  // Add detailed criteria verifications for admin exports
  if (includeDetailedCriteria && result?.criteriaVerifications) {
    baseResult.criteriaVerifications = result.criteriaVerifications;
  }

  return baseResult;
}

/**
 * Calculate aggregate statistics from URL results
 *
 * @param urlResults - Array of URL results
 * @returns Aggregate statistics for the batch
 */
function calculateAggregateStats(urlResults: BatchJsonInput['urlResults']): {
  totalIssues: number;
  bySeverity: { critical: number; serious: number; moderate: number; minor: number };
  passedChecks: number;
  criteriaCoverage?: CriteriaCoverageSummary;
} {
  let totalIssues = 0;
  let critical = 0;
  let serious = 0;
  let moderate = 0;
  let minor = 0;
  let passedChecks = 0;

  // Aggregate criteria coverage from all URLs
  let hasCriteriaCoverage = false;
  let totalCriteriaTotal = 0;
  let totalCriteriaChecked = 0;
  let totalCriteriaPassed = 0;
  let totalCriteriaFailed = 0;
  let totalCriteriaAiVerified = 0;
  let totalCriteriaNotTestable = 0;

  for (const urlResult of urlResults) {
    if (urlResult.result) {
      totalIssues += urlResult.result.totalIssues;
      critical += urlResult.result.criticalCount;
      serious += urlResult.result.seriousCount;
      moderate += urlResult.result.moderateCount;
      minor += urlResult.result.minorCount;
      passedChecks += urlResult.result.passedChecks;

      // Aggregate criteria coverage
      if (urlResult.result.criteriaCoverage) {
        hasCriteriaCoverage = true;
        const coverage = urlResult.result.criteriaCoverage;
        // For aggregate, we use max total (should be same for all URLs with same WCAG level)
        totalCriteriaTotal = Math.max(totalCriteriaTotal, coverage.total);
        // Sum the other values (we'll average them later)
        totalCriteriaChecked += coverage.checked;
        totalCriteriaPassed += coverage.passed;
        totalCriteriaFailed += coverage.failed;
        totalCriteriaAiVerified += coverage.aiVerified;
        totalCriteriaNotTestable += coverage.notTestable;
      }
    }
  }

  const result: {
    totalIssues: number;
    bySeverity: { critical: number; serious: number; moderate: number; minor: number };
    passedChecks: number;
    criteriaCoverage?: CriteriaCoverageSummary;
  } = {
    totalIssues,
    bySeverity: { critical, serious, moderate, minor },
    passedChecks,
  };

  // Calculate average criteria coverage if any URL had coverage data
  if (hasCriteriaCoverage) {
    const urlCount = urlResults.filter((u) => u.result?.criteriaCoverage).length;
    result.criteriaCoverage = {
      total: totalCriteriaTotal,
      checked: Math.round(totalCriteriaChecked / urlCount),
      passed: Math.round(totalCriteriaPassed / urlCount),
      failed: Math.round(totalCriteriaFailed / urlCount),
      aiVerified: Math.round(totalCriteriaAiVerified / urlCount),
      notTestable: Math.round(totalCriteriaNotTestable / urlCount),
      coveragePercentage: Math.round((totalCriteriaChecked / urlCount / totalCriteriaTotal) * 100),
    };
  }

  return result;
}

/**
 * Generate batch JSON report from input data
 *
 * @param input - Batch JSON input data
 * @returns Structured JSON report for the batch scan
 *
 * @example
 * ```typescript
 * const report = generateBatchJsonReport(batchInput);
 * console.log(`Report generated for batch: ${report.batch.id}`);
 * console.log(`Total issues across ${report.batch.totalUrls} URLs: ${report.aggregate.totalIssues}`);
 * ```
 */
export function generateBatchJsonReport(input: BatchJsonInput): BatchJsonReport {
  // Calculate aggregate stats from URL results (includes criteria coverage)
  const calculatedStats = calculateAggregateStats(input.urlResults);

  // Use pre-computed stats if provided, but keep criteria coverage from calculation
  const aggregateStats = input.aggregateStats
    ? {
        totalIssues: input.aggregateStats.totalIssues,
        bySeverity: {
          critical: input.aggregateStats.criticalCount,
          serious: input.aggregateStats.seriousCount,
          moderate: input.aggregateStats.moderateCount,
          minor: input.aggregateStats.minorCount,
        },
        passedChecks: calculatedStats.passedChecks,
        ...(calculatedStats.criteriaCoverage && { criteriaCoverage: calculatedStats.criteriaCoverage }),
      }
    : calculatedStats;

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    tool: {
      name: 'ADAShield',
      version: TOOL_VERSION,
    },
    batch: {
      id: input.batchId,
      homepageUrl: input.homepageUrl,
      wcagLevel: input.wcagLevel,
      totalUrls: input.totalUrls,
      completedCount: input.completedCount,
      failedCount: input.failedCount,
      createdAt: input.createdAt.toISOString(),
      completedAt: input.completedAt?.toISOString() ?? new Date().toISOString(),
    },
    aggregate: aggregateStats,
    disclaimer: COVERAGE_DISCLAIMER,
    urls: input.urlResults.map((url) => transformUrlResult(url, input.includeDetailedCriteria)),
  };
}

/**
 * Export batch JSON report as buffer with S3 key
 *
 * @param input - Batch JSON input data
 * @returns Buffer containing JSON report and S3 key path
 *
 * @example
 * ```typescript
 * const { buffer, key } = await exportBatchJson(batchInput);
 * console.log(`Report size: ${buffer.length} bytes`);
 * console.log(`S3 key: ${key}`);
 * ```
 */
export async function exportBatchJson(
  input: BatchJsonInput
): Promise<{ buffer: Buffer; key: string }> {
  const report = generateBatchJsonReport(input);

  // Pretty-print JSON with 2-space indentation for readability
  const buffer = Buffer.from(JSON.stringify(report, null, 2), 'utf-8');

  // Generate S3 key path: reports/batch-{batchId}/report.json
  const key = `reports/batch-${input.batchId}/report.json`;

  return { buffer, key };
}

/**
 * Upload batch JSON report to S3 and return the storage URL
 *
 * @param buffer - JSON report buffer
 * @param key - S3 object key
 * @returns Storage URL for the uploaded report
 *
 * @example
 * ```typescript
 * const url = await uploadBatchJsonToS3(buffer, key);
 * console.log(`Report available at: ${url}`);
 * ```
 */
export async function uploadBatchJsonToS3(buffer: Buffer, key: string): Promise<string> {
  const { uploadToS3, CONTENT_TYPES, ensureBucketExists } = await import('@adashield/core/storage');

  // Ensure bucket exists before uploading
  await ensureBucketExists();

  console.log(`[Batch-JSON-Exporter] Uploading ${buffer.length} bytes to S3 key: ${key}`);
  const url = await uploadToS3(buffer, key, CONTENT_TYPES.json);
  console.log(`[Batch-JSON-Exporter] Upload complete: ${url}`);

  return url;
}
