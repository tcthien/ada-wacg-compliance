/**
 * Unit tests for ScanConsole component
 * Tests event rendering, filtering, auto-scroll, collapse/expand, and virtualization
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanConsole } from './ScanConsole';
import { ScanEvent, LogLevel } from '@/types/scan-event';
import { ScanStatus } from '@/lib/api';

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock LogEntry component
vi.mock('./LogEntry', () => ({
  LogEntry: ({ event, isAdmin }: any) =>
    event
      ? React.createElement(
          'div',
          { 'data-testid': 'log-entry', 'data-event-id': event.id },
          event.message
        )
      : null,
}));

// Mock useScanEvents hook
const mockUseScanEvents = vi.fn();
vi.mock('@/hooks/useScanEvents', () => ({
  useScanEvents: (scanId: string, scanStatus: ScanStatus, options: any) =>
    mockUseScanEvents(scanId, scanStatus, options),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronDown: ({ className, ...props }: any) =>
    React.createElement('div', {
      'data-testid': 'chevron-down',
      className,
      ...props,
    }),
  ChevronUp: ({ className, ...props }: any) =>
    React.createElement('div', {
      'data-testid': 'chevron-up',
      className,
      ...props,
    }),
  Terminal: ({ className, ...props }: any) =>
    React.createElement('div', {
      'data-testid': 'terminal-icon',
      className,
      ...props,
    }),
}));

// Mock @tanstack/react-virtual
const mockScrollToIndex = vi.fn();
const mockMeasureElement = vi.fn();
const mockVirtualizer = {
  getVirtualItems: vi.fn(() => []),
  getTotalSize: vi.fn(() => 0),
  scrollToIndex: mockScrollToIndex,
  measureElement: mockMeasureElement,
};

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => mockVirtualizer),
}));

// Import the mock after setting it up
import { useVirtualizer } from '@tanstack/react-virtual';

describe('ScanConsole', () => {
  // Helper function to create mock scan events
  const createMockEvent = (
    overrides: Partial<ScanEvent> = {}
  ): ScanEvent => ({
    id: `event-${Math.random()}`,
    scanId: 'scan-123',
    type: 'INFO',
    level: 'INFO',
    message: 'Test message',
    metadata: null,
    adminOnly: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  // Helper function to create multiple events
  const createMockEvents = (count: number): ScanEvent[] => {
    return Array.from({ length: count }, (_, i) =>
      createMockEvent({
        id: `event-${i}`,
        message: `Event ${i + 1}`,
        level: (i % 2 === 0 ? 'INFO' : 'SUCCESS') as LogLevel,
      })
    );
  };

  // Default props for ScanConsole
  const defaultProps = {
    scanId: 'scan-123',
    scanStatus: 'RUNNING' as ScanStatus,
    isExpanded: true,
    onToggle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockUseScanEvents.mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('should render the console header with scan ID', () => {
      render(<ScanConsole {...defaultProps} />);

      expect(screen.getByText('Scan Console')).toBeInTheDocument();
      expect(screen.getByText(/ID: scan-12/)).toBeInTheDocument();
    });

    it('should render with expanded state', () => {
      const { container } = render(
        <ScanConsole {...defaultProps} isExpanded={true} />
      );

      const header = container.querySelector('[role="button"][aria-expanded]');
      expect(header).toHaveAttribute('aria-expanded', 'true');
    });

    it('should render with collapsed state', () => {
      const { container } = render(
        <ScanConsole {...defaultProps} isExpanded={false} />
      );

      const header = container.querySelector('[role="button"][aria-expanded]');
      expect(header).toHaveAttribute('aria-expanded', 'false');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <ScanConsole {...defaultProps} className="custom-class" />
      );

      const consoleDiv = container.firstChild;
      expect(consoleDiv).toHaveClass('custom-class');
    });
  });

  describe('Header Interaction', () => {
    it('should call onToggle when header is clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();

      render(<ScanConsole {...defaultProps} onToggle={onToggle} />);

      const header = screen.getByRole('button', { name: /collapse console/i });
      await user.click(header);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should call onToggle when toggle button is clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();

      render(<ScanConsole {...defaultProps} onToggle={onToggle} />);

      const toggleButton = screen.getByRole('button', {
        name: /collapse console/i,
      });
      await user.click(toggleButton);

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should call onToggle when Enter key is pressed on header', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();

      render(<ScanConsole {...defaultProps} onToggle={onToggle} />);

      const header = screen.getByRole('button', { name: /collapse console/i });
      header.focus();
      await user.keyboard('{Enter}');

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should call onToggle when Space key is pressed on header', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();

      render(<ScanConsole {...defaultProps} onToggle={onToggle} />);

      const header = screen.getByRole('button', { name: /collapse console/i });
      header.focus();
      await user.keyboard(' ');

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should show ChevronUp icon when expanded', () => {
      const { container } = render(
        <ScanConsole {...defaultProps} isExpanded={true} />
      );

      expect(
        container.querySelector('[data-testid="chevron-up"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-testid="chevron-down"]')
      ).not.toBeInTheDocument();
    });

    it('should show ChevronDown icon when collapsed', () => {
      const { container } = render(
        <ScanConsole {...defaultProps} isExpanded={false} />
      );

      expect(
        container.querySelector('[data-testid="chevron-down"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-testid="chevron-up"]')
      ).not.toBeInTheDocument();
    });
  });

  describe('Event Rendering', () => {
    it('should render events using LogEntry components', () => {
      const events = createMockEvents(3);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      // Mock virtualizer to show all items
      mockVirtualizer.getVirtualItems.mockReturnValue(
        events.map((_, index) => ({
          key: `event-${index}`,
          index,
          start: index * 40,
        }))
      );
      mockVirtualizer.getTotalSize.mockReturnValue(events.length * 40);

      render(<ScanConsole {...defaultProps} />);

      expect(screen.getByText('Event 1')).toBeInTheDocument();
      expect(screen.getByText('Event 2')).toBeInTheDocument();
      expect(screen.getByText('Event 3')).toBeInTheDocument();
    });

    it('should pass isAdmin: false to LogEntry components', () => {
      const events = [createMockEvent({ message: 'Test event' })];
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      mockVirtualizer.getVirtualItems.mockReturnValue([
        { key: 'event-0', index: 0, start: 0 },
      ]);

      render(<ScanConsole {...defaultProps} />);

      // Verify useScanEvents was called with isAdmin: false
      expect(mockUseScanEvents).toHaveBeenCalledWith(
        'scan-123',
        'RUNNING',
        expect.objectContaining({ isAdmin: false })
      );
    });

    it('should limit display to 50 most recent events', () => {
      const events = createMockEvents(100);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      // Mock virtualizer to return last 50 events
      const displayEvents = events.slice(-50);
      mockVirtualizer.getVirtualItems.mockReturnValue(
        displayEvents.map((_, index) => ({
          key: `event-${index}`,
          index,
          start: index * 40,
        }))
      );
      mockVirtualizer.getTotalSize.mockReturnValue(displayEvents.length * 40);

      render(<ScanConsole {...defaultProps} />);

      // Should show events 51-100
      expect(screen.getByText('Event 51')).toBeInTheDocument();
      expect(screen.getByText('Event 100')).toBeInTheDocument();

      // Should NOT show events 1-50
      expect(screen.queryByText('Event 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Event 50')).not.toBeInTheDocument();
    });
  });

  describe('Admin-Only Event Filtering', () => {
    it('should filter out adminOnly events via useScanEvents hook', () => {
      // The hook filters adminOnly events, so we test that the hook is called correctly
      mockUseScanEvents.mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
      });

      render(<ScanConsole {...defaultProps} />);

      // Verify hook was called with isAdmin: false
      expect(mockUseScanEvents).toHaveBeenCalledWith(
        'scan-123',
        'RUNNING',
        expect.objectContaining({ isAdmin: false })
      );
    });

    it('should only display non-admin events returned by hook', () => {
      // Hook returns only non-admin events
      const publicEvents = [
        createMockEvent({ message: 'Public event 1', adminOnly: false }),
        createMockEvent({ message: 'Public event 2', adminOnly: false }),
      ];

      mockUseScanEvents.mockReturnValue({
        events: publicEvents,
        isLoading: false,
        error: null,
      });

      mockVirtualizer.getVirtualItems.mockReturnValue(
        publicEvents.map((_, index) => ({
          key: `event-${index}`,
          index,
          start: index * 40,
        }))
      );

      render(<ScanConsole {...defaultProps} />);

      expect(screen.getByText('Public event 1')).toBeInTheDocument();
      expect(screen.getByText('Public event 2')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when isLoading is true and no events', () => {
      mockUseScanEvents.mockReturnValue({
        events: [],
        isLoading: true,
        error: null,
      });

      render(<ScanConsole {...defaultProps} />);

      expect(screen.getByText('Loading events...')).toBeInTheDocument();
      expect(screen.getByText(/Scan ID: scan-12/)).toBeInTheDocument();
    });

    it('should not show loading state when events are present', () => {
      const events = createMockEvents(3);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: true,
        error: null,
      });

      mockVirtualizer.getVirtualItems.mockReturnValue(
        events.map((_, index) => ({
          key: `event-${index}`,
          index,
          start: index * 40,
        }))
      );

      render(<ScanConsole {...defaultProps} />);

      expect(screen.queryByText('Loading events...')).not.toBeInTheDocument();
    });

    it('should show "Updating..." in collapsed view when loading', () => {
      const events = createMockEvents(2);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: true,
        error: null,
      });

      render(<ScanConsole {...defaultProps} isExpanded={false} />);

      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when error occurs', () => {
      mockUseScanEvents.mockReturnValue({
        events: [],
        isLoading: false,
        error: 'Network error',
      });

      render(<ScanConsole {...defaultProps} />);

      expect(screen.getByText('Failed to load events')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should hide events when error occurs', () => {
      const events = createMockEvents(2);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: 'Network error',
      });

      render(<ScanConsole {...defaultProps} />);

      expect(screen.queryByText('Event 1')).not.toBeInTheDocument();
      expect(screen.getByText('Failed to load events')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no events and not loading', () => {
      mockUseScanEvents.mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
      });

      render(<ScanConsole {...defaultProps} />);

      expect(screen.getByText('No events yet')).toBeInTheDocument();
      expect(
        screen.getByText('Waiting for scan to start...')
      ).toBeInTheDocument();
    });
  });

  describe('Collapsed Summary View', () => {
    it('should show event count when collapsed', () => {
      const events = createMockEvents(5);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      render(<ScanConsole {...defaultProps} isExpanded={false} />);

      expect(screen.getByText('5 events')).toBeInTheDocument();
    });

    it('should show singular "event" for 1 event', () => {
      const events = createMockEvents(1);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      render(<ScanConsole {...defaultProps} isExpanded={false} />);

      expect(screen.getByText('1 event')).toBeInTheDocument();
    });

    it('should show last event message when collapsed', () => {
      const events = [
        createMockEvent({ message: 'First event' }),
        createMockEvent({ message: 'Second event' }),
        createMockEvent({ message: 'Last event message' }),
      ];
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      render(<ScanConsole {...defaultProps} isExpanded={false} />);

      // Check that the summary contains the last message
      const summaryTexts = screen.getAllByText('Last event message');
      expect(summaryTexts.length).toBeGreaterThan(0);
    });

    it('should not show summary when expanded', () => {
      const events = createMockEvents(3);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      render(<ScanConsole {...defaultProps} isExpanded={true} />);

      // Summary text should not be visible
      const summaryText = screen.queryByText(/3 events/);
      expect(summaryText).not.toBeInTheDocument();
    });
  });

  describe('Virtualization', () => {
    it('should initialize virtualizer with correct configuration', () => {
      const events = createMockEvents(100);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      render(<ScanConsole {...defaultProps} />);

      expect(useVirtualizer).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 50, // Limited to 50 events
          estimateSize: expect.any(Function),
          overscan: 5,
        })
      );
    });

    it('should render only virtualized items', () => {
      const events = createMockEvents(100);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      // Mock virtualizer to return only first 10 visible items
      const visibleItems = Array.from({ length: 10 }, (_, index) => ({
        key: `event-${index}`,
        index,
        start: index * 40,
      }));
      mockVirtualizer.getVirtualItems.mockReturnValue(visibleItems);
      mockVirtualizer.getTotalSize.mockReturnValue(2000);

      const { container } = render(<ScanConsole {...defaultProps} />);

      // Should only render 10 items (indexes 0-9 of the last 50 events)
      const virtualizedItems = container.querySelectorAll('[data-index]');
      expect(virtualizedItems).toHaveLength(10);
    });

    it('should handle 100+ entries efficiently with virtualization', () => {
      const events = createMockEvents(150);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      // Mock virtualized rendering of a subset
      mockVirtualizer.getVirtualItems.mockReturnValue(
        Array.from({ length: 20 }, (_, index) => ({
          key: `event-${index}`,
          index,
          start: index * 40,
        }))
      );
      mockVirtualizer.getTotalSize.mockReturnValue(2000);

      const { container } = render(<ScanConsole {...defaultProps} />);

      // Verify only virtualized items are rendered
      const virtualizedItems = container.querySelectorAll('[data-index]');
      expect(virtualizedItems).toHaveLength(20);

      // Verify total container size is set correctly
      const scrollContainer = container.querySelector('[role="log"]');
      const innerContainer = scrollContainer?.querySelector('div');
      expect(innerContainer).toHaveStyle({ height: '2000px' });
    });

    it('should apply correct positioning to virtualized items', () => {
      const events = createMockEvents(10);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      mockVirtualizer.getVirtualItems.mockReturnValue([
        { key: 'event-0', index: 0, start: 0 },
        { key: 'event-1', index: 1, start: 40 },
        { key: 'event-2', index: 2, start: 80 },
      ]);
      mockVirtualizer.getTotalSize.mockReturnValue(400);

      const { container } = render(<ScanConsole {...defaultProps} />);

      const items = container.querySelectorAll('[data-index]');
      expect(items[0]).toHaveStyle({ transform: 'translateY(0px)' });
      expect(items[1]).toHaveStyle({ transform: 'translateY(40px)' });
      expect(items[2]).toHaveStyle({ transform: 'translateY(80px)' });
    });
  });

  describe('Auto-Scroll Behavior', () => {
    it('should auto-scroll to bottom when new events arrive', async () => {
      const events = createMockEvents(5);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      mockVirtualizer.getVirtualItems.mockReturnValue(
        events.map((_, index) => ({
          key: `event-${index}`,
          index,
          start: index * 40,
        }))
      );

      const { rerender } = render(<ScanConsole {...defaultProps} />);

      // Clear any initial scroll calls
      mockScrollToIndex.mockClear();

      // Add new events
      const newEvents = [...events, createMockEvent({ message: 'New event' })];
      mockUseScanEvents.mockReturnValue({
        events: newEvents,
        isLoading: false,
        error: null,
      });

      rerender(<ScanConsole {...defaultProps} />);

      // Check that scrollToIndex was called with the new last index
      expect(mockScrollToIndex).toHaveBeenCalled();
      const lastCall = mockScrollToIndex.mock.calls[mockScrollToIndex.mock.calls.length - 1];
      expect(lastCall[0]).toBe(5); // Index of last event (6 events, 0-indexed)
      expect(lastCall[1]).toEqual({
        align: 'end',
        behavior: 'smooth',
      });
    });

    it('should not auto-scroll when console is collapsed', () => {
      const events = createMockEvents(5);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      const { rerender } = render(
        <ScanConsole {...defaultProps} isExpanded={false} />
      );

      // Add new events
      const newEvents = [...events, createMockEvent({ message: 'New event' })];
      mockUseScanEvents.mockReturnValue({
        events: newEvents,
        isLoading: false,
        error: null,
      });

      rerender(<ScanConsole {...defaultProps} isExpanded={false} />);

      // Should not call scrollToIndex when collapsed
      expect(mockScrollToIndex).not.toHaveBeenCalled();
    });

    it('should scroll to last event index', () => {
      const events = createMockEvents(10);
      mockUseScanEvents.mockReturnValue({
        events,
        isLoading: false,
        error: null,
      });

      mockVirtualizer.getVirtualItems.mockReturnValue(
        events.map((_, index) => ({
          key: `event-${index}`,
          index,
          start: index * 40,
        }))
      );

      render(<ScanConsole {...defaultProps} />);

      // Should scroll to index 9 (10 events, 0-indexed)
      expect(mockScrollToIndex).toHaveBeenCalled();
      const calls = mockScrollToIndex.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe(9);
      expect(lastCall[1]).toEqual({
        align: 'end',
        behavior: 'smooth',
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on scroll container', () => {
      mockUseScanEvents.mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
      });

      render(<ScanConsole {...defaultProps} />);

      const logContainer = screen.getByRole('log');
      expect(logContainer).toHaveAttribute('aria-live', 'polite');
      expect(logContainer).toHaveAttribute('aria-relevant', 'additions');
      expect(logContainer).toHaveAttribute('aria-atomic', 'false');
      expect(logContainer).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Accessibility scan console')
      );
    });

    it('should have proper ARIA attributes on header', () => {
      const { container } = render(
        <ScanConsole {...defaultProps} isExpanded={true} />
      );

      // The header div has role="button" with aria attributes
      const header = container.querySelector('[role="button"][aria-expanded]');
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute('aria-expanded', 'true');
      expect(header).toHaveAttribute('aria-controls', 'scan-console-content');
      expect(header).toHaveAttribute('tabindex', '0');
    });

    it('should mark content as aria-hidden when collapsed', () => {
      const { container } = render(
        <ScanConsole {...defaultProps} isExpanded={false} />
      );

      const content = container.querySelector('#scan-console-content');
      expect(content).toHaveAttribute('aria-hidden', 'true');
    });

    it('should not mark content as aria-hidden when expanded', () => {
      const { container } = render(
        <ScanConsole {...defaultProps} isExpanded={true} />
      );

      const content = container.querySelector('#scan-console-content');
      expect(content).toHaveAttribute('aria-hidden', 'false');
    });
  });

  describe('Polling Configuration', () => {
    it('should pass pollInterval to useScanEvents', () => {
      render(<ScanConsole {...defaultProps} />);

      expect(mockUseScanEvents).toHaveBeenCalledWith(
        'scan-123',
        'RUNNING',
        expect.objectContaining({ pollInterval: 2000 })
      );
    });

    it('should pass scan status to useScanEvents', () => {
      render(<ScanConsole {...defaultProps} scanStatus="COMPLETED" />);

      expect(mockUseScanEvents).toHaveBeenCalledWith(
        'scan-123',
        'COMPLETED',
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid event updates', async () => {
      const { rerender } = render(<ScanConsole {...defaultProps} />);

      // Simulate rapid event updates
      for (let i = 1; i <= 5; i++) {
        const events = createMockEvents(i);
        mockUseScanEvents.mockReturnValue({
          events,
          isLoading: false,
          error: null,
        });

        mockVirtualizer.getVirtualItems.mockReturnValue(
          events.map((_, index) => ({
            key: `event-${index}`,
            index,
            start: index * 40,
          }))
        );

        rerender(<ScanConsole {...defaultProps} />);
      }

      // Should handle updates without crashing
      expect(screen.getByText('Event 5')).toBeInTheDocument();
    });

    it('should handle empty scanId gracefully', () => {
      render(<ScanConsole {...defaultProps} scanId="" />);

      expect(mockUseScanEvents).toHaveBeenCalledWith(
        '',
        'RUNNING',
        expect.any(Object)
      );
    });

    it('should truncate scan ID in display', () => {
      render(
        <ScanConsole
          {...defaultProps}
          scanId="very-long-scan-id-12345678901234567890"
        />
      );

      // Should only show first 8 characters
      expect(screen.getByText(/ID: very-lon/)).toBeInTheDocument();
    });
  });
});
