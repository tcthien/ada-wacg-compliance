/**
 * Discovery API Type Definitions
 *
 * Frontend types for the website skeleton discovery API.
 * These types mirror the backend types in apps/api/src/modules/discovery/discovery.types.ts
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Discovery process status
 */
export type DiscoveryStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Discovery execution mode
 */
export type DiscoveryMode = 'AUTO' | 'MANUAL';

/**
 * Discovery execution phase
 */
export type DiscoveryPhase = 'SITEMAP' | 'NAVIGATION' | 'CRAWLING';

/**
 * Page discovery source
 */
export type PageSource = 'SITEMAP' | 'NAVIGATION' | 'CRAWLED' | 'MANUAL';

// ============================================================================
// CORE ENTITIES
// ============================================================================

/**
 * Discovered page entity
 */
export interface DiscoveredPage {
  /** Unique page identifier */
  id: string;
  /** Parent discovery job ID */
  discoveryId: string;
  /** Page URL */
  url: string;
  /** Page title (optional) */
  title: string | null;
  /** How the page was discovered */
  source: PageSource;
  /** Crawl depth (0 = homepage) */
  depth: number;
  /** HTTP status code (optional) */
  httpStatus: number | null;
  /** Content-Type header value (optional) */
  contentType: string | null;
  /** Page discovery timestamp */
  createdAt: string;
}

/**
 * Discovery job entity
 */
export interface Discovery {
  /** Unique discovery identifier */
  id: string;
  /** Guest session ID (optional) */
  sessionId: string | null;
  /** Website homepage URL */
  homepageUrl: string;
  /** Discovery execution mode */
  mode: DiscoveryMode;
  /** Current discovery status */
  status: DiscoveryStatus;
  /** Current discovery phase (null if not started) */
  phase: DiscoveryPhase | null;
  /** Maximum pages to discover */
  maxPages: number;
  /** Maximum crawl depth */
  maxDepth: number;
  /** Whether discovery returned partial results */
  partialResults: boolean;
  /** Discovery creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Completion timestamp (null if not completed) */
  completedAt: string | null;
  /** Error details if failed */
  errorMessage: string | null;
  /** Machine-readable error code */
  errorCode: string | null;
}

/**
 * Discovery with related pages loaded
 */
export interface DiscoveryWithPages extends Discovery {
  /** Discovered pages for this discovery job */
  pages: DiscoveredPage[];
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Input for creating a new discovery job
 */
export interface CreateDiscoveryInput {
  /** Website homepage URL to discover */
  homepageUrl: string;
  /** Discovery execution mode (defaults to AUTO) */
  mode?: DiscoveryMode;
  /** Maximum pages to discover (defaults to 10) */
  maxPages?: number;
  /** Maximum crawl depth (defaults to 1) */
  maxDepth?: number;
}

/**
 * Input for adding a single manual URL
 */
export interface AddUrlInput {
  /** URL to add */
  url: string;
}

/**
 * Input for adding multiple manual URLs
 */
export interface AddUrlsInput {
  /** Array of URLs to add */
  urls: string[];
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Response when creating a discovery
 */
export interface CreateDiscoveryResponse {
  /** Created discovery data */
  discovery: Discovery;
}

/**
 * Response when getting a discovery
 */
export interface GetDiscoveryResponse {
  /** Discovery data with pages */
  discovery: DiscoveryWithPages;
  /** Cache metadata (if result was cached) */
  cacheMetadata?: CacheMetadata;
}

/**
 * Cache metadata for discovery results
 */
export interface CacheMetadata {
  /** When the result was cached */
  cachedAt: string;
  /** When the cache expires */
  expiresAt: string;
  /** Number of pages in cached result */
  pageCount: number;
}

/**
 * Response when adding a single URL
 */
export interface AddUrlResponse {
  /** Whether the URL was successfully added */
  success: boolean;
  /** The added page (if success is true) */
  page?: DiscoveredPage;
  /** Human-readable result message */
  message: string;
}

/**
 * Result for a single URL in batch addition
 */
export interface BatchAddUrlResult {
  /** The URL that was processed */
  url: string;
  /** Whether the URL was successfully added */
  success: boolean;
  /** The added page (if success is true) */
  page?: DiscoveredPage;
  /** Error message (if success is false) */
  error?: string;
}

/**
 * Response when adding multiple URLs
 */
export interface AddUrlsResponse {
  /** Results for each URL */
  results: BatchAddUrlResult[];
  /** Number of URLs successfully added */
  successCount: number;
  /** Number of URLs that failed to add */
  failureCount: number;
}

/**
 * Response when cancelling a discovery
 */
export interface CancelDiscoveryResponse {
  /** Updated discovery data */
  discovery: Discovery;
}

/**
 * Response when removing a URL
 */
export interface RemoveUrlResponse {
  /** Whether the URL was successfully removed */
  success: boolean;
  /** Human-readable result message */
  message: string;
}

// ============================================================================
// USAGE LIMIT TYPES
// ============================================================================

/**
 * Result of discovery usage limit check
 */
export interface UsageLimitResult {
  /** Whether the user can create a new discovery */
  allowed: boolean;
  /** Number of discoveries remaining in current month */
  remaining: number;
  /** Total discovery limit per month */
  limit: number;
  /** Date when the limit resets (first day of next month) */
  resetDate: string;
  /** Human-readable message explaining the limit status */
  message: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Discovery API error codes
 */
export type DiscoveryErrorCode =
  | 'DISCOVERY_NOT_FOUND'
  | 'PAGE_NOT_FOUND'
  | 'INVALID_URL'
  | 'DOMAIN_MISMATCH'
  | 'DUPLICATE_URL'
  | 'USAGE_LIMIT_EXCEEDED'
  | 'INVALID_STATUS'
  | 'MAX_PAGES_EXCEEDED';

/**
 * Discovery API error response
 */
export interface DiscoveryApiError {
  /** Error message */
  message: string;
  /** Machine-readable error code */
  code: DiscoveryErrorCode;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a valid DiscoveryStatus
 */
export function isDiscoveryStatus(value: unknown): value is DiscoveryStatus {
  return (
    typeof value === 'string' &&
    ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(value)
  );
}

/**
 * Check if a value is a valid DiscoveryMode
 */
export function isDiscoveryMode(value: unknown): value is DiscoveryMode {
  return typeof value === 'string' && ['AUTO', 'MANUAL'].includes(value);
}

/**
 * Check if a value is a valid DiscoveryPhase
 */
export function isDiscoveryPhase(value: unknown): value is DiscoveryPhase {
  return (
    typeof value === 'string' &&
    ['SITEMAP', 'NAVIGATION', 'CRAWLING'].includes(value)
  );
}

/**
 * Check if a value is a valid PageSource
 */
export function isPageSource(value: unknown): value is PageSource {
  return (
    typeof value === 'string' &&
    ['SITEMAP', 'NAVIGATION', 'CRAWLED', 'MANUAL'].includes(value)
  );
}

/**
 * Check if a discovery is in a terminal state
 */
export function isTerminalStatus(status: DiscoveryStatus): boolean {
  return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
}

/**
 * Check if a discovery is in progress
 */
export function isInProgressStatus(status: DiscoveryStatus): boolean {
  return ['PENDING', 'RUNNING'].includes(status);
}
