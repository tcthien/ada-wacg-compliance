/**
 * URL Validation and Sanitization Utilities
 *
 * Provides utilities for:
 * - Validating sitemap URLs and page URLs
 * - Normalizing URLs for consistency
 * - Generating unique identifiers
 * - Sanitizing URLs for display (XSS prevention)
 * - Parsing manual URL input (semicolon-separated and multi-line)
 *
 * @module url-utils
 */

/**
 * Represents a validation error for an invalid URL
 */
export interface ValidationError {
  /** The invalid URL string that failed validation */
  url: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Result of parsing manual URL input
 */
export interface ValidationResult {
  /** Successfully validated and normalized URLs */
  validUrls: ParsedUrl[];
  /** Validation errors for invalid URLs */
  errors: ValidationError[];
}

/**
 * Represents a parsed URL with metadata
 */
export interface ParsedUrl {
  /** Unique identifier for this URL */
  id: string;
  /** Normalized URL string */
  url: string;
  /** Source of the URL (e.g., 'manual', 'auto') */
  source: string;
}

/**
 * Validates if a string is a valid URL
 *
 * Uses the native URL constructor for validation.
 * Accepts http, https, and protocol-relative URLs.
 *
 * @param url - The URL string to validate
 * @returns true if valid URL, false otherwise
 *
 * @example
 * validateUrl('https://example.com') // true
 * validateUrl('not-a-url') // false
 * validateUrl('//example.com') // true (protocol-relative)
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return false;
  }

  try {
    // Handle protocol-relative URLs by prepending https:
    const urlToValidate = trimmedUrl.startsWith('//')
      ? `https:${trimmedUrl}`
      : trimmedUrl;

    const parsed = new URL(urlToValidate);

    // Only accept http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes a URL for consistent formatting
 *
 * Normalization includes:
 * - Converting protocol-relative URLs to https
 * - Removing trailing slashes (except for root path)
 * - Converting to lowercase hostname
 * - Removing default ports (80 for http, 443 for https)
 * - Preserving query parameters and fragments
 *
 * @param url - The URL string to normalize
 * @returns Normalized URL string
 * @throws Error if URL is invalid
 *
 * @example
 * normalizeUrl('HTTPS://Example.COM/path/') // 'https://example.com/path'
 * normalizeUrl('//example.com:443/') // 'https://example.com'
 * normalizeUrl('http://example.com:80/path') // 'http://example.com/path'
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL: URL must be a non-empty string');
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    throw new Error('Invalid URL: URL cannot be empty');
  }

  try {
    // Handle protocol-relative URLs by prepending https:
    const urlToNormalize = trimmedUrl.startsWith('//')
      ? `https:${trimmedUrl}`
      : trimmedUrl;

    const parsed = new URL(urlToNormalize);

    // Only accept http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid URL protocol: ${parsed.protocol}`);
    }

    // Normalize hostname to lowercase
    const hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    const port = parsed.port;
    const shouldIncludePort =
      port &&
      !((parsed.protocol === 'http:' && port === '80') ||
        (parsed.protocol === 'https:' && port === '443'));

    const portString = shouldIncludePort ? `:${port}` : '';

    // Build pathname - remove trailing slash except for root path with search/hash
    let pathname = parsed.pathname;
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // For root path with query or hash, we want to remove the slash
    // For root path without query or hash, we also remove the slash
    // So effectively, always remove trailing slash for root
    if (pathname === '/' && (parsed.search || parsed.hash)) {
      pathname = '';
    } else if (pathname === '/') {
      pathname = '';
    }

    // Reconstruct normalized URL
    const normalizedUrl =
      `${parsed.protocol}//${hostname}${portString}${pathname}${parsed.search}${parsed.hash}`;

    return normalizedUrl;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
    throw new Error('Invalid URL: Unable to parse URL');
  }
}

/**
 * Generates a unique identifier
 *
 * Uses crypto.randomUUID() when available (modern browsers and Node 19+),
 * falls back to a timestamp-based random ID generator.
 *
 * Format: RFC 4122 UUID v4 (e.g., '550e8400-e29b-41d4-a716-446655440000')
 * or fallback format (e.g., 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx')
 *
 * @returns A unique identifier string
 *
 * @example
 * generateId() // '550e8400-e29b-41d4-a716-446655440000'
 */
export function generateId(): string {
  // Use native crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback to timestamp-based random ID
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sanitizes a URL for safe display in HTML
 *
 * Prevents XSS attacks by:
 * - Only allowing http and https protocols
 * - Encoding special HTML characters
 * - Removing javascript: and data: URLs
 * - Truncating extremely long URLs
 *
 * @param url - The URL string to sanitize
 * @param maxLength - Maximum length for display (default: 200)
 * @returns Sanitized URL safe for HTML display
 *
 * @example
 * sanitizeUrlForDisplay('https://example.com') // 'https://example.com'
 * sanitizeUrlForDisplay('javascript:alert(1)') // '' (blocked)
 * sanitizeUrlForDisplay('<script>alert(1)</script>') // '' (blocked)
 */
export function sanitizeUrlForDisplay(
  url: string,
  maxLength: number = 200
): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    return '';
  }

  // Block dangerous protocols
  const lowerUrl = trimmedUrl.toLowerCase();
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];

  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }

  // Validate URL format
  if (!validateUrl(trimmedUrl)) {
    // If not a valid URL, encode special characters
    return encodeHtmlEntities(trimmedUrl.substring(0, maxLength));
  }

  try {
    // Parse and validate the URL
    const urlToValidate = trimmedUrl.startsWith('//')
      ? `https:${trimmedUrl}`
      : trimmedUrl;

    const parsed = new URL(urlToValidate);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    // Reconstruct the URL to ensure it's properly formatted
    const safeUrl = parsed.href;

    // Truncate if too long
    const truncated =
      safeUrl.length > maxLength
        ? `${safeUrl.substring(0, maxLength)}...`
        : safeUrl;

    // Encode HTML entities for safe display
    return encodeHtmlEntities(truncated);
  } catch {
    // If parsing fails, encode the original string
    return encodeHtmlEntities(trimmedUrl.substring(0, maxLength));
  }
}

/**
 * Encodes HTML special characters to prevent XSS
 *
 * @param str - The string to encode
 * @returns String with HTML entities encoded
 * @internal
 */
function encodeHtmlEntities(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Parses manual URL input and validates URLs
 *
 * Supports two input formats:
 * 1. Semicolon-separated: `https://example.com;https://example.com/about`
 * 2. Multi-line: One URL per line
 *
 * Features:
 * - Validates each URL using validateUrl()
 * - Normalizes valid URLs using normalizeUrl()
 * - Deduplicates URLs (case-sensitive after normalization)
 * - Enforces maximum limit of 50 URLs
 * - Tracks validation errors for invalid URLs
 *
 * @param input - Raw string input containing URLs (semicolon-separated or multi-line)
 * @returns ValidationResult with valid URLs and errors
 *
 * @example
 * // Semicolon-separated
 * parseManualUrls('https://example.com;https://example.com/about')
 * // { validUrls: [...], errors: [] }
 *
 * @example
 * // Multi-line format
 * parseManualUrls(`https://example.com
 * https://example.com/about
 * https://example.com/contact`)
 * // { validUrls: [...], errors: [] }
 *
 * @example
 * // With invalid URLs
 * parseManualUrls('https://example.com;not-a-url;https://example.com/about')
 * // { validUrls: [2 items], errors: [{ url: 'not-a-url', message: '...' }] }
 */
export function parseManualUrls(input: string): ValidationResult {
  const validUrls: ParsedUrl[] = [];
  const errors: ValidationError[] = [];

  // Handle empty input
  if (!input || typeof input !== 'string') {
    return { validUrls, errors };
  }

  const trimmedInput = input.trim();

  if (trimmedInput.length === 0) {
    return { validUrls, errors };
  }

  // Split by semicolons or newlines
  const lines = trimmedInput
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Track seen URLs for deduplication (normalized URLs)
  const seen = new Set<string>();

  for (const line of lines) {
    // Check if we've already reached the limit
    if (validUrls.length >= 50) {
      // Add error for remaining URLs that couldn't be processed
      errors.push({
        url: line,
        message: 'Maximum limit of 50 URLs reached. This URL was not processed.',
      });
      continue;
    }

    // Validate the URL
    if (!validateUrl(line)) {
      errors.push({
        url: line,
        message: 'Invalid URL format. Please provide a valid http or https URL.',
      });
      continue;
    }

    // Normalize the URL
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(line);
    } catch (error) {
      errors.push({
        url: line,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to normalize URL',
      });
      continue;
    }

    // Check for duplicates
    if (seen.has(normalizedUrl)) {
      errors.push({
        url: line,
        message: 'Duplicate URL. This URL has already been added.',
      });
      continue;
    }

    // Add to results
    seen.add(normalizedUrl);
    validUrls.push({
      id: generateId(),
      url: normalizedUrl,
      source: 'manual',
    });
  }

  return { validUrls, errors };
}
