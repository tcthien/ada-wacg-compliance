/**
 * Email Templates Tests
 *
 * Tests for email template generation functions.
 * Verifies HTML/text generation, data escaping, and content correctness.
 *
 * Per Requirement 4.3:
 * - Batch completion email template with aggregate metrics
 * - Top critical URLs list with proper formatting
 * - PDF report link when available
 */

import { describe, it, expect } from 'vitest';
import {
  getBatchCompleteEmail,
  getScanCompleteEmail,
  getScanFailedEmail,
  escapeHtml,
  type BatchCompleteEmailData,
  type ScanCompleteEmailData,
  type ScanFailedEmailData,
  type EmailContent,
} from './email-templates.js';

/**
 * Create default batch complete email data for testing
 */
function createBatchCompleteEmailData(
  overrides: Partial<BatchCompleteEmailData> = {}
): BatchCompleteEmailData {
  return {
    homepageUrl: 'https://example.com',
    totalUrls: 10,
    completedCount: 9,
    failedCount: 1,
    totalIssues: 45,
    criticalCount: 5,
    seriousCount: 12,
    moderateCount: 18,
    minorCount: 10,
    passedChecks: 230,
    topCriticalUrls: [
      { url: 'https://example.com/about', criticalCount: 3 },
      { url: 'https://example.com/contact', criticalCount: 2 },
    ],
    resultsUrl: 'https://app.adashield.com/batch/batch-123',
    ...overrides,
  };
}

/**
 * Create default scan complete email data for testing
 */
function createScanCompleteEmailData(
  overrides: Partial<ScanCompleteEmailData> = {}
): ScanCompleteEmailData {
  return {
    url: 'https://example.com',
    issueCount: 15,
    criticalCount: 2,
    seriousCount: 5,
    moderateCount: 5,
    minorCount: 3,
    resultsUrl: 'https://app.adashield.com/scan/scan-123',
    ...overrides,
  };
}

/**
 * Create default scan failed email data for testing
 */
function createScanFailedEmailData(
  overrides: Partial<ScanFailedEmailData> = {}
): ScanFailedEmailData {
  return {
    url: 'https://example.com',
    error: 'Connection timeout',
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('should escape ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape less than sign', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('should escape greater than sign', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('should escape double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")); // Should escape single quote
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('should escape multiple special characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  it('should return empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should not modify strings without special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('getBatchCompleteEmail', () => {
  describe('return structure', () => {
    it('should return valid EmailContent structure', () => {
      const data = createBatchCompleteEmailData();
      const result = getBatchCompleteEmail(data);

      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
      expect(typeof result.subject).toBe('string');
      expect(typeof result.html).toBe('string');
      expect(typeof result.text).toBe('string');
    });

    it('should return non-empty content for all fields', () => {
      const data = createBatchCompleteEmailData();
      const result = getBatchCompleteEmail(data);

      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    });
  });

  describe('subject line', () => {
    it('should include total URLs scanned in subject', () => {
      const data = createBatchCompleteEmailData({ totalUrls: 25 });
      const result = getBatchCompleteEmail(data);

      expect(result.subject).toContain('25 URLs');
    });

    it('should include total issue count in subject', () => {
      const data = createBatchCompleteEmailData({ totalIssues: 100 });
      const result = getBatchCompleteEmail(data);

      expect(result.subject).toContain('100');
    });

    it('should use singular form for 1 issue', () => {
      const data = createBatchCompleteEmailData({ totalIssues: 1 });
      const result = getBatchCompleteEmail(data);

      expect(result.subject).toMatch(/1 issue[^s]/);
    });

    it('should use plural form for multiple issues', () => {
      const data = createBatchCompleteEmailData({ totalIssues: 5 });
      const result = getBatchCompleteEmail(data);

      expect(result.subject).toContain('issues');
    });

    it('should use plural form for 0 issues', () => {
      const data = createBatchCompleteEmailData({ totalIssues: 0 });
      const result = getBatchCompleteEmail(data);

      expect(result.subject).toContain('issues');
    });
  });

  describe('HTML content', () => {
    it('should generate valid HTML document', () => {
      const data = createBatchCompleteEmailData();
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<html lang="en">');
      expect(result.html).toContain('</html>');
    });

    it('should include homepage URL in body', () => {
      const data = createBatchCompleteEmailData({
        homepageUrl: 'https://test-site.org',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('https://test-site.org');
    });

    it('should escape HTML in homepage URL', () => {
      const data = createBatchCompleteEmailData({
        homepageUrl: 'https://example.com?q=<script>alert("xss")</script>',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).not.toContain('<script>alert');
    });

    it('should include total URLs count', () => {
      const data = createBatchCompleteEmailData({ totalUrls: 42 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('42');
    });

    it('should include completed count', () => {
      const data = createBatchCompleteEmailData({ completedCount: 38 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('38');
    });

    it('should include failed count when greater than 0', () => {
      const data = createBatchCompleteEmailData({ failedCount: 3 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('3');
      expect(result.html).toContain('Failed');
    });

    it('should not show failed row when failedCount is 0', () => {
      const data = createBatchCompleteEmailData({ failedCount: 0 });
      const result = getBatchCompleteEmail(data);

      // The "Failed:" row should not be present
      expect(result.html).not.toMatch(/<td[^>]*>Failed:<\/td>/i);
    });

    it('should include total issues count', () => {
      const data = createBatchCompleteEmailData({ totalIssues: 150 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('150');
    });

    it('should include critical count when greater than 0', () => {
      const data = createBatchCompleteEmailData({ criticalCount: 7 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('Critical');
      expect(result.html).toContain('7');
    });

    it('should not show critical row when criticalCount is 0', () => {
      const data = createBatchCompleteEmailData({ criticalCount: 0 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).not.toMatch(/Critical Issues:<\/td>\s*<td[^>]*>0/);
    });

    it('should include serious count when greater than 0', () => {
      const data = createBatchCompleteEmailData({ seriousCount: 15 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('Serious');
    });

    it('should include moderate count when greater than 0', () => {
      const data = createBatchCompleteEmailData({ moderateCount: 20 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('Moderate');
    });

    it('should include minor count when greater than 0', () => {
      const data = createBatchCompleteEmailData({ minorCount: 8 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('Minor');
    });

    it('should include passed checks count', () => {
      const data = createBatchCompleteEmailData({ passedChecks: 500 });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('500');
      expect(result.html).toContain('Passed');
    });

    it('should include results URL link', () => {
      const data = createBatchCompleteEmailData({
        resultsUrl: 'https://app.adashield.com/batch/abc-123',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('href="https://app.adashield.com/batch/abc-123"');
      expect(result.html).toContain('View Full Results');
    });

    it('should escape HTML in results URL', () => {
      const data = createBatchCompleteEmailData({
        resultsUrl: 'https://app.adashield.com/batch?id="test"',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('&quot;test&quot;');
    });

    it('should include GDPR compliance footer', () => {
      const data = createBatchCompleteEmailData();
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('ADAShield');
      expect(result.html).toContain('GDPR');
      expect(result.html).toContain('deleted from our systems');
    });
  });

  describe('top critical URLs display', () => {
    it('should display top critical URLs when provided', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [
          { url: 'https://example.com/page1', criticalCount: 5 },
          { url: 'https://example.com/page2', criticalCount: 3 },
        ],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('URLs with Most Critical Issues');
      expect(result.html).toContain('https://example.com/page1');
      expect(result.html).toContain('https://example.com/page2');
    });

    it('should display critical count for each URL', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [{ url: 'https://example.com/about', criticalCount: 7 }],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('7');
      expect(result.html).toContain('critical issue');
    });

    it('should use singular form for 1 critical issue', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [{ url: 'https://example.com/about', criticalCount: 1 }],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toMatch(/1.*critical issue[^s]/);
    });

    it('should use plural form for multiple critical issues', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [{ url: 'https://example.com/about', criticalCount: 5 }],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('critical issues');
    });

    it('should limit display to 5 URLs', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [
          { url: 'https://example.com/1', criticalCount: 10 },
          { url: 'https://example.com/2', criticalCount: 9 },
          { url: 'https://example.com/3', criticalCount: 8 },
          { url: 'https://example.com/4', criticalCount: 7 },
          { url: 'https://example.com/5', criticalCount: 6 },
          { url: 'https://example.com/6', criticalCount: 5 },
          { url: 'https://example.com/7', criticalCount: 4 },
        ],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('https://example.com/1');
      expect(result.html).toContain('https://example.com/5');
      expect(result.html).not.toContain('https://example.com/6');
      expect(result.html).not.toContain('https://example.com/7');
    });

    it('should escape HTML in critical URLs', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [
          { url: 'https://example.com/<script>alert("xss")</script>', criticalCount: 3 },
        ],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).not.toContain('<script>alert');
    });

    it('should truncate long URLs in display', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(100);
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [{ url: longUrl, criticalCount: 2 }],
      });
      const result = getBatchCompleteEmail(data);

      // The href should contain the full URL
      expect(result.html).toContain(`href="${longUrl}"`);
      // The display text should be truncated with ellipsis
      expect(result.html).toContain('...');
    });

    it('should not display top URLs section when empty', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).not.toContain('URLs with Most Critical Issues');
    });
  });

  describe('PDF report URL handling', () => {
    it('should include PDF download button when pdfReportUrl is provided', () => {
      const data = createBatchCompleteEmailData({
        pdfReportUrl: 'https://s3.example.com/reports/batch-123/report.pdf',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('Download PDF Report');
      expect(result.html).toContain(
        'href="https://s3.example.com/reports/batch-123/report.pdf"'
      );
    });

    it('should escape HTML in pdfReportUrl', () => {
      const data = createBatchCompleteEmailData({
        pdfReportUrl: 'https://s3.example.com/reports?id="test"',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('&quot;test&quot;');
    });

    it('should not include PDF button when pdfReportUrl is undefined', () => {
      const data = createBatchCompleteEmailData({
        pdfReportUrl: undefined,
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).not.toContain('Download PDF Report');
    });

    it('should not include PDF button when pdfReportUrl is empty string', () => {
      const data = createBatchCompleteEmailData({
        pdfReportUrl: '',
      });
      const result = getBatchCompleteEmail(data);

      // Empty string is falsy, so button should not appear
      expect(result.html).not.toContain('Download PDF Report');
    });
  });

  describe('plain text content', () => {
    it('should include homepage URL', () => {
      const data = createBatchCompleteEmailData({
        homepageUrl: 'https://test-site.org',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('https://test-site.org');
    });

    it('should include total URLs count', () => {
      const data = createBatchCompleteEmailData({ totalUrls: 42 });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('42');
    });

    it('should include scan summary statistics', () => {
      const data = createBatchCompleteEmailData({
        completedCount: 38,
        failedCount: 2,
        totalIssues: 100,
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('38');
      expect(result.text).toContain('100');
    });

    it('should include failed count when greater than 0', () => {
      const data = createBatchCompleteEmailData({ failedCount: 5 });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('Failed');
      expect(result.text).toContain('5');
    });

    it('should not include failed line when failedCount is 0', () => {
      const data = createBatchCompleteEmailData({ failedCount: 0 });
      const result = getBatchCompleteEmail(data);

      expect(result.text).not.toContain('- Failed:');
    });

    it('should include issue breakdown', () => {
      const data = createBatchCompleteEmailData({
        criticalCount: 5,
        seriousCount: 10,
        moderateCount: 15,
        minorCount: 20,
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('Critical');
      expect(result.text).toContain('Serious');
      expect(result.text).toContain('Moderate');
      expect(result.text).toContain('Minor');
    });

    it('should include passed checks', () => {
      const data = createBatchCompleteEmailData({ passedChecks: 350 });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('Passed');
      expect(result.text).toContain('350');
    });

    it('should include top critical URLs when provided', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [
          { url: 'https://example.com/page1', criticalCount: 5 },
          { url: 'https://example.com/page2', criticalCount: 3 },
        ],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('URLs with Most Critical Issues');
      expect(result.text).toContain('https://example.com/page1');
      expect(result.text).toContain('https://example.com/page2');
    });

    it('should limit plain text URLs to 5', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [
          { url: 'https://example.com/1', criticalCount: 10 },
          { url: 'https://example.com/2', criticalCount: 9 },
          { url: 'https://example.com/3', criticalCount: 8 },
          { url: 'https://example.com/4', criticalCount: 7 },
          { url: 'https://example.com/5', criticalCount: 6 },
          { url: 'https://example.com/6', criticalCount: 5 },
        ],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('https://example.com/5');
      expect(result.text).not.toContain('https://example.com/6');
    });

    it('should not include top URLs section when empty', () => {
      const data = createBatchCompleteEmailData({
        topCriticalUrls: [],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).not.toContain('URLs with Most Critical Issues');
    });

    it('should include results URL', () => {
      const data = createBatchCompleteEmailData({
        resultsUrl: 'https://app.adashield.com/batch/xyz-789',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('View Full Results');
      expect(result.text).toContain('https://app.adashield.com/batch/xyz-789');
    });

    it('should include PDF report URL when provided', () => {
      const data = createBatchCompleteEmailData({
        pdfReportUrl: 'https://s3.example.com/reports/batch-123/report.pdf',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('Download PDF Report');
      expect(result.text).toContain('https://s3.example.com/reports/batch-123/report.pdf');
    });

    it('should not include PDF line when pdfReportUrl is undefined', () => {
      const data = createBatchCompleteEmailData({
        pdfReportUrl: undefined,
      });
      const result = getBatchCompleteEmail(data);

      expect(result.text).not.toContain('Download PDF Report');
    });

    it('should include GDPR compliance footer', () => {
      const data = createBatchCompleteEmailData();
      const result = getBatchCompleteEmail(data);

      expect(result.text).toContain('ADAShield');
      expect(result.text).toContain('GDPR');
    });
  });

  describe('edge cases', () => {
    it('should handle all zero counts', () => {
      const data = createBatchCompleteEmailData({
        totalUrls: 0,
        completedCount: 0,
        failedCount: 0,
        totalIssues: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        passedChecks: 0,
        topCriticalUrls: [],
      });
      const result = getBatchCompleteEmail(data);

      expect(result.subject).toContain('0 URLs');
      expect(result.subject).toContain('0 issues');
      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
    });

    it('should handle very large numbers', () => {
      const data = createBatchCompleteEmailData({
        totalUrls: 1000000,
        totalIssues: 5000000,
        passedChecks: 10000000,
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('1000000');
      expect(result.html).toContain('5000000');
      expect(result.html).toContain('10000000');
    });

    it('should handle special characters in homepage URL', () => {
      const data = createBatchCompleteEmailData({
        homepageUrl: 'https://example.com/path?query=value&foo=bar',
      });
      const result = getBatchCompleteEmail(data);

      // Ampersand should be escaped
      expect(result.html).toContain('&amp;');
    });

    it('should handle unicode in URLs', () => {
      const data = createBatchCompleteEmailData({
        homepageUrl: 'https://example.com/path/\u00e9\u00e8\u00ea',
      });
      const result = getBatchCompleteEmail(data);

      expect(result.html).toContain('https://example.com/path/');
    });
  });
});

describe('getScanCompleteEmail', () => {
  describe('return structure', () => {
    it('should return valid EmailContent structure', () => {
      const data = createScanCompleteEmailData();
      const result = getScanCompleteEmail(data);

      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
    });
  });

  describe('subject line', () => {
    it('should include issue count', () => {
      const data = createScanCompleteEmailData({ issueCount: 23 });
      const result = getScanCompleteEmail(data);

      expect(result.subject).toContain('23');
    });

    it('should use singular form for 1 issue', () => {
      const data = createScanCompleteEmailData({ issueCount: 1 });
      const result = getScanCompleteEmail(data);

      expect(result.subject).toMatch(/1 issue[^s]/);
    });

    it('should use plural form for multiple issues', () => {
      const data = createScanCompleteEmailData({ issueCount: 5 });
      const result = getScanCompleteEmail(data);

      expect(result.subject).toContain('issues');
    });
  });

  describe('HTML content', () => {
    it('should include scanned URL', () => {
      const data = createScanCompleteEmailData({
        url: 'https://test-website.com',
      });
      const result = getScanCompleteEmail(data);

      expect(result.html).toContain('https://test-website.com');
    });

    it('should escape HTML in URL', () => {
      const data = createScanCompleteEmailData({
        url: 'https://example.com?q=<script>',
      });
      const result = getScanCompleteEmail(data);

      expect(result.html).toContain('&lt;script&gt;');
    });

    it('should include issue counts', () => {
      const data = createScanCompleteEmailData({
        issueCount: 15,
        criticalCount: 2,
        seriousCount: 5,
      });
      const result = getScanCompleteEmail(data);

      expect(result.html).toContain('15');
      expect(result.html).toContain('2');
      expect(result.html).toContain('5');
    });

    it('should include results URL', () => {
      const data = createScanCompleteEmailData({
        resultsUrl: 'https://app.adashield.com/scan/abc',
      });
      const result = getScanCompleteEmail(data);

      expect(result.html).toContain('https://app.adashield.com/scan/abc');
    });
  });

  describe('plain text content', () => {
    it('should include scanned URL', () => {
      const data = createScanCompleteEmailData({
        url: 'https://test-website.com',
      });
      const result = getScanCompleteEmail(data);

      expect(result.text).toContain('https://test-website.com');
    });

    it('should include results URL', () => {
      const data = createScanCompleteEmailData({
        resultsUrl: 'https://app.adashield.com/scan/abc',
      });
      const result = getScanCompleteEmail(data);

      expect(result.text).toContain('https://app.adashield.com/scan/abc');
    });
  });
});

describe('getScanFailedEmail', () => {
  describe('return structure', () => {
    it('should return valid EmailContent structure', () => {
      const data = createScanFailedEmailData();
      const result = getScanFailedEmail(data);

      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('text');
    });
  });

  describe('subject line', () => {
    it('should indicate scan failure', () => {
      const data = createScanFailedEmailData();
      const result = getScanFailedEmail(data);

      expect(result.subject.toLowerCase()).toContain('failed');
    });
  });

  describe('HTML content', () => {
    it('should include failed URL', () => {
      const data = createScanFailedEmailData({
        url: 'https://failed-site.com',
      });
      const result = getScanFailedEmail(data);

      expect(result.html).toContain('https://failed-site.com');
    });

    it('should include error message', () => {
      const data = createScanFailedEmailData({
        error: 'Connection refused by server',
      });
      const result = getScanFailedEmail(data);

      expect(result.html).toContain('Connection refused by server');
    });

    it('should escape HTML in URL', () => {
      const data = createScanFailedEmailData({
        url: 'https://example.com?q=<script>',
      });
      const result = getScanFailedEmail(data);

      expect(result.html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in error message', () => {
      const data = createScanFailedEmailData({
        error: '<div>Error</div>',
      });
      const result = getScanFailedEmail(data);

      expect(result.html).toContain('&lt;div&gt;');
    });
  });

  describe('plain text content', () => {
    it('should include failed URL', () => {
      const data = createScanFailedEmailData({
        url: 'https://failed-site.com',
      });
      const result = getScanFailedEmail(data);

      expect(result.text).toContain('https://failed-site.com');
    });

    it('should include error message', () => {
      const data = createScanFailedEmailData({
        error: 'Network timeout',
      });
      const result = getScanFailedEmail(data);

      expect(result.text).toContain('Network timeout');
    });

    it('should include troubleshooting steps', () => {
      const data = createScanFailedEmailData();
      const result = getScanFailedEmail(data);

      expect(result.text).toContain('What You Can Do');
    });
  });
});
