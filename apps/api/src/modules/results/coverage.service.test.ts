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
import type { Issue, CriteriaVerification, BuildCriteriaVerificationsInput } from '@adashield/core/types';

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

  describe('buildCriteriaVerifications', () => {
    it('should initialize all criteria as NOT_TESTED when no data provided', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: [],
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      expect(verifications.length).toBe(50); // AA has 50 criteria
      expect(verifications.every(v => v.status === 'NOT_TESTED')).toBe(true);
      expect(verifications.every(v => v.scanner === 'N/A')).toBe(true);
    });

    it('should mark criteria as PASS when passed checks map to them', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: ['color-contrast', 'image-alt'],
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      // color-contrast maps to 1.4.3, image-alt maps to 1.1.1
      const passed = verifications.filter(v => v.status === 'PASS');
      expect(passed.length).toBeGreaterThanOrEqual(2);
      expect(passed.some(v => v.criterionId === '1.4.3')).toBe(true);
      expect(passed.some(v => v.criterionId === '1.1.1')).toBe(true);
      expect(passed.every(v => v.scanner === 'axe-core')).toBe(true);
    });

    it('should mark criteria as FAIL when issues reference them', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [
          { id: 'issue-1', wcagCriteria: ['1.1.1'] },
          { id: 'issue-2', wcagCriteria: ['1.4.3'] },
          { id: 'issue-3', wcagCriteria: ['1.1.1'] }, // Same criterion
        ],
        wcagLevel: 'AA',
        passedChecks: [],
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      const failed = verifications.filter(v => v.status === 'FAIL');
      expect(failed.length).toBe(2); // 1.1.1 and 1.4.3
      expect(failed.every(v => v.scanner === 'axe-core')).toBe(true);

      // Check issue IDs are linked
      const criterion111 = verifications.find(v => v.criterionId === '1.1.1');
      expect(criterion111?.issueIds).toContain('issue-1');
      expect(criterion111?.issueIds).toContain('issue-3');
    });

    it('should prioritize FAIL over PASS when both exist', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [
          { id: 'issue-1', wcagCriteria: ['1.4.3'] },
        ],
        wcagLevel: 'AA',
        passedChecks: ['color-contrast'], // Also maps to 1.4.3
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion143 = verifications.find(v => v.criterionId === '1.4.3');
      expect(criterion143?.status).toBe('FAIL'); // Issue should override pass
    });

    it('should merge AI verifications with AI taking precedence', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: [],
        aiVerifications: [
          {
            criterionId: '1.3.2', // Not testable by axe-core
            status: 'AI_VERIFIED_PASS',
            scanner: 'claude-opus-4',
            confidence: 85,
            reasoning: 'Page maintains meaningful reading sequence',
          },
        ],
        aiModel: 'claude-opus-4',
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion132 = verifications.find(v => v.criterionId === '1.3.2');
      expect(criterion132?.status).toBe('AI_VERIFIED_PASS');
      expect(criterion132?.confidence).toBe(85);
      expect(criterion132?.reasoning).toBe('Page maintains meaningful reading sequence');
    });

    it('should set scanner to "axe-core + AI" when both verify same criterion', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: ['color-contrast'], // Maps to 1.4.3
        aiVerifications: [
          {
            criterionId: '1.4.3',
            status: 'AI_VERIFIED_PASS',
            scanner: 'claude-opus-4',
            confidence: 90,
          },
        ],
        aiModel: 'claude-opus-4',
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion143 = verifications.find(v => v.criterionId === '1.4.3');
      expect(criterion143?.status).toBe('AI_VERIFIED_PASS');
      expect(criterion143?.scanner).toBe('axe-core + AI');
    });

    it('should handle different WCAG levels correctly', () => {
      const service = new CoverageService();
      const baseInput = {
        scanResultId: 'scan-1',
        issues: [],
        passedChecks: [],
        aiVerifications: [],
      };

      const levelA = service.buildCriteriaVerifications({ ...baseInput, wcagLevel: 'A' });
      const levelAA = service.buildCriteriaVerifications({ ...baseInput, wcagLevel: 'AA' });
      const levelAAA = service.buildCriteriaVerifications({ ...baseInput, wcagLevel: 'AAA' });

      expect(levelA.length).toBe(30);
      expect(levelAA.length).toBe(50);
      expect(levelAAA.length).toBe(78);
    });
  });

  describe('calculateCoverageFromVerifications', () => {
    it('should calculate actual coverage percentage', () => {
      const service = new CoverageService();

      // 20 criteria checked out of 50 = 40%
      const verifications: CriteriaVerification[] = [
        ...Array(10).fill(null).map((_, i) => ({
          criterionId: `1.${i + 1}.1`,
          status: 'PASS' as const,
          scanner: 'axe-core',
        })),
        ...Array(10).fill(null).map((_, i) => ({
          criterionId: `2.${i + 1}.1`,
          status: 'FAIL' as const,
          scanner: 'axe-core',
        })),
        ...Array(30).fill(null).map((_, i) => ({
          criterionId: `3.${i + 1}.1`,
          status: 'NOT_TESTED' as const,
          scanner: 'N/A',
        })),
      ];

      const metrics = service.calculateCoverageFromVerifications(verifications, 'AA');

      expect(metrics.criteriaChecked).toBe(20);
      expect(metrics.coveragePercentage).toBe(40); // 20/50 = 40%
      expect(metrics.isAiEnhanced).toBe(false);
    });

    it('should identify AI-enhanced scans', () => {
      const service = new CoverageService();

      const verifications: CriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', scanner: 'axe-core' },
        { criterionId: '1.3.2', status: 'AI_VERIFIED_PASS', scanner: 'claude-opus-4', confidence: 85 },
        { criterionId: '2.4.7', status: 'AI_VERIFIED_FAIL', scanner: 'claude-opus-4', confidence: 70 },
        ...Array(47).fill(null).map((_, i) => ({
          criterionId: `9.${i}.1`,
          status: 'NOT_TESTED' as const,
          scanner: 'N/A',
        })),
      ];

      const metrics = service.calculateCoverageFromVerifications(verifications, 'AA');

      expect(metrics.isAiEnhanced).toBe(true);
      expect(metrics.summary.criteriaAiVerified).toBe(2);
    });

    it('should calculate correct summary statistics', () => {
      const service = new CoverageService();

      const verifications: CriteriaVerification[] = [
        { criterionId: '1.1.1', status: 'PASS', scanner: 'axe-core' },
        { criterionId: '1.4.3', status: 'PASS', scanner: 'axe-core' },
        { criterionId: '1.3.1', status: 'FAIL', scanner: 'axe-core' },
        { criterionId: '1.3.2', status: 'AI_VERIFIED_PASS', scanner: 'claude-opus-4' },
        { criterionId: '2.4.7', status: 'AI_VERIFIED_FAIL', scanner: 'claude-opus-4' },
        ...Array(45).fill(null).map((_, i) => ({
          criterionId: `9.${i}.1`,
          status: 'NOT_TESTED' as const,
          scanner: 'N/A',
        })),
      ];

      const metrics = service.calculateCoverageFromVerifications(verifications, 'AA');

      expect(metrics.summary.criteriaPassed).toBe(3); // 2 PASS + 1 AI_VERIFIED_PASS
      expect(metrics.summary.criteriaWithIssues).toBe(2); // 1 FAIL + 1 AI_VERIFIED_FAIL
      expect(metrics.summary.criteriaNotTested).toBe(45);
      expect(metrics.summary.criteriaAiVerified).toBe(2);
      expect(metrics.summary.criteriaChecked).toBe(5); // 2 + 1 + 1 + 1
    });

    it('should return 0% coverage when no criteria checked', () => {
      const service = new CoverageService();

      const verifications: CriteriaVerification[] = Array(50).fill(null).map((_, i) => ({
        criterionId: `${i}.1.1`,
        status: 'NOT_TESTED' as const,
        scanner: 'N/A',
      }));

      const metrics = service.calculateCoverageFromVerifications(verifications, 'AA');

      expect(metrics.coveragePercentage).toBe(0);
      expect(metrics.criteriaChecked).toBe(0);
    });

    it('should handle empty verifications array', () => {
      const service = new CoverageService();

      const metrics = service.calculateCoverageFromVerifications([], 'AA');

      expect(metrics.coveragePercentage).toBe(0);
      expect(metrics.criteriaChecked).toBe(0);
      expect(metrics.criteriaTotal).toBe(50);
    });
  });

  describe('buildCriteriaVerifications with passedRuleIds', () => {
    it('should mark criteria as PASS when rule passes', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: ['color-contrast'], // Maps to criterion 1.4.3
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion143 = verifications.find(v => v.criterionId === '1.4.3');
      expect(criterion143?.status).toBe('PASS');
      expect(criterion143?.scanner).toBe('axe-core');
    });

    it('should map multiple rules to the same criterion', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        // Both image-alt and input-image-alt map to 1.1.1
        passedChecks: ['image-alt', 'input-image-alt', 'area-alt'],
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion111 = verifications.find(v => v.criterionId === '1.1.1');
      expect(criterion111?.status).toBe('PASS');
      expect(criterion111?.scanner).toBe('axe-core');

      // Should only count as one PASS, not three
      const passedCriteria = verifications.filter(v => v.status === 'PASS');
      const criterion111Count = passedCriteria.filter(v => v.criterionId === '1.1.1').length;
      expect(criterion111Count).toBe(1);
    });

    it('should mark FAIL when issue exists for passed criterion', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [
          { id: 'issue-1', wcagCriteria: ['1.4.3'] }, // Issue for color contrast
        ],
        wcagLevel: 'AA',
        passedChecks: ['color-contrast'], // Also maps to 1.4.3
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion143 = verifications.find(v => v.criterionId === '1.4.3');
      // FAIL should override PASS because issue takes precedence
      expect(criterion143?.status).toBe('FAIL');
      expect(criterion143?.scanner).toBe('axe-core');
      expect(criterion143?.issueIds).toContain('issue-1');
    });

    it('should skip unknown rule IDs', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: ['unknown-rule-xyz', 'another-unknown-rule'],
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      // Unknown rules should not create any PASS status
      const passedCriteria = verifications.filter(v => v.status === 'PASS');
      expect(passedCriteria.length).toBe(0);

      // All criteria should remain NOT_TESTED
      expect(verifications.every(v => v.status === 'NOT_TESTED')).toBe(true);
    });

    it('should handle mixed known and unknown rule IDs', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: ['unknown-rule', 'color-contrast', 'another-unknown'],
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      // Only known rule should create PASS
      const passedCriteria = verifications.filter(v => v.status === 'PASS');
      expect(passedCriteria.length).toBeGreaterThanOrEqual(1);
      expect(passedCriteria.some(v => v.criterionId === '1.4.3')).toBe(true);
    });

    it('should prioritize AI_VERIFIED_PASS over axe-core PASS', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: ['color-contrast'], // Maps to 1.4.3
        aiVerifications: [
          {
            criterionId: '1.4.3',
            status: 'AI_VERIFIED_PASS',
            scanner: 'claude-opus-4',
            confidence: 95,
            reasoning: 'AI verified color contrast meets requirements',
          },
        ],
        aiModel: 'claude-opus-4',
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion143 = verifications.find(v => v.criterionId === '1.4.3');
      expect(criterion143?.status).toBe('AI_VERIFIED_PASS');
      expect(criterion143?.scanner).toBe('axe-core + AI');
      expect(criterion143?.confidence).toBe(95);
      expect(criterion143?.reasoning).toBe('AI verified color contrast meets requirements');
    });

    it('should prioritize AI_VERIFIED_FAIL over axe-core PASS', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: ['color-contrast'], // Maps to 1.4.3
        aiVerifications: [
          {
            criterionId: '1.4.3',
            status: 'AI_VERIFIED_FAIL',
            scanner: 'claude-opus-4',
            confidence: 80,
            reasoning: 'AI found subtle contrast issues not detected by axe-core',
          },
        ],
        aiModel: 'claude-opus-4',
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion143 = verifications.find(v => v.criterionId === '1.4.3');
      expect(criterion143?.status).toBe('AI_VERIFIED_FAIL');
      expect(criterion143?.scanner).toBe('axe-core + AI');
      expect(criterion143?.confidence).toBe(80);
    });

    it('should prioritize AI_VERIFIED_PASS over axe-core FAIL', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [
          { id: 'issue-1', wcagCriteria: ['1.4.3'] },
        ],
        wcagLevel: 'AA',
        passedChecks: [],
        aiVerifications: [
          {
            criterionId: '1.4.3',
            status: 'AI_VERIFIED_PASS',
            scanner: 'claude-opus-4',
            confidence: 90,
            reasoning: 'AI determined the issue was a false positive',
          },
        ],
        aiModel: 'claude-opus-4',
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion143 = verifications.find(v => v.criterionId === '1.4.3');
      // AI override should take precedence, but preserve issue IDs
      expect(criterion143?.status).toBe('AI_VERIFIED_PASS');
      expect(criterion143?.scanner).toBe('axe-core + AI');
      expect(criterion143?.issueIds).toContain('issue-1');
    });

    it('should map rule IDs to multiple criteria correctly', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        // 'link-name' maps to both '2.4.4' and '4.1.2'
        passedChecks: ['link-name'],
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      const criterion244 = verifications.find(v => v.criterionId === '2.4.4');
      const criterion412 = verifications.find(v => v.criterionId === '4.1.2');

      expect(criterion244?.status).toBe('PASS');
      expect(criterion244?.scanner).toBe('axe-core');
      expect(criterion412?.status).toBe('PASS');
      expect(criterion412?.scanner).toBe('axe-core');
    });

    it('should handle empty passedChecks array', () => {
      const service = new CoverageService();
      const input: BuildCriteriaVerificationsInput = {
        scanResultId: 'scan-1',
        issues: [],
        wcagLevel: 'AA',
        passedChecks: [],
        aiVerifications: [],
      };

      const verifications = service.buildCriteriaVerifications(input);

      // All criteria should be NOT_TESTED
      expect(verifications.every(v => v.status === 'NOT_TESTED')).toBe(true);
    });
  });

  describe('computeVerificationsFromLegacyData', () => {
    it('should compute verifications from issues without passed rule IDs', () => {
      const service = new CoverageService();
      const scanResult = createMockScanResult({ passedChecks: 0 });
      const issues = [
        { id: 'issue-1', wcagCriteria: ['1.1.1'] },
        { id: 'issue-2', wcagCriteria: ['1.4.3'] },
      ];

      const verifications = service.computeVerificationsFromLegacyData(
        scanResult,
        issues,
        'AA',
        []
      );

      expect(verifications.length).toBe(50);

      const failed = verifications.filter(v => v.status === 'FAIL');
      expect(failed.length).toBe(2);
      expect(failed.map(v => v.criterionId).sort()).toEqual(['1.1.1', '1.4.3']);
    });

    it('should map passed rule IDs to PASS status', () => {
      const service = new CoverageService();
      const scanResult = createMockScanResult({ passedChecks: 0 });
      const issues: Array<{ id: string; wcagCriteria: string[] }> = [];

      const verifications = service.computeVerificationsFromLegacyData(
        scanResult,
        issues,
        'AA',
        ['image-alt', 'color-contrast']
      );

      const passed = verifications.filter(v => v.status === 'PASS');
      expect(passed.length).toBeGreaterThanOrEqual(2);
      expect(passed.some(v => v.criterionId === '1.1.1')).toBe(true);
      expect(passed.some(v => v.criterionId === '1.4.3')).toBe(true);
    });

    it('should estimate passed criteria from passedChecks count', () => {
      const service = new CoverageService();
      const scanResult = createMockScanResult({ passedChecks: 50 });
      const issues: Array<{ id: string; wcagCriteria: string[] }> = [];

      const verifications = service.computeVerificationsFromLegacyData(
        scanResult,
        issues,
        'AA',
        [] // No specific rule IDs, use heuristic
      );

      const passed = verifications.filter(v => v.status === 'PASS');
      expect(passed.length).toBeGreaterThan(0);
    });

    it('should prioritize FAIL over estimated PASS', () => {
      const service = new CoverageService();
      const scanResult = createMockScanResult({ passedChecks: 100 });
      const issues = [
        { id: 'issue-1', wcagCriteria: ['1.1.1'] },
      ];

      const verifications = service.computeVerificationsFromLegacyData(
        scanResult,
        issues,
        'AA',
        []
      );

      const criterion111 = verifications.find(v => v.criterionId === '1.1.1');
      expect(criterion111?.status).toBe('FAIL'); // Issue should override estimated pass
    });

    it('should be backward compatible for scans without stored verifications', () => {
      const service = new CoverageService();
      const scanResult = createMockScanResult({ passedChecks: 30, inapplicableChecks: 10 });
      const issues = [
        { id: 'issue-1', wcagCriteria: ['1.1.1', '1.4.3'] },
        { id: 'issue-2', wcagCriteria: ['2.4.4'] },
      ];

      const verifications = service.computeVerificationsFromLegacyData(
        scanResult,
        issues,
        'AA',
        []
      );

      // Should produce valid verifications that can be used with calculateCoverageFromVerifications
      const metrics = service.calculateCoverageFromVerifications(verifications, 'AA');

      expect(metrics.criteriaTotal).toBe(50);
      expect(metrics.criteriaChecked).toBeGreaterThan(0);
      expect(metrics.summary.criteriaWithIssues).toBe(3); // 1.1.1, 1.4.3, 2.4.4
    });
  });
});
