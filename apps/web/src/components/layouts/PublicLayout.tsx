import Link from 'next/link';
import {
  SkipLink,
  HeaderNav,
  MobileNav,
  NavigationProgress,
  BackButton,
  Breadcrumbs,
  type BreadcrumbItem,
} from '@/components/navigation';
import { PrivacyPolicyLink } from '@/components/features/privacy';
import { navigationConfig } from '@/lib/navigation-config';

/**
 * PublicLayout component props interface
 *
 * Provides a unified layout wrapper for all public-facing pages with:
 * - Header with navigation
 * - Optional breadcrumbs
 * - Optional back button
 * - Custom header actions (Export, Share, etc.)
 * - Footer
 * - Skip to content link for accessibility
 */
export interface PublicLayoutProps {
  /** Page content to render in main area */
  children: React.ReactNode;

  /** Breadcrumb configuration - omit for pages without breadcrumbs */
  breadcrumbs?: BreadcrumbItem[];

  /** Show back button with optional custom destination */
  showBackButton?: boolean;
  backButtonHref?: string;
  backButtonLabel?: string;

  /** Custom actions to display in header (e.g., Export, Share buttons) */
  headerActions?: React.ReactNode;

  /** Page title for mobile header */
  pageTitle?: string;

  /** Whether header should be sticky on scroll */
  stickyHeader?: boolean;
}

/**
 * PublicLayout - Unified layout component for public pages
 *
 * Provides consistent structure across:
 * - Homepage
 * - Scan results pages
 * - History page
 * - Batch results pages
 * - Discovery flow pages
 *
 * Ensures accessibility with skip links and semantic HTML.
 */
export function PublicLayout({
  children,
  breadcrumbs,
  showBackButton = false,
  backButtonHref,
  backButtonLabel,
  headerActions,
  stickyHeader = true,
}: PublicLayoutProps) {
  // Determine if we should show the secondary header bar
  const showSecondaryBar = showBackButton || breadcrumbs || headerActions;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip to main content link for keyboard navigation */}
      <SkipLink targetId="main-content" />

      {/* Navigation progress indicator - shows during page transitions */}
      <NavigationProgress />

      {/* Header section with navigation - Requirements: 1.1, 5.5, 7.1 */}
      <header
        className={`
          bg-white border-b border-gray-200 z-40
          ${stickyHeader ? 'sticky top-0' : ''}
        `}
      >
        <nav
          className="container mx-auto px-4 py-4 flex justify-between items-center"
          aria-label="Site navigation"
        >
          {/* Logo/Brand - Links to home */}
          <Link
            href="/"
            className="text-xl font-bold text-foreground transition-colors hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            ADAShield
          </Link>

          {/* Desktop Navigation - Hidden on mobile (< 768px) */}
          <HeaderNav className="hidden md:flex" />

          {/* Mobile Navigation - Only visible on mobile (< 768px) */}
          <div className="md:hidden">
            <MobileNav items={navigationConfig.mainNav} />
          </div>
        </nav>

        {/* Secondary header bar - Requirements: 2.1, 3.1, 4.1, 5.1, 5.2 */}
        {showSecondaryBar && (
          <div className="border-t border-gray-200 bg-gray-50">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                {/* Left side: Back button + Breadcrumbs */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {showBackButton && (
                    <BackButton
                      {...(backButtonHref && { href: backButtonHref })}
                      {...(backButtonLabel && { label: backButtonLabel })}
                    />
                  )}
                  {breadcrumbs && (
                    <Breadcrumbs
                      items={breadcrumbs}
                      className="mb-0"
                    />
                  )}
                </div>

                {/* Right side: Custom header actions */}
                {headerActions && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {headerActions}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content area */}
      <main
        id="main-content"
        role="main"
        className="flex-1"
      >
        {children}
      </main>

      {/* Footer section - Requirements: 6.2 */}
      <footer className="border-t py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ADAShield. All rights reserved.
            </div>
            <div className="flex gap-6">
              <PrivacyPolicyLink />
              <a
                href="/settings"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Settings
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
