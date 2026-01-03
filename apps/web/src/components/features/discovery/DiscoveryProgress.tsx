'use client';

import { useId } from 'react';
import type { DiscoveryPhase, DiscoveryStatus } from '@/lib/discovery-api';

/**
 * Props for DiscoveryProgress component
 */
export interface DiscoveryProgressProps {
  /** Current discovery status */
  status: DiscoveryStatus;
  /** Current discovery phase */
  phase: DiscoveryPhase | null;
  /** Number of pages found so far */
  pagesFound: number;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Whether cancel is in progress */
  isCancelling?: boolean;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Phase display configuration
 */
interface PhaseConfig {
  label: string;
  description: string;
}

/**
 * Phase configurations
 */
const PHASE_CONFIG: Record<DiscoveryPhase, PhaseConfig> = {
  SITEMAP: {
    label: 'Checking Sitemap',
    description: 'Looking for sitemap.xml and parsing URLs...',
  },
  NAVIGATION: {
    label: 'Analyzing Navigation',
    description: 'Extracting navigation links from homepage...',
  },
  CRAWLING: {
    label: 'Crawling Pages',
    description: 'Following internal links to discover more pages...',
  },
};

/**
 * Get phase display text
 */
function getPhaseDisplay(
  status: DiscoveryStatus,
  phase: DiscoveryPhase | null
): { label: string; description: string } {
  if (status === 'PENDING') {
    return {
      label: 'Starting Discovery',
      description: 'Preparing to analyze website structure...',
    };
  }

  if (status === 'RUNNING' && phase) {
    return PHASE_CONFIG[phase];
  }

  if (status === 'COMPLETED') {
    return {
      label: 'Discovery Complete',
      description: 'All pages have been discovered.',
    };
  }

  if (status === 'FAILED') {
    return {
      label: 'Discovery Failed',
      description: 'An error occurred during discovery.',
    };
  }

  if (status === 'CANCELLED') {
    return {
      label: 'Discovery Cancelled',
      description: 'Discovery was cancelled by user.',
    };
  }

  return {
    label: 'Discovering Pages',
    description: 'Analyzing website structure...',
  };
}

/**
 * DiscoveryProgress component
 *
 * Displays the current progress of a discovery job with phase information,
 * page count, and cancel button. Includes ARIA live region for screen reader
 * announcements.
 *
 * @example
 * ```tsx
 * <DiscoveryProgress
 *   status="RUNNING"
 *   phase="NAVIGATION"
 *   pagesFound={5}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export function DiscoveryProgress({
  status,
  phase,
  pagesFound,
  onCancel,
  isCancelling = false,
  className = '',
}: DiscoveryProgressProps) {
  const liveRegionId = useId();
  const isActive = status === 'PENDING' || status === 'RUNNING';
  const { label, description } = getPhaseDisplay(status, phase);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 sm:p-6 ${className}`}
    >
      {/* ARIA live region for screen reader announcements */}
      <div
        id={liveRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {`Discovery ${status?.toLowerCase() ?? 'pending'}. ${label}. ${pagesFound} pages found.`}
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center text-center">
        {/* Animated spinner */}
        {isActive && (
          <div className="mb-4">
            <svg
              className="animate-spin h-12 w-12 text-blue-600"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        {/* Status icon for terminal states */}
        {status === 'COMPLETED' && (
          <div className="mb-4 p-3 bg-green-100 rounded-full">
            <svg
              className="h-8 w-8 text-green-600"
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
          </div>
        )}

        {status === 'FAILED' && (
          <div className="mb-4 p-3 bg-red-100 rounded-full">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}

        {status === 'CANCELLED' && (
          <div className="mb-4 p-3 bg-gray-100 rounded-full">
            <svg
              className="h-8 w-8 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
        )}

        {/* Phase label - responsive font size */}
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{label}</h3>

        {/* Phase description - responsive font size */}
        <p className="text-sm sm:text-base text-gray-600 mb-4 px-2 sm:px-0">{description}</p>

        {/* Pages found counter - stacks nicely on mobile */}
        <div className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2 bg-gray-100 rounded-full mb-4 w-full sm:w-auto sm:inline-flex">
          <svg
            className="h-5 w-5 text-gray-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm sm:text-base text-gray-700 font-medium">
            <span className="text-blue-600 font-bold">{pagesFound}</span>{' '}
            {pagesFound === 1 ? 'page' : 'pages'} found
          </span>
        </div>

        {/* Cancel button - full width on mobile */}
        {isActive && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className={`
              w-full sm:w-auto px-6 py-3 sm:py-2 text-base sm:text-sm font-medium rounded-md
              transition-colors duration-200
              ${
                isCancelling
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
              }
            `}
            aria-describedby={isCancelling ? 'cancel-status' : undefined}
          >
            {isCancelling ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
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
                Cancelling...
              </span>
            ) : (
              'Cancel Discovery'
            )}
          </button>
        )}

        {/* Hidden status for screen readers */}
        {isCancelling && (
          <span id="cancel-status" className="sr-only">
            Cancelling discovery, please wait
          </span>
        )}
      </div>
    </div>
  );
}
