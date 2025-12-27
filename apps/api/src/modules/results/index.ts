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
} from './result.service.js';
