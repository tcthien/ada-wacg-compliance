/**
 * Discovery Repository
 *
 * Data access layer for discovery operations using Prisma ORM.
 * Implements clean architecture - repository handles only database operations.
 */

import { getPrismaClient } from '../../config/database.js';
import type {
  Discovery,
  DiscoveredPage,
  DiscoveryWithPages,
  CreateDiscoveryInput,
} from './discovery.types.js';
import type { DiscoveryStatus } from '@prisma/client';
import {
  DiscoveryRepositoryError,
  DiscoveryErrorCode,
} from './discovery.errors.js';

/**
 * Create a new discovery in the database
 *
 * @param data - Discovery creation data
 * @returns The created discovery
 * @throws DiscoveryRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * const discovery = await create({
 *   homepageUrl: 'https://example.com',
 *   sessionId: 'session-123',
 *   mode: 'AUTO',
 *   maxPages: 10,
 *   maxDepth: 1
 * });
 * ```
 */
export async function create(data: CreateDiscoveryInput): Promise<Discovery> {
  const prisma = getPrismaClient();

  try {
    // Validate required fields
    if (!data.homepageUrl || typeof data.homepageUrl !== 'string') {
      throw new DiscoveryRepositoryError(
        'Homepage URL is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    // Create discovery with PENDING status
    const discovery = await prisma.discovery.create({
      data: {
        homepageUrl: data.homepageUrl,
        sessionId: data.sessionId ?? null,
        mode: data.mode ?? 'AUTO',
        maxPages: data.maxPages ?? 10,
        maxDepth: data.maxDepth ?? 1,
        status: 'PENDING',
        phase: null,
        partialResults: false,
      },
    });

    console.log(
      `✅ Discovery Repository: Created discovery ${discovery.id} for URL ${discovery.homepageUrl}`,
    );
    return discovery;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Repository: Failed to create discovery:',
      err.message,
    );
    throw new DiscoveryRepositoryError(
      'Failed to create discovery',
      DiscoveryErrorCode.CREATE_FAILED,
      { cause: err },
    );
  }
}

/**
 * Get discovery by ID
 *
 * @param id - Discovery ID
 * @returns The discovery or null if not found
 *
 * @example
 * ```typescript
 * const discovery = await findById('discovery-123');
 * if (discovery) {
 *   console.log(`Discovery status: ${discovery.status}`);
 * }
 * ```
 */
export async function findById(id: string): Promise<Discovery | null> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const discovery = await prisma.discovery.findUnique({
      where: { id },
    });

    return discovery;
  } catch (error) {
    console.error('❌ Discovery Repository: Failed to get discovery:', error);
    throw new DiscoveryRepositoryError(
      `Failed to get discovery ${id}`,
      DiscoveryErrorCode.GET_FAILED,
      {
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

/**
 * Get discovery by ID with related pages loaded
 *
 * @param id - Discovery ID
 * @returns The discovery with pages, or null if not found
 *
 * @example
 * ```typescript
 * const discovery = await findByIdWithPages('discovery-123');
 * if (discovery) {
 *   console.log(`Found ${discovery.pages.length} pages`);
 * }
 * ```
 */
export async function findByIdWithPages(
  id: string,
): Promise<DiscoveryWithPages | null> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const discovery = await prisma.discovery.findUnique({
      where: { id },
      include: {
        pages: {
          orderBy: {
            depth: 'asc', // Homepage first (depth 0)
          },
        },
      },
    });

    return discovery as DiscoveryWithPages | null;
  } catch (error) {
    console.error(
      '❌ Discovery Repository: Failed to get discovery with pages:',
      error,
    );
    throw new DiscoveryRepositoryError(
      `Failed to get discovery with pages ${id}`,
      DiscoveryErrorCode.GET_FAILED,
      {
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

/**
 * Update discovery status
 *
 * @param id - Discovery ID
 * @param status - New status
 * @param error - Optional error details for FAILED status
 * @returns Updated discovery
 * @throws DiscoveryRepositoryError if discovery not found or update fails
 *
 * @example
 * ```typescript
 * // Mark discovery as running
 * await updateStatus('discovery-123', 'RUNNING');
 *
 * // Mark discovery as failed
 * await updateStatus('discovery-123', 'FAILED', {
 *   message: 'Connection timeout',
 *   code: 'TIMEOUT'
 * });
 *
 * // Mark discovery as completed
 * await updateStatus('discovery-123', 'COMPLETED');
 * ```
 */
export async function updateStatus(
  id: string,
  status: DiscoveryStatus,
  error?: { message: string; code: string },
): Promise<Discovery> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      throw new DiscoveryRepositoryError(
        'Discovery ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (!status) {
      throw new DiscoveryRepositoryError(
        'Status is required',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    // Check if discovery exists
    const existingDiscovery = await prisma.discovery.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingDiscovery) {
      throw new DiscoveryRepositoryError(
        `Discovery not found: ${id}`,
        DiscoveryErrorCode.DISCOVERY_NOT_FOUND,
      );
    }

    // Build update data
    const updateData: {
      status: DiscoveryStatus;
      errorMessage?: string | null;
      errorCode?: string | null;
      completedAt?: Date;
    } = {
      status,
    };

    // Set completedAt for terminal states
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      updateData.completedAt = new Date();
    }

    // Set error details for FAILED status
    if (status === 'FAILED' && error) {
      updateData.errorMessage = error.message;
      updateData.errorCode = error.code;
    }

    // Update discovery
    const discovery = await prisma.discovery.update({
      where: { id },
      data: updateData,
    });

    console.log(
      `✅ Discovery Repository: Updated discovery ${id} status to ${status}`,
    );
    return discovery;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Repository: Failed to update discovery status:',
      err.message,
    );
    throw new DiscoveryRepositoryError(
      `Failed to update discovery ${id}`,
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err },
    );
  }
}

/**
 * Find discoveries by session ID
 *
 * @param sessionId - Guest session ID
 * @returns Array of discoveries ordered by creation date (newest first)
 *
 * @example
 * ```typescript
 * const discoveries = await findBySessionId('session-123');
 * console.log(`Found ${discoveries.length} discoveries`);
 * ```
 */
export async function findBySessionId(sessionId: string): Promise<Discovery[]> {
  const prisma = getPrismaClient();

  try {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new DiscoveryRepositoryError(
        'Session ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    const discoveries = await prisma.discovery.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    return discoveries;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    console.error(
      '❌ Discovery Repository: Failed to list discoveries:',
      error,
    );
    throw new DiscoveryRepositoryError(
      `Failed to list discoveries for session ${sessionId}`,
      DiscoveryErrorCode.LIST_FAILED,
      {
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

// ============================================================================
// PAGE OPERATIONS
// ============================================================================

/**
 * Batch insert pages for a discovery
 *
 * @param discoveryId - Discovery ID to add pages to
 * @param pages - Array of pages to insert
 * @returns Number of pages inserted
 * @throws DiscoveryRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * await addPages('discovery-123', [
 *   { url: 'https://example.com', title: 'Home', source: 'SITEMAP', depth: 0, httpStatus: 200, contentType: 'text/html' },
 *   { url: 'https://example.com/about', title: 'About', source: 'SITEMAP', depth: 1 }
 * ]);
 * ```
 */
export async function addPages(
  discoveryId: string,
  pages: Array<{
    url: string;
    title?: string;
    source: import('@prisma/client').PageSource;
    depth: number;
    httpStatus?: number;
    contentType?: string;
  }>,
): Promise<number> {
  const prisma = getPrismaClient();

  try {
    // Validate inputs
    if (!discoveryId || typeof discoveryId !== 'string') {
      throw new DiscoveryRepositoryError(
        'Discovery ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (!Array.isArray(pages) || pages.length === 0) {
      throw new DiscoveryRepositoryError(
        'Pages array is required and must not be empty',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    // Validate each page
    for (const page of pages) {
      if (!page.url || typeof page.url !== 'string') {
        throw new DiscoveryRepositoryError(
          'Each page must have a valid URL',
          DiscoveryErrorCode.INVALID_INPUT,
        );
      }
      if (!page.source) {
        throw new DiscoveryRepositoryError(
          'Each page must have a source',
          DiscoveryErrorCode.INVALID_INPUT,
        );
      }
      if (typeof page.depth !== 'number') {
        throw new DiscoveryRepositoryError(
          'Each page must have a valid depth',
          DiscoveryErrorCode.INVALID_INPUT,
        );
      }
    }

    // Batch insert pages (skip duplicates)
    const result = await prisma.discoveredPage.createMany({
      data: pages.map((page) => ({
        discoveryId,
        url: page.url,
        title: page.title ?? null,
        source: page.source,
        depth: page.depth,
        httpStatus: page.httpStatus ?? null,
        contentType: page.contentType ?? null,
      })),
      skipDuplicates: true,
    });

    console.log(
      `✅ Discovery Repository: Added ${result.count} pages to discovery ${discoveryId}`,
    );
    return result.count;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Repository: Failed to add pages:',
      err.message,
    );
    throw new DiscoveryRepositoryError(
      'Failed to add pages to discovery',
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err },
    );
  }
}

/**
 * Add a single page to a discovery
 *
 * @param discoveryId - Discovery ID to add page to
 * @param page - Page data to insert
 * @returns The created page or null if duplicate
 * @throws DiscoveryRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * const page = await addPage('discovery-123', {
 *   url: 'https://example.com/contact',
 *   title: 'Contact Us',
 *   source: 'MANUAL',
 *   depth: 1
 * });
 * ```
 */
export async function addPage(
  discoveryId: string,
  page: {
    url: string;
    title?: string;
    source: import('@prisma/client').PageSource;
    depth: number;
  },
): Promise<DiscoveredPage | null> {
  const prisma = getPrismaClient();

  try {
    // Validate inputs
    if (!discoveryId || typeof discoveryId !== 'string') {
      throw new DiscoveryRepositoryError(
        'Discovery ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (!page.url || typeof page.url !== 'string') {
      throw new DiscoveryRepositoryError(
        'Page URL is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (!page.source) {
      throw new DiscoveryRepositoryError(
        'Page source is required',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (typeof page.depth !== 'number') {
      throw new DiscoveryRepositoryError(
        'Page depth is required and must be a number',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    // Check for duplicate
    const existing = await findPageByUrl(discoveryId, page.url);
    if (existing) {
      console.log(
        `ℹ️ Discovery Repository: Page already exists: ${page.url}`,
      );
      return null;
    }

    // Create page
    const createdPage = await prisma.discoveredPage.create({
      data: {
        discoveryId,
        url: page.url,
        title: page.title ?? null,
        source: page.source,
        depth: page.depth,
      },
    });

    console.log(
      `✅ Discovery Repository: Added page ${createdPage.id} to discovery ${discoveryId}`,
    );
    return createdPage;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Discovery Repository: Failed to add page:', err.message);
    throw new DiscoveryRepositoryError(
      'Failed to add page to discovery',
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err },
    );
  }
}

/**
 * Remove a page from a discovery
 *
 * @param discoveryId - Discovery ID
 * @param pageId - Page ID to remove
 * @returns True if page was deleted, false if not found
 * @throws DiscoveryRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * const deleted = await removePage('discovery-123', 'page-456');
 * if (deleted) {
 *   console.log('Page removed successfully');
 * }
 * ```
 */
export async function removePage(
  discoveryId: string,
  pageId: string,
): Promise<boolean> {
  const prisma = getPrismaClient();

  try {
    // Validate inputs
    if (!discoveryId || typeof discoveryId !== 'string') {
      throw new DiscoveryRepositoryError(
        'Discovery ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (!pageId || typeof pageId !== 'string') {
      throw new DiscoveryRepositoryError(
        'Page ID is required and must be a string',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    // Verify page belongs to this discovery before deleting
    const page = await prisma.discoveredPage.findFirst({
      where: {
        id: pageId,
        discoveryId,
      },
      select: { id: true },
    });

    if (!page) {
      console.log(
        `ℹ️ Discovery Repository: Page ${pageId} not found or doesn't belong to discovery ${discoveryId}`,
      );
      return false;
    }

    // Delete the page
    await prisma.discoveredPage.delete({
      where: { id: pageId },
    });

    console.log(
      `✅ Discovery Repository: Removed page ${pageId} from discovery ${discoveryId}`,
    );
    return true;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Repository: Failed to remove page:',
      err.message,
    );
    throw new DiscoveryRepositoryError(
      'Failed to remove page from discovery',
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err },
    );
  }
}

/**
 * Find a page by URL within a discovery
 *
 * @param discoveryId - Discovery ID
 * @param url - Page URL to find
 * @returns The discovered page or null if not found
 *
 * @example
 * ```typescript
 * const page = await findPageByUrl('discovery-123', 'https://example.com/about');
 * if (page) {
 *   console.log(`Found page: ${page.title}`);
 * }
 * ```
 */
export async function findPageByUrl(
  discoveryId: string,
  url: string,
): Promise<DiscoveredPage | null> {
  const prisma = getPrismaClient();

  try {
    if (!discoveryId || typeof discoveryId !== 'string') {
      return null;
    }

    if (!url || typeof url !== 'string') {
      return null;
    }

    const page = await prisma.discoveredPage.findFirst({
      where: {
        discoveryId,
        url,
      },
    });

    return page;
  } catch (error) {
    console.error(
      '❌ Discovery Repository: Failed to find page by URL:',
      error,
    );
    throw new DiscoveryRepositoryError(
      `Failed to find page by URL in discovery ${discoveryId}`,
      DiscoveryErrorCode.GET_FAILED,
      {
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

// ============================================================================
// USAGE TRACKING OPERATIONS
// ============================================================================

/**
 * Helper to get the first day of the month for a given date
 *
 * @param date - Date to get month key for
 * @returns First day of the month as Date (e.g., 2025-01-01T00:00:00.000Z)
 *
 * @example
 * ```typescript
 * const monthKey = getMonthKey(new Date('2025-01-15'));
 * // Returns: 2025-01-01T00:00:00.000Z
 * ```
 */
export function getMonthKey(date: Date): Date {
  const monthKey = new Date(date);
  monthKey.setUTCDate(1);
  monthKey.setUTCHours(0, 0, 0, 0);
  return monthKey;
}

/**
 * Get monthly usage record by customerId or guestSessionId
 *
 * @param identifier - Object with either customerId or guestSessionId
 * @param month - Date to get usage for (will be normalized to first day of month)
 * @returns The usage record or null if not found
 * @throws DiscoveryRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * // Get usage for registered user
 * const usage = await getMonthlyUsage(
 *   { customerId: 'customer-123' },
 *   new Date('2025-01-15')
 * );
 *
 * // Get usage for guest user
 * const guestUsage = await getMonthlyUsage(
 *   { guestSessionId: 'session-456' },
 *   new Date()
 * );
 * ```
 */
export async function getMonthlyUsage(
  identifier: { customerId?: string; guestSessionId?: string },
  month: Date,
): Promise<import('@prisma/client').DiscoveryUsage | null> {
  const prisma = getPrismaClient();

  try {
    // Validate identifier - exactly one must be set
    const hasCustomerId = !!identifier.customerId;
    const hasGuestSessionId = !!identifier.guestSessionId;

    if (!hasCustomerId && !hasGuestSessionId) {
      throw new DiscoveryRepositoryError(
        'Either customerId or guestSessionId must be provided',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (hasCustomerId && hasGuestSessionId) {
      throw new DiscoveryRepositoryError(
        'Only one of customerId or guestSessionId should be provided',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    // Normalize to first day of month
    const monthKey = getMonthKey(month);

    // Build where clause using compound unique constraints
    const where = hasCustomerId
      ? { customerId_month: { customerId: identifier.customerId!, month: monthKey } }
      : { guestSessionId_month: { guestSessionId: identifier.guestSessionId!, month: monthKey } };

    const usage = await prisma.discoveryUsage.findUnique({
      where,
    });

    return usage;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Repository: Failed to get monthly usage:',
      err.message,
    );
    throw new DiscoveryRepositoryError(
      'Failed to get monthly usage',
      DiscoveryErrorCode.GET_FAILED,
      { cause: err },
    );
  }
}

/**
 * Get or create usage record (upsert)
 *
 * @param identifier - Object with either customerId or guestSessionId
 * @param month - Date to get/create usage for (will be normalized to first day of month)
 * @returns The usage record (existing or newly created)
 * @throws DiscoveryRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * // Get or create usage for registered user
 * const usage = await getOrCreateUsage(
 *   { customerId: 'customer-123' },
 *   new Date()
 * );
 *
 * // Get or create usage for guest user
 * const guestUsage = await getOrCreateUsage(
 *   { guestSessionId: 'session-456' },
 *   new Date()
 * );
 * ```
 */
export async function getOrCreateUsage(
  identifier: { customerId?: string; guestSessionId?: string },
  month: Date,
): Promise<import('@prisma/client').DiscoveryUsage> {
  const prisma = getPrismaClient();

  try {
    // Validate identifier - exactly one must be set
    const hasCustomerId = !!identifier.customerId;
    const hasGuestSessionId = !!identifier.guestSessionId;

    if (!hasCustomerId && !hasGuestSessionId) {
      throw new DiscoveryRepositoryError(
        'Either customerId or guestSessionId must be provided',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (hasCustomerId && hasGuestSessionId) {
      throw new DiscoveryRepositoryError(
        'Only one of customerId or guestSessionId should be provided',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    // Normalize to first day of month
    const monthKey = getMonthKey(month);

    // Prepare data for upsert
    const data = {
      month: monthKey,
      discoveryCount: 0,
      pagesDiscovered: 0,
      ...(hasCustomerId
        ? { customerId: identifier.customerId }
        : { guestSessionId: identifier.guestSessionId }),
    };

    // Build where clause for unique constraint
    const where = hasCustomerId
      ? { customerId_month: { customerId: identifier.customerId!, month: monthKey } }
      : { guestSessionId_month: { guestSessionId: identifier.guestSessionId!, month: monthKey } };

    // Upsert - create if not exists, return existing if found
    const usage = await prisma.discoveryUsage.upsert({
      where,
      create: data,
      update: {}, // No updates on conflict - just return existing
    });

    return usage;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Repository: Failed to get or create usage:',
      err.message,
    );
    throw new DiscoveryRepositoryError(
      'Failed to get or create usage',
      DiscoveryErrorCode.CREATE_FAILED,
      { cause: err },
    );
  }
}

/**
 * Increment discovery count for a user/session atomically
 *
 * @param identifier - Object with either customerId or guestSessionId
 * @param month - Date to increment usage for (will be normalized to first day of month)
 * @returns Updated usage record with incremented discoveryCount
 * @throws DiscoveryRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * // Increment usage for registered user
 * const usage = await incrementUsage(
 *   { customerId: 'customer-123' },
 *   new Date()
 * );
 * console.log(`New discovery count: ${usage.discoveryCount}`);
 *
 * // Increment usage for guest user
 * const guestUsage = await incrementUsage(
 *   { guestSessionId: 'session-456' },
 *   new Date()
 * );
 * ```
 */
export async function incrementUsage(
  identifier: { customerId?: string; guestSessionId?: string },
  month: Date,
): Promise<import('@prisma/client').DiscoveryUsage> {
  const prisma = getPrismaClient();

  try {
    // Validate identifier - exactly one must be set
    const hasCustomerId = !!identifier.customerId;
    const hasGuestSessionId = !!identifier.guestSessionId;

    if (!hasCustomerId && !hasGuestSessionId) {
      throw new DiscoveryRepositoryError(
        'Either customerId or guestSessionId must be provided',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    if (hasCustomerId && hasGuestSessionId) {
      throw new DiscoveryRepositoryError(
        'Only one of customerId or guestSessionId should be provided',
        DiscoveryErrorCode.INVALID_INPUT,
      );
    }

    // Normalize to first day of month
    const monthKey = getMonthKey(month);

    // Ensure usage record exists
    await getOrCreateUsage(identifier, monthKey);

    // Build where clause
    const where = hasCustomerId
      ? { customerId_month: { customerId: identifier.customerId!, month: monthKey } }
      : { guestSessionId_month: { guestSessionId: identifier.guestSessionId!, month: monthKey } };

    // Atomically increment discoveryCount
    const usage = await prisma.discoveryUsage.update({
      where,
      data: {
        discoveryCount: {
          increment: 1,
        },
      },
    });

    console.log(
      `✅ Discovery Repository: Incremented usage for ${hasCustomerId ? 'customer' : 'guest'} - new count: ${usage.discoveryCount}`,
    );
    return usage;
  } catch (error) {
    // Re-throw DiscoveryRepositoryError as-is
    if (error instanceof DiscoveryRepositoryError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      '❌ Discovery Repository: Failed to increment usage:',
      err.message,
    );
    throw new DiscoveryRepositoryError(
      'Failed to increment usage',
      DiscoveryErrorCode.UPDATE_FAILED,
      { cause: err },
    );
  }
}
