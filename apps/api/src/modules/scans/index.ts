/**
 * Scan module exports
 *
 * This module provides schemas, types, and controllers for scan API.
 * Used by Fastify routes for request/response validation and route registration.
 */

// Export controllers
export { registerScanRoutes } from './scan.controller.js';
export { registerScanEventRoutes } from './scan-event.controller.js';

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

// Export scan event service
export {
  logEvent,
  getEvents,
  getEventsSince,
  archiveOldEvents,
  ScanEventServiceError,
} from './scan-event.service.js';

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

// Export scan event schemas
export {
  scanEventTypeSchema,
  logLevelSchema,
  createScanEventSchema,
  getEventsQuerySchema,
  scanEventResponseSchema,
  getEventsResponseSchema,
} from './scan-event.schema.js';

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

// Export scan event types
export type {
  ScanEventType,
  LogLevel,
  CreateScanEventInput,
  GetEventsOptions,
  GetEventsResponse,
  EventSummary,
} from './scan-event.types.js';
