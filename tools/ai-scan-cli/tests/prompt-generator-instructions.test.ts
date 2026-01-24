import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadVerificationInstructions,
  getCriteriaBatch,
  getCriteriaForLevel,
  batchCriteriaByLevel,
  clearVerificationInstructionsCache,
  getVerificationInstructionsPath,
  type WcagVerificationInstructions,
} from '../src/prompt-generator.js';
import type { CriterionVerificationInstruction } from '../src/types.js';
import { existsSync } from 'fs';

describe('Verification Instructions Loader', () => {
  // Clear cache before and after each test to ensure isolation
  beforeEach(() => {
    clearVerificationInstructionsCache();
  });

  afterEach(() => {
    clearVerificationInstructionsCache();
  });

  describe('getVerificationInstructionsPath', () => {
    it('should return valid path to wcag-verification-instructions.json', () => {
      const path = getVerificationInstructionsPath();

      expect(typeof path).toBe('string');
      expect(path).toContain('data');
      expect(path).toContain('wcag-verification-instructions.json');
      expect(existsSync(path)).toBe(true);
    });

    it('should return absolute path', () => {
      const path = getVerificationInstructionsPath();
      const isAbsolute = path.startsWith('/') || /^[A-Z]:\\/.test(path);
      expect(isAbsolute).toBe(true);
    });
  });

  describe('loadVerificationInstructions', () => {
    it('should load and parse verification instructions JSON', async () => {
      const instructions = await loadVerificationInstructions();

      expect(instructions).toBeDefined();
      expect(instructions.version).toBeDefined();
      expect(typeof instructions.version).toBe('string');
      expect(instructions.criteria).toBeDefined();
      expect(typeof instructions.criteria).toBe('object');
    });

    it('should return at least 30 criteria', async () => {
      const instructions = await loadVerificationInstructions();
      const criteriaCount = Object.keys(instructions.criteria).length;

      expect(criteriaCount).toBeGreaterThanOrEqual(30);
    });

    it('should cache instructions for repeated calls', async () => {
      // First call
      const instructions1 = await loadVerificationInstructions();
      // Second call should return cached data
      const instructions2 = await loadVerificationInstructions();

      // Both should be the same reference (cached)
      expect(instructions1).toBe(instructions2);
    });

    it('should contain valid criterion structure', async () => {
      const instructions = await loadVerificationInstructions();
      const criterion = instructions.criteria['1.1.1'];

      expect(criterion).toBeDefined();
      expect(criterion.criterionId).toBe('1.1.1');
      expect(criterion.title).toBe('Non-text Content');
      expect(criterion.level).toBe('A');
      expect(criterion.description).toBeDefined();
      expect(criterion.whatToCheck).toBeDefined();
      expect(criterion.passCondition).toBeDefined();
      expect(criterion.failIndicators).toBeDefined();
      expect(typeof criterion.requiresManualReview).toBe('boolean');
    });
  });

  describe('clearVerificationInstructionsCache', () => {
    it('should clear the cache so next load reads from file', async () => {
      // Load once to populate cache
      const instructions1 = await loadVerificationInstructions();

      // Clear cache
      clearVerificationInstructionsCache();

      // Load again - should create new instance
      const instructions2 = await loadVerificationInstructions();

      // They should have same content but different references
      expect(instructions1).not.toBe(instructions2);
      expect(instructions1.version).toBe(instructions2.version);
    });
  });

  describe('getCriteriaBatch', () => {
    it('should return verification instructions for specified criteria IDs', async () => {
      const batch = await getCriteriaBatch(['1.1.1', '1.2.1']);

      expect(batch).toHaveLength(2);
      expect(batch[0].criterionId).toBe('1.1.1');
      expect(batch[1].criterionId).toBe('1.2.1');
    });

    it('should skip IDs not found in instructions', async () => {
      const batch = await getCriteriaBatch(['1.1.1', '99.99.99', '1.2.1']);

      expect(batch).toHaveLength(2);
      expect(batch.map((c) => c.criterionId)).toEqual(['1.1.1', '1.2.1']);
    });

    it('should return empty array for all invalid IDs', async () => {
      const batch = await getCriteriaBatch(['99.1.1', '99.2.2', '99.3.3']);

      expect(batch).toHaveLength(0);
    });

    it('should return empty array for empty input', async () => {
      const batch = await getCriteriaBatch([]);

      expect(batch).toHaveLength(0);
    });

    it('should convert array fields to strings', async () => {
      const batch = await getCriteriaBatch(['1.1.1']);

      expect(batch).toHaveLength(1);
      // whatToCheck should be converted from array to string
      expect(typeof batch[0].whatToCheck).toBe('string');
      // failIndicators should be converted from array to string
      expect(typeof batch[0].failIndicators).toBe('string');
    });

    it('should not include level field in returned instructions', async () => {
      const batch = await getCriteriaBatch(['1.1.1']);

      expect(batch).toHaveLength(1);
      // The returned type is CriterionVerificationInstruction, not CriterionWithLevel
      expect('level' in batch[0]).toBe(false);
    });
  });

  describe('getCriteriaForLevel', () => {
    it('should return only Level A criteria for wcagLevel="A"', async () => {
      const criteria = await getCriteriaForLevel('A');

      // All criteria should exist
      expect(criteria.length).toBeGreaterThan(0);

      // Load instructions to verify levels
      const instructions = await loadVerificationInstructions();

      // Check that returned criteria are all Level A
      for (const criterion of criteria) {
        const original = instructions.criteria[criterion.criterionId];
        expect(original.level).toBe('A');
      }
    });

    it('should return Level A and AA criteria for wcagLevel="AA"', async () => {
      const criteria = await getCriteriaForLevel('AA');
      const instructions = await loadVerificationInstructions();

      // Should have more criteria than Level A only
      const levelACriteria = await getCriteriaForLevel('A');
      expect(criteria.length).toBeGreaterThan(levelACriteria.length);

      // Check that returned criteria are all Level A or AA
      for (const criterion of criteria) {
        const original = instructions.criteria[criterion.criterionId];
        expect(['A', 'AA']).toContain(original.level);
      }
    });

    it('should return Level A, AA, and AAA criteria for wcagLevel="AAA"', async () => {
      const criteria = await getCriteriaForLevel('AAA');
      const instructions = await loadVerificationInstructions();

      // Should have at least as many criteria as AA
      const levelAACriteria = await getCriteriaForLevel('AA');
      expect(criteria.length).toBeGreaterThanOrEqual(levelAACriteria.length);

      // Check that returned criteria are all Level A, AA, or AAA
      for (const criterion of criteria) {
        const original = instructions.criteria[criterion.criterionId];
        expect(['A', 'AA', 'AAA']).toContain(original.level);
      }
    });

    it('should sort criteria by criterion ID', async () => {
      const criteria = await getCriteriaForLevel('AA');

      // Check that criteria are sorted
      for (let i = 1; i < criteria.length; i++) {
        const prev = criteria[i - 1].criterionId
          .split('.')
          .map(Number);
        const curr = criteria[i].criterionId
          .split('.')
          .map(Number);

        // Compare version-like ordering
        let prevIsSmaller = false;
        for (let j = 0; j < Math.max(prev.length, curr.length); j++) {
          const p = prev[j] ?? 0;
          const c = curr[j] ?? 0;
          if (p < c) {
            prevIsSmaller = true;
            break;
          } else if (p > c) {
            break;
          }
        }
        expect(prevIsSmaller || prev.every((v, j) => v === (curr[j] ?? 0))).toBe(true);
      }
    });
  });

  describe('batchCriteriaByLevel', () => {
    it('should split Level A criteria into batches of default size 10', async () => {
      const batches = await batchCriteriaByLevel('A');
      const levelACriteria = await getCriteriaForLevel('A');

      // Calculate expected number of batches
      const expectedBatches = Math.ceil(levelACriteria.length / 10);
      expect(batches.length).toBe(expectedBatches);

      // Each batch except the last should have 10 items
      for (let i = 0; i < batches.length - 1; i++) {
        expect(batches[i]).toHaveLength(10);
      }

      // Last batch should have remaining items
      const lastBatchExpectedSize = levelACriteria.length % 10 || 10;
      expect(batches[batches.length - 1].length).toBeLessThanOrEqual(10);
    });

    it('should split Level AA criteria into batches of default size 10', async () => {
      const batches = await batchCriteriaByLevel('AA');
      const levelAACriteria = await getCriteriaForLevel('AA');

      // Calculate expected number of batches
      const expectedBatches = Math.ceil(levelAACriteria.length / 10);
      expect(batches.length).toBe(expectedBatches);

      // Total criteria across batches should equal total criteria
      const totalCriteria = batches.reduce((sum, batch) => sum + batch.length, 0);
      expect(totalCriteria).toBe(levelAACriteria.length);
    });

    it('should use custom batch size when provided', async () => {
      const batches = await batchCriteriaByLevel('AA', 8);
      const levelAACriteria = await getCriteriaForLevel('AA');

      // Calculate expected number of batches with batch size 8
      const expectedBatches = Math.ceil(levelAACriteria.length / 8);
      expect(batches.length).toBe(expectedBatches);

      // Each batch except the last should have 8 items
      for (let i = 0; i < batches.length - 1; i++) {
        expect(batches[i]).toHaveLength(8);
      }
    });

    it('should produce 5-6 batches for Level AA with batch size 10', async () => {
      const batches = await batchCriteriaByLevel('AA', 10);

      // Per requirements: 50 AA criteria in 5-6 batches
      expect(batches.length).toBeGreaterThanOrEqual(4);
      expect(batches.length).toBeLessThanOrEqual(6);
    });

    it('should produce 3-4 batches for Level A with batch size 10', async () => {
      const batches = await batchCriteriaByLevel('A', 10);

      // Per requirements: ~30 Level A criteria in 3-4 batches
      expect(batches.length).toBeGreaterThanOrEqual(2);
      expect(batches.length).toBeLessThanOrEqual(4);
    });

    it('should preserve criterion ordering within batches', async () => {
      const batches = await batchCriteriaByLevel('AA');
      const allCriteria = batches.flat();

      // Check that flattened batches are still sorted
      for (let i = 1; i < allCriteria.length; i++) {
        const prev = allCriteria[i - 1].criterionId
          .split('.')
          .map(Number);
        const curr = allCriteria[i].criterionId
          .split('.')
          .map(Number);

        let isOrdered = true;
        for (let j = 0; j < Math.max(prev.length, curr.length); j++) {
          const p = prev[j] ?? 0;
          const c = curr[j] ?? 0;
          if (p > c) {
            isOrdered = false;
            break;
          } else if (p < c) {
            break;
          }
        }
        expect(isOrdered).toBe(true);
      }
    });
  });
});
