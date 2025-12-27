/**
 * JSON Exporter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateJsonReport,
  exportJsonReport,
  uploadJsonToS3,
  type FormattedResult,
  type JsonReport,
} from './json-exporter.js';
import type { EnrichedIssue } from '../../../../../apps/api/src/modules/results/result.service.js';

/**
 * Create a mock enriched issue for testing
 */
function createMockIssue(overrides: Partial<EnrichedIssue> = {}): EnrichedIssue {
  return {
    id: 'issue-1',
    scanResultId: 'result-1',
    ruleId: 'image-alt',
    wcagCriteria: ['1.1.1'],
    impact: 'CRITICAL',
    description: 'Images must have alternate text',
    helpText: 'Add alt attribute to images',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
    htmlSnippet: '<img src="logo.png">',
    cssSelector: 'img',
    nodes: [],
    createdAt: new Date('2024-01-15T10:00:00Z'),
    fixGuide: {
      summary: 'Add descriptive alt text to images',
      steps: [
        'Identify the purpose of the image',
        'Add alt attribute with descriptive text',
        'Verify alt text is meaningful',
      ],
      codeExample: '<img src="logo.png" alt="Company Logo">',
    },
    ...overrides,
  };
}

/**
 * Create a mock formatted result for testing
 */
function createMockFormattedResult(
  overrides: Partial<FormattedResult> = {}
): FormattedResult {
  const criticalIssue = createMockIssue({ id: 'critical-1', impact: 'CRITICAL' });
  const seriousIssue = createMockIssue({
    id: 'serious-1',
    impact: 'SERIOUS',
    ruleId: 'color-contrast',
  });

  return {
    scanId: 'scan-123',
    url: 'https://example.com',
    wcagLevel: 'AA',
    completedAt: new Date('2024-01-15T10:30:00Z'),
    summary: {
      totalIssues: 2,
      critical: 1,
      serious: 1,
      moderate: 0,
      minor: 0,
      passed: 45,
    },
    issuesByImpact: {
      critical: [criticalIssue],
      serious: [seriousIssue],
      moderate: [],
      minor: [],
    },
    metadata: {
      coverageNote:
        'Automated testing detects approximately 57% of WCAG issues. Manual testing is recommended for complete compliance.',
      wcagVersion: '2.1',
      toolVersion: '1.0.0',
      scanDuration: 1800000, // 30 minutes in ms
      inapplicableChecks: 23,
    },
    ...overrides,
  };
}

describe('generateJsonReport', () => {
  it('should generate valid JSON report structure', () => {
    const result = createMockFormattedResult();
    const report = generateJsonReport(result);

    expect(report).toMatchObject({
      version: '1.0',
      tool: {
        name: 'ADAShield',
        version: '1.0.0',
      },
      scan: {
        id: 'scan-123',
        url: 'https://example.com',
        wcagLevel: 'AA',
      },
    });
  });

  it('should include generated timestamp in ISO 8601 format', () => {
    const result = createMockFormattedResult();
    const report = generateJsonReport(result);

    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
  });

  it('should include scan completedAt timestamp in ISO 8601 format', () => {
    const result = createMockFormattedResult();
    const report = generateJsonReport(result);

    expect(report.scan.completedAt).toBe('2024-01-15T10:30:00.000Z');
    expect(new Date(report.scan.completedAt).toISOString()).toBe(report.scan.completedAt);
  });

  it('should include correct summary statistics', () => {
    const result = createMockFormattedResult();
    const report = generateJsonReport(result);

    expect(report.summary).toEqual({
      totalIssues: 2,
      bySeverity: {
        critical: 1,
        serious: 1,
        moderate: 0,
        minor: 0,
      },
      passed: 45,
    });
  });

  it('should include disclaimer text', () => {
    const result = createMockFormattedResult();
    const report = generateJsonReport(result);

    expect(report.disclaimer).toBe(
      'Automated testing detects approximately 57% of WCAG issues. Manual testing is recommended for complete compliance.'
    );
  });

  it('should flatten issues from all severity levels', () => {
    const result = createMockFormattedResult();
    const report = generateJsonReport(result);

    expect(report.issues).toHaveLength(2);
    expect(report.issues[0]!.id).toBe('critical-1');
    expect(report.issues[1]!.id).toBe('serious-1');
  });

  it('should include all required issue fields', () => {
    const result = createMockFormattedResult();
    const report = generateJsonReport(result);
    const issue = report.issues[0]!;

    expect(issue).toMatchObject({
      id: 'critical-1',
      ruleId: 'image-alt',
      impact: 'CRITICAL',
      description: 'Images must have alternate text',
      help: 'Add alt attribute to images',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
      wcagCriteria: ['1.1.1'],
      element: {
        selector: 'img',
        html: '<img src="logo.png">',
      },
    });
  });

  it('should include fix guide when available', () => {
    const result = createMockFormattedResult();
    const report = generateJsonReport(result);
    const issue = report.issues[0]!;

    expect(issue.fixGuide).toBeDefined();
    expect(issue.fixGuide).toEqual({
      summary: 'Add descriptive alt text to images',
      steps: [
        'Identify the purpose of the image',
        'Add alt attribute with descriptive text',
        'Verify alt text is meaningful',
      ],
      codeExample: '<img src="logo.png" alt="Company Logo">',
    });
  });

  it('should omit fix guide when not available', () => {
    const issueWithoutGuide = createMockIssue({
      id: 'issue-no-guide',
      fixGuide: undefined,
    });

    const result = createMockFormattedResult({
      issuesByImpact: {
        critical: [issueWithoutGuide],
        serious: [],
        moderate: [],
        minor: [],
      },
      summary: {
        totalIssues: 1,
        critical: 1,
        serious: 0,
        moderate: 0,
        minor: 0,
        passed: 45,
      },
    });

    const report = generateJsonReport(result);
    const issue = report.issues[0]!;

    expect(issue.fixGuide).toBeUndefined();
  });

  it('should omit codeExample when not available in fix guide', () => {
    const issueWithoutExample = createMockIssue({
      id: 'issue-no-example',
      fixGuide: {
        summary: 'Fix the issue',
        steps: ['Step 1', 'Step 2'],
        // No codeExample
      },
    });

    const result = createMockFormattedResult({
      issuesByImpact: {
        critical: [issueWithoutExample],
        serious: [],
        moderate: [],
        minor: [],
      },
      summary: {
        totalIssues: 1,
        critical: 1,
        serious: 0,
        moderate: 0,
        minor: 0,
        passed: 45,
      },
    });

    const report = generateJsonReport(result);
    const issue = report.issues[0]!;

    expect(issue.fixGuide).toBeDefined();
    expect(issue.fixGuide!.codeExample).toBeUndefined();
  });

  it('should handle empty issues array', () => {
    const result = createMockFormattedResult({
      issuesByImpact: {
        critical: [],
        serious: [],
        moderate: [],
        minor: [],
      },
      summary: {
        totalIssues: 0,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        passed: 68,
      },
    });

    const report = generateJsonReport(result);

    expect(report.issues).toEqual([]);
    expect(report.summary.totalIssues).toBe(0);
  });

  it('should handle multiple issues across all severity levels', () => {
    const critical1 = createMockIssue({ id: 'crit-1', impact: 'CRITICAL' });
    const critical2 = createMockIssue({ id: 'crit-2', impact: 'CRITICAL' });
    const serious1 = createMockIssue({ id: 'ser-1', impact: 'SERIOUS' });
    const moderate1 = createMockIssue({ id: 'mod-1', impact: 'MODERATE' });
    const minor1 = createMockIssue({ id: 'min-1', impact: 'MINOR' });

    const result = createMockFormattedResult({
      issuesByImpact: {
        critical: [critical1, critical2],
        serious: [serious1],
        moderate: [moderate1],
        minor: [minor1],
      },
      summary: {
        totalIssues: 5,
        critical: 2,
        serious: 1,
        moderate: 1,
        minor: 1,
        passed: 40,
      },
    });

    const report = generateJsonReport(result);

    expect(report.issues).toHaveLength(5);
    expect(report.issues.map((i) => i.id)).toEqual([
      'crit-1',
      'crit-2',
      'ser-1',
      'mod-1',
      'min-1',
    ]);
  });
});

describe('exportJsonReport', () => {
  it('should return buffer and S3 key', async () => {
    const result = createMockFormattedResult();
    const { buffer, key } = await exportJsonReport(result);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(key).toBe('reports/scan-123/report.json');
  });

  it('should generate valid JSON string in buffer', async () => {
    const result = createMockFormattedResult();
    const { buffer } = await exportJsonReport(result);

    const jsonString = buffer.toString('utf-8');
    const parsed: JsonReport = JSON.parse(jsonString);

    expect(parsed.version).toBe('1.0');
    expect(parsed.scan.id).toBe('scan-123');
  });

  it('should pretty-print JSON with 2-space indentation', async () => {
    const result = createMockFormattedResult();
    const { buffer } = await exportJsonReport(result);

    const jsonString = buffer.toString('utf-8');

    // Check for indentation
    expect(jsonString).toContain('  "version": "1.0"');
    expect(jsonString).toContain('  "tool": {');
    expect(jsonString).toContain('    "name": "ADAShield"');
  });

  it('should include scanId in S3 key path', async () => {
    const result = createMockFormattedResult({ scanId: 'custom-scan-456' });
    const { key } = await exportJsonReport(result);

    expect(key).toBe('reports/custom-scan-456/report.json');
  });

  it('should handle different scanIds correctly', async () => {
    const result1 = createMockFormattedResult({ scanId: 'scan-abc' });
    const result2 = createMockFormattedResult({ scanId: 'scan-xyz' });

    const { key: key1 } = await exportJsonReport(result1);
    const { key: key2 } = await exportJsonReport(result2);

    expect(key1).toBe('reports/scan-abc/report.json');
    expect(key2).toBe('reports/scan-xyz/report.json');
  });
});

describe('uploadJsonToS3', () => {
  it('should return presigned URL (stub implementation)', async () => {
    const buffer = Buffer.from('test data');
    const key = 'reports/scan-123/report.json';

    const url = await uploadJsonToS3(buffer, key);

    expect(url).toBe('https://s3.example.com/reports/scan-123/report.json');
  });

  it('should handle different S3 keys', async () => {
    const buffer = Buffer.from('test data');

    const url1 = await uploadJsonToS3(buffer, 'reports/scan-1/report.json');
    const url2 = await uploadJsonToS3(buffer, 'reports/scan-2/report.json');

    expect(url1).toBe('https://s3.example.com/reports/scan-1/report.json');
    expect(url2).toBe('https://s3.example.com/reports/scan-2/report.json');
  });
});
