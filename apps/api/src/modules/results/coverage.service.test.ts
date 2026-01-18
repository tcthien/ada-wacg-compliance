/**
 * Coverage Service Tests
 *
 * Test suite for WCAG coverage calculation service.
 */

import { describe, it, expect } from 'vitest';
import {
  CoverageService,
  coverageService,
  type CoverageMetrics,
  type ScanResultData,
  type AiStatus,
} from './coverage.service.js';
import type { Issue } from '@adashield/core/types';

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
 * Helper to create mock scan result data
 */
function createMockScanResult(overrides: Partial<ScanResultData> = {}): ScanResultData {
  return {
    passedChecks: 50,
    inapplicableChecks: 10,
    ...overrides,
  };
}

describe('CoverageService', () => {
  describe('calculateCoverage', () => {
    describe('Standard scan (no AI)', () => {
      it('should return 57% for standard scan without AI', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult();
        const issues: Issue[] = [createMockIssue()];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        expect(metrics.coveragePercentage).toBe(57);
        expect(metrics.isAiEnhanced).toBe(false);
      });

      it('should return 57% when AI is enabled but not completed', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult();
        const issues: Issue[] = [createMockIssue()];

        const pendingStatuses: AiStatus[] = ['PENDING', 'DOWNLOADED', 'PROCESSING', 'FAILED'];

        for (const status of pendingStatuses) {
          const metrics = service.calculateCoverage(scanResult, issues, 'AA', true, status);
          expect(metrics.coveragePercentage).toBe(57);
          expect(metrics.isAiEnhanced).toBe(false);
        }
      });
    });

    describe('AI-enhanced scan', () => {
      it('should return 80% for AI-enhanced scan with COMPLETED status', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult();
        const issues: Issue[] = [createMockIssue()];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', true, 'COMPLETED');

        expect(metrics.coveragePercentage).toBe(80);
        expect(metrics.isAiEnhanced).toBe(true);
      });

      it('should mark isAiEnhanced true only when AI is completed', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult();
        const issues: Issue[] = [];

        // AI enabled but not completed
        let metrics = service.calculateCoverage(scanResult, issues, 'AA', true, 'PROCESSING');
        expect(metrics.isAiEnhanced).toBe(false);

        // AI enabled and completed
        metrics = service.calculateCoverage(scanResult, issues, 'AA', true, 'COMPLETED');
        expect(metrics.isAiEnhanced).toBe(true);

        // AI not enabled
        metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);
        expect(metrics.isAiEnhanced).toBe(false);
      });
    });

    describe('WCAG level criteria counts', () => {
      it('should return 30 criteria for Level A', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [];

        const metrics = service.calculateCoverage(scanResult, issues, 'A', false, null);

        expect(metrics.criteriaTotal).toBe(30);
      });

      it('should return 50 criteria for Level AA', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        expect(metrics.criteriaTotal).toBe(50);
      });

      it('should return 78 criteria for Level AAA', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [];

        const metrics = service.calculateCoverage(scanResult, issues, 'AAA', false, null);

        expect(metrics.criteriaTotal).toBe(78);
      });
    });

    describe('Criteria counting', () => {
      it('should count unique WCAG criteria from issues', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [
          createMockIssue({ id: '1', wcagCriteria: ['1.1.1'] }),
          createMockIssue({ id: '2', wcagCriteria: ['1.4.3'] }),
          createMockIssue({ id: '3', wcagCriteria: ['2.4.4', '4.1.2'] }),
        ];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        // Should count 4 unique criteria: 1.1.1, 1.4.3, 2.4.4, 4.1.2
        expect(metrics.breakdown.criteriaWithIssues).toBe(4);
      });

      it('should deduplicate criteria when multiple issues have the same criteria', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [
          createMockIssue({ id: '1', wcagCriteria: ['1.1.1'] }),
          createMockIssue({ id: '2', wcagCriteria: ['1.1.1'] }),
          createMockIssue({ id: '3', wcagCriteria: ['1.1.1'] }),
        ];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        // All issues have same criteria, should count as 1
        expect(metrics.breakdown.criteriaWithIssues).toBe(1);
      });

      it('should estimate criteria from passed checks', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 50 });
        const issues: Issue[] = [];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        // Should estimate some criteria from passed checks
        expect(metrics.breakdown.criteriaPassed).toBeGreaterThan(0);
        expect(metrics.criteriaChecked).toBeGreaterThan(0);
      });

      it('should calculate total criteria checked as issues + passed', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 30 });
        const issues: Issue[] = [
          createMockIssue({ id: '1', wcagCriteria: ['1.1.1'] }),
          createMockIssue({ id: '2', wcagCriteria: ['1.4.3'] }),
        ];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        // criteriaChecked = criteriaWithIssues + criteriaPassed
        expect(metrics.criteriaChecked).toBe(
          metrics.breakdown.criteriaWithIssues + metrics.breakdown.criteriaPassed
        );
      });

      it('should cap criteriaChecked at criteriaTotal', () => {
        const service = new CoverageService();
        // Very high passed checks to potentially exceed total
        const scanResult = createMockScanResult({ passedChecks: 1000 });
        const issues: Issue[] = [
          createMockIssue({ id: '1', wcagCriteria: ['1.1.1'] }),
        ];

        const metrics = service.calculateCoverage(scanResult, issues, 'A', false, null);

        // Should not exceed total criteria for Level A (30)
        expect(metrics.criteriaChecked).toBeLessThanOrEqual(metrics.criteriaTotal);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty issues array', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        expect(metrics.breakdown.criteriaWithIssues).toBe(0);
        expect(metrics.criteriaChecked).toBe(0);
        expect(metrics.breakdown.criteriaNotTestable).toBe(50); // All AA criteria
      });

      it('should handle issues with empty wcagCriteria', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [
          createMockIssue({ id: '1', wcagCriteria: [] }),
        ];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        expect(metrics.breakdown.criteriaWithIssues).toBe(0);
      });

      it('should handle zero passed checks', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        expect(metrics.breakdown.criteriaPassed).toBe(0);
      });

      it('should ensure criteriaNotTestable is never negative', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 100 });
        // Create issues covering many criteria
        const issues: Issue[] = Array.from({ length: 30 }, (_, i) =>
          createMockIssue({
            id: `issue-${i}`,
            wcagCriteria: [`1.${i % 4 + 1}.${i % 3 + 1}`],
          })
        );

        const metrics = service.calculateCoverage(scanResult, issues, 'A', false, null);

        expect(metrics.breakdown.criteriaNotTestable).toBeGreaterThanOrEqual(0);
      });

      it('should handle invalid WCAG criteria IDs gracefully', () => {
        const service = new CoverageService();
        const scanResult = createMockScanResult({ passedChecks: 0 });
        const issues: Issue[] = [
          createMockIssue({ id: '1', wcagCriteria: ['invalid-id', '1.1.1'] }),
        ];

        const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

        // Should only count valid criteria (1.1.1)
        expect(metrics.breakdown.criteriaWithIssues).toBe(1);
      });
    });
  });

  describe('getCriteriaCountForLevel', () => {
    it('should return correct count for each level', () => {
      const service = new CoverageService();

      expect(service.getCriteriaCountForLevel('A')).toBe(30);
      expect(service.getCriteriaCountForLevel('AA')).toBe(50);
      expect(service.getCriteriaCountForLevel('AAA')).toBe(78);
    });

    it('should handle lowercase level input', () => {
      const service = new CoverageService();

      // TypeScript expects uppercase, but we handle lowercase for robustness
      expect(service.getCriteriaCountForLevel('a' as any)).toBe(30);
      expect(service.getCriteriaCountForLevel('aa' as any)).toBe(50);
      expect(service.getCriteriaCountForLevel('aaa' as any)).toBe(78);
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(coverageService).toBeInstanceOf(CoverageService);
    });

    it('should work correctly with singleton', () => {
      const scanResult = createMockScanResult();
      const issues: Issue[] = [createMockIssue()];

      const metrics = coverageService.calculateCoverage(scanResult, issues, 'AA', true, 'COMPLETED');

      expect(metrics.coveragePercentage).toBe(80);
      expect(metrics.isAiEnhanced).toBe(true);
    });
  });

  describe('Coverage breakdown', () => {
    it('should provide complete breakdown structure', () => {
      const service = new CoverageService();
      const scanResult = createMockScanResult({ passedChecks: 20 });
      const issues: Issue[] = [
        createMockIssue({ id: '1', wcagCriteria: ['1.1.1', '1.4.3'] }),
      ];

      const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

      // Verify breakdown structure
      expect(metrics.breakdown).toHaveProperty('criteriaWithIssues');
      expect(metrics.breakdown).toHaveProperty('criteriaPassed');
      expect(metrics.breakdown).toHaveProperty('criteriaNotTestable');

      // Verify types
      expect(typeof metrics.breakdown.criteriaWithIssues).toBe('number');
      expect(typeof metrics.breakdown.criteriaPassed).toBe('number');
      expect(typeof metrics.breakdown.criteriaNotTestable).toBe('number');
    });

    it('should sum breakdown to approximately criteriaTotal', () => {
      const service = new CoverageService();
      const scanResult = createMockScanResult({ passedChecks: 20 });
      const issues: Issue[] = [
        createMockIssue({ id: '1', wcagCriteria: ['1.1.1'] }),
      ];

      const metrics = service.calculateCoverage(scanResult, issues, 'AA', false, null);

      // The sum should equal criteriaTotal (accounting for overlap in our simple calculation)
      const sum =
        metrics.breakdown.criteriaWithIssues +
        metrics.breakdown.criteriaPassed +
        metrics.breakdown.criteriaNotTestable;

      expect(sum).toBe(metrics.criteriaTotal);
    });
  });
});
