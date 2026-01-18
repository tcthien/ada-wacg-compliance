'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * WCAG conformance level type
 */
type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * Props for CriteriaCoverage component
 */
export interface CriteriaCoverageProps {
  /** Number of WCAG criteria checked */
  criteriaChecked: number;
  /** Total WCAG criteria for the conformance level */
  criteriaTotal: number;
  /** Number of criteria with issues found (optional breakdown) */
  criteriaWithIssues?: number;
  /** Number of criteria that passed (optional breakdown) */
  criteriaPassed?: number;
  /** Number of criteria not testable by automation (optional breakdown) */
  criteriaNotTestable?: number;
  /** WCAG conformance level */
  wcagLevel: WcagLevel;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get the full WCAG level name
 */
function getWcagLevelName(level: WcagLevel): string {
  switch (level) {
    case 'A':
      return 'Level A';
    case 'AA':
      return 'Level AA';
    case 'AAA':
      return 'Level AAA';
    default:
      return `Level ${level}`;
  }
}

/**
 * CriteriaCoverage Component
 *
 * Displays WCAG criteria coverage in "X of Y criteria checked" format
 * with a tooltip showing the breakdown of criteria by status.
 *
 * Requirements: 2.1, 2.2, 2.6
 */
export function CriteriaCoverage({
  criteriaChecked,
  criteriaTotal,
  criteriaWithIssues = 0,
  criteriaPassed = 0,
  criteriaNotTestable = 0,
  wcagLevel,
  className,
}: CriteriaCoverageProps) {
  // Calculate coverage percentage for progress indicator
  const coveragePercent = criteriaTotal > 0
    ? Math.round((criteriaChecked / criteriaTotal) * 100)
    : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2',
              'bg-slate-100 dark:bg-slate-800',
              'hover:bg-slate-200 dark:hover:bg-slate-700',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'transition-colors duration-200',
              className
            )}
            aria-label={`${criteriaChecked} of ${criteriaTotal} WCAG ${wcagLevel} criteria checked, ${coveragePercent}% coverage. Click for details.`}
          >
            {/* Progress indicator */}
            <div
              className="relative h-8 w-8 rounded-full"
              role="progressbar"
              aria-valuenow={coveragePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${coveragePercent}% criteria coverage`}
            >
              <svg
                className="h-8 w-8 -rotate-90 transform"
                viewBox="0 0 36 36"
                aria-hidden="true"
              >
                {/* Background circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-slate-300 dark:stroke-slate-600"
                  strokeWidth="3"
                />
                {/* Progress circle */}
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-blue-600 dark:stroke-blue-400"
                  strokeWidth="3"
                  strokeDasharray={`${coveragePercent} 100`}
                  strokeLinecap="round"
                />
              </svg>
              {/* Center text */}
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                aria-hidden="true"
              >
                {coveragePercent}%
              </span>
            </div>

            {/* Text content */}
            <div className="text-left">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {criteriaChecked} of {criteriaTotal}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Criteria Checked
              </div>
            </div>
          </button>
        </TooltipTrigger>

        <TooltipContent
          className="max-w-xs p-4"
          sideOffset={8}
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                WCAG 2.1 {getWcagLevelName(wcagLevel)} Coverage
              </h4>
            </div>

            {/* Breakdown list */}
            <ul className="space-y-2 text-sm" aria-label="Criteria breakdown">
              {criteriaWithIssues > 0 && (
                <li className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-red-500"
                    aria-hidden="true"
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    {criteriaWithIssues} criteria with issues found
                  </span>
                </li>
              )}
              {criteriaPassed > 0 && (
                <li className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-green-500"
                    aria-hidden="true"
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    {criteriaPassed} criteria passed
                  </span>
                </li>
              )}
              {criteriaNotTestable > 0 && (
                <li className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-slate-400"
                    aria-hidden="true"
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    {criteriaNotTestable} criteria not testable by automation
                  </span>
                </li>
              )}
            </ul>

            {/* Summary */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Total: {criteriaChecked} of {criteriaTotal} criteria checked
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
