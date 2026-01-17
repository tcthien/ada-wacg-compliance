import { chromium, type Browser } from 'playwright';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PendingScan } from './types.js';
import type { Logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Downloaded website data for a single scan
 */
export interface DownloadedSite {
  /** Original scan ID */
  scanId: string;

  /** Original URL */
  url: string;

  /** WCAG level from the scan */
  wcagLevel: string;

  /** Page title extracted from the page */
  pageTitle: string;

  /** Full HTML content of the page */
  htmlContent: string;

  /** Path to the saved screenshot (if captured) */
  screenshotPath?: string;

  /** Accessibility tree snapshot (simplified) */
  accessibilitySnapshot?: string;

  /** Whether the download was successful */
  success: boolean;

  /** Error message if download failed */
  error?: string;

  /** Time taken to download in milliseconds */
  durationMs: number;
}

/**
 * Options for the website downloader
 */
export interface DownloaderOptions {
  /** Directory to save downloaded content (default: ./tmp-web-src) */
  outputDir?: string;

  /** Whether to capture screenshots (default: true) */
  captureScreenshot?: boolean;

  /** Whether to capture accessibility snapshot (default: true) */
  captureAccessibility?: boolean;

  /** Timeout for page load in milliseconds (default: 60000) */
  timeout?: number;

  /** Number of retries for failed page loads (default: 3) */
  retries?: number;

  /** Whether to run browser in headless mode (default: true) */
  headless?: boolean;

  /** Logger instance for progress logging */
  logger?: Logger;
}

/**
 * Result of downloading multiple websites
 */
export interface DownloadResult {
  /** Successfully downloaded sites */
  successful: DownloadedSite[];

  /** Failed downloads */
  failed: DownloadedSite[];

  /** Total time taken in milliseconds */
  totalDurationMs: number;
}

/**
 * Downloads website content using Playwright for later analysis
 */
export class WebsiteDownloader {
  private options: Required<Omit<DownloaderOptions, 'logger'>> & { logger?: Logger };
  private browser: Browser | null = null;

  constructor(options: DownloaderOptions = {}) {
    this.options = {
      outputDir: options.outputDir ?? join(__dirname, '..', 'tmp-web-src'),
      captureScreenshot: options.captureScreenshot ?? true,
      captureAccessibility: options.captureAccessibility ?? true,
      timeout: options.timeout ?? 60000,
      retries: options.retries ?? 3,
      headless: options.headless ?? true,
      logger: options.logger,
    };
  }

  /**
   * Initialize the browser instance
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.options.logger?.info('Launching browser...');
      this.browser = await chromium.launch({
        headless: this.options.headless,
      });
      this.options.logger?.success('Browser launched');
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.options.logger?.info('Browser closed');
    }
  }

  /**
   * Ensure the output directory exists
   */
  private async ensureOutputDir(scanId: string): Promise<string> {
    const scanDir = join(this.options.outputDir, scanId);
    await mkdir(scanDir, { recursive: true });
    return scanDir;
  }

  /**
   * Download a single website with retry logic
   */
  async downloadSite(scan: PendingScan): Promise<DownloadedSite> {
    const startTime = Date.now();
    let lastError: string = '';

    if (!this.browser) {
      await this.initialize();
    }

    // Retry loop
    for (let attempt = 1; attempt <= this.options.retries; attempt++) {
      const page = await this.browser!.newPage();

      try {
        if (attempt === 1) {
          this.options.logger?.info(`Downloading: ${scan.url}`);
        } else {
          this.options.logger?.info(`Retrying (${attempt}/${this.options.retries}): ${scan.url}`);
        }

        // Navigate to the URL
        await page.goto(scan.url, {
          waitUntil: 'networkidle',
          timeout: this.options.timeout,
        });

        // Wait a bit for any dynamic content
        await page.waitForTimeout(1000);

        // Get page title
        const pageTitle = await page.title();

        // Get HTML content
        const htmlContent = await page.content();

        // Ensure output directory exists
        const scanDir = await this.ensureOutputDir(scan.scanId);

        // Save HTML
        const htmlPath = join(scanDir, 'index.html');
        await writeFile(htmlPath, htmlContent, 'utf-8');

        // Capture screenshot if enabled
        let screenshotPath: string | undefined;
        if (this.options.captureScreenshot) {
          screenshotPath = join(scanDir, 'screenshot.png');
          await page.screenshot({
            path: screenshotPath,
            fullPage: true,
          });
        }

        // Capture accessibility snapshot if enabled
        let accessibilitySnapshot: string | undefined;
        if (this.options.captureAccessibility) {
          try {
            // Use aria-snapshot method (newer API) if available
            // Falls back gracefully if not supported
            const ariaSnapshot = await page.locator(':root').ariaSnapshot();
            if (ariaSnapshot) {
              accessibilitySnapshot = ariaSnapshot;
              await writeFile(
                join(scanDir, 'accessibility.txt'),
                accessibilitySnapshot,
                'utf-8'
              );
            }
          } catch (error) {
            // Accessibility snapshot may fail on some pages, continue anyway
            this.options.logger?.warning(`Could not capture accessibility snapshot for ${scan.url}`);
          }
        }

        const durationMs = Date.now() - startTime;
        this.options.logger?.success(`Downloaded ${scan.url} in ${durationMs}ms`);

        await page.close();
        return {
          scanId: scan.scanId,
          url: scan.url,
          wcagLevel: scan.wcagLevel,
          pageTitle,
          htmlContent,
          screenshotPath,
          accessibilitySnapshot,
          success: true,
          durationMs,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await page.close();

        if (attempt < this.options.retries) {
          // Wait before retry with exponential backoff: 5s, 10s, 20s
          const delay = 5000 * Math.pow(2, attempt - 1);
          this.options.logger?.warning(
            `Failed to download ${scan.url}: ${lastError}. Waiting ${delay / 1000}s before retry...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    const durationMs = Date.now() - startTime;
    this.options.logger?.error(`Failed to download ${scan.url} after ${this.options.retries} attempts: ${lastError}`);

    return {
      scanId: scan.scanId,
      url: scan.url,
      wcagLevel: scan.wcagLevel,
      pageTitle: '',
      htmlContent: '',
      success: false,
      error: lastError,
      durationMs,
    };
  }

  /**
   * Download multiple websites
   */
  async downloadSites(scans: PendingScan[]): Promise<DownloadResult> {
    const startTime = Date.now();
    const successful: DownloadedSite[] = [];
    const failed: DownloadedSite[] = [];

    await this.initialize();

    for (const scan of scans) {
      const result = await this.downloadSite(scan);
      if (result.success) {
        successful.push(result);
      } else {
        failed.push(result);
      }
    }

    return {
      successful,
      failed,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Clean up downloaded files for a scan
   */
  async cleanupScan(scanId: string): Promise<void> {
    const scanDir = join(this.options.outputDir, scanId);
    try {
      await rm(scanDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Clean up all downloaded files
   */
  async cleanupAll(): Promise<void> {
    try {
      await rm(this.options.outputDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get the output directory path
   */
  getOutputDir(): string {
    return this.options.outputDir;
  }
}

/**
 * Truncate HTML content to a maximum length for prompt inclusion
 * Tries to preserve important elements like head and main content
 */
export function truncateHtml(html: string, maxLength: number = 50000): string {
  if (html.length <= maxLength) {
    return html;
  }

  // Try to find and preserve important sections
  const headMatch = html.match(/<head[^>]*>[\s\S]*?<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);

  if (!bodyMatch) {
    // No body tag, just truncate
    return html.substring(0, maxLength) + '\n<!-- TRUNCATED -->';
  }

  const head = headMatch ? headMatch[0] : '';
  const body = bodyMatch[1];

  // Calculate available space for body
  const overhead = 200; // For wrapper tags and truncation notice
  const availableForBody = maxLength - head.length - overhead;

  if (availableForBody <= 0) {
    // Head is too large, truncate everything
    return html.substring(0, maxLength) + '\n<!-- TRUNCATED -->';
  }

  // Truncate body content
  const truncatedBody = body.substring(0, availableForBody);

  return `<!DOCTYPE html>
<html>
${head}
<body>
${truncatedBody}
<!-- CONTENT TRUNCATED - Original size: ${html.length} chars -->
</body>
</html>`;
}

/**
 * Extract text content from HTML for analysis
 * Removes scripts, styles, and extracts readable text
 */
export function extractTextContent(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Replace common block elements with newlines
  text = text
    .replace(/<\/?(div|p|br|hr|h[1-6]|li|tr|td|th|section|article|header|footer|nav|main|aside)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ') // Remove remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();

  return text;
}
