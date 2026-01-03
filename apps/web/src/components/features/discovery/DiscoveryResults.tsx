'use client';

import { useMemo } from 'react';
import { PageTree } from './PageTree';
import { CachedResultsPrompt } from './CachedResultsPrompt';
import { ManualUrlEntry } from './ManualUrlEntry';
import { SelectionCounter } from '@/components/ui/selection-counter';
import { useAnalyticsContext } from '@/components/features/analytics';
import {
  formatEstimatedTime,
  isLargeScan,
  getSelectionSummary,
  extractDomain,
} from './utils';
import type { DiscoveredPage, CacheMetadata } from '@/lib/discovery-api';
import type { DiscoveryPagesSelectedEvent } from '@/lib/analytics.types';

/**
 * Props for DiscoveryResults component
 */
export interface DiscoveryResultsProps {
  /** Discovered pages */
  pages: DiscoveredPage[];
  /** Homepage URL for domain validation */
  homepageUrl: string;
  /** Set of selected page IDs */
  selectedIds: Set<string>;
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: Set<string>) => void;
  /** Callback when "Start Scan" is clicked */
  onStartScan: (selectedPageIds: string[]) => void;
  /** Callback to add a single manual URL */
  onAddUrl: (url: string) => Promise<void>;
  /** Callback to add multiple manual URLs */
  onAddUrls: (urls: string[]) => Promise<void>;
  /** Cache metadata (if result was cached) */
  cacheMetadata?: CacheMetadata | null;
  /** Callback when user chooses to use cached results */
  onUseCached?: () => void;
  /** Callback when user chooses to refresh */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Whether URL addition is in progress */
  isAddingUrl?: boolean;
  /** Whether start scan is in progress */
  isStartingScan?: boolean;
  /** Whether interactions are disabled */
  disabled?: boolean;
  /** Height of the page tree */
  treeHeight?: number;
  /** Optional class name for styling */
  className?: string;
}

/**
 * DiscoveryResults component
 *
 * Main container for displaying discovery results including the page tree,
 * selection actions, and scan initiation. Handles cached results prompt
 * and manual URL entry.
 *
 * @example
 * ```tsx
 * <DiscoveryResults
 *   pages={discovery.pages}
 *   homepageUrl="https://example.com"
 *   selectedIds={selectedIds}
 *   onSelectionChange={setSelectedIds}
 *   onStartScan={(ids) => console.log('Starting scan with', ids)}
 *   onAddUrl={async (url) => {}}
 *   onAddUrls={async (urls) => {}}
 * />
 * ```
 */
export function DiscoveryResults({
  pages,
  homepageUrl,
  selectedIds,
  onSelectionChange,
  onStartScan,
  onAddUrl,
  onAddUrls,
  cacheMetadata,
  onUseCached,
  onRefresh,
  isRefreshing = false,
  isAddingUrl = false,
  isStartingScan = false,
  disabled = false,
  treeHeight = 400,
  className = '',
}: DiscoveryResultsProps) {
  const { track } = useAnalyticsContext();

  // Helper to get session ID
  const getSessionId = () =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionId') || '' : '';

  // Calculate derived values
  const selectedCount = selectedIds.size;
  const totalCount = pages.length;
  const hasSelection = selectedCount > 0;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const domain = extractDomain(homepageUrl);

  // Memoize estimated time calculation
  const estimatedTime = useMemo(
    () => formatEstimatedTime(selectedCount),
    [selectedCount]
  );

  const showLargeScanWarning = useMemo(
    () => isLargeScan(selectedCount),
    [selectedCount]
  );

  const selectionSummary = useMemo(
    () => getSelectionSummary(selectedCount, totalCount),
    [selectedCount, totalCount]
  );

  /**
   * Handle select all
   */
  const handleSelectAll = () => {
    const allIds = new Set(pages.map((p) => p.id));
    onSelectionChange(allIds);

    // Track page selection event
    const event: DiscoveryPagesSelectedEvent = {
      event: 'discovery_pages_selected',
      selected_count: totalCount,
      total_count: totalCount,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  /**
   * Handle deselect all
   */
  const handleDeselectAll = () => {
    onSelectionChange(new Set());

    // Track page deselection event
    const event: DiscoveryPagesSelectedEvent = {
      event: 'discovery_pages_selected',
      selected_count: 0,
      total_count: totalCount,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);
  };

  /**
   * Handle start scan
   */
  const handleStartScan = () => {
    // Track final selection when starting scan
    const event: DiscoveryPagesSelectedEvent = {
      event: 'discovery_pages_selected',
      selected_count: selectedIds.size,
      total_count: totalCount,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);

    onStartScan(Array.from(selectedIds));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cached results prompt */}
      {cacheMetadata && onUseCached && onRefresh && (
        <CachedResultsPrompt
          cacheMetadata={cacheMetadata}
          onUseCached={onUseCached}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      {/* Results header - responsive layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Discovered Pages
          </h3>
          <p className="text-sm text-gray-500">
            Found {totalCount} {totalCount === 1 ? 'page' : 'pages'} on{' '}
            {domain}
          </p>
        </div>

        {/* Selection actions - stack on mobile */}
        <div className="flex flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={disabled || allSelected}
            className={`
              flex-1 sm:flex-none px-3 py-2.5 sm:py-1.5 text-sm font-medium rounded-md
              transition-colors duration-200
              ${
                disabled || allSelected
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }
            `}
          >
            Select All
          </button>

          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={disabled || !hasSelection}
            className={`
              flex-1 sm:flex-none px-3 py-2.5 sm:py-1.5 text-sm font-medium rounded-md
              transition-colors duration-200
              ${
                disabled || !hasSelection
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }
            `}
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Page tree */}
      <PageTree
        pages={pages}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        height={treeHeight}
        disabled={disabled}
      />

      {/* Selection counter - sticky at bottom on mobile */}
      <SelectionCounter
        selectedCount={selectedCount}
        totalCount={totalCount}
        onClearSelection={handleDeselectAll}
        onSelectAll={handleSelectAll}
        sticky={true}
        className="md:hidden"
      />

      {/* Manual URL entry */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          Add URLs Manually
        </h4>
        <ManualUrlEntry
          baseDomain={homepageUrl}
          onAddUrl={onAddUrl}
          onAddUrls={onAddUrls}
          isLoading={isAddingUrl}
          disabled={disabled}
        />
      </div>

      {/* Selection summary and scan button - responsive layout */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex flex-col gap-4">
          {/* Discovery Summary Card */}
          {hasSelection && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-blue-900 mb-2">
                    Ready to Scan
                  </h4>
                  <div className="space-y-1.5">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">{totalCount} pages discovered</span>
                      {selectedCount < totalCount && (
                        <span>, {selectedCount} selected</span>
                      )}
                    </p>
                    <p className="text-sm text-blue-700">
                      Estimated scan time: <span className="font-medium">{estimatedTime}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback selection summary when no selection */}
          {!hasSelection && (
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-sm sm:text-base font-medium text-gray-900">
                {selectionSummary}
              </p>
            </div>
          )}

          {/* Start scan button - full width on mobile */}
          <button
            type="button"
            onClick={handleStartScan}
            disabled={disabled || !hasSelection || isStartingScan}
            className={`
              w-full sm:w-auto sm:self-end inline-flex items-center justify-center
              px-6 py-4 sm:py-3 text-base font-medium rounded-md
              transition-colors duration-200
              ${
                disabled || !hasSelection || isStartingScan
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }
            `}
          >
            {isStartingScan ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Starting Scan...
              </>
            ) : (
              <>
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                Start Scan
                {hasSelection && ` (${selectedCount})`}
              </>
            )}
          </button>
        </div>

        {/* Large scan warning */}
        {showLargeScanWarning && hasSelection && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <div className="flex">
              <svg
                className="h-5 w-5 text-amber-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-amber-800">
                  Large Scan Warning
                </h4>
                <p className="mt-1 text-sm text-amber-700">
                  Scanning {selectedCount} pages may take over 30 minutes.
                  Consider selecting fewer pages for a faster scan, or run the
                  full scan during off-peak hours.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
