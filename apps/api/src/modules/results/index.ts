/**
 * Results Module
 *
 * Exports result formatting services for enriching scan results with fix guides.
 */

export {
  formatResult,
  getFormattedResult,
  ResultServiceError,
  type EnrichedIssue,
  type ResultSummary,
  type IssuesByImpact,
  type ResultMetadata,
  type FormattedResult,
  type CoverageMetrics,
  type EnhancedCoverageResponse,
} from './result.service.js';

export {
  coverageService,
  CoverageService,
  type CoverageBreakdown,
  type ScanResultData,
  type AiStatus,
} from './coverage.service.js';
