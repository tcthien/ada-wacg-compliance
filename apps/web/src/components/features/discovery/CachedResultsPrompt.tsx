'use client';

import { useEffect } from 'react';
import { useAnalyticsContext } from '@/components/features/analytics';
import type { CacheMetadata } from '@/lib/discovery-api';
import type { DiscoveryCacheEvent } from '@/lib/analytics.types';

/**
 * Props for CachedResultsPrompt component
 */
export interface CachedResultsPromptProps {
  /** Cache metadata with timing information */
  cacheMetadata: CacheMetadata;
  /** Callback when user chooses to use cached results */
  onUseCached: () => void;
  /** Callback when user chooses to refresh */
  onRefresh: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Format relative time from ISO string
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format expiration time
 */
function formatExpirationTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs <= 0) {
    return 'expired';
  }
  if (diffHours < 1) {
    return `${diffMins} minutes`;
  }
  return `${diffHours}h ${diffMins}m`;
}

/**
 * CachedResultsPrompt component
 *
 * Displays a prompt asking the user whether to use cached discovery results
 * or refresh with a new discovery. Shows cache age and expiration time.
 *
 * @example
 * ```tsx
 * <CachedResultsPrompt
 *   cacheMetadata={{
 *     cachedAt: '2024-01-01T00:00:00Z',
 *     expiresAt: '2024-01-02T00:00:00Z',
 *     pageCount: 15
 *   }}
 *   onUseCached={() => console.log('Using cached')}
 *   onRefresh={() => console.log('Refreshing')}
 * />
 * ```
 */
export function CachedResultsPrompt({
  cacheMetadata,
  onUseCached,
  onRefresh,
  isRefreshing = false,
  className = '',
}: CachedResultsPromptProps) {
  const { track } = useAnalyticsContext();

  // Helper to get session ID
  const getSessionId = () =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionId') || '' : '';

  // Calculate cache age in minutes
  const cacheAgeMinutes = Math.floor(
    (Date.now() - new Date(cacheMetadata.cachedAt).getTime()) / (1000 * 60)
  );

  // Track cache prompt shown on mount
  useEffect(() => {
    const event: DiscoveryCacheEvent = {
      event: 'discovery_cache_prompt_shown',
      cache_age_minutes: cacheAgeMinutes,
      cached_page_count: cacheMetadata.pageCount,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  }, [cacheMetadata.pageCount, cacheAgeMinutes, track]);

  const relativeTime = formatRelativeTime(cacheMetadata.cachedAt);
  const expiresIn = formatExpirationTime(cacheMetadata.expiresAt);
  const isExpired = new Date(cacheMetadata.expiresAt) <= new Date();

  return (
    <div
      className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-5 shadow-sm ${className}`}
      role="region"
      aria-label="Cached results available"
    >
      {/* Icon and message */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="bg-blue-100 rounded-full p-2">
            <svg
              className="h-5 w-5 text-blue-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <div className="flex-1">
          {/* Main message with prominent age display */}
          <h4 className="text-base font-semibold text-blue-900 flex items-center gap-2">
            Cached Results Available
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800">
              Cached
            </span>
          </h4>

          <p className="mt-2 text-sm text-gray-700">
            <span className="font-semibold text-blue-900">
              Discovered{' '}
              <time
                dateTime={cacheMetadata.cachedAt}
                className="font-bold"
              >
                {relativeTime}
              </time>
            </span>
            {' '}— Found {cacheMetadata.pageCount}{' '}
            {cacheMetadata.pageCount === 1 ? 'page' : 'pages'}
          </p>

          {/* Expiration notice */}
          {!isExpired && (
            <p className="mt-1.5 text-xs text-blue-600 flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Cache expires in {expiresIn}
            </p>
          )}

          {isExpired && (
            <p className="mt-1.5 text-xs text-amber-700 font-medium flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Cache has expired - recommend refreshing
            </p>
          )}

          {/* Action buttons - stack on mobile */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onUseCached}
              disabled={isRefreshing}
              className={`
                w-full sm:w-auto inline-flex items-center justify-center
                px-5 py-3 sm:py-2.5 text-base sm:text-sm font-semibold rounded-md
                transition-all duration-200
                ${
                  isRefreshing
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                }
              `}
              aria-label={`Use cached results from ${relativeTime}`}
            >
              <svg
                className="mr-2 h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Use Cached Results
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`
                w-full sm:w-auto inline-flex items-center justify-center
                px-5 py-3 sm:py-2.5 text-base sm:text-sm font-semibold rounded-md
                transition-all duration-200
                ${
                  isRefreshing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-blue-700 border-2 border-blue-300 hover:bg-blue-50 hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                }
              `}
              aria-label="Run new discovery to refresh results"
            >
              {isRefreshing ? (
                <>
                  <svg
                    className="animate-spin mr-2 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh Discovery
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
