/**
 * Environment configuration validation and typing
 */

export const env = {
  apiUrl: process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3080',
  recaptchaSiteKey: process.env['NEXT_PUBLIC_RECAPTCHA_SITE_KEY'] || '',
  gtmId: process.env['NEXT_PUBLIC_GTM_ID'] || '',
  gaMeasurementId: process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'] || '',
  analyticsEnabled: process.env['NEXT_PUBLIC_ANALYTICS_ENABLED'] !== 'false',
  analyticsDebug: process.env['NODE_ENV'] === 'development',
  // Application environment: 'local' skips reCAPTCHA, 'prod' requires it
  appEnv: process.env['NEXT_PUBLIC_APP_ENV'] || 'local',
} as const;

// Validation
if (typeof window !== 'undefined') {
  if (!env.apiUrl) {
    console.warn('NEXT_PUBLIC_API_URL is not set, using default: http://localhost:3080');
  }

  if (!env.recaptchaSiteKey) {
    console.warn('NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set, reCAPTCHA will be disabled');
  }

  if (!env.gtmId && env.analyticsEnabled) {
    console.warn('NEXT_PUBLIC_GTM_ID is not set, Google Tag Manager will be disabled');
  }

  if (!env.gaMeasurementId && env.analyticsEnabled) {
    console.warn('NEXT_PUBLIC_GA_MEASUREMENT_ID is not set, Google Analytics will be disabled');
  }

  if (!env.analyticsEnabled) {
    console.info('Analytics is disabled via NEXT_PUBLIC_ANALYTICS_ENABLED');
  }

  if (env.analyticsDebug) {
    console.info('Analytics debug mode enabled - events will be logged to console');
  }
}

export type Env = typeof env;
