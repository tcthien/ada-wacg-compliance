/**
 * Discovery Module
 *
 * Exports all discovery-related functionality for external use.
 * This module provides website skeleton discovery and URL management.
 */

import type { FastifyInstance } from 'fastify';
import { sessionMiddleware } from '../../shared/middleware/session.js';
import {
  createDiscoveryHandler,
  getDiscoveryHandler,
  cancelDiscoveryHandler,
  addManualUrlHandler,
  addManualUrlsBatchHandler,
  removeManualUrlHandler,
  discoveryRateLimitMiddleware,
} from './discovery.controller.js';

/**
 * Register discovery routes
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 */
export async function registerDiscoveryRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // POST /api/v1/discoveries - Create new discovery
  // Middleware: session → rateLimit → handler
  fastify.post(
    `${prefix}/discoveries`,
    {
      preHandler: [sessionMiddleware, discoveryRateLimitMiddleware],
    },
    createDiscoveryHandler as any
  );

  // GET /api/v1/discoveries/:discoveryId - Get discovery status and results
  // Middleware: session → handler
  fastify.get(
    `${prefix}/discoveries/:discoveryId`,
    {
      preHandler: [sessionMiddleware],
    },
    getDiscoveryHandler as any
  );

  // DELETE /api/v1/discoveries/:discoveryId - Cancel discovery
  // Middleware: session → handler
  fastify.delete(
    `${prefix}/discoveries/:discoveryId`,
    {
      preHandler: [sessionMiddleware],
    },
    cancelDiscoveryHandler as any
  );

  // POST /api/v1/discoveries/:discoveryId/pages - Add manual URL
  // Middleware: session → rateLimit → handler
  fastify.post(
    `${prefix}/discoveries/:discoveryId/pages`,
    {
      preHandler: [sessionMiddleware, discoveryRateLimitMiddleware],
    },
    addManualUrlHandler as any
  );

  // POST /api/v1/discoveries/:discoveryId/pages/batch - Add multiple manual URLs
  // Middleware: session → rateLimit → handler
  fastify.post(
    `${prefix}/discoveries/:discoveryId/pages/batch`,
    {
      preHandler: [sessionMiddleware, discoveryRateLimitMiddleware],
    },
    addManualUrlsBatchHandler as any
  );

  // DELETE /api/v1/discoveries/:discoveryId/pages/:pageId - Remove manual URL
  // Middleware: session → handler
  fastify.delete(
    `${prefix}/discoveries/:discoveryId/pages/:pageId`,
    {
      preHandler: [sessionMiddleware],
    },
    removeManualUrlHandler as any
  );

  fastify.log.info('✅ Discovery routes registered');
}

// Service exports
export {
  createDiscovery,
  getDiscovery,
  getCacheMetadata,
  cancelDiscovery,
  addManualUrl,
  addManualUrls,
  removeManualUrl,
  checkUsageLimit,
  MVP_LIMITS,
} from './discovery.service.js';

// Repository exports
export {
  create,
  findById,
  findByIdWithPages,
  updateStatus,
  findBySessionId,
  addPages,
  addPage,
  removePage,
  findPageByUrl,
  getMonthlyUsage,
  getOrCreateUsage,
  incrementUsage,
} from './discovery.repository.js';

// Schema exports
export {
  safeUrlSchema,
  createDiscoverySchema,
  discoveryIdParamSchema,
  addManualUrlSchema,
  addMultipleUrlsSchema,
  pageIdParamSchema,
} from './discovery.schema.js';

// Type exports
export {
  DiscoveryStatus,
  DiscoveryMode,
  DiscoveryPhase,
  PageSource,
  isDiscoveryStatus,
  isDiscoveryMode,
  isDiscoveryPhase,
  isPageSource,
} from './discovery.types.js';

export type {
  Discovery,
  DiscoveredPage,
  DiscoveryWithPages,
  CreateDiscoveryInput,
  AddUrlResult,
  UsageLimitResult,
} from './discovery.types.js';

// Error exports
export {
  DiscoveryErrorCode,
  DiscoveryRepositoryError,
  DiscoveryServiceError,
  DiscoveryWorkerError,
} from './discovery.errors.js';

export type { ErrorDetails } from './discovery.errors.js';
