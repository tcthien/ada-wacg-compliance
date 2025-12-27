/**
 * Issue-related types for ADAShield
 */

/**
 * Severity/impact level of an accessibility issue
 */
export type IssueImpact = 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';

/**
 * Node information for an accessibility issue
 */
export interface IssueNode {
  /** HTML snippet of the element */
  html: string;

  /** CSS selector to locate the element */
  target: string[];

  /** Failure summary for this specific node */
  failureSummary?: string;
}

/**
 * Accessibility issue detected during scan
 */
export interface Issue {
  /** Unique identifier for the issue */
  id: string;

  /** Associated scan result ID */
  scanResultId: string;

  /** Accessibility rule that was violated */
  ruleId: string;

  /** WCAG success criteria violated (e.g., "1.1.1", "4.1.2") */
  wcagCriteria: string[];

  /** Impact/severity level of the issue */
  impact: IssueImpact;

  /** Human-readable description of the issue */
  description: string;

  /** Guidance on how to fix the issue */
  helpText: string;

  /** URL to detailed help documentation */
  helpUrl: string;

  /** HTML snippet showing the problematic code */
  htmlSnippet: string;

  /** CSS selector to locate the element */
  cssSelector: string;

  /** Array of specific DOM nodes affected */
  nodes: IssueNode[];

  /** Timestamp when issue was detected */
  createdAt: Date;
}

/**
 * Input data for creating a new issue
 */
export interface CreateIssueInput {
  scanResultId: string;
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
 * Summary statistics for issues in a scan
 */
export interface IssueSummary {
  total: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}
