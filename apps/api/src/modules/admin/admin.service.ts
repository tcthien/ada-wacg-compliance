import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getRedisClient } from '../../config/redis.js';
import { AdminRedisKeys } from '../../shared/constants/redis-keys.js';
import { findByEmail, findById, update } from './admin.repository.js';
import type {
  AdminErrorCode,
  AdminTokenPayload,
  LoginResult,
} from './admin.types.js';
import type { AdminRole } from '@prisma/client';

/**
 * Configuration constants for authentication
 */
const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';
const BCRYPT_COST = 12;

/**
 * Custom error class for admin service operations
 *
 * Provides consistent error handling across all admin service methods.
 * Extends the base Error class with additional properties for error codes
 * and error chaining through the cause property.
 *
 * @property code - Standardized error code from AdminErrorCode type
 * @property cause - Optional underlying error that caused this error
 *
 * @example
 * ```ts
 * throw new AdminServiceError(
 *   'Invalid credentials',
 *   'INVALID_CREDENTIALS'
 * );
 * ```
 *
 * @example
 * ```ts
 * // With error chaining
 * try {
 *   await bcrypt.compare(password, hash);
 * } catch (err) {
 *   throw new AdminServiceError(
 *     'Password verification failed',
 *     'INVALID_PASSWORD',
 *     err
 *   );
 * }
 * ```
 */
export class AdminServiceError extends Error {
  public readonly code: AdminErrorCode;
  public override readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: AdminErrorCode,
    cause?: Error | undefined
  ) {
    super(message);
    this.name = 'AdminServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Hash password using bcrypt
 *
 * Uses bcrypt with a cost factor of 12 for secure password hashing.
 * Higher cost factors increase security but take more time to compute.
 *
 * @param password - Plain text password to hash
 * @returns Bcrypt password hash
 * @throws AdminServiceError if hashing fails
 *
 * @example
 * ```typescript
 * const hash = await hashPassword('SecureP@ssw0rd');
 * // hash: '$2b$12$...'
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    return hash;
  } catch (error) {
    throw new AdminServiceError(
      'Failed to hash password',
      'INVALID_PASSWORD',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Verify password against hash
 *
 * Uses bcrypt's constant-time comparison to prevent timing attacks.
 *
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns True if password matches hash, false otherwise
 * @throws AdminServiceError if verification fails
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword('userPassword', storedHash);
 * if (isValid) {
 *   console.log('Password is correct');
 * }
 * ```
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    throw new AdminServiceError(
      'Failed to verify password',
      'INVALID_PASSWORD',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Generate JWT token for admin
 *
 * Creates a JWT with admin claims and a unique token ID (jti) for blacklisting.
 * Token expires after 24 hours.
 *
 * @param adminId - Admin user ID
 * @param email - Admin email address
 * @param role - Admin role
 * @returns Signed JWT token string
 *
 * @example
 * ```typescript
 * const token = generateToken('admin123', 'admin@example.com', 'SUPER_ADMIN');
 * // Returns: 'eyJhbGciOiJIUzI1NiIs...'
 * ```
 */
export function generateToken(
  adminId: string,
  email: string,
  role: AdminRole
): string {
  const tokenId = randomUUID();
  const payload: Omit<AdminTokenPayload, 'iat' | 'exp'> & { jti: string } = {
    sub: adminId,
    email,
    role,
    jti: tokenId,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return token;
}

/**
 * Login admin with email and password
 *
 * Validates credentials and returns admin information on success.
 * Token is sent via HTTP-only cookie by the controller, not in response body.
 * Updates lastLoginAt timestamp on successful login.
 *
 * @param email - Admin email address
 * @param password - Plain text password
 * @returns Admin information and token expiration
 * @throws AdminServiceError with appropriate code for various failure cases
 *
 * @example
 * ```typescript
 * try {
 *   const result = await login('admin@example.com', 'password123');
 *   console.log(`Logged in: ${result.admin.email}, role: ${result.admin.role}`);
 *   if (result.admin.mustChangePassword) {
 *     console.log('User must change password');
 *   }
 * } catch (error) {
 *   if (error instanceof AdminServiceError) {
 *     console.error(`Login failed: ${error.code}`);
 *   }
 * }
 * ```
 */
export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    // Find admin by email
    const admin = await findByEmail(email);
    if (!admin) {
      throw new AdminServiceError(
        'Invalid email or password',
        'INVALID_CREDENTIALS'
      );
    }

    // Check if account is active
    if (!admin.isActive) {
      throw new AdminServiceError(
        'Account has been deactivated',
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new AdminServiceError(
        'Invalid email or password',
        'INVALID_CREDENTIALS'
      );
    }

    // Update last login timestamp
    await update(admin.id, { lastLoginAt: new Date() });

    // Calculate token expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        mustChangePassword: admin.mustChangePassword,
      },
      expiresAt,
    };
  } catch (error) {
    // Re-throw AdminServiceError as-is
    if (error instanceof AdminServiceError) {
      throw error;
    }

    // Wrap other errors
    throw new AdminServiceError(
      'Login failed',
      'INVALID_CREDENTIALS',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Logout admin by blacklisting their token
 *
 * Adds the token ID to Redis blacklist with TTL matching JWT expiration.
 * This prevents the token from being used even if it hasn't expired yet.
 *
 * @param tokenId - JWT token ID (jti claim)
 * @returns Promise that resolves when token is blacklisted
 * @throws AdminServiceError if blacklisting fails
 *
 * @example
 * ```typescript
 * await logout('token-uuid-123');
 * // Token is now blacklisted and cannot be used
 * ```
 */
export async function logout(tokenId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = AdminRedisKeys.JWT_BLACKLIST.build(tokenId);
    const ttl = AdminRedisKeys.JWT_BLACKLIST.ttl;

    // Store blacklisted token with TTL matching JWT expiration
    await redis.setex(key, ttl, '1');
  } catch (error) {
    throw new AdminServiceError(
      'Failed to logout',
      'UNAUTHORIZED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Verify JWT token is valid and not blacklisted
 *
 * Validates token signature, expiration, and checks blacklist.
 * This method should be called by authentication middleware.
 *
 * @param token - JWT token string
 * @returns Decoded token payload
 * @throws AdminServiceError with appropriate code for various failure cases
 *
 * @example
 * ```typescript
 * try {
 *   const payload = await verifyToken(token);
 *   console.log(`Authenticated admin: ${payload.email}, role: ${payload.role}`);
 * } catch (error) {
 *   if (error instanceof AdminServiceError) {
 *     switch (error.code) {
 *       case 'TOKEN_EXPIRED':
 *         console.log('Token has expired');
 *         break;
 *       case 'TOKEN_BLACKLISTED':
 *         console.log('Token has been revoked');
 *         break;
 *       case 'UNAUTHORIZED':
 *         console.log('Invalid token');
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export async function verifyToken(token: string): Promise<AdminTokenPayload> {
  try {
    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload & {
      jti: string;
    };

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(decoded.jti);
    if (isBlacklisted) {
      throw new AdminServiceError(
        'Token has been revoked',
        'TOKEN_BLACKLISTED'
      );
    }

    return decoded;
  } catch (error) {
    // Handle JWT-specific errors
    if (error instanceof jwt.TokenExpiredError) {
      throw new AdminServiceError('Token has expired', 'TOKEN_EXPIRED');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new AdminServiceError('Invalid token', 'UNAUTHORIZED');
    }

    // Re-throw AdminServiceError as-is
    if (error instanceof AdminServiceError) {
      throw error;
    }

    // Wrap other errors
    throw new AdminServiceError(
      'Token verification failed',
      'UNAUTHORIZED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if token is blacklisted
 *
 * Queries Redis to check if a token ID has been blacklisted.
 *
 * @param tokenId - JWT token ID (jti claim)
 * @returns True if token is blacklisted, false otherwise
 *
 * @example
 * ```typescript
 * const blacklisted = await isTokenBlacklisted('token-uuid-123');
 * if (blacklisted) {
 *   console.log('Token has been revoked');
 * }
 * ```
 */
export async function isTokenBlacklisted(tokenId: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = AdminRedisKeys.JWT_BLACKLIST.build(tokenId);
    const result = await redis.get(key);
    return result !== null;
  } catch (error) {
    // Log error but don't throw - fail open for better availability
    console.error('Failed to check token blacklist:', error);
    return false;
  }
}
