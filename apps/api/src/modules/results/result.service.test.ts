/**
 * Result Service Tests
 *
 * Comprehensive test suite for result formatting and enrichment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatResult,
  getFormattedResult,
  ResultServiceError,
  type FormattedResult,
} from './result.service.js';
import type { ScanWithResult } from '../scans/scan.repository.js';
import type { Issue } from '@adashield/core/types';

// Mock the scan repository
vi.mock('../scans/scan.repository.js', () => ({
  getScanById: vi.fn(),
}));

// Import mocked function
import { getScanById } from '../scans/scan.repository.js';

/**
 * Helper to create mock issue data
 */
function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    scanResultId: 'result-1',
    ruleId: 'color-contrast',
    wcagCriteria: ['1.4.3'],
    impact: 'SERIOUS',
    description: 'Element has insufficient color contrast',
    helpText: 'Ensure text has sufficient contrast',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
    htmlSnippet: '<p style="color: #777;">Text</p>',
    cssSelector: 'p',
    nodes: [
      {
        html: '<p style="color: #777;">Text</p>',
        target: ['p'],
        failureSummary: 'Fix contrast ratio',
      },
    ],
    createdAt: new Date('2024-01-01T10:00:00Z'),
    ...overrides,
  };
}

/**
 * Helper to create mock scan with result
 */
function createMockScan(overrides: Partial<ScanWithResult> = {}): ScanWithResult {
  const createdAt = new Date('2024-01-01T10:00:00Z');
  const completedAt = new Date('2024-01-01T10:05:00Z');

  return {
    id: 'scan-123',
    guestSessionId: 'session-1',
    userId: null,
    url: 'https://example.com',
    email: 'test@example.com',
    status: 'COMPLETED',
    wcagLevel: 'AA',
    durationMs: 5000,
    errorMessage: null,
    createdAt,
    completedAt,
    scanResult: {
      id: 'result-1',
      scanId: 'scan-123',
      totalIssues: 4,
      criticalCount: 1,
      seriousCount: 2,
      moderateCount: 1,
      minorCount: 0,
      passedChecks: 10,
      inapplicableChecks: 5,
      createdAt: new Date('2024-01-01T10:05:00Z'),
      issues: [
        createMockIssue({
          id: 'issue-1',
          ruleId: 'color-contrast',
          impact: 'SERIOUS',
        }),
        createMockIssue({
          id: 'issue-2',
          ruleId: 'image-alt',
          impact: 'CRITICAL',
        }),
        createMockIssue({
          id: 'issue-3',
          ruleId: 'link-name',
          impact: 'SERIOUS',
        }),
        createMockIssue({
          id: 'issue-4',
          ruleId: 'heading-order',
          impact: 'MODERATE',
        }),
      ],
    },
    ...overrides,
  };
}

describe('ResultService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatResult', () => {
    it('should format scan result with enriched issues', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      expect(result).toBeDefined();
      expect(result.scanId).toBe('scan-123');
      expect(result.url).toBe('https://example.com');
      expect(result.wcagLevel).toBe('AA');
      expect(result.completedAt).toEqual(new Date('2024-01-01T10:05:00Z'));
    });

    it('should calculate summary statistics correctly', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      expect(result.summary).toEqual({
        totalIssues: 4,
        critical: 1,
        serious: 2,
        moderate: 1,
        minor: 0,
        passed: 10,
      });
    });

    it('should group issues by severity impact', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      expect(result.issuesByImpact.critical).toHaveLength(1);
      expect(result.issuesByImpact.serious).toHaveLength(2);
      expect(result.issuesByImpact.moderate).toHaveLength(1);
      expect(result.issuesByImpact.minor).toHaveLength(0);

      // Verify critical issue
      expect(result.issuesByImpact.critical[0]?.ruleId).toBe('image-alt');

      // Verify serious issues
      expect(result.issuesByImpact.serious[0]?.ruleId).toBe('color-contrast');
      expect(result.issuesByImpact.serious[1]?.ruleId).toBe('link-name');

      // Verify moderate issue
      expect(result.issuesByImpact.moderate[0]?.ruleId).toBe('heading-order');
    });

    it('should attach fix guides to issues with available guides', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      // All test issues use rules with fix guides
      const allIssues = [
        ...result.issuesByImpact.critical,
        ...result.issuesByImpact.serious,
        ...result.issuesByImpact.moderate,
        ...result.issuesByImpact.minor,
      ];

      for (const issue of allIssues) {
        expect(issue.fixGuide).toBeDefined();
        expect(issue.fixGuide?.ruleId).toBe(issue.ruleId);
        expect(issue.fixGuide?.summary).toBeDefined();
        expect(issue.fixGuide?.steps).toBeDefined();
        expect(issue.fixGuide?.codeExample).toBeDefined();
        expect(issue.fixGuide?.wcagLink).toBeDefined();
      }
    });

    it('should handle issues without fix guides gracefully', () => {
      const scan = createMockScan({
        scanResult: {
          id: 'result-1',
          scanId: 'scan-123',
          totalIssues: 1,
          criticalCount: 1,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 0,
          inapplicableChecks: 0,
          createdAt: new Date('2024-01-01T10:05:00Z'),
          issues: [
            createMockIssue({
              id: 'issue-1',
              ruleId: 'unknown-rule', // Rule without fix guide
              impact: 'CRITICAL',
            }),
          ],
        },
      });

      const result = formatResult(scan);

      expect(result.issuesByImpact.critical).toHaveLength(1);
      expect(result.issuesByImpact.critical[0]?.fixGuide).toBeUndefined();
    });

    it('should include coverage note in metadata', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      expect(result.metadata.coverageNote).toBe(
        'Automated testing detects approximately 57% of WCAG issues. Manual testing is recommended for complete compliance.'
      );
    });

    it('should include WCAG version in metadata', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      expect(result.metadata.wcagVersion).toBe('2.1');
    });

    it('should include tool version in metadata', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      expect(result.metadata.toolVersion).toBe('1.0.0');
    });

    it('should use durationMs from scan if available', () => {
      const scan = createMockScan({ durationMs: 5000 });
      const result = formatResult(scan);

      expect(result.metadata.scanDuration).toBe(5000);
    });

    it('should calculate duration from timestamps if durationMs is null', () => {
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const completedAt = new Date('2024-01-01T10:05:00Z');
      const scan = createMockScan({
        createdAt,
        completedAt,
        durationMs: null,
      });

      const result = formatResult(scan);

      // 5 minutes = 300,000 milliseconds
      expect(result.metadata.scanDuration).toBe(300000);
    });

    it('should include inapplicable checks in metadata', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      expect(result.metadata.inapplicableChecks).toBe(5);
    });

    it('should throw error if scan status is not COMPLETED', () => {
      const scan = createMockScan({ status: 'RUNNING' });

      expect(() => formatResult(scan)).toThrow(ResultServiceError);
      expect(() => formatResult(scan)).toThrow('scan status is RUNNING');
    });

    it('should throw error if scan result data is missing', () => {
      const scan = createMockScan({ scanResult: null });

      expect(() => formatResult(scan)).toThrow(ResultServiceError);
      expect(() => formatResult(scan)).toThrow('scan result data is missing');
    });

    it('should throw error if completedAt timestamp is missing', () => {
      const scan = createMockScan({ completedAt: null });

      expect(() => formatResult(scan)).toThrow(ResultServiceError);
      expect(() => formatResult(scan)).toThrow('completedAt timestamp is missing');
    });

    it('should handle empty issues array', () => {
      const scan = createMockScan({
        scanResult: {
          id: 'result-1',
          scanId: 'scan-123',
          totalIssues: 0,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 50,
          inapplicableChecks: 10,
          createdAt: new Date('2024-01-01T10:05:00Z'),
          issues: [],
        },
      });

      const result = formatResult(scan);

      expect(result.summary.totalIssues).toBe(0);
      expect(result.issuesByImpact.critical).toHaveLength(0);
      expect(result.issuesByImpact.serious).toHaveLength(0);
      expect(result.issuesByImpact.moderate).toHaveLength(0);
      expect(result.issuesByImpact.minor).toHaveLength(0);
    });

    it('should handle all WCAG levels', () => {
      const levels = ['A', 'AA', 'AAA'] as const;

      for (const level of levels) {
        const scan = createMockScan({ wcagLevel: level });
        const result = formatResult(scan);

        expect(result.wcagLevel).toBe(level);
      }
    });

    it('should preserve all issue data during enrichment', () => {
      const scan = createMockScan();
      const result = formatResult(scan);

      const firstIssue = result.issuesByImpact.serious[0];
      expect(firstIssue).toBeDefined();

      // Verify all original issue fields are preserved
      expect(firstIssue?.id).toBe('issue-1');
      expect(firstIssue?.scanResultId).toBe('result-1');
      expect(firstIssue?.ruleId).toBe('color-contrast');
      expect(firstIssue?.wcagCriteria).toEqual(['1.4.3']);
      expect(firstIssue?.impact).toBe('SERIOUS');
      expect(firstIssue?.description).toBe('Element has insufficient color contrast');
      expect(firstIssue?.helpText).toBe('Ensure text has sufficient contrast');
      expect(firstIssue?.helpUrl).toBeDefined();
      expect(firstIssue?.htmlSnippet).toBeDefined();
      expect(firstIssue?.cssSelector).toBe('p');
      expect(firstIssue?.nodes).toHaveLength(1);
      expect(firstIssue?.createdAt).toBeDefined();
    });
  });

  describe('getFormattedResult', () => {
    it('should fetch and format scan result', async () => {
      const scan = createMockScan();
      vi.mocked(getScanById).mockResolvedValue(scan);

      const result = await getFormattedResult('scan-123');

      expect(getScanById).toHaveBeenCalledWith('scan-123');
      expect(result).toBeDefined();
      expect(result?.scanId).toBe('scan-123');
    });

    it('should return null if scan not found', async () => {
      vi.mocked(getScanById).mockResolvedValue(null);

      const result = await getFormattedResult('nonexistent');

      expect(getScanById).toHaveBeenCalledWith('nonexistent');
      expect(result).toBeNull();
    });

    it('should propagate ResultServiceError from formatResult', async () => {
      const scan = createMockScan({ status: 'RUNNING' });
      vi.mocked(getScanById).mockResolvedValue(scan);

      await expect(getFormattedResult('scan-123')).rejects.toThrow(ResultServiceError);
      await expect(getFormattedResult('scan-123')).rejects.toThrow('scan status is RUNNING');
    });

    it('should wrap repository errors', async () => {
      const repositoryError = new Error('Database connection failed');
      vi.mocked(getScanById).mockRejectedValue(repositoryError);

      await expect(getFormattedResult('scan-123')).rejects.toThrow(ResultServiceError);
      await expect(getFormattedResult('scan-123')).rejects.toThrow('Failed to get formatted result');
    });
  });

  describe('ResultServiceError', () => {
    it('should create error with code and message', () => {
      const error = new ResultServiceError('Test error', 'TEST_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ResultServiceError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new ResultServiceError('Wrapped error', 'WRAPPED_ERROR', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large number of issues', () => {
      const issues: Issue[] = Array.from({ length: 1000 }, (_, i) =>
        createMockIssue({
          id: `issue-${i}`,
          ruleId: i % 2 === 0 ? 'color-contrast' : 'image-alt',
          impact: ['CRITICAL', 'SERIOUS', 'MODERATE', 'MINOR'][i % 4] as any,
        })
      );

      const scan = createMockScan({
        scanResult: {
          id: 'result-1',
          scanId: 'scan-123',
          totalIssues: 1000,
          criticalCount: 250,
          seriousCount: 250,
          moderateCount: 250,
          minorCount: 250,
          passedChecks: 100,
          inapplicableChecks: 50,
          createdAt: new Date('2024-01-01T10:05:00Z'),
          issues,
        },
      });

      const result = formatResult(scan);

      expect(result.summary.totalIssues).toBe(1000);
      expect(result.issuesByImpact.critical).toHaveLength(250);
      expect(result.issuesByImpact.serious).toHaveLength(250);
      expect(result.issuesByImpact.moderate).toHaveLength(250);
      expect(result.issuesByImpact.minor).toHaveLength(250);
    });

    it('should handle all issues of same severity', () => {
      const issues: Issue[] = Array.from({ length: 10 }, (_, i) =>
        createMockIssue({
          id: `issue-${i}`,
          impact: 'CRITICAL',
        })
      );

      const scan = createMockScan({
        scanResult: {
          id: 'result-1',
          scanId: 'scan-123',
          totalIssues: 10,
          criticalCount: 10,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 0,
          inapplicableChecks: 0,
          createdAt: new Date('2024-01-01T10:05:00Z'),
          issues,
        },
      });

      const result = formatResult(scan);

      expect(result.issuesByImpact.critical).toHaveLength(10);
      expect(result.issuesByImpact.serious).toHaveLength(0);
      expect(result.issuesByImpact.moderate).toHaveLength(0);
      expect(result.issuesByImpact.minor).toHaveLength(0);
    });

    it('should handle zero passed checks', () => {
      const scan = createMockScan({
        scanResult: {
          id: 'result-1',
          scanId: 'scan-123',
          totalIssues: 10,
          criticalCount: 10,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          passedChecks: 0,
          inapplicableChecks: 0,
          createdAt: new Date('2024-01-01T10:05:00Z'),
          issues: [createMockIssue({ impact: 'CRITICAL' })],
        },
      });

      const result = formatResult(scan);

      expect(result.summary.passed).toBe(0);
    });
  });
});
