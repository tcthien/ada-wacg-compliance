/**
 * PageViewTracker Component
 *
 * Automatic page view tracking for Next.js App Router SPA navigation.
 * This component tracks page views on initial load and client-side route changes.
 *
 * Features:
 * - Tracks initial page load
 * - Tracks client-side navigation (SPA route changes)
 * - Consent-aware (only tracks when analytics enabled)
 * - Zero visual footprint (renders null)
 * - Uses Next.js usePathname for route detection
 *
 * Task 18: Create PageViewTracker component for automatic page view tracking
 *
 * Requirements:
 * - 2.1: Send page_view event to GA4 on page navigation
 * - 2.2: Track virtual page views correctly with Next.js client-side navigation
 */

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * PageViewTracker Component
 *
 * Invisible component that automatically tracks page views using Google Analytics.
 * Should be placed in the root layout to track all navigation events.
 *
 * How it works:
 * 1. Monitors pathname changes using Next.js usePathname hook
 * 2. Tracks page view on initial mount (first page load)
 * 3. Tracks page view whenever pathname changes (client-side navigation)
 * 4. Respects user consent (only tracks when analytics enabled)
 * 5. Uses document.title for page title reporting
 *
 * @example
 * ```tsx
 * // In app/layout.tsx
 * import { PageViewTracker } from '@/components/features/analytics';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AnalyticsProvider>
 *           <PageViewTracker />
 *           {children}
 *         </AnalyticsProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @returns null - This component has no visual output
 */
export function PageViewTracker(): null {
  const pathname = usePathname();
  const { trackPageView, isEnabled } = useAnalytics();

  useEffect(() => {
    // Only track if analytics is enabled (user consent + config)
    if (!isEnabled) {
      return;
    }

    // Track page view with current pathname
    // document.title provides the page title for better GA4 reporting
    trackPageView(pathname, typeof document !== 'undefined' ? document.title : undefined);
  }, [pathname, trackPageView, isEnabled]);

  // Invisible component - no visual output
  return null;
}
