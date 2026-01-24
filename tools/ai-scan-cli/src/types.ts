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
 * Criteria verification status for AI-verified criteria
 */
export type CriteriaStatus = 'PASS' | 'FAIL' | 'AI_VERIFIED_PASS' | 'AI_VERIFIED_FAIL' | 'NOT_TESTED';

/**
 * AI verification for a WCAG criterion
 * Used to verify criteria that cannot be fully tested by axe-core
 */
export interface AiCriteriaVerification {
  /** WCAG criterion ID (e.g., "1.1.1", "1.4.3") */
  criterionId: string;
  /** Verification status determined by AI */
  status: CriteriaStatus;
  /** Confidence level (0-100) */
  confidence: number;
  /** AI reasoning for the verification */
  reasoning: string;
  /** Related issue IDs if status is FAIL or AI_VERIFIED_FAIL */
  relatedIssueIds?: string[];
}

/**
 * Instructions for verifying a specific WCAG criterion via AI
 * Contains all context needed for AI to evaluate compliance
 */
export interface CriterionVerificationInstruction {
  /** WCAG criterion ID (e.g., "1.1.1", "1.4.3") */
  criterionId: string;
  /** Human-readable title (e.g., "Non-text Content") */
  title: string;
  /** Full WCAG criterion description */
  description: string;
  /** Specific elements/patterns the AI should examine */
  whatToCheck: string;
  /** Conditions that indicate the criterion is met */
  passCondition: string;
  /** Patterns or issues that indicate criterion failure */
  failIndicators: string;
  /** If true, AI confidence should be lower as human review is recommended */
  requiresManualReview: boolean;
}

/**
 * Result of processing a batch of WCAG criteria verifications
 * Used for tracking progress and aggregating results during batch processing
 */
export interface CriteriaBatchResult {
  /** Sequential batch number (1-indexed) */
  batchNumber: number;
  /** Number of criteria verified in this batch */
  criteriaVerified: number;
  /** Array of verification results for each criterion in the batch */
  verifications: AiCriteriaVerification[];
  /** Total tokens consumed by AI for this batch */
  tokensUsed: number;
  /** Time taken to process this batch in milliseconds */
  durationMs: number;
  /** Any errors encountered during batch processing */
  errors: string[];
}

/**
 * Configuration options for the criteria batch processor
 * Controls batching behavior and rate limiting
 */
export interface CriteriaBatchProcessorOptions {
  /** Number of criteria to process per batch (default: 10) */
  batchSize: number;
  /** Delay between batches in milliseconds to avoid rate limiting (default: 2000) */
  delayBetweenBatches: number;
  /** Maximum time allowed for processing a single batch in milliseconds (default: 120000) */
  timeout: number;
}

/**
 * Checkpoint data structure for resumable criteria verification processing
 * Enables recovery from interruptions by storing intermediate state
 */
export interface CriteriaCheckpoint {
  /** Scan ID being verified */
  scanId: string;
  /** URL being scanned */
  url: string;
  /** WCAG level (A, AA, AAA) */
  wcagLevel: WcagLevel;
  /** Total number of criteria batches */
  totalBatches: number;
  /** Completed batch numbers (0-indexed) */
  completedBatches: number[];
  /** Verifications collected so far */
  partialVerifications: AiCriteriaVerification[];
  /** Issue enhancement already completed */
  issueEnhancementComplete: boolean;
  /** Issue enhancement result (if complete) */
  issueEnhancementResult?: {
    aiSummary: string;
    aiRemediationPlan: string;
    aiEnhancements: AiIssueEnhancement[];
    tokensUsed: number;
  };
  /** Timestamp when processing started (ISO 8601 format) */
  startedAt: string;
  /** Timestamp of last update (ISO 8601 format) */
  updatedAt: string;
  /** Total tokens used so far */
  tokensUsed: number;
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
  /** AI verifications for WCAG criteria that cannot be fully automated */
  criteriaVerifications?: AiCriteriaVerification[];
  status: ScanStatus;
  errorMessage?: string;
  /** Duration of AI processing in milliseconds */
  durationMs?: number;
  /** Total tokens used for AI processing (if tracked) */
  tokensUsed?: number;
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
  ai_criteria_verifications_json?: string; // JSON stringified AiCriteriaVerification[]
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

/**
 * Cache key for verification caching
 * Used to uniquely identify cached verification results
 */
export interface CacheKey {
  /** Hash of HTML content (SHA-256, first 16 chars) */
  contentHash: string;
  /** WCAG conformance level */
  wcagLevel: WcagLevel;
  /** Batch number (criteria set) */
  batchNumber: number;
}

/**
 * Cache entry storing verification results
 * Contains the cached verifications along with metadata
 */
export interface CacheEntry {
  /** Cache key for lookup */
  key: CacheKey;
  /** Cached verifications */
  verifications: AiCriteriaVerification[];
  /** Tokens used for this verification */
  tokensUsed: number;
  /** AI model used for verification */
  aiModel: string;
  /** When this entry was created (ISO 8601 format) */
  createdAt: string;
  /** When this entry expires (ISO 8601 format) */
  expiresAt: string;
}

/**
 * Cache statistics for monitoring and optimization
 * Tracks cache performance metrics
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Cache hit rate (hits / (hits + misses)) */
  hitRate: number;
  /** Total number of entries in cache */
  entriesCount: number;
  /** Total tokens saved by using cache */
  totalSavedTokens: number;
}
