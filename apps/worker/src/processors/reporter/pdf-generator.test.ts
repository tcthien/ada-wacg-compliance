/**
 * PDF Generator Tests
 *
 * Tests for PDF report generation functionality.
 * Verifies report structure, content, and S3 upload stub.
 */

import { describe, it, expect, vi } from 'vitest';
import { generatePdfReport, uploadToS3, generateAndUploadReport } from './pdf-generator.js';
import type { FormattedResult, EnrichedIssue } from '@adashield/core/types';

/**
 * Create a mock FormattedResult for testing
 */
function createMockResult(overrides: Partial<FormattedResult> = {}): FormattedResult {
  const baseResult: FormattedResult = {
    scanId: 'test-scan-123',
    url: 'https://example.com',
    wcagLevel: 'AA',
    completedAt: new Date('2024-12-26T10:00:00Z'),
    summary: {
      totalIssues: 0,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      passed: 0,
    },
    issuesByImpact: {
      critical: [],
      serious: [],
      moderate: [],
      minor: [],
    },
    metadata: {
      coverageNote:
        'Automated testing detects approximately 57% of WCAG issues. Manual testing is recommended for complete compliance.',
      wcagVersion: '2.1',
      toolVersion: '1.0.0',
      scanDuration: 2500,
      inapplicableChecks: 10,
    },
  };

  return { ...baseResult, ...overrides };
}

/**
 * Create a mock enriched issue for testing
 */
function createMockIssue(overrides: Partial<EnrichedIssue> = {}): EnrichedIssue {
  const baseIssue: EnrichedIssue = {
    id: 'issue-1',
    scanResultId: 'result-1',
    ruleId: 'color-contrast',
    wcagCriteria: ['1.4.3'],
    impact: 'SERIOUS',
    description: 'Elements must have sufficient color contrast',
    helpText: 'Ensure the contrast ratio is at least 4.5:1',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
    htmlSnippet: '<p class="text-gray">Low contrast text</p>',
    cssSelector: '.text-gray',
    nodes: [],
    createdAt: new Date('2024-12-26T10:00:00Z'),
    fixGuide: {
      ruleId: 'color-contrast',
      summary:
        'Text must have sufficient color contrast against its background (minimum 4.5:1 for normal text, 3:1 for large text)',
      codeExample: {
        before: '<p style="color: #777; background: #fff;">Low contrast text</p>',
        after: '<p style="color: #595959; background: #fff;">Good contrast text (4.54:1)</p>',
      },
      steps: [
        'Use a color contrast checker tool to verify the current contrast ratio',
        'For normal text (< 18pt or < 14pt bold), ensure a contrast ratio of at least 4.5:1',
        'For large text (≥ 18pt or ≥ 14pt bold), ensure a contrast ratio of at least 3:1',
        'Adjust the foreground or background color until the minimum ratio is met',
        'Test with actual users who have low vision or color blindness',
      ],
      wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
    },
  };

  return { ...baseIssue, ...overrides };
}

describe('PDF Generator', () => {
  describe('generatePdfReport', () => {
    it('should generate a PDF buffer with no issues', async () => {
      const result = createMockResult({
        summary: {
          totalIssues: 0,
          critical: 0,
          serious: 0,
          moderate: 0,
          minor: 0,
          passed: 25,
        },
      });

      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify it's a PDF (starts with %PDF)
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should generate a PDF buffer with 1 critical issue', async () => {
      const issue = createMockIssue({
        id: 'issue-1',
        impact: 'CRITICAL',
        ruleId: 'image-alt',
        description: 'Images must have alternate text',
      });

      const result = createMockResult({
        summary: {
          totalIssues: 1,
          critical: 1,
          serious: 0,
          moderate: 0,
          minor: 0,
          passed: 24,
        },
        issuesByImpact: {
          critical: [issue],
          serious: [],
          moderate: [],
          minor: [],
        },
      });

      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');

      // PDF should be larger with issues than without
      expect(buffer.length).toBeGreaterThan(3000);
    });

    it('should generate a PDF buffer with 100 issues', async () => {
      const issues: EnrichedIssue[] = Array.from({ length: 100 }, (_, i) =>
        createMockIssue({
          id: `issue-${i}`,
          ruleId: `rule-${i % 10}`,
          impact: (['CRITICAL', 'SERIOUS', 'MODERATE', 'MINOR'] as const)[i % 4],
          description: `Issue description ${i}`,
        })
      );

      const result = createMockResult({
        summary: {
          totalIssues: 100,
          critical: 25,
          serious: 25,
          moderate: 25,
          minor: 25,
          passed: 5,
        },
        issuesByImpact: {
          critical: issues.filter((i) => i.impact === 'CRITICAL'),
          serious: issues.filter((i) => i.impact === 'SERIOUS'),
          moderate: issues.filter((i) => i.impact === 'MODERATE'),
          minor: issues.filter((i) => i.impact === 'MINOR'),
        },
      });

      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should include scan information in the PDF', async () => {
      const result = createMockResult({
        scanId: 'test-scan-456',
        url: 'https://test-site.com/page',
        wcagLevel: 'AAA',
      });

      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(3000);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should include coverage disclaimer in the PDF', async () => {
      const result = createMockResult();
      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(3000);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should include fix guide information when available', async () => {
      const issue = createMockIssue({
        ruleId: 'color-contrast',
        fixGuide: {
          ruleId: 'color-contrast',
          summary: 'Ensure sufficient contrast ratio',
          codeExample: {
            before: '<p style="color: #777;">Bad</p>',
            after: '<p style="color: #333;">Good</p>',
          },
          steps: ['Step 1', 'Step 2', 'Step 3'],
          wcagLink: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
        },
      });

      const result = createMockResult({
        summary: {
          totalIssues: 1,
          critical: 0,
          serious: 1,
          moderate: 0,
          minor: 0,
          passed: 24,
        },
        issuesByImpact: {
          critical: [],
          serious: [issue],
          moderate: [],
          minor: [],
        },
      });

      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(4000); // Should be larger with fix guide
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should handle issues without fix guides', async () => {
      const issue = createMockIssue({
        ruleId: 'custom-rule',
        fixGuide: undefined,
        helpText: 'Custom help text for this issue',
      });

      const result = createMockResult({
        summary: {
          totalIssues: 1,
          critical: 0,
          serious: 0,
          moderate: 1,
          minor: 0,
          passed: 24,
        },
        issuesByImpact: {
          critical: [],
          serious: [],
          moderate: [issue],
          minor: [],
        },
      });

      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(3000);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should include WCAG criteria information', async () => {
      const issue = createMockIssue({
        wcagCriteria: ['1.4.3', '1.4.6'],
      });

      const result = createMockResult({
        summary: {
          totalIssues: 1,
          critical: 0,
          serious: 1,
          moderate: 0,
          minor: 0,
          passed: 24,
        },
        issuesByImpact: {
          critical: [],
          serious: [issue],
          moderate: [],
          minor: [],
        },
      });

      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(3000);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it('should include branding and footer information', async () => {
      const result = createMockResult();
      const buffer = await generatePdfReport(result);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(3000);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });

  describe('uploadToS3', () => {
    it('should return a presigned URL (stub)', async () => {
      const buffer = Buffer.from('test pdf content');
      const key = 'reports/test-scan-123.pdf';

      const url = await uploadToS3(buffer, key);

      expect(url).toBe('https://s3.example.com/reports/test-scan-123.pdf');
    });

    it('should log the upload intention', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const buffer = Buffer.from('test pdf content');
      const key = 'reports/test-scan-456.pdf';

      await uploadToS3(buffer, key);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would upload')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('reports/test-scan-456.pdf')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('generateAndUploadReport', () => {
    it('should generate PDF and upload to S3', async () => {
      const result = createMockResult({
        scanId: 'test-scan-789',
      });

      const url = await generateAndUploadReport(result, 'test-scan-789');

      expect(url).toBe('https://s3.example.com/reports/test-scan-789.pdf');
    });

    it('should use correct S3 key format', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const result = createMockResult();

      await generateAndUploadReport(result, 'my-scan-id');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('reports/my-scan-id.pdf')
      );

      consoleSpy.mockRestore();
    });
  });
});
