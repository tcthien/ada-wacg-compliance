import { describe, it, expect } from 'vitest';
import {
  WCAG_CRITERIA,
  AXE_RULE_TO_WCAG,
  getCriteriaByLevel,
  getCriteriaUpToLevel,
  getWCAGForAxeRule,
  type WCAGLevel
} from '../wcag.constants.js';

describe('WCAG Constants', () => {
  describe('WCAG_CRITERIA', () => {
    it('should contain all WCAG 2.1 criteria', () => {
      expect(Object.keys(WCAG_CRITERIA).length).toBeGreaterThan(0);
    });

    it('should have properly formatted criterion IDs', () => {
      Object.keys(WCAG_CRITERIA).forEach(id => {
        expect(id).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });

    it('should have valid levels (A, AA, AAA)', () => {
      const validLevels: WCAGLevel[] = ['A', 'AA', 'AAA'];
      Object.values(WCAG_CRITERIA).forEach(criterion => {
        expect(validLevels).toContain(criterion.level);
      });
    });

    it('should have all required properties', () => {
      Object.values(WCAG_CRITERIA).forEach(criterion => {
        expect(criterion).toHaveProperty('id');
        expect(criterion).toHaveProperty('level');
        expect(criterion).toHaveProperty('title');
        expect(criterion).toHaveProperty('description');
        expect(criterion.title).toBeTruthy();
        expect(criterion.description).toBeTruthy();
      });
    });

    it('should include known critical criteria', () => {
      expect(WCAG_CRITERIA['1.1.1']).toBeDefined();
      expect(WCAG_CRITERIA['1.1.1'].title).toBe('Non-text Content');
      expect(WCAG_CRITERIA['1.4.3']).toBeDefined();
      expect(WCAG_CRITERIA['1.4.3'].title).toBe('Contrast (Minimum)');
      expect(WCAG_CRITERIA['2.4.4']).toBeDefined();
      expect(WCAG_CRITERIA['2.4.4'].title).toBe('Link Purpose (In Context)');
    });
  });

  describe('AXE_RULE_TO_WCAG', () => {
    it('should map common axe-core rules to WCAG criteria', () => {
      expect(AXE_RULE_TO_WCAG['color-contrast']).toEqual(['1.4.3']);
      expect(AXE_RULE_TO_WCAG['image-alt']).toEqual(['1.1.1']);
      expect(AXE_RULE_TO_WCAG['link-name']).toContain('2.4.4');
    });

    it('should have valid WCAG references', () => {
      Object.values(AXE_RULE_TO_WCAG).forEach(wcagIds => {
        wcagIds.forEach(wcagId => {
          expect(WCAG_CRITERIA[wcagId]).toBeDefined();
        });
      });
    });

    it('should contain at least 30 common rule mappings', () => {
      expect(Object.keys(AXE_RULE_TO_WCAG).length).toBeGreaterThanOrEqual(30);
    });
  });

  describe('getCriteriaByLevel', () => {
    it('should return only Level A criteria', () => {
      const criteriaA = getCriteriaByLevel('A');
      expect(criteriaA.length).toBeGreaterThan(0);
      criteriaA.forEach(criterion => {
        expect(criterion.level).toBe('A');
      });
    });

    it('should return only Level AA criteria', () => {
      const criteriaAA = getCriteriaByLevel('AA');
      expect(criteriaAA.length).toBeGreaterThan(0);
      criteriaAA.forEach(criterion => {
        expect(criterion.level).toBe('AA');
      });
    });

    it('should return only Level AAA criteria', () => {
      const criteriaAAA = getCriteriaByLevel('AAA');
      expect(criteriaAAA.length).toBeGreaterThan(0);
      criteriaAAA.forEach(criterion => {
        expect(criterion.level).toBe('AAA');
      });
    });
  });

  describe('getCriteriaUpToLevel', () => {
    it('should return only A criteria for Level A', () => {
      const criteria = getCriteriaUpToLevel('A');
      criteria.forEach(criterion => {
        expect(criterion.level).toBe('A');
      });
    });

    it('should return A and AA criteria for Level AA', () => {
      const criteria = getCriteriaUpToLevel('AA');
      const levels = new Set(criteria.map(c => c.level));
      expect(levels.has('A')).toBe(true);
      expect(levels.has('AA')).toBe(true);
      expect(levels.has('AAA')).toBe(false);
    });

    it('should return all criteria for Level AAA', () => {
      const criteria = getCriteriaUpToLevel('AAA');
      const levels = new Set(criteria.map(c => c.level));
      expect(levels.has('A')).toBe(true);
      expect(levels.has('AA')).toBe(true);
      expect(levels.has('AAA')).toBe(true);
    });

    it('should return more criteria for higher levels', () => {
      const criteriaA = getCriteriaUpToLevel('A');
      const criteriaAA = getCriteriaUpToLevel('AA');
      const criteriaAAA = getCriteriaUpToLevel('AAA');

      expect(criteriaAA.length).toBeGreaterThan(criteriaA.length);
      expect(criteriaAAA.length).toBeGreaterThan(criteriaAA.length);
    });
  });

  describe('getWCAGForAxeRule', () => {
    it('should return WCAG criteria for known axe-core rules', () => {
      const criteria = getWCAGForAxeRule('color-contrast');
      expect(criteria.length).toBeGreaterThan(0);
      expect(criteria[0]?.id).toBe('1.4.3');
      expect(criteria[0]?.title).toBe('Contrast (Minimum)');
    });

    it('should return empty array for unknown rules', () => {
      const criteria = getWCAGForAxeRule('unknown-rule-xyz');
      expect(criteria).toEqual([]);
    });

    it('should handle rules with multiple WCAG criteria', () => {
      const criteria = getWCAGForAxeRule('label');
      expect(criteria.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter out invalid WCAG IDs', () => {
      const criteria = getWCAGForAxeRule('image-alt');
      criteria.forEach(criterion => {
        expect(criterion).toBeDefined();
        expect(criterion.id).toBeTruthy();
      });
    });
  });
});
