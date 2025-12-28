/**
 * Unit tests for LogEntry component
 * Tests log level colors, timestamp formatting, metadata display, and accessibility
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogEntry } from './LogEntry';
import { ScanEvent, LogLevel } from '@/types/scan-event';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronDown: ({ className, ...props }: any) => (
    <div data-testid="chevron-down" className={className} {...props} />
  ),
  ChevronRight: ({ className, ...props }: any) => (
    <div data-testid="chevron-right" className={className} {...props} />
  ),
}));

describe('LogEntry', () => {
  // Helper function to create mock scan events
  const createMockEvent = (
    overrides: Partial<ScanEvent> = {}
  ): ScanEvent => ({
    id: 'event-1',
    scanId: 'scan-123',
    type: 'INFO',
    level: 'INFO',
    message: 'Test message',
    metadata: null,
    adminOnly: false,
    createdAt: '2025-12-28T10:30:45.000Z',
    ...overrides,
  });

  describe('Log Level Colors', () => {
    const testCases: Array<{
      level: LogLevel;
      expectedColor: string;
      expectedBadge: string;
    }> = [
      {
        level: 'DEBUG',
        expectedColor: 'text-gray-300',
        expectedBadge: 'bg-gray-600/30 text-gray-300',
      },
      {
        level: 'INFO',
        expectedColor: 'text-white',
        expectedBadge: 'bg-blue-600/30 text-blue-400',
      },
      {
        level: 'SUCCESS',
        expectedColor: 'text-green-400',
        expectedBadge: 'bg-green-600/30 text-green-400',
      },
      {
        level: 'WARNING',
        expectedColor: 'text-amber-400',
        expectedBadge: 'bg-amber-600/30 text-amber-400',
      },
      {
        level: 'ERROR',
        expectedColor: 'text-red-400',
        expectedBadge: 'bg-red-600/30 text-red-400',
      },
    ];

    testCases.forEach(({ level, expectedColor, expectedBadge }) => {
      it(`should render ${level} level with correct colors`, () => {
        const event = createMockEvent({
          level,
          message: `${level} message`,
        });

        render(<LogEntry event={event} isAdmin={false} />);

        // Check message has correct color
        const message = screen.getByText(`${level} message`);
        expect(message).toHaveClass(expectedColor);

        // Check badge has correct styling
        const badge = screen.getByText(level);
        expectedBadge.split(' ').forEach((className) => {
          expect(badge).toHaveClass(className);
        });
      });
    });
  });

  describe('Timestamp Formatting', () => {
    it('should format timestamp as HH:MM:SS', () => {
      const event = createMockEvent({
        createdAt: '2025-12-28T10:30:45.000Z',
      });

      render(<LogEntry event={event} isAdmin={false} />);

      // Note: Exact time will depend on timezone, so we check format pattern
      const timestampElement = screen.getByText(/^\d{2}:\d{2}:\d{2}$/);
      expect(timestampElement).toBeInTheDocument();
      expect(timestampElement).toHaveClass('text-gray-500', 'text-xs');
    });

    it('should pad single-digit hours, minutes, and seconds with zero', () => {
      // This would be 01:05:09 in UTC
      const event = createMockEvent({
        createdAt: '2025-12-28T01:05:09.000Z',
      });

      render(<LogEntry event={event} isAdmin={false} />);

      // Verify the format has proper padding
      const timestampElement = screen.getByText(/^\d{2}:\d{2}:\d{2}$/);
      const timestamp = timestampElement.textContent || '';
      const parts = timestamp.split(':');

      // Each part should be 2 characters
      expect(parts).toHaveLength(3);
      parts.forEach((part) => {
        expect(part).toHaveLength(2);
      });
    });
  });

  describe('Metadata Display (Admin)', () => {
    it('should show metadata toggle button for admin when metadata exists', () => {
      const event = createMockEvent({
        metadata: { key: 'value', count: 42 },
      });

      render(<LogEntry event={event} isAdmin={true} />);

      const toggleButton = screen.getByRole('button', {
        name: /show metadata/i,
      });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should not show metadata toggle for non-admin users', () => {
      const event = createMockEvent({
        metadata: { key: 'value' },
      });

      render(<LogEntry event={event} isAdmin={false} />);

      const toggleButton = screen.queryByRole('button', {
        name: /metadata/i,
      });
      expect(toggleButton).not.toBeInTheDocument();
    });

    it('should not show metadata toggle when metadata is null', () => {
      const event = createMockEvent({
        metadata: null,
      });

      render(<LogEntry event={event} isAdmin={true} />);

      const toggleButton = screen.queryByRole('button', {
        name: /metadata/i,
      });
      expect(toggleButton).not.toBeInTheDocument();
    });

    it('should not show metadata toggle when metadata is empty object', () => {
      const event = createMockEvent({
        metadata: {},
      });

      render(<LogEntry event={event} isAdmin={true} />);

      const toggleButton = screen.queryByRole('button', {
        name: /metadata/i,
      });
      expect(toggleButton).not.toBeInTheDocument();
    });

    it('should expand and show metadata JSON when toggle is clicked', async () => {
      const user = userEvent.setup();
      const metadata = { key: 'value', count: 42, nested: { field: 'data' } };
      const event = createMockEvent({ metadata });

      render(<LogEntry event={event} isAdmin={true} />);

      const toggleButton = screen.getByRole('button', {
        name: /show metadata/i,
      });

      // Initially metadata should not be visible
      expect(screen.queryByText(/"key"/)).not.toBeInTheDocument();

      // Click to expand
      await user.click(toggleButton);

      // Metadata should now be visible as formatted JSON
      expect(screen.getByText(/"key"/)).toBeInTheDocument();
      expect(screen.getByText(/"value"/)).toBeInTheDocument();
      expect(screen.getByText(/"count"/)).toBeInTheDocument();
      expect(screen.getByText(/42/)).toBeInTheDocument();

      // Button should update
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      expect(toggleButton).toHaveAccessibleName(/hide metadata/i);
    });

    it('should collapse metadata when toggle is clicked again', async () => {
      const user = userEvent.setup();
      const event = createMockEvent({
        metadata: { key: 'value' },
      });

      render(<LogEntry event={event} isAdmin={true} />);

      const toggleButton = screen.getByRole('button', {
        name: /show metadata/i,
      });

      // Expand
      await user.click(toggleButton);
      expect(screen.getByText(/"key"/)).toBeInTheDocument();

      // Collapse
      await user.click(toggleButton);
      expect(screen.queryByText(/"key"/)).not.toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should respect showMetadata prop', () => {
      const event = createMockEvent({
        metadata: { key: 'value' },
      });

      render(<LogEntry event={event} isAdmin={true} showMetadata={false} />);

      const toggleButton = screen.queryByRole('button', {
        name: /metadata/i,
      });
      expect(toggleButton).not.toBeInTheDocument();
    });

    it('should display ChevronRight icon when collapsed', () => {
      const event = createMockEvent({
        metadata: { key: 'value' },
      });

      const { container } = render(<LogEntry event={event} isAdmin={true} />);

      expect(container.querySelector('[data-testid="chevron-right"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="chevron-down"]')).not.toBeInTheDocument();
    });

    it('should display ChevronDown icon when expanded', async () => {
      const user = userEvent.setup();
      const event = createMockEvent({
        metadata: { key: 'value' },
      });

      const { container } = render(<LogEntry event={event} isAdmin={true} />);

      const toggleButton = screen.getByRole('button', {
        name: /show metadata/i,
      });
      await user.click(toggleButton);

      expect(container.querySelector('[data-testid="chevron-down"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="chevron-right"]')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility Attributes', () => {
    it('should have proper ARIA role and label', () => {
      const event = createMockEvent({
        level: 'INFO',
        createdAt: '2025-12-28T10:30:45.000Z',
      });

      render(<LogEntry event={event} isAdmin={false} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveAttribute('aria-label');

      const ariaLabel = logEntry.getAttribute('aria-label') || '';
      expect(ariaLabel).toContain('INFO');
      expect(ariaLabel).toContain('log entry');
    });

    it('should have tabIndex for keyboard navigation', () => {
      const event = createMockEvent();

      render(<LogEntry event={event} isAdmin={false} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveAttribute('tabIndex', '0');
    });

    it('should have focus ring styles for accessibility', () => {
      const event = createMockEvent();

      render(<LogEntry event={event} isAdmin={false} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveClass(
        'focus-within:ring-2',
        'focus-within:ring-blue-500'
      );
    });

    it('should mark chevron icons as aria-hidden', () => {
      const event = createMockEvent({
        metadata: { key: 'value' },
      });

      const { container } = render(<LogEntry event={event} isAdmin={true} />);

      const chevron = container.querySelector('[data-testid="chevron-right"]');
      expect(chevron).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have proper aria-expanded attribute on metadata toggle', () => {
      const event = createMockEvent({
        metadata: { key: 'value' },
      });

      render(<LogEntry event={event} isAdmin={true} />);

      const toggleButton = screen.getByRole('button', {
        name: /metadata/i,
      });
      expect(toggleButton).toHaveAttribute('aria-expanded');
    });

    it('should support reduced motion preferences', () => {
      const event = createMockEvent();

      render(<LogEntry event={event} isAdmin={false} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveClass('motion-reduce:transition-none');
    });
  });

  describe('Admin-Only Styling', () => {
    it('should apply purple background when isAdminOnly is true', () => {
      const event = createMockEvent();

      render(<LogEntry event={event} isAdmin={true} isAdminOnly={true} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveClass('bg-purple-900/20', 'hover:bg-purple-900/30');
    });

    it('should apply default background when isAdminOnly is false', () => {
      const event = createMockEvent();

      render(<LogEntry event={event} isAdmin={false} isAdminOnly={false} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveClass('hover:bg-gray-800/30');
      expect(logEntry).not.toHaveClass('bg-purple-900/20');
    });

    it('should apply purple background for admin-only events even for non-admin users', () => {
      const event = createMockEvent();

      // isAdminOnly styling is independent of isAdmin prop
      render(<LogEntry event={event} isAdmin={false} isAdminOnly={true} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveClass('bg-purple-900/20', 'hover:bg-purple-900/30');
    });
  });

  describe('Message Display', () => {
    it('should render the message text', () => {
      const event = createMockEvent({
        message: 'Custom test message',
      });

      render(<LogEntry event={event} isAdmin={false} />);

      expect(screen.getByText('Custom test message')).toBeInTheDocument();
    });

    it('should apply break-words class for long messages', () => {
      const event = createMockEvent({
        message: 'A very long message that should wrap properly',
      });

      render(<LogEntry event={event} isAdmin={false} />);

      const message = screen.getByText(
        'A very long message that should wrap properly'
      );
      expect(message).toHaveClass('break-words');
    });

    it('should use monospace font for terminal-style appearance', () => {
      const event = createMockEvent();

      render(<LogEntry event={event} isAdmin={false} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveClass('font-mono');
    });
  });

  describe('Component Structure', () => {
    it('should render all main sections', () => {
      const event = createMockEvent({
        message: 'Test message',
        level: 'INFO',
      });

      render(<LogEntry event={event} isAdmin={false} />);

      // Timestamp
      expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();

      // Level badge
      expect(screen.getByText('INFO')).toBeInTheDocument();

      // Message
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should apply consistent spacing and padding', () => {
      const event = createMockEvent();

      render(<LogEntry event={event} isAdmin={false} />);

      const logEntry = screen.getByRole('log');
      expect(logEntry).toHaveClass('py-1');
    });
  });
});
