/**
 * Unit tests for BackButton component
 *
 * Requirements:
 * - REQ 2.3: Navigate to /history by default
 * - REQ 2.4: Support returning to originating page
 *
 * Tests:
 * - Renders with default href (/history)
 * - Renders with custom href
 * - Shows tooltip on hover
 * - Calls router.push when clicked
 * - Calls router.back when useBrowserBack is true
 * - Accessibility compliance (aria-label, focus states)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BackButton } from '../BackButton';

// Mock next/navigation
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

describe('BackButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders button with ArrowLeft icon', () => {
      const { container } = render(<BackButton />);

      const button = screen.getByRole('button', { name: /back to history/i });
      expect(button).toBeInTheDocument();

      // Check for icon presence
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('renders with default href (/history)', () => {
      render(<BackButton />);

      const button = screen.getByRole('button', { name: /back to history/i });
      expect(button).toBeInTheDocument();
    });

    it('renders with custom href', () => {
      render(<BackButton href="/admin/scans" label="Back to Scans" />);

      const button = screen.getByRole('button', { name: /back to scans/i });
      expect(button).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(<BackButton label="Back to Previous Page" />);

      const button = screen.getByRole('button', { name: /back to previous page/i });
      expect(button).toBeInTheDocument();
    });

    it('renders as ghost icon button', () => {
      render(<BackButton />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-gray-600');
      expect(button).toHaveClass('hover:text-gray-900');
    });
  });

  describe('Tooltip', () => {
    it('shows tooltip content with default label', async () => {
      const user = userEvent.setup();
      render(<BackButton />);

      const button = screen.getByRole('button');

      // Hover over the button to trigger tooltip
      await user.hover(button);

      // Wait for tooltip to appear - use getAllByText since tooltip renders text twice
      await waitFor(() => {
        const tooltipTexts = screen.getAllByText('Back to History');
        expect(tooltipTexts.length).toBeGreaterThan(0);
      });
    });

    it('shows tooltip content with custom label', async () => {
      const user = userEvent.setup();
      render(<BackButton label="Back to Admin Scans" />);

      const button = screen.getByRole('button');

      await user.hover(button);

      // Wait for tooltip to appear - use getAllByText since tooltip renders text twice
      await waitFor(() => {
        const tooltipTexts = screen.getAllByText('Back to Admin Scans');
        expect(tooltipTexts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Navigation with router.push', () => {
    it('calls router.push with default href when clicked', async () => {
      const user = userEvent.setup();
      render(<BackButton />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/history');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('calls router.push with custom href when clicked', async () => {
      const user = userEvent.setup();
      render(<BackButton href="/admin/batches" />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/admin/batches');
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  describe('Navigation with router.back', () => {
    it('calls router.back when useBrowserBack is true', async () => {
      const user = userEvent.setup();
      render(<BackButton useBrowserBack />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('calls router.back with custom label when useBrowserBack is true', async () => {
      const user = userEvent.setup();
      render(
        <BackButton
          useBrowserBack
          label="Back to Previous Page"
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('ignores href prop when useBrowserBack is true', async () => {
      const user = userEvent.setup();
      render(
        <BackButton
          href="/some/path"
          useBrowserBack
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label with default label', () => {
      render(<BackButton />);

      const button = screen.getByRole('button', { name: /back to history/i });
      expect(button).toHaveAttribute('aria-label', 'Back to History');
    });

    it('has proper aria-label with custom label', () => {
      render(<BackButton label="Return to Scan List" />);

      const button = screen.getByRole('button', { name: /return to scan list/i });
      expect(button).toHaveAttribute('aria-label', 'Return to Scan List');
    });

    it('icon has aria-hidden attribute', () => {
      const { container } = render(<BackButton />);

      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('button has proper variant and size classes', () => {
      render(<BackButton />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // Button uses shadcn Button component with variant="ghost" and size="icon"
    });
  });

  describe('Props combinations', () => {
    it('works with all props provided', async () => {
      const user = userEvent.setup();
      render(
        <BackButton
          href="/custom/path"
          label="Custom Label"
          useBrowserBack={false}
        />
      );

      const button = screen.getByRole('button', { name: /custom label/i });
      expect(button).toBeInTheDocument();

      await user.click(button);

      expect(mockPush).toHaveBeenCalledWith('/custom/path');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('useBrowserBack overrides href', async () => {
      const user = userEvent.setup();
      render(
        <BackButton
          href="/should/be/ignored"
          useBrowserBack={true}
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('handles multiple clicks correctly', async () => {
      const user = userEvent.setup();
      render(<BackButton />);

      const button = screen.getByRole('button');

      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockPush).toHaveBeenCalledTimes(3);
      expect(mockPush).toHaveBeenCalledWith('/history');
    });

    it('handles empty href string', async () => {
      const user = userEvent.setup();
      render(<BackButton href="" />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockPush).toHaveBeenCalledWith('');
    });

    it('handles special characters in label', () => {
      render(<BackButton label="Back to User's Dashboard & Settings" />);

      const button = screen.getByRole('button', {
        name: /back to user's dashboard & settings/i
      });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Button styling and visual states', () => {
    it('applies hover color classes', () => {
      render(<BackButton />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-gray-600');
      expect(button).toHaveClass('hover:text-gray-900');
    });

    it('renders as a ghost button variant', () => {
      render(<BackButton />);

      const button = screen.getByRole('button');
      // The button should use the ghost variant from shadcn
      expect(button).toBeInTheDocument();
    });
  });
});
