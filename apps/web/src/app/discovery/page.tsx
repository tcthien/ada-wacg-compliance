'use client';

import { Suspense } from 'react';
import { DiscoveryFlowV2 } from '@/components/features/discovery/DiscoveryFlowV2';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PublicLayout } from '@/components/layouts/PublicLayout';

/**
 * Discovery Page - V2 Flow
 *
 * Allows users to discover website pages using the new V2 flow.
 * Flow: Input URLs (sitemap/manual) → Select URLs → Preview → Start scan
 *
 * Features:
 * - PublicLayout for consistent navigation and breadcrumbs
 * - ErrorBoundary for error handling
 * - Suspense for loading states
 * - DiscoveryFlowV2 component for main flow
 *
 * Implements:
 * - US-1: Sitemap URL Discovery
 * - US-2: Manual URL Entry
 * - US-3: URL Selection with Checkboxes
 * - US-4: Batch Preview
 * - US-5: Scan Submission
 * - US-6: Free Navigation Between Steps
 * - Requirement 3.4: Breadcrumbs navigation
 * - Requirement 6.1: Unified PublicLayout
 */
export default function DiscoveryPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<DiscoveryPageLoading />}>
        <DiscoveryPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Loading skeleton for discovery page
 * Shown while components are being loaded
 * Uses PublicLayout for consistent structure during loading
 */
function DiscoveryPageLoading() {
  return (
    <PublicLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Discover Pages' }
      ]}
    >
      <div className="py-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-muted-foreground">Loading discovery flow...</p>
        </div>
      </div>
    </PublicLayout>
  );
}

/**
 * Discovery Page Content
 *
 * Main content component using the new V2 discovery flow.
 * Uses PublicLayout for consistent header, footer, and breadcrumb navigation.
 * Requirements: 3.4 (breadcrumbs), 6.1 (PublicLayout)
 */
function DiscoveryPageContent() {
  return (
    <PublicLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Discover Pages' }
      ]}
    >
      <div className="py-8">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-foreground">
              Discover Website Pages
            </h1>
            <p className="mt-2 text-muted-foreground">
              Import pages from sitemap or enter manually before scanning
            </p>
          </div>

          {/* Discovery Flow V2 */}
          <DiscoveryFlowV2 />
        </div>
      </div>
    </PublicLayout>
  );
}
