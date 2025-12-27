import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Browser, Page } from 'playwright';

/**
 * Mock Playwright Browser
 */
class MockBrowser {
  private connected = true;
  private pages: MockPage[] = [];
  private eventHandlers: Map<string, Function[]> = new Map();

  async newPage(): Promise<MockPage> {
    const page = new MockPage();
    this.pages.push(page);
    return page;
  }

  async close(): Promise<void> {
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(handler);
  }

  emit(event: string): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => handler());
  }

  simulateDisconnect(): void {
    this.connected = false;
    this.emit('disconnected');
  }
}

/**
 * Mock Playwright Page
 */
class MockPage {
  private closed = false;
  private defaultTimeout = 30000;

  async close(): Promise<void> {
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }

  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  getDefaultTimeout(): number {
    return this.defaultTimeout;
  }
}

// Mock playwright module - factory must be inline
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => new MockBrowser() as unknown as Browser),
  },
}));

// Mock env config
vi.mock('../config/env.js', () => ({
  env: {
    PLAYWRIGHT_HEADLESS: true,
    PLAYWRIGHT_TIMEOUT: 30000,
  },
}));

// Import after mocks
import { BrowserPool, type BrowserPoolOptions } from './browser-pool.js';
import { chromium } from 'playwright';

describe('BrowserPool', () => {
  const mockLaunch = vi.mocked(chromium.launch);

  beforeEach(() => {
    // Reset mock before each test
    mockLaunch.mockReset();
    mockLaunch.mockImplementation(async () => new MockBrowser() as unknown as Browser);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create pool with default options', () => {
      const pool = new BrowserPool();
      const stats = pool.getStats();

      expect(stats.total).toBe(0);
      expect(stats.available).toBe(0);
      expect(stats.inUse).toBe(0);
    });

    it('should create pool with custom options', () => {
      const options: BrowserPoolOptions = {
        maxInstances: 5,
        maxPagesPerBrowser: 3,
        pageTimeout: 45000,
        browserArgs: ['--custom-arg'],
      };

      const pool = new BrowserPool(options);
      expect(pool).toBeDefined();
    });
  });

  describe('acquire and release', () => {
    it('should acquire a page and release it', async () => {
      const pool = new BrowserPool({ maxInstances: 5 });

      const { page, release } = await pool.acquire();

      expect(page).toBeDefined();
      expect(mockLaunch).toHaveBeenCalledTimes(1);

      let stats = pool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.inUse).toBe(1);
      expect(stats.available).toBe(0);

      await release();

      stats = pool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.inUse).toBe(0);
      expect(stats.available).toBe(1);

      await pool.shutdown();
    });

    it('should reuse browser for multiple acquires', async () => {
      const pool = new BrowserPool({ maxInstances: 5, maxPagesPerBrowser: 3 });

      const { page: page1, release: release1 } = await pool.acquire();
      await release1();

      const { page: page2, release: release2 } = await pool.acquire();
      await release2();

      // Should only create one browser
      expect(mockLaunch).toHaveBeenCalledTimes(1);

      let stats = pool.getStats();
      expect(stats.total).toBe(1);

      await pool.shutdown();
    });

    it('should recycle browser after max pages', async () => {
      const pool = new BrowserPool({ maxInstances: 5, maxPagesPerBrowser: 2 });

      // First page
      const { page: page1, release: release1 } = await pool.acquire();
      await release1();

      // Second page - should still use same browser
      const { page: page2, release: release2 } = await pool.acquire();
      let stats = pool.getStats();
      expect(stats.total).toBe(1);
      await release2();

      // Browser should be recycled after 2 pages
      stats = pool.getStats();
      expect(stats.total).toBe(0);

      // Third page - should create new browser
      const { page: page3, release: release3 } = await pool.acquire();
      expect(mockLaunch).toHaveBeenCalledTimes(2);
      await release3();

      await pool.shutdown();
    });

    it('should handle multiple concurrent acquires', async () => {
      const pool = new BrowserPool({ maxInstances: 3 });

      const acquires = await Promise.all([
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
      ]);

      const stats = pool.getStats();
      expect(stats.total).toBe(3);
      expect(stats.inUse).toBe(3);
      expect(stats.available).toBe(0);

      // Release all
      await Promise.all(acquires.map((a) => a.release()));

      await pool.shutdown();
    });

    it('should set page timeout correctly', async () => {
      const customTimeout = 45000;
      const pool = new BrowserPool({ pageTimeout: customTimeout });

      const { page, release } = await pool.acquire();

      // Check that timeout was set
      expect((page as unknown as MockPage).getDefaultTimeout()).toBe(customTimeout);

      await release();
      await pool.shutdown();
    });

    it('should close page when releasing', async () => {
      const pool = new BrowserPool();

      const { page, release } = await pool.acquire();
      const mockPage = page as unknown as MockPage;

      expect(mockPage.isClosed()).toBe(false);

      await release();

      expect(mockPage.isClosed()).toBe(true);

      await pool.shutdown();
    });
  });

  describe('pool limits', () => {
    it('should respect max instances limit', async () => {
      const pool = new BrowserPool({ maxInstances: 2, maxPagesPerBrowser: 1 });

      // Force creation of 2 browsers by limiting pages per browser
      const acquire1 = await pool.acquire();
      const acquire2 = await pool.acquire();

      const stats = pool.getStats();
      expect(stats.total).toBeLessThanOrEqual(2);
      expect(stats.total).toBeGreaterThanOrEqual(1);

      await acquire1.release();
      await acquire2.release();
      await pool.shutdown();
    });

    it('should queue requests when pool is full', async () => {
      const pool = new BrowserPool({
        maxInstances: 1,
        maxPagesPerBrowser: 1,
        pageTimeout: 5000,
      });

      // Acquire the only browser and use up its page limit
      const acquire1 = await pool.acquire();

      let stats = pool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.inUse).toBe(1);

      // This should queue
      const acquire2Promise = pool.acquire();

      // Release one to allow queued request
      setTimeout(() => acquire1.release(), 100);

      const acquire2 = await acquire2Promise;
      expect(acquire2).toBeDefined();

      await acquire2.release();
      await pool.shutdown();
    });

    it('should timeout queued requests', async () => {
      const pool = new BrowserPool({
        maxInstances: 1,
        maxPagesPerBrowser: 1,
        pageTimeout: 500,
      });

      // Acquire the only browser and use up its page limit
      const acquire1 = await pool.acquire();

      // This should timeout because pool is full and browser at limit
      await expect(pool.acquire()).rejects.toThrow('Timeout waiting for available browser');

      await acquire1.release();
      await pool.shutdown();
    });

    it('should process multiple queued requests', async () => {
      const pool = new BrowserPool({ maxInstances: 1, pageTimeout: 5000 });

      // Acquire the only browser
      const acquire1 = await pool.acquire();

      // Queue two requests
      const acquire2Promise = pool.acquire();
      const acquire3Promise = pool.acquire();

      // Release in sequence
      setTimeout(() => acquire1.release(), 100);

      const acquire2 = await acquire2Promise;
      setTimeout(() => acquire2.release(), 100);

      const acquire3 = await acquire3Promise;
      expect(acquire3).toBeDefined();

      await acquire3.release();
      await pool.shutdown();
    });
  });

  describe('browser recycling', () => {
    it('should recycle browser at exact page limit', async () => {
      const pool = new BrowserPool({ maxPagesPerBrowser: 3 });

      // Acquire and release pages from same browser sequentially
      const { release: r1 } = await pool.acquire();
      await r1();

      const { release: r2 } = await pool.acquire();
      await r2();

      const { release: r3 } = await pool.acquire();

      // Before releasing 3rd page - should still have the browser
      let stats = pool.getStats();
      expect(stats.total).toBe(1);

      await r3();

      // After releasing 3rd page, browser should be recycled
      stats = pool.getStats();
      expect(stats.total).toBe(0);

      await pool.shutdown();
    });

    it('should create new browser after recycling', async () => {
      const pool = new BrowserPool({ maxPagesPerBrowser: 2 });

      // First browser - use 2 pages sequentially
      const { release: r1 } = await pool.acquire();
      await r1();
      const { release: r2 } = await pool.acquire();
      await r2();

      // Browser should be recycled after 2 pages
      const initialCount = mockLaunch.mock.calls.length;

      // Should create new browser since first one was recycled
      const { release: r3 } = await pool.acquire();
      expect(mockLaunch).toHaveBeenCalledTimes(initialCount + 1);

      await r3();
      await pool.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      const pool = new BrowserPool();

      const { page, release } = await pool.acquire();
      await release();

      await pool.shutdown();

      const stats = pool.getStats();
      expect(stats.total).toBe(0);
    });

    it('should reject new acquires after shutdown', async () => {
      const pool = new BrowserPool();

      await pool.shutdown();

      await expect(pool.acquire()).rejects.toThrow('Browser pool is shutting down');
    });

    it('should wait for in-use browsers during shutdown', async () => {
      const pool = new BrowserPool();

      const { page, release } = await pool.acquire();

      // Start shutdown but don't await
      const shutdownPromise = pool.shutdown();

      // Release after a delay
      setTimeout(() => release(), 100);

      // Shutdown should wait and complete
      await shutdownPromise;

      const stats = pool.getStats();
      expect(stats.total).toBe(0);
    });

    it('should reject queued requests during shutdown', async () => {
      const pool = new BrowserPool({ maxInstances: 1, maxPagesPerBrowser: 1 });

      const acquire1 = await pool.acquire();

      // Queue a request (will queue because browser at limit)
      const acquire2Promise = pool.acquire();

      // Shutdown immediately
      const shutdownPromise = pool.shutdown();

      // Queued request should be rejected
      await expect(acquire2Promise).rejects.toThrow('Browser pool shutting down');

      await acquire1.release();
      await shutdownPromise;
    });

    it('should handle errors during browser close', async () => {
      const pool = new BrowserPool();

      // Mock browser that throws on close
      const errorBrowser = new MockBrowser();
      errorBrowser.close = vi.fn().mockRejectedValue(new Error('Close failed'));
      mockLaunch.mockResolvedValueOnce(errorBrowser as unknown as Browser);

      const { release } = await pool.acquire();
      await release();

      // Should not throw even if browser close fails
      await expect(pool.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle browser disconnection', async () => {
      const pool = new BrowserPool();

      const mockBrowser = new MockBrowser();
      mockLaunch.mockResolvedValueOnce(mockBrowser as unknown as Browser);

      const { release } = await pool.acquire();
      await release();

      let stats = pool.getStats();
      expect(stats.total).toBe(1);

      // Simulate browser disconnect
      mockBrowser.simulateDisconnect();

      // Wait for event to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      stats = pool.getStats();
      expect(stats.total).toBe(0);

      await pool.shutdown();
    });

    it('should handle page close errors gracefully', async () => {
      const pool = new BrowserPool();

      const { page, release } = await pool.acquire();

      // Mock page close to throw error
      const mockPage = page as unknown as MockPage;
      mockPage.close = vi.fn().mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(release()).resolves.toBeUndefined();

      await pool.shutdown();
    });

    it('should skip unavailable browsers when finding available', async () => {
      const pool = new BrowserPool({ maxInstances: 2 });

      // Create first browser
      const mockBrowser1 = new MockBrowser();
      mockLaunch.mockResolvedValueOnce(mockBrowser1 as unknown as Browser);
      const { release: r1 } = await pool.acquire();
      await r1();

      // Disconnect first browser
      mockBrowser1.simulateDisconnect();

      // Wait for disconnection to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create second browser
      const mockBrowser2 = new MockBrowser();
      mockLaunch.mockResolvedValueOnce(mockBrowser2 as unknown as Browser);
      const { release: r2 } = await pool.acquire();

      // Should have created new browser, not reused disconnected one
      expect(mockLaunch).toHaveBeenCalledTimes(2);

      await r2();
      await pool.shutdown();
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty pool', () => {
      const pool = new BrowserPool();
      const stats = pool.getStats();

      expect(stats.total).toBe(0);
      expect(stats.available).toBe(0);
      expect(stats.inUse).toBe(0);
    });

    it('should return correct stats with active browsers', async () => {
      const pool = new BrowserPool();

      const acquire1 = await pool.acquire();
      const acquire2 = await pool.acquire();

      // Both pages can be from the same browser
      let stats = pool.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.inUse).toBeGreaterThanOrEqual(1);

      await acquire1.release();

      stats = pool.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(1);

      await acquire2.release();

      stats = pool.getStats();
      expect(stats.inUse).toBe(0);
      expect(stats.available).toBe(stats.total);

      await pool.shutdown();
    });
  });

  describe('browser launch configuration', () => {
    it('should launch with default security args', async () => {
      const pool = new BrowserPool();

      const { release } = await pool.acquire();

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          args: expect.arrayContaining([
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ]),
        })
      );

      await release();
      await pool.shutdown();
    });

    it('should launch with custom args', async () => {
      const customArgs = ['--custom-arg-1', '--custom-arg-2'];
      const pool = new BrowserPool({ browserArgs: customArgs });

      const { release } = await pool.acquire();

      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: customArgs,
        })
      );

      await release();
      await pool.shutdown();
    });
  });
});
