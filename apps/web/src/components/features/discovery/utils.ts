/**
 * Discovery Feature Utilities
 *
 * Utility functions for the discovery feature components.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Average scan time per page in seconds */
export const AVG_SCAN_TIME_PER_PAGE = 15;

/** Number of parallel scans */
export const PARALLEL_FACTOR = 3;

/** Threshold for large scan warning (30 minutes in seconds) */
export const LARGE_SCAN_THRESHOLD = 30 * 60;

// ============================================================================
// SCAN TIME ESTIMATION
// ============================================================================

/**
 * Calculate estimated scan time for a given number of pages
 *
 * @param pageCount - Number of pages to scan
 * @returns Estimated time in seconds
 *
 * @example
 * ```ts
 * const seconds = calculateEstimatedTime(10);
 * // Returns: 50 (10 pages * 15s / 3 parallel)
 * ```
 */
export function calculateEstimatedTime(pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.ceil((pageCount * AVG_SCAN_TIME_PER_PAGE) / PARALLEL_FACTOR);
}

/**
 * Format estimated scan time as human-readable string
 *
 * @param pageCount - Number of pages to scan
 * @returns Formatted time string
 *
 * @example
 * ```ts
 * formatEstimatedTime(2);   // "Less than 1 minute"
 * formatEstimatedTime(10);  // "About 1 minute"
 * formatEstimatedTime(50);  // "About 5 minutes"
 * formatEstimatedTime(500); // "About 42 minutes"
 * ```
 */
export function formatEstimatedTime(pageCount: number): string {
  const seconds = calculateEstimatedTime(pageCount);

  if (seconds < 60) {
    return 'Less than 1 minute';
  }

  const minutes = Math.round(seconds / 60);

  if (minutes === 1) {
    return 'About 1 minute';
  }

  if (minutes < 60) {
    return `About ${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 1) {
    if (remainingMinutes === 0) {
      return 'About 1 hour';
    }
    return `About 1 hour ${remainingMinutes} minutes`;
  }

  if (remainingMinutes === 0) {
    return `About ${hours} hours`;
  }

  return `About ${hours} hours ${remainingMinutes} minutes`;
}

/**
 * Check if scan time exceeds the large scan threshold
 *
 * @param pageCount - Number of pages to scan
 * @returns True if scan time exceeds threshold
 *
 * @example
 * ```ts
 * isLargeScan(50);  // false
 * isLargeScan(500); // true (>30 min)
 * ```
 */
export function isLargeScan(pageCount: number): boolean {
  return calculateEstimatedTime(pageCount) > LARGE_SCAN_THRESHOLD;
}

// ============================================================================
// URL UTILITIES
// ============================================================================

/**
 * Extract domain from URL
 *
 * @param url - URL to extract domain from
 * @returns Domain name or original URL if parsing fails
 *
 * @example
 * ```ts
 * extractDomain('https://www.example.com/page');
 * // Returns: "example.com"
 * ```
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Get path from URL
 *
 * @param url - URL to extract path from
 * @returns Path or "/" if parsing fails
 *
 * @example
 * ```ts
 * getUrlPath('https://example.com/about/team');
 * // Returns: "/about/team"
 * ```
 */
export function getUrlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return '/';
  }
}

/**
 * Truncate URL path for display
 *
 * @param url - URL to truncate
 * @param maxLength - Maximum length (default: 50)
 * @returns Truncated path
 *
 * @example
 * ```ts
 * truncateUrlPath('https://example.com/very/long/path/to/page', 20);
 * // Returns: "/very/.../page"
 * ```
 */
export function truncateUrlPath(url: string, maxLength = 50): string {
  const path = getUrlPath(url);

  if (path.length <= maxLength) {
    return path;
  }

  const parts = path.split('/').filter(Boolean);

  if (parts.length <= 2) {
    return `/${parts.join('/')}`.slice(0, maxLength - 3) + '...';
  }

  // Keep first and last parts
  const first = parts[0];
  const last = parts[parts.length - 1];

  return `/${first}/.../${last}`;
}

// ============================================================================
// SELECTION UTILITIES
// ============================================================================

/**
 * Get selection summary text
 *
 * @param selectedCount - Number of selected pages
 * @param totalCount - Total number of pages
 * @returns Summary text
 *
 * @example
 * ```ts
 * getSelectionSummary(5, 10);
 * // Returns: "5 of 10 pages selected"
 * ```
 */
export function getSelectionSummary(
  selectedCount: number,
  totalCount: number
): string {
  if (selectedCount === 0) {
    return 'No pages selected';
  }

  if (selectedCount === totalCount) {
    return `All ${totalCount} pages selected`;
  }

  return `${selectedCount} of ${totalCount} pages selected`;
}

/**
 * Check if all pages are selected
 *
 * @param selectedIds - Set of selected page IDs
 * @param totalCount - Total number of pages
 * @returns True if all pages are selected
 */
export function isAllSelected(
  selectedIds: Set<string>,
  totalCount: number
): boolean {
  return selectedIds.size === totalCount && totalCount > 0;
}

/**
 * Check if no pages are selected
 *
 * @param selectedIds - Set of selected page IDs
 * @returns True if no pages are selected
 */
export function isNoneSelected(selectedIds: Set<string>): boolean {
  return selectedIds.size === 0;
}

/**
 * Check if some (but not all) pages are selected
 *
 * @param selectedIds - Set of selected page IDs
 * @param totalCount - Total number of pages
 * @returns True if some pages are selected
 */
export function isSomeSelected(
  selectedIds: Set<string>,
  totalCount: number
): boolean {
  return selectedIds.size > 0 && selectedIds.size < totalCount;
}
