/**
 * URL Security utilities for SSRF prevention
 *
 * Shared functions for validating URLs and preventing Server-Side Request Forgery attacks.
 * Used by both API and Worker packages.
 */

/**
 * Private IPv4 address ranges (CIDR notation)
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
 */
const PRIVATE_IPV6_PATTERNS = [
  /^::1$/, // Loopback
  /^::ffff:/i, // IPv4-mapped IPv6
  /^fc[0-9a-f]{2}:/i, // Unique local
  /^fd[0-9a-f]{2}:/i, // Unique local
  /^fe[89ab][0-9a-f]:/i, // Link-local
];

/**
 * Blocked hostname patterns
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
 * Cloud metadata IP addresses
 */
const BLOCKED_METADATA_IPS = ['169.254.169.254'];

/**
 * Convert IPv4 address string to numeric value
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) {
    throw new Error('Invalid IP address format');
  }
  return (parts[0]! << 24) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

/**
 * Check if an IP address is in a private/reserved range
 *
 * @param ip - IP address to check (IPv4 or IPv6)
 * @returns True if IP is private/reserved
 */
export function isPrivateIP(ip: string): boolean {
  // Check for IPv6 private ranges
  if (ip.includes(':')) {
    const normalizedIp = ip.toLowerCase();
    return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(normalizedIp));
  }

  // Check for cloud metadata IP
  if (BLOCKED_METADATA_IPS.includes(ip)) {
    return true;
  }

  // Check IPv4 private ranges
  try {
    const ipNum = ipToNumber(ip);
    return PRIVATE_IPV4_RANGES.some((range) => {
      const startNum = ipToNumber(range.start);
      const endNum = ipToNumber(range.end);
      return ipNum >= startNum && ipNum <= endNum;
    });
  } catch {
    return false;
  }
}

/**
 * Check if a hostname matches blocked patterns
 *
 * @param hostname - Hostname to check
 * @returns True if hostname should be blocked
 */
export function isBlockedHostname(hostname: string): boolean {
  // Check against blocked patterns
  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))) {
    return true;
  }

  // Block hostnames without a proper TLD
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
