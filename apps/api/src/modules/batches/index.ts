/**
 * Batch module exports
 *
 * This module provides schemas, types, and controllers for batch scan API.
 * Used by Fastify routes for request/response validation and route registration.
 */

// Export controller
export { registerBatchRoutes } from './batch.controller.js';

// Export service functions
export {
  createBatch,
  getBatchStatus,
  getBatchResults,
  cancelBatch,
  listBatches,
  BatchServiceError,
  type CreateBatchInput,
  type CreateBatchResult,
  type BatchStatusResponse,
  type BatchResultsResponse,
  type BatchListPagination,
  type BatchListResponse,
  type CancelBatchResult,
} from './batch.service.js';

// Export repository functions
export {
  create as createBatchRecord,
  findById as findBatchById,
  findBySessionId as findBatchesBySessionId,
  updateStatus as updateBatchStatus,
  updateAggregateStats as updateBatchAggregateStats,
  BatchRepositoryError,
  type CreateBatchData,
  type AggregateStats,
} from './batch.repository.js';

// Export schemas
export {
  BatchStatusSchema,
  CreateBatchRequestSchema,
  BatchIdParamSchema,
  PaginationSchema,
  BatchStatusResponseSchema,
  BatchResultsResponseSchema,
  BatchListResponseSchema,
  type CreateBatchRequest,
  type BatchStatusResponse as BatchStatusSchemaType,
  type BatchResultsResponse as BatchResultsSchemaType,
  type Pagination,
  type BatchListResponse as BatchListSchemaType,
  type BatchIdParam,
} from './batch.schema.js';

// Export types (if there are any type files, we'll export them)
// Currently batch types are defined inline in service and repository files
