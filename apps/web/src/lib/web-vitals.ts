/**
 * Core Web Vitals Tracking
 *
 * Tracks Core Web Vitals performance metrics and sends them to Google Analytics
 * via the dataLayer. Metrics are only tracked when analytics consent is granted.
 *
 * Features:
 * - Largest Contentful Paint (LCP) tracking
 * - Interaction to Next Paint (INP) tracking (replaces deprecated FID)
 * - Cumulative Layout Shift (CLS) tracking
 * - Consent-aware tracking (respects user privacy preferences)
 * - Type-safe metric reporting
 * - Debug logging support
 *
 * Note: INP replaced FID in web-vitals v4+. INP is a better metric for measuring
 * responsiveness throughout the entire page lifecycle, not just the first input.
 *
 * Related: Requirement 6.3 - Core Web Vitals tracking
 */

import { onLCP, onINP, onCLS, type Metric } from 'web-vitals';
import { pushToDataLayer } from './analytics';
import { getConsent } from './consent';
import { env } from './env';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Core Web Vitals metric names
 * Note: INP (Interaction to Next Paint) replaced FID in web-vitals v4+
 */
type MetricName = 'LCP' | 'INP' | 'CLS';

/**
 * Core Web Vitals metric rating
 */
type MetricRating = 'good' | 'needs-improvement' | 'poor';

// ============================================================================
// CORE WEB VITALS TRACKING
// ============================================================================

/**
 * Report a Core Web Vitals metric to Google Analytics
 *
 * Pushes metric data to dataLayer as a 'web_vitals' event with:
 * - metric_name: Name of the metric (LCP, INP, CLS)
 * - metric_value: Value of the metric (rounded to 2 decimal places)
 * - metric_rating: Performance rating (good, needs-improvement, poor)
 *
 * Only reports metrics when:
 * - Analytics consent is granted
 * - Analytics is enabled in environment
 * - Running in browser context
 *
 * @param metric - Metric object from web-vitals library
 *
 * @example
 * ```typescript
 * // Automatically called by web-vitals observers
 * reportWebVitals({ name: 'LCP', value: 1234.56, rating: 'good', ... });
 * // Pushes: { event: 'web_vitals', metric_name: 'LCP', metric_value: 1234.56, metric_rating: 'good' }
 * ```
 */
function reportWebVitals(metric: Metric): void {
  // Check if analytics consent is granted
  const consent = getConsent();
  if (!consent.analytics) {
    if (env.analyticsDebug) {
      console.info(
        '[Web Vitals] Analytics consent not granted, skipping metric:',
        metric.name
      );
    }
    return;
  }

  // Extract metric details
  const metricName = metric.name as MetricName;
  const metricValue = Math.round(metric.value * 100) / 100; // Round to 2 decimal places
  const metricRating = metric.rating as MetricRating;

  // Push metric to dataLayer
  const pushed = pushToDataLayer({
    event: 'web_vitals',
    metric_name: metricName,
    metric_value: metricValue,
    metric_rating: metricRating,
  });

  if (pushed && env.analyticsDebug) {
    console.info(
      `[Web Vitals] ${metricName} tracked:`,
      `${metricValue} (${metricRating})`
    );
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Core Web Vitals tracking
 *
 * Sets up observers for LCP, INP, and CLS metrics. Each metric is reported
 * to Google Analytics when it becomes available.
 *
 * Metrics tracked:
 * - LCP (Largest Contentful Paint): Loading performance
 * - INP (Interaction to Next Paint): Responsiveness (replaces FID)
 * - CLS (Cumulative Layout Shift): Visual stability
 *
 * Should be called once during application initialization, typically in:
 * - Next.js app layout (apps/web/src/app/layout.tsx)
 * - Root component (_app.tsx for Pages Router)
 *
 * Safe to call multiple times (observers are idempotent).
 * Safe to call in SSR context (no-op if window is undefined).
 *
 * @example
 * ```typescript
 * // In app/layout.tsx
 * import { initWebVitals } from '@/lib/web-vitals';
 *
 * export default function RootLayout() {
 *   useEffect(() => {
 *     initWebVitals();
 *   }, []);
 *
 *   return <html>...</html>;
 * }
 * ```
 */
export function initWebVitals(): void {
  // Skip if not in browser context
  if (typeof window === 'undefined') {
    if (env.analyticsDebug) {
      console.info('[Web Vitals] Skipping initialization in SSR context');
    }
    return;
  }

  // Skip if analytics is disabled
  if (!env.analyticsEnabled) {
    if (env.analyticsDebug) {
      console.info('[Web Vitals] Analytics disabled, skipping initialization');
    }
    return;
  }

  try {
    // Set up Core Web Vitals observers
    onLCP(reportWebVitals);
    onINP(reportWebVitals);
    onCLS(reportWebVitals);

    if (env.analyticsDebug) {
      console.info('[Web Vitals] Core Web Vitals tracking initialized');
    }
  } catch (error) {
    if (env.analyticsDebug) {
      console.error('[Web Vitals] Failed to initialize tracking:', error);
    }
  }
}
