/**
 * Reports Module
 *
 * Exports all public APIs for report functionality.
 */

export { registerReportRoutes } from './report.controller.js';
export { getOrGenerateReport, ReportServiceError } from './report.service.js';
export type { GetReportResult } from './report.service.js';
export {
  getReportByScanAndFormat,
  createPendingReport,
  ReportRepositoryError,
} from './report.repository.js';
