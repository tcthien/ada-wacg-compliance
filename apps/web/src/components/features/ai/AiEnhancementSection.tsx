'use client';

/**
 * AI Enhancement Section Component
 *
 * Displays AI-powered analysis option for scans during Early Bird campaign
 * Features:
 * - Campaign status with urgency styling based on quota
 * - Enable/disable checkbox for AI analysis
 * - Email requirement notification
 * - Depleted state handling (campaign ended)
 */

import { useCampaignStatus } from '@/hooks/useCampaignStatus';
import { cn } from '@/lib/utils';
import { Sparkles, Mail, AlertCircle } from 'lucide-react';

interface AiEnhancementSectionProps {
  /** Whether AI enhancement is currently enabled */
  enabled: boolean;
  /** Callback when AI enhancement checkbox changes */
  onEnabledChange: (enabled: boolean) => void;
  /** Callback when email becomes required (for parent to show/validate email field) */
  onEmailRequired?: (required: boolean) => void;
  /** Whether to pre-select the AI checkbox (e.g., from Early Bird landing page) */
  preSelected?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps API urgency level to UI urgency level
 */
function mapUrgencyLevel(urgencyLevel: string | undefined): 'high' | 'medium' | 'low' {
  if (!urgencyLevel) return 'low';

  switch (urgencyLevel) {
    case 'depleted':
    case 'final':
    case 'almost_gone':
      return 'high';
    case 'limited':
      return 'medium';
    case 'normal':
    default:
      return 'low';
  }
}

/**
 * Formats the campaign status message
 */
function getCampaignStatusMessage(status: {
  active: boolean;
  slotsRemaining?: number;
  percentRemaining?: number;
  urgencyLevel?: string;
  message?: string;
} | null): string {
  if (!status || !status.active) return 'Campaign ended';

  // Use API message if available, otherwise construct one
  if (status.message) return status.message;

  if (status.slotsRemaining !== undefined) {
    return `${status.slotsRemaining} slots remaining`;
  }

  return 'Available now';
}

export function AiEnhancementSection({
  enabled,
  onEnabledChange,
  onEmailRequired,
  preSelected = false,
  className,
}: AiEnhancementSectionProps) {
  const { status, isLoading, error } = useCampaignStatus();

  // Don't show section if campaign is inactive or there's an error
  if (!isLoading && (!status?.active || error)) {
    return null;
  }

  // Handle checkbox change
  const handleCheckboxChange = (checked: boolean) => {
    onEnabledChange(checked);
    onEmailRequired?.(checked);
  };

  // Pre-select if requested (e.g., from Early Bird landing page)
  if (preSelected && !enabled && status?.active && !isLoading) {
    handleCheckboxChange(true);
  }

  const urgency = mapUrgencyLevel(status?.urgencyLevel);
  const statusMessage = getCampaignStatusMessage(status);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-blue-50', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 bg-gray-200 rounded"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Campaign ended state
  if (!status?.active) {
    return (
      <div className={cn('border border-gray-300 rounded-lg p-4 bg-gray-50', className)}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <AlertCircle className="h-5 w-5 text-gray-500" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              AI Early Bird Campaign Ended
            </h3>
            <p className="text-sm text-gray-600">
              Thank you for your interest! Join our waitlist to be notified when AI features launch.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border rounded-lg p-4 transition-all',
        'bg-gradient-to-r from-purple-50 to-blue-50',
        'border-purple-200',
        enabled && 'ring-2 ring-purple-300',
        className
      )}
    >
      {/* Header with checkbox and badge */}
      <div className="flex items-start gap-3 mb-3">
        <input
          type="checkbox"
          id="ai-enhancement"
          checked={enabled}
          onChange={(e) => handleCheckboxChange(e.target.checked)}
          className={cn(
            'mt-0.5 h-5 w-5 rounded border-purple-300',
            'text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
            'cursor-pointer transition-colors'
          )}
          aria-describedby="ai-enhancement-description"
        />
        <div className="flex-1">
          <label
            htmlFor="ai-enhancement"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="h-5 w-5 text-purple-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-gray-900">
              Enable AI-Powered Analysis
            </span>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
              'bg-gradient-to-r from-purple-600 to-blue-600 text-white',
              'animate-pulse'
            )}>
              Early Bird
            </span>
          </label>

          {/* Campaign status */}
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              urgency === 'high' && 'bg-red-100 text-red-800',
              urgency === 'medium' && 'bg-yellow-100 text-yellow-800',
              urgency === 'low' && 'bg-green-100 text-green-800'
            )}>
              {statusMessage}
            </span>
          </div>
        </div>
      </div>

      {/* AI benefits description */}
      <div id="ai-enhancement-description" className="ml-8 space-y-2">
        <p className="text-sm text-gray-700">
          Get enhanced accessibility insights powered by AI:
        </p>
        <ul className="text-sm text-gray-600 space-y-1 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-purple-600 mt-0.5">•</span>
            <span>Detailed explanations of accessibility issues</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-600 mt-0.5">•</span>
            <span>Actionable fix suggestions with code examples</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-600 mt-0.5">•</span>
            <span>Priority-ranked remediation roadmap</span>
          </li>
        </ul>

        {/* Email delivery warning */}
        <div className={cn(
          'flex items-start gap-2 mt-3 p-2.5 rounded-md',
          'bg-blue-50 border border-blue-200'
        )}>
          <Mail className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> AI results will be delivered via email within 24 hours.
            {enabled && ' Email is required for AI-enhanced scans.'}
          </p>
        </div>
      </div>
    </div>
  );
}
