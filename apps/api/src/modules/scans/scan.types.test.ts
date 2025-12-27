import { describe, it, expect } from 'vitest';
import {
  isWcagLevel,
  isScanStatus,
  isIssueImpact,
} from './scan.types.js';

describe('Scan Type Guards', () => {
  describe('isWcagLevel', () => {
    it('should return true for valid WCAG levels', () => {
      expect(isWcagLevel('A')).toBe(true);
      expect(isWcagLevel('AA')).toBe(true);
      expect(isWcagLevel('AAA')).toBe(true);
    });

    it('should return false for invalid WCAG levels', () => {
      expect(isWcagLevel('B')).toBe(false);
      expect(isWcagLevel('AAAA')).toBe(false);
      expect(isWcagLevel('a')).toBe(false);
      expect(isWcagLevel('aa')).toBe(false);
      expect(isWcagLevel('')).toBe(false);
      expect(isWcagLevel(null)).toBe(false);
      expect(isWcagLevel(undefined)).toBe(false);
      expect(isWcagLevel(123)).toBe(false);
      expect(isWcagLevel({})).toBe(false);
    });

    it('should narrow type to WcagLevel', () => {
      const value: unknown = 'AA';
      if (isWcagLevel(value)) {
        // Type should be narrowed to WcagLevel
        const level: 'A' | 'AA' | 'AAA' = value;
        expect(level).toBe('AA');
      }
    });
  });

  describe('isScanStatus', () => {
    it('should return true for valid scan statuses', () => {
      expect(isScanStatus('PENDING')).toBe(true);
      expect(isScanStatus('RUNNING')).toBe(true);
      expect(isScanStatus('COMPLETED')).toBe(true);
      expect(isScanStatus('FAILED')).toBe(true);
    });

    it('should return false for invalid scan statuses', () => {
      expect(isScanStatus('INVALID')).toBe(false);
      expect(isScanStatus('pending')).toBe(false);
      expect(isScanStatus('running')).toBe(false);
      expect(isScanStatus('')).toBe(false);
      expect(isScanStatus(null)).toBe(false);
      expect(isScanStatus(undefined)).toBe(false);
      expect(isScanStatus(123)).toBe(false);
      expect(isScanStatus({})).toBe(false);
    });

    it('should narrow type to ScanStatus', () => {
      const value: unknown = 'RUNNING';
      if (isScanStatus(value)) {
        // Type should be narrowed to ScanStatus
        const status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' = value;
        expect(status).toBe('RUNNING');
      }
    });
  });

  describe('isIssueImpact', () => {
    it('should return true for valid issue impacts', () => {
      expect(isIssueImpact('CRITICAL')).toBe(true);
      expect(isIssueImpact('SERIOUS')).toBe(true);
      expect(isIssueImpact('MODERATE')).toBe(true);
      expect(isIssueImpact('MINOR')).toBe(true);
    });

    it('should return false for invalid issue impacts', () => {
      expect(isIssueImpact('HIGH')).toBe(false);
      expect(isIssueImpact('LOW')).toBe(false);
      expect(isIssueImpact('critical')).toBe(false);
      expect(isIssueImpact('')).toBe(false);
      expect(isIssueImpact(null)).toBe(false);
      expect(isIssueImpact(undefined)).toBe(false);
      expect(isIssueImpact(123)).toBe(false);
      expect(isIssueImpact({})).toBe(false);
    });

    it('should narrow type to IssueImpact', () => {
      const value: unknown = 'SERIOUS';
      if (isIssueImpact(value)) {
        // Type should be narrowed to IssueImpact
        const impact: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR' = value;
        expect(impact).toBe('SERIOUS');
      }
    });
  });
});
