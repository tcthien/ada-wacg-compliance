'use client';

/**
 * AI Status Badge Component
 *
 * Displays AI processing status with appropriate icon and message
 * Handles all AI processing states from PENDING to COMPLETED/FAILED
 * Features:
 * - State-specific icons (spinner, clock, checkmark, error)
 * - Status messages matching processing state
 * - Email delivery confirmation text
 * - Retry option for FAILED state
 */

import { cn } from '@/lib/utils';
import { Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

type AiStatus = 'PENDING' | 'DOWNLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface AiStatusBadgeProps {
  /** Current AI processing status */
  status: AiStatus;
  /** Email address for delivery confirmation (shown when status is COMPLETED) */
  email?: string;
  /** Callback for retry action (shown when status is FAILED) */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Gets the appropriate icon component for the status
 */
function getStatusIcon(status: AiStatus) {
  switch (status) {
    case 'PENDING':
      return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
    case 'DOWNLOADED':
      return <Clock className="h-4 w-4" aria-hidden="true" />;
    case 'PROCESSING':
      return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
    case 'COMPLETED':
      return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
    case 'FAILED':
      return <AlertCircle className="h-4 w-4" aria-hidden="true" />;
  }
}

/**
 * Gets the status message text
 */
function getStatusMessage(status: AiStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Allocating resources...';
    case 'DOWNLOADED':
      return 'Queued for processing...';
    case 'PROCESSING':
      return 'AI analyzing...';
    case 'COMPLETED':
      return 'AI analysis complete';
    case 'FAILED':
      return 'AI unavailable';
  }
}

/**
 * Gets the styling classes for the status
 */
function getStatusStyles(status: AiStatus): string {
  switch (status) {
    case 'PENDING':
      return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'DOWNLOADED':
      return 'bg-purple-50 border-purple-200 text-purple-800';
    case 'PROCESSING':
      return 'bg-purple-50 border-purple-200 text-purple-800';
    case 'COMPLETED':
      return 'bg-green-50 border-green-200 text-green-800';
    case 'FAILED':
      return 'bg-red-50 border-red-200 text-red-800';
  }
}

export function AiStatusBadge({ status, email, onRetry, className }: AiStatusBadgeProps) {
  const icon = getStatusIcon(status);
  const message = getStatusMessage(status);
  const styles = getStatusStyles(status);

  return (
    <div
      className={cn(
        'inline-flex flex-col gap-2 px-3 py-2 rounded-lg border',
        styles,
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Status badge */}
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{message}</span>
      </div>

      {/* Email confirmation for COMPLETED status */}
      {status === 'COMPLETED' && email && (
        <p className="text-xs opacity-90">
          Results sent to <strong>{email}</strong>
        </p>
      )}

      {/* Retry option for FAILED status */}
      {status === 'FAILED' && onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'text-xs font-medium underline hover:no-underline',
            'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded',
            'transition-all'
          )}
          type="button"
        >
          Request retry
        </button>
      )}

      {/* Email delivery note for in-progress states (REQ-6 AC 5) */}
      {(status === 'PENDING' || status === 'DOWNLOADED' || status === 'PROCESSING') && (
        <p className="text-xs opacity-90">
          {email ? (
            <>Results will be sent to <strong>{email}</strong></>
          ) : (
            'Results will be delivered via email'
          )}
        </p>
      )}
    </div>
  );
}
