/**
 * Unit tests for CopyButton and CopyFallbackModal components
 *
 * Tests:
 * - All variants (icon, button, inline)
 * - All sizes (sm, md, lg)
 * - Success feedback timing
 * - Clipboard API success/failure scenarios
 * - Fallback modal trigger on SecurityError
 * - Callback functions (onCopy, onError)
 * - Accessibility features
 * - Keyboard interactions
 * - Lifecycle and cleanup
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyButton, copyToClipboard, type CopyButtonProps } from './copy-button';
import { CopyFallbackModal, type CopyFallbackModalProps } from './copy-fallback-modal';

// Mock navigator.clipboard
const mockWriteText = vi.fn();

describe('copyToClipboard utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });
  });

  it('should successfully copy text to clipboard', async () => {
    mockWriteText.mockResolvedValueOnce(undefined);

    const result = await copyToClipboard('test text');

    expect(mockWriteText).toHaveBeenCalledWith('test text');
    expect(result).toEqual({ success: true, isSecurityError: false });
  });

  it('should handle SecurityError from clipboard API', async () => {
    const securityError = new DOMException('Permission denied', 'SecurityError');
    mockWriteText.mockRejectedValueOnce(securityError);

    const result = await copyToClipboard('test text');

    expect(result).toEqual({ success: false, isSecurityError: true });
  });

  it('should handle NotAllowedError from clipboard API', async () => {
    const notAllowedError = new DOMException('Not allowed', 'NotAllowedError');
    mockWriteText.mockRejectedValueOnce(notAllowedError);

    const result = await copyToClipboard('test text');

    expect(result).toEqual({ success: false, isSecurityError: true });
  });

  it('should handle generic errors', async () => {
    const genericError = new Error('Generic error');
    mockWriteText.mockRejectedValueOnce(genericError);

    const result = await copyToClipboard('test text');

    expect(result).toEqual({ success: false, isSecurityError: false });
  });

  it('should log errors to console', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');
    mockWriteText.mockRejectedValueOnce(error);

    await copyToClipboard('test text');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', error);
    consoleErrorSpy.mockRestore();
  });
});

describe('CopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Delete and redefine navigator.clipboard to avoid conflicts
    delete (navigator as any).clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: false,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // Clean up clipboard mock
    delete (navigator as any).clipboard;
  });

  const defaultProps: CopyButtonProps = {
    text: 'Copy this text',
  };

  describe('Rendering', () => {
    it('should render button with default props', () => {
      render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /copy to clipboard/i });
      expect(button).toBeInTheDocument();
    });

    it('should render with custom label', () => {
      render(<CopyButton {...defaultProps} label="Copy URL" />);

      const button = screen.getByRole('button', { name: /copy url/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Copy URL')).toBeInTheDocument();
    });

    it('should render as disabled when disabled prop is true', () => {
      render(<CopyButton {...defaultProps} disabled />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should display copy icon by default', () => {
      const { container } = render(<CopyButton {...defaultProps} />);

      const copyIcon = container.querySelector('svg');
      expect(copyIcon).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should render icon variant correctly', () => {
      const { container } = render(<CopyButton {...defaultProps} variant="icon" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Copy to clipboard');

      // Icon variant should only show icon, no text
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('should render button variant correctly', () => {
      render(<CopyButton {...defaultProps} variant="button" />);

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should render inline variant correctly', () => {
      render(<CopyButton {...defaultProps} variant="inline" />);

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should use default variant when not specified', () => {
      render(<CopyButton {...defaultProps} />);

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should show custom label in button variant', () => {
      render(<CopyButton {...defaultProps} variant="button" label="Copy Code" />);

      expect(screen.getByText('Copy Code')).toBeInTheDocument();
    });

    it('should show custom label in inline variant', () => {
      render(<CopyButton {...defaultProps} variant="inline" label="Copy Link" />);

      expect(screen.getByText('Copy Link')).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('should render small size', () => {
      render(<CopyButton {...defaultProps} size="sm" />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should render medium size', () => {
      render(<CopyButton {...defaultProps} size="md" />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should render large size', () => {
      render(<CopyButton {...defaultProps} size="lg" />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should use default size when not specified', () => {
      render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Copy functionality', () => {
    it('should copy text to clipboard on click', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Copy this text');
      });
    });

    it('should call onCopy callback on successful copy', async () => {
      const onCopy = vi.fn();
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} onCopy={onCopy} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalledTimes(1);
      });
    });

    it('should show success feedback after copying', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} variant="button" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const updatedButton = screen.getByRole('button', { name: /copied/i });
        expect(updatedButton).toBeInTheDocument();
      });
    });

    it('should show "Copied!" text in inline variant after copying', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} variant="inline" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('should show tooltip for icon variant after copying', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} variant="icon" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const tooltip = screen.getByText('Copied!');
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveAttribute('role', 'status');
        expect(tooltip).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should display check icon after successful copy', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      const { container } = render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const checkIcon = container.querySelector('svg');
        expect(checkIcon).toBeInTheDocument();
      });
    });
  });

  describe('Success feedback timing', () => {
    it('should reset success state after default duration (2000ms)', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} variant="inline" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      // Fast-forward time by 2 seconds
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
        expect(screen.getByText('Copy')).toBeInTheDocument();
      });
    });

    it('should reset success state after custom duration', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} variant="inline" successDuration={1000} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      // Fast-forward time by 1 second
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      });
    });

    it('should clear previous timeout when copying again', async () => {
      mockWriteText.mockResolvedValue(undefined);

      render(<CopyButton {...defaultProps} variant="inline" successDuration={2000} />);

      const button = screen.getByRole('button');

      // First copy
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      // Advance time partially
      vi.advanceTimersByTime(1000);

      // Second copy (should reset timer)
      fireEvent.click(button);

      // Advance time by another 1 second (total 2 seconds from first click, but only 1 from second)
      vi.advanceTimersByTime(1000);

      // Should still show "Copied!" because timer was reset
      expect(screen.getByText('Copied!')).toBeInTheDocument();

      // Advance remaining time
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      });
    });

    it('should cleanup timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      mockWriteText.mockResolvedValueOnce(undefined);

      const { unmount } = render(<CopyButton {...defaultProps} />);

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should show fallback modal on SecurityError', async () => {
      const securityError = new DOMException('Permission denied', 'SecurityError');
      mockWriteText.mockRejectedValueOnce(securityError);

      render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();
      });
    });

    it('should show fallback modal on NotAllowedError', async () => {
      const notAllowedError = new DOMException('Not allowed', 'NotAllowedError');
      mockWriteText.mockRejectedValueOnce(notAllowedError);

      render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should call onError callback on generic error', async () => {
      const onError = vi.fn();
      const genericError = new Error('Generic error');
      mockWriteText.mockRejectedValueOnce(genericError);

      render(<CopyButton {...defaultProps} onError={onError} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Failed to copy to clipboard',
        }));
      });
    });

    it('should not show fallback modal on generic error', async () => {
      const genericError = new Error('Generic error');
      mockWriteText.mockRejectedValueOnce(genericError);

      render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should not call onCopy on error', async () => {
      const onCopy = vi.fn();
      const genericError = new Error('Generic error');
      mockWriteText.mockRejectedValueOnce(genericError);

      render(<CopyButton {...defaultProps} onCopy={onCopy} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onCopy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label', () => {
      render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button', { name: /copy to clipboard/i });
      expect(button).toBeInTheDocument();
    });

    it('should update aria-label after copying', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const updatedButton = screen.getByRole('button', { name: /copied/i });
        expect(updatedButton).toBeInTheDocument();
      });
    });

    it('should use custom label in aria-label', () => {
      render(<CopyButton {...defaultProps} label="Copy Code" />);

      const button = screen.getByRole('button', { name: /copy code/i });
      expect(button).toBeInTheDocument();
    });

    it('should have aria-live region for success tooltip', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);

      render(<CopyButton {...defaultProps} variant="icon" />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status).toHaveTextContent('Copied!');
      });
    });
  });

  describe('Custom className', () => {
    it('should merge custom className with default classes', () => {
      const { container } = render(<CopyButton {...defaultProps} className="custom-class" />);

      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('HTML attributes', () => {
    it('should support data-testid attribute', () => {
      render(<CopyButton {...defaultProps} data-testid="copy-btn" />);

      const button = screen.getByTestId('copy-btn');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    it('should support id attribute', () => {
      render(<CopyButton {...defaultProps} id="copy-button-1" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('id', 'copy-button-1');
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<CopyButton {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current?.tagName).toBe('BUTTON');
    });
  });
});

describe('CopyFallbackModal', () => {
  const defaultProps: CopyFallbackModalProps = {
    isOpen: true,
    onClose: vi.fn(),
    text: 'Text to copy manually',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      const { container } = render(
        <CopyFallbackModal {...defaultProps} isOpen={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render modal when isOpen is true', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
    });

    it('should display title', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();
    });

    it('should display description', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      expect(
        screen.getByText(/your browser denied clipboard access/i)
      ).toBeInTheDocument();
    });

    it('should display text in input field', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const input = screen.getByDisplayValue('Text to copy manually');
      expect(input).toBeInTheDocument();
    });

    it('should render Select All button', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      expect(selectAllButton).toBeInTheDocument();
    });

    it('should render Close button', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Input field', () => {
    it('should have readonly input', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const input = screen.getByDisplayValue('Text to copy manually') as HTMLInputElement;
      expect(input).toHaveAttribute('readonly');
    });

    it('should auto-focus and select text when opened', async () => {
      render(<CopyFallbackModal {...defaultProps} />);

      await waitFor(() => {
        const input = screen.getByDisplayValue('Text to copy manually');
        expect(input).toHaveFocus();
      });
    });

    it('should have proper aria-label', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const input = screen.getByLabelText('Text to copy');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Button interactions', () => {
    it('should select all text when Select All button is clicked', async () => {
      const user = userEvent.setup();

      render(<CopyFallbackModal {...defaultProps} />);

      const input = screen.getByDisplayValue('Text to copy manually') as HTMLInputElement;
      const selectAllButton = screen.getByRole('button', { name: /select all/i });

      // Clear focus first
      input.blur();
      expect(input).not.toHaveFocus();

      await user.click(selectAllButton);

      expect(input).toHaveFocus();
    });

    it('should call onClose when Close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<CopyFallbackModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const { container } = render(<CopyFallbackModal {...defaultProps} onClose={onClose} />);

      // Find the backdrop by looking for the fixed inset div
      const backdrop = container.querySelector('.fixed.inset-0');
      expect(backdrop).toBeInTheDocument();

      if (backdrop) {
        await user.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should not close when modal content is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const { container } = render(<CopyFallbackModal {...defaultProps} onClose={onClose} />);

      // Click on the inner modal content (white box), not the backdrop
      const modalContent = container.querySelector('.bg-white');
      expect(modalContent).toBeInTheDocument();

      if (modalContent) {
        await user.click(modalContent);
        // Should not close because stopPropagation is called on modal content
        expect(onClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('Keyboard interactions', () => {
    it('should close modal on Escape key', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<CopyFallbackModal {...defaultProps} onClose={onClose} />);

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should trap focus within modal', async () => {
      const user = userEvent.setup();

      render(<CopyFallbackModal {...defaultProps} />);

      const input = screen.getByDisplayValue('Text to copy manually');
      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Focus should start on input
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      // Tab to Select All button
      await user.tab();
      expect(selectAllButton).toHaveFocus();

      // Tab to Close button
      await user.tab();
      expect(closeButton).toHaveFocus();

      // Tab should wrap back to input
      await user.tab();
      expect(input).toHaveFocus();

      // Shift+Tab should go back to Close button
      await user.tab({ shift: true });
      expect(closeButton).toHaveFocus();
    });

    it('should handle Tab key navigation correctly', async () => {
      const user = userEvent.setup();

      render(<CopyFallbackModal {...defaultProps} />);

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Start from Select All button
      selectAllButton.focus();
      expect(selectAllButton).toHaveFocus();

      // Tab to Close button
      await user.tab();
      expect(closeButton).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'copy-fallback-title');
      expect(modal).toHaveAttribute('aria-describedby', 'copy-fallback-description');
    });

    it('should have proper title id', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const title = screen.getByText('Copy to clipboard');
      expect(title).toHaveAttribute('id', 'copy-fallback-title');
    });

    it('should have proper description id', () => {
      render(<CopyFallbackModal {...defaultProps} />);

      const description = screen.getByText(/your browser denied clipboard access/i);
      expect(description).toHaveAttribute('id', 'copy-fallback-description');
    });
  });

  describe('Visual styling', () => {
    it('should have semi-transparent backdrop', () => {
      const { container } = render(<CopyFallbackModal {...defaultProps} />);

      const backdrop = container.querySelector('.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
    });

    it('should have white rounded modal content', () => {
      const { container } = render(<CopyFallbackModal {...defaultProps} />);

      const modalContent = container.querySelector('.bg-white.rounded-lg');
      expect(modalContent).toBeInTheDocument();
    });

    it('should have proper max-width', () => {
      const { container } = render(<CopyFallbackModal {...defaultProps} />);

      const modalContent = container.querySelector('.max-w-md');
      expect(modalContent).toBeInTheDocument();
    });
  });

  describe('Lifecycle and cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<CopyFallbackModal {...defaultProps} />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should not add event listeners when modal is closed', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const initialCallCount = addEventListenerSpy.mock.calls.length;

      render(<CopyFallbackModal {...defaultProps} isOpen={false} />);

      // Should not add any new event listeners
      expect(addEventListenerSpy.mock.calls.length).toBe(initialCallCount);
    });
  });
});

describe('CopyButton and CopyFallbackModal integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Delete and redefine navigator.clipboard to avoid conflicts
    delete (navigator as any).clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: false,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up clipboard mock
    delete (navigator as any).clipboard;
  });

  it('should show fallback modal when clipboard access is denied', async () => {
    const securityError = new DOMException('Permission denied', 'SecurityError');
    mockWriteText.mockRejectedValueOnce(securityError);

    render(<CopyButton text="Test text" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test text')).toBeInTheDocument();
    });
  });

  it('should close fallback modal when Close button is clicked', async () => {
    const user = userEvent.setup();
    const securityError = new DOMException('Permission denied', 'SecurityError');
    mockWriteText.mockRejectedValueOnce(securityError);

    render(<CopyButton text="Test text" />);

    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should pass correct text to fallback modal', async () => {
    const securityError = new DOMException('Permission denied', 'SecurityError');
    mockWriteText.mockRejectedValueOnce(securityError);

    const testText = 'https://example.com/very/long/url';
    render(<CopyButton text={testText} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const input = screen.getByDisplayValue(testText);
      expect(input).toBeInTheDocument();
    });
  });
});
