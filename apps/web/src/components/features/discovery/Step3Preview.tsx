'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { PreviewTable, type ParsedUrl } from './PreviewTable';
import { EstimatedTime } from './EstimatedTime';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for Step3Preview component
 */
export interface Step3PreviewProps {
  /** Array of selected URLs to preview */
  selectedUrls: ParsedUrl[];
  /** Navigate to previous step */
  onBack: () => void;
  /** Submit selection and start batch scan */
  onStartScan: () => void;
  /** Whether scan submission is in progress */
  isSubmitting: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Step3Preview Component
 *
 * Container component for Step 3 of the Discovery Flow V2 - Final Preview.
 * Displays the final URL selection in table format with estimated scan time,
 * and provides navigation controls to go back or start the scan.
 *
 * Features:
 * - Displays selected URLs in a table format (PreviewTable)
 * - Shows estimated scan duration (EstimatedTime)
 * - Provides "Back" button to return to Step 2 (Select)
 * - Provides "Start Scan" button with loading state
 * - Shows summary text with URL count
 *
 * Implements:
 * - FR-3.1: Display final URL selection in table format
 * - FR-3.2: Show estimated scan duration
 * - FR-3.3: Provide confirmation before proceeding
 * - FR-3.4: Allow navigation back to previous steps
 * - US-4: Preview Step user story
 *
 * @component
 * @example
 * ```tsx
 * const { getSelectedUrls, goBack, submitSelection, isSubmitting } = useDiscoveryFlowV2();
 *
 * <Step3Preview
 *   selectedUrls={getSelectedUrls()}
 *   onBack={goBack}
 *   onStartScan={submitSelection}
 *   isSubmitting={isSubmitting}
 * />
 * ```
 */
export function Step3Preview({
  selectedUrls,
  onBack,
  onStartScan,
  isSubmitting,
}: Step3PreviewProps) {
  const urlCount = selectedUrls.length;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Review Your Selection
        </h2>
        <p className="text-sm text-gray-600">
          You've selected {urlCount} URL{urlCount === 1 ? '' : 's'} for
          accessibility scanning. Review your selection below and click "Start
          Scan" to begin.
        </p>
      </div>

      {/* Estimated Time Section */}
      <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">
            Ready to scan {urlCount} URL{urlCount === 1 ? '' : 's'}
          </p>
          <EstimatedTime urlCount={urlCount} />
        </div>
      </div>

      {/* Preview Table Section */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">Selected URLs</h3>
        <PreviewTable urls={selectedUrls} />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          aria-label="Go back to URL selection"
        >
          Back
        </Button>

        <Button
          type="button"
          variant="default"
          onClick={onStartScan}
          loading={isSubmitting}
          disabled={isSubmitting || urlCount === 0}
          aria-label={`Start scanning ${urlCount} URL${urlCount === 1 ? '' : 's'}`}
        >
          {isSubmitting ? 'Starting Scan...' : 'Start Scan'}
        </Button>
      </div>
    </div>
  );
}

Step3Preview.displayName = 'Step3Preview';
