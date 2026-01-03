import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryBulkActions } from './HistoryBulkActions';

describe('HistoryBulkActions', () => {
  const mockOnDelete = vi.fn();
  const mockOnClearSelection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when no items are selected', () => {
      const { container } = render(
        <HistoryBulkActions
          selectedIds={new Set()}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when items are selected', () => {
      const selectedIds = new Set(['scan-1', 'scan-2']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      expect(screen.getByText('2 items selected')).toBeInTheDocument();
    });

    it('should show singular form for single item', () => {
      const selectedIds = new Set(['scan-1']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      expect(screen.getByText('1 item selected')).toBeInTheDocument();
    });

    it('should render Clear Selection button', () => {
      const selectedIds = new Set(['scan-1']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      expect(screen.getByRole('button', { name: /clear selection/i })).toBeInTheDocument();
    });

    it('should render Delete Selected button', () => {
      const selectedIds = new Set(['scan-1', 'scan-2']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      expect(screen.getByRole('button', { name: /delete 2 selected items/i })).toBeInTheDocument();
    });
  });

  describe('Clear Selection', () => {
    it('should call onClearSelection when Clear Selection button is clicked', () => {
      const selectedIds = new Set(['scan-1', 'scan-2']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      const clearButton = screen.getByRole('button', { name: /clear selection/i });
      fireEvent.click(clearButton);

      expect(mockOnClearSelection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete Selected', () => {
    it('should open confirmation dialog when Delete Selected button is clicked', () => {
      const selectedIds = new Set(['scan-1', 'scan-2']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete 2 selected items/i });
      fireEvent.click(deleteButton);

      expect(screen.getByText('Delete Selected Items')).toBeInTheDocument();
      expect(
        screen.getByText(/are you sure you want to delete 2 items/i)
      ).toBeInTheDocument();
    });

    it('should show correct message for single item in confirmation dialog', () => {
      const selectedIds = new Set(['scan-1']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete 1 selected item/i });
      fireEvent.click(deleteButton);

      expect(
        screen.getByText(/are you sure you want to delete 1 item/i)
      ).toBeInTheDocument();
    });

    it('should call onDelete when delete is confirmed', async () => {
      const selectedIds = new Set(['scan-1', 'scan-2']);
      mockOnDelete.mockResolvedValue(undefined);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      // Open confirmation dialog
      const deleteButton = screen.getByRole('button', { name: /delete 2 selected items/i });
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(selectedIds);
      });
    });

    it('should show loading state during deletion', async () => {
      const selectedIds = new Set(['scan-1']);
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      mockOnDelete.mockReturnValue(deletePromise);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      // Open confirmation dialog
      const deleteButton = screen.getByRole('button', { name: /delete 1 selected item/i });
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });

      // Resolve deletion
      resolveDelete!();
      await waitFor(() => {
        expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
      });
    });

    it('should close dialog when Cancel button is clicked', () => {
      const selectedIds = new Set(['scan-1']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      // Open confirmation dialog
      const deleteButton = screen.getByRole('button', { name: /delete 1 selected item/i });
      fireEvent.click(deleteButton);

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Delete Selected Items')).not.toBeInTheDocument();
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      const selectedIds = new Set(['scan-1']);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOnDelete.mockRejectedValue(new Error('Delete failed'));

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      // Open confirmation dialog
      const deleteButton = screen.getByRole('button', { name: /delete 1 selected item/i });
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to delete items:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      const selectedIds = new Set(['scan-1', 'scan-2']);

      render(
        <HistoryBulkActions
          selectedIds={selectedIds}
          onDelete={mockOnDelete}
          onClearSelection={mockOnClearSelection}
        />
      );

      expect(screen.getByLabelText('Clear selection')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete 2 selected items')).toBeInTheDocument();
    });
  });
});
