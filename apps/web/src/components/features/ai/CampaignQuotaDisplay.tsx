'use client';

/**
 * Campaign Quota Display Component
 *
 * Displays urgency messaging and progress bar based on Early Bird campaign quota
 * Features:
 * - Dynamic progress bar with color-coded urgency levels
 * - Context-appropriate messaging based on remaining quota percentage
 * - Accessible design with ARIA attributes
 * - Responsive styling using Tailwind CSS
 *
 * Urgency Levels (from REQ-3 AC 3):
 * - > 20%: "X slots remaining" (normal - green)
 * - 10-20%: "Limited slots! X remaining" (limited - yellow)
 * - 5-10%: "Almost gone! Only X left" (almost_gone - orange)
 * - < 5%: "Final slots available!" (final - red)
 * - 0%: "Campaign ended" (depleted - gray)
 */

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AlertCircle, Sparkles } from 'lucide-react';

export type UrgencyLevel = 'normal' | 'limited' | 'almost_gone' | 'final' | 'depleted';

interface CampaignQuotaDisplayProps {
  /** Percentage of quota remaining (0-100) */
  remainingPercentage: number;
  /** Number of slots remaining */
  remainingSlots: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Determines urgency level based on remaining quota percentage
 */
function getUrgencyLevel(percentage: number): UrgencyLevel {
  if (percentage <= 0) return 'depleted';
  if (percentage < 5) return 'final';
  if (percentage < 10) return 'almost_gone';
  if (percentage < 20) return 'limited';
  return 'normal';
}

/**
 * Gets urgency-appropriate messaging
 */
function getUrgencyMessage(urgencyLevel: UrgencyLevel, remainingSlots: number): string {
  switch (urgencyLevel) {
    case 'depleted':
      return 'Campaign ended';
    case 'final':
      return 'Final slots available!';
    case 'almost_gone':
      return `Almost gone! Only ${remainingSlots} left`;
    case 'limited':
      return `Limited slots! ${remainingSlots} remaining`;
    case 'normal':
      return `${remainingSlots} slots remaining`;
    default:
      return `${remainingSlots} slots remaining`;
  }
}

/**
 * Gets color classes for urgency level
 */
function getUrgencyColors(urgencyLevel: UrgencyLevel) {
  switch (urgencyLevel) {
    case 'depleted':
      return {
        badge: 'bg-gray-100 text-gray-800 border-gray-300',
        progress: 'bg-gray-200',
        indicator: 'bg-gray-400',
      };
    case 'final':
      return {
        badge: 'bg-red-100 text-red-800 border-red-300 animate-pulse',
        progress: 'bg-red-100',
        indicator: 'bg-red-600',
      };
    case 'almost_gone':
      return {
        badge: 'bg-orange-100 text-orange-800 border-orange-300',
        progress: 'bg-orange-100',
        indicator: 'bg-orange-600',
      };
    case 'limited':
      return {
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        progress: 'bg-yellow-100',
        indicator: 'bg-yellow-600',
      };
    case 'normal':
      return {
        badge: 'bg-green-100 text-green-800 border-green-300',
        progress: 'bg-green-100',
        indicator: 'bg-green-600',
      };
    default:
      return {
        badge: 'bg-gray-100 text-gray-800 border-gray-300',
        progress: 'bg-gray-200',
        indicator: 'bg-gray-400',
      };
  }
}

export function CampaignQuotaDisplay({
  remainingPercentage,
  remainingSlots,
  className,
}: CampaignQuotaDisplayProps) {
  const urgencyLevel = getUrgencyLevel(remainingPercentage);
  const message = getUrgencyMessage(urgencyLevel, remainingSlots);
  const colors = getUrgencyColors(urgencyLevel);

  // Campaign ended state
  if (urgencyLevel === 'depleted') {
    return (
      <div className={cn('rounded-lg p-3 bg-gray-50 border border-gray-300', className)}>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-700">{message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Urgency badge with message */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600 flex-shrink-0" aria-hidden="true" />
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
              colors.badge
            )}
            role="status"
            aria-live="polite"
          >
            {message}
          </span>
        </div>
        <span className="text-xs text-gray-600 font-medium">{remainingPercentage.toFixed(0)}%</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress
          value={remainingPercentage}
          className={cn('h-2.5', colors.progress)}
          aria-label={`Campaign quota: ${remainingPercentage.toFixed(0)}% remaining`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={remainingPercentage}
        />

        {/* Visual indicator for urgency levels */}
        {urgencyLevel === 'final' && (
          <p className="text-xs text-red-700 font-medium flex items-center gap-1">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            Act fast - campaign ending soon!
          </p>
        )}
      </div>
    </div>
  );
}
