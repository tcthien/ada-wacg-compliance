/**
 * Discovery API Client
 *
 * Centralized API client for website skeleton discovery operations.
 * Uses the same patterns as lib/api.ts with credentials for session management.
 */

import { env } from './env';
import type {
  CreateDiscoveryInput,
  CreateDiscoveryResponse,
  GetDiscoveryResponse,
  CancelDiscoveryResponse,
  AddUrlInput,
  AddUrlResponse,
  AddUrlsInput,
  AddUrlsResponse,
  RemoveUrlResponse,
} from './discovery-api.types';

/**
 * API response wrapper type
 * All API responses follow this format
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Generic API client function for discovery endpoints
 * Unwraps the { success, data } response format from the API
 */
async function discoveryApiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${env.apiUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include', // For session cookies
  });

  const json: ApiResponse<T> = await response.json().catch(() => ({}));

  if (!response.ok || !json.success) {
    const error = new Error(
      json.error || json.message || `API error: ${response.status}`
    );
    // Attach error code if available
    (error as Error & { code?: string | undefined }).code = json.code;
    throw error;
  }

  // Unwrap the data property from the API response
  return json.data as T;
}

/**
 * Discovery API client
 */
export const discoveryApi = {
  /**
   * Create a new discovery job
   *
   * @param input - Discovery creation parameters
   * @returns Created discovery data
   *
   * @example
   * ```ts
   * const { discovery } = await discoveryApi.create({
   *   homepageUrl: 'https://example.com',
   *   mode: 'AUTO',
   *   maxPages: 10,
   *   maxDepth: 1
   * });
   * ```
   */
  create: (input: CreateDiscoveryInput): Promise<CreateDiscoveryResponse> =>
    discoveryApiClient<CreateDiscoveryResponse>('/api/v1/discoveries', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /**
   * Get discovery status and results
   *
   * @param id - Discovery ID
   * @param refresh - Force refresh from database, bypassing cache
   * @returns Discovery data with pages and cache metadata
   *
   * @example
   * ```ts
   * const { discovery, cacheMetadata } = await discoveryApi.get('discovery-id');
   * console.log(`Found ${discovery.pages.length} pages`);
   * ```
   */
  get: (id: string, refresh?: boolean): Promise<GetDiscoveryResponse> => {
    const params = new URLSearchParams();
    if (refresh) {
      params.set('refresh', 'true');
    }
    const queryString = params.toString();
    return discoveryApiClient<GetDiscoveryResponse>(
      `/api/v1/discoveries/${id}${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Cancel a running discovery job
   *
   * @param id - Discovery ID
   * @returns Updated discovery data
   *
   * @example
   * ```ts
   * const { discovery } = await discoveryApi.cancel('discovery-id');
   * console.log(`Status: ${discovery.status}`); // 'CANCELLED'
   * ```
   */
  cancel: (id: string): Promise<CancelDiscoveryResponse> =>
    discoveryApiClient<CancelDiscoveryResponse>(`/api/v1/discoveries/${id}`, {
      method: 'DELETE',
    }),

  /**
   * Add a single manual URL to a discovery
   *
   * @param discoveryId - Discovery ID
   * @param input - URL to add
   * @returns Result with added page data
   *
   * @example
   * ```ts
   * const result = await discoveryApi.addUrl('discovery-id', {
   *   url: 'https://example.com/about'
   * });
   * if (result.success) {
   *   console.log(`Added page: ${result.page?.title}`);
   * }
   * ```
   */
  addUrl: (discoveryId: string, input: AddUrlInput): Promise<AddUrlResponse> =>
    discoveryApiClient<AddUrlResponse>(
      `/api/v1/discoveries/${discoveryId}/pages`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    ),

  /**
   * Add multiple manual URLs to a discovery (batch operation)
   *
   * @param discoveryId - Discovery ID
   * @param input - Array of URLs to add
   * @returns Results for each URL with success/failure counts
   *
   * @example
   * ```ts
   * const result = await discoveryApi.addUrls('discovery-id', {
   *   urls: ['https://example.com/about', 'https://example.com/contact']
   * });
   * console.log(`Added ${result.successCount} of ${result.results.length} URLs`);
   * ```
   */
  addUrls: (
    discoveryId: string,
    input: AddUrlsInput
  ): Promise<AddUrlsResponse> =>
    discoveryApiClient<AddUrlsResponse>(
      `/api/v1/discoveries/${discoveryId}/pages/batch`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    ),

  /**
   * Remove a manual URL from a discovery
   *
   * @param discoveryId - Discovery ID
   * @param pageId - Page ID to remove
   * @returns Result indicating success/failure
   *
   * @example
   * ```ts
   * const result = await discoveryApi.removeUrl('discovery-id', 'page-id');
   * if (result.success) {
   *   console.log('URL removed successfully');
   * }
   * ```
   */
  removeUrl: (
    discoveryId: string,
    pageId: string
  ): Promise<RemoveUrlResponse> =>
    discoveryApiClient<RemoveUrlResponse>(
      `/api/v1/discoveries/${discoveryId}/pages/${pageId}`,
      {
        method: 'DELETE',
      }
    ),
};

/**
 * Re-export types for convenience
 */
export type {
  CreateDiscoveryInput,
  CreateDiscoveryResponse,
  GetDiscoveryResponse,
  CancelDiscoveryResponse,
  AddUrlInput,
  AddUrlResponse,
  AddUrlsInput,
  AddUrlsResponse,
  RemoveUrlResponse,
  Discovery,
  DiscoveredPage,
  DiscoveryWithPages,
  DiscoveryStatus,
  DiscoveryMode,
  DiscoveryPhase,
  PageSource,
  CacheMetadata,
  UsageLimitResult,
  DiscoveryErrorCode,
  DiscoveryApiError,
} from './discovery-api.types';

export {
  isDiscoveryStatus,
  isDiscoveryMode,
  isDiscoveryPhase,
  isPageSource,
  isTerminalStatus,
  isInProgressStatus,
} from './discovery-api.types';
