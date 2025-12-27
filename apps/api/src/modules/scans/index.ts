/**
 * Scan module exports
 *
 * This module provides schemas, types, and controllers for scan API.
 * Used by Fastify routes for request/response validation and route registration.
 */

// Export controller
export { registerScanRoutes } from './scan.controller.js';

// Export service functions
export {
  createScan,
  getScanStatus,
  getScanResult,
  listScans,
  ScanServiceError,
  type ScanStatusResponse as ScanStatusServiceResponse,
  type ScanResultResponse as ScanResultServiceResponse,
} from './scan.service.js';

// Export all schemas
export {
  WcagLevelSchema,
  ScanStatusSchema,
  IssueImpactSchema,
  CreateScanRequestSchema,
  ScanResponseSchema,
  ScanStatusResponseSchema,
  ScanIdParamSchema,
} from './scan.schema.js';

// Export all types
export type {
  CreateScanRequest,
  ScanResponse,
  ScanStatusResponse,
  ScanIdParam,
  WcagLevelType,
  ScanStatusType,
  IssueImpactType,
  CreateScanInput,
  UpdateScanInput,
  Scan,
} from './scan.types.js';

// Export type guards
export {
  isWcagLevel,
  isScanStatus,
  isIssueImpact,
} from './scan.types.js';
