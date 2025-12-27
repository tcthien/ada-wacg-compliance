/**
 * Session Controller
 *
 * Fastify route handlers for session management and GDPR compliance.
 * Implements DELETE endpoint for session anonymization.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { anonymizeSession, SessionServiceError } from './session.service.js';
import { z } from 'zod';

/**
 * Request parameter schema for session token
 */
const sessionParamsSchema = z.object({
  token: z.string().min(1, 'Session token is required'),
});

/**
 * Type for session params
 */
type SessionParams = z.infer<typeof sessionParamsSchema>;

/**
 * DELETE /api/v1/sessions/:token
 *
 * Anonymize a guest session according to GDPR requirements.
 * This endpoint performs irreversible anonymization:
 * - Hashes the fingerprint using SHA-256
 * - Replaces the session token with a random value
 * - Nullifies email fields in related scans
 * - Sets anonymizedAt timestamp
 *
 * @param request - Fastify request with session token param
 * @param reply - Fastify reply
 * @returns Anonymization result
 *
 * @example
 * DELETE /api/v1/sessions/abc123-session-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Session anonymized successfully",
 *   "data": {
 *     "sessionId": "uuid-session-id",
 *     "anonymizedAt": "2025-12-26T12:00:00.000Z",
 *     "affectedScans": 3,
 *     "reportsDeleted": 2
 *   }
 * }
 *
 * Response 404:
 * {
 *   "success": false,
 *   "error": "Session not found: abc123-session-token",
 *   "code": "SESSION_NOT_FOUND"
 * }
 *
 * Response 409:
 * {
 *   "success": false,
 *   "error": "Session already anonymized at 2025-12-25T10:00:00.000Z",
 *   "code": "ALREADY_ANONYMIZED"
 * }
 */
async function deleteSessionHandler(
  request: FastifyRequest<{ Params: SessionParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = sessionParamsSchema.parse(request.params);

    // Anonymize the session
    const result = await anonymizeSession(params.token);

    return reply.code(200).send({
      success: true,
      message: 'Session anonymized successfully',
      data: {
        sessionId: result.sessionId,
        anonymizedAt: result.anonymizedAt.toISOString(),
        affectedScans: result.affectedScans,
        reportsDeleted: result.reportsDeleted,
      },
    });
  } catch (error) {
    // Handle known errors
    if (error instanceof SessionServiceError) {
      const statusCode = getStatusCodeForError(error.code);

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
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in deleteSessionHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map error codes to HTTP status codes
 */
function getStatusCodeForError(code: string): number {
  switch (code) {
    case 'SESSION_NOT_FOUND':
      return 404;
    case 'ALREADY_ANONYMIZED':
      return 409; // Conflict
    case 'INVALID_INPUT':
      return 400;
    case 'ANONYMIZATION_FAILED':
      return 500;
    default:
      return 500;
  }
}

/**
 * Register session routes
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 */
export async function registerSessionRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // DELETE /api/v1/sessions/:token - Anonymize session
  fastify.delete(`${prefix}/sessions/:token`, deleteSessionHandler);

  fastify.log.info('✅ Session routes registered');
}
