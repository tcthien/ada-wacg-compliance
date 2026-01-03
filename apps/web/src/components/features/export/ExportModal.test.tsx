/**
 * Unit tests for ExportModal component
 *
 * Tests:
 * - All UI states (generating, completed, error)
 * - Button interactions
 * - Accessibility features
 * - Auto-dismiss behavior
 * - Focus trap and keyboard navigation
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportModal, type ExportModalProps } from './ExportModal';

describe('ExportModal', () => {
  // Default props for testing
  const defaultProps: ExportModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    format: 'pdf',
    status: 'generating',
    onRetry: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      const { container } = render(
        <ExportModal {...defaultProps} isOpen={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render modal when isOpen is true', () => {
      render(<ExportModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      render(<ExportModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'export-modal-title');
    });
  });

  describe('Generating state', () => {
    it('should show spinner and generating message', () => {
      render(<ExportModal {...defaultProps} status="generating" />);

      expect(
        screen.getByText('Generating PDF Report...')
      ).toBeInTheDocument();
      expect(
        screen.getByText('This may take a few moments')
      ).toBeInTheDocument();
    });

    it('should show correct format label for PDF', () => {
      render(
        <ExportModal {...defaultProps} status="generating" format="pdf" />
      );

      expect(
        screen.getByText('Generating PDF Report...')
      ).toBeInTheDocument();
    });

    it('should show correct format label for JSON', () => {
      render(
        <ExportModal {...defaultProps} status="generating" format="json" />
      );

      expect(
        screen.getByText('Generating JSON Report...')
      ).toBeInTheDocument();
    });

    it('should show cancel button', () => {
      render(<ExportModal {...defaultProps} status="generating" />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    it('should call onCancel when cancel button clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onCancel = vi.fn();

      render(
        <ExportModal {...defaultProps} status="generating" onCancel={onCancel} />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should display animated spinner', () => {
      const { container } = render(
        <ExportModal {...defaultProps} status="generating" />
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Completed state', () => {
    it('should show success icon and message', () => {
      render(<ExportModal {...defaultProps} status="completed" />);

      expect(screen.getByText('Download started!')).toBeInTheDocument();

      // Check for success icon (checkmark SVG)
      const successIcon = screen
        .getByText('Download started!')
        .closest('div')
        ?.querySelector('svg');
      expect(successIcon).toBeInTheDocument();
    });

    it('should auto-close after 2 seconds', async () => {
      const onClose = vi.fn();

      render(
        <ExportModal {...defaultProps} status="completed" onClose={onClose} />
      );

      // Should not close immediately
      expect(onClose).not.toHaveBeenCalled();

      // Fast-forward time by 2 seconds
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto-close if modal is closed before timeout', async () => {
      const onClose = vi.fn();

      const { rerender } = render(
        <ExportModal {...defaultProps} status="completed" onClose={onClose} />
      );

      // Close modal before timeout
      rerender(
        <ExportModal
          {...defaultProps}
          status="completed"
          isOpen={false}
          onClose={onClose}
        />
      );

      vi.advanceTimersByTime(2000);

      // onClose should not be called again
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should cancel auto-close timer if status changes', () => {
      const onClose = vi.fn();

      const { rerender } = render(
        <ExportModal {...defaultProps} status="completed" onClose={onClose} />
      );

      // Change status before timeout
      rerender(
        <ExportModal {...defaultProps} status="generating" onClose={onClose} />
      );

      vi.advanceTimersByTime(2000);

      // Should not auto-close
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should show green background for success icon', () => {
      const { container } = render(
        <ExportModal {...defaultProps} status="completed" />
      );

      const iconContainer = container.querySelector('.bg-green-100');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error icon and message', () => {
      render(
        <ExportModal
          {...defaultProps}
          status="error"
          errorMessage="Network error occurred"
        />
      );

      expect(
        screen.getByText('Failed to generate report')
      ).toBeInTheDocument();
      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });

    it('should show retry and close buttons', () => {
      render(<ExportModal {...defaultProps} status="error" />);

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('should call onRetry when retry button clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onRetry = vi.fn();

      render(
        <ExportModal {...defaultProps} status="error" onRetry={onRetry} />
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onClose = vi.fn();

      render(
        <ExportModal {...defaultProps} status="error" onClose={onClose} />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not show error message if not provided', () => {
      render(<ExportModal {...defaultProps} status="error" />);

      expect(
        screen.getByText('Failed to generate report')
      ).toBeInTheDocument();

      // No specific error message should be shown
      const errorMessages = screen.queryByText(/network|failed/i, {
        exact: false,
      });

      // Only the generic "Failed to generate report" should exist
      expect(errorMessages).toBe(
        screen.getByText('Failed to generate report')
      );
    });

    it('should show red background for error icon', () => {
      const { container } = render(
        <ExportModal {...defaultProps} status="error" />
      );

      const iconContainer = container.querySelector('.bg-red-100');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria attributes', () => {
      render(<ExportModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'export-modal-title');
    });

    it('should focus first focusable element when opened', async () => {
      render(<ExportModal {...defaultProps} status="generating" />);

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        expect(cancelButton).toHaveFocus();
      });
    });

    it('should focus retry button in error state', async () => {
      render(<ExportModal {...defaultProps} status="error" />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toHaveFocus();
      });
    });

    it('should close modal on Escape key', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onClose = vi.fn();

      render(<ExportModal {...defaultProps} onClose={onClose} />);

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should trap focus within modal', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      render(<ExportModal {...defaultProps} status="error" />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Focus should start on first button
      await waitFor(() => {
        expect(retryButton).toHaveFocus();
      });

      // Tab to next button
      await user.tab();
      expect(closeButton).toHaveFocus();

      // Tab should wrap back to first button
      await user.tab();
      expect(retryButton).toHaveFocus();

      // Shift+Tab should go to last button
      await user.tab({ shift: true });
      expect(closeButton).toHaveFocus();
    });

    it('should mark icons as aria-hidden', () => {
      const { container } = render(
        <ExportModal {...defaultProps} status="completed" />
      );

      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have proper title for screen readers', () => {
      render(<ExportModal {...defaultProps} status="generating" />);

      const title = screen.getByText('Generating PDF Report...');
      expect(title).toHaveAttribute('id', 'export-modal-title');
    });
  });

  describe('Modal backdrop', () => {
    it('should close modal when backdrop is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onClose = vi.fn();

      render(<ExportModal {...defaultProps} onClose={onClose} />);

      const backdrop = screen.getByRole('dialog').parentElement;
      expect(backdrop).toBeInTheDocument();

      if (backdrop) {
        await user.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should not close when modal content is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onClose = vi.fn();

      render(<ExportModal {...defaultProps} onClose={onClose} />);

      const modalContent = screen.getByRole('dialog');
      await user.click(modalContent);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should have semi-transparent black backdrop', () => {
      const { container } = render(<ExportModal {...defaultProps} />);

      const backdrop = container.querySelector('.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
    });
  });

  describe('Lifecycle and cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<ExportModal {...defaultProps} />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should cleanup timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = render(
        <ExportModal {...defaultProps} status="completed" />
      );

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should not add event listeners when modal is closed', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const initialCallCount = addEventListenerSpy.mock.calls.length;

      render(<ExportModal {...defaultProps} isOpen={false} />);

      // Should not add any new event listeners
      expect(addEventListenerSpy.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Format handling', () => {
    it('should handle PDF format correctly', () => {
      render(<ExportModal {...defaultProps} format="pdf" status="generating" />);

      expect(
        screen.getByText('Generating PDF Report...')
      ).toBeInTheDocument();
    });

    it('should handle JSON format correctly', () => {
      render(
        <ExportModal {...defaultProps} format="json" status="generating" />
      );

      expect(
        screen.getByText('Generating JSON Report...')
      ).toBeInTheDocument();
    });
  });

  describe('Visual styling', () => {
    it('should have centered modal layout', () => {
      const { container } = render(<ExportModal {...defaultProps} />);

      const backdrop = container.querySelector('.flex.items-center.justify-center');
      expect(backdrop).toBeInTheDocument();
    });

    it('should have white rounded modal content', () => {
      const { container } = render(<ExportModal {...defaultProps} />);

      const modalContent = container.querySelector('.bg-white.rounded-lg');
      expect(modalContent).toBeInTheDocument();
    });

    it('should have responsive max-width', () => {
      const { container } = render(<ExportModal {...defaultProps} />);

      const modalContent = container.querySelector('.max-w-md');
      expect(modalContent).toBeInTheDocument();
    });

    it('should have proper spacing between elements', () => {
      render(<ExportModal {...defaultProps} status="generating" />);

      const container = screen.getByText('This may take a few moments').closest('div');
      expect(container?.className).toContain('space-y-4');
    });
  });
});
