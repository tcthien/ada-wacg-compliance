import { describe, it, expect } from 'vitest';
import {
  Severity,
  SEVERITY_LEVELS,
  AXE_IMPACT_TO_SEVERITY,
  getSeverityInfo,
  getSeveritiesByPriority,
  mapAxeImpactToSeverity,
  compareSeverity,
  isHigherSeverity,
  filterByMinimumSeverity
} from '../severity.constants.js';

describe('Severity Constants', () => {
  describe('Severity enum', () => {
    it('should have all required severity levels', () => {
      expect(Severity.CRITICAL).toBe('critical');
      expect(Severity.SERIOUS).toBe('serious');
      expect(Severity.MODERATE).toBe('moderate');
      expect(Severity.MINOR).toBe('minor');
    });
  });

  describe('SEVERITY_LEVELS', () => {
    it('should contain all severity levels', () => {
      expect(Object.keys(SEVERITY_LEVELS)).toHaveLength(4);
      expect(SEVERITY_LEVELS[Severity.CRITICAL]).toBeDefined();
      expect(SEVERITY_LEVELS[Severity.SERIOUS]).toBeDefined();
      expect(SEVERITY_LEVELS[Severity.MODERATE]).toBeDefined();
      expect(SEVERITY_LEVELS[Severity.MINOR]).toBeDefined();
    });

    it('should have all required properties for each level', () => {
      Object.values(SEVERITY_LEVELS).forEach(info => {
        expect(info).toHaveProperty('level');
        expect(info).toHaveProperty('priority');
        expect(info).toHaveProperty('label');
        expect(info).toHaveProperty('description');
        expect(info).toHaveProperty('userImpact');
        expect(info).toHaveProperty('remediationTimeframe');
        expect(info).toHaveProperty('color');

        expect(info.description).toBeTruthy();
        expect(info.userImpact).toBeTruthy();
        expect(info.remediationTimeframe).toBeTruthy();
        expect(info.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it('should have correct priority ordering', () => {
      expect(SEVERITY_LEVELS[Severity.CRITICAL].priority).toBe(4);
      expect(SEVERITY_LEVELS[Severity.SERIOUS].priority).toBe(3);
      expect(SEVERITY_LEVELS[Severity.MODERATE].priority).toBe(2);
      expect(SEVERITY_LEVELS[Severity.MINOR].priority).toBe(1);
    });

    it('should have unique priorities', () => {
      const priorities = Object.values(SEVERITY_LEVELS).map(info => info.priority);
      const uniquePriorities = new Set(priorities);
      expect(uniquePriorities.size).toBe(priorities.length);
    });
  });

  describe('AXE_IMPACT_TO_SEVERITY', () => {
    it('should map all axe-core impact levels', () => {
      expect(AXE_IMPACT_TO_SEVERITY['critical']).toBe(Severity.CRITICAL);
      expect(AXE_IMPACT_TO_SEVERITY['serious']).toBe(Severity.SERIOUS);
      expect(AXE_IMPACT_TO_SEVERITY['moderate']).toBe(Severity.MODERATE);
      expect(AXE_IMPACT_TO_SEVERITY['minor']).toBe(Severity.MINOR);
    });
  });

  describe('getSeverityInfo', () => {
    it('should return correct info for each severity level', () => {
      const critical = getSeverityInfo(Severity.CRITICAL);
      expect(critical.level).toBe(Severity.CRITICAL);
      expect(critical.priority).toBe(4);
      expect(critical.label).toBe('Critical');

      const minor = getSeverityInfo(Severity.MINOR);
      expect(minor.level).toBe(Severity.MINOR);
      expect(minor.priority).toBe(1);
      expect(minor.label).toBe('Minor');
    });
  });

  describe('getSeveritiesByPriority', () => {
    it('should return severities in descending priority order', () => {
      const severities = getSeveritiesByPriority();
      expect(severities).toHaveLength(4);
      expect(severities[0]?.level).toBe(Severity.CRITICAL);
      expect(severities[1]?.level).toBe(Severity.SERIOUS);
      expect(severities[2]?.level).toBe(Severity.MODERATE);
      expect(severities[3]?.level).toBe(Severity.MINOR);
    });

    it('should have priorities in descending order', () => {
      const severities = getSeveritiesByPriority();
      for (let i = 0; i < severities.length - 1; i++) {
        const current = severities[i];
        const next = severities[i + 1];
        if (current && next) {
          expect(current.priority).toBeGreaterThan(next.priority);
        }
      }
    });
  });

  describe('mapAxeImpactToSeverity', () => {
    it('should map axe-core impact to severity', () => {
      expect(mapAxeImpactToSeverity('critical')).toBe(Severity.CRITICAL);
      expect(mapAxeImpactToSeverity('serious')).toBe(Severity.SERIOUS);
      expect(mapAxeImpactToSeverity('moderate')).toBe(Severity.MODERATE);
      expect(mapAxeImpactToSeverity('minor')).toBe(Severity.MINOR);
    });

    it('should handle case-insensitive input', () => {
      expect(mapAxeImpactToSeverity('CRITICAL')).toBe(Severity.CRITICAL);
      expect(mapAxeImpactToSeverity('Serious')).toBe(Severity.SERIOUS);
    });

    it('should default to MODERATE for unknown impacts', () => {
      expect(mapAxeImpactToSeverity('unknown')).toBe(Severity.MODERATE);
      expect(mapAxeImpactToSeverity('')).toBe(Severity.MODERATE);
    });
  });

  describe('compareSeverity', () => {
    it('should return positive when a > b', () => {
      expect(compareSeverity(Severity.CRITICAL, Severity.SERIOUS)).toBeGreaterThan(0);
      expect(compareSeverity(Severity.SERIOUS, Severity.MODERATE)).toBeGreaterThan(0);
      expect(compareSeverity(Severity.MODERATE, Severity.MINOR)).toBeGreaterThan(0);
    });

    it('should return negative when a < b', () => {
      expect(compareSeverity(Severity.MINOR, Severity.MODERATE)).toBeLessThan(0);
      expect(compareSeverity(Severity.MODERATE, Severity.SERIOUS)).toBeLessThan(0);
      expect(compareSeverity(Severity.SERIOUS, Severity.CRITICAL)).toBeLessThan(0);
    });

    it('should return zero when a == b', () => {
      expect(compareSeverity(Severity.CRITICAL, Severity.CRITICAL)).toBe(0);
      expect(compareSeverity(Severity.MODERATE, Severity.MODERATE)).toBe(0);
    });
  });

  describe('isHigherSeverity', () => {
    it('should return true when a > b', () => {
      expect(isHigherSeverity(Severity.CRITICAL, Severity.SERIOUS)).toBe(true);
      expect(isHigherSeverity(Severity.SERIOUS, Severity.MINOR)).toBe(true);
    });

    it('should return false when a <= b', () => {
      expect(isHigherSeverity(Severity.MINOR, Severity.CRITICAL)).toBe(false);
      expect(isHigherSeverity(Severity.MODERATE, Severity.MODERATE)).toBe(false);
    });
  });

  describe('filterByMinimumSeverity', () => {
    it('should return only CRITICAL for CRITICAL minimum', () => {
      const filtered = filterByMinimumSeverity(Severity.CRITICAL);
      expect(filtered).toHaveLength(1);
      expect(filtered).toContain(Severity.CRITICAL);
    });

    it('should return CRITICAL and SERIOUS for SERIOUS minimum', () => {
      const filtered = filterByMinimumSeverity(Severity.SERIOUS);
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain(Severity.CRITICAL);
      expect(filtered).toContain(Severity.SERIOUS);
    });

    it('should return all except MINOR for MODERATE minimum', () => {
      const filtered = filterByMinimumSeverity(Severity.MODERATE);
      expect(filtered).toHaveLength(3);
      expect(filtered).toContain(Severity.CRITICAL);
      expect(filtered).toContain(Severity.SERIOUS);
      expect(filtered).toContain(Severity.MODERATE);
    });

    it('should return all severities for MINOR minimum', () => {
      const filtered = filterByMinimumSeverity(Severity.MINOR);
      expect(filtered).toHaveLength(4);
    });
  });
});
