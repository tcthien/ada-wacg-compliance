'use client';

import { cn } from '@/lib/utils';
import { Sparkles, Info, Clock, AlertTriangle } from 'lucide-react';

/**
 * AI scan status values
 */
export type AiStatus = 'PENDING' | 'DOWNLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Props for CoverageDisclaimer component
 */
export interface CoverageDisclaimerProps {
  /** Whether AI enhancement was enabled for this scan */
  isAiEnhanced?: boolean;
  /** Current AI processing status */
  aiStatus?: AiStatus;
  /** Actual computed coverage percentage (optional, uses default if not provided) */
  coveragePercentage?: number;
  /** Number of criteria checked out of total */
  criteriaChecked?: number;
  /** Total criteria for the conformance level */
  criteriaTotal?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AI Enhanced Badge
 * Shows when scan is AI-enhanced with COMPLETED status
 */
function AiEnhancedBadge() {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'bg-gradient-to-r from-purple-600 to-blue-600 text-white',
        'text-xs font-medium'
      )}
      role="status"
      aria-label="AI-enhanced scan"
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      <span>AI-Enhanced</span>
    </span>
  );
}

/**
 * Info Icon component
 */
function InfoIcon({ className }: { className?: string }) {
  return (
    <Info
      className={cn('h-5 w-5 shrink-0', className)}
      aria-hidden="true"
    />
  );
}

/**
 * Get the appropriate message and styling based on AI status
 */
function getAiStatusMessage(aiStatus: AiStatus | undefined): {
  note: string | null;
  icon: typeof Clock | typeof AlertTriangle | null;
  iconClass: string;
} {
  switch (aiStatus) {
    case 'PENDING':
    case 'DOWNLOADED':
    case 'PROCESSING':
      return {
        note: 'AI enhancement is being processed. Coverage will improve to 75-85% when complete.',
        icon: Clock,
        iconClass: 'text-blue-500',
      };
    case 'FAILED':
      return {
        note: 'AI enhancement was not applied due to a processing error.',
        icon: AlertTriangle,
        iconClass: 'text-amber-500',
      };
    default:
      return {
        note: null,
        icon: null,
        iconClass: '',
      };
  }
}

/**
 * CoverageDisclaimer Component
 *
 * Displays coverage percentage with differentiation for standard vs AI-enhanced scans.
 * - Standard scans: 57% coverage with amber styling
 * - AI-enhanced scans (COMPLETED): 75-85% coverage with purple gradient styling
 * - AI processing: 57% with note about pending improvement
 * - AI failed: 57% with note about failure
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export function CoverageDisclaimer({
  isAiEnhanced = false,
  aiStatus,
  coveragePercentage: providedCoverage,
  criteriaChecked,
  criteriaTotal,
  className,
}: CoverageDisclaimerProps) {
  // Determine if AI enhancement is fully completed
  const isAiCompleted = isAiEnhanced && aiStatus === 'COMPLETED';

  // Get AI status message if applicable
  const { note: aiStatusNote, icon: StatusIcon, iconClass } = getAiStatusMessage(
    isAiEnhanced ? aiStatus : undefined
  );

  // Use actual coverage percentage if provided, otherwise use defaults
  const displayPercentage = providedCoverage !== undefined
    ? `${Math.round(providedCoverage)}%`
    : (isAiCompleted ? '75-85%' : '57%');

  // Format criteria information if available
  const criteriaInfo = (criteriaChecked !== undefined && criteriaTotal !== undefined)
    ? ` (${criteriaChecked} of ${criteriaTotal} criteria)`
    : '';

  const scanType = isAiCompleted ? 'AI-enhanced' : 'Automated';

  if (isAiCompleted) {
    // AI-enhanced styling with purple gradient
    return (
      <div
        className={cn(
          'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30',
          'border border-purple-200 dark:border-purple-800',
          'rounded-lg p-4',
          className
        )}
        role="region"
        aria-label="Scan coverage information"
      >
        <div className="flex gap-3">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                Enhanced Coverage
              </p>
              <AiEnhancedBadge />
            </div>
            <p className="text-sm text-purple-800 dark:text-purple-200">
              {scanType} testing covers approximately{' '}
              <strong className="font-semibold">{displayPercentage}</strong> of WCAG criteria{criteriaInfo}.
              Manual testing by accessibility experts is recommended for complete compliance verification.
            </p>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
              This scan uses AI-powered analysis to identify additional accessibility issues
              beyond standard automated testing, including context-aware evaluations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Standard styling with amber theme
  return (
    <div
      className={cn(
        'bg-amber-50 dark:bg-amber-950/20',
        'border border-amber-200 dark:border-amber-900',
        'rounded-lg p-4',
        className
      )}
      role="region"
      aria-label="Scan coverage information"
    >
      <div className="flex gap-3">
        <InfoIcon className="text-amber-600 dark:text-amber-500 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Important:</strong> {scanType} testing covers approximately{' '}
            <strong>{displayPercentage}</strong> of WCAG criteria{criteriaInfo}. Manual testing by accessibility
            experts is recommended for complete compliance verification.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
            This tool uses industry-standard automated testing (axe-core) to
            identify common accessibility issues. However, many WCAG success
            criteria require human judgment and cannot be fully automated.
          </p>

          {/* AI status note for pending/processing/failed states */}
          {aiStatusNote && StatusIcon && (
            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
              <StatusIcon className={cn('h-4 w-4 shrink-0 mt-0.5', iconClass)} aria-hidden="true" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {aiStatusNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
