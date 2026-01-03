'use client';

import { useState, useEffect } from 'react';
import { getConsent, setConsent, clearAnalyticsCookies, migrateOldConsent } from '@/lib/consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);

  useEffect(() => {
    // Migrate old consent format if exists
    migrateOldConsent();

    // Check if consent exists in localStorage
    const hasConsent = typeof window !== 'undefined' && localStorage.getItem('adashield:consent') !== null;

    // Show banner only if no previous consent exists
    if (!hasConsent) {
      setVisible(true);
      // For first-time visitors, keep checkbox pre-checked (optimistic default)
      // This is standard UX - user can uncheck if they prefer
      setAnalyticsConsent(true);
    } else {
      // Initialize analytics consent state from stored consent
      const consent = getConsent();
      setAnalyticsConsent(consent.analytics);
    }
  }, []);

  const handleAcceptAll = () => {
    const consentStatus = {
      essential: true,
      analytics: true,
      marketing: false,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
    setConsent(consentStatus);
    setVisible(false);
  };

  const handleDeclineAll = () => {
    const consentStatus = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
    setConsent(consentStatus);
    clearAnalyticsCookies();
    setVisible(false);
  };

  const handleSavePreferences = () => {
    const consentStatus = {
      essential: true,
      analytics: analyticsConsent,
      marketing: false,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
    setConsent(consentStatus);

    // Clear analytics cookies if user declined analytics
    if (!analyticsConsent) {
      clearAnalyticsCookies();
    }

    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col gap-4">
          <div>
            <h2 id="cookie-consent-title" className="text-base font-semibold mb-2">
              Cookie Preferences
            </h2>
            <p id="cookie-consent-description" className="text-sm text-muted-foreground">
              We use essential cookies to manage your session and provide our service.
              We also use analytics cookies to understand how you use ADAShield and improve your experience.
              Read our{' '}
              <a
                href="/privacy"
                className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                Privacy Policy
              </a>
              {' '}for more details.
            </p>
          </div>

          {showDetails && (
            <div className="space-y-3 border-t pt-3">
              {/* Essential Cookies - Always enabled */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">
                    Essential Cookies
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Required for authentication, security, and core functionality. Always enabled.
                  </p>
                </div>
                <div className="flex items-center ml-4">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    aria-label="Essential cookies (always enabled)"
                    className="h-4 w-4 rounded border-gray-300 bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Analytics Cookies - User controllable */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <label
                    htmlFor="analytics-consent"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Analytics Cookies
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Help us understand usage patterns, page views, and user interactions to improve our service. Powered by Google Analytics.
                  </p>
                </div>
                <div className="flex items-center ml-4">
                  <input
                    type="checkbox"
                    id="analytics-consent"
                    checked={analyticsConsent}
                    onChange={(e) => setAnalyticsConsent(e.target.checked)}
                    aria-label="Analytics cookies"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              aria-expanded={showDetails}
              aria-controls="cookie-details"
            >
              {showDetails ? 'Hide Details' : 'Customize'}
            </button>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleDeclineAll}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label="Decline analytics cookies (essential cookies will remain enabled)"
              >
                Decline All
              </button>
              {showDetails && (
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Save Preferences
                </button>
              )}
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Accept all cookies including analytics"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
