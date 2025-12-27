import type { Page } from 'playwright';
import type { WcagLevel } from '@adashield/core/types';
import { isPrivateIP, isBlockedHostname } from '@adashield/core';
import { getDefaultPool } from '../../utils/browser-pool.js';
import { runAxeAnalysis } from './axe-runner.js';
import { mapAxeViolations, type MappedIssue } from './result-mapper.js';

/**
 * Page Scanner with axe-core Integration
 *
 * Core scanning logic for ADAShield accessibility testing.
 * Orchestrates:
 * - Browser page acquisition from pool
 * - Page navigation with security checks
 * - Redirect validation (blocks private IPs)
 * - axe-core accessibility analysis
 * - Result mapping and sanitization
 * - Timeout handling and error recovery
 */

/**
 * Scan configuration options
 */
export interface ScanOptions {
  /** Target URL to scan */
  url: string;

  /** WCAG conformance level to test against */
  wcagLevel: WcagLevel;

  /** Navigation timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Wait until condition for page load (default: 'networkidle') */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

/**
 * Scan result with issues and metadata
 */
export interface ScanResult {
  /** Original URL requested */
  url: string;

  /** Final URL after redirects */
  finalUrl: string;

  /** Page title */
  title: string;

  /** Scan duration in milliseconds */
  scanDuration: number;

  /** Accessibility issues found */
  issues: MappedIssue[];

  /** Number of axe-core rules that passed */
  passes: number;

  /** Number of axe-core rules that were inapplicable */
  inapplicable: number;

  /** Timestamp when scan completed */
  timestamp: Date;
}

/**
 * Custom error types for specific scan failures
 */
export class ScanError extends Error {
  constructor(
    message: string,
    public code:
      | 'TIMEOUT'
      | 'BLOCKED_REDIRECT'
      | 'ANALYSIS_FAILED'
      | 'NAVIGATION_FAILED'
      | 'VALIDATION_FAILED'
  ) {
    super(message);
    this.name = 'ScanError';
  }
}

/**
 * Default scan options
 */
const DEFAULT_SCAN_OPTIONS = {
  timeout: 60000,
  waitUntil: 'networkidle' as const,
};

/**
 * Validate redirect security after page navigation
 *
 * Prevents SSRF attacks by blocking redirects to:
 * - Private IP ranges (10.x.x.x, 192.168.x.x, 127.x.x.x, etc.)
 * - Cloud metadata endpoints (169.254.169.254)
 * - Localhost and .local domains
 * - Internal TLDs (.internal, .test, etc.)
 *
 * @param page - Playwright page after navigation
 * @param originalUrl - Original URL that was requested
 * @throws {ScanError} If redirect to blocked destination detected
 */
async function validateRedirects(
  page: Page,
  originalUrl: string
): Promise<void> {
  const finalUrl = page.url();

  // No redirect if URLs match
  if (finalUrl === originalUrl) {
    return;
  }

  // Parse final URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(finalUrl);
  } catch {
    throw new ScanError(
      `Invalid redirect URL: ${finalUrl}`,
      'VALIDATION_FAILED'
    );
  }

  const hostname = parsedUrl.hostname;

  // Check for blocked hostname patterns
  if (isBlockedHostname(hostname)) {
    throw new ScanError(
      `Redirect to blocked hostname: ${hostname}`,
      'BLOCKED_REDIRECT'
    );
  }

  // Check if hostname is an IP address
  const isIpAddress = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  if (isIpAddress && isPrivateIP(hostname)) {
    throw new ScanError(
      `Redirect to private IP address: ${hostname}`,
      'BLOCKED_REDIRECT'
    );
  }

  // Additional check: Try to detect IPv6 addresses in brackets
  if (/^\[.*\]$/.test(hostname)) {
    const ipv6 = hostname.slice(1, -1);
    if (isPrivateIP(ipv6)) {
      throw new ScanError(
        `Redirect to private IPv6 address: ${ipv6}`,
        'BLOCKED_REDIRECT'
      );
    }
  }
}

/**
 * Scan a web page for accessibility issues using axe-core
 *
 * Main entry point for page scanning. Handles complete scan workflow:
 * 1. Acquire browser page from pool
 * 2. Navigate to URL with timeout
 * 3. Validate redirects (security)
 * 4. Run axe-core analysis
 * 5. Map results to our Issue format
 * 6. Clean up and release browser
 *
 * Error handling:
 * - Navigation timeout → ScanError with code 'TIMEOUT'
 * - Blocked redirect → ScanError with code 'BLOCKED_REDIRECT'
 * - Analysis failure → ScanError with code 'ANALYSIS_FAILED'
 * - Browser errors → Propagated as-is
 *
 * @param options - Scan configuration
 * @returns Promise resolving to scan results
 * @throws {ScanError} For scan-specific failures
 * @throws {Error} For browser pool or unexpected errors
 *
 * @example
 * ```typescript
 * const result = await scanPage({
 *   url: 'https://example.com',
 *   wcagLevel: 'AA',
 *   timeout: 30000,
 * });
 *
 * console.log(`Scanned: ${result.finalUrl}`);
 * console.log(`Found ${result.issues.length} issues`);
 * console.log(`Scan took ${result.scanDuration}ms`);
 * ```
 */
export async function scanPage(
  options: ScanOptions
): Promise<ScanResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_SCAN_OPTIONS, ...options };

  // Acquire browser page from pool
  const browserPool = getDefaultPool();
  const { page, release } = await browserPool.acquire();

  try {
    // Step 1: Navigate to URL with timeout
    try {
      await page.goto(config.url, {
        timeout: config.timeout,
        waitUntil: config.waitUntil,
      });
    } catch (error) {
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new ScanError(
          `Navigation timeout after ${config.timeout}ms: ${config.url}`,
          'TIMEOUT'
        );
      }
      // Other navigation errors
      throw new ScanError(
        `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NAVIGATION_FAILED'
      );
    }

    // Step 2: Validate redirects for security
    await validateRedirects(page, config.url);

    // Step 3: Run axe-core accessibility analysis
    let axeResults;
    try {
      axeResults = await runAxeAnalysis(page, config.wcagLevel);
    } catch (error) {
      throw new ScanError(
        `axe-core analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ANALYSIS_FAILED'
      );
    }

    // Step 4: Map axe-core results to our Issue format
    const issues = mapAxeViolations(axeResults.violations);

    // Step 5: Extract page metadata
    const finalUrl = page.url();
    const title = await page.title();

    // Step 6: Return formatted result
    return {
      url: config.url,
      finalUrl,
      title,
      scanDuration: Date.now() - startTime,
      issues,
      passes: axeResults.passes.length,
      inapplicable: axeResults.inapplicable.length,
      timestamp: new Date(),
    };
  } finally {
    // Always release browser page back to pool
    await release();
  }
}

/**
 * Scan multiple pages concurrently
 *
 * Leverages browser pool for parallel scanning.
 * Each scan runs independently with its own timeout.
 *
 * @param scans - Array of scan configurations
 * @returns Promise resolving to array of scan results (same order as input)
 *
 * @example
 * ```typescript
 * const results = await scanPages([
 *   { url: 'https://example.com', wcagLevel: 'AA' },
 *   { url: 'https://example.com/about', wcagLevel: 'AA' },
 *   { url: 'https://example.com/contact', wcagLevel: 'AA' },
 * ]);
 * ```
 */
export async function scanPages(
  scans: ScanOptions[]
): Promise<ScanResult[]> {
  return Promise.all(scans.map((scan) => scanPage(scan)));
}
