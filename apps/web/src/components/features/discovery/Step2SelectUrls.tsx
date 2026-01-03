'use client';

import { useCallback } from 'react';
import { UrlSelectionList } from './UrlSelectionList';
import { SelectAllControls } from './SelectAllControls';
import { SelectionCounter } from '@/components/ui/selection-counter';
import { Button } from '@/components/ui/button';
import { useDiscoveryFlowV2 } from '@/hooks/useDiscoveryFlowV2';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Step2SelectUrls - URL Selection Container
 *
 * Container component for Step 2 of the Discovery Flow V2.
 * Orchestrates the URL selection experience by composing:
 * - SelectAllControls: Batch selection controls with counter
 * - UrlSelectionList: Virtualized list of selectable URLs
 * - SelectionCounter: Mobile sticky footer for selection feedback
 * - Navigation buttons: Back and Continue
 *
 * Features:
 * - Display all parsed URLs with checkboxes (FR-2.1, FR-2.2)
 * - Select All / Deselect All functionality (FR-2.3, FR-2.4)
 * - Real-time selection counter (FR-2.5)
 * - Pre-select all URLs by default (FR-2.6)
 * - Navigation to previous/next steps (US-6)
 * - Disable Continue when no URLs selected
 * - Responsive design with mobile-optimized sticky footer
 *
 * Implements:
 * - FR-2.1: System SHALL display all URLs in a selectable list/table
 * - FR-2.2: Each URL row SHALL have a checkbox for selection
 * - FR-2.3: System SHALL provide "Select All" functionality
 * - FR-2.4: System SHALL provide "Deselect All" functionality
 * - FR-2.5: System SHALL display selected count / total count
 * - FR-2.6: System SHALL pre-select all URLs by default
 * - US-3: As a user, I want to select which URLs to scan
 * - US-6: As a user, I want clear navigation between steps
 *
 * @example
 * ```tsx
 * <Step2SelectUrls />
 * ```
 */
export function Step2SelectUrls() {
  const {
    parsedUrls,
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    goBack,
    goToPreview,
    canProceedToPreview,
  } = useDiscoveryFlowV2();

  /**
   * Handle URL toggle
   * Delegates to hook's toggleSelection with analytics
   */
  const handleToggle = useCallback(
    (id: string) => {
      toggleSelection(id);
    },
    [toggleSelection]
  );

  /**
   * Handle Select All
   * Delegates to hook's selectAll with analytics
   */
  const handleSelectAll = useCallback(() => {
    selectAll();
  }, [selectAll]);

  /**
   * Handle Deselect All
   * Delegates to hook's deselectAll with analytics
   */
  const handleDeselectAll = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  /**
   * Handle Continue to Preview
   * Only proceeds if at least one URL is selected
   */
  const handleContinue = useCallback(() => {
    if (canProceedToPreview()) {
      goToPreview();
    }
  }, [canProceedToPreview, goToPreview]);

  /**
   * Calculate counts for display
   */
  const selectedCount = selectedIds.size;
  const totalCount = parsedUrls.length;
  const canContinue = selectedCount > 0;

  return (
    <div className="space-y-6">
      {/* Step header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Step 2: Select URLs
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Choose which URLs you want to scan for accessibility issues
        </p>
      </div>

      {/* Selection controls - Desktop */}
      <div className="hidden md:block">
        <SelectAllControls
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          selectedCount={selectedCount}
          totalCount={totalCount}
        />
      </div>

      {/* URL Selection List */}
      <div className="pb-20 md:pb-0">
        <UrlSelectionList
          urls={parsedUrls}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          maxHeight="500px"
        />
      </div>

      {/* Selection Counter - Mobile Sticky Footer */}
      <div className="md:hidden">
        <SelectionCounter
          selectedCount={selectedCount}
          totalCount={totalCount}
          onClearSelection={handleDeselectAll}
          onSelectAll={handleSelectAll}
          sticky={true}
        />
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={goBack}
          aria-label="Go back to URL input"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          aria-label={
            canContinue
              ? `Continue to preview with ${selectedCount} selected URLs`
              : 'Select at least one URL to continue'
          }
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Help text when no URLs selected */}
      {!canContinue && (
        <div
          className="mt-2 text-sm text-amber-600 text-center"
          role="status"
          aria-live="polite"
        >
          Please select at least one URL to continue
        </div>
      )}
    </div>
  );
}

Step2SelectUrls.displayName = 'Step2SelectUrls';
