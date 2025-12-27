import { randomBytes } from 'node:crypto';
import type {
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
import type { FastifyCookieOptions } from '@fastify/cookie';
import type { GuestSession } from '@prisma/client';
import { getPrismaClient } from '../../config/database.js';
import { getRedisClient } from '../../config/redis.js';
import { RedisKeys } from '../constants/redis-keys.js';
import { generateFingerprint } from '../utils/fingerprint.js';

/**
 * Session Middleware
 *
 * Manages guest sessions via secure HTTP-only cookies.
 * Implements session creation, validation, and caching.
 *
 * Features:
 * - Secure session token generation (32 bytes, base64url)
 * - Redis caching with 1-hour TTL
 * - Fingerprint-based session validation
 * - 24-hour session expiration
 * - Automatic anonymized session filtering
 */

/**
 * Session cookie name
 */
const SESSION_COOKIE_NAME = 'adashield_session';

/**
 * Session duration (24 hours in seconds)
 */
const SESSION_DURATION_SECONDS = 86400;

/**
 * Session duration in milliseconds
 */
const SESSION_DURATION_MS = SESSION_DURATION_SECONDS * 1000;

/**
 * Generate a secure session token
 *
 * Creates a 32-byte random token encoded as base64url.
 * Base64url encoding ensures URL-safe tokens without padding.
 *
 * @returns Session token string (43 characters)
 */
function generateSessionToken(): string {
  const token = randomBytes(32);
  // Convert to base64url (URL-safe, no padding)
  return token.toString('base64url');
}

/**
 * Validate session token format
 *
 * @param token - Session token to validate
 * @returns True if token format is valid
 */
function validateSessionTokenFormat(token: string): boolean {
  // Base64url tokens are 43 characters long for 32 bytes
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * Get session from cache
 *
 * @param sessionToken - Session token
 * @returns Cached session data or null
 */
async function getSessionFromCache(
  sessionToken: string
): Promise<GuestSession | null> {
  try {
    const redis = getRedisClient();
    const cacheKey = RedisKeys.SESSION.build(sessionToken);
    const cached = await redis.get(cacheKey);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as GuestSession;
  } catch (error) {
    console.error('Session cache read error:', error);
    return null;
  }
}

/**
 * Cache session data
 *
 * @param session - Session to cache
 */
async function cacheSession(session: GuestSession): Promise<void> {
  try {
    const redis = getRedisClient();
    const cacheKey = RedisKeys.SESSION.build(session.sessionToken);
    await redis.setex(cacheKey, RedisKeys.SESSION.ttl, JSON.stringify(session));
  } catch (error) {
    console.error('Session cache write error:', error);
    // Non-critical error, continue without caching
  }
}

/**
 * Get session from database
 *
 * @param sessionToken - Session token
 * @returns Session from database or null
 */
async function getSessionFromDatabase(
  sessionToken: string
): Promise<GuestSession | null> {
  try {
    const prisma = getPrismaClient();
    const session = await prisma.guestSession.findUnique({
      where: { sessionToken },
    });

    return session;
  } catch (error) {
    console.error('Database session lookup error:', error);
    return null;
  }
}

/**
 * Validate session is active
 *
 * Checks if session is not expired and not anonymized
 *
 * @param session - Session to validate
 * @returns True if session is valid
 */
function isSessionValid(session: GuestSession): boolean {
  const now = new Date();

  // Check not expired
  if (session.expiresAt < now) {
    return false;
  }

  // Check not anonymized
  if (session.anonymizedAt !== null) {
    return false;
  }

  return true;
}

/**
 * Create new guest session
 *
 * @param fingerprint - Device fingerprint
 * @returns New guest session
 */
async function createGuestSession(fingerprint: string): Promise<GuestSession> {
  const sessionToken = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  try {
    const prisma = getPrismaClient();
    const session = await prisma.guestSession.create({
      data: {
        sessionToken,
        fingerprint,
        expiresAt,
      },
    });

    // Cache the new session
    await cacheSession(session);

    return session;
  } catch (error) {
    console.error('Failed to create guest session:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * Set session cookie
 *
 * @param reply - Fastify reply object
 * @param sessionToken - Session token to set in cookie
 */
function setSessionCookie(reply: FastifyReply, sessionToken: string): void {
  const isProduction = process.env['NODE_ENV'] === 'production';

  reply.setCookie(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
  });
}

/**
 * Session middleware preHandler hook
 *
 * Validates existing sessions or creates new ones.
 * Attaches session to request.guestSession for downstream handlers.
 *
 * Error handling:
 * - If database unavailable, logs error and continues without session
 * - If session invalid, creates new session
 * - Non-critical errors don't fail the request
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export const sessionMiddleware: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (sessionToken && validateSessionTokenFormat(sessionToken)) {
      // Try to get session from cache first
      let session = await getSessionFromCache(sessionToken);

      // If not in cache, try database
      if (!session) {
        session = await getSessionFromDatabase(sessionToken);

        // Cache if found in database
        if (session) {
          await cacheSession(session);
        }
      }

      // Validate session
      if (session && isSessionValid(session)) {
        // Check fingerprint match (optional, log warning if mismatch)
        const currentFingerprint = generateFingerprint(request);
        if (session.fingerprint !== currentFingerprint) {
          (request.log as unknown as { warn: (obj: object, msg: string) => void }).warn(
            {
              sessionId: session.id,
              storedFingerprint: session.fingerprint,
              currentFingerprint,
            },
            'Session fingerprint mismatch'
          );
          // Continue anyway - fingerprints can change legitimately
        }

        // Attach session to request
        request.guestSession = session;
        return;
      }
    }

    // No valid session found - create new one
    const fingerprint = generateFingerprint(request);
    const newSession = await createGuestSession(fingerprint);

    // Set cookie
    setSessionCookie(reply, newSession.sessionToken);

    // Attach session to request
    request.guestSession = newSession;
  } catch (error) {
    // Log error but don't fail the request
    (request.log as unknown as { error: (obj: object, msg: string) => void }).error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Session middleware error'
    );
    // Request continues without session
    // Downstream handlers should check for request.guestSession existence
  }
};

/**
 * Require session middleware
 *
 * Ensures request has a valid session, returns 401 if not.
 * Use this for API endpoints that require a session.
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export const requireSession: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  if (!request.guestSession) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Valid session required',
    });
  }
};
