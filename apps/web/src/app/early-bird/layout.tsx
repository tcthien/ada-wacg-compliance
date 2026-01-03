import type { Metadata } from 'next';

/**
 * Early Bird Landing Page Metadata
 *
 * SEO and OpenGraph metadata for the AI Early Bird campaign landing page.
 * Requirements: REQ-2 (Landing Page)
 */

export const metadata: Metadata = {
  title: 'Free AI Accessibility Analysis | Early Bird Access | ADAShield',
  description:
    'Get AI-powered accessibility analysis completely free during our limited Early Bird campaign. Transform WCAG violations into plain-language explanations with code-specific fix suggestions.',
  keywords: [
    'accessibility testing',
    'WCAG compliance',
    'AI accessibility',
    'ADA compliance',
    'free accessibility scan',
    'website accessibility',
    'WCAG 2.1',
    'WCAG 2.2',
    'accessibility audit',
  ],
  openGraph: {
    type: 'website',
    title: 'Free AI Accessibility Analysis | ADAShield Early Bird',
    description:
      'Limited time: Get AI-powered WCAG analysis free. Plain-language explanations, code fix suggestions, and prioritized remediation roadmap.',
    siteName: 'ADAShield',
    images: [
      {
        url: '/og-early-bird.png',
        width: 1200,
        height: 630,
        alt: 'ADAShield AI Early Bird - Free Accessibility Analysis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AI Accessibility Analysis | ADAShield Early Bird',
    description:
      'Limited time: Get AI-powered WCAG analysis free. Plain-language explanations and code fix suggestions.',
    images: ['/og-early-bird.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/early-bird',
  },
};

export default function EarlyBirdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
