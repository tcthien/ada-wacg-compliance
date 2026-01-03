'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ScanForm } from '@/components/features/scan/ScanForm';
import { CoverageDisclaimer } from '@/components/features/compliance/CoverageDisclaimer';
import { PrivacyPolicyLink } from '@/components/features/privacy/PrivacyPolicyLink';
import { SkipLink, HeaderNav, MobileNav, NavigationProgress } from '@/components/navigation';
import { navigationConfig } from '@/lib/navigation-config';

interface DiscoveredPage {
  id: string;
  url: string;
  title?: string;
  depth?: number;
}

interface DiscoveryData {
  discoveryId: string;
  homepageUrl: string;
  pages: DiscoveredPage[];
}

export default function HomePage() {
  const router = useRouter();
  const [discoveryData, setDiscoveryData] = useState<DiscoveryData | null>(null);
  const [showDiscoveredPages, setShowDiscoveredPages] = useState(false);
  // Track scan mode: 'single' for one URL, 'multiple' for batch scan
  const [scanMode, setScanMode] = useState<'single' | 'multiple'>('single');

  // Check for discovered pages on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = sessionStorage.getItem('discovery:selectedPages');
      if (stored) {
        const data = JSON.parse(stored) as DiscoveryData;
        if (data.pages && data.pages.length > 0) {
          setDiscoveryData(data);
          // Auto-enable discovered pages so URLs are pre-filled in the form
          // This provides a seamless flow from discovery → scan
          setShowDiscoveredPages(true);
          // Auto-select "Multiple Pages" mode when coming from discovery flow
          setScanMode('multiple');
        }
      }
    } catch (err) {
      console.error('Failed to load discovered pages:', err);
    }
  }, []);

  const handleScanStarted = (scanId: string) => {
    router.push(`/scan/${scanId}`);
  };

  const handleScanSuccess = () => {
    // Clear sessionStorage only on successful scan creation
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('discovery:selectedPages');
    }
    setDiscoveryData(null);
    setShowDiscoveredPages(false);
  };

  const handleDismissDiscoveredPages = () => {
    setDiscoveryData(null);
    setShowDiscoveredPages(false);
    // Reset to single URL mode when clearing discovered pages
    setScanMode('single');
    // Clear sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('discovery:selectedPages');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip Link - First focusable element */}
      <SkipLink targetId="main-content" />

      {/* Navigation Progress */}
      <NavigationProgress />

      {/* Header with Desktop and Mobile Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <nav className="container mx-auto px-4 py-4 flex justify-between items-center" aria-label="Site navigation">
          <a href="/" className="text-xl font-bold text-foreground transition-colors hover:text-blue-600">
            ADAShield
          </a>
          <HeaderNav className="hidden md:flex" />
          <div className="md:hidden">
            <MobileNav items={navigationConfig.mainNav} />
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main id="main-content" className="flex-1">
        <section className="bg-gradient-to-b from-blue-50 to-white py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Free Website Accessibility Testing
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Check your website for WCAG compliance issues. Get actionable fix
              recommendations instantly.
            </p>

            {/* Scan Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 max-w-2xl mx-auto">
              {/* Scan Mode Selector */}
              <div className="mb-6">
                <p className="text-sm font-medium text-foreground mb-3 text-left">
                  How would you like to scan?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Single URL Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setScanMode('single');
                      // Clear discovered pages when switching to single mode
                      if (scanMode === 'multiple') {
                        handleDismissDiscoveredPages();
                      }
                    }}
                    className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                      scanMode === 'single'
                        ? 'border-blue-500 bg-blue-50 cursor-default'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                    }`}
                    aria-pressed={scanMode === 'single'}
                  >
                    <svg
                      className={`w-6 h-6 mb-2 ${scanMode === 'single' ? 'text-blue-600' : 'text-gray-600'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <span className={`font-medium text-sm ${scanMode === 'single' ? 'text-blue-700' : 'text-gray-700'}`}>Single URL</span>
                    <span className={`text-xs mt-1 ${scanMode === 'single' ? 'text-blue-600' : 'text-gray-500'}`}>Scan one page</span>
                  </button>

                  {/* Multiple Pages Option - Links to discovery when not in multi mode */}
                  {scanMode === 'multiple' ? (
                    <div
                      className="flex flex-col items-center p-4 rounded-lg border-2 border-blue-500 bg-blue-50 cursor-default"
                      role="button"
                      aria-pressed="true"
                    >
                      <svg
                        className="w-6 h-6 text-blue-600 mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <span className="font-medium text-blue-700 text-sm">Multiple Pages</span>
                      <span className="text-xs text-blue-600 mt-1">Discover & scan site</span>
                    </div>
                  ) : (
                    <a
                      href="/discovery?returnUrl=/"
                      className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer"
                      role="button"
                      aria-pressed="false"
                    >
                      <svg
                        className="w-6 h-6 text-gray-600 mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      <span className="font-medium text-gray-700 text-sm">Multiple Pages</span>
                      <span className="text-xs text-gray-500 mt-1">Discover & scan site</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Discovered Pages Summary */}
              {discoveryData && showDiscoveredPages && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <h3 className="font-medium text-blue-900">
                          {discoveryData.pages.length} page{discoveryData.pages.length !== 1 ? 's' : ''} ready to scan
                        </h3>
                      </div>
                      <p className="text-sm text-blue-700">
                        From <span className="font-medium">{discoveryData.homepageUrl}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissDiscoveredPages}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      aria-label="Clear discovered pages"
                      title="Clear and enter URL manually"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <Suspense fallback={<div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div>}>
                <ScanForm
                  onScanStarted={handleScanStarted}
                  onScanSuccess={handleScanSuccess}
                  {...(showDiscoveredPages && discoveryData ? { initialUrls: discoveryData.pages.map(p => p.url) } : {})}
                />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Coverage Disclaimer */}
        <section className="container mx-auto px-4 py-8 max-w-2xl">
          <CoverageDisclaimer />
        </section>

        {/* Features Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
              Why ADAShield?
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <FeatureCard
                icon="🔍"
                title="Comprehensive Scanning"
                description="Tests against WCAG 2.0, 2.1, and 2.2 guidelines at Levels A, AA, and AAA."
              />
              <FeatureCard
                icon="🛠️"
                title="Actionable Fixes"
                description="Get step-by-step instructions to fix each accessibility issue."
              />
              <FeatureCard
                icon="📊"
                title="Detailed Reports"
                description="Export results as PDF or JSON for documentation and compliance."
              />
              <FeatureCard
                icon="🔒"
                title="Privacy First"
                description="Your data is never sold. Request deletion anytime."
              />
              <FeatureCard
                icon="⚡"
                title="Fast Results"
                description="Get results in under 60 seconds for most websites."
              />
              <FeatureCard
                icon="💰"
                title="100% Free"
                description="No signup required. No hidden costs. No limits."
              />
            </div>
          </div>
        </section>

        {/* Compliance Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              Stay Compliant
            </h2>
            <p className="text-muted-foreground mb-8">
              With increasing accessibility lawsuits and regulations like ADA,
              EAA, and Section 508, ensuring your website is accessible is more
              important than ever.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                ADA Title II/III
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                European Accessibility Act
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
                Section 508
              </span>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full">
                WCAG 2.2
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © 2024 ADAShield. All rights reserved.
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

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <div className="text-4xl mb-4" role="img" aria-label={title}>
        {icon}
      </div>
      <h3 className="font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
