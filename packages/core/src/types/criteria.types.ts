/**
 * Criteria verification types for ADAShield WCAG criteria coverage table
 */

/**
 * Status of a WCAG criterion verification
 */
export type CriteriaStatus =
  | 'PASS'              // Verified passing by axe-core
  | 'FAIL'              // Issues found by axe-core
  | 'AI_VERIFIED_PASS'  // Verified passing by AI
  | 'AI_VERIFIED_FAIL'  // Issues found by AI
  | 'NOT_TESTED';       // Cannot be automated

/**
 * Source of the verification scanner
 * Can be 'axe-core', 'N/A', 'axe-core + AI', or a dynamic AI model name (e.g., 'claude-opus-4')
 */
export type ScannerSource = 'axe-core' | 'axe-core + AI' | 'N/A' | string;

/**
 * Verification result for a single WCAG criterion
 */
export interface CriteriaVerification {
  /** Criterion ID (e.g., "1.1.1") */
  criterionId: string;

  /** Verification status */
  status: CriteriaStatus;

  /** Scanner that verified this criterion */
  scanner: ScannerSource;

  /** References to issues if status is FAIL or AI_VERIFIED_FAIL */
  issueIds?: string[];

  /** AI confidence score (0-100), only for AI verifications */
  confidence?: number;

  /** AI reasoning text, only visible to admins */
  reasoning?: string;
}

/**
 * Summary statistics for criteria verifications
 */
export interface CriteriaVerificationSummary {
  /** Total criteria actually checked (Pass + Fail + AI_VERIFIED_PASS + AI_VERIFIED_FAIL) */
  criteriaChecked: number;

  /** Total criteria for the WCAG level (30/50/78) */
  criteriaTotal: number;

  /** Criteria with issues (FAIL or AI_VERIFIED_FAIL) */
  criteriaWithIssues: number;

  /** Criteria that passed (PASS or AI_VERIFIED_PASS) */
  criteriaPassed: number;

  /** Criteria verified by AI (AI_VERIFIED_PASS + AI_VERIFIED_FAIL) */
  criteriaAiVerified: number;

  /** Criteria that couldn't be tested (NOT_TESTED) */
  criteriaNotTested: number;
}

/**
 * Enhanced coverage metrics computed from criteria verifications
 */
export interface EnhancedCoverageMetrics {
  /** Actual computed coverage percentage: (criteriaChecked / criteriaTotal) * 100 */
  coveragePercentage: number;

  /** Total criteria checked */
  criteriaChecked: number;

  /** Total criteria for WCAG level */
  criteriaTotal: number;

  /** Whether AI verification was performed */
  isAiEnhanced: boolean;

  /** Full list of criteria verifications */
  criteriaVerifications: CriteriaVerification[];

  /** Summary statistics */
  summary: CriteriaVerificationSummary;
}

/**
 * Input for creating criteria verifications from scan data
 */
export interface BuildCriteriaVerificationsInput {
  /** Scan result ID */
  scanResultId: string;

  /** List of issues from the scan */
  issues: Array<{ id: string; wcagCriteria: string[] }>;

  /** WCAG level being tested */
  wcagLevel: 'A' | 'AA' | 'AAA';

  /** Axe-core passed checks (rule IDs) */
  passedChecks?: string[];

  /** AI verifications to merge (optional) */
  aiVerifications?: CriteriaVerification[];

  /** AI model name from scan result (e.g., 'claude-opus-4') */
  aiModel?: string;
}
