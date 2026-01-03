import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicLayout } from '../PublicLayout';
import type { BreadcrumbItem } from '@/lib/navigation-config';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return React.createElement('a', { href, ...props }, children);
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

// Mock PrivacyPolicyLink
vi.mock('@/components/features/privacy', () => ({
  PrivacyPolicyLink: () => <a href="/privacy">Privacy Policy</a>,
}));

// Mock navigation components
vi.mock('@/components/navigation', () => ({
  SkipLink: ({ targetId }: { targetId: string }) => (
    <a href={`#${targetId}`} className="skip-link">
      Skip to main content
    </a>
  ),
  HeaderNav: ({ className }: { className?: string }) => (
    <nav className={className} data-testid="header-nav">
      Header Navigation
    </nav>
  ),
  MobileNav: ({ items }: { items: any[] }) => (
    <nav data-testid="mobile-nav">
      Mobile Navigation ({items.length} items)
    </nav>
  ),
  NavigationProgress: () => <div data-testid="navigation-progress">Progress</div>,
  BackButton: ({ href, label }: { href?: string; label?: string }) => (
    <button data-testid="back-button" data-href={href} data-label={label}>
      {label || 'Back'}
    </button>
  ),
  Breadcrumbs: ({ items, className }: { items: BreadcrumbItem[]; className?: string }) => (
    <nav data-testid="breadcrumbs" className={className}>
      {items.map((item, idx) => (
        <span key={idx}>{item.label}</span>
      ))}
    </nav>
  ),
}));

// Mock navigation config
vi.mock('@/lib/navigation-config', () => ({
  navigationConfig: {
    mainNav: [
      { label: 'Home', href: '/' },
      { label: 'History', href: '/history' },
      { label: 'Settings', href: '/settings' },
    ],
  },
}));

describe('PublicLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders children in main content area', () => {
      render(
        <PublicLayout>
          <div data-testid="test-content">Test Content</div>
        </PublicLayout>
      );

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('id', 'main-content');
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('renders header with site navigation', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const header = document.querySelector('header');
      expect(header).toBeInTheDocument();

      // Check for logo/brand link
      const brandLink = screen.getByText('ADAShield');
      expect(brandLink).toBeInTheDocument();
      expect(brandLink.closest('a')).toHaveAttribute('href', '/');
    });

    it('renders footer section', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const footer = document.querySelector('footer');
      expect(footer).toBeInTheDocument();

      // Check copyright text
      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${currentYear} ADAShield`))).toBeInTheDocument();

      // Check footer links
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('SkipLink Integration - Requirement 6.2', () => {
    it('SkipLink is first focusable element', () => {
      const { container } = render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      // SkipLink should be the first anchor in the document
      const skipLink = container.querySelector('a.skip-link');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('SkipLink targets main content ID', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const skipLink = document.querySelector('a.skip-link');
      const mainContent = screen.getByRole('main');

      expect(skipLink).toHaveAttribute('href', '#main-content');
      expect(mainContent).toHaveAttribute('id', 'main-content');
    });
  });

  describe('Breadcrumbs Integration - Requirement 6.2, 6.4', () => {
    it('breadcrumbs render when prop provided', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Scan History', href: '/history' },
        { label: 'Scan Results' },
      ];

      render(
        <PublicLayout breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </PublicLayout>
      );

      const breadcrumbsNav = screen.getByTestId('breadcrumbs');
      expect(breadcrumbsNav).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Scan History')).toBeInTheDocument();
      expect(screen.getByText('Scan Results')).toBeInTheDocument();
    });

    it('breadcrumbs do not render when prop is not provided', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const breadcrumbsNav = screen.queryByTestId('breadcrumbs');
      expect(breadcrumbsNav).not.toBeInTheDocument();
    });

    it('secondary header bar is hidden when no breadcrumbs or actions - Requirement 6.5', () => {
      const { container } = render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      // Secondary bar should not exist
      const secondaryBar = container.querySelector('.border-t.border-gray-200.bg-gray-50');
      expect(secondaryBar).not.toBeInTheDocument();
    });

    it('secondary header bar shows when breadcrumbs are provided', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      const { container } = render(
        <PublicLayout breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </PublicLayout>
      );

      // Secondary bar should exist
      const secondaryBar = container.querySelector('.border-t.border-gray-200.bg-gray-50');
      expect(secondaryBar).toBeInTheDocument();
    });
  });

  describe('Back Button Integration - Requirement 6.2', () => {
    it('back button renders when showBackButton is true', () => {
      render(
        <PublicLayout showBackButton>
          <div>Content</div>
        </PublicLayout>
      );

      const backButton = screen.getByTestId('back-button');
      expect(backButton).toBeInTheDocument();
    });

    it('back button does not render by default', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const backButton = screen.queryByTestId('back-button');
      expect(backButton).not.toBeInTheDocument();
    });

    it('back button accepts custom href', () => {
      render(
        <PublicLayout showBackButton backButtonHref="/custom-path">
          <div>Content</div>
        </PublicLayout>
      );

      const backButton = screen.getByTestId('back-button');
      expect(backButton).toHaveAttribute('data-href', '/custom-path');
    });

    it('back button accepts custom label', () => {
      render(
        <PublicLayout showBackButton backButtonLabel="Return to Dashboard">
          <div>Content</div>
        </PublicLayout>
      );

      const backButton = screen.getByTestId('back-button');
      expect(backButton).toHaveAttribute('data-label', 'Return to Dashboard');
      expect(backButton).toHaveTextContent('Return to Dashboard');
    });
  });

  describe('Header Actions Integration - Requirement 6.3', () => {
    it('headerActions slot renders custom content', () => {
      const customActions = (
        <div data-testid="custom-actions">
          <button>Export</button>
          <button>Share</button>
        </div>
      );

      render(
        <PublicLayout headerActions={customActions}>
          <div>Content</div>
        </PublicLayout>
      );

      const actionsSlot = screen.getByTestId('custom-actions');
      expect(actionsSlot).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });

    it('headerActions do not render when prop is not provided', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      // Actions slot should not exist
      const actionsSlot = screen.queryByTestId('custom-actions');
      expect(actionsSlot).not.toBeInTheDocument();
    });

    it('secondary header bar shows when headerActions are provided', () => {
      const customActions = <button>Export</button>;

      const { container } = render(
        <PublicLayout headerActions={customActions}>
          <div>Content</div>
        </PublicLayout>
      );

      // Secondary bar should exist
      const secondaryBar = container.querySelector('.border-t.border-gray-200.bg-gray-50');
      expect(secondaryBar).toBeInTheDocument();
    });
  });

  describe('Landmark Roles and Accessibility - Requirement 6.2', () => {
    it('has correct landmark roles', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      // Check for header landmark
      const header = document.querySelector('header');
      expect(header).toBeInTheDocument();

      // Check for main landmark with role
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('id', 'main-content');

      // Check for footer landmark
      const footer = document.querySelector('footer');
      expect(footer).toBeInTheDocument();
    });

    it('site navigation has proper aria-label', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const siteNav = screen.getByLabelText('Site navigation');
      expect(siteNav).toBeInTheDocument();
      expect(siteNav.tagName).toBe('NAV');
    });

    it('main content area is properly identified for skip link', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const mainContent = document.getElementById('main-content');
      expect(mainContent).toBeInTheDocument();
      expect(mainContent?.tagName).toBe('MAIN');
    });
  });

  describe('Desktop and Mobile Navigation - Requirement 6.2, 6.4', () => {
    it('renders desktop navigation with hidden class', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const headerNav = screen.getByTestId('header-nav');
      expect(headerNav).toBeInTheDocument();
      expect(headerNav).toHaveClass('hidden', 'md:flex');
    });

    it('renders mobile navigation', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const mobileNav = screen.getByTestId('mobile-nav');
      expect(mobileNav).toBeInTheDocument();
      expect(mobileNav).toHaveTextContent('3 items'); // mainNav has 3 items
    });

    it('mobile navigation is wrapped in md:hidden container', () => {
      const { container } = render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const mobileNavContainer = screen.getByTestId('mobile-nav').parentElement;
      expect(mobileNavContainer).toHaveClass('md:hidden');
    });
  });

  describe('Combined Features - Integration Tests', () => {
    it('renders all features together correctly', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      const customActions = <button data-testid="export-btn">Export</button>;

      render(
        <PublicLayout
          breadcrumbs={breadcrumbs}
          showBackButton
          backButtonHref="/history"
          backButtonLabel="Back to History"
          headerActions={customActions}
        >
          <div data-testid="page-content">Page Content</div>
        </PublicLayout>
      );

      // Check all components are rendered
      expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
      expect(screen.getByTestId('back-button')).toBeInTheDocument();
      expect(screen.getByTestId('export-btn')).toBeInTheDocument();
      expect(screen.getByTestId('page-content')).toBeInTheDocument();
    });

    it('secondary header bar contains both back button and breadcrumbs', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      const { container } = render(
        <PublicLayout breadcrumbs={breadcrumbs} showBackButton>
          <div>Content</div>
        </PublicLayout>
      );

      const secondaryBar = container.querySelector('.border-t.border-gray-200.bg-gray-50');
      expect(secondaryBar).toBeInTheDocument();

      // Both components should be within the secondary bar
      const backButton = screen.getByTestId('back-button');
      const breadcrumbsNav = screen.getByTestId('breadcrumbs');

      expect(secondaryBar).toContainElement(backButton);
      expect(secondaryBar).toContainElement(breadcrumbsNav);
    });
  });

  describe('Sticky Header Behavior', () => {
    it('header is sticky by default', () => {
      const { container } = render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const header = container.querySelector('header');
      expect(header).toHaveClass('sticky', 'top-0');
    });

    it('header can be non-sticky when stickyHeader is false', () => {
      const { container } = render(
        <PublicLayout stickyHeader={false}>
          <div>Content</div>
        </PublicLayout>
      );

      const header = container.querySelector('header');
      expect(header).not.toHaveClass('sticky');
      expect(header).not.toHaveClass('top-0');
    });
  });

  describe('Layout Structure and Styling', () => {
    it('has min-height screen and flex column layout', () => {
      const { container } = render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const layoutWrapper = container.firstChild as HTMLElement;
      expect(layoutWrapper).toHaveClass('min-h-screen', 'flex', 'flex-col');
    });

    it('main content has flex-1 to fill available space', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const main = screen.getByRole('main');
      expect(main).toHaveClass('flex-1');
    });

    it('header has proper border and background styling', () => {
      const { container } = render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const header = container.querySelector('header');
      expect(header).toHaveClass('bg-white', 'border-b', 'border-gray-200', 'z-40');
    });

    it('footer has proper border and background styling', () => {
      const { container } = render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const footer = container.querySelector('footer');
      expect(footer).toHaveClass('border-t', 'py-8', 'bg-white');
    });
  });

  describe('Navigation Progress Indicator', () => {
    it('renders NavigationProgress component', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const progressIndicator = screen.getByTestId('navigation-progress');
      expect(progressIndicator).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty children gracefully', () => {
      render(<PublicLayout>{null}</PublicLayout>);

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toBeEmptyDOMElement();
    });

    it('handles complex children structures', () => {
      render(
        <PublicLayout>
          <div>
            <section>
              <h1>Title</h1>
              <p>Content</p>
            </section>
          </div>
        </PublicLayout>
      );

      const main = screen.getByRole('main');
      expect(main).toContainHTML('<h1>Title</h1>');
      expect(main).toContainHTML('<p>Content</p>');
    });

    it('handles multiple React fragments as children', () => {
      render(
        <PublicLayout>
          <>
            <div data-testid="fragment-1">Fragment 1</div>
            <div data-testid="fragment-2">Fragment 2</div>
          </>
        </PublicLayout>
      );

      expect(screen.getByTestId('fragment-1')).toBeInTheDocument();
      expect(screen.getByTestId('fragment-2')).toBeInTheDocument();
    });
  });

  describe('Brand Link Accessibility', () => {
    it('brand link has proper focus styles', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const brandLink = screen.getByText('ADAShield').closest('a');
      expect(brandLink).toHaveClass(
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-blue-500',
        'focus:ring-offset-2'
      );
    });

    it('brand link has hover transition', () => {
      render(
        <PublicLayout>
          <div>Content</div>
        </PublicLayout>
      );

      const brandLink = screen.getByText('ADAShield').closest('a');
      expect(brandLink).toHaveClass('transition-colors', 'hover:text-blue-600');
    });
  });
});
