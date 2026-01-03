'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parsed URL for preview display
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
 * Props for PreviewTable component
 */
export interface PreviewTableProps {
  /** Array of selected URLs to preview */
  urls: ParsedUrl[];
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PreviewTable Component
 *
 * Displays the final selection of URLs in a table format for Step 3 of the
 * Discovery Flow V2. Shows URL index, full URL, and page title.
 *
 * @component
 * @example
 * ```tsx
 * <PreviewTable urls={selectedUrls} />
 * ```
 */
export function PreviewTable({ urls }: PreviewTableProps) {
  // Handle empty state
  if (!urls || urls.length === 0) {
    return (
      <div className="rounded-md border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No URLs selected for preview
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="w-64">Title</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {urls.map((url, index) => (
            <TableRow key={url.id}>
              <TableCell className="font-medium text-muted-foreground">
                {index + 1}
              </TableCell>
              <TableCell className="font-mono text-sm break-all">
                {url.url}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {url.title || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

PreviewTable.displayName = 'PreviewTable';
