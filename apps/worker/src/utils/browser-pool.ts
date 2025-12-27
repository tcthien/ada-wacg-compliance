import { chromium, type Browser, type Page } from 'playwright';
import { env } from '../config/env.js';

/**
 * Browser instance metadata tracked by the pool
 */
interface BrowserInstance {
  browser: Browser;
  pageCount: number; // Total pages created from this browser
  activePages: number; // Currently active (not yet released) pages
  createdAt: Date;
}

/**
 * Configuration options for the browser pool
 */
export interface BrowserPoolOptions {
  /** Maximum number of browser instances in pool (default: 10) */
  maxInstances?: number;
  /** Maximum pages per browser before recycling (default: 5) */
  maxPagesPerBrowser?: number;
  /** Page timeout in milliseconds (default: 60000) */
  pageTimeout?: number;
  /** Custom browser launch arguments */
  browserArgs?: string[];
}

/**
 * Pool statistics for monitoring
 */
export interface PoolStats {
  total: number;
  available: number;
  inUse: number;
}

/**
 * Security-hardened browser arguments for headless Chromium
 * Optimized for containerized environments and security
 */
const DEFAULT_BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-sync',
  '--disable-translate',
  '--hide-scrollbars',
  '--mute-audio',
];

/**
 * Browser Pool Manager
 *
 * Manages a pool of Playwright browser instances for concurrent accessibility scans.
 * Features:
 * - Automatic browser recycling after N pages
 * - Configurable pool size and timeouts
 * - Security-hardened browser configuration
 * - Graceful shutdown and error handling
 *
 * @example
 * ```typescript
 * const pool = new BrowserPool({ maxInstances: 10 });
 * const { page, release } = await pool.acquire();
 * try {
 *   await page.goto('https://example.com');
 *   // ... perform accessibility scan
 * } finally {
 *   await release();
 * }
 * ```
 */
export class BrowserPool {
  private instances: BrowserInstance[] = [];
  private readonly maxInstances: number;
  private readonly maxPagesPerBrowser: number;
  private readonly pageTimeout: number;
  private readonly browserArgs: string[];
  private readonly acquireQueue: Array<{
    resolve: (value: { page: Page; release: () => Promise<void> }) => void;
    reject: (reason: Error) => void;
  }> = [];
  private shuttingDown = false;

  constructor(options: BrowserPoolOptions = {}) {
    this.maxInstances = options.maxInstances ?? 10;
    this.maxPagesPerBrowser = options.maxPagesPerBrowser ?? 5;
    this.pageTimeout = options.pageTimeout ?? 60000;
    this.browserArgs = options.browserArgs ?? DEFAULT_BROWSER_ARGS;
  }

  /**
   * Acquire a browser page for scanning
   *
   * Returns a page and release function. The release function MUST be called
   * when done to return the browser to the pool.
   *
   * Strategy:
   * 1. Try to find an idle browser (no active pages) that hasn't hit page limit
   * 2. Try to reuse a browser that can still accept pages (allows concurrent pages)
   * 3. If pool not full, create a new browser
   * 4. If all browsers at limit, wait for one to become available
   *
   * @throws {Error} If pool is shutting down
   * @throws {Error} If timeout waiting for available browser
   * @returns Promise resolving to { page, release }
   */
  async acquire(): Promise<{ page: Page; release: () => Promise<void> }> {
    if (this.shuttingDown) {
      throw new Error('Browser pool is shutting down');
    }

    // Step 1: Try to find an idle browser
    const idleBrowser = this.findIdleBrowser();
    if (idleBrowser) {
      return this.createPageFromInstance(idleBrowser);
    }

    // Step 2: Try to reuse a browser that can still accept pages
    const reusableBrowser = this.findReusableBrowser();
    if (reusableBrowser) {
      return this.createPageFromInstance(reusableBrowser);
    }

    // Step 3: Create new browser if pool not full
    if (this.instances.length < this.maxInstances) {
      const newInstance = await this.createBrowser();
      return this.createPageFromInstance(newInstance);
    }

    // Step 4: Pool is full and all browsers at limit, wait
    return this.waitForAvailableBrowser();
  }

  /**
   * Shutdown all browsers in the pool
   *
   * Waits for in-use browsers to be released and closes all instances.
   */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;

    // Reject all queued acquire requests
    while (this.acquireQueue.length > 0) {
      const queued = this.acquireQueue.shift();
      if (queued) {
        queued.reject(new Error('Browser pool shutting down'));
      }
    }

    // Wait for all browsers to become available
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.instances.some((i) => i.activePages > 0)) {
      if (Date.now() - startTime > maxWaitTime) {
        console.warn('Timeout waiting for browsers to be released during shutdown');
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Close all browsers
    await Promise.all(
      this.instances.map(async (instance) => {
        try {
          await instance.browser.close();
        } catch (error) {
          console.error('Error closing browser during shutdown:', error);
        }
      })
    );

    this.instances = [];
  }

  /**
   * Get current pool statistics
   *
   * @returns Pool statistics including total, available, and in-use browsers
   */
  getStats(): PoolStats {
    const total = this.instances.length;
    const inUse = this.instances.filter((i) => i.activePages > 0).length;
    const available = total - inUse;

    return { total, available, inUse };
  }

  /**
   * Find an idle browser (no active pages) that can accept more pages
   */
  private findIdleBrowser(): BrowserInstance | null {
    return (
      this.instances.find(
        (instance) =>
          instance.activePages === 0 &&
          instance.pageCount < this.maxPagesPerBrowser &&
          instance.browser.isConnected()
      ) ?? null
    );
  }

  /**
   * Find a browser that can still accept more pages (even if currently in use)
   * This allows multiple concurrent pages from the same browser
   */
  private findReusableBrowser(): BrowserInstance | null {
    return (
      this.instances.find(
        (instance) =>
          instance.pageCount < this.maxPagesPerBrowser &&
          instance.browser.isConnected()
      ) ?? null
    );
  }

  /**
   * Create a new browser instance
   */
  private async createBrowser(): Promise<BrowserInstance> {
    const browser = await chromium.launch({
      headless: env.PLAYWRIGHT_HEADLESS,
      args: this.browserArgs,
    });

    const instance: BrowserInstance = {
      browser,
      pageCount: 0,
      activePages: 0,
      createdAt: new Date(),
    };

    this.instances.push(instance);

    // Handle unexpected browser disconnection
    browser.on('disconnected', () => {
      const index = this.instances.indexOf(instance);
      if (index > -1) {
        this.instances.splice(index, 1);
      }
    });

    return instance;
  }

  /**
   * Create a page from an instance and return release function
   */
  private async createPageFromInstance(
    instance: BrowserInstance
  ): Promise<{ page: Page; release: () => Promise<void> }> {
    // Increment counters immediately when creating page
    // This prevents the browser from being reused beyond its limit
    instance.pageCount++;
    instance.activePages++;

    const page = await instance.browser.newPage();
    page.setDefaultTimeout(this.pageTimeout);

    const release = async () => {
      try {
        // Close the page
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (error) {
        console.error('Error closing page:', error);
      }

      // Decrement active pages
      instance.activePages--;

      // Recycle browser if it's reached page limit
      if (instance.pageCount >= this.maxPagesPerBrowser) {
        await this.recycleBrowser(instance);
      }

      // Process queued acquire requests
      this.processQueue();
    };

    return { page, release };
  }

  /**
   * Recycle a browser instance by closing and removing it from pool
   */
  private async recycleBrowser(instance: BrowserInstance): Promise<void> {
    const index = this.instances.indexOf(instance);
    if (index > -1) {
      this.instances.splice(index, 1);
    }

    try {
      await instance.browser.close();
    } catch (error) {
      console.error('Error closing browser during recycling:', error);
    }
  }

  /**
   * Wait for an available browser when pool is full
   */
  private async waitForAvailableBrowser(): Promise<{
    page: Page;
    release: () => Promise<void>;
  }> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      const wrappedResolve = (value: { page: Page; release: () => Promise<void> }) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(value);
      };

      const wrappedReject = (error: Error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(error);
      };

      // Add to queue with timeout
      timeoutId = setTimeout(() => {
        const index = this.acquireQueue.findIndex((q) => q.resolve === wrappedResolve);
        if (index > -1) {
          this.acquireQueue.splice(index, 1);
        }
        reject(new Error('Timeout waiting for available browser'));
      }, this.pageTimeout);

      this.acquireQueue.push({
        resolve: wrappedResolve,
        reject: wrappedReject,
      });
    });
  }

  /**
   * Process queued acquire requests when browsers become available
   */
  private async processQueue(): Promise<void> {
    if (this.acquireQueue.length === 0 || this.shuttingDown) {
      return;
    }

    // Try to find an idle browser first
    let availableInstance = this.findIdleBrowser();

    // If no idle browser, try to reuse one
    if (!availableInstance) {
      availableInstance = this.findReusableBrowser();
    }

    if (availableInstance) {
      const queued = this.acquireQueue.shift();
      if (queued) {
        try {
          const result = await this.createPageFromInstance(availableInstance);
          queued.resolve(result);
        } catch (error) {
          queued.reject(error as Error);
        }
      }
    } else if (this.instances.length < this.maxInstances) {
      const queued = this.acquireQueue.shift();
      if (queued) {
        try {
          const newInstance = await this.createBrowser();
          const result = await this.createPageFromInstance(newInstance);
          queued.resolve(result);
        } catch (error) {
          queued.reject(error as Error);
        }
      }
    }
  }
}

/**
 * Default browser pool instance
 * Singleton pattern for application-wide browser pool management
 */
let defaultPool: BrowserPool | null = null;

/**
 * Get or create the default browser pool instance
 *
 * @param options Configuration options (only used on first call)
 * @returns The default BrowserPool instance
 */
export function getDefaultPool(options?: BrowserPoolOptions): BrowserPool {
  if (!defaultPool) {
    defaultPool = new BrowserPool(options);
  }
  return defaultPool;
}

/**
 * Shutdown the default browser pool
 * Useful for graceful application shutdown
 */
export async function shutdownDefaultPool(): Promise<void> {
  if (defaultPool) {
    await defaultPool.shutdown();
    defaultPool = null;
  }
}
