/**
 * Redis Key Constants
 *
 * Centralized Redis key patterns and TTL configurations
 * for consistent caching and data storage across the application.
 */

/**
 * Redis key patterns with type-safe builders
 */
export const RedisKeys = {
  /**
   * Rate limiting keys
   * Pattern: rate_limit:{identifier}
   * TTL: 60 seconds (sliding window)
   * Usage: Track API request counts per IP/user
   */
  RATE_LIMIT: {
    pattern: 'rate_limit',
    build: (identifier: string) => `rate_limit:${identifier}`,
    ttl: 60, // 1 minute
  },

  /**
   * URL-based rate limiting keys
   * Pattern: rate_limit_url:{url_hash}:{fingerprint}
   * TTL: 1 hour (3600 seconds)
   * Usage: Track scan requests per URL + fingerprint combination
   */
  RATE_LIMIT_URL: {
    pattern: 'rate_limit_url',
    build: (urlHash: string, fingerprint: string) => `rate_limit_url:${urlHash}:${fingerprint}`,
    ttl: 3600, // 1 hour
  },

  /**
   * Guest session cache
   * Pattern: session:{sessionId}
   * TTL: 1 hour (extends on activity)
   * Usage: Store guest user session data
   */
  SESSION: {
    pattern: 'session',
    build: (sessionId: string) => `session:${sessionId}`,
    ttl: 3600, // 1 hour
  },

  /**
   * Scan status tracking
   * Pattern: scan:{scanId}:status
   * TTL: 24 hours
   * Usage: Real-time scan status for WebSocket updates
   */
  SCAN_STATUS: {
    pattern: 'scan:status',
    build: (scanId: string) => `scan:${scanId}:status`,
    ttl: 86400, // 24 hours
  },

  /**
   * Scan progress percentage
   * Pattern: scan:{scanId}:progress
   * TTL: 24 hours
   * Usage: Real-time progress tracking (0-100)
   */
  SCAN_PROGRESS: {
    pattern: 'scan:progress',
    build: (scanId: string) => `scan:${scanId}:progress`,
    ttl: 86400, // 24 hours
  },

  /**
   * Scan results cache
   * Pattern: scan:{scanId}:results
   * TTL: 7 days
   * Usage: Cache full scan results for quick retrieval
   */
  SCAN_RESULTS: {
    pattern: 'scan:results',
    build: (scanId: string) => `scan:${scanId}:results`,
    ttl: 604800, // 7 days
  },

  /**
   * User scan history
   * Pattern: user:{userId}:scans
   * TTL: 30 days
   * Usage: List of scan IDs for user history
   */
  USER_SCANS: {
    pattern: 'user:scans',
    build: (userId: string) => `user:${userId}:scans`,
    ttl: 2592000, // 30 days
  },

  /**
   * API response cache
   * Pattern: cache:{endpoint}:{params_hash}
   * TTL: 5 minutes
   * Usage: Cache frequently accessed API responses
   */
  CACHE: {
    pattern: 'cache',
    build: (endpoint: string, paramsHash: string) => `cache:${endpoint}:${paramsHash}`,
    ttl: 300, // 5 minutes
  },
} as const;

/**
 * Redis key TTL constants (in seconds)
 */
export const RedisTTL = {
  /** Very short-lived (1 minute) */
  VERY_SHORT: 60,
  /** Short-lived (5 minutes) */
  SHORT: 300,
  /** Medium-lived (1 hour) */
  MEDIUM: 3600,
  /** Long-lived (24 hours) */
  LONG: 86400,
  /** Very long-lived (7 days) */
  VERY_LONG: 604800,
  /** Persistent (30 days) */
  PERSISTENT: 2592000,
} as const;

/**
 * Type-safe key builder helper
 */
export type RedisKeyBuilder = {
  pattern: string;
  build: (...args: string[]) => string;
  ttl: number;
};

/**
 * Validate Redis key format
 * Ensures keys follow naming conventions
 */
export function validateRedisKey(key: string): boolean {
  // Keys should follow pattern: prefix:identifier or prefix:id:suffix
  // Allows alphanumeric, dots, hyphens, underscores in identifiers
  const keyPattern = /^[a-z_]+:[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+)?$/;
  return keyPattern.test(key);
}

/**
 * Extract pattern from Redis key
 * Example: "scan:123:status" -> "scan:status"
 */
export function extractKeyPattern(key: string): string | null {
  const parts = key.split(':');
  if (parts.length < 2) return null;

  // Remove middle dynamic parts
  if (parts.length === 3) {
    return `${parts[0]}:${parts[2]}`;
  }

  return parts[0] ?? null;
}

/**
 * Get TTL for a key pattern
 */
export function getTTLForPattern(pattern: string): number | null {
  const entry = Object.values(RedisKeys).find((k) => k.pattern === pattern);
  return entry ? entry.ttl : null;
}
