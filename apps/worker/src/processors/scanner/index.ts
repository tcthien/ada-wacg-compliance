/**
 * Scanner Module
 *
 * Core accessibility scanning functionality using Playwright and axe-core.
 * This module exports all components needed for page scanning:
 * - Page scanner (main entry point)
 * - axe-core runner
 * - Result mapper
 * - HTML sanitizer
 */

// Main page scanner
export {
  scanPage,
  scanPages,
  ScanError,
  type ScanOptions,
  type ScanResult,
} from './page-scanner.js';

// axe-core runner
export {
  runAxeAnalysis,
  runAxeAnalysisWithRules,
  getWcagTags,
} from './axe-runner.js';

// Result mapper
export {
  mapAxeViolations,
  mapImpact,
  extractWcagCriteria,
  mapNode,
  getIssueSummary,
  type MappedIssue,
} from './result-mapper.js';

// HTML sanitizer
export {
  sanitizeHtml,
  sanitizeHtmlBatch,
} from './html-sanitizer.js';
