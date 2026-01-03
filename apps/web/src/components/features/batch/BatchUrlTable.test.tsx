import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchUrlTable, type BatchUrl } from './BatchUrlTable';

describe('BatchUrlTable', () => {
  const mockUrls: BatchUrl[] = [
    { id: '1', url: 'https://example.com/page1', title: 'Page 1' },
    { id: '2', url: 'https://example.com/page2', title: 'Page 2' },
    { id: '3', url: 'https://example.com/page3', title: 'Page 3' },
    { id: '4', url: 'https://example.com/page4', title: 'Page 4' },
    { id: '5', url: 'https://example.com/page5', title: 'Page 5' },
  ];

  const mockOnRemove = vi.fn();
  const mockOnClearAll = vi.fn();

  describe('URL Display and Count', () => {
    it('shows all URLs when count is 3 or less', () => {
      const threeUrls = mockUrls.slice(0, 3);
      render(
        <BatchUrlTable
          urls={threeUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      // All 3 URLs should be visible
      expect(screen.getByText('https://example.com/page1')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page2')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page3')).toBeInTheDocument();

      // Show more button should NOT be present
      expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
    });

    it('shows only first 3 URLs when count is greater than 3', () => {
      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      // First 3 URLs should be visible
      expect(screen.getByText('https://example.com/page1')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page2')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page3')).toBeInTheDocument();

      // Last 2 URLs should NOT be visible
      expect(screen.queryByText('https://example.com/page4')).not.toBeInTheDocument();
      expect(screen.queryByText('https://example.com/page5')).not.toBeInTheDocument();
    });

    it('shows correct URL count in header', () => {
      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByText('5 URLs selected')).toBeInTheDocument();
    });

    it('shows singular "URL" when count is 1', () => {
      const singleUrl = [mockUrls[0]];
      render(
        <BatchUrlTable
          urls={singleUrl}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByText('1 URL selected')).toBeInTheDocument();
    });
  });

  describe('Show More/Less Toggle', () => {
    it('shows "Show more (+N more)" button when count is greater than 3', () => {
      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      // Should show "+2 more" since we have 5 URLs and show 3
      expect(screen.getByText('Show more (+2 more)')).toBeInTheDocument();
    });

    it('expands to show all URLs when "Show more" is clicked', async () => {
      const user = userEvent.setup();
      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      // Initially, only 3 URLs visible
      expect(screen.getByText('https://example.com/page1')).toBeInTheDocument();
      expect(screen.queryByText('https://example.com/page4')).not.toBeInTheDocument();

      // Click "Show more"
      const showMoreButton = screen.getByText('Show more (+2 more)');
      await user.click(showMoreButton);

      // Now all 5 URLs should be visible
      expect(screen.getByText('https://example.com/page1')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page2')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page3')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page4')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page5')).toBeInTheDocument();

      // Button should now say "Show less"
      expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('collapses back to first 3 URLs when "Show less" is clicked', async () => {
      const user = userEvent.setup();
      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      // Click "Show more" to expand
      const showMoreButton = screen.getByText('Show more (+2 more)');
      await user.click(showMoreButton);

      // Verify all URLs are visible
      expect(screen.getByText('https://example.com/page4')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page5')).toBeInTheDocument();

      // Click "Show less" to collapse
      const showLessButton = screen.getByText('Show less');
      await user.click(showLessButton);

      // Now only first 3 should be visible
      expect(screen.getByText('https://example.com/page1')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page2')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page3')).toBeInTheDocument();
      expect(screen.queryByText('https://example.com/page4')).not.toBeInTheDocument();
      expect(screen.queryByText('https://example.com/page5')).not.toBeInTheDocument();

      // Button should now say "Show more" again
      expect(screen.getByText('Show more (+2 more)')).toBeInTheDocument();
    });
  });

  describe('URL Removal', () => {
    it('calls onRemove with correct id when remove button is clicked', async () => {
      const user = userEvent.setup();
      mockOnRemove.mockClear();

      render(
        <BatchUrlTable
          urls={mockUrls.slice(0, 3)}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      // Click remove button for first URL
      const removeButtons = screen.getAllByLabelText(/Remove https:\/\/example.com/);
      await user.click(removeButtons[0]);

      expect(mockOnRemove).toHaveBeenCalledWith('1');
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });

    it('has accessible remove buttons with correct aria-label', () => {
      render(
        <BatchUrlTable
          urls={mockUrls.slice(0, 3)}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByLabelText('Remove https://example.com/page1')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove https://example.com/page2')).toBeInTheDocument();
      expect(screen.getByLabelText('Remove https://example.com/page3')).toBeInTheDocument();
    });
  });

  describe('Clear All Functionality', () => {
    it('calls onClearAll when "Clear All" button is clicked', async () => {
      const user = userEvent.setup();
      mockOnClearAll.mockClear();

      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      const clearAllButton = screen.getByRole('button', { name: 'Clear all URLs' });
      await user.click(clearAllButton);

      expect(mockOnClearAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL Display and Formatting', () => {
    it('displays URL titles correctly', () => {
      render(
        <BatchUrlTable
          urls={mockUrls.slice(0, 3)}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.getByText('Page 2')).toBeInTheDocument();
      expect(screen.getByText('Page 3')).toBeInTheDocument();
    });

    it('displays em-dash (—) for URLs without titles', () => {
      const urlsWithoutTitles: BatchUrl[] = [
        { id: '1', url: 'https://example.com/page1' },
        { id: '2', url: 'https://example.com/page2' },
      ];

      render(
        <BatchUrlTable
          urls={urlsWithoutTitles}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      const emDashes = screen.getAllByText('—');
      expect(emDashes).toHaveLength(2);
    });

    it('has truncate classes for long URLs and titles', () => {
      const { container } = render(
        <BatchUrlTable
          urls={mockUrls.slice(0, 3)}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      const truncateElements = container.querySelectorAll('.truncate');
      // Each row has 2 truncate elements (URL and title)
      expect(truncateElements.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Custom Initial Display Count', () => {
    it('respects custom initialDisplayCount prop', () => {
      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
          initialDisplayCount={2}
        />
      );

      // Only first 2 URLs should be visible
      expect(screen.getByText('https://example.com/page1')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/page2')).toBeInTheDocument();
      expect(screen.queryByText('https://example.com/page3')).not.toBeInTheDocument();

      // Should show "+3 more" (5 total - 2 shown = 3 hidden)
      expect(screen.getByText('Show more (+3 more)')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-expanded attribute on toggle button', () => {
      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      const toggleButton = screen.getByLabelText('Show 2 more URLs');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('updates aria-expanded when toggle button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <BatchUrlTable
          urls={mockUrls}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      const toggleButton = screen.getByLabelText('Show 2 more URLs');
      await user.click(toggleButton);

      const showLessButton = screen.getByLabelText('Show less URLs');
      expect(showLessButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('has proper table structure with headers', () => {
      render(
        <BatchUrlTable
          urls={mockUrls.slice(0, 3)}
          onRemove={mockOnRemove}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'URL' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    });
  });
});
