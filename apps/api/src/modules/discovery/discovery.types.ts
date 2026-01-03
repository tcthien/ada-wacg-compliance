import type {
  DiscoveryStatus as PrismaDiscoveryStatus,
  DiscoveryMode as PrismaDiscoveryMode,
  DiscoveryPhase as PrismaDiscoveryPhase,
  PageSource as PrismaPageSource,
  Discovery as PrismaDiscovery,
  DiscoveredPage as PrismaDiscoveredPage,
} from '@prisma/client';

/**
 * Discovery Module Type Definitions
 *
 * This module provides type definitions for the website skeleton discovery system.
 * All types follow the project's type-safety patterns and integrate with Prisma schema.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Discovery process status
 *
 * Represents the lifecycle of a discovery job from creation to completion.
 * Used for tracking discovery progress and managing job state.
 *
 * @example
 * ```ts
 * const status: DiscoveryStatus = 'RUNNING';
 * ```
 */
export enum DiscoveryStatus {
  /** Discovery job created but not yet started */
  PENDING = 'PENDING',
  /** Discovery job currently executing */
  RUNNING = 'RUNNING',
  /** Discovery job completed successfully */
  COMPLETED = 'COMPLETED',
  /** Discovery job failed due to error */
  FAILED = 'FAILED',
  /** Discovery job cancelled by user */
  CANCELLED = 'CANCELLED',
}

/**
 * Discovery execution mode
 *
 * Determines how the discovery process operates.
 * AUTO mode runs all phases automatically, MANUAL mode allows user control.
 *
 * @example
 * ```ts
 * const mode: DiscoveryMode = 'AUTO';
 * ```
 */
export enum DiscoveryMode {
  /** Automatic discovery with all phases */
  AUTO = 'AUTO',
  /** Manual discovery with user-controlled phases */
  MANUAL = 'MANUAL',
}

/**
 * Discovery execution phase
 *
 * Represents the current phase of the discovery process.
 * Phases execute in order: SITEMAP → NAVIGATION → CRAWLING.
 *
 * @example
 * ```ts
 * const phase: DiscoveryPhase = 'SITEMAP';
 * ```
 */
export enum DiscoveryPhase {
  /** Analyzing sitemap.xml for URLs */
  SITEMAP = 'SITEMAP',
  /** Analyzing navigation links */
  NAVIGATION = 'NAVIGATION',
  /** Crawling discovered pages */
  CRAWLING = 'CRAWLING',
}

/**
 * Page discovery source
 *
 * Indicates how a page URL was discovered.
 * Used for tracking and prioritizing discovered pages.
 *
 * @example
 * ```ts
 * const source: PageSource = 'SITEMAP';
 * ```
 */
export enum PageSource {
  /** Found in sitemap.xml */
  SITEMAP = 'SITEMAP',
  /** Found in navigation menu/links */
  NAVIGATION = 'NAVIGATION',
  /** Found during crawling process */
  CRAWLED = 'CRAWLED',
  /** Added manually by user */
  MANUAL = 'MANUAL',
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Discovery job entity
 *
 * Represents a website skeleton discovery job.
 * Matches the Prisma Discovery model structure.
 *
 * @property id - Unique discovery identifier (UUID)
 * @property sessionId - Guest session ID (optional)
 * @property homepageUrl - Website homepage URL to discover
 * @property mode - Discovery execution mode
 * @property status - Current discovery status
 * @property phase - Current discovery phase (null if not started)
 * @property maxPages - Maximum pages to discover
 * @property maxDepth - Maximum crawl depth
 * @property partialResults - Whether discovery returned partial results
 * @property createdAt - Discovery creation timestamp
 * @property updatedAt - Last update timestamp
 * @property completedAt - Completion timestamp (null if not completed)
 * @property errorMessage - Error details if failed
 * @property errorCode - Machine-readable error code
 *
 * @example
 * ```ts
 * const discovery: Discovery = {
 *   id: 'discovery_abc123',
 *   sessionId: 'session_xyz789',
 *   homepageUrl: 'https://example.com',
 *   mode: 'AUTO',
 *   status: 'COMPLETED',
 *   phase: 'CRAWLING',
 *   maxPages: 10,
 *   maxDepth: 1,
 *   partialResults: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   completedAt: new Date(),
 *   errorMessage: null,
 *   errorCode: null
 * };
 * ```
 */
export interface Discovery extends PrismaDiscovery {}

/**
 * Discovered page entity
 *
 * Represents a single page discovered during website skeleton discovery.
 * Matches the Prisma DiscoveredPage model structure.
 *
 * @property id - Unique page identifier (UUID)
 * @property discoveryId - Parent discovery job ID
 * @property url - Page URL
 * @property title - Page title (optional)
 * @property source - How the page was discovered
 * @property depth - Crawl depth (0 = homepage)
 * @property httpStatus - HTTP status code (optional)
 * @property contentType - Content-Type header value (optional)
 * @property createdAt - Page discovery timestamp
 *
 * @example
 * ```ts
 * const page: DiscoveredPage = {
 *   id: 'page_abc123',
 *   discoveryId: 'discovery_xyz789',
 *   url: 'https://example.com/about',
 *   title: 'About Us',
 *   source: 'SITEMAP',
 *   depth: 1,
 *   httpStatus: 200,
 *   contentType: 'text/html',
 *   createdAt: new Date()
 * };
 * ```
 */
export interface DiscoveredPage extends PrismaDiscoveredPage {}

/**
 * Discovery with related pages loaded
 *
 * Extended discovery type that includes the discovered pages relation.
 * Used when returning full discovery results to the client.
 *
 * @example
 * ```ts
 * const result: DiscoveryWithPages = {
 *   id: 'discovery_abc123',
 *   homepageUrl: 'https://example.com',
 *   status: 'COMPLETED',
 *   pages: [
 *     { id: 'page_1', url: 'https://example.com', ... },
 *     { id: 'page_2', url: 'https://example.com/about', ... }
 *   ],
 *   ...
 * };
 * ```
 */
export interface DiscoveryWithPages extends Discovery {
  /** Discovered pages for this discovery job */
  pages: DiscoveredPage[];
}

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

/**
 * Input for creating a new discovery job
 *
 * Used by the discovery service to create new discovery jobs.
 * Provides configuration for discovery execution.
 *
 * @property sessionId - Guest session ID (optional)
 * @property homepageUrl - Website homepage URL to discover
 * @property mode - Discovery execution mode (defaults to AUTO)
 * @property maxPages - Maximum pages to discover (defaults to 10)
 * @property maxDepth - Maximum crawl depth (defaults to 1)
 *
 * @example
 * ```ts
 * const input: CreateDiscoveryInput = {
 *   sessionId: 'session_xyz789',
 *   homepageUrl: 'https://example.com',
 *   mode: 'AUTO',
 *   maxPages: 10,
 *   maxDepth: 1
 * };
 * ```
 */
export interface CreateDiscoveryInput {
  /** Guest session ID (optional) */
  sessionId?: string;
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
 * Result of manual URL addition
 *
 * Returned when a user manually adds a URL to a discovery job.
 * Indicates whether the URL was successfully added or already exists.
 *
 * @property success - Whether the URL was successfully added
 * @property page - The added page (if success is true)
 * @property message - Human-readable result message
 *
 * @example
 * ```ts
 * const result: AddUrlResult = {
 *   success: true,
 *   page: {
 *     id: 'page_abc123',
 *     url: 'https://example.com/contact',
 *     source: 'MANUAL',
 *     ...
 *   },
 *   message: 'URL added successfully'
 * };
 * ```
 */
export interface AddUrlResult {
  /** Whether the URL was successfully added */
  success: boolean;
  /** The added page (if success is true) */
  page?: DiscoveredPage;
  /** Human-readable result message */
  message: string;
}

/**
 * Result of discovery usage limit check
 *
 * Returned when checking if a user can create a new discovery job.
 * Enforces the 3 discoveries per month limit for free tier users.
 *
 * @property allowed - Whether the user can create a new discovery
 * @property remaining - Number of discoveries remaining in current month
 * @property limit - Total discovery limit per month
 * @property resetDate - Date when the limit resets (first day of next month)
 * @property message - Human-readable message explaining the limit status
 *
 * @example
 * ```ts
 * const result: UsageLimitResult = {
 *   allowed: true,
 *   remaining: 2,
 *   limit: 3,
 *   resetDate: new Date('2025-02-01'),
 *   message: 'You have 2 discoveries remaining this month'
 * };
 * ```
 */
export interface UsageLimitResult {
  /** Whether the user can create a new discovery */
  allowed: boolean;
  /** Number of discoveries remaining in current month */
  remaining: number;
  /** Total discovery limit per month */
  limit: number;
  /** Date when the limit resets (first day of next month) */
  resetDate: Date;
  /** Human-readable message explaining the limit status */
  message: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a valid DiscoveryStatus
 *
 * @param value - Value to check
 * @returns True if value is a valid DiscoveryStatus
 *
 * @example
 * ```ts
 * if (isDiscoveryStatus(input)) {
 *   // TypeScript knows input is a valid DiscoveryStatus
 *   console.log(`Valid status: ${input}`);
 * }
 * ```
 */
export function isDiscoveryStatus(
  value: unknown,
): value is PrismaDiscoveryStatus {
  return (
    typeof value === 'string' &&
    (value === 'PENDING' ||
      value === 'RUNNING' ||
      value === 'COMPLETED' ||
      value === 'FAILED' ||
      value === 'CANCELLED')
  );
}

/**
 * Type guard to check if a value is a valid DiscoveryMode
 *
 * @param value - Value to check
 * @returns True if value is a valid DiscoveryMode
 *
 * @example
 * ```ts
 * if (isDiscoveryMode(input)) {
 *   // TypeScript knows input is a valid DiscoveryMode
 *   console.log(`Valid mode: ${input}`);
 * }
 * ```
 */
export function isDiscoveryMode(value: unknown): value is PrismaDiscoveryMode {
  return typeof value === 'string' && (value === 'AUTO' || value === 'MANUAL');
}

/**
 * Type guard to check if a value is a valid DiscoveryPhase
 *
 * @param value - Value to check
 * @returns True if value is a valid DiscoveryPhase
 *
 * @example
 * ```ts
 * if (isDiscoveryPhase(input)) {
 *   // TypeScript knows input is a valid DiscoveryPhase
 *   console.log(`Valid phase: ${input}`);
 * }
 * ```
 */
export function isDiscoveryPhase(
  value: unknown,
): value is PrismaDiscoveryPhase {
  return (
    typeof value === 'string' &&
    (value === 'SITEMAP' || value === 'NAVIGATION' || value === 'CRAWLING')
  );
}

/**
 * Type guard to check if a value is a valid PageSource
 *
 * @param value - Value to check
 * @returns True if value is a valid PageSource
 *
 * @example
 * ```ts
 * if (isPageSource(input)) {
 *   // TypeScript knows input is a valid PageSource
 *   console.log(`Valid source: ${input}`);
 * }
 * ```
 */
export function isPageSource(value: unknown): value is PrismaPageSource {
  return (
    typeof value === 'string' &&
    (value === 'SITEMAP' ||
      value === 'NAVIGATION' ||
      value === 'CRAWLED' ||
      value === 'MANUAL')
  );
}
