/**
 * Google reCAPTCHA v3 integration
 * Provides invisible bot protection for scan submissions
 */

import { env } from './env';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = env.recaptchaSiteKey;

let scriptLoaded = false;
let scriptLoadPromise: Promise<void> | null = null;

/**
 * Load the reCAPTCHA v3 script
 * Uses singleton pattern to ensure script is only loaded once
 */
export function loadRecaptchaScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = (error) => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load reCAPTCHA script'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Execute reCAPTCHA challenge and get token
 * @param action - Action name for analytics (e.g., 'scan', 'report')
 * @returns reCAPTCHA token for backend verification
 */
export async function executeRecaptcha(action: string): Promise<string> {
  // Skip reCAPTCHA in local development environment
  if (env.appEnv === 'local') {
    console.info('reCAPTCHA skipped in local environment (APP_ENV=local)');
    return 'local-dev-bypass-token';
  }

  if (!SITE_KEY) {
    console.warn(
      'reCAPTCHA site key not configured, returning empty token. ' +
        'Set NEXT_PUBLIC_RECAPTCHA_SITE_KEY in environment.'
    );
    return '';
  }

  try {
    await loadRecaptchaScript();

    return new Promise((resolve, reject) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(SITE_KEY, { action });
          resolve(token);
        } catch (error) {
          reject(new Error('Failed to execute reCAPTCHA challenge'));
        }
      });
    });
  } catch (error) {
    console.error('reCAPTCHA error:', error);
    throw error;
  }
}
