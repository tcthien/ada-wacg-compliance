import { z } from 'zod';

/**
 * Discovery Module Validation Schemas
 *
 * This module provides Zod validation schemas for the website skeleton discovery API.
 * All schemas include SSRF protection and MVP-appropriate constraints.
 */

// ============================================================================
// PRIVATE IP RANGES (SSRF PROTECTION)
// ============================================================================

/**
 * Private IP address ranges that should be blocked to prevent SSRF attacks
 *
 * Includes:
 * - Loopback: 127.0.0.0/8 (localhost)
 * - Private Class A: 10.0.0.0/8
 * - Private Class B: 172.16.0.0/12 (172.16-31.x.x)
 * - Private Class C: 192.168.0.0/16
 * - Link-local: 169.254.0.0/16
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./,           // 127.0.0.0/8 - loopback
  /^10\./,            // 10.0.0.0/8 - private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 - private class B
  /^192\.168\./,      // 192.168.0.0/16 - private class C
  /^169\.254\./,      // 169.254.0.0/16 - link-local
];

/**
 * Private hostnames that should be blocked to prevent SSRF attacks
 */
const PRIVATE_HOSTNAMES = [
  'localhost',
  '0.0.0.0',
];

/**
 * Safe URL validation schema with SSRF protection
 *
 * Validates that a URL:
 * - Is a valid URL format
 * - Uses http or https protocol only
 * - Does not target private IP ranges
 * - Does not use localhost or private hostnames
 *
 * SSRF Protection:
 * - Blocks 10.x.x.x (private class A)
 * - Blocks 172.16-31.x.x (private class B)
 * - Blocks 192.168.x.x (private class C)
 * - Blocks 127.x.x.x (loopback)
 * - Blocks localhost and related hostnames
 * - Blocks link-local addresses (169.254.x.x)
 *
 * @example
 * ```ts
 * safeUrlSchema.parse('https://example.com'); // Valid
 * safeUrlSchema.parse('http://localhost'); // Throws validation error
 * safeUrlSchema.parse('https://192.168.1.1'); // Throws validation error
 * ```
 */
export const safeUrlSchema = z
  .string({
    required_error: 'URL is required',
    invalid_type_error: 'URL must be a string',
  })
  .url('Invalid URL format')
  .refine(
    (url) => {
      try {
        const parsedUrl = new URL(url);

        // Only allow http and https protocols
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return false;
        }

        // Block private hostnames
        const hostname = parsedUrl.hostname.toLowerCase();
        if (PRIVATE_HOSTNAMES.includes(hostname)) {
          return false;
        }

        // Block private IP ranges
        for (const pattern of PRIVATE_IP_PATTERNS) {
          if (pattern.test(hostname)) {
            return false;
          }
        }

        return true;
      } catch {
        return false;
      }
    },
    {
      message: 'URL must use http/https protocol and cannot target private IP addresses or localhost',
    }
  );

// ============================================================================
// DISCOVERY CREATION SCHEMAS
// ============================================================================

/**
 * Schema for creating a new discovery job (POST /discoveries)
 *
 * Validates:
 * - homepageUrl: Required, must pass SSRF protection
 * - mode: Optional, defaults to 'AUTO', must be 'AUTO' or 'MANUAL'
 * - maxPages: Optional, defaults to 10, maximum 10 for MVP
 * - maxDepth: Optional, defaults to 1, maximum 1 for MVP
 *
 * MVP Constraints:
 * - maxPages limited to 10 to control resource usage
 * - maxDepth limited to 1 to control crawl complexity
 *
 * @example
 * ```ts
 * const request = {
 *   homepageUrl: 'https://example.com',
 *   mode: 'AUTO',
 *   maxPages: 10,
 *   maxDepth: 1
 * };
 * createDiscoverySchema.parse(request);
 * ```
 */
export const createDiscoverySchema = z.object({
  /**
   * Website homepage URL to discover
   * Must be a valid URL with SSRF protection
   */
  homepageUrl: safeUrlSchema,

  /**
   * Discovery execution mode
   * Optional - defaults to 'AUTO'
   * AUTO: Runs all phases automatically
   * MANUAL: Allows user control over phases
   */
  mode: z.enum(['AUTO', 'MANUAL'], {
    errorMap: () => ({ message: 'Mode must be AUTO or MANUAL' }),
  }).default('AUTO'),

  /**
   * Maximum number of pages to discover
   * Optional - defaults to 10
   * MVP constraint: Maximum 10 pages to control resource usage
   */
  maxPages: z.coerce
    .number({
      invalid_type_error: 'Max pages must be a number',
    })
    .int('Max pages must be an integer')
    .positive('Max pages must be positive')
    .max(10, 'Max pages cannot exceed 10 in MVP')
    .default(10),

  /**
   * Maximum crawl depth
   * Optional - defaults to 1
   * MVP constraint: Maximum depth of 1 to control crawl complexity
   */
  maxDepth: z.coerce
    .number({
      invalid_type_error: 'Max depth must be a number',
    })
    .int('Max depth must be an integer')
    .positive('Max depth must be positive')
    .max(1, 'Max depth cannot exceed 1 in MVP')
    .default(1),
});

// ============================================================================
// MANUAL URL ADDITION SCHEMAS
// ============================================================================

/**
 * Schema for adding a single manual URL to a discovery
 *
 * Validates:
 * - url: Required, must pass SSRF protection
 *
 * @example
 * ```ts
 * const request = {
 *   url: 'https://example.com/about'
 * };
 * addManualUrlSchema.parse(request);
 * ```
 */
export const addManualUrlSchema = z.object({
  /**
   * URL to add to the discovery
   * Must be a valid URL with SSRF protection
   */
  url: safeUrlSchema,
});

/**
 * Schema for adding multiple manual URLs to a discovery
 *
 * Validates:
 * - urls: Required array of URLs, max 10 items for MVP
 * - Each URL must pass SSRF protection
 *
 * MVP Constraint: Maximum 10 URLs per batch to control resource usage
 *
 * @example
 * ```ts
 * const request = {
 *   urls: [
 *     'https://example.com/about',
 *     'https://example.com/contact',
 *     'https://example.com/pricing'
 *   ]
 * };
 * addMultipleUrlsSchema.parse(request);
 * ```
 */
export const addMultipleUrlsSchema = z.object({
  /**
   * Array of URLs to add to the discovery
   * Maximum 10 URLs per batch for MVP
   * Each URL must pass SSRF protection
   */
  urls: z
    .array(safeUrlSchema, {
      required_error: 'URLs array is required',
      invalid_type_error: 'URLs must be an array',
    })
    .min(1, 'At least one URL is required')
    .max(10, 'Cannot add more than 10 URLs at once in MVP'),
});

// ============================================================================
// ROUTE PARAMETER SCHEMAS
// ============================================================================

/**
 * Schema for validating discovery ID route parameters
 *
 * Ensures the discovery ID is a valid UUID format
 * Used in route parameter validation for discovery endpoints
 *
 * @example
 * ```ts
 * const params = { discoveryId: '550e8400-e29b-41d4-a716-446655440000' };
 * discoveryIdParamSchema.parse(params);
 * ```
 */
export const discoveryIdParamSchema = z.object({
  /**
   * Discovery ID from route parameter
   * Must be a valid UUID v4 format
   */
  discoveryId: z.string().uuid('Invalid discovery ID format'),
});

/**
 * Schema for validating page ID route parameters
 *
 * Ensures the page ID is a valid UUID format
 * Used in route parameter validation for discovered page endpoints
 *
 * @example
 * ```ts
 * const params = { pageId: '550e8400-e29b-41d4-a716-446655440000' };
 * pageIdParamSchema.parse(params);
 * ```
 */
export const pageIdParamSchema = z.object({
  /**
   * Discovered page ID from route parameter
   * Must be a valid UUID v4 format
   */
  pageId: z.string().uuid('Invalid page ID format'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * TypeScript types inferred from Zod schemas
 * Used throughout the application for type safety
 */
export type SafeUrl = z.infer<typeof safeUrlSchema>;
export type CreateDiscoveryRequest = z.infer<typeof createDiscoverySchema>;
export type AddManualUrlRequest = z.infer<typeof addManualUrlSchema>;
export type AddMultipleUrlsRequest = z.infer<typeof addMultipleUrlsSchema>;
export type DiscoveryIdParam = z.infer<typeof discoveryIdParamSchema>;
export type PageIdParam = z.infer<typeof pageIdParamSchema>;
