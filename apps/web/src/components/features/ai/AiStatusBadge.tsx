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
 * - Enhanced UI for in-progress states with step indicators
 */

import { cn } from '@/lib/utils';
import { Loader2, Clock, CheckCircle2, AlertCircle, Sparkles, Mail } from 'lucide-react';

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
 * Gets the current step number (1-3) based on status
 */
function getStepNumber(status: AiStatus): number {
  switch (status) {
    case 'PENDING':
      return 1;
    case 'DOWNLOADED':
      return 2;
    case 'PROCESSING':
      return 2;
    case 'COMPLETED':
      return 3;
    case 'FAILED':
      return 0;
  }
}

/**
 * Gets the status message text
 */
function getStatusMessage(status: AiStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Allocating AI resources...';
    case 'DOWNLOADED':
      return 'Queued for AI processing...';
    case 'PROCESSING':
      return 'AI is analyzing your results...';
    case 'COMPLETED':
      return 'AI analysis complete';
    case 'FAILED':
      return 'AI analysis unavailable';
  }
}

/**
 * Gets the status subtitle text
 */
function getStatusSubtitle(status: AiStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Preparing Claude for accessibility analysis';
    case 'DOWNLOADED':
      return 'Your scan is in the AI processing queue';
    case 'PROCESSING':
      return 'Claude is generating expert-level insights';
    case 'COMPLETED':
      return 'Expert accessibility insights are ready';
    case 'FAILED':
      return 'AI processing could not be completed';
  }
}

export function AiStatusBadge({ status, email, onRetry, className }: AiStatusBadgeProps) {
  const message = getStatusMessage(status);
  const subtitle = getStatusSubtitle(status);
  const currentStep = getStepNumber(status);
  const isInProgress = status === 'PENDING' || status === 'DOWNLOADED' || status === 'PROCESSING';

  // Compact badge for COMPLETED status
  if (status === 'COMPLETED') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full',
          'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200',
          'text-green-800 shadow-sm',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500">
          <CheckCircle2 className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{message}</span>
          {email && (
            <span className="text-xs text-green-600">Results sent to {email}</span>
          )}
        </div>
      </div>
    );
  }

  // Compact badge for FAILED status
  if (status === 'FAILED') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-3 px-4 py-2.5 rounded-lg',
          'bg-red-50 border border-red-200 text-red-800',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100">
          <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{message}</span>
          <span className="text-xs text-red-600">{subtitle}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              'ml-2 px-3 py-1 text-xs font-medium rounded-md',
              'bg-red-100 hover:bg-red-200 text-red-700',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1',
              'transition-colors'
            )}
            type="button"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Enhanced card for in-progress states
  return (
    <div
      className={cn(
        'rounded-xl border border-purple-200 shadow-sm overflow-hidden',
        'bg-gradient-to-br from-purple-50 to-indigo-50',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/20">
            <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">{message}</h4>
            <p className="text-purple-100 text-xs">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {/* Step 1: Scan Complete */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
              currentStep >= 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            )}>
              {currentStep > 1 ? <CheckCircle2 className="h-3 w-3" /> : '1'}
            </div>
            <span className={cn('text-xs', currentStep >= 1 ? 'text-gray-700' : 'text-gray-400')}>
              Scan
            </span>
          </div>

          <div className={cn('flex-1 h-0.5 rounded', currentStep >= 2 ? 'bg-purple-400' : 'bg-gray-200')} />

          {/* Step 2: AI Processing */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
              currentStep === 2 ? 'bg-purple-500 text-white' :
              currentStep > 2 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            )}>
              {currentStep === 2 ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : currentStep > 2 ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : '2'}
            </div>
            <span className={cn(
              'text-xs font-medium',
              currentStep === 2 ? 'text-purple-700' : currentStep > 2 ? 'text-gray-700' : 'text-gray-400'
            )}>
              AI
            </span>
          </div>

          <div className={cn('flex-1 h-0.5 rounded', currentStep >= 3 ? 'bg-green-400' : 'bg-gray-200')} />

          {/* Step 3: Results Ready */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
              currentStep >= 3 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            )}>
              3
            </div>
            <span className={cn('text-xs', currentStep >= 3 ? 'text-gray-700' : 'text-gray-400')}>
              Ready
            </span>
          </div>
        </div>

        {/* Email notification */}
        {email && (
          <div className="flex items-center gap-2 px-2.5 py-2 bg-white rounded-lg border border-purple-100">
            <Mail className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
            <p className="text-xs text-gray-600">
              We&apos;ll notify you at <span className="font-medium text-purple-700">{email}</span>
            </p>
          </div>
        )}

        {/* Time estimate */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>Usually takes 1-3 minutes</span>
        </div>
      </div>
    </div>
  );
}
