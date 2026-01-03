/**
 * Discovery Controller
 *
 * Fastify route handlers for website skeleton discovery operations.
 * Implements middleware chain: session → rate limit → handler
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createDiscovery,
  getDiscovery,
  getCacheMetadata,
  cancelDiscovery,
  addManualUrl,
  addManualUrls,
  removeManualUrl,
} from './discovery.service.js';
import { DiscoveryServiceError, type DiscoveryErrorCode } from './discovery.errors.js';
import { DiscoveryMode, type CreateDiscoveryInput } from './discovery.types.js';
import {
  createDiscoverySchema,
  discoveryIdParamSchema,
  addManualUrlSchema,
  addMultipleUrlsSchema,
  pageIdParamSchema,
} from './discovery.schema.js';
import { sessionMiddleware } from '../../shared/middleware/session.js';
import { createRateLimitMiddleware } from '../../shared/middleware/rate-limit.js';
import { RATE_LIMIT_CONFIG } from '../../shared/middleware/rate-limit.js';

/**
 * Request body type for creating a discovery
 */
type CreateDiscoveryBody = z.infer<typeof createDiscoverySchema>;

/**
 * Rate limit middleware for discovery creation
 * Limits to 10 discovery requests per minute per session
 *
 * Uses 'homepageUrl' as the URL parameter for rate limiting
 */
export const discoveryRateLimitMiddleware = createRateLimitMiddleware('homepageUrl');

/**
 * POST /api/v1/discoveries
 *
 * Create a new website skeleton discovery.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. rateLimit - Checks per-URL rate limit (10/hour)
 * 3. handler - Creates discovery and queues job
 *
 * @param request - Fastify request with CreateDiscoveryBody
 * @param reply - Fastify reply
 * @returns Discovery ID and initial status
 *
 * @example
 * POST /api/v1/discoveries
 * Body: {
 *   "homepageUrl": "https://example.com",
 *   "mode": "AUTO",
 *   "maxPages": 10,
 *   "maxDepth": 1
 * }
 *
 * Response 201:
 * {
 *   "success": true,
 *   "data": {
 *     "discoveryId": "550e8400-e29b-41d4-a716-446655440000",
 *     "status": "PENDING",
 *     "homepageUrl": "https://example.com",
 *     "mode": "AUTO",
 *     "maxPages": 10,
 *     "maxDepth": 1
 *   }
 * }
 *
 * Response 429 (Rate Limit Exceeded):
 * {
 *   "success": false,
 *   "error": "Usage limit exceeded",
 *   "code": "USAGE_LIMIT_EXCEEDED",
 *   "message": "Discovery limit reached. Limit resets on 2025-02-01"
 * }
 */
export async function createDiscoveryHandler(
  request: FastifyRequest<{ Body: CreateDiscoveryBody }>,
  reply: FastifyReply
) {
  try {
    // Validate request body
    const body = createDiscoverySchema.parse(request.body);

    // Check session exists (set by session middleware)
    if (!request.guestSession) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Valid session required',
        code: 'SESSION_REQUIRED',
      });
    }

    // Create discovery input
    const discoveryInput: CreateDiscoveryInput = {
      sessionId: request.guestSession.id,
      homepageUrl: body.homepageUrl,
      mode: body.mode as DiscoveryMode,
      maxPages: body.maxPages,
      maxDepth: body.maxDepth,
    };

    // Create discovery via service
    const discovery = await createDiscovery(
      request.guestSession.id,
      discoveryInput
    );

    return reply.code(201).send({
      success: true,
      data: {
        discovery: {
          id: discovery.id,
          sessionId: discovery.sessionId,
          homepageUrl: discovery.homepageUrl,
          mode: discovery.mode,
          status: discovery.status,
          phase: discovery.phase,
          maxPages: discovery.maxPages,
          maxDepth: discovery.maxDepth,
          partialResults: discovery.partialResults,
          createdAt: discovery.createdAt.toISOString(),
          updatedAt: discovery.updatedAt.toISOString(),
          completedAt: discovery.completedAt?.toISOString() ?? null,
          errorMessage: discovery.errorMessage,
          errorCode: discovery.errorCode,
        },
      },
    });
  } catch (error) {
    // Handle service errors (check by name property for better test compatibility)
    if (error instanceof Error && error.name === 'DiscoveryServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForDiscoveryError(error.code as DiscoveryErrorCode);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in createDiscoveryHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/discoveries/:discoveryId
 *
 * Retrieve a discovery by ID with all discovered pages.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. handler - Retrieves discovery from cache or database
 *
 * @param request - Fastify request with discoveryId param
 * @param reply - Fastify reply
 * @returns Discovery with pages and cache metadata
 *
 * @example
 * GET /api/v1/discoveries/550e8400-e29b-41d4-a716-446655440000
 * Query: ?refresh=true (optional - skip cache)
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "discovery": {
 *       "id": "550e8400-e29b-41d4-a716-446655440000",
 *       "status": "COMPLETED",
 *       "homepageUrl": "https://example.com",
 *       "mode": "AUTO",
 *       "maxPages": 10,
 *       "maxDepth": 1,
 *       "createdAt": "2025-01-15T10:00:00.000Z",
 *       "updatedAt": "2025-01-15T10:05:00.000Z",
 *       "completedAt": "2025-01-15T10:05:00.000Z"
 *     },
 *     "pages": [
 *       {
 *         "id": "page-1",
 *         "url": "https://example.com",
 *         "source": "HOMEPAGE",
 *         "depth": 0
 *       }
 *     ],
 *     "cacheMetadata": {
 *       "cachedAt": "2025-01-15T10:05:00.000Z",
 *       "pageCount": 5
 *     }
 *   }
 * }
 *
 * Response 404:
 * {
 *   "success": false,
 *   "error": "Discovery not found",
 *   "code": "DISCOVERY_NOT_FOUND"
 * }
 */
export async function getDiscoveryHandler(
  request: FastifyRequest<{
    Params: z.infer<typeof discoveryIdParamSchema>;
    Querystring: { refresh?: string };
  }>,
  reply: FastifyReply
) {
  try {
    // Validate discoveryId parameter
    const params = discoveryIdParamSchema.parse(request.params);
    const { discoveryId } = params;

    // Handle optional refresh query parameter
    const refresh = request.query.refresh === 'true';

    // Get discovery from service (uses cache unless refresh=true)
    const discovery = await getDiscovery(discoveryId);

    // Return 404 if discovery not found
    if (!discovery) {
      return reply.code(404).send({
        success: false,
        error: 'Discovery not found',
        code: 'DISCOVERY_NOT_FOUND',
      });
    }

    // Get cache metadata if cached
    let cacheMetadata = undefined;
    if (!refresh) {
      const metadata = await getCacheMetadata(discoveryId);
      if (metadata) {
        cacheMetadata = {
          cachedAt: metadata.cachedAt.toISOString(),
          pageCount: metadata.pageCount,
        };
      }
    }

    // Add rate limit headers to response
    reply.header('X-RateLimit-Limit', RATE_LIMIT_CONFIG.MAX_REQUESTS.toString());

    // Calculate remaining based on current usage (simplified for GET endpoint)
    // In a real implementation, this would check actual usage for this session
    reply.header('X-RateLimit-Remaining', RATE_LIMIT_CONFIG.MAX_REQUESTS.toString());

    // Return discovery with pages - pages are nested inside discovery
    return reply.code(200).send({
      success: true,
      data: {
        discovery: {
          id: discovery.id,
          sessionId: discovery.sessionId,
          status: discovery.status,
          phase: discovery.phase,
          homepageUrl: discovery.homepageUrl,
          mode: discovery.mode,
          maxPages: discovery.maxPages,
          maxDepth: discovery.maxDepth,
          partialResults: discovery.partialResults,
          createdAt: discovery.createdAt.toISOString(),
          updatedAt: discovery.updatedAt.toISOString(),
          completedAt: discovery.completedAt?.toISOString() ?? null,
          errorMessage: discovery.errorMessage,
          errorCode: discovery.errorCode,
          // Pages nested inside discovery to match DiscoveryWithPages type
          pages: discovery.pages.map((page) => ({
            id: page.id,
            discoveryId: page.discoveryId,
            url: page.url,
            title: page.title,
            source: page.source,
            depth: page.depth,
            httpStatus: page.httpStatus,
            contentType: page.contentType,
            createdAt: page.createdAt.toISOString(),
          })),
        },
        ...(cacheMetadata && { cacheMetadata }),
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid discovery ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle service errors
    if (error instanceof Error && error.name === 'DiscoveryServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForDiscoveryError(error.code as DiscoveryErrorCode);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getDiscoveryHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * DELETE /api/v1/discoveries/:discoveryId
 *
 * Cancel a running discovery.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. handler - Cancels discovery if allowed
 *
 * @param request - Fastify request with discoveryId param
 * @param reply - Fastify reply
 * @returns Updated discovery with CANCELLED status
 *
 * @example
 * DELETE /api/v1/discoveries/550e8400-e29b-41d4-a716-446655440000
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "discoveryId": "550e8400-e29b-41d4-a716-446655440000",
 *     "status": "CANCELLED",
 *     "message": "Discovery cancelled successfully"
 *   }
 * }
 *
 * Response 404:
 * {
 *   "success": false,
 *   "error": "Discovery not found: 550e8400-e29b-41d4-a716-446655440000",
 *   "code": "DISCOVERY_NOT_FOUND"
 * }
 *
 * Response 409:
 * {
 *   "success": false,
 *   "error": "Cannot cancel discovery with status COMPLETED",
 *   "code": "DISCOVERY_CANCELLED"
 * }
 */
export async function cancelDiscoveryHandler(
  request: FastifyRequest<{
    Params: z.infer<typeof discoveryIdParamSchema>;
  }>,
  reply: FastifyReply
) {
  try {
    // Validate discoveryId parameter
    const params = discoveryIdParamSchema.parse(request.params);
    const { discoveryId } = params;

    // Cancel discovery via service
    const discovery = await cancelDiscovery(discoveryId);

    // Return success response
    return reply.code(200).send({
      success: true,
      data: {
        discoveryId: discovery.id,
        status: discovery.status,
        message: 'Discovery cancelled successfully',
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid discovery ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle service errors
    if (error instanceof Error && error.name === 'DiscoveryServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForDiscoveryError(error.code as DiscoveryErrorCode);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in cancelDiscoveryHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/discoveries/:discoveryId/pages
 *
 * Add a manual URL to a discovery.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. handler - Validates and adds URL
 *
 * @param request - Fastify request with discoveryId param and url body
 * @param reply - Fastify reply
 * @returns Added page or error
 *
 * @example
 * POST /api/v1/discoveries/550e8400-e29b-41d4-a716-446655440000/pages
 * Body: {
 *   "url": "https://example.com/contact"
 * }
 *
 * Response 201:
 * {
 *   "success": true,
 *   "data": {
 *     "page": {
 *       "id": "page-1",
 *       "url": "https://example.com/contact",
 *       "source": "MANUAL",
 *       "depth": 0,
 *       "createdAt": "2025-01-15T10:00:00.000Z"
 *     },
 *     "message": "URL added successfully"
 *   }
 * }
 *
 * Response 400 (Invalid URL):
 * {
 *   "success": false,
 *   "error": "URL must be from the same domain as homepage",
 *   "code": "DOMAIN_MISMATCH"
 * }
 *
 * Response 409 (URL already exists):
 * {
 *   "success": false,
 *   "error": "URL already exists in discovery",
 *   "code": "PAGE_ALREADY_EXISTS"
 * }
 */
export async function addManualUrlHandler(
  request: FastifyRequest<{
    Params: z.infer<typeof discoveryIdParamSchema>;
    Body: z.infer<typeof addManualUrlSchema>;
  }>,
  reply: FastifyReply
) {
  try {
    // Validate params and body
    const params = discoveryIdParamSchema.parse(request.params);
    const body = addManualUrlSchema.parse(request.body);

    const { discoveryId } = params;
    const { url } = body;

    // Add URL via service
    const result = await addManualUrl(discoveryId, url);

    // Handle success
    if (result.success) {
      return reply.code(201).send({
        success: true,
        data: {
          page: {
            id: result.page!.id,
            url: result.page!.url,
            source: result.page!.source,
            depth: result.page!.depth,
            createdAt: result.page!.createdAt.toISOString(),
          },
          message: result.message,
        },
      });
    }

    // Handle failure cases (URL already exists or domain mismatch)
    // Check if it's a domain mismatch
    if (result.message.includes('same domain')) {
      return reply.code(400).send({
        success: false,
        error: result.message,
        code: 'DOMAIN_MISMATCH',
      });
    }

    // URL already exists
    return reply.code(409).send({
      success: false,
      error: result.message,
      code: 'PAGE_ALREADY_EXISTS',
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle service errors
    if (error instanceof Error && error.name === 'DiscoveryServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForDiscoveryError(error.code as DiscoveryErrorCode);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in addManualUrlHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/discoveries/:discoveryId/pages/batch
 *
 * Add multiple manual URLs to a discovery in batch.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. handler - Validates and adds URLs
 *
 * @param request - Fastify request with discoveryId param and urls body
 * @param reply - Fastify reply
 * @returns Array of results with success/failure counts
 *
 * @example
 * POST /api/v1/discoveries/550e8400-e29b-41d4-a716-446655440000/pages/batch
 * Body: {
 *   "urls": [
 *     "https://example.com/contact",
 *     "https://example.com/about"
 *   ]
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [
 *       {
 *         "success": true,
 *         "page": {
 *           "id": "page-1",
 *           "url": "https://example.com/contact",
 *           "source": "MANUAL",
 *           "depth": 0
 *         },
 *         "message": "URL added successfully"
 *       },
 *       {
 *         "success": false,
 *         "message": "URL already exists in discovery"
 *       }
 *     ],
 *     "summary": {
 *       "total": 2,
 *       "successful": 1,
 *       "failed": 1
 *     }
 *   }
 * }
 */
export async function addManualUrlsBatchHandler(
  request: FastifyRequest<{
    Params: z.infer<typeof discoveryIdParamSchema>;
    Body: z.infer<typeof addMultipleUrlsSchema>;
  }>,
  reply: FastifyReply
) {
  try {
    // Validate params and body
    const params = discoveryIdParamSchema.parse(request.params);
    const body = addMultipleUrlsSchema.parse(request.body);

    const { discoveryId } = params;
    const { urls } = body;

    // Add URLs via service
    const results = await addManualUrls(discoveryId, urls);

    // Calculate summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    // Format results for response
    const formattedResults = results.map((result) => ({
      success: result.success,
      ...(result.page && {
        page: {
          id: result.page.id,
          url: result.page.url,
          source: result.page.source,
          depth: result.page.depth,
          createdAt: result.page.createdAt.toISOString(),
        },
      }),
      message: result.message,
    }));

    return reply.code(200).send({
      success: true,
      data: {
        results: formattedResults,
        summary: {
          total: results.length,
          successful,
          failed,
        },
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle service errors
    if (error instanceof Error && error.name === 'DiscoveryServiceError' && 'code' in error) {
      const statusCode = getStatusCodeForDiscoveryError(error.code as DiscoveryErrorCode);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in addManualUrlsBatchHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * DELETE /api/v1/discoveries/:discoveryId/pages/:pageId
 *
 * Remove a manual URL from a discovery.
 *
 * Middleware chain:
 * 1. session - Creates/retrieves guest session
 * 2. handler - Validates and removes URL
 *
 * @param request - Fastify request with discoveryId and pageId params
 * @param reply - Fastify reply
 * @returns Success message or error
 *
 * @example
 * DELETE /api/v1/discoveries/550e8400-e29b-41d4-a716-446655440000/pages/page-1
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Manual URL removed successfully"
 *   }
 * }
 *
 * Response 404:
 * {
 *   "success": false,
 *   "error": "Page not found or doesn't belong to discovery",
 *   "code": "PAGE_NOT_FOUND"
 * }
 *
 * Response 403:
 * {
 *   "success": false,
 *   "error": "Can only remove manually added pages",
 *   "code": "INVALID_INPUT"
 * }
 */
export async function removeManualUrlHandler(
  request: FastifyRequest<{
    Params: z.infer<typeof discoveryIdParamSchema> & z.infer<typeof pageIdParamSchema>;
  }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const discoveryParams = discoveryIdParamSchema.parse(request.params);
    const pageParams = pageIdParamSchema.parse(request.params);

    const { discoveryId } = discoveryParams;
    const { pageId } = pageParams;

    // Remove URL via service
    const removed = await removeManualUrl(discoveryId, pageId);

    if (!removed) {
      return reply.code(500).send({
        success: false,
        error: 'Failed to remove page',
        code: 'DELETE_FAILED',
      });
    }

    return reply.code(200).send({
      success: true,
      data: {
        message: 'Manual URL removed successfully',
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle service errors
    if (error instanceof Error && error.name === 'DiscoveryServiceError' && 'code' in error) {
      const errorCode = error.code as DiscoveryErrorCode;

      // Map INVALID_INPUT (non-MANUAL source) to 403 Forbidden
      if (errorCode === 'INVALID_INPUT' && error.message.includes('manually added')) {
        return reply.code(403).send({
          success: false,
          error: error.message,
          code: error.code,
        });
      }

      const statusCode = getStatusCodeForDiscoveryError(errorCode);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in removeManualUrlHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map discovery service error codes to HTTP status codes
 *
 * @param code - Discovery error code
 * @returns HTTP status code
 */
function getStatusCodeForDiscoveryError(code: string): number {
  switch (code) {
    case 'INVALID_URL':
    case 'INVALID_INPUT':
    case 'DOMAIN_MISMATCH':
      return 400;
    case 'USAGE_LIMIT_EXCEEDED':
      return 429; // Too Many Requests
    case 'DISCOVERY_NOT_FOUND':
    case 'PAGE_NOT_FOUND':
      return 404;
    case 'DISCOVERY_ALREADY_RUNNING':
    case 'DISCOVERY_CANCELLED':
    case 'PAGE_ALREADY_EXISTS':
      return 409; // Conflict
    case 'CREATE_FAILED':
    case 'UPDATE_FAILED':
    case 'DELETE_FAILED':
    case 'GET_FAILED':
    case 'LIST_FAILED':
    case 'SITEMAP_FETCH_FAILED':
    case 'NAVIGATION_EXTRACTION_FAILED':
    case 'TIMEOUT':
      return 500;
    default:
      return 500;
  }
}
