'use client';

/**
 * Early Bird Landing Page
 *
 * Landing page for the AI-powered accessibility analysis campaign.
 * Features:
 * - Hero section with value proposition
 * - "How it works" section
 * - Feature benefits list
 * - Campaign quota display
 * - CTA button linking to scan form with ?ai=1 parameter
 * - Waitlist signup when campaign ends
 *
 * Requirements: REQ-2 AC 1-4
 */

import { useState } from 'react';
import Link from 'next/link';
import { useCampaignStatus } from '@/hooks/useCampaignStatus';
import { CampaignQuotaDisplay } from '@/components/features/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  Zap,
  Mail,
  FileText,
  CheckCircle2,
  ArrowRight,
  Clock,
  Target,
  MessageSquareText,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export default function EarlyBirdPage() {
  const { status, isLoading, error } = useCampaignStatus();
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const isCampaignActive = status?.active && status.slotsRemaining > 0;

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) {
      setWaitlistError('Please enter your email address');
      return;
    }
    // In a real implementation, this would call an API endpoint
    // For now, we'll just show a success message
    setWaitlistSubmitted(true);
    setWaitlistError(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-foreground">
            ADAShield
          </Link>
          <div className="flex gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Link
              href="/history"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              History
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-purple-50 via-blue-50 to-white py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            {/* Early Bird Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 border border-purple-200 rounded-full text-purple-800 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Limited Time Early Bird Access</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground">
              Get <span className="text-purple-600">AI-Powered</span> Accessibility Analysis
              <span className="block mt-2 text-3xl md:text-4xl lg:text-5xl text-muted-foreground font-normal">
                Completely Free
              </span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transform complex WCAG violations into plain-language explanations with
              personalized fix suggestions. Our AI understands your specific context
              and prioritizes what matters most.
            </p>

            {/* Campaign Status / CTA */}
            <div className="max-w-md mx-auto mb-8">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Checking availability...</span>
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Unable to check campaign status. Please try again later.
                  </AlertDescription>
                </Alert>
              ) : isCampaignActive && status ? (
                <div className="space-y-4">
                  <CampaignQuotaDisplay
                    remainingPercentage={status.percentRemaining}
                    remainingSlots={status.slotsRemaining}
                    className="p-4 bg-white rounded-lg border shadow-sm"
                  />
                  <Button asChild size="lg" className="w-full bg-purple-600 hover:bg-purple-700">
                    <Link href="/?ai=1" className="flex items-center justify-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Claim Your Free AI Scan
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              ) : (
                /* Campaign Ended - Waitlist */
                <div className="bg-white rounded-xl shadow-lg p-6 border">
                  <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                    <Clock className="h-5 w-5" />
                    <span className="font-medium">Early Bird Campaign Ended</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Join the waitlist to be notified when we launch the next campaign
                    or our premium AI features.
                  </p>
                  {waitlistSubmitted ? (
                    <div className="flex items-center justify-center gap-2 text-green-600 py-4">
                      <CheckCircle2 className="h-5 w-5" />
                      <span>You&apos;re on the list! We&apos;ll be in touch.</span>
                    </div>
                  ) : (
                    <form onSubmit={handleWaitlistSubmit} className="space-y-3">
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        required
                      />
                      {waitlistError && (
                        <p className="text-sm text-red-600">{waitlistError}</p>
                      )}
                      <Button type="submit" className="w-full">
                        <Mail className="h-4 w-4 mr-2" />
                        Join Waitlist
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
              How It Works
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <StepCard
                number={1}
                icon={<Zap className="h-6 w-6 text-blue-600" />}
                title="Scan Your Website"
                description="Enter your URL and enable AI enhancement. Our scanner tests against WCAG 2.0, 2.1, and 2.2 guidelines."
              />
              <StepCard
                number={2}
                icon={<Sparkles className="h-6 w-6 text-purple-600" />}
                title="AI Analyzes Issues"
                description="Our AI processes each accessibility issue, generating plain-language explanations and code-specific fix suggestions."
              />
              <StepCard
                number={3}
                icon={<Mail className="h-6 w-6 text-green-600" />}
                title="Get Results via Email"
                description="Receive a comprehensive report with prioritized fixes, sent directly to your inbox within minutes."
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-foreground">
              What You Get with AI Enhancement
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Go beyond basic violation detection with context-aware analysis
              that understands your specific implementation.
            </p>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <FeatureCard
                icon={<MessageSquareText className="h-6 w-6 text-purple-600" />}
                title="Plain-Language Explanations"
                description="Technical WCAG criteria translated into clear, understandable terms. Know exactly why each issue matters and who it affects."
              />
              <FeatureCard
                icon={<FileText className="h-6 w-6 text-blue-600" />}
                title="Code-Specific Fix Suggestions"
                description="Get copy-paste-ready code snippets tailored to your actual HTML structure. No more guessing how to implement fixes."
              />
              <FeatureCard
                icon={<Target className="h-6 w-6 text-orange-600" />}
                title="Business Impact Priority"
                description="Issues ranked 1-10 based on user impact, legal risk, and fix complexity. Focus your efforts where they matter most."
              />
              <FeatureCard
                icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
                title="Remediation Roadmap"
                description="A step-by-step action plan to achieve compliance. Know exactly what to fix first and why."
              />
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
              Standard vs. AI-Enhanced Scan
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-50 rounded-xl p-6 border">
                <h3 className="font-semibold text-lg mb-4">Standard Scan</h3>
                <ul className="space-y-3 text-sm">
                  <ComparisonItem included>WCAG violation detection</ComparisonItem>
                  <ComparisonItem included>Issue location in code</ComparisonItem>
                  <ComparisonItem included>WCAG criteria reference</ComparisonItem>
                  <ComparisonItem>Plain-language explanations</ComparisonItem>
                  <ComparisonItem>Code fix suggestions</ComparisonItem>
                  <ComparisonItem>Business impact scoring</ComparisonItem>
                  <ComparisonItem>Remediation roadmap</ComparisonItem>
                </ul>
                <div className="mt-6">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/">Start Standard Scan</Link>
                  </Button>
                </div>
              </div>

              <div className="bg-purple-50 rounded-xl p-6 border border-purple-200 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Early Bird Special
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-4">AI-Enhanced Scan</h3>
                <ul className="space-y-3 text-sm">
                  <ComparisonItem included>WCAG violation detection</ComparisonItem>
                  <ComparisonItem included>Issue location in code</ComparisonItem>
                  <ComparisonItem included>WCAG criteria reference</ComparisonItem>
                  <ComparisonItem included>Plain-language explanations</ComparisonItem>
                  <ComparisonItem included>Code fix suggestions</ComparisonItem>
                  <ComparisonItem included>Business impact scoring</ComparisonItem>
                  <ComparisonItem included>Remediation roadmap</ComparisonItem>
                </ul>
                <div className="mt-6">
                  {isCampaignActive ? (
                    <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
                      <Link href="/?ai=1">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Get AI Enhancement Free
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled className="w-full">
                      Campaign Ended
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        {isCampaignActive && status && (
          <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <div className="container mx-auto px-4 text-center max-w-2xl">
              <Sparkles className="h-10 w-10 mx-auto mb-4 opacity-80" />
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Don&apos;t Miss Out on Free AI Analysis
              </h2>
              <p className="text-purple-100 mb-6">
                Only {status.slotsRemaining} free AI scans remaining. Claim yours before they&apos;re gone.
              </p>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="bg-white text-purple-700 hover:bg-gray-100"
              >
                <Link href="/?ai=1" className="flex items-center gap-2">
                  Start Your Free AI Scan
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              &copy; 2024 ADAShield. All rights reserved.
            </div>
            <div className="flex gap-6">
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Step Card Component for "How It Works" section
 */
function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative text-center">
      {/* Step Number */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
        {number}
      </div>
      <div className="pt-8 p-6 bg-gray-50 rounded-xl border">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-sm mb-4">
          {icon}
        </div>
        <h3 className="font-semibold mb-2 text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * Feature Card Component
 */
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 p-5 bg-white rounded-xl border">
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <h3 className="font-semibold mb-1 text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * Comparison Item Component
 */
function ComparisonItem({
  children,
  included = false,
}: {
  children: React.ReactNode;
  included?: boolean;
}) {
  return (
    <li className={`flex items-center gap-2 ${included ? 'text-foreground' : 'text-gray-400'}`}>
      {included ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <div className="h-4 w-4 border border-gray-300 rounded-full flex-shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}
