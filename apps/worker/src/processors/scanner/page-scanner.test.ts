import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from 'playwright';
import type { Result as AxeResults } from 'axe-core';
import { scanPage, scanPages, ScanError } from './page-scanner.js';
import * as browserPool from '../../utils/browser-pool.js';
import * as axeRunner from './axe-runner.js';
import * as resultMapper from './result-mapper.js';

/**
 * Page Scanner Tests
 *
 * Tests for the core page scanning functionality including:
 * - Successful scan flow
 * - Redirect validation and security
 * - HTML sanitization
 * - axe result mapping
 * - Timeout handling
 * - Error scenarios
 */

describe('Page Scanner', () => {
  // Mock objects
  let mockPage: Page;
  let mockRelease: () => Promise<void>;
  let mockAxeResults: AxeResults;

  beforeEach(() => {
    // Mock Playwright page
    mockPage = {
      goto: vi.fn(),
      url: vi.fn(),
      title: vi.fn(),
      close: vi.fn(),
      isClosed: vi.fn(() => false),
    } as unknown as Page;

    // Mock browser pool release function
    mockRelease = vi.fn();

    // Mock axe-core results
    mockAxeResults = {
      violations: [
        {
          id: 'image-alt',
          impact: 'critical',
          description: 'Images must have alternate text',
          help: 'Images must have alt text',
          helpUrl: 'https://example.com/help',
          tags: ['wcag2a', 'wcag111'],
          nodes: [
            {
              html: '<img src="test.jpg">',
              target: ['img'],
              failureSummary: 'Missing alt attribute',
            },
          ],
        },
      ],
      passes: [
        {
          id: 'document-title',
          impact: null,
          description: 'Documents must have a title element',
          help: 'Documents must have a title',
          helpUrl: 'https://example.com/help2',
          tags: ['wcag2a'],
          nodes: [],
        },
      ],
      inapplicable: [
        {
          id: 'audio-caption',
          impact: null,
          description: 'Audio elements must have captions',
          help: 'Audio must have captions',
          helpUrl: 'https://example.com/help3',
          tags: ['wcag2a'],
          nodes: [],
        },
      ],
      incomplete: [],
      timestamp: new Date().toISOString(),
      url: 'https://example.com',
    } as unknown as AxeResults;

    // Setup default mocks
    vi.spyOn(browserPool, 'getDefaultPool').mockReturnValue({
      acquire: vi.fn().mockResolvedValue({ page: mockPage, release: mockRelease }),
    } as any);

    vi.spyOn(axeRunner, 'runAxeAnalysis').mockResolvedValue(mockAxeResults);
    vi.spyOn(resultMapper, 'mapAxeViolations').mockReturnValue([
      {
        id: 'test-issue-1',
        ruleId: 'image-alt',
        impact: 'CRITICAL',
        description: 'Images must have alternate text',
        helpText: 'Images must have alt text',
        helpUrl: 'https://example.com/help',
        wcagCriteria: ['1.1.1'],
        cssSelector: 'img',
        htmlSnippet: '<img src="test.jpg">',
        nodes: [
          {
            html: '<img src="test.jpg">',
            target: ['img'],
            failureSummary: 'Missing alt attribute',
          },
        ],
      },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scanPage', () => {
    it('should successfully scan a page', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('https://example.com');
      vi.mocked(mockPage.title).mockResolvedValue('Example Page');

      // Execute
      const result = await scanPage({
        url: 'https://example.com',
        wcagLevel: 'AA',
      });

      // Verify
      expect(result).toMatchObject({
        url: 'https://example.com',
        finalUrl: 'https://example.com',
        title: 'Example Page',
        issues: expect.arrayContaining([
          expect.objectContaining({
            ruleId: 'image-alt',
            impact: 'CRITICAL',
          }),
        ]),
        passes: 1,
        inapplicable: 1,
      });

      expect(result.scanDuration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);

      // Verify browser pool release called
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('should pass correct options to page.goto', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('https://example.com');
      vi.mocked(mockPage.title).mockResolvedValue('Test');

      // Execute
      await scanPage({
        url: 'https://example.com',
        wcagLevel: 'AA',
        timeout: 30000,
        waitUntil: 'load',
      });

      // Verify
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        timeout: 30000,
        waitUntil: 'load',
      });
    });

    it('should use default timeout and waitUntil if not provided', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('https://example.com');
      vi.mocked(mockPage.title).mockResolvedValue('Test');

      // Execute
      await scanPage({
        url: 'https://example.com',
        wcagLevel: 'A',
      });

      // Verify
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        timeout: 60000,
        waitUntil: 'networkidle',
      });
    });

    it('should handle navigation timeout', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockRejectedValue(new Error('Navigation timeout of 60000ms exceeded'));

      // Execute & Verify
      await expect(
        scanPage({
          url: 'https://slow-site.com',
          wcagLevel: 'AA',
        })
      ).rejects.toThrow(ScanError);

      await expect(
        scanPage({
          url: 'https://slow-site.com',
          wcagLevel: 'AA',
        })
      ).rejects.toMatchObject({
        code: 'TIMEOUT',
      });

      // Verify release still called
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should handle navigation failure', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

      // Execute & Verify
      await expect(
        scanPage({
          url: 'https://invalid-domain-xyz.com',
          wcagLevel: 'AA',
        })
      ).rejects.toThrow(ScanError);

      await expect(
        scanPage({
          url: 'https://invalid-domain-xyz.com',
          wcagLevel: 'AA',
        })
      ).rejects.toMatchObject({
        code: 'NAVIGATION_FAILED',
      });
    });

    it('should validate redirects and block private IPs', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('http://192.168.1.1'); // Private IP
      vi.mocked(mockPage.title).mockResolvedValue('Router Admin');

      // Execute & Verify
      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toThrow(ScanError);

      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toMatchObject({
        code: 'BLOCKED_REDIRECT',
        message: expect.stringContaining('192.168.1.1'),
      });
    });

    it('should validate redirects and block localhost', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('http://localhost:8080');
      vi.mocked(mockPage.title).mockResolvedValue('Local Server');

      // Execute & Verify
      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toThrow(ScanError);

      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toMatchObject({
        code: 'BLOCKED_REDIRECT',
        message: expect.stringContaining('localhost'),
      });
    });

    it('should validate redirects and block cloud metadata endpoint', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('http://169.254.169.254/latest/meta-data');
      vi.mocked(mockPage.title).mockResolvedValue('Metadata');

      // Execute & Verify
      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toThrow(ScanError);

      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toMatchObject({
        code: 'BLOCKED_REDIRECT',
        message: expect.stringContaining('169.254.169.254'),
      });
    });

    it('should allow safe redirects', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('https://www.example.com'); // Safe redirect
      vi.mocked(mockPage.title).mockResolvedValue('Example');

      // Execute
      const result = await scanPage({
        url: 'https://example.com',
        wcagLevel: 'AA',
      });

      // Verify - should succeed
      expect(result.finalUrl).toBe('https://www.example.com');
      expect(result.url).toBe('https://example.com');
    });

    it('should handle axe-core analysis failure', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('https://example.com');
      vi.mocked(axeRunner.runAxeAnalysis).mockRejectedValue(new Error('axe-core failed'));

      // Execute & Verify
      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toThrow(ScanError);

      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toMatchObject({
        code: 'ANALYSIS_FAILED',
      });

      // Verify release still called
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should pass correct WCAG level to axe-core', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('https://example.com');
      vi.mocked(mockPage.title).mockResolvedValue('Test');

      // Execute
      await scanPage({
        url: 'https://example.com',
        wcagLevel: 'AAA',
      });

      // Verify
      expect(axeRunner.runAxeAnalysis).toHaveBeenCalledWith(mockPage, 'AAA');
    });

    it('should release browser page even if scan fails', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockRejectedValue(new Error('Navigation failed'));

      // Execute
      await expect(
        scanPage({
          url: 'https://example.com',
          wcagLevel: 'AA',
        })
      ).rejects.toThrow();

      // Verify release was called
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe('scanPages', () => {
    it('should scan multiple pages concurrently', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.url).mockReturnValue('https://example.com');
      vi.mocked(mockPage.title).mockResolvedValue('Test Page');

      // Execute
      const results = await scanPages([
        { url: 'https://example.com/page1', wcagLevel: 'AA' },
        { url: 'https://example.com/page2', wcagLevel: 'AA' },
        { url: 'https://example.com/page3', wcagLevel: 'A' },
      ]);

      // Verify
      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        url: 'https://example.com/page1',
      });
      expect(results[1]).toMatchObject({
        url: 'https://example.com/page2',
      });
      expect(results[2]).toMatchObject({
        url: 'https://example.com/page3',
      });

      // Verify browser pool was used for each scan
      expect(browserPool.getDefaultPool).toHaveBeenCalledTimes(3);
    });

    it('should return results in same order as input', async () => {
      // Setup
      vi.mocked(mockPage.goto).mockResolvedValue(null as any);
      vi.mocked(mockPage.title).mockResolvedValue('Test');

      // Different URLs for each scan
      const urls = [
        'https://example.com/a',
        'https://example.com/b',
        'https://example.com/c',
      ];

      // Mock url() to return the current URL being scanned
      let currentIndex = 0;
      vi.mocked(mockPage.url).mockImplementation(() => {
        return urls[currentIndex++ % urls.length]!;
      });

      // Execute
      const results = await scanPages(
        urls.map((url) => ({ url, wcagLevel: 'AA' as const }))
      );

      // Verify order preserved
      expect(results[0]?.finalUrl).toContain('/a');
      expect(results[1]?.finalUrl).toContain('/b');
      expect(results[2]?.finalUrl).toContain('/c');
    });

    it('should handle individual scan failures', async () => {
      // Setup - second scan will fail
      let callCount = 0;
      vi.mocked(mockPage.goto).mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Navigation failed');
        }
        return null as any;
      });

      vi.mocked(mockPage.url).mockReturnValue('https://example.com');
      vi.mocked(mockPage.title).mockResolvedValue('Test');

      // Execute
      const results = await Promise.allSettled([
        scanPage({ url: 'https://example.com/page1', wcagLevel: 'AA' }),
        scanPage({ url: 'https://example.com/page2', wcagLevel: 'AA' }),
        scanPage({ url: 'https://example.com/page3', wcagLevel: 'AA' }),
      ]);

      // Verify
      expect(results[0]?.status).toBe('fulfilled');
      expect(results[1]?.status).toBe('rejected');
      expect(results[2]?.status).toBe('fulfilled');
    });
  });

  describe('ScanError', () => {
    it('should create error with correct code', () => {
      const error = new ScanError('Test error', 'TIMEOUT');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TIMEOUT');
      expect(error.name).toBe('ScanError');
    });

    it('should be instanceof Error', () => {
      const error = new ScanError('Test', 'ANALYSIS_FAILED');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ScanError);
    });
  });
});
