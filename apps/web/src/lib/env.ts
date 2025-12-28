/**
 * Environment configuration validation and typing
 */

export const env = {
  apiUrl: process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3080',
  recaptchaSiteKey: process.env['NEXT_PUBLIC_RECAPTCHA_SITE_KEY'] || '',
} as const;

// Validation
if (typeof window !== 'undefined') {
  if (!env.apiUrl) {
    console.warn('NEXT_PUBLIC_API_URL is not set, using default: http://localhost:3001');
  }

  if (!env.recaptchaSiteKey) {
    console.warn('NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set, reCAPTCHA will be disabled');
  }
}

export type Env = typeof env;
