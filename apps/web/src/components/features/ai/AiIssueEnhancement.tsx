'use client';

/**
 * AI Issue Enhancement Component
 *
 * Displays AI-enhanced accessibility issue analysis with:
 * - Plain-language explanation of the issue
 * - Fix suggestion with code examples
 * - Priority score (1-10) with visual indicator
 * - Skeleton loader for pending AI analysis
 * - AI badge to distinguish from standard content
 *
 * Requirements: REQ-6 AC 3-4
 */

import { cn } from '@/lib/utils';
import { formatAiContent } from '@/lib/text-formatter';
import { Sparkles } from 'lucide-react';

/**
 * AI enhancement data for a single issue
 */
export interface AiIssueData {
  /** Unique identifier matching the base issue ID */
  issueId: string;
  /** Plain-language explanation of the accessibility issue */
  explanation: string;
  /** Actionable fix suggestion with code examples */
  fixSuggestion: string;
  /** Priority score from 1 (low) to 10 (critical) */
  priority: number;
}

interface AiIssueEnhancementProps {
  /** AI enhancement data for this issue */
  data?: AiIssueData | null | undefined;
  /** Whether AI analysis is still loading */
  isLoading?: boolean | undefined;
  /** Additional CSS classes */
  className?: string | undefined;
}

/**
 * Gets the priority label and styling based on score
 */
function getPriorityInfo(priority: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  if (priority >= 8) {
    return {
      label: 'Critical',
      color: 'text-red-800',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-300',
    };
  }
  if (priority >= 6) {
    return {
      label: 'High',
      color: 'text-orange-800',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-300',
    };
  }
  if (priority >= 4) {
    return {
      label: 'Medium',
      color: 'text-yellow-800',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-300',
    };
  }
  return {
    label: 'Low',
    color: 'text-green-800',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
  };
}

/**
 * Skeleton loader component for pending AI analysis
 */
function AiLoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" role="status" aria-live="polite">
      {/* Header skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 bg-purple-200 rounded"></div>
        <div className="h-4 w-32 bg-purple-200 rounded"></div>
      </div>

      {/* Explanation skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-200 rounded"></div>
        <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
      </div>

      {/* Fix suggestion skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-3/4 bg-gray-200 rounded"></div>
        <div className="h-16 w-full bg-gray-100 rounded border border-gray-200"></div>
      </div>

      <span className="sr-only">AI insights loading...</span>
    </div>
  );
}

export function AiIssueEnhancement({
  data,
  isLoading = false,
  className,
}: AiIssueEnhancementProps) {
  // Show loading state when AI is pending
  if (isLoading || !data) {
    return (
      <div
        className={cn(
          'mt-4 p-4 rounded-lg border',
          'bg-gradient-to-r from-purple-50/50 to-blue-50/50',
          'border-purple-200/50',
          className
        )}
      >
        <AiLoadingSkeleton />
      </div>
    );
  }

  const priorityInfo = getPriorityInfo(data.priority);

  return (
    <div
      className={cn(
        'mt-4 p-4 rounded-lg border',
        'bg-gradient-to-r from-purple-50 to-blue-50',
        'border-purple-200',
        className
      )}
    >
      {/* Header with AI badge and priority */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-purple-900">
            AI-Enhanced Analysis
          </span>
        </div>

        {/* Priority indicator */}
        <div
          className={cn(
            'flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium',
            priorityInfo.bgColor,
            priorityInfo.borderColor,
            priorityInfo.color
          )}
          role="status"
          aria-label={`Priority: ${priorityInfo.label} (${data.priority} out of 10)`}
        >
          <span className="font-bold">{data.priority}/10</span>
          <span>{priorityInfo.label}</span>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          What This Means
        </h4>
        <div className="text-sm text-gray-700 leading-relaxed">
          {formatAiContent(data.explanation)}
        </div>
      </div>

      {/* Fix Suggestion */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          How to Fix It
        </h4>
        <div className="text-sm text-gray-700 leading-relaxed">
          {formatAiContent(data.fixSuggestion)}
        </div>
      </div>

      {/* AI Attribution */}
      <div className="mt-3 pt-3 border-t border-purple-200">
        <p className="text-xs text-gray-600 italic">
          Generated by AI - Review recommendations carefully and test thoroughly
        </p>
      </div>
    </div>
  );
}
