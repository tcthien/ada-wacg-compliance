'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScanForm } from '@/components/features/scan/ScanForm';
import { CoverageDisclaimer } from '@/components/features/compliance/CoverageDisclaimer';
import { CookieConsent } from '@/components/features/privacy/CookieConsent';
import { PrivacyPolicyLink } from '@/components/features/privacy/PrivacyPolicyLink';

export default function HomePage() {
  const router = useRouter();

  const handleScanStarted = (scanId: string) => {
    router.push(`/scan/${scanId}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/" className="text-xl font-bold text-foreground">
            ADAShield
          </a>
          <div className="flex gap-4">
            <a
              href="/history"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              History
            </a>
            <a
              href="/settings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Settings
            </a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
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
            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 max-w-xl mx-auto">
              <ScanForm onScanStarted={handleScanStarted} />
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

      {/* Cookie Consent Banner */}
      <CookieConsent />
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
