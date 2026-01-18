'use client';

import { cn } from '@/lib/utils';
import { Sparkles, CheckCircle2, BarChart3, Layers } from 'lucide-react';

/**
 * WCAG conformance level type
 */
type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * Props for BatchCoverageCard component
 */
export interface BatchCoverageCardProps {
  /** Average coverage percentage across all scans */
  averageCoveragePercentage: number;
  /** Total criteria checked across batch */
  totalCriteriaChecked: number;
  /** Total WCAG criteria for the conformance level */
  totalCriteriaTotal: number;
  /** Number of AI-enhanced scans */
  aiEnhancedCount: number;
  /** Number of standard scans */
  standardCount: number;
  /** Whether any scans are AI-enhanced */
  hasAiEnhanced: boolean;
  /** Total passed checks across all scans */
  passedChecks: number;
  /** Number of URLs scanned */
  urlsScanned: number;
  /** WCAG conformance level */
  wcagLevel: WcagLevel;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AI Enhanced Badge for the header
 */
function AiEnhancedHeaderBadge({ aiCount, totalCount }: { aiCount: number; totalCount: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'bg-gradient-to-r from-purple-600 to-blue-600 text-white',
        'text-xs font-medium'
      )}
      role="status"
      aria-label={`${aiCount} of ${totalCount} scans AI-enhanced`}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{aiCount} AI-Enhanced</span>
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
 * BatchCoverageCard Component
 *
 * Displays aggregated coverage metrics for batch scan results.
 * Shows average coverage percentage, criteria coverage, and passed checks
 * with appropriate styling for mixed standard/AI-enhanced batches.
 *
 * Requirements: Enhanced Trust Indicators for batch results
 */
export function BatchCoverageCard({
  averageCoveragePercentage,
  totalCriteriaChecked,
  totalCriteriaTotal,
  aiEnhancedCount,
  standardCount,
  hasAiEnhanced,
  passedChecks,
  urlsScanned,
  wcagLevel,
  className,
}: BatchCoverageCardProps) {
  // Format coverage percentage display
  const coverageDisplay = hasAiEnhanced
    ? `${averageCoveragePercentage}%`
    : `${averageCoveragePercentage}%`;

  // Calculate scan type distribution
  const totalScans = aiEnhancedCount + standardCount;
  const scanTypeLabel = hasAiEnhanced
    ? `${aiEnhancedCount} AI + ${standardCount} Standard`
    : 'Standard';

  return (
    <div
      className={cn(
        'border rounded-lg bg-white dark:bg-slate-900',
        hasAiEnhanced
          ? 'border-purple-200 dark:border-purple-800'
          : 'border-slate-200 dark:border-slate-700',
        className
      )}
      role="region"
      aria-label="Batch coverage summary"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <BarChart3
            className={cn(
              'h-5 w-5',
              hasAiEnhanced
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-slate-600 dark:text-slate-400'
            )}
            aria-hidden="true"
          />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Batch Coverage
          </h3>
        </div>
        {hasAiEnhanced && (
          <AiEnhancedHeaderBadge aiCount={aiEnhancedCount} totalCount={totalScans} />
        )}
      </div>

      {/* Metrics Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Average Coverage Percentage */}
          <MetricCard
            icon={
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                  hasAiEnhanced
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                )}
              >
                {averageCoveragePercentage}
              </div>
            }
            value={coverageDisplay}
            label="Avg. Detection"
            sublabel={scanTypeLabel}
          />

          {/* Criteria Coverage */}
          <MetricCard
            icon={
              <Layers className="h-8 w-8 text-blue-500" aria-hidden="true" />
            }
            value={`${totalCriteriaChecked} of ${totalCriteriaTotal}`}
            label="Criteria Checked"
            sublabel={`WCAG ${wcagLevel}`}
          />

          {/* URLs Scanned */}
          <MetricCard
            icon={
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {urlsScanned}
              </div>
            }
            value={urlsScanned.toLocaleString()}
            label="URLs Scanned"
            sublabel="Completed"
          />

          {/* Passed Checks */}
          <MetricCard
            icon={
              <CheckCircle2 className="h-8 w-8 text-green-500" aria-hidden="true" />
            }
            value={passedChecks.toLocaleString()}
            label="Passed Checks"
            sublabel="Total across batch"
          />
        </div>

        {/* Coverage Disclaimer */}
        <div
          className={cn(
            'p-4 rounded-lg text-sm',
            hasAiEnhanced
              ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
          )}
        >
          <p className={cn(
            hasAiEnhanced
              ? 'text-purple-800 dark:text-purple-200'
              : 'text-amber-800 dark:text-amber-200'
          )}>
            {hasAiEnhanced ? (
              <>
                This batch includes {aiEnhancedCount} AI-enhanced scan{aiEnhancedCount !== 1 ? 's' : ''} with
                approximately 75-85% issue detection coverage.{' '}
                {standardCount > 0 && (
                  <>Standard scans ({standardCount}) detect approximately 57% of WCAG issues.</>
                )}
              </>
            ) : (
              <>
                Automated testing detects approximately 57% of WCAG issues.
                Manual review is recommended for comprehensive compliance assessment.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
