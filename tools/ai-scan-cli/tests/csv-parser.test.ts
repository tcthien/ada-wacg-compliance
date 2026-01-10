import { describe, it, expect } from 'vitest';
import { parseInputCsv, ParseResult } from '../src/csv-parser.js';
import { PendingScan, WcagLevel } from '../src/types.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get directory path for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to get fixture file path
function getFixturePath(filename: string): string {
  return resolve(__dirname, 'fixtures', filename);
}

describe('CSV Parser', () => {
  describe('Valid CSV parsing', () => {
    it('should parse valid CSV with 5 rows and return 5 PendingScan objects', async () => {
      const filePath = getFixturePath('valid-5-rows.csv');
      const result: ParseResult = await parseInputCsv(filePath);

      // Verify basic counts
      expect(result.scans).toHaveLength(5);
      expect(result.skipped).toHaveLength(0);
      expect(result.totalRows).toBe(5);

      // Verify first scan details
      expect(result.scans[0]).toEqual({
        scanId: 'scan-001',
        url: 'https://example.com',
        email: 'user1@example.com',
        wcagLevel: 'AA',
        createdAt: '2024-01-01T10:00:00Z',
      });

      // Verify third scan (no email)
      expect(result.scans[2]).toEqual({
        scanId: 'scan-003',
        url: 'https://demo.org',
        wcagLevel: 'AAA',
        createdAt: '2024-01-03T10:00:00Z',
      });

      // Verify last scan (no email, no createdAt)
      expect(result.scans[4]).toEqual({
        scanId: 'scan-005',
        url: 'https://website.io',
        wcagLevel: 'A',
      });

      // Verify all WCAG levels are valid
      const validLevels: WcagLevel[] = ['A', 'AA', 'AAA'];
      result.scans.forEach((scan) => {
        expect(validLevels).toContain(scan.wcagLevel);
      });

      // Verify HTTP and HTTPS URLs are both accepted
      const httpScan = result.scans.find((s) => s.url.startsWith('http://'));
      expect(httpScan).toBeDefined();
      expect(httpScan?.scanId).toBe('scan-004');
    });
  });

  describe('Empty CSV handling', () => {
    it('should return empty array with totalRows=0 for CSV with headers only', async () => {
      const filePath = getFixturePath('empty-headers-only.csv');
      const result: ParseResult = await parseInputCsv(filePath);

      expect(result.scans).toHaveLength(0);
      expect(result.scans).toEqual([]);
      expect(result.skipped).toHaveLength(0);
      expect(result.totalRows).toBe(0);
    });
  });

  describe('Empty URL validation', () => {
    it('should skip row 3 with empty URL and add to skipped array with reason', async () => {
      const filePath = getFixturePath('empty-url-row3.csv');
      const result: ParseResult = await parseInputCsv(filePath);

      // Should parse 3 valid scans (rows 2, 3, and 5 in CSV - rows 1, 2, 4 of data)
      expect(result.scans).toHaveLength(3);
      expect(result.totalRows).toBe(4);
      expect(result.skipped).toHaveLength(1);

      // Verify skipped row details
      const skippedRow = result.skipped[0];
      expect(skippedRow.row).toBe(4); // Row 4 in file (header=1, data rows 2,3,4,5)
      expect(skippedRow.reason).toBe('Empty URL');

      // Verify the valid scans were parsed correctly
      expect(result.scans[0].scanId).toBe('scan-001');
      expect(result.scans[1].scanId).toBe('scan-002');
      expect(result.scans[2].scanId).toBe('scan-004');

      // Verify scan-003 is NOT in the results
      const hasScan003 = result.scans.some((s) => s.scanId === 'scan-003');
      expect(hasScan003).toBe(false);
    });
  });

  describe('Invalid WCAG level validation', () => {
    it('should skip row with invalid wcag_level "B" and add to skipped array', async () => {
      const filePath = getFixturePath('invalid-wcag-level.csv');
      const result: ParseResult = await parseInputCsv(filePath);

      // Should parse 2 valid scans (scan-001 and scan-003)
      expect(result.scans).toHaveLength(2);
      expect(result.totalRows).toBe(3);
      expect(result.skipped).toHaveLength(1);

      // Verify skipped row details
      const skippedRow = result.skipped[0];
      expect(skippedRow.row).toBe(3); // Row 3 in file (header + 2 data rows)
      expect(skippedRow.reason).toBe("Invalid wcag_level 'B' (must be A, AA, or AAA)");

      // Verify the valid scans were parsed correctly
      expect(result.scans[0].scanId).toBe('scan-001');
      expect(result.scans[0].wcagLevel).toBe('AA');
      expect(result.scans[1].scanId).toBe('scan-003');
      expect(result.scans[1].wcagLevel).toBe('AAA');

      // Verify scan-002 is NOT in the results
      const hasScan002 = result.scans.some((s) => s.scanId === 'scan-002');
      expect(hasScan002).toBe(false);
    });
  });

  describe('File not found error handling', () => {
    it('should throw error with file path when file does not exist', async () => {
      const nonExistentPath = getFixturePath('non-existent-file.csv');

      await expect(parseInputCsv(nonExistentPath)).rejects.toThrow();

      try {
        await parseInputCsv(nonExistentPath);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('File read error');
        expect((error as Error).message).toMatch(/ENOENT|no such file/i);
      }
    });
  });

  describe('Stress test - large CSV files', () => {
    it('should parse CSV with 1000 rows without memory issues', async () => {
      const filePath = getFixturePath('large-1000-rows.csv');

      // Track memory before
      const memBefore = process.memoryUsage();

      const result: ParseResult = await parseInputCsv(filePath);

      // Track memory after
      const memAfter = process.memoryUsage();

      // Verify all 1000 rows were parsed
      expect(result.scans).toHaveLength(1000);
      expect(result.totalRows).toBe(1000);
      expect(result.skipped).toHaveLength(0);

      // Verify first scan
      expect(result.scans[0]).toEqual({
        scanId: 'scan-0001',
        url: 'https://example-1.com',
        email: 'user1@example.com',
        wcagLevel: 'AA',
        createdAt: '2024-01-01T10:00:00Z',
      });

      // Verify last scan
      expect(result.scans[999]).toEqual({
        scanId: 'scan-1000',
        url: 'https://example-1000.com',
        email: 'user1000@example.com',
        wcagLevel: 'AA',
        createdAt: '2024-01-01T10:00:00Z',
      });

      // Verify middle scan (500th)
      expect(result.scans[499].scanId).toBe('scan-0500');
      expect(result.scans[499].url).toBe('https://example-500.com');

      // Memory increase should be reasonable (less than 50MB for 1000 rows)
      const memIncrease = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
      expect(memIncrease).toBeLessThan(50);

      // Verify data integrity - all scan IDs should be unique
      const scanIds = result.scans.map((s) => s.scanId);
      const uniqueScanIds = new Set(scanIds);
      expect(uniqueScanIds.size).toBe(1000);

      // Verify all URLs are properly formatted
      result.scans.forEach((scan, index) => {
        expect(scan.url).toMatch(/^https:\/\/example-\d+\.com$/);
        expect(scan.email).toMatch(/^user\d+@example\.com$/);
        expect(scan.wcagLevel).toBe('AA');
      });
    });
  });

  describe('Additional edge cases', () => {
    it('should handle URLs with different protocols (http vs https)', async () => {
      const filePath = getFixturePath('valid-5-rows.csv');
      const result: ParseResult = await parseInputCsv(filePath);

      const httpUrls = result.scans.filter((s) => s.url.startsWith('http://'));
      const httpsUrls = result.scans.filter((s) => s.url.startsWith('https://'));

      expect(httpUrls.length).toBeGreaterThan(0);
      expect(httpsUrls.length).toBeGreaterThan(0);
      expect(httpUrls.length + httpsUrls.length).toBe(result.scans.length);
    });

    it('should handle optional fields correctly', async () => {
      const filePath = getFixturePath('valid-5-rows.csv');
      const result: ParseResult = await parseInputCsv(filePath);

      // Some scans should have email, some should not
      const scansWithEmail = result.scans.filter((s) => s.email !== undefined);
      const scansWithoutEmail = result.scans.filter((s) => s.email === undefined);

      expect(scansWithEmail.length).toBeGreaterThan(0);
      expect(scansWithoutEmail.length).toBeGreaterThan(0);

      // Some scans should have createdAt, some should not
      const scansWithCreatedAt = result.scans.filter((s) => s.createdAt !== undefined);
      const scansWithoutCreatedAt = result.scans.filter((s) => s.createdAt === undefined);

      expect(scansWithCreatedAt.length).toBeGreaterThan(0);
      expect(scansWithoutCreatedAt.length).toBeGreaterThan(0);
    });

    it('should validate all required fields are present', async () => {
      const filePath = getFixturePath('valid-5-rows.csv');
      const result: ParseResult = await parseInputCsv(filePath);

      // All scans must have scanId, url, and wcagLevel
      result.scans.forEach((scan) => {
        expect(scan.scanId).toBeDefined();
        expect(scan.scanId).not.toBe('');
        expect(scan.url).toBeDefined();
        expect(scan.url).not.toBe('');
        expect(scan.wcagLevel).toBeDefined();
        expect(['A', 'AA', 'AAA']).toContain(scan.wcagLevel);
      });
    });
  });
});
