/**
 * Analytics Hook
 *
 * Provides easy-to-use analytics tracking functionality for React components.
 * This hook wraps the AnalyticsContext to provide a clean API for event tracking
 * and page view tracking throughout the application.
 *
 * Task 14: Create useAnalytics hook for convenient access to analytics functionality
 */

import { useCallback } from 'react';
import { useAnalyticsContext } from '@/components/features/analytics';
import type { AnalyticsEvent } from '@/lib/analytics.types';

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Extract event names from all analytics event types
 * This creates a union of all possible event names
 */
export type AnalyticsEventName = AnalyticsEvent['event'];

/**
 * Extract event type by name
 * This utility type gets the specific event interface based on the event name
 *
 * @example
 * ExtractEventByName<'scan_initiated'> = ScanInitiatedEvent
 * ExtractEventByName<'scan_completed'> = ScanCompletedEvent
 */
export type ExtractEventByName<T extends AnalyticsEventName> = Extract<
  AnalyticsEvent,
  { event: T }
>;

// ============================================================================
// HOOK INTERFACE
// ============================================================================

/**
 * Return type for useAnalytics hook
 * Provides methods for tracking analytics events and page views
 */
export interface UseAnalyticsReturn {
  /**
   * Type-safe event tracking method
   *
   * Automatically infers the correct event structure based on the event name,
   * ensuring compile-time type safety for all analytics operations.
   *
   * @param eventName - The name of the analytics event to track
   * @param eventData - Event-specific data (automatically typed based on eventName)
   *
   * @example
   * ```tsx
   * const { track } = useAnalytics();
   *
   * // TypeScript infers ScanInitiatedEvent structure
   * track('scan_initiated', {
   *   wcag_level: 'AA',
   *   scan_type: 'single',
   *   url_count: 1,
   *   timestamp: new Date().toISOString(),
   *   sessionId: 'session-123'
   * });
   *
   * // TypeScript error: missing required properties
   * track('scan_completed', {
   *   scan_duration_ms: 5000
   *   // Error: missing issue_count and wcag_level
   * });
   * ```
   */
  track: <T extends AnalyticsEventName>(
    eventName: T,
    eventData: Omit<ExtractEventByName<T>, 'event'>
  ) => void;

  /**
   * Track a page view event
   *
   * Sends page_view event to Google Analytics for navigation tracking.
   * Use this in page components or navigation handlers.
   *
   * @param path - The page path (e.g., '/scan/results')
   * @param title - Optional page title for better reporting (defaults to document.title)
   *
   * @example
   * ```tsx
   * const { trackPageView } = useAnalytics();
   *
   * // Track page view on navigation
   * useEffect(() => {
   *   trackPageView('/scan/results', 'Scan Results');
   * }, [trackPageView]);
   *
   * // Track with automatic title
   * trackPageView('/dashboard');
   * ```
   */
  trackPageView: (path: string, title?: string) => void;

  /**
   * Whether analytics is currently enabled
   *
   * Analytics is enabled when:
   * - User has granted consent for analytics cookies
   * - Environment configuration allows analytics (NEXT_PUBLIC_ANALYTICS_ENABLED=true)
   *
   * Use this to conditionally show analytics-related UI or skip tracking calls.
   *
   * @example
   * ```tsx
   * const { isEnabled, track } = useAnalytics();
   *
   * // Conditionally show analytics consent banner
   * {!isEnabled && <ConsentBanner />}
   *
   * // Track is already consent-aware, no need to check isEnabled
   * track('scan_initiated', eventData);
   * ```
   */
  isEnabled: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for accessing analytics functionality
 *
 * Provides a convenient API for tracking analytics events and page views.
 * This hook wraps the AnalyticsContext and adds type-safe event tracking
 * with automatic event name inference.
 *
 * Features:
 * - Type-safe event tracking with automatic inference
 * - Consent-aware (automatically respects user consent)
 * - Minimal API surface (track, trackPageView, isEnabled)
 * - Ready for use in any component within AnalyticsProvider
 *
 * @returns Analytics methods and state
 * @throws Error if used outside AnalyticsProvider
 *
 * @example
 * ```tsx
 * // Basic usage in a component
 * function ScanButton() {
 *   const { track, isEnabled } = useAnalytics();
 *
 *   const handleScanInitiated = () => {
 *     track('scan_initiated', {
 *       wcag_level: 'AA',
 *       scan_type: 'single',
 *       url_count: 1,
 *       timestamp: new Date().toISOString(),
 *       sessionId: generateSessionId()
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleScanInitiated}>
 *       Start Scan {isEnabled && '📊'}
 *     </button>
 *   );
 * }
 *
 * // Track page views
 * function ResultsPage() {
 *   const { trackPageView } = useAnalytics();
 *
 *   useEffect(() => {
 *     trackPageView('/scan/results', 'Scan Results');
 *   }, [trackPageView]);
 *
 *   return <div>Results...</div>;
 * }
 *
 * // Track scan completion with type safety
 * function ScanMonitor({ scanId }: { scanId: string }) {
 *   const { track } = useAnalytics();
 *
 *   const handleScanCompleted = (data: ScanResult) => {
 *     track('scan_completed', {
 *       scan_duration_ms: data.duration,
 *       issue_count: {
 *         critical: data.issues.critical.length,
 *         serious: data.issues.serious.length,
 *         moderate: data.issues.moderate.length,
 *         minor: data.issues.minor.length
 *       },
 *       wcag_level: data.wcagLevel,
 *       timestamp: new Date().toISOString(),
 *       sessionId: generateSessionId()
 *     });
 *   };
 *
 *   return <div>Monitoring scan {scanId}...</div>;
 * }
 * ```
 */
export function useAnalytics(): UseAnalyticsReturn {
  // Access the analytics context
  const context = useAnalyticsContext();

  /**
   * Type-safe track method
   * Merges event name with event data to create complete event object
   */
  const track = useCallback(
    <T extends AnalyticsEventName>(
      eventName: T,
      eventData: Omit<ExtractEventByName<T>, 'event'>
    ) => {
      // Combine event name with data
      const event = {
        event: eventName,
        ...eventData,
      } as ExtractEventByName<T>;

      // Delegate to context track method
      context.track(event);
    },
    [context]
  );

  return {
    track,
    trackPageView: context.trackPageView,
    isEnabled: context.isEnabled,
  };
}
