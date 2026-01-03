'use client';

import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAnalyticsContext } from '@/components/features/analytics';
import type { HistoryBulkDeleteEvent, HistorySelectionClearedEvent } from '@/lib/analytics.types';

/**
 * Props for HistoryBulkActions component
 */
export interface HistoryBulkActionsProps {
  /** Set of selected item IDs (format: "type-id", e.g., "scan-123", "batch-456") */
  selectedIds: Set<string>;
  /** Callback to delete selected items */
  onDelete: (ids: Set<string>) => Promise<void>;
  /** Callback to clear selection */
  onClearSelection: () => void;
}

/**
 * HistoryBulkActions component
 *
 * This component:
 * - Shows when selectedIds.size > 0
 * - Displays selection count
 * - Provides "Delete Selected" button with confirmation dialog
 * - Provides "Clear Selection" button
 * - Uses danger variant for destructive delete action
 *
 * Requirements:
 * - REQ 9.5: WHEN selecting multiple history items THEN the system SHALL allow bulk deletion
 *
 * Design Patterns:
 * - Follows existing UI component styling (Button, ConfirmDialog)
 * - Uses Tailwind CSS utility classes consistent with project
 * - Confirmation dialog prevents accidental deletion
 * - Loading state during async deletion
 *
 * @example
 * ```tsx
 * <HistoryBulkActions
 *   selectedIds={selectedIds}
 *   onDelete={handleBulkDelete}
 *   onClearSelection={handleClearSelection}
 * />
 * ```
 */
export function HistoryBulkActions({
  selectedIds,
  onDelete,
  onClearSelection,
}: HistoryBulkActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { track } = useAnalyticsContext();

  // Helper to get session ID
  const getSessionId = () =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionId') || '' : '';

  // Don't render if no items are selected
  if (selectedIds.size === 0) {
    return null;
  }

  /**
   * Handle delete confirmation
   */
  const handleDeleteConfirm = async () => {
    const deleteCount = selectedIds.size;
    try {
      setIsDeleting(true);
      await onDelete(selectedIds);
      setIsDeleteDialogOpen(false);

      // Track bulk delete event
      const event: HistoryBulkDeleteEvent = {
        event: 'history_bulk_delete',
        deleted_count: deleteCount,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
      };
      track(event);

      // Selection will be cleared by parent component after successful deletion
    } catch (error) {
      console.error('Failed to delete items:', error);
      // Error will be handled by parent component
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle delete button click
   */
  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  /**
   * Handle clear selection button click
   */
  const handleClearClick = () => {
    // Track selection cleared event
    const event: HistorySelectionClearedEvent = {
      event: 'history_selection_cleared',
      cleared_count: selectedIds.size,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
    };
    track(event);

    onClearSelection();
  };

  return (
    <>
      {/* Bulk Actions Bar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear Selection Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearClick}
            className="gap-2"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
            Clear Selection
          </Button>

          {/* Delete Selected Button */}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDeleteClick}
            className="gap-2"
            aria-label={`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'item' : 'items'}`}
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        variant="danger"
        title="Delete Selected Items"
        description={`Are you sure you want to delete ${selectedIds.size} ${selectedIds.size === 1 ? 'item' : 'items'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </>
  );
}
