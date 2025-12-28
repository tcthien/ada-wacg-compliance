'use client';

import React, { useState } from 'react';
import { ScanEvent, LogLevel } from '@/types/scan-event';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface LogEntryProps {
  /** The scan event to render */
  event: ScanEvent;
  /** Whether the current user is an admin */
  isAdmin: boolean;
  /** Whether to show expandable metadata */
  showMetadata?: boolean;
  /** Whether this is an admin-only event (for distinct styling) */
  isAdminOnly?: boolean;
}

/**
 * LogEntry Component
 *
 * Renders an individual log entry in the scan console with:
 * - Color-coded log levels
 * - Formatted timestamp
 * - Expandable metadata (admin only)
 * - Terminal-style monospace font
 */
export function LogEntry({ event, isAdmin, showMetadata = true, isAdminOnly = false }: LogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format timestamp as HH:MM:SS
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Get color class based on log level
  // Colors chosen for WCAG AA contrast ratio (4.5:1) on dark bg-gray-900
  const getLevelColor = (level: LogLevel): string => {
    const colorMap: Record<LogLevel, string> = {
      DEBUG: 'text-gray-300', // Improved from gray-400 for better contrast
      INFO: 'text-white',
      SUCCESS: 'text-green-400',
      WARNING: 'text-amber-400',
      ERROR: 'text-red-400',
    };
    return colorMap[level] || 'text-white';
  };

  // Get level badge style
  // Badge colors adjusted for WCAG AA contrast
  const getLevelBadge = (level: LogLevel): string => {
    const badgeMap: Record<LogLevel, string> = {
      DEBUG: 'bg-gray-600/30 text-gray-300', // Improved contrast
      INFO: 'bg-blue-600/30 text-blue-400',
      SUCCESS: 'bg-green-600/30 text-green-400',
      WARNING: 'bg-amber-600/30 text-amber-400',
      ERROR: 'bg-red-600/30 text-red-400',
    };
    return badgeMap[level] || 'bg-gray-600/30 text-gray-300';
  };

  // Check if metadata exists and should be shown
  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;
  const shouldShowMetadata = isAdmin && showMetadata && hasMetadata;

  return (
    <div
      className={`font-mono text-sm py-1 motion-reduce:transition-none transition-colors ${isAdminOnly ? 'bg-purple-900/20 hover:bg-purple-900/30' : 'hover:bg-gray-800/30'} focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 rounded-sm`}
      tabIndex={0}
      role="log"
      aria-label={`${event.level} log entry at ${formatTimestamp(event.createdAt)}`}
    >
      <div className="flex items-start gap-3 px-3">
        {/* Timestamp */}
        <span className="text-gray-500 text-xs flex-shrink-0 pt-0.5">
          {formatTimestamp(event.createdAt)}
        </span>

        {/* Level Badge */}
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${getLevelBadge(
            event.level
          )}`}
        >
          {event.level}
        </span>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <span className={`${getLevelColor(event.level)} break-words`}>
            {event.message}
          </span>

          {/* Metadata Toggle (Admin Only) */}
          {shouldShowMetadata && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2 text-gray-500 hover:text-gray-300 motion-reduce:transition-none transition-colors inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-900 rounded px-1"
              aria-label={isExpanded ? 'Hide metadata' : 'Show metadata'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="text-xs">metadata</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Metadata (Admin Only) */}
      {shouldShowMetadata && isExpanded && (
        <div className="mt-2 ml-3 pl-3 border-l-2 border-gray-700">
          <pre className="text-xs text-gray-400 overflow-x-auto p-2 bg-gray-900/50 rounded">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
