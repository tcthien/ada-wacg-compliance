/**
 * ErrorDisplay component for user-facing error UI
 *
 * @module error-display
 * @see .claude/specs/customer-ui-ux-improvement/requirements.md - Requirements 2.1, 2.2
 * @see .claude/specs/customer-ui-ux-improvement/design.md - Section: Enhanced ErrorBoundary Approach
 */

'use client';

import * as React from 'react';
import { AlertCircle, WifiOff, Clock, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ErrorType } from '@/lib/error-utils';

export interface ErrorDisplayProps {
  /**
   * Error title to display
   */
  title: string;

  /**
   * Error description or message
   */
  description: string;

  /**
   * Action label for the retry button (e.g., "Retry", "Try Again")
   */
  actionLabel: string;

  /**
   * Callback function when retry button is clicked
   */
  onRetry: () => void;

  /**
   * Optional error type for icon and color selection
   * @default 'unknown'
   */
  errorType?: ErrorType;

  /**
   * Show detailed error information (for development)
   * @default false
   */
  showDetails?: boolean;

  /**
   * Optional error object for displaying technical details
   */
  error?: Error;

  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Get the appropriate icon component based on error type
 */
function getErrorIcon(errorType: ErrorType) {
  switch (errorType) {
    case 'network':
      return WifiOff;
    case 'timeout':
      return Clock;
    case 'server':
      return ServerCrash;
    case 'unknown':
    default:
      return AlertCircle;
  }
}

/**
 * Get the appropriate color classes based on error type
 */
function getErrorColor(errorType: ErrorType) {
  switch (errorType) {
    case 'network':
      return 'text-orange-500';
    case 'timeout':
      return 'text-yellow-500';
    case 'server':
      return 'text-red-500';
    case 'unknown':
    default:
      return 'text-gray-500';
  }
}

/**
 * ErrorDisplay component - Displays user-friendly error messages with retry functionality
 *
 * Features:
 * - Type-specific icons and colors for visual error classification
 * - Accessible error announcements with aria-live
 * - Optional detailed error information for development
 * - Retry action with customizable button label
 *
 * @example
 * ```tsx
 * <ErrorDisplay
 *   title="Connection Error"
 *   description="Please check your internet connection and try again."
 *   actionLabel="Retry"
 *   errorType="network"
 *   onRetry={() => window.location.reload()}
 *   showDetails={process.env.NODE_ENV === 'development'}
 *   error={error}
 * />
 * ```
 */
export function ErrorDisplay({
  title,
  description,
  actionLabel,
  onRetry,
  errorType = 'unknown',
  showDetails = false,
  error,
  className,
}: ErrorDisplayProps) {
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);
  const Icon = getErrorIcon(errorType);
  const iconColor = getErrorColor(errorType);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm',
        className
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Error Icon */}
      <div className="mb-4">
        <Icon className={cn('h-12 w-12', iconColor)} aria-hidden="true" />
      </div>

      {/* Error Title */}
      <h2 className="mb-2 text-xl font-semibold text-gray-900">{title}</h2>

      {/* Error Description */}
      <p className="mb-6 max-w-md text-sm text-gray-600">{description}</p>

      {/* Retry Button */}
      <Button onClick={onRetry} variant="default" size="default">
        {actionLabel}
      </Button>

      {/* Optional Error Details (Development Mode) */}
      {showDetails && error && (
        <div className="mt-6 w-full max-w-2xl">
          <button
            type="button"
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="text-sm text-gray-500 underline hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-expanded={detailsExpanded}
          >
            {detailsExpanded ? 'Hide Details' : 'Show Details'}
          </button>

          {detailsExpanded && (
            <div className="mt-4 rounded-md bg-gray-50 p-4 text-left">
              <div className="mb-2">
                <span className="text-xs font-semibold text-gray-700">
                  Error Type:
                </span>
                <span className="ml-2 text-xs text-gray-600">{errorType}</span>
              </div>

              <div className="mb-2">
                <span className="text-xs font-semibold text-gray-700">
                  Error Name:
                </span>
                <span className="ml-2 text-xs text-gray-600">
                  {error.name}
                </span>
              </div>

              <div className="mb-2">
                <span className="text-xs font-semibold text-gray-700">
                  Error Message:
                </span>
                <p className="mt-1 text-xs text-gray-600">{error.message}</p>
              </div>

              {error.stack && (
                <div>
                  <span className="text-xs font-semibold text-gray-700">
                    Stack Trace:
                  </span>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-gray-600">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
