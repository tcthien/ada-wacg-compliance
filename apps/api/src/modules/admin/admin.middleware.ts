import type {
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
import { verifyToken, AdminServiceError } from './admin.service.js';
import { findById } from './admin.repository.js';
import { getRedisClient } from '../../config/redis.js';
import { AdminRedisKeys } from '../../shared/constants/redis-keys.js';

/**
 * Admin JWT Authentication Middleware
 *
 * Validates admin JWT tokens from HTTP-only cookies and attaches admin user
 * information to the request object for downstream handlers.
 *
 * Features:
 * - Extracts token from secure HTTP-only cookie
 * - Verifies JWT signature and expiration
 * - Checks token blacklist status
 * - Validates admin account status
 * - Attaches admin user to request object
 *
 * Security:
 * - Uses HTTP-only cookies to prevent XSS attacks
 * - Verifies token blacklist for logout enforcement
 * - Checks account active status
 * - Returns 401 for any authentication failure
 */

/**
 * Admin authentication cookie name
 */
export const ADMIN_COOKIE_NAME = 'adashield_admin_token';

/**
 * Admin authentication middleware
 *
 * Verifies JWT from HTTP-only cookie and attaches admin to request.
 * Returns 401 Unauthorized for any authentication failure.
 *
 * Request extensions (on success):
 * - `request.adminUser` - Full admin user record from database
 * - `request.adminToken` - Raw JWT token string
 * - `request.adminTokenPayload` - Decoded JWT payload
 *
 * Error responses:
 * - 401 if token missing, invalid, expired, or blacklisted
 * - 401 if admin user not found in database
 * - 401 if admin account is deactivated
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 *
 * @example
 * ```typescript
 * // Protect a route
 * fastify.get('/admin/profile',
 *   { preHandler: adminAuthMiddleware },
 *   async (request, reply) => {
 *     return { admin: request.adminUser };
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Chain with role check
 * fastify.post('/admin/users',
 *   { preHandler: [adminAuthMiddleware, requireSuperAdmin] },
 *   async (request, reply) => {
 *     // Only super admins reach here
 *   }
 * );
 * ```
 */
export const adminAuthMiddleware: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // 1. Extract token from HTTP-only cookie
  const token = request.cookies[ADMIN_COOKIE_NAME];

  if (!token) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // 2. Verify token signature, expiration, and blacklist
    const payload = await verifyToken(token);

    // 3. Get full admin user from database
    const admin = await findById(payload.sub);

    if (!admin) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Admin not found',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    // 4. Check account is active
    if (!admin.isActive) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // 5. Attach admin information to request
    request.adminUser = admin;
    request.adminToken = token;
    request.adminTokenPayload = payload;
  } catch (error) {
    // Handle specific admin service errors
    if (error instanceof AdminServiceError) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid token',
      code: 'UNAUTHORIZED',
    });
  }
};

/**
 * Require SUPER_ADMIN role middleware
 *
 * Ensures authenticated admin has SUPER_ADMIN role.
 * Must be used after adminAuthMiddleware in the preHandler chain.
 *
 * Returns 403 Forbidden if admin role is not SUPER_ADMIN.
 * Returns 401 Unauthorized if no admin user attached (middleware not chained).
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 *
 * @example
 * ```typescript
 * // Restrict endpoint to super admins only
 * fastify.post('/admin/users',
 *   { preHandler: [adminAuthMiddleware, requireSuperAdmin] },
 *   async (request, reply) => {
 *     // Only super admins can create users
 *     return createAdmin(request.body);
 *   }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Multiple role checks
 * fastify.delete('/admin/users/:id',
 *   {
 *     preHandler: [
 *       adminAuthMiddleware,
 *       requireSuperAdmin,
 *       customValidationMiddleware
 *     ]
 *   },
 *   async (request, reply) => {
 *     // Handler logic
 *   }
 * );
 * ```
 */
export const requireSuperAdmin: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Ensure adminAuthMiddleware was run first
  if (!request.adminUser) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
  }

  // Check role
  if (request.adminUser.role !== 'SUPER_ADMIN') {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Super admin access required',
      code: 'FORBIDDEN',
    });
  }
};

/**
 * Login Rate Limit Configuration
 *
 * Prevents brute force attacks on admin login endpoint.
 * Limits: 5 login attempts per 15 minutes per IP address.
 */
export const LOGIN_RATE_LIMIT = {
  MAX_ATTEMPTS: 5,
  WINDOW_SECONDS: 900, // 15 minutes
} as const;

/**
 * Get client IP address from request
 *
 * Checks X-Forwarded-For header first (for reverse proxies),
 * falls back to direct connection IP.
 *
 * @param request - Fastify request
 * @returns Client IP address
 *
 * @example
 * ```typescript
 * // In controller
 * const ip = getClientIP(request);
 * await recordFailedLogin(ip);
 * ```
 */
export function getClientIP(request: FastifyRequest): string {
  // Check forwarded headers first (for proxies)
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return ips[0]?.trim() || request.ip;
  }
  return request.ip;
}

/**
 * Login Rate Limit Middleware
 *
 * Limits login attempts to prevent brute force attacks.
 * Enforces 5 attempts per 15 minutes per IP address.
 *
 * Features:
 * - Redis-based attempt counter with TTL
 * - Standard rate limit headers (X-RateLimit-*)
 * - 429 response with Retry-After header when exceeded
 * - Graceful degradation if Redis unavailable
 * - IP-based tracking with proxy header support
 *
 * Note: This middleware only checks the rate limit.
 * Call recordFailedLogin() from controller on failed attempts.
 * Optionally call clearLoginAttempts() on successful login.
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 *
 * @example
 * ```typescript
 * // Apply to login route
 * fastify.post('/admin/login',
 *   { preHandler: loginRateLimitMiddleware },
 *   loginHandler
 * );
 * ```
 */
export const loginRateLimitMiddleware: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const redis = getRedisClient();
    const ip = getClientIP(request);
    const key = AdminRedisKeys.LOGIN_ATTEMPTS.build(ip);

    // Get current count
    const countStr = await redis.get(key);
    const currentCount = countStr ? parseInt(countStr, 10) : 0;

    if (currentCount >= LOGIN_RATE_LIMIT.MAX_ATTEMPTS) {
      // Get TTL for Retry-After
      const ttl = await redis.ttl(key);
      const retryAfter = ttl > 0 ? ttl : LOGIN_RATE_LIMIT.WINDOW_SECONDS;

      // Set headers
      reply.header('X-RateLimit-Limit', LOGIN_RATE_LIMIT.MAX_ATTEMPTS.toString());
      reply.header('X-RateLimit-Remaining', '0');
      reply.header('Retry-After', retryAfter.toString());

      return reply.code(429).send({
        error: 'Too Many Requests',
        message: `Too many login attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        code: 'RATE_LIMITED',
        retryAfter,
      });
    }

    // Set headers for remaining attempts
    const remaining = LOGIN_RATE_LIMIT.MAX_ATTEMPTS - currentCount - 1;
    reply.header('X-RateLimit-Limit', LOGIN_RATE_LIMIT.MAX_ATTEMPTS.toString());
    reply.header('X-RateLimit-Remaining', Math.max(0, remaining).toString());

  } catch (error) {
    // Fail open - allow request if Redis unavailable
    console.error('Login rate limit error:', error);
  }
};

/**
 * Record Failed Login Attempt
 *
 * Increments the failed login counter for an IP address.
 * Should be called from the login controller when authentication fails.
 *
 * Uses Redis pipeline for atomic increment + TTL set.
 * Sets 15-minute expiration window on first attempt.
 *
 * @param ip - Client IP address
 *
 * @example
 * ```typescript
 * // In login controller on auth failure
 * const ip = getClientIP(request);
 * await recordFailedLogin(ip);
 * ```
 */
export async function recordFailedLogin(ip: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = AdminRedisKeys.LOGIN_ATTEMPTS.build(ip);

    // Atomic increment + expire
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, AdminRedisKeys.LOGIN_ATTEMPTS.ttl);
    await pipeline.exec();
  } catch (error) {
    console.error('Failed to record login attempt:', error);
  }
}

/**
 * Clear Login Attempts
 *
 * Removes the failed login counter for an IP address.
 * Optionally called from the login controller after successful authentication
 * to reset the counter and allow immediate subsequent logins.
 *
 * @param ip - Client IP address
 *
 * @example
 * ```typescript
 * // In login controller on auth success (optional)
 * const ip = getClientIP(request);
 * await clearLoginAttempts(ip);
 * ```
 */
export async function clearLoginAttempts(ip: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = AdminRedisKeys.LOGIN_ATTEMPTS.build(ip);
    await redis.del(key);
  } catch (error) {
    console.error('Failed to clear login attempts:', error);
  }
}
