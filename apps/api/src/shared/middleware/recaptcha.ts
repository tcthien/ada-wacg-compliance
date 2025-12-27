import type {
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
import { env } from '../../config/env.js';

/**
 * reCAPTCHA Middleware
 *
 * Validates Google reCAPTCHA v3 tokens to prevent bot abuse.
 *
 * Features:
 * - Verifies tokens with Google reCAPTCHA API
 * - Rejects requests with score < 0.3 (likely bots)
 * - Adds recaptchaScore to request context for downstream handlers
 * - Graceful error handling with detailed logging
 * - Configurable via RECAPTCHA_SECRET_KEY environment variable
 *
 * Usage:
 * - Client must send reCAPTCHA token in request body as 'recaptchaToken'
 * - Middleware adds 'recaptchaScore' (0.0-1.0) to request object
 * - Score interpretation: 0.0 = likely bot, 1.0 = likely human
 * - Default threshold: 0.3 (configurable)
 *
 * @see https://developers.google.com/recaptcha/docs/v3
 */

/**
 * Google reCAPTCHA verification endpoint
 */
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * Minimum acceptable reCAPTCHA score (0.0 - 1.0)
 * Scores below this threshold are rejected as likely bots
 */
const RECAPTCHA_SCORE_THRESHOLD = 0.3;

/**
 * reCAPTCHA verification response from Google API
 */
interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Verify reCAPTCHA token with Google API
 *
 * @param token - reCAPTCHA token from client
 * @param remoteIp - Client IP address (optional)
 * @returns Verification response from Google
 * @throws Error if verification request fails
 */
async function verifyRecaptchaToken(
  token: string,
  remoteIp?: string
): Promise<RecaptchaVerifyResponse> {
  const secretKey = env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    throw new Error('RECAPTCHA_SECRET_KEY not configured');
  }

  const params = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  // Add optional remote IP
  if (remoteIp) {
    params.append('remoteip', remoteIp);
  }

  const response = await fetch(RECAPTCHA_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `reCAPTCHA API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as RecaptchaVerifyResponse;
  return data;
}

/**
 * Extract reCAPTCHA token from request
 *
 * Supports multiple token locations:
 * - Request body: recaptchaToken field
 * - Request headers: X-Recaptcha-Token header
 *
 * @param request - Fastify request
 * @returns reCAPTCHA token or null if not found
 */
function extractRecaptchaToken(request: FastifyRequest): string | null {
  // Try body first (most common)
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body === 'object' && 'recaptchaToken' in body) {
    const token = body['recaptchaToken'];
    if (typeof token === 'string' && token.length > 0) {
      return token;
    }
  }

  // Try header as fallback
  const headerToken = request.headers['x-recaptcha-token'];
  if (typeof headerToken === 'string' && headerToken.length > 0) {
    return headerToken;
  }

  return null;
}

/**
 * Extract client IP address from request
 *
 * Checks multiple headers in priority order:
 * 1. X-Forwarded-For (proxy/load balancer)
 * 2. X-Real-IP (nginx)
 * 3. request.ip (Fastify direct)
 *
 * @param request - Fastify request
 * @returns Client IP address or undefined
 */
function extractClientIp(request: FastifyRequest): string | undefined {
  // X-Forwarded-For may contain multiple IPs, take the first (client)
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  // X-Real-IP header (nginx)
  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }

  // Fastify request.ip
  return request.ip;
}

/**
 * reCAPTCHA middleware preHandler hook
 *
 * Validates reCAPTCHA token and attaches score to request.
 * Rejects requests with score below threshold or missing tokens.
 *
 * Error handling:
 * - Missing token: 400 Bad Request
 * - Low score (< 0.3): 403 Forbidden
 * - Google API errors: 502 Bad Gateway
 * - Configuration errors: 500 Internal Server Error
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export const recaptchaMiddleware: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // Check if reCAPTCHA is configured
    if (!env.RECAPTCHA_SECRET_KEY) {
      // Allow requests to pass through if reCAPTCHA is not configured
      // This allows development/testing without reCAPTCHA
      (
        request.log as unknown as { warn: (obj: object, msg: string) => void }
      ).warn(
        { path: request.url },
        'reCAPTCHA not configured, skipping validation'
      );
      return;
    }

    // Extract token from request
    const token = extractRecaptchaToken(request);

    if (!token) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'reCAPTCHA token required',
        details: 'Missing recaptchaToken in request body or X-Recaptcha-Token header',
      });
    }

    // Extract client IP for verification
    const clientIp = extractClientIp(request);

    // Verify token with Google API
    const verifyResult = await verifyRecaptchaToken(token, clientIp);

    // Check verification success
    if (!verifyResult.success) {
      (
        request.log as unknown as { warn: (obj: object, msg: string) => void }
      ).warn(
        {
          errorCodes: verifyResult['error-codes'],
          clientIp,
        },
        'reCAPTCHA verification failed'
      );

      return reply.code(403).send({
        error: 'Forbidden',
        message: 'reCAPTCHA verification failed',
        details: verifyResult['error-codes']?.join(', ') || 'Unknown error',
      });
    }

    // Check score threshold
    const score = verifyResult.score ?? 0;

    if (score < RECAPTCHA_SCORE_THRESHOLD) {
      (
        request.log as unknown as { warn: (obj: object, msg: string) => void }
      ).warn(
        {
          score,
          threshold: RECAPTCHA_SCORE_THRESHOLD,
          clientIp,
          action: verifyResult.action,
        },
        'reCAPTCHA score below threshold'
      );

      return reply.code(403).send({
        error: 'Forbidden',
        message: 'reCAPTCHA score too low',
        details: `Score ${score.toFixed(2)} is below threshold ${RECAPTCHA_SCORE_THRESHOLD}`,
      });
    }

    // Attach score to request for downstream handlers
    request.recaptchaScore = score;

    (
      request.log as unknown as { debug: (obj: object, msg: string) => void }
    ).debug(
      {
        score,
        action: verifyResult.action,
        clientIp,
      },
      'reCAPTCHA validation successful'
    );
  } catch (error) {
    // Log error with details
    (
      request.log as unknown as { error: (obj: object, msg: string) => void }
    ).error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'reCAPTCHA middleware error'
    );

    // Return 502 for external API errors, 500 for internal errors
    const isApiError =
      error instanceof Error && error.message.includes('reCAPTCHA API');
    const statusCode = isApiError ? 502 : 500;

    return reply.code(statusCode).send({
      error: isApiError ? 'Bad Gateway' : 'Internal Server Error',
      message: 'reCAPTCHA verification error',
      details:
        env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : 'Please try again later',
    });
  }
};

/**
 * Require reCAPTCHA middleware
 *
 * Ensures request has been validated by reCAPTCHA and has a score.
 * Use this for endpoints that require reCAPTCHA validation.
 *
 * Note: This is typically not needed as recaptchaMiddleware already validates.
 * Use this only if you need to ensure reCAPTCHA was checked in a specific route.
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export const requireRecaptcha: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  if (request.recaptchaScore === undefined) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'reCAPTCHA validation required',
    });
  }
};

/**
 * Export score threshold for testing
 */
export { RECAPTCHA_SCORE_THRESHOLD };
