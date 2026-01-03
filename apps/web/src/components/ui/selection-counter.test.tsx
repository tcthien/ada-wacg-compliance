/**
 * Unit tests for SelectionCounter component
 *
 * Tests:
 * - Rendering and visibility states
 * - Selection count display format
 * - Clear Selection button
 * - Select All button
 * - Sticky positioning for mobile
 * - Animation transitions (in/out)
 * - Accessibility features
 * - Button interactions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionCounter, type SelectionCounterProps } from './selection-counter';

describe('SelectionCounter', () => {
  const defaultProps: SelectionCounterProps = {
    selectedCount: 5,
    totalCount: 20,
    onClearSelection: vi.fn(),
    onSelectAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      const { container } = render(<SelectionCounter {...defaultProps} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(container.textContent).toContain('5 of 20 items selected');
    });

    it('should display correct selection count format', () => {
      const { container } = render(<SelectionCounter {...defaultProps} selectedCount={3} totalCount={15} />);

      expect(container.textContent).toContain('3 of 15 items selected');
    });

    it('should use singular "item" when total is 1', () => {
      const { container } = render(<SelectionCounter {...defaultProps} selectedCount={1} totalCount={1} />);

      expect(container.textContent).toContain('1 of 1 item selected');
    });

    it('should use plural "items" when total is greater than 1', () => {
      const { container } = render(<SelectionCounter {...defaultProps} selectedCount={2} totalCount={10} />);

      expect(container.textContent).toContain('2 of 10 items selected');
    });

    it('should render Clear Selection button', () => {
      render(<SelectionCounter {...defaultProps} />);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should render Select All button when not all items are selected', () => {
      render(<SelectionCounter {...defaultProps} selectedCount={5} totalCount={10} />);

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      expect(selectAllButton).toBeInTheDocument();
    });

    it('should not render Select All button when all items are selected', () => {
      render(<SelectionCounter {...defaultProps} selectedCount={10} totalCount={10} />);

      expect(screen.queryByRole('button', { name: /select all/i })).not.toBeInTheDocument();
    });

    it('should render both buttons when some items are selected', () => {
      render(<SelectionCounter {...defaultProps} selectedCount={5} totalCount={10} />);

      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });
  });

  describe('Visibility and Animation', () => {
    it('should be visible when selectedCount is greater than 0', () => {
      const { container } = render(
        <SelectionCounter {...defaultProps} selectedCount={1} />
      );

      const counterDiv = container.querySelector('[role="status"]');
      expect(counterDiv).toHaveClass('opacity-100');
      expect(counterDiv).toHaveClass('translate-y-0');
      expect(counterDiv).not.toHaveClass('pointer-events-none');
    });

    it('should be hidden when selectedCount is 0', () => {
      const { container } = render(
        <SelectionCounter {...defaultProps} selectedCount={0} />
      );

      const counterDiv = container.querySelector('[role="status"]');
      expect(counterDiv).toHaveClass('opacity-0');
      expect(counterDiv).toHaveClass('translate-y-2');
      expect(counterDiv).toHaveClass('pointer-events-none');
    });

    it('should have transition classes for animation', () => {
      const { container } = render(<SelectionCounter {...defaultProps} />);

      const counterDiv = container.querySelector('[role="status"]');
      expect(counterDiv).toHaveClass('transition-all');
      expect(counterDiv).toHaveClass('duration-200');
      expect(counterDiv).toHaveClass('ease-in-out');
    });
  });

  describe('Sticky Positioning', () => {
    it('should not have sticky positioning by default', () => {
      const { container } = render(<SelectionCounter {...defaultProps} />);

      const counterDiv = container.querySelector('[role="status"]');
      expect(counterDiv).not.toHaveClass('sticky');
      expect(counterDiv).not.toHaveClass('bottom-4');
    });

    it('should have sticky positioning when sticky prop is true', () => {
      const { container } = render(<SelectionCounter {...defaultProps} sticky />);

      const counterDiv = container.querySelector('[role="status"]');
      expect(counterDiv).toHaveClass('sticky');
      expect(counterDiv).toHaveClass('bottom-4');
      expect(counterDiv).toHaveClass('z-10');
    });

    it('should not have sticky positioning when sticky prop is false', () => {
      const { container } = render(<SelectionCounter {...defaultProps} sticky={false} />);

      const counterDiv = container.querySelector('[role="status"]');
      expect(counterDiv).not.toHaveClass('sticky');
    });
  });

  describe('Button Interactions', () => {
    it('should call onClearSelection when Clear button is clicked', async () => {
      const user = userEvent.setup();
      const onClearSelection = vi.fn();

      render(
        <SelectionCounter {...defaultProps} onClearSelection={onClearSelection} />
      );

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);

      expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectAll when Select All button is clicked', async () => {
      const user = userEvent.setup();
      const onSelectAll = vi.fn();

      render(
        <SelectionCounter
          {...defaultProps}
          selectedCount={5}
          totalCount={10}
          onSelectAll={onSelectAll}
        />
      );

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple clicks on Clear button', async () => {
      const user = userEvent.setup();
      const onClearSelection = vi.fn();

      render(
        <SelectionCounter {...defaultProps} onClearSelection={onClearSelection} />
      );

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await user.click(clearButton);
      await user.click(clearButton);

      expect(onClearSelection).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple clicks on Select All button', async () => {
      const user = userEvent.setup();
      const onSelectAll = vi.fn();

      render(
        <SelectionCounter
          {...defaultProps}
          selectedCount={5}
          totalCount={10}
          onSelectAll={onSelectAll}
        />
      );

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);
      await user.click(selectAllButton);

      expect(onSelectAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('should have role="status" for screen readers', () => {
      render(<SelectionCounter {...defaultProps} />);

      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });

    it('should have aria-live="polite" for dynamic updates', () => {
      render(<SelectionCounter {...defaultProps} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-atomic="true" for complete announcements', () => {
      render(<SelectionCounter {...defaultProps} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-atomic', 'true');
    });

    it('should have proper button labels', () => {
      render(
        <SelectionCounter {...defaultProps} selectedCount={5} totalCount={10} />
      );

      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('should have aria-hidden on decorative icons', () => {
      const { container } = render(<SelectionCounter {...defaultProps} />);

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Visual Elements', () => {
    it('should display CheckSquare icon', () => {
      const { container } = render(<SelectionCounter {...defaultProps} />);

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should highlight selected count in primary color', () => {
      render(<SelectionCounter {...defaultProps} selectedCount={5} />);

      const selectedCountElement = screen.getByText('5');
      expect(selectedCountElement).toHaveClass('text-primary');
    });

    it('should have card styling', () => {
      const { container } = render(<SelectionCounter {...defaultProps} />);

      const counterDiv = container.querySelector('[role="status"]');
      expect(counterDiv).toHaveClass('bg-card');
      expect(counterDiv).toHaveClass('border');
      expect(counterDiv).toHaveClass('rounded-lg');
      expect(counterDiv).toHaveClass('shadow-sm');
    });
  });

  describe('Custom className', () => {
    it('should merge custom className with default classes', () => {
      const { container } = render(
        <SelectionCounter {...defaultProps} className="custom-class" />
      );

      const counterDiv = container.querySelector('.custom-class');
      expect(counterDiv).toBeInTheDocument();
      expect(counterDiv).toHaveClass('flex');
      expect(counterDiv).toHaveClass('items-center');
    });

    it('should preserve custom className when sticky is true', () => {
      const { container } = render(
        <SelectionCounter {...defaultProps} sticky className="my-custom-class" />
      );

      const counterDiv = container.querySelector('.my-custom-class');
      expect(counterDiv).toBeInTheDocument();
      expect(counterDiv).toHaveClass('sticky');
    });
  });

  describe('Edge Cases', () => {
    it('should handle selectedCount equal to totalCount', () => {
      const { container } = render(<SelectionCounter {...defaultProps} selectedCount={20} totalCount={20} />);

      expect(container.textContent).toContain('20 of 20 items selected');
      expect(screen.queryByRole('button', { name: /select all/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('should handle zero selectedCount', () => {
      const { container } = render(
        <SelectionCounter {...defaultProps} selectedCount={0} />
      );

      expect(container.textContent).toContain('0 of 20 items selected');

      const counterDiv = container.querySelector('[role="status"]');
      expect(counterDiv).toHaveClass('opacity-0');
    });

    it('should handle large numbers', () => {
      const { container } = render(
        <SelectionCounter {...defaultProps} selectedCount={999} totalCount={1000} />
      );

      expect(container.textContent).toContain('999 of 1000 items selected');
    });

    it('should handle single item selection', () => {
      const { container } = render(<SelectionCounter {...defaultProps} selectedCount={1} totalCount={1} />);

      expect(container.textContent).toContain('1 of 1 item selected');
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<SelectionCounter {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.getAttribute('role')).toBe('status');
    });
  });

  describe('Button Click Events', () => {
    it('should handle Clear button click with fireEvent', () => {
      const onClearSelection = vi.fn();

      render(
        <SelectionCounter {...defaultProps} onClearSelection={onClearSelection} />
      );

      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      expect(onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('should handle Select All button click with fireEvent', () => {
      const onSelectAll = vi.fn();

      render(
        <SelectionCounter
          {...defaultProps}
          selectedCount={5}
          totalCount={10}
          onSelectAll={onSelectAll}
        />
      );

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      fireEvent.click(selectAllButton);

      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });
  });
});
