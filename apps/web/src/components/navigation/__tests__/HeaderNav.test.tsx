import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeaderNav } from '../HeaderNav';
import type { NavItem } from '@/lib/navigation-config';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return React.createElement('a', { href, ...props }, children);
  },
}));

// Import the mocked hook
import { usePathname } from 'next/navigation';

describe('HeaderNav', () => {
  const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

  const defaultNavItems: NavItem[] = [
    { label: 'Home', href: '/' },
    { label: 'History', href: '/history' },
    { label: 'Settings', href: '/settings' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all navigation items', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders with default items from config when no items prop provided', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav />);

      // Should render the default navigation items from navigationConfig
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders as nav element with proper aria-label', () => {
      mockUsePathname.mockReturnValue('/');

      const { container } = render(<HeaderNav items={defaultNavItems} />);

      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('renders list with role="list"', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      mockUsePathname.mockReturnValue('/');

      const { container } = render(<HeaderNav items={defaultNavItems} className="custom-nav-class" />);

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('custom-nav-class');
    });
  });

  describe('Active state styling', () => {
    it('applies active state to Home when on home route', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const homeLink = screen.getByText('Home');
      expect(homeLink).toHaveClass('text-foreground');
      expect(homeLink).not.toHaveClass('text-muted-foreground');
    });

    it('applies active state to History when on history route', () => {
      mockUsePathname.mockReturnValue('/history');

      render(<HeaderNav items={defaultNavItems} />);

      const historyLink = screen.getByText('History');
      expect(historyLink).toHaveClass('text-foreground');

      const homeLink = screen.getByText('Home');
      expect(homeLink).toHaveClass('text-muted-foreground');
    });

    it('applies active state to Settings when on settings route', () => {
      mockUsePathname.mockReturnValue('/settings');

      render(<HeaderNav items={defaultNavItems} />);

      const settingsLink = screen.getByText('Settings');
      expect(settingsLink).toHaveClass('text-foreground');

      const homeLink = screen.getByText('Home');
      expect(homeLink).toHaveClass('text-muted-foreground');
    });

    it('applies active state when on nested route', () => {
      mockUsePathname.mockReturnValue('/history/scan/123');

      render(<HeaderNav items={defaultNavItems} />);

      const historyLink = screen.getByText('History');
      expect(historyLink).toHaveClass('text-foreground');
    });

    it('only applies active state to Home on exact match', () => {
      mockUsePathname.mockReturnValue('/history');

      render(<HeaderNav items={defaultNavItems} />);

      const homeLink = screen.getByText('Home');
      expect(homeLink).toHaveClass('text-muted-foreground');
      expect(homeLink).not.toHaveClass('text-foreground');
    });

    it('applies hover styles to inactive links', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const historyLink = screen.getByText('History');
      expect(historyLink).toHaveClass('hover:text-foreground');
    });
  });

  describe('Navigation links', () => {
    it('links navigate to correct destinations', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const homeLink = screen.getByText('Home').closest('a');
      const historyLink = screen.getByText('History').closest('a');
      const settingsLink = screen.getByText('Settings').closest('a');

      expect(homeLink).toHaveAttribute('href', '/');
      expect(historyLink).toHaveAttribute('href', '/history');
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });

    it('renders custom navigation items with correct hrefs', () => {
      mockUsePathname.mockReturnValue('/');

      const customItems: NavItem[] = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reports', href: '/reports' },
      ];

      render(<HeaderNav items={customItems} />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      const reportsLink = screen.getByText('Reports').closest('a');

      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
      expect(reportsLink).toHaveAttribute('href', '/reports');
    });
  });

  describe('ARIA attributes', () => {
    it('has aria-current="page" on active link', () => {
      mockUsePathname.mockReturnValue('/history');

      render(<HeaderNav items={defaultNavItems} />);

      const historyLink = screen.getByText('History');
      expect(historyLink).toHaveAttribute('aria-current', 'page');
    });

    it('does not have aria-current on inactive links', () => {
      mockUsePathname.mockReturnValue('/history');

      render(<HeaderNav items={defaultNavItems} />);

      const homeLink = screen.getByText('Home');
      const settingsLink = screen.getByText('Settings');

      expect(homeLink).not.toHaveAttribute('aria-current');
      expect(settingsLink).not.toHaveAttribute('aria-current');
    });

    it('has aria-current="page" only on Home when on home route', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const homeLink = screen.getByText('Home');
      const historyLink = screen.getByText('History');
      const settingsLink = screen.getByText('Settings');

      expect(homeLink).toHaveAttribute('aria-current', 'page');
      expect(historyLink).not.toHaveAttribute('aria-current');
      expect(settingsLink).not.toHaveAttribute('aria-current');
    });
  });

  describe('Accessibility', () => {
    it('has proper focus indicator styles', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('focus:outline-none');
        expect(link).toHaveClass('focus:ring-2');
        expect(link).toHaveClass('focus:ring-blue-500');
        expect(link).toHaveClass('focus:ring-offset-2');
      });
    });

    it('has transition-colors for smooth state changes', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('transition-colors');
      });
    });

    it('uses semantic list markup', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const list = screen.getByRole('list');
      const listItems = list.querySelectorAll('li');

      expect(listItems).toHaveLength(3);
    });
  });

  describe('Edge cases', () => {
    it('handles empty items array', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={[]} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();

      const list = screen.getByRole('list');
      expect(list.children).toHaveLength(0);
    });

    it('handles single navigation item', () => {
      mockUsePathname.mockReturnValue('/');

      const singleItem: NavItem[] = [{ label: 'Home', href: '/' }];

      render(<HeaderNav items={singleItem} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      const list = screen.getByRole('list');
      expect(list.children).toHaveLength(1);
    });

    it('handles navigation items with special characters in labels', () => {
      mockUsePathname.mockReturnValue('/');

      const specialItems: NavItem[] = [
        { label: 'Home & Settings', href: '/' },
        { label: 'User\'s Profile', href: '/profile' },
      ];

      render(<HeaderNav items={specialItems} />);

      expect(screen.getByText('Home & Settings')).toBeInTheDocument();
      expect(screen.getByText("User's Profile")).toBeInTheDocument();
    });
  });

  describe('Route matching logic', () => {
    it('correctly identifies home route as active only on exact match', () => {
      mockUsePathname.mockReturnValue('/');

      render(<HeaderNav items={defaultNavItems} />);

      const homeLink = screen.getByText('Home');
      expect(homeLink).toHaveAttribute('aria-current', 'page');
    });

    it('correctly identifies non-home routes using startsWith match', () => {
      mockUsePathname.mockReturnValue('/settings/profile');

      render(<HeaderNav items={defaultNavItems} />);

      const settingsLink = screen.getByText('Settings');
      expect(settingsLink).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark home as active on similar routes', () => {
      mockUsePathname.mockReturnValue('/homestead');

      render(<HeaderNav items={defaultNavItems} />);

      const homeLink = screen.getByText('Home');
      expect(homeLink).not.toHaveAttribute('aria-current', 'page');
    });
  });
});
