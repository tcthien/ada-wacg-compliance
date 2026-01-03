/**
 * AI Campaign Module
 *
 * Exports all AI early bird scan campaign functionality for external use.
 * This module provides campaign status tracking, slot reservation, quota management,
 * and admin campaign controls with Redis-based caching and atomic operations.
 */

// Controller exports
export { registerAiCampaignRoutes } from './ai-campaign.controller.js';
export { registerAiQueueRoutes } from './ai-queue.controller.js';

// Service exports
export {
  getCampaignStatus,
  reserveSlot,
  checkAndReserveSlotAtomic,
  releaseSlot,
  deductTokens,
  getCampaignMetrics,
  updateCampaign,
  AiCampaignServiceError,
} from './ai-campaign.service.js';

// Repository exports
export {
  getActiveCampaign,
  getCampaignById,
  updateCampaignTokens,
  createAuditLog,
  AiCampaignRepositoryError,
} from './ai-campaign.repository.js';

// Queue Service exports
export {
  exportPendingScans,
  validateScanEligibility,
  parseAndValidateCsv,
  updateScanWithAiResults,
  updateIssuesWithAi,
  importAiResults,
  getQueueStats,
  listAiScans,
  retryFailedScan,
  AiQueueServiceError,
} from './ai-queue.service.js';

export type {
  ExportPendingScansResult,
  ScanValidationResult,
  AiScanData,
  AiIssueData,
  QueueStats,
  AiScanListItem,
  PaginatedAiScans,
  RetryResult,
} from './ai-queue.service.js';

// Schema exports
export {
  AiCampaignStatusSchema,
  AiStatusSchema,
  updateCampaignSchema,
  aiScanFiltersSchema,
  csvImportRowSchema,
} from './ai-campaign.schema.js';

// Type exports
export type {
  CampaignStatusResponse,
  SlotReservationResult,
  CampaignMetrics,
  UpdateCampaignData,
  AiScanFilters,
  ImportResult,
} from './ai-campaign.types.js';

// Schema type exports (Zod-inferred types)
export type {
  UpdateCampaignRequest,
  CsvImportRow,
} from './ai-campaign.schema.js';

// Re-export Prisma-generated types used by this module
export type { AiStatus, AiCampaignStatus } from '@prisma/client';

// Type guard exports
export {
  isAiStatus,
  isAiCampaignStatus,
  isUrgencyLevel,
} from './ai-campaign.types.js';
