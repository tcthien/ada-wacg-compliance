'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ScanStatus } from '@/lib/api';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScanEvents } from '@/hooks/useScanEvents';
import { LogEntry } from './LogEntry';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * ScanConsole Props
 */
interface ScanConsoleProps {
  /** The scan ID to display events for */
  scanId: string;
  /** Current status of the scan */
  scanStatus: ScanStatus;
  /** Whether the console is expanded */
  isExpanded: boolean;
  /** Callback when toggle button is clicked */
  onToggle: () => void;
  /** Optional CSS classes */
  className?: string;
}

/**
 * ScanConsole Component
 *
 * A dark terminal-style console that displays real-time scan events.
 * Features:
 * - Dark terminal-style design with monospace font
 * - Collapsible header with toggle button and chevron icon
 * - Smooth expand/collapse animations (200ms transition)
 * - Compact summary view when collapsed showing event count and last message
 * - Virtualized scrolling using @tanstack/react-virtual for performance
 * - Fixed height for consistent layout
 * - Real-time event polling with useScanEvents hook
 * - Filters out adminOnly events for public view
 * - Displays up to 50 most recent events
 * - Auto-scroll to bottom with smart pause on manual scroll
 * - Handles 100+ entries efficiently with virtualization
 *
 * @see {@link https://tanstack.com/virtual/latest} - TanStack Virtual documentation
 */
export function ScanConsole({
  scanId,
  scanStatus,
  isExpanded,
  onToggle,
  className,
}: ScanConsoleProps) {
  // Fetch scan events with polling (isAdmin: false for public view)
  const { events, isLoading, error } = useScanEvents(scanId, scanStatus, {
    pollInterval: 2000,
    isAdmin: false,
  });

  // Limit to 50 most recent events
  const displayEvents = events.slice(-50);

  // Auto-scroll state and refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const isUserScrollingRef = useRef(false);

  // Setup virtualizer with dynamic sizing
  const virtualizer = useVirtualizer({
    count: displayEvents.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 40, // Estimated height of a single log entry in pixels
    overscan: 5, // Render 5 items above and below the visible area for smooth scrolling
  });

  // Auto-scroll to bottom when new events arrive (if enabled)
  useEffect(() => {
    if (autoScrollEnabled && scrollContainerRef.current && isExpanded && displayEvents.length > 0) {
      // Scroll to the last item using virtualizer
      virtualizer.scrollToIndex(displayEvents.length - 1, {
        align: 'end',
        behavior: 'smooth',
      });
    }
  }, [displayEvents.length, autoScrollEnabled, isExpanded, virtualizer]);

  // Debounce scroll events to avoid rapid state changes
  useEffect(() => {
    const scrollElement = scrollContainerRef.current;
    if (!scrollElement) return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      if (isUserScrollingRef.current) return;

      // Check if user is at bottom (within 50px threshold)
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

      // Update auto-scroll state based on scroll position
      if (isAtBottom && !autoScrollEnabled) {
        setAutoScrollEnabled(true);
      } else if (!isAtBottom && autoScrollEnabled) {
        setAutoScrollEnabled(false);
      }
    };

    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };

    scrollElement.addEventListener('scroll', debouncedHandleScroll);
    return () => {
      scrollElement.removeEventListener('scroll', debouncedHandleScroll);
      clearTimeout(timeoutId);
    };
  }, [autoScrollEnabled]);
  return (
    <div
      className={cn(
        'border border-gray-700 rounded-lg overflow-hidden',
        'bg-gray-900 shadow-lg',
        'transition-all duration-300 ease-in-out',
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between',
          'px-4 py-3 bg-gray-800 border-b border-gray-700',
          'cursor-pointer hover:bg-gray-750 transition-colors',
          'select-none'
        )}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls="scan-console-content"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-green-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-white font-mono">
            Scan Console
          </h3>
          <span className="text-xs text-gray-400 font-mono">
            ID: {scanId.slice(0, 8)}
          </span>
        </div>

        <button
          type="button"
          className={cn(
            'p-1 rounded hover:bg-gray-700 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800'
          )}
          aria-label={isExpanded ? 'Collapse console' : 'Expand console'}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Content Area - Animated Collapse/Expand */}
      <div
        id="scan-console-content"
        className={cn(
          'relative overflow-hidden transition-all duration-200 ease-in-out',
          isExpanded ? 'max-h-80' : 'max-h-0'
        )}
        aria-hidden={!isExpanded}
      >
        {/* Virtualized Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="h-80 w-full overflow-auto bg-gray-900"
          style={{
            scrollbarGutter: 'stable',
          }}
          role="log"
          aria-live="polite"
          aria-label={`Accessibility scan console for scan ${scanId.slice(0, 8)}`}
          aria-relevant="additions"
          aria-atomic="false"
        >
          {/* Loading State */}
          {isLoading && events.length === 0 && (
            <div className="text-gray-500 text-center py-8">
              <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
              <p>Loading events...</p>
              <p className="text-xs mt-1">Scan ID: {scanId.slice(0, 8)}</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-red-400 text-center py-8">
              <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Failed to load events</p>
              <p className="text-xs mt-1">{error}</p>
            </div>
          )}

          {/* Empty State (no events yet) */}
          {!isLoading && !error && displayEvents.length === 0 && (
            <div className="text-gray-500 text-center py-8">
              <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No events yet</p>
              <p className="text-xs mt-1">Waiting for scan to start...</p>
            </div>
          )}

          {/* Virtualized Event Log Entries */}
          {!error && displayEvents.length > 0 && (
            <div
              className="p-4 font-mono text-sm relative"
              style={{
                height: `${virtualizer.getTotalSize()}px`,
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <LogEntry
                    event={displayEvents[virtualItem.index]}
                    isAdmin={false}
                    showMetadata={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scroll fade indicator at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgb(17, 24, 39), transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Collapsed Summary View */}
      {!isExpanded && (
        <div
          className={cn(
            'px-4 py-3 bg-gray-850 border-t border-gray-700',
            'transition-all duration-200 ease-in-out'
          )}
        >
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3 text-gray-400">
              <span className="text-green-400 font-semibold">
                {displayEvents.length} {displayEvents.length === 1 ? 'event' : 'events'}
              </span>
              {displayEvents.length > 0 && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-500 truncate max-w-md">
                    {displayEvents[displayEvents.length - 1].message}
                  </span>
                </>
              )}
            </div>
            {isLoading && (
              <span className="text-gray-500 animate-pulse">Updating...</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
