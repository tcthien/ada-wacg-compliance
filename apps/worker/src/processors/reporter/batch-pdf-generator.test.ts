/**
 * Batch PDF Generator Tests
 *
 * Tests for batch PDF report generation with per-URL breakdown and sanitization.
 */

import { describe, it, expect } from 'vitest';
import type { BatchPdfInput, UrlBreakdown } from './batch-pdf-generator.js';
import { generateBatchPdfReport } from './batch-pdf-generator.js';
import type { WcagLevel } from '@prisma/client';

describe('Batch PDF Generator', () => {
  describe('generateBatchPdfReport', () => {
    it('should generate PDF with cover page and executive summary only', async () => {
      const input: BatchPdfInput = {
        metadata: {
          batchId: 'batch-test-123',
          homepageUrl: 'https://example.com',
          totalUrls: 3,
          completedCount: 3,
          failedCount: 0,
          wcagLevel: 'AA' as WcagLevel,
          createdAt: new Date('2025-01-01'),
          completedAt: new Date('2025-01-01'),
          status: 'COMPLETED',
        },
        aggregate: {
          totalIssues: 15,
          criticalCount: 2,
          seriousCount: 5,
          moderateCount: 6,
          minorCount: 2,
          passedChecks: 45,
          urlsScanned: 3,
        },
        topCriticalUrls: [
          {
            url: 'https://example.com/page1',
            pageTitle: 'Page 1',
            criticalCount: 2,
          },
        ],
      };

      const buffer = await generateBatchPdfReport(input);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF magic number
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should generate PDF with per-URL breakdown and detailed issues', async () => {
      const urlBreakdowns: UrlBreakdown[] = [
        {
          url: 'https://example.com/page1',
          pageTitle: 'Test Page 1',
          summary: {
            totalIssues: 5,
            critical: 1,
            serious: 2,
            moderate: 1,
            minor: 1,
            passed: 15,
          },
          issuesByImpact: {
            critical: [
              {
                id: 'issue-1',
                ruleId: 'color-contrast',
                wcagCriteria: ['1.4.3'],
                impact: 'critical',
                description: 'Text has insufficient color contrast',
                helpText: 'Ensure text has sufficient contrast ratio',
                helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/color-contrast',
                htmlSnippet: '<p style="color: #777;">Low contrast text</p>',
                cssSelector: 'p',
                nodes: [],
              },
            ],
            serious: [
              {
                id: 'issue-2',
                ruleId: 'image-alt',
                wcagCriteria: ['1.1.1'],
                impact: 'serious',
                description: 'Image missing alt text',
                helpText: 'All images must have alt attributes',
                helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/image-alt',
                htmlSnippet: '<img src="photo.jpg">',
                cssSelector: 'img',
                nodes: [],
              },
            ],
            moderate: [],
            minor: [],
          },
        },
        {
          url: 'https://example.com/page2',
          pageTitle: 'Test Page 2',
          summary: {
            totalIssues: 3,
            critical: 0,
            serious: 1,
            moderate: 2,
            minor: 0,
            passed: 20,
          },
          issuesByImpact: {
            critical: [],
            serious: [
              {
                id: 'issue-3',
                ruleId: 'button-name',
                wcagCriteria: ['4.1.2'],
                impact: 'serious',
                description: 'Button has no accessible name',
                helpText: 'Buttons must have accessible text',
                helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/button-name',
                htmlSnippet: '<button><i class="icon"></i></button>',
                cssSelector: 'button',
                nodes: [],
              },
            ],
            moderate: [],
            minor: [],
          },
        },
      ];

      const input: BatchPdfInput = {
        metadata: {
          batchId: 'batch-test-456',
          homepageUrl: 'https://example.com',
          totalUrls: 2,
          completedCount: 2,
          failedCount: 0,
          wcagLevel: 'AA' as WcagLevel,
          createdAt: new Date('2025-01-01'),
          completedAt: new Date('2025-01-01'),
          status: 'COMPLETED',
        },
        aggregate: {
          totalIssues: 8,
          criticalCount: 1,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 1,
          passedChecks: 35,
          urlsScanned: 2,
        },
        topCriticalUrls: [
          {
            url: 'https://example.com/page1',
            pageTitle: 'Test Page 1',
            criticalCount: 1,
          },
        ],
        urlBreakdowns,
      };

      const buffer = await generateBatchPdfReport(input);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF magic number
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');

      // Verify PDF is larger than cover page + executive summary only
      // (indicates additional pages were added)
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('should sanitize dangerous HTML content', async () => {
      const urlBreakdowns: UrlBreakdown[] = [
        {
          url: 'javascript:alert("xss")', // Malicious URL
          pageTitle: '<script>alert("xss")</script>Test Title',
          summary: {
            totalIssues: 1,
            critical: 1,
            serious: 0,
            moderate: 0,
            minor: 0,
            passed: 10,
          },
          issuesByImpact: {
            critical: [
              {
                id: 'issue-1',
                ruleId: 'test-rule',
                wcagCriteria: ['1.1.1'],
                impact: 'critical',
                description: '<script>alert("xss")</script>Malicious description',
                helpText: 'Fix this <script>alert("xss")</script>',
                helpUrl: 'javascript:alert("xss")',
                htmlSnippet: '<script>alert("xss")</script><button onclick="hack()">Click</button>',
                cssSelector: 'button',
                nodes: [],
              },
            ],
            serious: [],
            moderate: [],
            minor: [],
          },
        },
      ];

      const input: BatchPdfInput = {
        metadata: {
          batchId: 'batch-test-sanitize',
          homepageUrl: 'https://example.com',
          totalUrls: 1,
          completedCount: 1,
          failedCount: 0,
          wcagLevel: 'AA' as WcagLevel,
          createdAt: new Date('2025-01-01'),
          completedAt: new Date('2025-01-01'),
          status: 'COMPLETED',
        },
        aggregate: {
          totalIssues: 1,
          criticalCount: 1,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 10,
          urlsScanned: 1,
        },
        topCriticalUrls: [],
        urlBreakdowns,
      };

      const buffer = await generateBatchPdfReport(input);

      expect(buffer).toBeInstanceOf(Buffer);

      // PDF should not contain dangerous content
      const pdfContent = buffer.toString('utf8');
      expect(pdfContent).not.toContain('javascript:alert');
      expect(pdfContent).not.toContain('<script>');
      expect(pdfContent).not.toContain('onclick=');

      // Should contain blocked: prefix for dangerous URLs
      expect(pdfContent).toContain('blocked:');
    });
  });
});
