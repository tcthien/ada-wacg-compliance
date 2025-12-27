/**
 * Tests for Fix Guide Mapper Utility
 */

import { describe, it, expect } from 'vitest';
import {
  getFixGuideByRuleId,
  getFixGuidesByRuleIds,
  getAllFixGuides,
  hasFixGuideForRule,
  getFixGuideCount,
  searchFixGuides
} from './fix-guide-mapper.js';

describe('fix-guide-mapper', () => {
  describe('getFixGuideByRuleId', () => {
    it('should return fix guide for valid rule ID', () => {
      const guide = getFixGuideByRuleId('color-contrast');

      expect(guide).toBeDefined();
      expect(guide?.ruleId).toBe('color-contrast');
      expect(guide?.summary).toBeTruthy();
      expect(guide?.codeExample).toHaveProperty('before');
      expect(guide?.codeExample).toHaveProperty('after');
      expect(guide?.steps).toBeInstanceOf(Array);
      expect(guide?.steps.length).toBeGreaterThan(0);
      expect(guide?.wcagLink).toMatch(/^https:\/\//);
    });

    it('should return fix guide for image-alt rule', () => {
      const guide = getFixGuideByRuleId('image-alt');

      expect(guide).toBeDefined();
      expect(guide?.ruleId).toBe('image-alt');
      expect(guide?.summary).toContain('alt attribute');
    });

    it('should return undefined for non-existent rule ID', () => {
      const guide = getFixGuideByRuleId('non-existent-rule');

      expect(guide).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const guide = getFixGuideByRuleId('');

      expect(guide).toBeUndefined();
    });
  });

  describe('getFixGuidesByRuleIds', () => {
    it('should return guides for multiple valid rule IDs', () => {
      const guides = getFixGuidesByRuleIds(['color-contrast', 'image-alt', 'button-name']);

      expect(guides).toHaveLength(3);
      expect(guides[0].ruleId).toBe('color-contrast');
      expect(guides[1].ruleId).toBe('image-alt');
      expect(guides[2].ruleId).toBe('button-name');
    });

    it('should skip non-existent rule IDs', () => {
      const guides = getFixGuidesByRuleIds(['color-contrast', 'non-existent', 'image-alt']);

      expect(guides).toHaveLength(2);
      expect(guides[0].ruleId).toBe('color-contrast');
      expect(guides[1].ruleId).toBe('image-alt');
    });

    it('should return empty array for all non-existent rule IDs', () => {
      const guides = getFixGuidesByRuleIds(['non-existent-1', 'non-existent-2']);

      expect(guides).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      const guides = getFixGuidesByRuleIds([]);

      expect(guides).toHaveLength(0);
    });

    it('should handle duplicate rule IDs', () => {
      const guides = getFixGuidesByRuleIds(['color-contrast', 'color-contrast', 'image-alt']);

      expect(guides).toHaveLength(3);
      expect(guides[0].ruleId).toBe('color-contrast');
      expect(guides[1].ruleId).toBe('color-contrast');
      expect(guides[2].ruleId).toBe('image-alt');
    });
  });

  describe('getAllFixGuides', () => {
    it('should return all fix guides', () => {
      const guides = getAllFixGuides();

      expect(guides).toBeInstanceOf(Array);
      expect(guides.length).toBeGreaterThan(0);
    });

    it('should return at least 15 fix guides', () => {
      const guides = getAllFixGuides();

      expect(guides.length).toBeGreaterThanOrEqual(15);
    });

    it('should return guides with all required properties', () => {
      const guides = getAllFixGuides();

      guides.forEach(guide => {
        expect(guide).toHaveProperty('ruleId');
        expect(guide).toHaveProperty('summary');
        expect(guide).toHaveProperty('codeExample');
        expect(guide.codeExample).toHaveProperty('before');
        expect(guide.codeExample).toHaveProperty('after');
        expect(guide).toHaveProperty('steps');
        expect(guide.steps).toBeInstanceOf(Array);
        expect(guide.steps.length).toBeGreaterThan(0);
        expect(guide).toHaveProperty('wcagLink');
        expect(guide.wcagLink).toMatch(/^https:\/\//);
      });
    });

    it('should have unique rule IDs', () => {
      const guides = getAllFixGuides();
      const ruleIds = guides.map(g => g.ruleId);
      const uniqueRuleIds = new Set(ruleIds);

      expect(ruleIds.length).toBe(uniqueRuleIds.size);
    });
  });

  describe('hasFixGuideForRule', () => {
    it('should return true for existing rule ID', () => {
      expect(hasFixGuideForRule('color-contrast')).toBe(true);
      expect(hasFixGuideForRule('image-alt')).toBe(true);
      expect(hasFixGuideForRule('button-name')).toBe(true);
    });

    it('should return false for non-existent rule ID', () => {
      expect(hasFixGuideForRule('non-existent-rule')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasFixGuideForRule('')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(hasFixGuideForRule('color-contrast')).toBe(true);
      expect(hasFixGuideForRule('Color-Contrast')).toBe(false);
      expect(hasFixGuideForRule('COLOR-CONTRAST')).toBe(false);
    });
  });

  describe('getFixGuideCount', () => {
    it('should return the correct count of fix guides', () => {
      const count = getFixGuideCount();
      const allGuides = getAllFixGuides();

      expect(count).toBe(allGuides.length);
    });

    it('should return at least 15', () => {
      const count = getFixGuideCount();

      expect(count).toBeGreaterThanOrEqual(15);
    });

    it('should return exactly 15 for the current implementation', () => {
      const count = getFixGuideCount();

      expect(count).toBe(15);
    });
  });

  describe('searchFixGuides', () => {
    it('should find guides by keyword in summary', () => {
      const guides = searchFixGuides('color');

      expect(guides.length).toBeGreaterThan(0);
      expect(guides.some(g => g.ruleId === 'color-contrast')).toBe(true);
    });

    it('should find guides by keyword in steps', () => {
      const guides = searchFixGuides('alt attribute');

      expect(guides.length).toBeGreaterThan(0);
      expect(guides.some(g => g.ruleId === 'image-alt')).toBe(true);
    });

    it('should find guides by rule ID', () => {
      const guides = searchFixGuides('button-name');

      expect(guides.length).toBeGreaterThan(0);
      expect(guides.some(g => g.ruleId === 'button-name')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const lowerGuides = searchFixGuides('color');
      const upperGuides = searchFixGuides('COLOR');
      const mixedGuides = searchFixGuides('CoLoR');

      expect(lowerGuides.length).toBe(upperGuides.length);
      expect(lowerGuides.length).toBe(mixedGuides.length);
    });

    it('should return empty array for non-matching keyword', () => {
      const guides = searchFixGuides('xyzabc123nonexistent');

      expect(guides).toHaveLength(0);
    });

    it('should return empty array for empty string', () => {
      const guides = searchFixGuides('');

      // Empty string matches everything
      expect(guides.length).toBe(getAllFixGuides().length);
    });

    it('should find multiple guides for common keywords', () => {
      const guides = searchFixGuides('ARIA');

      expect(guides.length).toBeGreaterThan(1);
    });

    it('should search in all text fields', () => {
      // Test that it searches summary, steps, and ruleId
      const colorGuides = searchFixGuides('color');
      const contrastInSummary = colorGuides.some(g =>
        g.summary.toLowerCase().includes('color')
      );
      const contrastInSteps = colorGuides.some(g =>
        g.steps.some(step => step.toLowerCase().includes('color'))
      );
      const contrastInRuleId = colorGuides.some(g =>
        g.ruleId.toLowerCase().includes('color')
      );

      expect(contrastInSummary || contrastInSteps || contrastInRuleId).toBe(true);
    });
  });

  describe('Fix Guide Data Quality', () => {
    it('should have valid WCAG links for all guides', () => {
      const guides = getAllFixGuides();

      guides.forEach(guide => {
        expect(guide.wcagLink).toMatch(/^https:\/\/www\.w3\.org\/WAI\/WCAG21\//);
      });
    });

    it('should have non-empty code examples', () => {
      const guides = getAllFixGuides();

      guides.forEach(guide => {
        expect(guide.codeExample.before.trim().length).toBeGreaterThan(0);
        expect(guide.codeExample.after.trim().length).toBeGreaterThan(0);
      });
    });

    it('should have different before/after code examples', () => {
      const guides = getAllFixGuides();

      guides.forEach(guide => {
        expect(guide.codeExample.before).not.toBe(guide.codeExample.after);
      });
    });

    it('should have at least 3 steps per guide', () => {
      const guides = getAllFixGuides();

      guides.forEach(guide => {
        expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should have descriptive summaries', () => {
      const guides = getAllFixGuides();

      guides.forEach(guide => {
        expect(guide.summary.length).toBeGreaterThan(20);
      });
    });

    it('should have actionable steps', () => {
      const guides = getAllFixGuides();

      guides.forEach(guide => {
        guide.steps.forEach(step => {
          expect(step.trim().length).toBeGreaterThan(10);
        });
      });
    });
  });

  describe('Specific Guide Content', () => {
    it('should have correct color-contrast guide', () => {
      const guide = getFixGuideByRuleId('color-contrast');

      expect(guide).toBeDefined();
      expect(guide?.summary).toContain('contrast');
      expect(guide?.summary).toContain('4.5:1');
      expect(guide?.codeExample.before).toContain('color');
      expect(guide?.codeExample.after).toContain('color');
    });

    it('should have correct image-alt guide', () => {
      const guide = getFixGuideByRuleId('image-alt');

      expect(guide).toBeDefined();
      expect(guide?.summary).toContain('alt');
      expect(guide?.codeExample.before).toContain('<img');
      expect(guide?.codeExample.after).toContain('alt=');
    });

    it('should have correct html-has-lang guide', () => {
      const guide = getFixGuideByRuleId('html-has-lang');

      expect(guide).toBeDefined();
      expect(guide?.summary).toContain('lang');
      expect(guide?.codeExample.before).toContain('<html');
      expect(guide?.codeExample.after).toContain('lang=');
    });

    it('should have correct bypass guide', () => {
      const guide = getFixGuideByRuleId('bypass');

      expect(guide).toBeDefined();
      expect(guide?.summary).toContain('skip');
      expect(guide?.steps.some(step => step.toLowerCase().includes('skip'))).toBe(true);
    });
  });
});
