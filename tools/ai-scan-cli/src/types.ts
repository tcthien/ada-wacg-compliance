/**
 * Exit codes for the AI scan CLI tool
 */
export const ExitCode = {
  SUCCESS: 0,
  PARTIAL_FAILURE: 1,
  COMPLETE_FAILURE: 2,
  LOCK_EXISTS: 3,
  PREREQUISITES_MISSING: 4,
} as const;

export type ExitCodeValue = typeof ExitCode[keyof typeof ExitCode];

/**
 * Human-readable descriptions for each exit code
 */
export const ExitCodeDescription: Record<ExitCodeValue, string> = {
  [ExitCode.SUCCESS]: 'All scans completed successfully',
  [ExitCode.PARTIAL_FAILURE]: 'Some scans failed but at least one succeeded',
  [ExitCode.COMPLETE_FAILURE]: 'All scans failed',
  [ExitCode.LOCK_EXISTS]: 'Another instance is already running',
  [ExitCode.PREREQUISITES_MISSING]: 'Required prerequisites are not met',
};

/**
 * WCAG conformance levels
 */
export type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * Accessibility issue impact levels
 */
export type ImpactLevel = 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';

/**
 * Scan processing status
 */
export type ScanStatus = 'COMPLETED' | 'FAILED';

/**
 * Existing issue from axe-core scan (from exported CSV)
 */
export interface ExistingIssue {
  id: string;
  ruleId: string;
  wcagCriteria: string | null;
  impact: string;
  description: string;
  helpText: string | null;
  helpUrl: string | null;
  htmlSnippet: string | null;
  cssSelector: string | null;
}

/**
 * AI enhancement for an existing issue (for import)
 */
export interface AiIssueEnhancement {
  issueId: string;
  aiExplanation: string;
  aiFixSuggestion: string;
  aiPriority: number;
}

/**
 * Represents a pending scan to be processed
 */
export interface PendingScan {
  scanId: string;
  url: string;
  wcagLevel: WcagLevel;
  email?: string;
  createdAt?: string;
  pageTitle?: string;
  /** Existing issues from axe-core scan (JSON string from export) */
  existingIssues?: ExistingIssue[];
}

/**
 * Represents a single accessibility issue found during scanning
 */
export interface Issue {
  id: string;
  ruleId: string;
  wcagCriteria: string;
  impact: ImpactLevel;
  description: string;
  helpText: string;
  helpUrl: string;
  htmlSnippet: string;
  cssSelector: string;
  aiExplanation: string;
  aiFixSuggestion: string;
  aiPriority: number; // 1-10
}

/**
 * Summary of scan results with AI analysis
 */
export interface ScanResult {
  scanId: string;
  url: string;
  pageTitle: string;
  wcagLevel: WcagLevel;
  summary: string | object;
  remediationPlan: string | object;
  /** New issues discovered by AI (legacy mode) */
  issues: Issue[];
  /** AI enhancements for existing axe-core issues */
  aiEnhancements?: AiIssueEnhancement[];
  status: ScanStatus;
  errorMessage?: string;
  /** Duration of AI processing in milliseconds */
  durationMs?: number;
}

/**
 * CSV import row format for database insertion
 * Must match the API schema at /api/v1/admin/ai-queue/import
 */
export interface ImportRow {
  scan_id: string;
  ai_summary: string;
  ai_remediation_plan: string;
  ai_issues_json: string; // JSON stringified Issue[]
  tokens_used: number;
  ai_model: string;
  processing_time: number; // In seconds
}

/**
 * Error types that can occur during scanning
 */
export enum ErrorType {
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  PROCESS_CRASH = 'PROCESS_CRASH',
  INVALID_OUTPUT = 'INVALID_OUTPUT',
  URL_UNREACHABLE = 'URL_UNREACHABLE',
  UNKNOWN = 'UNKNOWN',
}
