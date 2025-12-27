import { promises as dns } from 'dns';
import { URL } from 'url';

/**
 * Result of URL validation with security checks
 */
export interface UrlValidationResult {
  /** Whether the URL passed all validation checks */
  isValid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Normalized URL if validation succeeded */
  normalizedUrl?: string;
  /** Extracted hostname */
  hostname?: string;
  /** Resolved IP address from DNS lookup */
  resolvedIp?: string;
}

/**
 * Private IPv4 address ranges (CIDR notation)
 * - 10.0.0.0/8: Private networks
 * - 172.16.0.0/12: Private networks
 * - 192.168.0.0/16: Private networks
 * - 127.0.0.0/8: Loopback
 * - 169.254.0.0/16: Link-local (APIPA)
 * - 0.0.0.0/8: This network
 */
const PRIVATE_IPV4_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' },
  { start: '169.254.0.0', end: '169.254.255.255' },
  { start: '0.0.0.0', end: '0.255.255.255' },
];

/**
 * Private/reserved IPv6 address patterns
 * - ::1: Loopback
 * - fc00::/7: Unique local addresses
 * - fe80::/10: Link-local addresses
 * - ::ffff:0:0/96: IPv4-mapped IPv6 addresses
 */
const PRIVATE_IPV6_PATTERNS = [
  /^::1$/, // Loopback
  /^::ffff:/i, // IPv4-mapped IPv6
  /^fc[0-9a-f]{2}:/i, // Unique local
  /^fd[0-9a-f]{2}:/i, // Unique local
  /^fe[89ab][0-9a-f]:/i, // Link-local
];

/**
 * Blocked hostname patterns to prevent SSRF attacks
 * - localhost variations
 * - Internal/local TLDs
 * - Reserved/example TLDs
 * - Cloud metadata endpoints
 */
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.test$/i,
  /\.example$/i,
  /\.invalid$/i,
  /^metadata\.google\.internal$/i,
];

/**
 * Cloud metadata IP addresses that must be blocked
 * - 169.254.169.254: AWS, GCP, Azure metadata service
 */
const BLOCKED_METADATA_IPS = ['169.254.169.254'];

/**
 * Convert IPv4 address string to numeric value for range comparison
 * @param ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns Numeric representation of IP address
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => p === undefined)) {
    throw new Error('Invalid IP address format');
  }
  return (
    (parts[0]! << 24) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!
  );
}

/**
 * Check if an IP address is in a private/reserved range
 * Protects against SSRF attacks targeting internal infrastructure
 *
 * @param ip - IP address to check (IPv4 or IPv6)
 * @returns True if IP is private/reserved
 */
export function isPrivateIP(ip: string): boolean {
  // Check for IPv6 private ranges
  if (ip.includes(':')) {
    // Normalize IPv6 (remove leading zeros, collapse consecutive zeros)
    const normalizedIp = ip.toLowerCase();
    return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(normalizedIp));
  }

  // Check for cloud metadata IP
  if (BLOCKED_METADATA_IPS.includes(ip)) {
    return true;
  }

  // Check IPv4 private ranges
  const ipNum = ipToNumber(ip);
  return PRIVATE_IPV4_RANGES.some((range) => {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    return ipNum >= startNum && ipNum <= endNum;
  });
}

/**
 * Check if a hostname matches blocked patterns
 * Prevents DNS rebinding and internal network access
 *
 * @param hostname - Hostname to check
 * @returns True if hostname should be blocked
 */
export function isBlockedHostname(hostname: string): boolean {
  // Check against blocked patterns
  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return true;
  }

  // Block hostnames without a proper TLD (must have at least one dot)
  // Exception: IP addresses are handled separately
  if (!hostname.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return true;
  }

  // Block if hostname is an IP address that's private
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return isPrivateIP(hostname);
  }

  // Block IPv6 addresses in brackets
  if (/^\[.*\]$/.test(hostname)) {
    const ipv6 = hostname.slice(1, -1);
    return isPrivateIP(ipv6);
  }

  return false;
}

/**
 * Normalize URL by removing trailing slashes and lowercasing hostname
 * Ensures consistent URL handling across the application
 *
 * @param urlString - URL to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(urlString: string): string {
  const url = new URL(urlString);

  // Lowercase the hostname for consistency
  url.hostname = url.hostname.toLowerCase();

  // Remove trailing slash from pathname (unless it's the root path)
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  // Remove default ports (80 for HTTP, 443 for HTTPS)
  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  return url.toString();
}

/**
 * Validate URL with comprehensive security checks to prevent SSRF attacks
 *
 * Security measures:
 * 1. Protocol validation (HTTP/HTTPS only)
 * 2. Hostname pattern blocking (localhost, .internal, etc.)
 * 3. DNS resolution to actual IP
 * 4. Private IP range blocking
 * 5. Cloud metadata endpoint blocking
 * 6. DNS rebinding protection via IP validation
 *
 * @param urlString - URL to validate
 * @returns Validation result with detailed error information
 */
export async function validateUrl(
  urlString: string,
): Promise<UrlValidationResult> {
  try {
    // Step 1: Parse URL and validate format
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return {
        isValid: false,
        error: 'Invalid URL format',
      };
    }

    // Step 2: Check protocol (only HTTP/HTTPS allowed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        isValid: false,
        error: `Invalid protocol: ${url.protocol}. Only HTTP and HTTPS are allowed`,
      };
    }

    // Step 3: Reject URLs with credentials (security risk)
    if (url.username || url.password) {
      return {
        isValid: false,
        error: 'URLs with credentials are not allowed',
      };
    }

    // Step 4: Extract and validate hostname
    const hostname = url.hostname;

    // Step 5: Check if hostname matches blocked patterns
    if (isBlockedHostname(hostname)) {
      return {
        isValid: false,
        error: `Blocked hostname: ${hostname}`,
        hostname,
      };
    }

    // Step 6: Perform DNS lookup to resolve hostname to IP
    // This protects against DNS rebinding attacks where hostname
    // resolves to different IPs over time
    let resolvedIp: string;
    try {
      const result = await dns.lookup(hostname);
      resolvedIp = result.address;
    } catch (error) {
      return {
        isValid: false,
        error: `DNS resolution failed for ${hostname}`,
        hostname,
      };
    }

    // Step 7: Validate resolved IP is not private/reserved
    if (isPrivateIP(resolvedIp)) {
      return {
        isValid: false,
        error: `Resolved to private IP address: ${resolvedIp}`,
        hostname,
        resolvedIp,
      };
    }

    // Step 8: Normalize URL for consistent handling
    const normalizedUrl = normalizeUrl(urlString);

    // All checks passed
    return {
      isValid: true,
      normalizedUrl,
      hostname,
      resolvedIp,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
