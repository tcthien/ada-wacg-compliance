/**
 * Analytics Context Provider
 *
 * Provides analytics tracking functionality throughout the application
 * via React Context. This enables consistent event tracking and consent
 * management across all components.
 *
 * Task 11: Context definition and hook creation
 */

'use client';

import { createContext, useContext } from 'react';
import type { AnalyticsEvent, ConsentStatus, DataLayerEvent } from '@/lib/analytics.types';

// ============================================================================
// CONTEXT INTERFACE
// ============================================================================

/**
 * Analytics context value interface
 * Defines the shape of the analytics context consumed by components
 */
export interface AnalyticsContextValue {
  /**
   * Whether analytics is currently enabled
   * Controlled by user consent and environment configuration
   */
  isEnabled: boolean;

  /**
   * Current user consent status
   * Tracks consent for different cookie categories
   */
  consent: ConsentStatus;

  /**
   * Track a custom analytics event
   * Sends event to Google Analytics via GTM dataLayer
   *
   * @param event - The analytics event to track
   */
  track: (event: AnalyticsEvent) => void;

  /**
   * Track a page view event
   * Sends page_view event to Google Analytics
   *
   * @param path - The page path (e.g., '/scan/results')
   * @param title - Optional page title for better reporting
   */
  trackPageView: (path: string, title?: string) => void;

  /**
   * Update user consent preferences
   * Updates consent status and applies changes to GTM/GA4
   *
   * @param status - The new consent status
   */
  setConsent: (status: ConsentStatus) => void;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

/**
 * Analytics context
 * Created with undefined default to enforce usage within provider
 */
export const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(
  undefined
);

// ============================================================================
// CUSTOM HOOK
// ============================================================================

/**
 * Hook to consume analytics context
 * Throws an error if used outside of AnalyticsProvider
 *
 * @returns The analytics context value
 * @throws Error if used outside AnalyticsProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { track, isEnabled } = useAnalyticsContext();
 *
 *   const handleScanInitiated = () => {
 *     if (isEnabled) {
 *       track({
 *         event: 'scan_initiated',
 *         wcag_level: 'AA',
 *         scan_type: 'single',
 *         url_count: 1,
 *         timestamp: new Date().toISOString(),
 *         sessionId: 'session-123'
 *       });
 *     }
 *   };
 *
 *   return <button onClick={handleScanInitiated}>Start Scan</button>;
 * }
 * ```
 */
export function useAnalyticsContext(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);

  if (context === undefined) {
    throw new Error(
      'useAnalyticsContext must be used within an AnalyticsProvider. ' +
        'Ensure your component is wrapped with <AnalyticsProvider>.'
    );
  }

  return context;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

import { useState, useCallback, useEffect, ReactNode } from 'react';
import { GTMScript } from './GTMScript';
import { PageViewTracker } from './PageViewTracker';
import { pushToDataLayer, initializeDataLayer } from '@/lib/analytics';
import { getConsent, setConsent as saveConsent } from '@/lib/consent';
import { initWebVitals } from '@/lib/web-vitals';
import { env } from '@/lib/env';

/**
 * Provider component props
 */
export interface AnalyticsProviderProps {
  /**
   * Child components that will have access to analytics context
   */
  children: ReactNode;
}

/**
 * Analytics Provider Component
 *
 * Manages analytics consent state and provides analytics tracking functionality
 * throughout the application via React Context. This component:
 * - Initializes consent state from localStorage
 * - Conditionally loads GTM/GA4 scripts based on consent
 * - Provides track(), trackPageView(), and setConsent() methods
 * - Ensures all analytics calls respect user consent preferences
 *
 * Task 12: Provider component implementation
 *
 * @example
 * ```tsx
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <AnalyticsProvider>
 *       <YourApp />
 *     </AnalyticsProvider>
 *   );
 * }
 * ```
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  // Initialize consent state from localStorage
  const [consent, setConsentState] = useState<ConsentStatus>(() => getConsent());

  /**
   * Track a custom analytics event
   * Only pushes events to dataLayer if user has consented to analytics
   *
   * @param event - The analytics event to track
   */
  const track = useCallback(
    (event: AnalyticsEvent) => {
      // Check consent before tracking
      if (!consent.analytics) {
        console.debug('[Analytics] Event blocked - no consent:', event.event);
        return;
      }

      // Push event to GTM dataLayer (cast to DataLayerEvent as AnalyticsEvent is more strict)
      pushToDataLayer(event as unknown as DataLayerEvent);
      console.debug('[Analytics] Event tracked:', event.event);
    },
    [consent.analytics]
  );

  /**
   * Track a page view event
   * Sends page_view event to Google Analytics
   *
   * @param path - The page path (e.g., '/scan/results')
   * @param title - Optional page title for better reporting
   */
  const trackPageView = useCallback(
    (path: string, title?: string) => {
      // Check consent before tracking
      if (!consent.analytics) {
        console.debug('[Analytics] Page view blocked - no consent:', path);
        return;
      }

      // Push page view event to dataLayer
      pushToDataLayer({
        event: 'page_view',
        page_path: path,
        page_title: title || document.title,
        timestamp: new Date().toISOString(),
        sessionId: '', // Session ID will be added by GTM if needed
      });
      console.debug('[Analytics] Page view tracked:', path);
    },
    [consent.analytics]
  );

  /**
   * Update user consent preferences
   * Updates both React state and localStorage, then reinitializes GTM
   *
   * @param status - The new consent status
   */
  const handleSetConsent = useCallback((status: ConsentStatus) => {
    // Update state
    setConsentState(status);

    // Persist to localStorage
    saveConsent(status);

    // Reinitialize GTM dataLayer with new consent
    if (env.analyticsEnabled) {
      initializeDataLayer();
    }

    console.debug('[Analytics] Consent updated:', status);
  }, []);

  // Determine if analytics is enabled
  // Requires both: environment flag AND user consent
  const isEnabled = env.analyticsEnabled && consent.analytics;

  /**
   * Initialize Core Web Vitals tracking
   * Only runs when analytics is enabled and consent is granted
   * Task 27: Integrate Web Vitals in layout
   */
  useEffect(() => {
    if (isEnabled) {
      initWebVitals();
      console.debug('[Analytics] Core Web Vitals tracking initialized');
    }
  }, [isEnabled]);

  // Create context value
  const value: AnalyticsContextValue = {
    isEnabled,
    consent,
    track,
    trackPageView,
    setConsent: handleSetConsent,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {/* Conditionally load GTM script based on consent and environment */}
      {isEnabled && env.gtmId && <GTMScript gtmId={env.gtmId} enabled={isEnabled} />}
      {/* Automatic page view tracking for all route changes */}
      {isEnabled && <PageViewTracker />}
      {children}
    </AnalyticsContext.Provider>
  );
}
