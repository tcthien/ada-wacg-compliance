import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

/**
 * Device Fingerprint Generator
 *
 * Creates a semi-stable fingerprint from request headers to identify
 * returning users without requiring login. Used for session persistence
 * and basic fraud prevention.
 *
 * NOTE: This is not cryptographically secure and can be spoofed.
 * It's primarily used for session correlation, not security.
 */

/**
 * Extract fingerprint components from request headers
 */
function extractFingerprintComponents(request: FastifyRequest): {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
} {
  return {
    userAgent: request.headers['user-agent'] ?? 'unknown',
    acceptLanguage: request.headers['accept-language'] ?? 'unknown',
    acceptEncoding: request.headers['accept-encoding'] ?? 'unknown',
  };
}

/**
 * Generate a device fingerprint from request headers
 *
 * Combines User-Agent, Accept-Language, and Accept-Encoding headers
 * to create a semi-stable identifier. Returns first 16 characters
 * of SHA-256 hash.
 *
 * @param request - Fastify request object
 * @returns Fingerprint string (16 characters)
 *
 * @example
 * const fingerprint = generateFingerprint(request);
 * // Returns: "a1b2c3d4e5f6g7h8"
 */
export function generateFingerprint(request: FastifyRequest): string {
  const components = extractFingerprintComponents(request);

  // Combine components into a single string
  const fingerprintString = [
    components.userAgent,
    components.acceptLanguage,
    components.acceptEncoding,
  ].join('|');

  // Hash the combined string
  const hash = createHash('sha256').update(fingerprintString).digest('hex');

  // Return first 16 characters as fingerprint
  return hash.substring(0, 16);
}

/**
 * Validate fingerprint format
 *
 * Ensures fingerprint is exactly 16 hexadecimal characters
 *
 * @param fingerprint - Fingerprint string to validate
 * @returns True if valid format
 */
export function validateFingerprintFormat(fingerprint: string): boolean {
  return /^[a-f0-9]{16}$/.test(fingerprint);
}

/**
 * Compare two fingerprints for equality
 *
 * @param fingerprint1 - First fingerprint
 * @param fingerprint2 - Second fingerprint
 * @returns True if fingerprints match
 */
export function compareFingerprintFingerprints(
  fingerprint1: string,
  fingerprint2: string
): boolean {
  return fingerprint1.toLowerCase() === fingerprint2.toLowerCase();
}

/**
 * Get fingerprint components for debugging
 *
 * Useful for troubleshooting fingerprint mismatches
 *
 * @param request - Fastify request object
 * @returns Object containing fingerprint components
 */
export function getFingerprintComponents(request: FastifyRequest): {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  fingerprint: string;
} {
  const components = extractFingerprintComponents(request);
  return {
    ...components,
    fingerprint: generateFingerprint(request),
  };
}
