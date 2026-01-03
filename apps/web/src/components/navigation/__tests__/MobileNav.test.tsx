import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MobileNav } from '../MobileNav';
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

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Menu: ({ className, ...props }: any) =>
    React.createElement('svg', { 'data-testid': 'menu-icon', className, ...props }),
  X: ({ className, ...props }: any) =>
    React.createElement('svg', { 'data-testid': 'x-icon', className, ...props }),
}));

// Import the mocked hook
import { usePathname } from 'next/navigation';

describe('MobileNav', () => {
  const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

  const defaultNavItems: NavItem[] = [
    { label: 'Home', href: '/' },
    { label: 'History', href: '/history' },
    { label: 'Settings', href: '/settings' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
    // Reset body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // Cleanup
    document.body.style.overflow = '';
  });

  describe('Hamburger button', () => {
    it('renders hamburger button with menu icon when closed', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      expect(button).toBeInTheDocument();

      const menuIcon = screen.getByTestId('menu-icon');
      expect(menuIcon).toBeInTheDocument();
    });

    it('toggles drawer when hamburger button is clicked', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });

      // Initially drawer should be closed (off-screen)
      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('-translate-x-full');

      // Click to open
      fireEvent.click(button);

      expect(drawer).toHaveClass('translate-x-0');
      expect(drawer).not.toHaveClass('-translate-x-full');
    });

    it('shows X icon when drawer is open', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      // Button text should change - there will be two "close" buttons now
      const closeButtons = screen.getAllByRole('button', { name: /close navigation menu/i });
      expect(closeButtons.length).toBeGreaterThan(0);

      // X icon should be visible in hamburger button
      const xIcons = screen.getAllByTestId('x-icon');
      expect(xIcons.length).toBeGreaterThan(0);
    });

    it('has correct ARIA attributes', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });

      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-controls', 'mobile-navigation-drawer');

      fireEvent.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('has minimum 44x44px touch target', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });

      // h-11 = 44px, w-11 = 44px (Tailwind)
      expect(button).toHaveClass('h-11');
      expect(button).toHaveClass('w-11');
    });

    it('has focus ring styles', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });

      expect(button).toHaveClass('focus:outline-none');
      expect(button).toHaveClass('focus:ring-2');
      expect(button).toHaveClass('focus:ring-blue-500');
      expect(button).toHaveClass('focus:ring-offset-2');
    });
  });

  describe('Drawer ARIA attributes (Requirement 7.2)', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      render(<MobileNav items={defaultNavItems} />);

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-label="Main navigation"', () => {
      render(<MobileNav items={defaultNavItems} />);

      const drawer = screen.getByRole('dialog', { name: /main navigation/i });
      expect(drawer).toBeInTheDocument();
    });

    it('has id="mobile-navigation-drawer" matching aria-controls', () => {
      render(<MobileNav items={defaultNavItems} />);

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveAttribute('id', 'mobile-navigation-drawer');
    });

    it('shows overlay when drawer is open', () => {
      const { container } = render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const overlay = container.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute('aria-hidden', 'true');
    });

    it('hides overlay when drawer is closed', () => {
      const { container } = render(<MobileNav items={defaultNavItems} />);

      const overlay = container.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
      expect(overlay).not.toBeInTheDocument();
    });
  });

  describe('ESC key closes drawer (Requirement 7.2)', () => {
    it('closes drawer when ESC key is pressed', async () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('translate-x-0');

      // Press ESC
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(drawer).toHaveClass('-translate-x-full');
      });
    });

    it('returns focus to hamburger button after ESC', async () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      // Press ESC
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(button).toHaveFocus();
      });
    });

    it('does not close drawer on other keys', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const drawer = screen.getByRole('dialog');

      // Press other keys
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Tab' });
      fireEvent.keyDown(document, { key: 'a' });

      expect(drawer).toHaveClass('translate-x-0');
    });

    it('prevents body scroll when drawer is open', () => {
      render(<MobileNav items={defaultNavItems} />);

      expect(document.body.style.overflow).toBe('');

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when drawer is closed', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      expect(document.body.style.overflow).toBe('hidden');

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Click outside closes drawer', () => {
    it('closes drawer when clicking outside', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('translate-x-0');

      // Click outside drawer (on document body)
      fireEvent.mouseDown(document.body);

      expect(drawer).toHaveClass('-translate-x-full');
    });

    it('does not close drawer when clicking inside', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const drawer = screen.getByRole('dialog');

      // Click inside drawer
      fireEvent.mouseDown(drawer);

      expect(drawer).toHaveClass('translate-x-0');
    });
  });

  describe('Clicking link closes drawer and navigates (Requirement 7.3)', () => {
    it('closes drawer when clicking a navigation link', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('translate-x-0');

      const historyLink = screen.getByRole('link', { name: 'History' });
      fireEvent.click(historyLink);

      expect(drawer).toHaveClass('-translate-x-full');
    });

    it('closes drawer when close button is clicked', () => {
      render(<MobileNav items={defaultNavItems} />);

      const openButton = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(openButton);

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('translate-x-0');

      // Find close button inside drawer
      const closeButtons = screen.getAllByRole('button', { name: /close navigation menu/i });
      const drawerCloseButton = closeButtons.find((btn) => btn !== openButton);

      if (drawerCloseButton) {
        fireEvent.click(drawerCloseButton);
      }

      expect(drawer).toHaveClass('-translate-x-full');
    });

    it('renders all navigation items in drawer', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    });

    it('navigation links have correct hrefs', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      const historyLink = screen.getByRole('link', { name: 'History' });
      const settingsLink = screen.getByRole('link', { name: 'Settings' });

      expect(homeLink).toHaveAttribute('href', '/');
      expect(historyLink).toHaveAttribute('href', '/history');
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });

    it('navigation links have minimum 44px height touch target', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('min-h-[44px]');
      });
    });
  });

  describe('Active state shown for current route', () => {
    it('shows active state for Home on home route', () => {
      mockUsePathname.mockReturnValue('/');

      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveClass('bg-blue-50');
      expect(homeLink).toHaveClass('text-blue-700');
      expect(homeLink).toHaveAttribute('aria-current', 'page');
    });

    it('shows active state for History on history route', () => {
      mockUsePathname.mockReturnValue('/history');

      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const historyLink = screen.getByRole('link', { name: 'History' });
      expect(historyLink).toHaveClass('bg-blue-50');
      expect(historyLink).toHaveClass('text-blue-700');
      expect(historyLink).toHaveAttribute('aria-current', 'page');
    });

    it('shows active state for Settings on settings route', () => {
      mockUsePathname.mockReturnValue('/settings');

      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const settingsLink = screen.getByRole('link', { name: 'Settings' });
      expect(settingsLink).toHaveClass('bg-blue-50');
      expect(settingsLink).toHaveClass('text-blue-700');
      expect(settingsLink).toHaveAttribute('aria-current', 'page');
    });

    it('shows active state on nested routes', () => {
      mockUsePathname.mockReturnValue('/history/scan/123');

      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const historyLink = screen.getByRole('link', { name: 'History' });
      expect(historyLink).toHaveClass('bg-blue-50');
      expect(historyLink).toHaveClass('text-blue-700');
      expect(historyLink).toHaveAttribute('aria-current', 'page');
    });

    it('only marks Home active on exact match', () => {
      mockUsePathname.mockReturnValue('/history');

      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).not.toHaveClass('bg-blue-50');
      expect(homeLink).not.toHaveClass('text-blue-700');
      expect(homeLink).toHaveClass('text-gray-700');
      expect(homeLink).not.toHaveAttribute('aria-current');
    });

    it('inactive links have default styling', () => {
      mockUsePathname.mockReturnValue('/');

      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const historyLink = screen.getByRole('link', { name: 'History' });
      expect(historyLink).toHaveClass('text-gray-700');
      expect(historyLink).toHaveClass('hover:bg-gray-100');
      expect(historyLink).not.toHaveAttribute('aria-current');
    });
  });

  describe('Auto-close on pathname change', () => {
    it('closes drawer when pathname changes', () => {
      const { rerender } = render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('translate-x-0');

      // Simulate pathname change
      mockUsePathname.mockReturnValue('/history');
      rerender(<MobileNav items={defaultNavItems} />);

      expect(drawer).toHaveClass('-translate-x-full');
    });
  });

  describe('Accessibility', () => {
    it('has proper focus indicator styles on links', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toHaveClass('focus:outline-none');
        expect(link).toHaveClass('focus:ring-2');
        expect(link).toHaveClass('focus:ring-blue-500');
        expect(link).toHaveClass('focus:ring-offset-2');
      });
    });

    it('has proper focus indicator on close button', () => {
      render(<MobileNav items={defaultNavItems} />);

      const openButton = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(openButton);

      const closeButtons = screen.getAllByRole('button', { name: /close navigation menu/i });
      closeButtons.forEach((button) => {
        expect(button).toHaveClass('focus:outline-none');
        expect(button).toHaveClass('focus:ring-2');
        expect(button).toHaveClass('focus:ring-blue-500');
      });
    });

    it('navigation items are in a list with role="list"', () => {
      render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      expect(list.children).toHaveLength(3);
    });

    it('icons have aria-hidden="true"', () => {
      render(<MobileNav items={defaultNavItems} />);

      const menuIcon = screen.getByTestId('menu-icon');
      expect(menuIcon).toHaveAttribute('aria-hidden', 'true');

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const xIcons = screen.getAllByTestId('x-icon');
      xIcons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Edge cases', () => {
    it('handles empty items array', () => {
      render(<MobileNav items={[]} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      const list = screen.getByRole('list');
      expect(list.children).toHaveLength(0);
    });

    it('handles single navigation item', () => {
      const singleItem: NavItem[] = [{ label: 'Home', href: '/' }];

      render(<MobileNav items={singleItem} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();

      const list = screen.getByRole('list');
      expect(list.children).toHaveLength(1);
    });

    it('handles items with special characters', () => {
      const specialItems: NavItem[] = [
        { label: 'Home & Settings', href: '/' },
        { label: "User's Profile", href: '/profile' },
      ];

      render(<MobileNav items={specialItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      expect(screen.getByRole('link', { name: 'Home & Settings' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: "User's Profile" })).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { unmount } = render(<MobileNav items={defaultNavItems} />);

      const button = screen.getByRole('button', { name: /open navigation menu/i });
      fireEvent.click(button);

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });
});
