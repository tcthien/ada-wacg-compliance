'use client';

import React, { useId } from 'react';
import { VirtualizedList } from '@/components/ui/virtualized-list';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parsed URL for selection list
 */
export interface ParsedUrl {
  /** Unique identifier */
  id: string;
  /** URL string */
  url: string;
  /** Optional page title */
  title?: string | null;
}

/**
 * Props for UrlSelectionList component
 */
export interface UrlSelectionListProps {
  /** Array of parsed URLs to display */
  urls: ParsedUrl[];
  /** Set of selected URL IDs */
  selectedIds: Set<string>;
  /** Callback when a URL is toggled */
  onToggle: (id: string) => void;
  /** Maximum height of the list container */
  maxHeight?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Height of each row in pixels */
const ROW_HEIGHT = 56;

/** Virtualization threshold - use VirtualizedList when URLs exceed this count */
const VIRTUALIZATION_THRESHOLD = 20;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * UrlSelectionList - Display selectable list of URLs with checkboxes
 *
 * Features:
 * - Checkbox for each URL (FR-2.2)
 * - Display URL and title if available (FR-2.1)
 * - Automatic virtualization for >20 URLs (NFR-1.2)
 * - Keyboard accessible with proper ARIA labels
 * - Responsive design with proper spacing
 *
 * Requirements:
 * - FR-2.1: System SHALL display all URLs in a selectable list/table
 * - FR-2.2: Each URL row SHALL have a checkbox for selection
 * - NFR-1.2: URL list rendering SHALL handle 50 URLs without lag
 *
 * @example
 * ```tsx
 * <UrlSelectionList
 *   urls={parsedUrls}
 *   selectedIds={selectedIds}
 *   onToggle={handleToggle}
 *   maxHeight="400px"
 * />
 * ```
 */
export function UrlSelectionList({
  urls,
  selectedIds,
  onToggle,
  maxHeight = '400px',
}: UrlSelectionListProps) {
  const listId = useId();

  /**
   * Render a single URL row
   */
  const renderUrlRow = (url: ParsedUrl, index: number) => {
    const checkboxId = `${listId}-checkbox-${index}`;
    const labelId = `${listId}-label-${index}`;
    const isSelected = selectedIds.has(url.id);

    return (
      <div
        key={url.id}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-200 last:border-b-0"
        role="row"
      >
        {/* Checkbox */}
        <label
          htmlFor={checkboxId}
          className="flex-shrink-0 flex items-center justify-center cursor-pointer"
        >
          <input
            type="checkbox"
            id={checkboxId}
            checked={isSelected}
            onChange={() => onToggle(url.id)}
            aria-labelledby={labelId}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </label>

        {/* URL and Title */}
        <div id={labelId} className="flex-1 min-w-0">
          {/* Title (if available) */}
          {url.title && (
            <div className="text-sm font-medium text-gray-900 truncate mb-0.5">
              {url.title}
            </div>
          )}

          {/* URL */}
          <div
            className={`text-sm text-gray-600 truncate ${url.title ? '' : 'font-medium'}`}
            title={url.url}
          >
            {url.url}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render virtualized row (for VirtualizedList)
   */
  const renderVirtualizedRow = ({
    index,
    style,
    data,
  }: {
    index: number;
    style: React.CSSProperties;
    data?: ParsedUrl[];
  }) => {
    if (!data || !data[index]) return null;

    const url = data[index];
    const checkboxId = `${listId}-checkbox-${index}`;
    const labelId = `${listId}-label-${index}`;
    const isSelected = selectedIds.has(url.id);

    return (
      <div
        style={style}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-200"
        role="row"
      >
        {/* Checkbox */}
        <label
          htmlFor={checkboxId}
          className="flex-shrink-0 flex items-center justify-center cursor-pointer"
        >
          <input
            type="checkbox"
            id={checkboxId}
            checked={isSelected}
            onChange={() => onToggle(url.id)}
            aria-labelledby={labelId}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </label>

        {/* URL and Title */}
        <div id={labelId} className="flex-1 min-w-0">
          {/* Title (if available) */}
          {url.title && (
            <div className="text-sm font-medium text-gray-900 truncate mb-0.5">
              {url.title}
            </div>
          )}

          {/* URL */}
          <div
            className={`text-sm text-gray-600 truncate ${url.title ? '' : 'font-medium'}`}
            title={url.url}
          >
            {url.url}
          </div>
        </div>
      </div>
    );
  };

  // Empty state
  if (urls.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50"
        style={{ height: maxHeight }}
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-gray-500">No URLs available</p>
      </div>
    );
  }

  // Use virtualization for large lists (>20 URLs)
  const shouldVirtualize = urls.length > VIRTUALIZATION_THRESHOLD;

  if (shouldVirtualize) {
    // Convert maxHeight to pixels for VirtualizedList
    const heightInPixels = parseInt(maxHeight.replace('px', ''), 10) || 400;

    return (
      <div
        className="rounded-lg border border-gray-200 overflow-hidden"
        role="table"
        aria-label="URL selection list"
      >
        <VirtualizedList
          itemCount={urls.length}
          itemSize={ROW_HEIGHT}
          height={heightInPixels}
          itemData={urls}
          renderItem={renderVirtualizedRow}
          aria-label="URL selection list"
          overscanCount={3}
        />
      </div>
    );
  }

  // Standard scrollable list for smaller lists
  return (
    <div
      className="rounded-lg border border-gray-200 overflow-hidden"
      role="table"
      aria-label="URL selection list"
    >
      <div
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {urls.map((url, index) => renderUrlRow(url, index))}
      </div>
    </div>
  );
}

UrlSelectionList.displayName = 'UrlSelectionList';
