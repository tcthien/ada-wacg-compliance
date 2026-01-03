/**
 * Batch JSON Exporter Tests
 *
 * Tests for batch JSON report generation functionality.
 * Verifies report structure, content, and sanitization.
 *
 * @requirements 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import {
  generateBatchJsonReport,
  exportBatchJson,
  type BatchJsonInput,
  type BatchJsonReport,
} from './batch-json-exporter.js';

/**
 * Create a mock BatchJsonInput for testing
 */
function createMockBatchInput(overrides: Partial<BatchJsonInput> = {}): BatchJsonInput {
  const baseInput: BatchJsonInput = {
    batchId: 'batch_test_123',
    homepageUrl: 'https://example.com',
    wcagLevel: 'AA',
    totalUrls: 3,
    completedCount: 2,
    failedCount: 1,
    createdAt: new Date('2024-12-26T10:00:00Z'),
    completedAt: new Date('2024-12-26T10:05:00Z'),
    urlResults: [],
  };

  return { ...baseInput, ...overrides };
}

/**
 * Create a mock URL result with issues
 */
function createMockUrlResult(overrides: Partial<BatchJsonInput['urlResults'][0]> = {}): BatchJsonInput['urlResults'][0] {
  const baseResult: BatchJsonInput['urlResults'][0] = {
    scanId: 'scan_test_123',
    url: 'https://example.com/page1',
    pageTitle: 'Test Page',
    status: 'COMPLETED',
    completedAt: new Date('2024-12-26T10:02:00Z'),
    durationMs: 2500,
    result: {
      totalIssues: 0,
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 0,
      minorCount: 0,
      passedChecks: 25,
      issues: [],
    },
  };

  return { ...baseResult, ...overrides };
}

/**
 * Create a mock issue for testing
 */
function createMockIssue(overrides: Partial<NonNullable<BatchJsonInput['urlResults'][0]['result']>['issues'][0]> = {}): NonNullable<BatchJsonInput['urlResults'][0]['result']>['issues'][0] {
  const baseIssue: NonNullable<BatchJsonInput['urlResults'][0]['result']>['issues'][0] = {
    id: 'issue_1',
    ruleId: 'color-contrast',
    impact: 'serious',
    description: 'Elements must have sufficient color contrast',
    helpText: 'Ensure the contrast ratio is at least 4.5:1',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
    wcagCriteria: ['1.4.3'],
    htmlSnippet: '<p class="text-gray">Low contrast text</p>',
    cssSelector: '.text-gray',
  };

  return { ...baseIssue, ...overrides };
}

describe('Batch JSON Exporter', () => {
  describe('generateBatchJsonReport', () => {
    it('should generate a valid JSON report with empty URL results', () => {
      const input = createMockBatchInput();
      const report = generateBatchJsonReport(input);

      // Verify report version
      expect(report.version).toBe('1.0');

      // Verify tool info
      expect(report.tool.name).toBe('ADAShield');
      expect(report.tool.version).toBeDefined();

      // Verify batch info
      expect(report.batch.id).toBe('batch_test_123');
      expect(report.batch.homepageUrl).toBe('https://example.com');
      expect(report.batch.wcagLevel).toBe('AA');
      expect(report.batch.totalUrls).toBe(3);
      expect(report.batch.completedCount).toBe(2);
      expect(report.batch.failedCount).toBe(1);

      // Verify aggregate defaults to zeros
      expect(report.aggregate.totalIssues).toBe(0);
      expect(report.aggregate.bySeverity.critical).toBe(0);
      expect(report.aggregate.passedChecks).toBe(0);

      // Verify disclaimer exists
      expect(report.disclaimer).toContain('automated scan');

      // Verify URLs array
      expect(report.urls).toEqual([]);
    });

    it('should generate report with URL results and issues', () => {
      const issue = createMockIssue({
        id: 'issue_critical_1',
        impact: 'critical',
        ruleId: 'image-alt',
        description: 'Images must have alternate text',
      });

      const urlResult = createMockUrlResult({
        scanId: 'scan_with_issues',
        url: 'https://example.com/page-with-issues',
        pageTitle: 'Page With Issues',
        result: {
          totalIssues: 1,
          criticalCount: 1,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 20,
          issues: [issue],
        },
      });

      const input = createMockBatchInput({
        urlResults: [urlResult],
      });

      const report = generateBatchJsonReport(input);

      // Verify URL results
      expect(report.urls).toHaveLength(1);
      expect(report.urls[0].scanId).toBe('scan_with_issues');
      expect(report.urls[0].url).toBe('https://example.com/page-with-issues');
      expect(report.urls[0].pageTitle).toBe('Page With Issues');
      expect(report.urls[0].status).toBe('COMPLETED');

      // Verify URL summary
      expect(report.urls[0].summary.totalIssues).toBe(1);
      expect(report.urls[0].summary.bySeverity.critical).toBe(1);
      expect(report.urls[0].summary.passed).toBe(20);

      // Verify issues
      expect(report.urls[0].issues).toHaveLength(1);
      expect(report.urls[0].issues[0].id).toBe('issue_critical_1');
      expect(report.urls[0].issues[0].ruleId).toBe('image-alt');
      expect(report.urls[0].issues[0].impact).toBe('critical');
    });

    it('should calculate aggregate statistics from URL results', () => {
      const urlResult1 = createMockUrlResult({
        scanId: 'scan_1',
        result: {
          totalIssues: 3,
          criticalCount: 1,
          seriousCount: 2,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 10,
          issues: [],
        },
      });

      const urlResult2 = createMockUrlResult({
        scanId: 'scan_2',
        result: {
          totalIssues: 5,
          criticalCount: 0,
          seriousCount: 1,
          moderateCount: 3,
          minorCount: 1,
          passedChecks: 15,
          issues: [],
        },
      });

      const input = createMockBatchInput({
        urlResults: [urlResult1, urlResult2],
      });

      const report = generateBatchJsonReport(input);

      // Verify aggregated totals
      expect(report.aggregate.totalIssues).toBe(8); // 3 + 5
      expect(report.aggregate.bySeverity.critical).toBe(1); // 1 + 0
      expect(report.aggregate.bySeverity.serious).toBe(3); // 2 + 1
      expect(report.aggregate.bySeverity.moderate).toBe(3); // 0 + 3
      expect(report.aggregate.bySeverity.minor).toBe(1); // 0 + 1
      expect(report.aggregate.passedChecks).toBe(25); // 10 + 15
    });

    it('should use pre-computed aggregate stats when provided', () => {
      const urlResult = createMockUrlResult({
        result: {
          totalIssues: 5,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 10,
          issues: [],
        },
      });

      const input = createMockBatchInput({
        aggregateStats: {
          totalIssues: 100,
          criticalCount: 50,
          seriousCount: 30,
          moderateCount: 15,
          minorCount: 5,
        },
        urlResults: [urlResult],
      });

      const report = generateBatchJsonReport(input);

      // Should use provided stats (not calculated from URL results)
      expect(report.aggregate.totalIssues).toBe(100);
      expect(report.aggregate.bySeverity.critical).toBe(50);
      expect(report.aggregate.bySeverity.serious).toBe(30);
      expect(report.aggregate.bySeverity.moderate).toBe(15);
      expect(report.aggregate.bySeverity.minor).toBe(5);

      // passedChecks should still be calculated from URL results
      expect(report.aggregate.passedChecks).toBe(10);
    });

    it('should handle null pageTitle', () => {
      const urlResult = createMockUrlResult({
        pageTitle: null,
      });

      const input = createMockBatchInput({
        urlResults: [urlResult],
      });

      const report = generateBatchJsonReport(input);

      expect(report.urls[0].pageTitle).toBeNull();
    });

    it('should handle failed scans without results', () => {
      const urlResult = createMockUrlResult({
        status: 'FAILED',
        result: undefined,
      });

      const input = createMockBatchInput({
        urlResults: [urlResult],
      });

      const report = generateBatchJsonReport(input);

      expect(report.urls[0].status).toBe('FAILED');
      expect(report.urls[0].summary.totalIssues).toBe(0);
      expect(report.urls[0].issues).toEqual([]);
    });

    it('should sanitize HTML content with control characters', () => {
      const issue = createMockIssue({
        htmlSnippet: '<p>Test\x00\x0Bwith\x1Fcontrol\x7Fchars</p>',
        description: 'Description\x00with\x01control chars',
      });

      const urlResult = createMockUrlResult({
        pageTitle: 'Title\x00With\x1FControl',
        result: {
          totalIssues: 1,
          criticalCount: 0,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 0,
          issues: [issue],
        },
      });

      const input = createMockBatchInput({
        urlResults: [urlResult],
      });

      const report = generateBatchJsonReport(input);

      // Verify control characters are removed
      expect(report.urls[0].pageTitle).toBe('TitleWithControl');
      expect(report.urls[0].issues[0].element.html).toBe('<p>Testwithcontrolchars</p>');
      expect(report.urls[0].issues[0].description).toBe('Descriptionwithcontrol chars');
    });

    it('should preserve newlines and tabs in sanitized content', () => {
      const issue = createMockIssue({
        htmlSnippet: '<p>\n\tindented text\n</p>',
      });

      const urlResult = createMockUrlResult({
        result: {
          totalIssues: 1,
          criticalCount: 0,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 0,
          issues: [issue],
        },
      });

      const input = createMockBatchInput({
        urlResults: [urlResult],
      });

      const report = generateBatchJsonReport(input);

      // Verify newlines and tabs are preserved
      expect(report.urls[0].issues[0].element.html).toContain('\n');
      expect(report.urls[0].issues[0].element.html).toContain('\t');
    });

    it('should include fix guide when present', () => {
      const issue = createMockIssue({
        fixGuide: {
          summary: 'Fix the color contrast',
          steps: ['Step 1', 'Step 2'],
          codeExample: {
            before: '<p style="color: #999">Bad</p>',
            after: '<p style="color: #333">Good</p>',
          },
        },
      });

      const urlResult = createMockUrlResult({
        result: {
          totalIssues: 1,
          criticalCount: 0,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 0,
          issues: [issue],
        },
      });

      const input = createMockBatchInput({
        urlResults: [urlResult],
      });

      const report = generateBatchJsonReport(input);

      expect(report.urls[0].issues[0].fixGuide).toBeDefined();
      expect(report.urls[0].issues[0].fixGuide?.summary).toBe('Fix the color contrast');
      expect(report.urls[0].issues[0].fixGuide?.steps).toEqual(['Step 1', 'Step 2']);
      expect(report.urls[0].issues[0].fixGuide?.codeExample?.before).toBe('<p style="color: #999">Bad</p>');
      expect(report.urls[0].issues[0].fixGuide?.codeExample?.after).toBe('<p style="color: #333">Good</p>');
    });

    it('should generate valid ISO 8601 timestamps', () => {
      const input = createMockBatchInput();
      const report = generateBatchJsonReport(input);

      // Verify generatedAt is valid ISO 8601
      expect(() => new Date(report.generatedAt)).not.toThrow();
      expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);

      // Verify batch timestamps
      expect(() => new Date(report.batch.createdAt)).not.toThrow();
      expect(() => new Date(report.batch.completedAt)).not.toThrow();
    });
  });

  describe('exportBatchJson', () => {
    it('should generate buffer and S3 key', async () => {
      const input = createMockBatchInput();
      const { buffer, key } = await exportBatchJson(input);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify JSON is valid
      const parsed = JSON.parse(buffer.toString('utf-8'));
      expect(parsed.version).toBe('1.0');

      // Verify S3 key format
      expect(key).toBe('reports/batch-batch_test_123/report.json');
    });

    it('should generate pretty-printed JSON', async () => {
      const input = createMockBatchInput();
      const { buffer } = await exportBatchJson(input);

      const content = buffer.toString('utf-8');

      // Pretty-printed JSON should have newlines
      expect(content).toContain('\n');

      // Should have 2-space indentation
      expect(content).toContain('  "version"');
    });

    it('should generate valid JSON structure matching specification', async () => {
      const issue = createMockIssue();
      const urlResult = createMockUrlResult({
        result: {
          totalIssues: 1,
          criticalCount: 0,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 10,
          issues: [issue],
        },
      });

      const input = createMockBatchInput({
        urlResults: [urlResult],
      });

      const { buffer } = await exportBatchJson(input);
      const report: BatchJsonReport = JSON.parse(buffer.toString('utf-8'));

      // Verify all required top-level properties exist
      expect(report).toHaveProperty('version');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('tool');
      expect(report).toHaveProperty('batch');
      expect(report).toHaveProperty('aggregate');
      expect(report).toHaveProperty('disclaimer');
      expect(report).toHaveProperty('urls');

      // Verify tool structure
      expect(report.tool).toHaveProperty('name');
      expect(report.tool).toHaveProperty('version');

      // Verify batch structure
      expect(report.batch).toHaveProperty('id');
      expect(report.batch).toHaveProperty('homepageUrl');
      expect(report.batch).toHaveProperty('wcagLevel');
      expect(report.batch).toHaveProperty('totalUrls');
      expect(report.batch).toHaveProperty('completedCount');
      expect(report.batch).toHaveProperty('failedCount');
      expect(report.batch).toHaveProperty('createdAt');
      expect(report.batch).toHaveProperty('completedAt');

      // Verify aggregate structure
      expect(report.aggregate).toHaveProperty('totalIssues');
      expect(report.aggregate).toHaveProperty('bySeverity');
      expect(report.aggregate.bySeverity).toHaveProperty('critical');
      expect(report.aggregate.bySeverity).toHaveProperty('serious');
      expect(report.aggregate.bySeverity).toHaveProperty('moderate');
      expect(report.aggregate.bySeverity).toHaveProperty('minor');
      expect(report.aggregate).toHaveProperty('passedChecks');

      // Verify URL result structure
      expect(report.urls[0]).toHaveProperty('scanId');
      expect(report.urls[0]).toHaveProperty('url');
      expect(report.urls[0]).toHaveProperty('pageTitle');
      expect(report.urls[0]).toHaveProperty('status');
      expect(report.urls[0]).toHaveProperty('summary');
      expect(report.urls[0]).toHaveProperty('issues');

      // Verify issue structure
      expect(report.urls[0].issues[0]).toHaveProperty('id');
      expect(report.urls[0].issues[0]).toHaveProperty('ruleId');
      expect(report.urls[0].issues[0]).toHaveProperty('impact');
      expect(report.urls[0].issues[0]).toHaveProperty('description');
      expect(report.urls[0].issues[0]).toHaveProperty('help');
      expect(report.urls[0].issues[0]).toHaveProperty('helpUrl');
      expect(report.urls[0].issues[0]).toHaveProperty('wcagCriteria');
      expect(report.urls[0].issues[0]).toHaveProperty('element');
      expect(report.urls[0].issues[0].element).toHaveProperty('selector');
      expect(report.urls[0].issues[0].element).toHaveProperty('html');
    });
  });
});
