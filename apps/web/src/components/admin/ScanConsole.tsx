'use client';

import { ChevronDown, ChevronUp, Terminal, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScanEvents } from '@/hooks/useScanEvents';
import { LogEntry } from '@/components/features/scan/LogEntry';
import { useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * View modes for AdminScanConsole
 */
type ViewMode = 'full' | 'user';

/**
 * AdminScanConsole Props
 */
interface AdminScanConsoleProps {
  /** The scan ID to display events for */
  scanId: string;
  /** Default view state (expanded or collapsed) */
  defaultView?: 'expanded' | 'collapsed';
  /** Optional CSS classes */
  className?: string;
}

/**
 * AdminScanConsole Component
 *
 * Admin-specific version of the ScanConsole with enhanced capabilities:
 * - Shows ALL events including DEBUG level
 * - Displays admin-only events (adminOnly: true)
 * - Enables metadata expansion for detailed event inspection
 * - Uses admin-specific polling with useScanEvents hook (isAdmin: true)
 * - Features same terminal-style design and virtualized scrolling
 * - Auto-expands by default for admin monitoring
 * - View mode toggle to preview user experience
 *
 * View Modes:
 * - Full View: Shows all events including adminOnly (default for admins)
 * - User View: Filters out adminOnly events to simulate user experience
 *
 * Key differences from public ScanConsole:
 * - Pass isAdmin: true to useScanEvents (shows adminOnly events)
 * - Pass isAdmin: true to LogEntry (enables metadata expansion)
 * - Shows DEBUG level events for troubleshooting
 * - No status filtering (shows all events regardless of scan state)
 * - Admin-specific styling and behavior
 * - Toggle between full admin view and filtered user view
 *
 * @see {@link https://tanstack.com/virtual/latest} - TanStack Virtual documentation
 */
export function AdminScanConsole({
  scanId,
  defaultView = 'expanded',
  className,
}: AdminScanConsoleProps) {
  // Local state for expand/collapse
  const [isExpanded, setIsExpanded] = useState(defaultView === 'expanded');
  // View mode state: 'full' shows all events, 'user' hides adminOnly events
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  // Copy button state
  const [isCopied, setIsCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Fetch scan events with polling (isAdmin: true for admin view)
  const { events, isLoading, error } = useScanEvents(scanId, 'RUNNING', {
    pollInterval: 2000,
    isAdmin: true, // Show admin-only events and DEBUG levels
  });

  // Filter events based on view mode
  const displayEvents =
    viewMode === 'user'
      ? events.filter((event) => !event.adminOnly) // User view: hide adminOnly events
      : events; // Full view: show all events

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

  // Copy log events to clipboard
  const handleCopyLog = async () => {
    try {
      // Format events as text
      const logText = displayEvents
        .map((event) => {
          const timestamp = new Date(event.createdAt).toLocaleTimeString();
          const adminTag = event.adminOnly ? '[ADMIN] ' : '';
          return `[${timestamp}] ${adminTag}${event.level}: ${event.message}`;
        })
        .join('\n');

      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(logText);
        setIsCopied(true);
        setCopyError(null);
        // Reset after 2 seconds
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = logText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          setIsCopied(true);
          setCopyError(null);
          setTimeout(() => setIsCopied(false), 2000);
        } else {
          throw new Error('Copy command failed');
        }
      }
    } catch (err) {
      console.error('Failed to copy log:', err);
      setCopyError('Failed to copy log');
      setTimeout(() => setCopyError(null), 3000);
    }
  };

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
          'select-none'
        )}
      >
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-green-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-white font-mono">
            Admin Scan Console
          </h3>
          <span className="text-xs text-gray-400 font-mono">
            ID: {scanId.slice(0, 8)}
          </span>
          {/* Admin Badge */}
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-600/30 text-purple-400 border border-purple-500/30">
            ADMIN
          </span>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode('full');
              }}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded transition-all',
                'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800',
                viewMode === 'full'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              )}
              aria-label="Switch to full view"
              aria-pressed={viewMode === 'full'}
            >
              <span className="flex items-center gap-1.5">
                <Eye className="h-3 w-3" aria-hidden="true" />
                Full View
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode('user');
              }}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded transition-all',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800',
                viewMode === 'user'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              )}
              aria-label="Switch to user view"
              aria-pressed={viewMode === 'user'}
            >
              <span className="flex items-center gap-1.5">
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                User View
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Log Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLog();
            }}
            disabled={displayEvents.length === 0}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold rounded transition-all',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800',
              displayEvents.length === 0
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            )}
            aria-label="Copy log to clipboard"
            title={isCopied ? 'Copied!' : copyError || 'Copy log to clipboard'}
          >
            <span className="flex items-center gap-1.5">
              {isCopied ? (
                <>
                  <Check className="h-3 w-3 text-green-400" aria-hidden="true" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  Copy Log
                </>
              )}
            </span>
          </button>

          {/* Copy Error Notification */}
          {copyError && (
            <span className="text-xs text-red-400 font-mono">
              {copyError}
            </span>
          )}

          {/* Expand/Collapse Button */}
          <button
            type="button"
            className={cn(
              'p-1 rounded hover:bg-gray-700 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800'
            )}
            aria-label={isExpanded ? 'Collapse console' : 'Expand console'}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Content Area - Animated Collapse/Expand */}
      <div
        id="admin-scan-console-content"
        className={cn(
          'relative overflow-hidden transition-all duration-200 ease-in-out',
          isExpanded ? 'max-h-96' : 'max-h-0'
        )}
        aria-hidden={!isExpanded}
      >
        {/* Virtualized Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="h-96 w-full overflow-auto bg-gray-900"
          style={{
            scrollbarGutter: 'stable',
          }}
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
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const event = displayEvents[virtualItem.index];
                if (!event) return null;

                return (
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
                      event={event}
                      isAdmin={true} // Enable metadata expansion
                      showMetadata={true} // Show metadata toggle
                      isAdminOnly={event.adminOnly} // Apply admin-only styling
                    />
                  </div>
                );
              })}
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
              {displayEvents.length > 0 && (() => {
                const lastEvent = displayEvents[displayEvents.length - 1];
                return lastEvent ? (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-500 truncate max-w-md">
                      {lastEvent.message}
                    </span>
                  </>
                ) : null;
              })()}
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
