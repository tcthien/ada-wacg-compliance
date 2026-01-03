import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Breadcrumbs } from '../Breadcrumbs';
import type { BreadcrumbItem } from '@/lib/navigation-config';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return React.createElement('a', { href, ...props }, children);
  },
}));

describe('Breadcrumbs', () => {
  const defaultBreadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    { label: 'Scan History', href: '/history' },
    { label: 'Scan Results' },
  ];

  describe('Rendering', () => {
    it('renders all breadcrumb items', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Scan History')).toBeInTheDocument();
      expect(screen.getByText('Scan Results')).toBeInTheDocument();
    });

    it('renders as nav element with proper aria-label', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    });

    it('renders list with role="list"', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} className="custom-breadcrumb-class" />);

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('custom-breadcrumb-class');
    });

    it('returns null when items array is empty', () => {
      const { container } = render(<Breadcrumbs items={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('returns null when items is undefined', () => {
      const { container } = render(<Breadcrumbs items={undefined as any} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Last item (current page)', () => {
    it('last item is not a link', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const lastItem = screen.getByText('Scan Results');
      const link = lastItem.closest('a');

      expect(link).toBeNull();
      expect(lastItem.tagName).toBe('SPAN');
    });

    it('last item has aria-current="page"', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const lastItem = screen.getByText('Scan Results');
      expect(lastItem).toHaveAttribute('aria-current', 'page');
    });

    it('last item has distinct styling', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const lastItem = screen.getByText('Scan Results');
      expect(lastItem).toHaveClass('text-foreground');
      expect(lastItem).toHaveClass('font-medium');
    });

    it('only last item has aria-current="page"', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const home = screen.getByText('Home');
      const history = screen.getByText('Scan History');
      const results = screen.getByText('Scan Results');

      expect(home).not.toHaveAttribute('aria-current');
      expect(history).not.toHaveAttribute('aria-current');
      expect(results).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Middle items (clickable links)', () => {
    it('middle items are clickable links', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const homeLink = screen.getByText('Home').closest('a');
      const historyLink = screen.getByText('Scan History').closest('a');

      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute('href', '/');

      expect(historyLink).toBeInTheDocument();
      expect(historyLink).toHaveAttribute('href', '/history');
    });

    it('middle items do not have aria-current', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const homeLink = screen.getByText('Home');
      const historyLink = screen.getByText('Scan History');

      expect(homeLink).not.toHaveAttribute('aria-current');
      expect(historyLink).not.toHaveAttribute('aria-current');
    });

    it('middle items have hover styles', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const homeLink = screen.getByText('Home').closest('a');
      const historyLink = screen.getByText('Scan History').closest('a');

      expect(homeLink).toHaveClass('hover:text-foreground');
      expect(historyLink).toHaveClass('hover:text-foreground');
    });

    it('middle items have title attribute for accessibility', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const homeLink = screen.getByText('Home').closest('a');
      const historyLink = screen.getByText('Scan History').closest('a');

      expect(homeLink).toHaveAttribute('title', 'Home');
      expect(historyLink).toHaveAttribute('title', 'Scan History');
    });
  });

  describe('Separator rendering', () => {
    it('renders default separator between items', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const separators = container.querySelectorAll('[aria-hidden="true"]');
      // Should have 2 separators for 3 items
      expect(separators).toHaveLength(2);
      expect(separators[0].textContent).toBe('>');
      expect(separators[1].textContent).toBe('>');
    });

    it('custom separator renders correctly', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} separator="/" />);

      const separators = container.querySelectorAll('[aria-hidden="true"]');
      expect(separators[0].textContent).toBe('/');
      expect(separators[1].textContent).toBe('/');
    });

    it('renders emoji separator correctly', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} separator="→" />);

      const separators = container.querySelectorAll('[aria-hidden="true"]');
      expect(separators[0].textContent).toBe('→');
      expect(separators[1].textContent).toBe('→');
    });

    it('does not render separator after last item', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const listItems = container.querySelectorAll('li');
      const lastItem = listItems[listItems.length - 1];
      const separatorInLastItem = lastItem.querySelector('[aria-hidden="true"]');

      expect(separatorInLastItem).toBeNull();
    });

    it('separator has aria-hidden="true" for accessibility', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const separators = container.querySelectorAll('[aria-hidden="true"]');
      separators.forEach((separator) => {
        expect(separator).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Label truncation', () => {
    const longLabelItems: BreadcrumbItem[] = [
      { label: 'Home', href: '/' },
      { label: 'This is a very long breadcrumb label that should be truncated', href: '/long' },
      { label: 'Short' },
    ];

    it('long labels are truncated when maxLabelLength is set', () => {
      render(<Breadcrumbs items={longLabelItems} maxLabelLength={20} />);

      const truncatedText = screen.getByText('This is a very long ...');
      expect(truncatedText).toBeInTheDocument();
    });

    it('short labels are not truncated', () => {
      render(<Breadcrumbs items={longLabelItems} maxLabelLength={20} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Short')).toBeInTheDocument();
    });

    it('labels are not truncated when maxLabelLength is not set', () => {
      render(<Breadcrumbs items={longLabelItems} />);

      expect(screen.getByText('This is a very long breadcrumb label that should be truncated')).toBeInTheDocument();
    });

    it('truncated items still have full label in title attribute', () => {
      render(<Breadcrumbs items={longLabelItems} maxLabelLength={20} />);

      const truncatedLink = screen.getByText('This is a very long ...').closest('a');
      expect(truncatedLink).toHaveAttribute('title', 'This is a very long breadcrumb label that should be truncated');
    });

    it('truncation adds ellipsis correctly', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Exactly twenty chars', href: '/' },
        { label: 'Short' },
      ];

      render(<Breadcrumbs items={items} maxLabelLength={20} />);

      // Should not truncate exactly 20 chars
      expect(screen.getByText('Exactly twenty chars')).toBeInTheDocument();
    });

    it('applies truncate class when maxLabelLength is set', () => {
      render(<Breadcrumbs items={longLabelItems} maxLabelLength={20} />);

      const homeLink = screen.getByText('Home').closest('a');
      expect(homeLink).toHaveClass('truncate');
    });
  });

  describe('Accessibility', () => {
    it('has proper nav landmark with aria-label', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const nav = container.querySelector('nav');
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    });

    it('uses semantic list markup', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const list = screen.getByRole('list');
      const listItems = list.querySelectorAll('li');

      expect(listItems).toHaveLength(3);
    });

    it('last item has title attribute for screen readers', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const lastItem = screen.getByText('Scan Results');
      expect(lastItem).toHaveAttribute('title', 'Scan Results');
    });

    it('separators are hidden from screen readers', () => {
      const { container } = render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const separators = container.querySelectorAll('[aria-hidden="true"]');
      separators.forEach((separator) => {
        expect(separator).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('links have transition-colors for smooth state changes', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const homeLink = screen.getByText('Home').closest('a');
      expect(homeLink).toHaveClass('transition-colors');
    });
  });

  describe('Edge cases', () => {
    it('handles single breadcrumb item', () => {
      const singleItem: BreadcrumbItem[] = [{ label: 'Home' }];

      render(<Breadcrumbs items={singleItem} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      const lastItem = screen.getByText('Home');
      expect(lastItem).toHaveAttribute('aria-current', 'page');
    });

    it('handles breadcrumb with no href on middle item', () => {
      const itemsWithoutHref: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'No Link' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={itemsWithoutHref} />);

      const noLinkItem = screen.getByText('No Link');
      const link = noLinkItem.closest('a');

      // Should render as span, not link, when no href
      expect(link).toBeNull();
      expect(noLinkItem.tagName).toBe('SPAN');
    });

    it('handles breadcrumbs with special characters in labels', () => {
      const specialItems: BreadcrumbItem[] = [
        { label: 'Home & Settings', href: '/' },
        { label: 'User\'s Profile', href: '/profile' },
        { label: 'Details <>' },
      ];

      render(<Breadcrumbs items={specialItems} />);

      expect(screen.getByText('Home & Settings')).toBeInTheDocument();
      expect(screen.getByText("User's Profile")).toBeInTheDocument();
      expect(screen.getByText('Details <>')).toBeInTheDocument();
    });

    it('handles very long breadcrumb trail', () => {
      const longTrail: BreadcrumbItem[] = [
        { label: 'Level 1', href: '/1' },
        { label: 'Level 2', href: '/2' },
        { label: 'Level 3', href: '/3' },
        { label: 'Level 4', href: '/4' },
        { label: 'Level 5', href: '/5' },
        { label: 'Current Page' },
      ];

      render(<Breadcrumbs items={longTrail} />);

      const list = screen.getByRole('list');
      const listItems = list.querySelectorAll('li');

      expect(listItems).toHaveLength(6);
      expect(screen.getByText('Current Page')).toHaveAttribute('aria-current', 'page');
    });

    it('handles items with identical labels', () => {
      const duplicateLabels: BreadcrumbItem[] = [
        { label: 'Settings', href: '/settings' },
        { label: 'Settings', href: '/settings/advanced' },
        { label: 'Settings' },
      ];

      render(<Breadcrumbs items={duplicateLabels} />);

      const settingsElements = screen.getAllByText('Settings');
      expect(settingsElements).toHaveLength(3);

      // Last one should be non-clickable
      const lastSettings = settingsElements[2];
      expect(lastSettings).toHaveAttribute('aria-current', 'page');
    });

    it('handles empty string labels gracefully', () => {
      const emptyLabelItems: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: '', href: '/empty' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={emptyLabelItems} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('handles numeric labels', () => {
      const numericItems: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: '2024', href: '/2024' },
        { label: '123' },
      ];

      render(<Breadcrumbs items={numericItems} />);

      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  describe('Link navigation', () => {
    it('links navigate to correct destinations', () => {
      render(<Breadcrumbs items={defaultBreadcrumbs} />);

      const homeLink = screen.getByText('Home').closest('a');
      const historyLink = screen.getByText('Scan History').closest('a');

      expect(homeLink).toHaveAttribute('href', '/');
      expect(historyLink).toHaveAttribute('href', '/history');
    });

    it('handles absolute URLs', () => {
      const absoluteUrlItems: BreadcrumbItem[] = [
        { label: 'External', href: 'https://example.com' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={absoluteUrlItems} />);

      const externalLink = screen.getByText('External').closest('a');
      expect(externalLink).toHaveAttribute('href', 'https://example.com');
    });

    it('handles hash links', () => {
      const hashItems: BreadcrumbItem[] = [
        { label: 'Section', href: '#section' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={hashItems} />);

      const hashLink = screen.getByText('Section').closest('a');
      expect(hashLink).toHaveAttribute('href', '#section');
    });
  });
});
