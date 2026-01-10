import type { ScanResult, ImportRow, AiIssueEnhancement } from './types.js';

/**
 * Convert summary object to plain text string
 * @param summary Summary from Claude (can be string or object)
 * @returns Plain text summary
 */
function formatSummary(summary: string | object): string {
  if (typeof summary === 'string') {
    return summary;
  }

  // If it's an object (from Claude's JSON output), format it nicely
  const obj = summary as Record<string, unknown>;

  const parts: string[] = [];

  if (obj.totalIssues !== undefined) {
    parts.push(`Found ${obj.totalIssues} accessibility issues.`);
  }

  if (obj.criticalIssues !== undefined && (obj.criticalIssues as number) > 0) {
    parts.push(`${obj.criticalIssues} critical issues require immediate attention.`);
  }

  if (obj.seriousIssues !== undefined && (obj.seriousIssues as number) > 0) {
    parts.push(`${obj.seriousIssues} serious issues significantly impact accessibility.`);
  }

  if (obj.overallCompliance !== undefined) {
    parts.push(`Overall compliance: ${obj.overallCompliance}.`);
  }

  if (obj.complianceScore !== undefined) {
    parts.push(`Compliance score: ${obj.complianceScore}%.`);
  }

  return parts.length > 0 ? parts.join(' ') : JSON.stringify(summary);
}

/**
 * Convert remediation plan object to plain text string
 * @param plan Remediation plan from Claude (can be string or object)
 * @returns Plain text remediation plan
 */
function formatRemediationPlan(plan: string | object): string {
  if (typeof plan === 'string') {
    return plan;
  }

  // If it's an object (from Claude's JSON output), format it as a readable plan
  const obj = plan as Record<string, unknown>;

  const sections: string[] = [];

  if (Array.isArray(obj.quickWins) && obj.quickWins.length > 0) {
    sections.push('QUICK WINS (immediate fixes):');
    (obj.quickWins as string[]).forEach((item, i) => {
      sections.push(`  ${i + 1}. ${item}`);
    });
  }

  if (Array.isArray(obj.shortTerm) && obj.shortTerm.length > 0) {
    sections.push('\nSHORT-TERM IMPROVEMENTS:');
    (obj.shortTerm as string[]).forEach((item, i) => {
      sections.push(`  ${i + 1}. ${item}`);
    });
  }

  if (Array.isArray(obj.longTerm) && obj.longTerm.length > 0) {
    sections.push('\nLONG-TERM CHANGES:');
    (obj.longTerm as string[]).forEach((item, i) => {
      sections.push(`  ${i + 1}. ${item}`);
    });
  }

  if (obj.estimatedEffort !== undefined) {
    sections.push(`\nEstimated effort: ${obj.estimatedEffort}`);
  }

  return sections.length > 0 ? sections.join('\n') : JSON.stringify(plan);
}

/**
 * Estimate tokens used based on output length
 * Uses approximate ratio of 4 characters per token
 * @param result The scan result to estimate tokens for
 * @returns Estimated token count
 */
function estimateTokensUsed(result: ScanResult): number {
  // Estimate input tokens (prompt + HTML content)
  const inputEstimate = 2000; // Base prompt size estimate

  // Estimate output tokens based on response size
  const summarySize = typeof result.summary === 'string'
    ? result.summary.length
    : JSON.stringify(result.summary).length;

  const planSize = typeof result.remediationPlan === 'string'
    ? result.remediationPlan.length
    : JSON.stringify(result.remediationPlan).length;

  // Use enhancements if available, otherwise fallback to issues
  const issuesOrEnhancements = result.aiEnhancements ?? result.issues;
  const issuesSize = JSON.stringify(issuesOrEnhancements).length;

  const totalOutputChars = summarySize + planSize + issuesSize;

  // Approximate 4 characters per token
  const outputTokens = Math.ceil(totalOutputChars / 4);

  return inputEstimate + outputTokens;
}

/**
 * Get the AI issues JSON for export
 * Uses aiEnhancements if available (enhancement mode), otherwise uses issues (legacy mode)
 * @param result The scan result
 * @returns JSON string for ai_issues_json column
 */
function getAiIssuesJson(result: ScanResult): string {
  // Enhancement mode: use aiEnhancements array
  if (result.aiEnhancements && result.aiEnhancements.length > 0) {
    return JSON.stringify(result.aiEnhancements);
  }

  // Legacy mode: convert issues to enhancement format
  // This maintains backward compatibility with the old discovery mode
  const legacyEnhancements: AiIssueEnhancement[] = result.issues.map((issue) => ({
    issueId: issue.id,
    aiExplanation: issue.aiExplanation,
    aiFixSuggestion: issue.aiFixSuggestion,
    aiPriority: issue.aiPriority,
  }));

  return JSON.stringify(legacyEnhancements);
}

/**
 * Transform scan results to CSV import format
 * Matches the API schema at /api/v1/admin/ai-queue/import
 * @param results Array of scan results
 * @returns Array of import rows ready for CSV export
 */
export function transformToImportFormat(results: ScanResult[]): ImportRow[] {
  return results.map((result) => {
    // Convert processing time from ms to seconds
    const processingTimeSeconds = result.durationMs
      ? Math.ceil(result.durationMs / 1000)
      : 60; // Default to 60 seconds if not tracked

    return {
      scan_id: result.scanId,
      ai_summary: formatSummary(result.summary),
      ai_remediation_plan: formatRemediationPlan(result.remediationPlan),
      ai_issues_json: getAiIssuesJson(result),
      tokens_used: estimateTokensUsed(result),
      ai_model: 'claude-opus-4-5-20251101',
      processing_time: processingTimeSeconds,
    };
  });
}
