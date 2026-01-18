'use client';

import { cn } from '@/lib/utils';
import { Sparkles, CheckCircle2, BarChart3 } from 'lucide-react';
import { CoverageDisclaimer, type AiStatus } from './CoverageDisclaimer';
import { CriteriaCoverage } from './CriteriaCoverage';

/**
 * WCAG conformance level type
 */
type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * Props for ScanCoverageCard component
 */
export interface ScanCoverageCardProps {
  /** Coverage percentage (57 or 80) */
  coveragePercentage: number;
  /** Number of WCAG criteria checked */
  criteriaChecked: number;
  /** Total WCAG criteria for the conformance level */
  criteriaTotal: number;
  /** Number of passed accessibility checks */
  passedChecks: number;
  /** Whether the scan is AI-enhanced */
  isAiEnhanced: boolean;
  /** WCAG conformance level */
  wcagLevel: WcagLevel;
  /** AI processing status */
  aiStatus?: AiStatus;
  /** Breakdown of criteria by status */
  breakdown?: {
    criteriaWithIssues: number;
    criteriaPassed: number;
    criteriaNotTestable: number;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * AI Enhanced Badge for the header
 */
function AiEnhancedHeaderBadge() {
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
 * Metric Card component for displaying individual metrics
 */
interface MetricCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sublabel?: string;
  className?: string;
}

function MetricCard({ icon, value, label, sublabel, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg',
        'bg-slate-50 dark:bg-slate-800/50',
        className
      )}
    >
      <div className="flex-shrink-0 text-slate-500 dark:text-slate-400">
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {value}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {label}
        </div>
        {sublabel && (
          <div className="text-xs text-slate-500 dark:text-slate-500">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ScanCoverageCard Component
 *
 * Main container displaying all trust indicators in a single prominent card.
 * Shows coverage percentage, criteria coverage, and passed checks with
 * appropriate styling for standard vs AI-enhanced scans.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
export function ScanCoverageCard({
  coveragePercentage,
  criteriaChecked,
  criteriaTotal,
  passedChecks,
  isAiEnhanced,
  wcagLevel,
  aiStatus,
  breakdown,
  className,
}: ScanCoverageCardProps) {
  // Determine if AI enhancement is fully completed
  const isAiCompleted = isAiEnhanced && aiStatus === 'COMPLETED';

  // Format coverage percentage display
  const coverageDisplay = isAiCompleted ? '75-85%' : `${coveragePercentage}%`;

  return (
    <div
      className={cn(
        'border rounded-lg bg-white dark:bg-slate-900',
        isAiCompleted
          ? 'border-purple-200 dark:border-purple-800'
          : 'border-slate-200 dark:border-slate-700',
        className
      )}
      role="region"
      aria-label="Scan coverage summary"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <BarChart3
            className={cn(
              'h-5 w-5',
              isAiCompleted
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-slate-600 dark:text-slate-400'
            )}
            aria-hidden="true"
          />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Scan Coverage
          </h3>
        </div>
        {isAiCompleted && <AiEnhancedHeaderBadge />}
      </div>

      {/* Metrics Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Coverage Percentage */}
          <MetricCard
            icon={
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                  isAiCompleted
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                )}
              >
                {isAiCompleted ? '~80' : '57'}
              </div>
            }
            value={coverageDisplay}
            label="Detection Coverage"
            sublabel={isAiCompleted ? 'AI-enhanced' : 'Standard'}
          />

          {/* Criteria Coverage - use the interactive component */}
          <div className="flex items-center justify-center">
            <CriteriaCoverage
              criteriaChecked={criteriaChecked}
              criteriaTotal={criteriaTotal}
              criteriaWithIssues={breakdown?.criteriaWithIssues}
              criteriaPassed={breakdown?.criteriaPassed}
              criteriaNotTestable={breakdown?.criteriaNotTestable}
              wcagLevel={wcagLevel}
            />
          </div>

          {/* Passed Checks */}
          <MetricCard
            icon={
              <CheckCircle2 className="h-8 w-8 text-green-500" aria-hidden="true" />
            }
            value={passedChecks.toLocaleString()}
            label="Passed Checks"
            sublabel="Accessibility rules"
          />
        </div>

        {/* Coverage Disclaimer */}
        <CoverageDisclaimer
          isAiEnhanced={isAiEnhanced}
          aiStatus={aiStatus}
        />
      </div>
    </div>
  );
}
