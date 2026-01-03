/**
 * Discovery Worker
 *
 * BullMQ worker for website skeleton discovery background jobs.
 * Orchestrates discovery phases: sitemap → navigation → crawling.
 *
 * Features:
 * - Automatic retry with exponential backoff (3 attempts)
 * - Timeout hierarchy: sitemap (10s), navigation (5s), page (3s)
 * - Status tracking and error handling
 * - Phase-based orchestration
 */

import { Worker, Queue, Job, JobsOptions } from 'bullmq';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import DOMPurify from 'isomorphic-dompurify';
import { getRedisClient, getBullMQConnection } from '../../config/redis.js';
import {
  findById,
  updateStatus,
  addPages,
} from './discovery.repository.js';
import {
  DiscoveryWorkerError,
  DiscoveryErrorCode,
  DiscoveryRepositoryError,
} from './discovery.errors.js';
import type {
  Discovery,
  DiscoveryPhase,
  DiscoveryWithPages,
} from './discovery.types.js';
import type { PageSource } from '@prisma/client';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Job options for discovery jobs
 *
 * Defines retry strategy, timeout, and cleanup policies.
 */
const DISCOVERY_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const;

/**
 * Timeout hierarchy for discovery phases
 *
 * Each phase has a specific timeout to prevent hanging operations:
 * - sitemap: 10s for fetching and parsing sitemap.xml
 * - navigation: 5s for extracting navigation links
 * - page: 3s per individual page fetch
 */
const TIMEOUT_HIERARCHY = {
  sitemap: 10000, // 10 seconds for sitemap fetch
  navigation: 5000, // 5 seconds for navigation extraction
  page: 3000, // 3 seconds per page fetch
} as const;

/**
 * Queue name for discovery jobs
 */
const QUEUE_NAME = 'website-discovery';

/**
 * Standard sitemap locations to check
 *
 * Ordered by most common to least common based on web standards.
 */
const STANDARD_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemaps/sitemap.xml',
] as const;

// ============================================================================
// URL VALIDATION AND SSRF PROTECTION
// ============================================================================

/**
 * Check if a hostname is a private IP address
 *
 * Validates whether a hostname resolves to a private/reserved IP address
 * to prevent Server-Side Request Forgery (SSRF) attacks.
 *
 * Blocked IP ranges:
 * - 10.0.0.0/8 (10.x.x.x) - Private network
 * - 172.16.0.0/12 (172.16.x.x - 172.31.x.x) - Private network
 * - 192.168.0.0/16 (192.168.x.x) - Private network
 * - 127.0.0.0/8 (127.x.x.x) - Localhost
 * - 169.254.0.0/16 (169.254.x.x) - Link-local
 * - ::1 - IPv6 localhost
 * - fe80::/10 - IPv6 link-local
 *
 * @param hostname - Hostname or IP address to check
 * @returns true if IP is private/reserved, false otherwise
 *
 * @example
 * ```typescript
 * isPrivateIP('192.168.1.1');    // Returns: true
 * isPrivateIP('10.0.0.1');       // Returns: true
 * isPrivateIP('127.0.0.1');      // Returns: true
 * isPrivateIP('example.com');    // Returns: false (public domain)
 * isPrivateIP('8.8.8.8');        // Returns: false (public IP)
 * isPrivateIP('::1');            // Returns: true (IPv6 localhost)
 * isPrivateIP('fe80::1');        // Returns: true (IPv6 link-local)
 * ```
 */
export function isPrivateIP(hostname: string): boolean {
  // Check IPv6 localhost and link-local
  if (hostname === '::1' || hostname.toLowerCase().startsWith('fe80:')) {
    return true;
  }

  // IPv4 pattern matching
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Pattern);

  if (!match) {
    // Not an IPv4 address - assume it's a hostname (public domain)
    return false;
  }

  // Parse octets - match groups are guaranteed to exist after successful match
  const octets = [
    parseInt(match[1]!, 10),
    parseInt(match[2]!, 10),
    parseInt(match[3]!, 10),
    parseInt(match[4]!, 10),
  ];

  // Validate octet ranges (0-255)
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return false; // Invalid IP
  }

  // Check private/reserved ranges
  const first = octets[0]!;
  const second = octets[1]!;

  // 10.0.0.0/8 (10.x.x.x)
  if (first === 10) {
    return true;
  }

  // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  // 192.168.0.0/16 (192.168.x.x)
  if (first === 192 && second === 168) {
    return true;
  }

  // 127.0.0.0/8 (127.x.x.x - localhost)
  if (first === 127) {
    return true;
  }

  // 169.254.0.0/16 (169.254.x.x - link-local)
  if (first === 169 && second === 254) {
    return true;
  }

  // Public IP
  return false;
}

/**
 * Validate URL and check for SSRF vulnerabilities
 *
 * Validates a URL against security policies:
 * 1. Valid URL format
 * 2. Protocol is http or https
 * 3. Hostname is not a private/reserved IP address
 * 4. URL is on the same domain as homepageUrl
 *
 * @param url - URL to validate
 * @param homepageUrl - Homepage URL for domain comparison
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * // Valid same-domain URL
 * validateUrl('https://example.com/page', 'https://example.com');
 * // Returns: { valid: true }
 *
 * // Invalid: Different domain
 * validateUrl('https://evil.com/page', 'https://example.com');
 * // Returns: { valid: false, error: 'URL must be on same domain as homepage' }
 *
 * // Invalid: Private IP (SSRF)
 * validateUrl('http://192.168.1.1', 'https://example.com');
 * // Returns: { valid: false, error: 'Private IP addresses are not allowed' }
 *
 * // Invalid: Wrong protocol
 * validateUrl('ftp://example.com/file', 'https://example.com');
 * // Returns: { valid: false, error: 'Only http and https protocols are allowed' }
 * ```
 */
export function validateUrl(
  url: string,
  homepageUrl: string
): { valid: boolean; error?: string } {
  try {
    // Parse URLs
    const urlObj = new URL(url);
    const homepageUrlObj = new URL(homepageUrl);

    // Check protocol
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Only http and https protocols are allowed',
      };
    }

    // Check for private IP (SSRF protection)
    if (isPrivateIP(urlObj.hostname)) {
      return {
        valid: false,
        error: 'Private IP addresses are not allowed',
      };
    }

    // Check same domain
    if (urlObj.origin !== homepageUrlObj.origin) {
      return {
        valid: false,
        error: 'URL must be on same domain as homepage',
      };
    }

    // Valid URL
    return { valid: true };
  } catch (error) {
    // Invalid URL format
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Normalize URL for consistent comparison
 *
 * Normalizes a URL by:
 * 1. Lowercasing the hostname
 * 2. Removing trailing slash from pathname
 * 3. Normalizing www prefix (www.example.com → example.com)
 * 4. Removing hash fragments
 *
 * @param url - URL to normalize
 * @returns Normalized URL string
 *
 * @example
 * ```typescript
 * normalizeUrl('https://WWW.Example.COM/Page/');
 * // Returns: 'https://example.com/Page'
 *
 * normalizeUrl('https://example.com/page#section');
 * // Returns: 'https://example.com/page'
 *
 * normalizeUrl('https://www.example.com/');
 * // Returns: 'https://example.com'
 *
 * normalizeUrl('https://example.com/page/');
 * // Returns: 'https://example.com/page'
 * ```
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Lowercase hostname
    let hostname = urlObj.hostname.toLowerCase();

    // Normalize www prefix (www.example.com → example.com)
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // Remove trailing slash from pathname
    let pathname = urlObj.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    // Remove hash fragments
    urlObj.hash = '';

    // Reconstruct URL with normalized components
    const normalizedUrl = `${urlObj.protocol}//${hostname}${pathname}${urlObj.search}`;

    return normalizedUrl;
  } catch (error) {
    // Return original URL if parsing fails
    return url;
  }
}

// ============================================================================
// URL DEDUPLICATION AND SANITIZATION
// ============================================================================

/**
 * Remove duplicate URLs by normalized form
 *
 * Deduplicates an array of URLs using normalized comparison while
 * preserving the original URL format of the first occurrence.
 *
 * Algorithm:
 * 1. Normalize each URL for comparison
 * 2. Use a Set to track seen normalized URLs
 * 3. Preserve first occurrence's original format
 * 4. Return deduplicated array in original order
 *
 * @param urls - Array of URLs to deduplicate
 * @returns Deduplicated array preserving first occurrence
 *
 * @example
 * ```typescript
 * const urls = [
 *   'https://example.com/page',
 *   'https://example.com/page/',
 *   'https://EXAMPLE.com/page'
 * ];
 * const unique = deduplicateUrls(urls);
 * // Returns: ['https://example.com/page']
 *
 * const mixed = [
 *   'https://www.example.com/about',
 *   'https://example.com/about/',
 *   'https://example.com/contact',
 *   'https://WWW.example.com/about'
 * ];
 * const unique2 = deduplicateUrls(mixed);
 * // Returns: ['https://www.example.com/about', 'https://example.com/contact']
 * ```
 */
export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduplicated: string[] = [];

  for (const url of urls) {
    // Normalize URL for comparison
    const normalized = normalizeUrl(url);

    // Add if not seen before (preserves first occurrence)
    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduplicated.push(url); // Preserve original URL format
    }
  }

  console.log(
    `✅ Discovery Worker: Deduplicated ${urls.length} URLs to ${deduplicated.length} unique URLs`
  );

  return deduplicated;
}

/**
 * Sanitize page title to prevent XSS attacks
 *
 * Sanitizes a page title by:
 * 1. Removing HTML tags and dangerous content using DOMPurify
 * 2. Trimming whitespace
 * 3. Limiting length to 500 characters
 * 4. Returning null if empty after sanitization
 *
 * Uses isomorphic-dompurify which works in both Node.js and browser environments.
 *
 * @param title - Page title to sanitize (may be null or undefined)
 * @returns Sanitized title or null if empty
 *
 * @example
 * ```typescript
 * // XSS attack prevented
 * const safe1 = sanitizeTitle('<script>alert("xss")</script>About Us');
 * // Returns: 'About Us'
 *
 * // HTML tags removed
 * const safe2 = sanitizeTitle('<h1>Welcome</h1>');
 * // Returns: 'Welcome'
 *
 * // Whitespace trimmed
 * const safe3 = sanitizeTitle('  Contact Page  ');
 * // Returns: 'Contact Page'
 *
 * // Empty or null input
 * const safe4 = sanitizeTitle('');
 * // Returns: null
 *
 * const safe5 = sanitizeTitle(null);
 * // Returns: null
 *
 * const safe6 = sanitizeTitle(undefined);
 * // Returns: null
 *
 * // Long title truncated
 * const longTitle = 'A'.repeat(600);
 * const safe7 = sanitizeTitle(longTitle);
 * // Returns: 'A' repeated 500 times
 * ```
 */
export function sanitizeTitle(
  title: string | null | undefined
): string | null {
  // Handle null/undefined input
  if (!title) {
    return null;
  }

  // Sanitize using DOMPurify to remove HTML tags and dangerous content
  const sanitized = DOMPurify.sanitize(title, {
    ALLOWED_TAGS: [], // Remove all HTML tags
    ALLOWED_ATTR: [], // Remove all attributes
    KEEP_CONTENT: true, // Keep text content
  });

  // Trim whitespace
  const trimmed = sanitized.trim();

  // Return null if empty
  if (!trimmed) {
    return null;
  }

  // Limit length to 500 characters
  const limited = trimmed.length > 500 ? trimmed.substring(0, 500) : trimmed;

  return limited;
}

/**
 * Check if two URLs are on the same domain
 *
 * Compares two URLs to determine if they share the same domain,
 * with normalization of the www prefix (www.example.com === example.com).
 *
 * Algorithm:
 * 1. Parse both URLs
 * 2. Normalize hostnames (remove www prefix)
 * 3. Compare normalized hostnames
 * 4. Return true if same domain
 *
 * @param url1 - First URL to compare
 * @param url2 - Second URL to compare
 * @returns true if same domain, false otherwise
 *
 * @example
 * ```typescript
 * // Same domain (exact match)
 * isSameDomain('https://example.com/page1', 'https://example.com/page2');
 * // Returns: true
 *
 * // Same domain (www normalized)
 * isSameDomain('https://www.example.com/page', 'https://example.com/page');
 * // Returns: true
 *
 * isSameDomain('https://example.com/page', 'https://www.example.com/page');
 * // Returns: true
 *
 * // Different domains
 * isSameDomain('https://example.com/page', 'https://other.com/page');
 * // Returns: false
 *
 * // Subdomain is different
 * isSameDomain('https://blog.example.com/page', 'https://example.com/page');
 * // Returns: false
 *
 * // Invalid URL
 * isSameDomain('invalid-url', 'https://example.com/page');
 * // Returns: false
 * ```
 */
export function isSameDomain(url1: string, url2: string): boolean {
  try {
    // Parse URLs
    const url1Obj = new URL(url1);
    const url2Obj = new URL(url2);

    // Normalize hostnames (remove www prefix)
    let hostname1 = url1Obj.hostname.toLowerCase();
    let hostname2 = url2Obj.hostname.toLowerCase();

    if (hostname1.startsWith('www.')) {
      hostname1 = hostname1.substring(4);
    }

    if (hostname2.startsWith('www.')) {
      hostname2 = hostname2.substring(4);
    }

    // Compare normalized hostnames
    return hostname1 === hostname2;
  } catch (error) {
    // Invalid URL format
    return false;
  }
}

// ============================================================================
// ROBOTS.TXT PARSING
// ============================================================================

/**
 * robots.txt parsing result
 *
 * Structured result from parsing robots.txt content.
 */
export interface RobotsTxtResult {
  /** Paths we shouldn't crawl */
  disallowedPaths: string[];
  /** Delay between requests in seconds */
  crawlDelay: number | null;
  /** Sitemap URLs found in robots.txt */
  sitemapUrls: string[];
}

/**
 * Fetch robots.txt content with timeout
 *
 * Fetches robots.txt from a base URL with a 3 second timeout.
 * Returns content as string, or null on error/not found.
 *
 * @param baseUrl - Base URL of the website (e.g., 'https://example.com')
 * @returns robots.txt content as string, or null on error
 *
 * @example
 * ```typescript
 * const content = await fetchRobotsTxt('https://example.com');
 * if (content) {
 *   const result = parseRobotsTxt(content);
 * }
 * ```
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
  const ROBOTS_TXT_TIMEOUT = 3000; // 3 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROBOTS_TXT_TIMEOUT);

  try {
    // Construct robots.txt URL
    const robotsUrl = new URL('/robots.txt', baseUrl);

    console.log(`🔍 Discovery Worker: Fetching robots.txt from ${robotsUrl.href}`);

    const response = await fetch(robotsUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ADA-WCAG-Compliance-Bot/1.0',
      },
    });

    // Check response status
    if (!response.ok) {
      console.warn(
        `⚠️  Discovery Worker: HTTP ${response.status} for robots.txt at ${robotsUrl.href}`
      );
      return null;
    }

    const text = await response.text();

    console.log(
      `✅ Discovery Worker: Successfully fetched robots.txt from ${robotsUrl.href} (${text.length} bytes)`
    );
    return text;
  } catch (error) {
    // Handle abort errors (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(
        `⚠️  Discovery Worker: Timeout fetching robots.txt from ${baseUrl} (${ROBOTS_TXT_TIMEOUT}ms)`
      );
      return null;
    }

    // Handle network errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn(
      `⚠️  Discovery Worker: Error fetching robots.txt from ${baseUrl}:`,
      err.message
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse robots.txt content
 *
 * Parses robots.txt content and extracts:
 * - User-agent blocks (focus on * and our bot)
 * - Disallow rules
 * - Crawl-delay if present
 * - Sitemap: directives
 *
 * @param content - robots.txt content as string
 * @returns Structured parsing result
 *
 * @example
 * ```typescript
 * const content = `
 *   User-agent: *
 *   Disallow: /admin/
 *   Disallow: /private/
 *   Crawl-delay: 1
 *   Sitemap: https://example.com/sitemap.xml
 * `;
 * const result = parseRobotsTxt(content);
 * // Returns: {
 * //   disallowedPaths: ['/admin/', '/private/'],
 * //   crawlDelay: 1,
 * //   sitemapUrls: ['https://example.com/sitemap.xml']
 * // }
 * ```
 */
export function parseRobotsTxt(content: string): RobotsTxtResult {
  const result: RobotsTxtResult = {
    disallowedPaths: [],
    crawlDelay: null,
    sitemapUrls: [],
  };

  try {
    // Split content into lines
    const lines = content.split('\n');

    // Track current user-agent context
    let inRelevantUserAgent = false;
    const ourBotName = 'ADA-WCAG-Compliance-Bot';

    for (let line of lines) {
      // Trim whitespace and remove comments
      const commentIndex = line.indexOf('#');
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex);
      }
      line = line.trim();

      // Skip empty lines
      if (!line) {
        continue;
      }

      // Parse key-value pairs (case-insensitive)
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();

      // Handle User-agent directive
      if (key === 'user-agent') {
        // Check if this user-agent applies to us
        inRelevantUserAgent =
          value === '*' ||
          value.toLowerCase() === ourBotName.toLowerCase() ||
          value.toLowerCase().includes('ada-wcag');
      }
      // Handle Disallow directive (only if in relevant user-agent context)
      else if (key === 'disallow' && inRelevantUserAgent && value) {
        if (!result.disallowedPaths.includes(value)) {
          result.disallowedPaths.push(value);
        }
      }
      // Handle Crawl-delay directive (only if in relevant user-agent context)
      else if (key === 'crawl-delay' && inRelevantUserAgent && value) {
        const delay = parseFloat(value);
        if (!isNaN(delay) && delay > 0) {
          result.crawlDelay = delay;
        }
      }
      // Handle Sitemap directive (global, not user-agent specific)
      else if (key === 'sitemap' && value) {
        // Validate URL format
        try {
          const sitemapUrl = new URL(value);
          if (!result.sitemapUrls.includes(sitemapUrl.href)) {
            result.sitemapUrls.push(sitemapUrl.href);
          }
        } catch (error) {
          console.warn(
            `⚠️  Discovery Worker: Invalid sitemap URL in robots.txt: ${value}`
          );
        }
      }
    }

    console.log(
      `✅ Discovery Worker: Parsed robots.txt - ${result.disallowedPaths.length} disallowed paths, ${result.sitemapUrls.length} sitemaps, crawl-delay: ${result.crawlDelay ?? 'none'}`
    );

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Worker: Failed to parse robots.txt:',
      err.message
    );
    return result;
  }
}

// ============================================================================
// RATE LIMITING AND PATH CHECKING
// ============================================================================

/**
 * Rate limiter instance
 *
 * Limits concurrent requests to prevent overwhelming target servers.
 * Maximum 10 concurrent requests at a time.
 */
const rateLimiter = pLimit(10);

/**
 * Delay between requests in milliseconds
 *
 * Adds a small delay between requests to be respectful to servers.
 */
const REQUEST_DELAY = 100;

/**
 * Check if a URL path is allowed by robots.txt rules
 *
 * Validates whether a given path is allowed for crawling based on
 * robots.txt disallow rules. Handles wildcard patterns (*) in disallow rules.
 *
 * Algorithm:
 * 1. Normalize path (ensure leading slash)
 * 2. Check each disallowed path pattern
 * 3. Handle wildcards: convert to regex pattern
 * 4. Return false if path matches any disallow rule
 * 5. Return true if path is allowed
 *
 * Wildcard handling:
 * - `/admin/*` matches `/admin/`, `/admin/users`, `/admin/users/123`
 * - `/admin*` matches `/admin`, `/admin-panel`, `/administrator`
 * - `/*.pdf` matches `/docs/file.pdf`, `/downloads/manual.pdf`
 *
 * @param path - URL path to check (e.g., '/about', '/admin/users')
 * @param robotsRules - Parsed robots.txt result with disallowed paths
 * @returns true if path is allowed, false if disallowed
 *
 * @example
 * ```typescript
 * const rules = {
 *   disallowedPaths: ['/admin/', '/private/', '/*.pdf'],
 *   crawlDelay: null,
 *   sitemapUrls: []
 * };
 *
 * isPathAllowed('/about', rules);           // Returns: true
 * isPathAllowed('/admin/users', rules);     // Returns: false (blocked by /admin/)
 * isPathAllowed('/private/data', rules);    // Returns: false (blocked by /private/)
 * isPathAllowed('/docs/file.pdf', rules);   // Returns: false (blocked by /*.pdf)
 * isPathAllowed('/contact', rules);         // Returns: true
 * ```
 */
export function isPathAllowed(
  path: string,
  robotsRules: RobotsTxtResult
): boolean {
  // Normalize path (ensure leading slash)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Check each disallowed path pattern
  for (const disallowedPath of robotsRules.disallowedPaths) {
    // Handle empty disallow (allows everything)
    if (!disallowedPath || disallowedPath === '/') {
      continue;
    }

    // Check if disallow rule contains wildcards
    if (disallowedPath.includes('*')) {
      // Convert wildcard pattern to regex
      // Escape special regex characters except *
      const regexPattern = disallowedPath
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
        .replace(/\*/g, '.*'); // Convert * to .*

      const regex = new RegExp(`^${regexPattern}`);

      if (regex.test(normalizedPath)) {
        console.log(
          `🚫 Discovery Worker: Path ${normalizedPath} blocked by wildcard rule: ${disallowedPath}`
        );
        return false;
      }
    } else {
      // Simple prefix matching for non-wildcard rules
      if (normalizedPath.startsWith(disallowedPath)) {
        console.log(
          `🚫 Discovery Worker: Path ${normalizedPath} blocked by rule: ${disallowedPath}`
        );
        return false;
      }
    }
  }

  // Path is allowed if no disallow rules matched
  return true;
}

/**
 * Rate-limited fetch wrapper
 *
 * Wrapper around native fetch that applies:
 * 1. Concurrent request limiting (max 10 concurrent)
 * 2. Delay between requests (100ms)
 * 3. Respect for server resources
 *
 * Uses p-limit to control concurrency and adds a delay after each
 * request to prevent overwhelming target servers.
 *
 * @param url - URL to fetch
 * @param options - Fetch options (headers, method, etc.)
 * @returns Fetch response
 *
 * @example
 * ```typescript
 * // Fetch with rate limiting
 * const response = await rateLimitedFetch('https://example.com/page1', {
 *   headers: {
 *     'User-Agent': 'ADA-WCAG-Compliance-Bot/1.0'
 *   }
 * });
 *
 * if (response.ok) {
 *   const html = await response.text();
 *   // Process HTML
 * }
 * ```
 */
export async function rateLimitedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return rateLimiter(async () => {
    console.log(`🔄 Discovery Worker: Rate-limited fetch: ${url}`);

    // Perform fetch
    const response = await fetch(url, options);

    // Add delay after fetch to prevent overwhelming servers
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY));

    return response;
  });
}

// ============================================================================
// SITEMAP URL DISCOVERY
// ============================================================================

/**
 * Find potential sitemap URLs for a website
 *
 * Discovers sitemap locations by checking:
 * 1. Standard sitemap locations (/sitemap.xml, etc.)
 * 2. robots.txt for Sitemap directives (when parser is available)
 *
 * Returns an array of potential sitemap URLs to try, constructed using
 * the URL class to ensure proper URL formatting.
 *
 * @param baseUrl - Base URL of the website (e.g., 'https://example.com')
 * @returns Array of potential sitemap URLs to check
 *
 * @example
 * ```typescript
 * const sitemapUrls = await findSitemapUrls('https://example.com');
 * // Returns: ['https://example.com/sitemap.xml', 'https://example.com/sitemap_index.xml', ...]
 * ```
 */
export async function findSitemapUrls(baseUrl: string): Promise<string[]> {
  const sitemapUrls: string[] = [];

  try {
    // Validate and normalize base URL
    const base = new URL(baseUrl);

    // Add standard sitemap locations
    for (const path of STANDARD_SITEMAP_PATHS) {
      try {
        const sitemapUrl = new URL(path, base.origin);
        sitemapUrls.push(sitemapUrl.href);
      } catch (error) {
        // Skip invalid URLs
        console.warn(
          `⚠️  Discovery Worker: Invalid sitemap URL constructed from ${baseUrl}${path}`
        );
      }
    }

    // Check robots.txt for Sitemap directives
    const robotsTxtContent = await fetchRobotsTxt(base.origin);
    if (robotsTxtContent) {
      const robotsResult = parseRobotsTxt(robotsTxtContent);
      // Add sitemaps from robots.txt (avoiding duplicates)
      for (const sitemapUrl of robotsResult.sitemapUrls) {
        if (!sitemapUrls.includes(sitemapUrl)) {
          sitemapUrls.push(sitemapUrl);
        }
      }
    }

    return sitemapUrls;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Discovery Worker: Failed to construct sitemap URLs for ${baseUrl}:`,
      err.message
    );
    // Return empty array on error to allow discovery to continue
    return [];
  }
}

// ============================================================================
// SITEMAP FETCHING
// ============================================================================

/**
 * Fetch sitemap XML content with timeout and security protections
 *
 * Fetches a sitemap URL with the following security measures:
 * - Timeout protection using AbortController (10s from TIMEOUT_HIERARCHY)
 * - Response size limit (5MB) to prevent memory exhaustion
 * - Redirect chain validation (max 5 redirects)
 * - Same-domain validation for redirects (SSRF protection)
 * - User-Agent identification
 *
 * @param url - Sitemap URL to fetch
 * @returns XML content as string, or null on timeout/error
 *
 * @example
 * ```typescript
 * const xml = await fetchSitemap('https://example.com/sitemap.xml');
 * if (xml) {
 *   // Parse and process sitemap XML
 * } else {
 *   console.log('Failed to fetch sitemap');
 * }
 * ```
 */
export async function fetchSitemap(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    TIMEOUT_HIERARCHY.sitemap
  );

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_REDIRECTS = 5;

  try {
    // Parse initial URL to get origin for SSRF validation
    const initialUrl = new URL(url);
    const allowedOrigin = initialUrl.origin;

    console.log(`🔍 Discovery Worker: Fetching sitemap from ${url}`);

    // Fetch with manual redirect handling for SSRF protection
    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount <= MAX_REDIRECTS) {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual', // Handle redirects manually for SSRF validation
        headers: {
          'User-Agent': 'ADA-WCAG-Compliance-Bot/1.0',
          Accept: 'application/xml, text/xml, */*',
        },
      });

      // Handle redirects
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        redirectCount++;

        if (redirectCount > MAX_REDIRECTS) {
          console.warn(
            `⚠️  Discovery Worker: Too many redirects (>${MAX_REDIRECTS}) for ${url}`
          );
          return null;
        }

        // Validate redirect stays on same domain (SSRF protection)
        const location = response.headers.get('location');
        if (!location) {
          console.warn(
            `⚠️  Discovery Worker: Empty redirect location for ${url}`
          );
          return null;
        }

        // Resolve relative URLs
        const redirectUrl = new URL(location, currentUrl);

        // Validate same origin
        if (redirectUrl.origin !== allowedOrigin) {
          console.warn(
            `⚠️  Discovery Worker: Redirect to different origin blocked (SSRF protection): ${redirectUrl.origin} !== ${allowedOrigin}`
          );
          return null;
        }

        console.log(
          `🔄 Discovery Worker: Following redirect ${redirectCount}/${MAX_REDIRECTS}: ${redirectUrl.href}`
        );
        currentUrl = redirectUrl.href;
        continue;
      }

      // Check response status
      if (!response.ok) {
        console.warn(
          `⚠️  Discovery Worker: HTTP ${response.status} for ${url}`
        );
        return null;
      }

      // Check content length before reading
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
        console.warn(
          `⚠️  Discovery Worker: Sitemap too large (${contentLength} bytes > ${MAX_SIZE} bytes) for ${url}`
        );
        return null;
      }

      // Read response text
      const text = await response.text();

      // Validate size after reading (in case content-length was missing)
      if (text.length > MAX_SIZE) {
        console.warn(
          `⚠️  Discovery Worker: Sitemap content too large (${text.length} bytes > ${MAX_SIZE} bytes) for ${url}`
        );
        return null;
      }

      console.log(
        `✅ Discovery Worker: Successfully fetched sitemap from ${currentUrl} (${text.length} bytes)`
      );
      return text;
    }

    // Should not reach here, but handle just in case
    console.warn(
      `⚠️  Discovery Worker: Unexpected redirect loop for ${url}`
    );
    return null;
  } catch (error) {
    // Handle abort errors (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(
        `⚠️  Discovery Worker: Timeout fetching sitemap from ${url} (${TIMEOUT_HIERARCHY.sitemap}ms)`
      );
      return null;
    }

    // Handle network errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn(
      `⚠️  Discovery Worker: Error fetching sitemap from ${url}:`,
      err.message
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// HOMEPAGE FETCHING
// ============================================================================

/**
 * Fetch homepage HTML content with timeout and security protections
 *
 * Fetches a homepage URL for navigation extraction with the following security measures:
 * - Timeout protection using AbortController (5s from TIMEOUT_HIERARCHY)
 * - Response size limit (5MB) to prevent memory exhaustion
 * - Redirect chain validation (max 5 redirects)
 * - Same-domain validation for redirects (SSRF protection)
 * - User-Agent identification
 *
 * Similar to fetchSitemap but optimized for HTML pages:
 * - Shorter timeout (5s instead of 10s)
 * - Different Accept header (text/html instead of application/xml)
 * - Still validates SSRF on redirects
 *
 * @param url - Homepage URL to fetch
 * @returns HTML content as string, or null on timeout/error
 *
 * @example
 * ```typescript
 * const html = await fetchHomepage('https://example.com');
 * if (html) {
 *   // Parse and extract navigation links
 * } else {
 *   console.log('Failed to fetch homepage');
 * }
 * ```
 */
export async function fetchHomepage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    TIMEOUT_HIERARCHY.navigation
  );

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_REDIRECTS = 5;

  try {
    // Parse initial URL to get origin for SSRF validation
    const initialUrl = new URL(url);
    const allowedOrigin = initialUrl.origin;

    console.log(`🔍 Discovery Worker: Fetching homepage from ${url}`);

    // Fetch with manual redirect handling for SSRF protection
    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount <= MAX_REDIRECTS) {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual', // Handle redirects manually for SSRF validation
        headers: {
          'User-Agent': 'ADA-WCAG-Compliance-Bot/1.0',
          Accept: 'text/html',
        },
      });

      // Handle redirects
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        redirectCount++;

        if (redirectCount > MAX_REDIRECTS) {
          console.warn(
            `⚠️  Discovery Worker: Too many redirects (>${MAX_REDIRECTS}) for ${url}`
          );
          return null;
        }

        // Validate redirect stays on same domain (SSRF protection)
        const location = response.headers.get('location');
        if (!location) {
          console.warn(
            `⚠️  Discovery Worker: Empty redirect location for ${url}`
          );
          return null;
        }

        // Resolve relative URLs
        const redirectUrl = new URL(location, currentUrl);

        // Validate same origin
        if (redirectUrl.origin !== allowedOrigin) {
          console.warn(
            `⚠️  Discovery Worker: Redirect to different origin blocked (SSRF protection): ${redirectUrl.origin} !== ${allowedOrigin}`
          );
          return null;
        }

        console.log(
          `🔄 Discovery Worker: Following redirect ${redirectCount}/${MAX_REDIRECTS}: ${redirectUrl.href}`
        );
        currentUrl = redirectUrl.href;
        continue;
      }

      // Check response status
      if (!response.ok) {
        console.warn(
          `⚠️  Discovery Worker: HTTP ${response.status} for ${url}`
        );
        return null;
      }

      // Check content length before reading
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
        console.warn(
          `⚠️  Discovery Worker: Homepage too large (${contentLength} bytes > ${MAX_SIZE} bytes) for ${url}`
        );
        return null;
      }

      // Read response text
      const text = await response.text();

      // Validate size after reading (in case content-length was missing)
      if (text.length > MAX_SIZE) {
        console.warn(
          `⚠️  Discovery Worker: Homepage content too large (${text.length} bytes > ${MAX_SIZE} bytes) for ${url}`
        );
        return null;
      }

      console.log(
        `✅ Discovery Worker: Successfully fetched homepage from ${currentUrl} (${text.length} bytes)`
      );
      return text;
    }

    // Should not reach here, but handle just in case
    console.warn(
      `⚠️  Discovery Worker: Unexpected redirect loop for ${url}`
    );
    return null;
  } catch (error) {
    // Handle abort errors (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(
        `⚠️  Discovery Worker: Timeout fetching homepage from ${url} (${TIMEOUT_HIERARCHY.navigation}ms)`
      );
      return null;
    }

    // Handle network errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn(
      `⚠️  Discovery Worker: Error fetching homepage from ${url}:`,
      err.message
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// NAVIGATION EXTRACTION
// ============================================================================

/**
 * Navigation link interface
 *
 * Represents a navigation link extracted from HTML.
 */
export interface NavigationLink {
  /** Link URL (absolute) */
  url: string;
  /** Link text content */
  text: string;
}

/**
 * Extract navigation links from HTML with selector priority
 *
 * Extracts navigation links from HTML using a prioritized selector strategy:
 * 1. `nav a` - Links within nav element (highest priority)
 * 2. `[role="navigation"] a` - Links within ARIA navigation
 * 3. `header nav a` - Links in header navigation
 * 4. `.nav a, .menu a, .navigation a` - Common CSS class patterns
 *
 * Features:
 * - Resolves relative URLs to absolute using homepageUrl as base
 * - Filters to internal links only (same domain)
 * - Deduplicates by normalized URL
 * - Preserves first occurrence's text when deduplicating
 *
 * @param html - HTML content to parse
 * @param homepageUrl - Homepage URL for resolving relative URLs and domain filtering
 * @returns Array of navigation links with absolute URLs and text
 *
 * @example
 * ```typescript
 * const html = '<nav><a href="/about">About</a><a href="/contact">Contact</a></nav>';
 * const links = extractNavigation(html, 'https://example.com');
 * // Returns: [
 * //   { url: 'https://example.com/about', text: 'About' },
 * //   { url: 'https://example.com/contact', text: 'Contact' }
 * // ]
 * ```
 */
export function extractNavigation(
  html: string,
  homepageUrl: string
): NavigationLink[] {
  try {
    // Parse homepage URL for base and domain filtering
    const homepageUrlObj = new URL(homepageUrl);
    const allowedOrigin = homepageUrlObj.origin;

    // Load HTML with cheerio
    const $ = cheerio.load(html);

    // Define selector priority order
    const selectors = [
      'nav a', // Links within nav element
      '[role="navigation"] a', // Links within ARIA navigation
      'header nav a', // Links in header navigation
      '.nav a, .menu a, .navigation a', // Common CSS class patterns
    ];

    // Collect links with priority
    const linkMap = new Map<string, NavigationLink>();

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');

        // Skip links without href
        if (!href) {
          return;
        }

        try {
          // Resolve relative URLs to absolute
          const absoluteUrl = new URL(href, homepageUrl);

          // Filter to same domain only (internal URLs)
          if (absoluteUrl.origin !== allowedOrigin) {
            return;
          }

          // Normalize URL (remove hash)
          const normalizedUrl = new URL(absoluteUrl.href);
          normalizedUrl.hash = '';

          const urlKey = normalizedUrl.href;

          // Add to map if not already present (preserves priority)
          if (!linkMap.has(urlKey)) {
            linkMap.set(urlKey, {
              url: urlKey,
              text: $link.text().trim(),
            });
          }
        } catch (error) {
          // Skip invalid URLs
          console.warn(
            `⚠️  Discovery Worker: Invalid navigation URL: ${href}`
          );
        }
      });
    }

    // Convert map to array
    const links = Array.from(linkMap.values());

    console.log(
      `✅ Discovery Worker: Extracted ${links.length} navigation links from ${homepageUrl}`
    );

    return links;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Discovery Worker: Failed to extract navigation from ${homepageUrl}:`,
      err.message
    );
    return [];
  }
}

// ============================================================================
// SITEMAP XML PARSING
// ============================================================================

/**
 * Sitemap entry interface
 *
 * Represents a single URL entry in a sitemap.
 */
export interface SitemapEntry {
  /** Page URL */
  url: string;
  /** Last modification date (optional) */
  lastmod?: string;
  /** Change frequency (optional) */
  changefreq?: string;
  /** Priority (optional) */
  priority?: string;
}

/**
 * Parse sitemap XML to extract page URLs
 *
 * Parses sitemap XML in both standard and sitemap index formats:
 * - Standard sitemap: `<urlset><url><loc>...</loc></url></urlset>`
 * - Sitemap index: `<sitemapindex><sitemap><loc>...</loc></sitemap></sitemapindex>`
 *
 * For sitemap index format, recursively fetches and parses nested sitemaps
 * with a maximum depth of 2 to prevent infinite recursion.
 *
 * Filters results to include only internal URLs (same domain as homepageUrl)
 * to prevent crawling external sites.
 *
 * @param xml - Sitemap XML content
 * @param homepageUrl - Homepage URL for domain filtering
 * @returns Array of sitemap entries with URL and metadata
 *
 * @example
 * ```typescript
 * const xml = `
 *   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 *     <url>
 *       <loc>https://example.com/page1</loc>
 *       <lastmod>2024-01-01</lastmod>
 *     </url>
 *   </urlset>
 * `;
 * const entries = await parseSitemap(xml, 'https://example.com');
 * // Returns: [{ url: 'https://example.com/page1', lastmod: '2024-01-01' }]
 * ```
 */
export async function parseSitemap(
  xml: string,
  homepageUrl: string,
  depth: number = 0
): Promise<SitemapEntry[]> {
  const MAX_DEPTH = 2;

  // Prevent infinite recursion
  if (depth > MAX_DEPTH) {
    console.warn(
      `⚠️  Discovery Worker: Maximum sitemap depth (${MAX_DEPTH}) reached, stopping recursion`
    );
    return [];
  }

  try {
    // Parse homepage URL for domain filtering
    const homepageUrlObj = new URL(homepageUrl);
    const allowedOrigin = homepageUrlObj.origin;

    // Configure XML parser
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    // Parse XML
    const result = parser.parse(xml);

    // Check if this is a sitemap index
    if (result.sitemapindex) {
      console.log(
        `🔍 Discovery Worker: Parsing sitemap index (depth: ${depth})`
      );
      return await parseSitemapIndex(result.sitemapindex, allowedOrigin, depth);
    }

    // Check if this is a standard sitemap
    if (result.urlset) {
      console.log(
        `🔍 Discovery Worker: Parsing standard sitemap (depth: ${depth})`
      );
      return parseSitemapUrlset(result.urlset, allowedOrigin);
    }

    // Unknown sitemap format
    console.warn(
      '⚠️  Discovery Worker: Unknown sitemap format (no urlset or sitemapindex)'
    );
    return [];
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Worker: Failed to parse sitemap XML:',
      err.message
    );
    return [];
  }
}

/**
 * Parse sitemap index and recursively fetch nested sitemaps
 *
 * @param sitemapindex - Parsed sitemap index object
 * @param allowedOrigin - Allowed origin for domain filtering
 * @param depth - Current recursion depth
 * @returns Array of sitemap entries from all nested sitemaps
 */
async function parseSitemapIndex(
  sitemapindex: any,
  allowedOrigin: string,
  depth: number
): Promise<SitemapEntry[]> {
  const allEntries: SitemapEntry[] = [];

  // Handle both single sitemap and array of sitemaps
  const sitemaps = Array.isArray(sitemapindex.sitemap)
    ? sitemapindex.sitemap
    : [sitemapindex.sitemap];

  // Fetch and parse each nested sitemap
  for (const sitemap of sitemaps) {
    if (!sitemap?.loc) {
      continue;
    }

    const sitemapUrl = sitemap.loc;

    // Validate same origin (SSRF protection)
    try {
      const sitemapUrlObj = new URL(sitemapUrl);
      if (sitemapUrlObj.origin !== allowedOrigin) {
        console.warn(
          `⚠️  Discovery Worker: Skipping external sitemap (SSRF protection): ${sitemapUrl}`
        );
        continue;
      }
    } catch (error) {
      console.warn(
        `⚠️  Discovery Worker: Invalid sitemap URL in sitemap index: ${sitemapUrl}`
      );
      continue;
    }

    // Fetch nested sitemap
    console.log(
      `🔍 Discovery Worker: Fetching nested sitemap (depth ${depth + 1}): ${sitemapUrl}`
    );
    const nestedXml = await fetchSitemap(sitemapUrl);

    if (!nestedXml) {
      console.warn(
        `⚠️  Discovery Worker: Failed to fetch nested sitemap: ${sitemapUrl}`
      );
      continue;
    }

    // Recursively parse nested sitemap
    const nestedEntries = await parseSitemap(
      nestedXml,
      allowedOrigin,
      depth + 1
    );
    allEntries.push(...nestedEntries);
  }

  console.log(
    `✅ Discovery Worker: Parsed sitemap index with ${allEntries.length} total entries`
  );
  return allEntries;
}

/**
 * Parse standard sitemap urlset
 *
 * @param urlset - Parsed urlset object
 * @param allowedOrigin - Allowed origin for domain filtering
 * @returns Array of sitemap entries
 */
function parseSitemapUrlset(
  urlset: any,
  allowedOrigin: string
): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  // Handle both single url and array of urls
  const urls = Array.isArray(urlset.url) ? urlset.url : [urlset.url];

  for (const urlEntry of urls) {
    if (!urlEntry?.loc) {
      continue;
    }

    const url = urlEntry.loc;

    // Validate URL format
    try {
      const urlObj = new URL(url);

      // Filter to same domain only (internal URLs)
      if (urlObj.origin !== allowedOrigin) {
        continue;
      }

      // Extract metadata
      const entry: SitemapEntry = {
        url: urlObj.href,
      };

      if (urlEntry.lastmod) {
        entry.lastmod = urlEntry.lastmod;
      }

      if (urlEntry.changefreq) {
        entry.changefreq = urlEntry.changefreq;
      }

      if (urlEntry.priority) {
        entry.priority = urlEntry.priority;
      }

      entries.push(entry);
    } catch (error) {
      console.warn(
        `⚠️  Discovery Worker: Invalid URL in sitemap: ${url}`
      );
      continue;
    }
  }

  console.log(
    `✅ Discovery Worker: Parsed urlset with ${entries.length} entries`
  );
  return entries;
}

// ============================================================================
// JOB DATA TYPES
// ============================================================================

/**
 * Discovery job data
 *
 * Data passed to the worker for each discovery job.
 */
export interface DiscoveryJobData {
  /** Discovery ID to process */
  discoveryId: string;
  /** Homepage URL to discover */
  homepageUrl: string;
  /** Discovery mode (AUTO or MANUAL) */
  mode: 'AUTO' | 'MANUAL';
  /** Session ID for guest tracking */
  sessionId?: string;
  /** Maximum pages to discover */
  maxPages: number;
  /** Maximum crawl depth */
  maxDepth: number;
}

/**
 * Discovery job result
 *
 * Result returned after successful job completion.
 */
export interface DiscoveryJobResult {
  /** Discovery ID that was processed */
  discoveryId: string;
  /** Final status after processing */
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  /** Total pages discovered */
  pageCount: number;
  /** Whether discovery returned partial results */
  partialResults: boolean;
  /** Error message if failed */
  errorMessage?: string;
}

// ============================================================================
// QUEUE INSTANCE
// ============================================================================

/**
 * Discovery queue instance
 *
 * Used by the service layer to add new discovery jobs.
 */
export const discoveryQueue = new Queue<DiscoveryJobData, DiscoveryJobResult>(
  QUEUE_NAME,
  {
    connection: getBullMQConnection(),
    defaultJobOptions: DISCOVERY_JOB_OPTIONS,
  }
);

// ============================================================================
// MAIN JOB HANDLER
// ============================================================================

/**
 * Process discovery job
 *
 * Main job handler that orchestrates the discovery process:
 * 1. Validate discovery exists and is not cancelled
 * 2. Update status to RUNNING
 * 3. Execute sitemap phase - fetch/parse sitemaps, validate URLs
 * 4. Execute navigation phase - extract nav links, validate URLs
 * 5. Merge and deduplicate results from both phases
 * 6. Apply maxPages limit
 * 7. Save pages and complete discovery
 * 8. Handle errors with partial results when possible
 *
 * @param job - BullMQ job instance
 * @returns Discovery job result
 * @throws DiscoveryWorkerError for processing failures
 *
 * @example
 * ```typescript
 * // Job is automatically processed by the worker
 * // This function is called by BullMQ when a job is ready
 * ```
 */
export async function processDiscoveryJob(
  job: Job<DiscoveryJobData, DiscoveryJobResult>
): Promise<DiscoveryJobResult> {
  const { discoveryId, homepageUrl, mode, maxPages, maxDepth } = job.data;

  console.log(
    `🔄 Discovery Worker: Processing discovery job ${discoveryId} for ${homepageUrl}`
  );

  // Track all discovered pages for partial results
  let allDiscoveredPages: DiscoveredPageData[] = [];
  let isPartialResults = false;

  try {
    // Validate discovery exists
    const discovery = await findById(discoveryId);

    if (!discovery) {
      throw new DiscoveryWorkerError(
        `Discovery not found: ${discoveryId}`,
        DiscoveryErrorCode.DISCOVERY_NOT_FOUND
      );
    }

    // Check if discovery was cancelled
    if (discovery.status === 'CANCELLED') {
      console.log(
        `⚠️  Discovery Worker: Discovery ${discoveryId} was cancelled`
      );
      return {
        discoveryId,
        status: 'CANCELLED',
        pageCount: 0,
        partialResults: false,
      };
    }

    // Update status to RUNNING
    await updateStatus(discoveryId, 'RUNNING');
    console.log(`✅ Discovery Worker: Updated status to RUNNING for ${discoveryId}`);

    // Phase 1: Sitemap discovery
    let sitemapResult: PhaseResult;
    try {
      sitemapResult = await executeSitemapPhase(discoveryId, homepageUrl);
      allDiscoveredPages.push(...sitemapResult.pages);
      console.log(
        `✅ Discovery Worker: Sitemap phase found ${sitemapResult.pages.length} pages`
      );
    } catch (sitemapError) {
      // Log sitemap error but continue with navigation phase
      const err = sitemapError instanceof Error ? sitemapError : new Error(String(sitemapError));
      console.warn(
        `⚠️  Discovery Worker: Sitemap phase failed, continuing with navigation: ${err.message}`
      );
      isPartialResults = true;
      sitemapResult = { pages: [], robotsRules: undefined };
    }

    // Phase 2: Navigation discovery (pass robots rules from sitemap phase)
    try {
      const navigationPages = await executeNavigationPhase(
        discoveryId,
        homepageUrl,
        sitemapResult.robotsRules
      );
      allDiscoveredPages.push(...navigationPages);
      console.log(
        `✅ Discovery Worker: Navigation phase found ${navigationPages.length} pages`
      );
    } catch (navError) {
      // Log navigation error but continue with results we have
      const err = navError instanceof Error ? navError : new Error(String(navError));
      console.warn(
        `⚠️  Discovery Worker: Navigation phase failed: ${err.message}`
      );
      isPartialResults = true;
    }

    // If no pages found at all, add homepage as fallback
    if (allDiscoveredPages.length === 0) {
      console.warn(
        `⚠️  Discovery Worker: No pages discovered for ${discoveryId}, adding homepage as fallback`
      );
      // Add the homepage as a fallback - every website has at least the homepage
      allDiscoveredPages.push({
        url: homepageUrl,
        title: 'Homepage',
        source: 'NAVIGATION' as const,
        depth: 0,
      });
    }

    // Merge and deduplicate pages from both phases
    // Prioritize sitemap entries over navigation (they have more metadata)
    const urlToPage = new Map<string, DiscoveredPageData>();
    for (const page of allDiscoveredPages) {
      const normalizedUrl = normalizeUrl(page.url);
      // Only add if not seen, or if current is from sitemap (higher priority)
      const existing = urlToPage.get(normalizedUrl);
      if (!existing || (existing.source === 'NAVIGATION' && page.source === 'SITEMAP')) {
        urlToPage.set(normalizedUrl, page);
      }
    }
    let uniquePages = Array.from(urlToPage.values());

    console.log(
      `✅ Discovery Worker: Merged ${allDiscoveredPages.length} pages to ${uniquePages.length} unique pages`
    );

    // Apply maxPages limit
    if (uniquePages.length > maxPages) {
      console.log(
        `⚠️  Discovery Worker: Limiting ${uniquePages.length} pages to maxPages=${maxPages}`
      );
      // Prioritize: homepage first, then sitemap, then navigation
      uniquePages.sort((a, b) => {
        // Homepage (depth 0) first
        if (a.depth !== b.depth) return a.depth - b.depth;
        // Sitemap before navigation
        if (a.source === 'SITEMAP' && b.source !== 'SITEMAP') return -1;
        if (a.source !== 'SITEMAP' && b.source === 'SITEMAP') return 1;
        return 0;
      });
      uniquePages = uniquePages.slice(0, maxPages);
    }

    // Complete discovery with discovered pages
    await completeDiscovery(discoveryId, uniquePages);

    console.log(
      `✅ Discovery Worker: Completed discovery ${discoveryId} successfully with ${uniquePages.length} pages`
    );

    return {
      discoveryId,
      status: 'COMPLETED',
      pageCount: uniquePages.length,
      partialResults: isPartialResults,
    };
  } catch (error) {
    // Handle errors and update status to FAILED
    const err = error instanceof Error ? error : new Error(String(error));

    console.error(
      `❌ Discovery Worker: Failed to process discovery ${discoveryId}:`,
      err.message
    );

    // Check if this is the last retry attempt
    const attemptNumber = job.attemptsMade;
    const maxAttempts = DISCOVERY_JOB_OPTIONS.attempts || 3;
    const isLastAttempt = attemptNumber >= maxAttempts;

    console.log(
      `🔄 Discovery Worker: Retry attempt ${attemptNumber}/${maxAttempts} for ${discoveryId}`
    );

    if (isLastAttempt) {
      // Last attempt failed - check if we have partial results
      if (allDiscoveredPages.length > 0) {
        console.warn(
          `⚠️  Discovery Worker: Saving ${allDiscoveredPages.length} partial results for ${discoveryId}`
        );
        try {
          await handlePartialResults(discoveryId, allDiscoveredPages, err);
          return {
            discoveryId,
            status: 'COMPLETED',
            pageCount: allDiscoveredPages.length,
            partialResults: true,
          };
        } catch (partialError) {
          console.error(
            `❌ Discovery Worker: Failed to save partial results:`,
            partialError
          );
        }
      }

      // No partial results or failed to save them - mark as FAILED
      console.error(
        `❌ Discovery Worker: All retry attempts exhausted for ${discoveryId}`
      );
      await failDiscovery(discoveryId, err);

      return {
        discoveryId,
        status: 'FAILED',
        pageCount: 0,
        partialResults: false,
        errorMessage: err.message,
      };
    } else {
      // Not the last attempt - log retry info
      const backoffDelay =
        (DISCOVERY_JOB_OPTIONS.backoff as { type: string; delay: number })
          ?.delay || 1000;
      const nextDelay = backoffDelay * Math.pow(2, attemptNumber);
      console.log(
        `⏳ Discovery Worker: Will retry ${discoveryId} in ${nextDelay}ms`
      );
    }

    // Re-throw error to mark job as failed in BullMQ
    // BullMQ will handle the retry logic based on DISCOVERY_JOB_OPTIONS
    if (error instanceof DiscoveryWorkerError) {
      throw error;
    }

    const errorCode =
      error instanceof DiscoveryWorkerError
        ? error.code
        : DiscoveryErrorCode.UPDATE_FAILED;

    throw new DiscoveryWorkerError(err.message, errorCode, {
      cause: err,
    });
  }
}

// ============================================================================
// PHASE HANDLERS (PLACEHOLDERS)
// ============================================================================

/**
 * Discovered page data for storage
 */
export interface DiscoveredPageData {
  url: string;
  title?: string;
  source: PageSource;
  depth: number;
}

/**
 * Phase execution result
 */
export interface PhaseResult {
  pages: DiscoveredPageData[];
  robotsRules?: RobotsTxtResult;
}

/**
 * Execute sitemap discovery phase
 *
 * Fetches and parses sitemap.xml to discover URLs.
 * Uses robots.txt to find sitemap locations and validate crawling rules.
 *
 * Algorithm:
 * 1. Fetch robots.txt and extract sitemap URLs
 * 2. Find all potential sitemap locations
 * 3. Fetch and parse each sitemap
 * 4. Filter URLs to same domain
 * 5. Validate URLs against robots.txt disallow rules
 * 6. Deduplicate and sanitize results
 *
 * @param discoveryId - Discovery ID
 * @param homepageUrl - Homepage URL
 * @returns Phase result with discovered pages and robots rules
 * @throws DiscoveryWorkerError if sitemap fetch fails critically
 *
 * @example
 * ```typescript
 * const result = await executeSitemapPhase('discovery-123', 'https://example.com');
 * console.log(`Found ${result.pages.length} pages from sitemap`);
 * ```
 */
async function executeSitemapPhase(
  discoveryId: string,
  homepageUrl: string
): Promise<PhaseResult> {
  console.log(
    `🔍 Discovery Worker: Starting sitemap phase for ${discoveryId}`
  );

  const discoveredPages: DiscoveredPageData[] = [];
  let robotsRules: RobotsTxtResult | undefined;

  try {
    // Step 1: Fetch and parse robots.txt
    const robotsTxtContent = await fetchRobotsTxt(homepageUrl);
    if (robotsTxtContent) {
      robotsRules = parseRobotsTxt(robotsTxtContent);
      console.log(
        `✅ Discovery Worker: Found robots.txt with ${robotsRules.sitemapUrls.length} sitemap URLs`
      );
    }

    // Step 2: Find all potential sitemap URLs
    const sitemapUrls = await findSitemapUrls(homepageUrl);
    console.log(
      `🔍 Discovery Worker: Checking ${sitemapUrls.length} potential sitemap locations`
    );

    if (sitemapUrls.length === 0) {
      console.warn(
        `⚠️  Discovery Worker: No sitemap URLs found for ${homepageUrl}`
      );
      return { pages: [], robotsRules };
    }

    // Step 3: Fetch and parse each sitemap
    const allSitemapEntries: SitemapEntry[] = [];

    for (const sitemapUrl of sitemapUrls) {
      // Use rate-limited fetch for respectful crawling
      console.log(`🔍 Discovery Worker: Fetching sitemap: ${sitemapUrl}`);

      const xml = await fetchSitemap(sitemapUrl);

      if (!xml) {
        console.warn(
          `⚠️  Discovery Worker: Failed to fetch sitemap: ${sitemapUrl}`
        );
        continue;
      }

      // Parse sitemap XML
      const entries = await parseSitemap(xml, homepageUrl);
      console.log(
        `✅ Discovery Worker: Parsed ${entries.length} entries from ${sitemapUrl}`
      );

      allSitemapEntries.push(...entries);
    }

    console.log(
      `✅ Discovery Worker: Found ${allSitemapEntries.length} total sitemap entries`
    );

    // Step 4: Filter and validate URLs
    const homepageUrlObj = new URL(homepageUrl);

    for (const entry of allSitemapEntries) {
      try {
        // Validate URL format and same domain
        const urlValidation = validateUrl(entry.url, homepageUrl);
        if (!urlValidation.valid) {
          console.warn(
            `⚠️  Discovery Worker: Skipping invalid URL ${entry.url}: ${urlValidation.error}`
          );
          continue;
        }

        // Check robots.txt disallow rules
        const urlObj = new URL(entry.url);
        if (robotsRules && !isPathAllowed(urlObj.pathname, robotsRules)) {
          console.warn(
            `⚠️  Discovery Worker: Skipping disallowed URL ${entry.url}`
          );
          continue;
        }

        // Add to discovered pages
        discoveredPages.push({
          url: entry.url,
          source: 'SITEMAP' as PageSource,
          depth: 0, // Sitemap entries are at depth 0
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `⚠️  Discovery Worker: Error processing sitemap entry ${entry.url}: ${err.message}`
        );
      }
    }

    // Step 5: Deduplicate URLs
    const uniqueUrls = deduplicateUrls(discoveredPages.map((p) => p.url));
    const uniquePages = uniqueUrls.map((url) => ({
      url,
      source: 'SITEMAP' as PageSource,
      depth: 0,
    }));

    console.log(
      `✅ Discovery Worker: Completed sitemap phase for ${discoveryId} with ${uniquePages.length} unique pages`
    );

    return { pages: uniquePages, robotsRules };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Discovery Worker: Sitemap phase failed for ${discoveryId}:`,
      err.message
    );

    // Return partial results if we have any
    if (discoveredPages.length > 0) {
      console.warn(
        `⚠️  Discovery Worker: Returning ${discoveredPages.length} partial sitemap results`
      );
      return { pages: discoveredPages, robotsRules };
    }

    throw new DiscoveryWorkerError(
      `Sitemap fetch failed: ${err.message}`,
      DiscoveryErrorCode.SITEMAP_FETCH_FAILED,
      { cause: err }
    );
  }
}

/**
 * Execute navigation discovery phase
 *
 * Extracts navigation links from homepage to discover URLs.
 * Uses prioritized CSS selectors to find navigation elements.
 *
 * Algorithm:
 * 1. Fetch homepage HTML with timeout
 * 2. Extract navigation links using selector priority
 * 3. Filter to same-domain links
 * 4. Validate URLs against robots.txt disallow rules
 * 5. Sanitize titles and deduplicate URLs
 *
 * @param discoveryId - Discovery ID
 * @param homepageUrl - Homepage URL
 * @param robotsRules - Optional robots.txt rules from sitemap phase
 * @returns Array of discovered pages
 * @throws DiscoveryWorkerError if navigation extraction fails critically
 *
 * @example
 * ```typescript
 * const pages = await executeNavigationPhase('discovery-123', 'https://example.com');
 * console.log(`Found ${pages.length} pages from navigation`);
 * ```
 */
async function executeNavigationPhase(
  discoveryId: string,
  homepageUrl: string,
  robotsRules?: RobotsTxtResult
): Promise<DiscoveredPageData[]> {
  console.log(
    `🔍 Discovery Worker: Starting navigation phase for ${discoveryId}`
  );

  const discoveredPages: DiscoveredPageData[] = [];

  try {
    // Step 1: Fetch homepage HTML
    const html = await fetchHomepage(homepageUrl);

    if (!html) {
      console.warn(
        `⚠️  Discovery Worker: Failed to fetch homepage for navigation: ${homepageUrl}`
      );
      return [];
    }

    // Step 2: Extract navigation links
    const navigationLinks = extractNavigation(html, homepageUrl);
    console.log(
      `✅ Discovery Worker: Extracted ${navigationLinks.length} navigation links`
    );

    if (navigationLinks.length === 0) {
      console.warn(
        `⚠️  Discovery Worker: No navigation links found on ${homepageUrl}`
      );
      return [];
    }

    // Step 3: Validate and filter URLs
    for (const link of navigationLinks) {
      try {
        // Validate URL format and same domain
        const urlValidation = validateUrl(link.url, homepageUrl);
        if (!urlValidation.valid) {
          console.warn(
            `⚠️  Discovery Worker: Skipping invalid navigation URL ${link.url}: ${urlValidation.error}`
          );
          continue;
        }

        // Check robots.txt disallow rules
        const urlObj = new URL(link.url);
        if (robotsRules && !isPathAllowed(urlObj.pathname, robotsRules)) {
          console.warn(
            `⚠️  Discovery Worker: Skipping disallowed navigation URL ${link.url}`
          );
          continue;
        }

        // Sanitize title (XSS prevention)
        const sanitizedTitle = sanitizeTitle(link.text);

        // Add to discovered pages
        discoveredPages.push({
          url: link.url,
          title: sanitizedTitle ?? undefined,
          source: 'NAVIGATION' as PageSource,
          depth: 1, // Navigation links are at depth 1 from homepage
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `⚠️  Discovery Worker: Error processing navigation link ${link.url}: ${err.message}`
        );
      }
    }

    // Step 4: Deduplicate URLs
    const urlToPage = new Map<string, DiscoveredPageData>();
    for (const page of discoveredPages) {
      const normalizedUrl = normalizeUrl(page.url);
      if (!urlToPage.has(normalizedUrl)) {
        urlToPage.set(normalizedUrl, page);
      }
    }
    const uniquePages = Array.from(urlToPage.values());

    console.log(
      `✅ Discovery Worker: Completed navigation phase for ${discoveryId} with ${uniquePages.length} unique pages`
    );

    return uniquePages;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Discovery Worker: Navigation phase failed for ${discoveryId}:`,
      err.message
    );

    // Return partial results if we have any
    if (discoveredPages.length > 0) {
      console.warn(
        `⚠️  Discovery Worker: Returning ${discoveredPages.length} partial navigation results`
      );
      return discoveredPages;
    }

    throw new DiscoveryWorkerError(
      `Navigation extraction failed: ${err.message}`,
      DiscoveryErrorCode.NAVIGATION_EXTRACTION_FAILED,
      { cause: err }
    );
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Fail discovery with error details
 *
 * Updates discovery status to FAILED, stores error message and code,
 * logs failure details, and clears any cached data.
 *
 * @param discoveryId - Discovery ID to fail
 * @param error - Error object or error message
 * @throws Never - handles errors internally
 *
 * @example
 * ```typescript
 * try {
 *   await executeSitemapPhase(discoveryId, homepageUrl);
 * } catch (error) {
 *   await failDiscovery(discoveryId, error);
 * }
 * ```
 */
export async function failDiscovery(
  discoveryId: string,
  error: Error | string
): Promise<void> {
  try {
    // Extract error details
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorCode =
      error instanceof DiscoveryWorkerError
        ? error.code
        : DiscoveryErrorCode.UPDATE_FAILED;

    console.error(
      `❌ Discovery Worker: Failing discovery ${discoveryId}: ${errorMessage}`
    );

    // Update discovery status to FAILED with error details
    await updateStatus(discoveryId, 'FAILED', {
      message: errorMessage,
      code: errorCode,
    });

    // Clear any cached data for this discovery
    await clearDiscoveryCache(discoveryId);

    console.log(
      `✅ Discovery Worker: Failed discovery ${discoveryId} with error code ${errorCode}`
    );
  } catch (updateError) {
    const err =
      updateError instanceof Error ? updateError : new Error(String(updateError));
    console.error(
      `❌ Discovery Worker: Failed to fail discovery ${discoveryId}:`,
      err.message
    );
    // Don't throw - this is already an error handler
  }
}

/**
 * Handle partial results when discovery is interrupted
 *
 * Saves partial results when discovery times out or is interrupted,
 * sets partialResults flag to true on discovery record, updates status
 * to COMPLETED (with partial flag), and logs what was saved vs what failed.
 *
 * @param discoveryId - Discovery ID to save partial results for
 * @param pages - Array of discovered pages (partial results)
 * @param error - Error that caused the interruption
 * @throws DiscoveryWorkerError if saving fails
 *
 * @example
 * ```typescript
 * try {
 *   await executeSitemapPhase(discoveryId, homepageUrl);
 * } catch (error) {
 *   // Timeout occurred, save what we have
 *   if (discoveredPages.length > 0) {
 *     await handlePartialResults(discoveryId, discoveredPages, error);
 *   } else {
 *     await failDiscovery(discoveryId, error);
 *   }
 * }
 * ```
 */
export async function handlePartialResults(
  discoveryId: string,
  pages: Array<{
    url: string;
    title?: string;
    source: PageSource;
    depth: number;
  }>,
  error: Error
): Promise<void> {
  try {
    console.warn(
      `⚠️  Discovery Worker: Saving partial results for ${discoveryId} (${pages.length} pages)`
    );
    console.warn(`⚠️  Discovery Worker: Interruption reason: ${error.message}`);

    // Save partial results to database
    const savedCount = await addPages(discoveryId, pages);

    console.log(
      `✅ Discovery Worker: Saved ${savedCount} partial results for ${discoveryId}`
    );

    // Update discovery status to COMPLETED with partial flag
    // Note: This requires adding partialResults field to the discovery record
    // For now, we'll update status and log the partial nature
    await updateStatus(discoveryId, 'COMPLETED');

    // TODO: Update partialResults flag when schema is updated
    // await updatePartialResults(discoveryId, true);

    console.log(
      `✅ Discovery Worker: Marked discovery ${discoveryId} as COMPLETED (partial results)`
    );
    console.log(
      `📊 Discovery Worker: Partial results summary for ${discoveryId}:`
    );
    console.log(`   - Saved: ${savedCount} pages`);
    console.log(`   - Error: ${error.message}`);
  } catch (saveError) {
    const err =
      saveError instanceof Error ? saveError : new Error(String(saveError));
    const errorMessage = err.message;
    const errorCode =
      saveError instanceof DiscoveryWorkerError
        ? saveError.code
        : DiscoveryErrorCode.UPDATE_FAILED;

    console.error(
      `❌ Discovery Worker: Failed to save partial results for ${discoveryId}:`,
      errorMessage
    );

    throw new DiscoveryWorkerError(
      `Failed to save partial results: ${errorMessage}`,
      errorCode,
      { cause: err }
    );
  }
}

/**
 * Clear discovery cache in Redis
 *
 * Removes cached discovery result from Redis.
 * Used when discovery fails or is cancelled.
 *
 * @param discoveryId - Discovery ID to clear cache for
 *
 * @example
 * ```typescript
 * await clearDiscoveryCache('discovery-123');
 * ```
 */
async function clearDiscoveryCache(discoveryId: string): Promise<void> {
  const redis = getRedisClient();

  try {
    console.log(
      `🔄 Discovery Worker: Clearing cache for discovery ${discoveryId}`
    );

    const cacheKey = `discovery:${discoveryId}:result`;
    await redis.del(cacheKey);

    console.log(
      `✅ Discovery Worker: Cleared cache for discovery ${discoveryId}`
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Discovery Worker: Failed to clear cache for ${discoveryId}:`,
      err.message
    );
    // Don't throw - cache clearing failure shouldn't fail the operation
  }
}

// ============================================================================
// JOB COMPLETION AND RESULT SAVING
// ============================================================================

/**
 * Complete discovery and save all discovered pages
 *
 * Saves all discovered pages to the database, updates discovery status to COMPLETED,
 * sets completedAt timestamp, caches the result in Redis, and increments usage counter.
 *
 * This function should be called when discovery completes successfully.
 *
 * @param discoveryId - Discovery ID to complete
 * @param pages - Array of discovered pages with URL, title, source, and depth
 * @throws DiscoveryWorkerError if saving fails
 *
 * @example
 * ```typescript
 * await completeDiscovery('discovery-123', [
 *   { url: 'https://example.com', title: 'Home', source: 'SITEMAP', depth: 0 },
 *   { url: 'https://example.com/about', title: 'About', source: 'NAVIGATION', depth: 1 }
 * ]);
 * ```
 */
export async function completeDiscovery(
  discoveryId: string,
  pages: Array<{
    url: string;
    title?: string;
    source: PageSource;
    depth: number;
  }>
): Promise<void> {
  try {
    console.log(
      `🔄 Discovery Worker: Completing discovery ${discoveryId} with ${pages.length} pages`
    );

    // Save all discovered pages to database
    const savedCount = await addPages(discoveryId, pages);

    console.log(
      `✅ Discovery Worker: Saved ${savedCount} pages to database for ${discoveryId}`
    );

    // Update discovery status to COMPLETED with completedAt timestamp
    await updateStatus(discoveryId, 'COMPLETED');

    console.log(
      `✅ Discovery Worker: Updated status to COMPLETED for ${discoveryId}`
    );

    // Load discovery with pages for caching
    const discovery = await findById(discoveryId);

    if (!discovery) {
      throw new DiscoveryWorkerError(
        `Discovery not found after completion: ${discoveryId}`,
        DiscoveryErrorCode.DISCOVERY_NOT_FOUND
      );
    }

    // Cache the discovery result in Redis (24h TTL)
    // Note: findById doesn't load pages by default, we'll cache without pages
    // and let the API load pages on demand
    await cacheDiscoveryResult({
      ...discovery,
      pages: pages.map((page, index) => ({
        id: `temp_${index}`, // Temporary ID - actual IDs are in database
        discoveryId,
        url: page.url,
        title: page.title ?? null,
        source: page.source,
        depth: page.depth,
        httpStatus: null,
        contentType: null,
        createdAt: new Date(),
      })),
    });

    console.log(
      `✅ Discovery Worker: Cached discovery result for ${discoveryId}`
    );

    // TODO: Increment usage counter for the session
    // This will be implemented when session tracking is added
    // For now, we rely on database queries to count discoveries per session

    console.log(
      `✅ Discovery Worker: Successfully completed discovery ${discoveryId} with ${pages.length} pages`
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const errorMessage = err.message;
    const errorCode =
      error instanceof DiscoveryWorkerError
        ? error.code
        : DiscoveryErrorCode.UPDATE_FAILED;

    console.error(
      `❌ Discovery Worker: Failed to complete discovery ${discoveryId}:`,
      errorMessage
    );

    throw new DiscoveryWorkerError(
      `Failed to complete discovery: ${errorMessage}`,
      errorCode,
      { cause: err }
    );
  }
}

/**
 * Cache discovery result in Redis
 *
 * Stores a completed discovery result in Redis with a 24-hour TTL.
 * Uses the key pattern: `discovery:{id}:result`
 *
 * The cached result includes all discovery metadata and discovered pages,
 * allowing fast retrieval without database queries.
 *
 * @param discovery - Discovery with pages to cache
 * @throws DiscoveryWorkerError if caching fails
 *
 * @example
 * ```typescript
 * await cacheDiscoveryResult({
 *   id: 'discovery-123',
 *   homepageUrl: 'https://example.com',
 *   status: 'COMPLETED',
 *   pages: [
 *     { url: 'https://example.com', title: 'Home', source: 'SITEMAP', depth: 0 }
 *   ],
 *   ...
 * });
 * ```
 */
export async function cacheDiscoveryResult(
  discovery: DiscoveryWithPages
): Promise<void> {
  const redis = getRedisClient();
  const TTL_HOURS = 24;
  const TTL_SECONDS = TTL_HOURS * 60 * 60;

  try {
    console.log(
      `🔄 Discovery Worker: Caching discovery result for ${discovery.id}`
    );

    // Prepare cache data with cachedAt timestamp
    const cacheData = {
      ...discovery,
      cachedAt: new Date().toISOString(),
    };

    // Store in Redis with 24-hour TTL
    const cacheKey = `discovery:${discovery.id}:result`;
    await redis.setex(cacheKey, TTL_SECONDS, JSON.stringify(cacheData));

    console.log(
      `✅ Discovery Worker: Cached discovery ${discovery.id} in Redis (TTL: ${TTL_HOURS}h)`
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    console.error(
      `❌ Discovery Worker: Failed to cache discovery ${discovery.id}:`,
      err.message
    );

    // Don't throw error - caching failure shouldn't fail the discovery
    // The discovery is still completed successfully, just not cached
    console.warn(
      `⚠️  Discovery Worker: Continuing without cache for ${discovery.id}`
    );
  }
}

// ============================================================================
// WORKER REGISTRATION
// ============================================================================

/**
 * Discovery worker instance (singleton)
 */
let discoveryWorker: Worker<DiscoveryJobData, DiscoveryJobResult> | null = null;

/**
 * Register discovery worker
 *
 * Creates and starts the BullMQ worker for processing discovery jobs.
 * Should be called once during application startup.
 *
 * Features:
 * - Automatic job processing with concurrency = 1
 * - Error handling and logging
 * - Graceful shutdown support
 *
 * @returns Worker instance
 *
 * @example
 * ```typescript
 * // In application startup
 * const worker = registerDiscoveryWorker();
 * console.log('Discovery worker started');
 * ```
 */
export function registerDiscoveryWorker(): Worker<
  DiscoveryJobData,
  DiscoveryJobResult
> {
  if (discoveryWorker) {
    console.log('⚠️  Discovery Worker: Worker already registered');
    return discoveryWorker;
  }

  discoveryWorker = new Worker<DiscoveryJobData, DiscoveryJobResult>(
    QUEUE_NAME,
    processDiscoveryJob,
    {
      connection: getBullMQConnection(),
      concurrency: 1, // Process one discovery at a time
      autorun: true, // Start processing immediately
    }
  );

  // Worker event handlers
  discoveryWorker.on('completed', (job, result) => {
    console.log(
      `✅ Discovery Worker: Job ${job.id} completed for discovery ${result.discoveryId}`
    );
  });

  discoveryWorker.on('failed', (job, error) => {
    console.error(
      `❌ Discovery Worker: Job ${job?.id} failed:`,
      error.message
    );
  });

  discoveryWorker.on('error', (error) => {
    console.error('❌ Discovery Worker: Worker error:', error.message);
  });

  discoveryWorker.on('active', (job) => {
    console.log(`🔄 Discovery Worker: Job ${job.id} started processing`);
  });

  console.log('✅ Discovery Worker: Worker registered and started');
  return discoveryWorker;
}

/**
 * Stop discovery worker gracefully
 *
 * Stops the worker and waits for active jobs to complete.
 * Should be called during application shutdown.
 *
 * @returns Promise that resolves when worker is stopped
 *
 * @example
 * ```typescript
 * // In application shutdown
 * await stopDiscoveryWorker();
 * console.log('Discovery worker stopped');
 * ```
 */
export async function stopDiscoveryWorker(): Promise<void> {
  if (!discoveryWorker) {
    console.log('⚠️  Discovery Worker: No worker to stop');
    return;
  }

  try {
    await discoveryWorker.close();
    discoveryWorker = null;
    console.log('✅ Discovery Worker: Worker stopped gracefully');
  } catch (error) {
    console.error('❌ Discovery Worker: Error stopping worker:', error);
    throw error;
  }
}

/**
 * Get discovery worker instance
 *
 * Returns the current worker instance if registered.
 *
 * @returns Worker instance or null if not registered
 *
 * @example
 * ```typescript
 * const worker = getDiscoveryWorker();
 * if (worker) {
 *   console.log('Worker is running');
 * }
 * ```
 */
export function getDiscoveryWorker(): Worker<
  DiscoveryJobData,
  DiscoveryJobResult
> | null {
  return discoveryWorker;
}

// ============================================================================
// QUEUE HELPER FUNCTIONS
// ============================================================================

/**
 * Add discovery job to queue
 *
 * Helper function to add a new discovery job to the queue.
 * Used by the service layer when creating a new discovery.
 *
 * @param data - Discovery job data
 * @returns Job instance
 *
 * @example
 * ```typescript
 * const job = await addDiscoveryJob({
 *   discoveryId: 'discovery-123',
 *   homepageUrl: 'https://example.com',
 *   mode: 'AUTO',
 *   maxPages: 10,
 *   maxDepth: 1
 * });
 * console.log(`Job ${job.id} queued`);
 * ```
 */
export async function addDiscoveryJob(
  data: DiscoveryJobData
): Promise<Job<DiscoveryJobData, DiscoveryJobResult>> {
  try {
    const job = await discoveryQueue.add('discover-website', data, {
      jobId: data.discoveryId, // Use discoveryId as job ID for idempotency
    });

    console.log(
      `✅ Discovery Worker: Queued discovery job ${job.id} for ${data.homepageUrl}`
    );
    return job;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Worker: Failed to queue job:', err.message);
    throw new DiscoveryWorkerError(
      `Failed to queue discovery job: ${err.message}`,
      DiscoveryErrorCode.CREATE_FAILED,
      { cause: err }
    );
  }
}

/**
 * Remove discovery job from queue
 *
 * Helper function to remove a discovery job from the queue.
 * Used when cancelling a discovery.
 *
 * @param discoveryId - Discovery ID (also used as job ID)
 * @returns True if job was removed, false if not found
 *
 * @example
 * ```typescript
 * const removed = await removeDiscoveryJob('discovery-123');
 * if (removed) {
 *   console.log('Job removed from queue');
 * }
 * ```
 */
export async function removeDiscoveryJob(
  discoveryId: string
): Promise<boolean> {
  try {
    const job = await discoveryQueue.getJob(discoveryId);

    if (!job) {
      console.log(
        `⚠️  Discovery Worker: Job ${discoveryId} not found in queue`
      );
      return false;
    }

    await job.remove();
    console.log(`✅ Discovery Worker: Removed job ${discoveryId} from queue`);
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Worker: Failed to remove job:', err.message);
    return false;
  }
}

/**
 * Get discovery job status
 *
 * Helper function to get the current status of a discovery job.
 *
 * @param discoveryId - Discovery ID (also used as job ID)
 * @returns Job state or null if not found
 *
 * @example
 * ```typescript
 * const state = await getDiscoveryJobStatus('discovery-123');
 * if (state) {
 *   console.log(`Job state: ${state}`);
 * }
 * ```
 */
export async function getDiscoveryJobStatus(
  discoveryId: string
): Promise<string | null> {
  try {
    const job = await discoveryQueue.getJob(discoveryId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    return state;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Worker: Failed to get job status:', err.message);
    return null;
  }
}
