'use client';

/**
 * Google Tag Manager Script Loader
 * Loads GTM container with consent gating and dataLayer initialization
 */

import Script from 'next/script';
import { initializeDataLayer } from '@/lib/analytics';
import { useEffect, useState } from 'react';

interface GTMScriptProps {
  gtmId: string;
  enabled: boolean;
}

/**
 * GTMScript component loads the Google Tag Manager container script
 * with proper consent gating and dataLayer initialization.
 *
 * @param gtmId - Google Tag Manager container ID (e.g., 'GTM-XXXXXX')
 * @param enabled - Whether GTM should be loaded (based on user consent)
 * @returns Script element or null if disabled/not configured
 *
 * Requirements:
 * - 1.1: Loads GTM container script in document head
 * - 1.2: Initializes dataLayer before GTM executes
 * - 1.3: Skips initialization without errors if gtmId not configured
 * - 1.4: Uses afterInteractive strategy to not block main thread
 * - 1.5: Respects user consent through enabled prop
 */
export function GTMScript({ gtmId, enabled }: GTMScriptProps): JSX.Element | null {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Only proceed if enabled and gtmId is provided
    if (!enabled || !gtmId) {
      return;
    }

    // Initialize dataLayer before GTM script loads (Req 1.2)
    initializeDataLayer();
    setShouldLoad(true);
  }, [enabled, gtmId]);

  // Return null if gtmId is empty or not enabled (Req 1.3, 1.5)
  if (!shouldLoad || !gtmId) {
    return null;
  }

  return (
    <>
      {/* GTM Script (Req 1.1, 1.4) */}
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `,
        }}
      />

      {/* GTM noscript fallback */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
