/**
 * JSON Exporter
 *
 * Exports scan results in structured JSON format for API consumption,
 * integrations, and automated processing.
 */

import type { FormattedResult, EnrichedIssue } from '../../utils/result-formatter.js';

/**
 * JSON report structure
 */
export interface JsonReport {
  /** Report format version for future compatibility */
  version: '1.0';
  /** Timestamp when report was generated (ISO 8601) */
  generatedAt: string;
  /** Tool information */
  tool: {
    name: 'ADAShield';
    version: string;
  };
  /** Scan information */
  scan: {
    id: string;
    url: string;
    wcagLevel: string;
    completedAt: string;
    duration: number;
  };
  /** Issue summary statistics */
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
  /** Coverage disclaimer */
  disclaimer: string;
  /** Flattened array of all issues */
  issues: Array<{
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
  }>;
}

/**
 * Flatten issues from grouped-by-impact structure to a single array
 *
 * @param issuesByImpact - Issues grouped by severity impact
 * @returns Flat array of all issues
 *
 * @example
 * ```typescript
 * const flattened = flattenIssues(result.issuesByImpact);
 * console.log(`Total issues: ${flattened.length}`);
 * ```
 */
function flattenIssues(issuesByImpact: FormattedResult['issuesByImpact']): JsonReport['issues'] {
  const allIssues = [
    ...issuesByImpact.critical,
    ...issuesByImpact.serious,
    ...issuesByImpact.moderate,
    ...issuesByImpact.minor,
  ];

  return allIssues.map((issue) => ({
    id: issue.id,
    ruleId: issue.ruleId,
    impact: issue.impact,
    description: issue.description,
    help: issue.helpText,
    helpUrl: issue.helpUrl,
    wcagCriteria: issue.wcagCriteria,
    element: {
      selector: issue.cssSelector,
      html: issue.htmlSnippet,
    },
    ...(issue.fixGuide && {
      fixGuide: {
        summary: issue.fixGuide.summary,
        steps: issue.fixGuide.steps,
        ...(issue.fixGuide.codeExample && {
          codeExample: issue.fixGuide.codeExample,
        }),
      },
    }),
  }));
}

/**
 * Generate JSON report from formatted scan result
 *
 * @param result - Formatted scan result
 * @returns JSON report object
 *
 * @example
 * ```typescript
 * const report = generateJsonReport(formattedResult);
 * console.log(`Report version: ${report.version}`);
 * console.log(`Issues: ${report.issues.length}`);
 * ```
 */
export function generateJsonReport(result: FormattedResult): JsonReport {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    tool: {
      name: 'ADAShield',
      version: result.metadata.toolVersion,
    },
    scan: {
      id: result.scanId,
      url: result.url,
      wcagLevel: result.wcagLevel,
      completedAt: result.completedAt.toISOString(),
      duration: result.metadata.scanDuration,
    },
    summary: {
      totalIssues: result.summary.totalIssues,
      bySeverity: {
        critical: result.summary.critical,
        serious: result.summary.serious,
        moderate: result.summary.moderate,
        minor: result.summary.minor,
      },
      passed: result.summary.passed,
    },
    disclaimer: result.metadata.coverageNote,
    issues: flattenIssues(result.issuesByImpact),
  };
}

/**
 * Export JSON report as buffer with S3 key
 *
 * @param result - Formatted scan result
 * @returns Buffer containing JSON report and S3 key path
 *
 * @example
 * ```typescript
 * const { buffer, key } = await exportJsonReport(formattedResult);
 * console.log(`Report size: ${buffer.length} bytes`);
 * console.log(`S3 key: ${key}`);
 * ```
 */
export async function exportJsonReport(
  result: FormattedResult
): Promise<{ buffer: Buffer; key: string }> {
  const report = generateJsonReport(result);

  // Pretty-print JSON with 2-space indentation for readability
  const buffer = Buffer.from(JSON.stringify(report, null, 2), 'utf-8');

  // Generate S3 key path: reports/{scanId}/report.json
  const key = `reports/${result.scanId}/report.json`;

  return { buffer, key };
}

/**
 * Upload JSON report to S3 and return the storage URL
 *
 * @param buffer - JSON report buffer
 * @param key - S3 object key
 * @returns Storage URL for the uploaded report
 *
 * @example
 * ```typescript
 * const url = await uploadJsonToS3(buffer, key);
 * console.log(`Report available at: ${url}`);
 * ```
 */
export async function uploadJsonToS3(buffer: Buffer, key: string): Promise<string> {
  const { uploadToS3, CONTENT_TYPES, ensureBucketExists } = await import('@adashield/core/storage');

  // Ensure bucket exists before uploading
  await ensureBucketExists();

  console.log(`[JSON-Exporter] Uploading ${buffer.length} bytes to S3 key: ${key}`);
  const url = await uploadToS3(buffer, key, CONTENT_TYPES.json);
  console.log(`[JSON-Exporter] Upload complete: ${url}`);

  return url;
}
