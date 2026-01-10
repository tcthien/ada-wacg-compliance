import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateSummary,
  getJsonSummary,
  printJsonSummary,
  ProcessingSummary,
  SummaryStats,
  ProcessingStatus,
} from '../src/summary-generator.js';

describe('Summary Generator', () => {
  describe('generateSummary()', () => {
    describe('Status determination', () => {
      it('should return status="completed" when all URLs are successful', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'),
          filesProcessed: 1,
          totalUrls: 10,
          successful: 10,
          failed: 0,
          skipped: 0,
          outputFiles: ['output1.json'],
          failedFiles: [],
          errors: [],
        };

        const summary = generateSummary(stats);

        expect(summary.status).toBe('completed');
        expect(summary.successful).toBe(10);
        expect(summary.failed).toBe(0);
      });

      it('should return status="partial_failure" when some URLs failed', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'),
          filesProcessed: 2,
          totalUrls: 10,
          successful: 7,
          failed: 3,
          skipped: 0,
          outputFiles: ['output1.json', 'output2.json'],
          failedFiles: ['failed1.json'],
          errors: ['Error 1', 'Error 2', 'Error 3'],
        };

        const summary = generateSummary(stats);

        expect(summary.status).toBe('partial_failure');
        expect(summary.successful).toBe(7);
        expect(summary.failed).toBe(3);
      });

      it('should return status="complete_failure" when all URLs failed', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'),
          filesProcessed: 1,
          totalUrls: 5,
          successful: 0,
          failed: 5,
          skipped: 0,
          outputFiles: [],
          failedFiles: ['failed1.json', 'failed2.json'],
          errors: ['Error 1', 'Error 2', 'Error 3', 'Error 4', 'Error 5'],
        };

        const summary = generateSummary(stats);

        expect(summary.status).toBe('complete_failure');
        expect(summary.successful).toBe(0);
        expect(summary.failed).toBe(5);
      });
    });

    describe('Count verification', () => {
      it('should correctly report 100 successful and 5 failed URLs', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:30:00Z'),
          filesProcessed: 5,
          totalUrls: 105,
          successful: 100,
          failed: 5,
          skipped: 0,
          outputFiles: ['output1.json', 'output2.json', 'output3.json', 'output4.json', 'output5.json'],
          failedFiles: ['failed1.json'],
          errors: ['Error 1', 'Error 2', 'Error 3', 'Error 4', 'Error 5'],
        };

        const summary = generateSummary(stats);

        expect(summary.status).toBe('partial_failure');
        expect(summary.successful).toBe(100);
        expect(summary.failed).toBe(5);
        expect(summary.total_urls).toBe(105);
        expect(summary.files_processed).toBe(5);
        expect(summary.output_files).toHaveLength(5);
        expect(summary.failed_files).toHaveLength(1);
        expect(summary.errors).toHaveLength(5);
      });

      it('should correctly handle skipped URLs in counts', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:15:00Z'),
          filesProcessed: 2,
          totalUrls: 20,
          successful: 15,
          failed: 2,
          skipped: 3,
          outputFiles: ['output1.json', 'output2.json'],
          failedFiles: [],
          errors: ['Error 1', 'Error 2'],
        };

        const summary = generateSummary(stats);

        expect(summary.successful).toBe(15);
        expect(summary.failed).toBe(2);
        expect(summary.skipped).toBe(3);
        expect(summary.total_urls).toBe(20);
      });
    });

    describe('Duration calculation', () => {
      it('should calculate correct duration in seconds from start to end', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'), // 5 minutes = 300 seconds
          filesProcessed: 1,
          totalUrls: 10,
          successful: 10,
          failed: 0,
          skipped: 0,
          outputFiles: ['output.json'],
          failedFiles: [],
          errors: [],
        };

        const summary = generateSummary(stats);

        expect(summary.duration_seconds).toBe(300);
      });

      it('should round duration to 2 decimal places', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00.000Z'),
          endTime: new Date('2024-01-01T10:00:01.456Z'), // 1.456 seconds
          filesProcessed: 1,
          totalUrls: 1,
          successful: 1,
          failed: 0,
          skipped: 0,
          outputFiles: ['output.json'],
          failedFiles: [],
          errors: [],
        };

        const summary = generateSummary(stats);

        expect(summary.duration_seconds).toBe(1.46);
      });

      it('should handle sub-second durations correctly', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00.000Z'),
          endTime: new Date('2024-01-01T10:00:00.123Z'), // 0.123 seconds
          filesProcessed: 1,
          totalUrls: 1,
          successful: 1,
          failed: 0,
          skipped: 0,
          outputFiles: ['output.json'],
          failedFiles: [],
          errors: [],
        };

        const summary = generateSummary(stats);

        expect(summary.duration_seconds).toBe(0.12);
      });

      it('should handle long durations (hours) correctly', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T12:30:45Z'), // 2 hours, 30 minutes, 45 seconds
          filesProcessed: 10,
          totalUrls: 1000,
          successful: 995,
          failed: 5,
          skipped: 0,
          outputFiles: ['output1.json', 'output2.json'],
          failedFiles: [],
          errors: [],
        };

        const summary = generateSummary(stats);

        // 2 * 3600 + 30 * 60 + 45 = 7200 + 1800 + 45 = 9045 seconds
        expect(summary.duration_seconds).toBe(9045);
      });
    });

    describe('Complete summary object', () => {
      it('should generate complete summary with all required fields', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:10:00Z'),
          filesProcessed: 3,
          totalUrls: 50,
          successful: 45,
          failed: 3,
          skipped: 2,
          outputFiles: ['output1.json', 'output2.json', 'output3.json'],
          failedFiles: ['failed1.json'],
          errors: ['Error processing URL 1', 'Error processing URL 2', 'Error processing URL 3'],
        };

        const summary = generateSummary(stats);

        // Verify all fields are present
        expect(summary).toHaveProperty('status');
        expect(summary).toHaveProperty('files_processed');
        expect(summary).toHaveProperty('total_urls');
        expect(summary).toHaveProperty('successful');
        expect(summary).toHaveProperty('failed');
        expect(summary).toHaveProperty('skipped');
        expect(summary).toHaveProperty('duration_seconds');
        expect(summary).toHaveProperty('output_files');
        expect(summary).toHaveProperty('failed_files');
        expect(summary).toHaveProperty('errors');

        // Verify values
        expect(summary.status).toBe('partial_failure');
        expect(summary.files_processed).toBe(3);
        expect(summary.total_urls).toBe(50);
        expect(summary.successful).toBe(45);
        expect(summary.failed).toBe(3);
        expect(summary.skipped).toBe(2);
        expect(summary.duration_seconds).toBe(600); // 10 minutes
        expect(summary.output_files).toEqual(['output1.json', 'output2.json', 'output3.json']);
        expect(summary.failed_files).toEqual(['failed1.json']);
        expect(summary.errors).toEqual([
          'Error processing URL 1',
          'Error processing URL 2',
          'Error processing URL 3',
        ]);
      });

      it('should handle empty arrays for files and errors', () => {
        const stats: SummaryStats = {
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:01:00Z'),
          filesProcessed: 0,
          totalUrls: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          outputFiles: [],
          failedFiles: [],
          errors: [],
        };

        const summary = generateSummary(stats);

        expect(summary.output_files).toEqual([]);
        expect(summary.failed_files).toEqual([]);
        expect(summary.errors).toEqual([]);
        expect(summary.status).toBe('completed'); // No failures = completed
      });
    });
  });

  describe('getJsonSummary()', () => {
    it('should return valid JSON string with all required fields', () => {
      const summary: ProcessingSummary = {
        status: 'completed',
        files_processed: 1,
        total_urls: 10,
        successful: 10,
        failed: 0,
        skipped: 0,
        duration_seconds: 60.5,
        output_files: ['output.json'],
        failed_files: [],
        errors: [],
      };

      const jsonString = getJsonSummary(summary);

      // Verify it's valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Parse and verify structure
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual(summary);
    });

    it('should format JSON with 2-space indentation', () => {
      const summary: ProcessingSummary = {
        status: 'partial_failure',
        files_processed: 2,
        total_urls: 20,
        successful: 15,
        failed: 5,
        skipped: 0,
        duration_seconds: 120,
        output_files: ['output1.json', 'output2.json'],
        failed_files: ['failed1.json'],
        errors: ['Error 1', 'Error 2'],
      };

      const jsonString = getJsonSummary(summary);

      // Verify 2-space indentation by checking for "  " at line starts
      const lines = jsonString.split('\n');
      const indentedLines = lines.filter((line) => line.startsWith('  '));

      expect(indentedLines.length).toBeGreaterThan(0);

      // Verify no tabs are used
      expect(jsonString).not.toContain('\t');

      // Verify it matches JSON.stringify with 2-space indent
      expect(jsonString).toBe(JSON.stringify(summary, null, 2));
    });

    it('should handle all status types correctly in JSON', () => {
      const statuses: ProcessingStatus[] = ['completed', 'partial_failure', 'complete_failure'];

      statuses.forEach((status) => {
        const summary: ProcessingSummary = {
          status,
          files_processed: 1,
          total_urls: 10,
          successful: status === 'completed' ? 10 : status === 'complete_failure' ? 0 : 5,
          failed: status === 'completed' ? 0 : status === 'complete_failure' ? 10 : 5,
          skipped: 0,
          duration_seconds: 60,
          output_files: [],
          failed_files: [],
          errors: [],
        };

        const jsonString = getJsonSummary(summary);
        const parsed = JSON.parse(jsonString);

        expect(parsed.status).toBe(status);
      });
    });

    it('should preserve array order in JSON output', () => {
      const summary: ProcessingSummary = {
        status: 'partial_failure',
        files_processed: 5,
        total_urls: 100,
        successful: 95,
        failed: 5,
        skipped: 0,
        duration_seconds: 300,
        output_files: ['file1.json', 'file2.json', 'file3.json', 'file4.json', 'file5.json'],
        failed_files: ['failed1.json', 'failed2.json'],
        errors: ['Error A', 'Error B', 'Error C'],
      };

      const jsonString = getJsonSummary(summary);
      const parsed = JSON.parse(jsonString);

      expect(parsed.output_files).toEqual(summary.output_files);
      expect(parsed.failed_files).toEqual(summary.failed_files);
      expect(parsed.errors).toEqual(summary.errors);
    });
  });

  describe('printJsonSummary()', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Mock console.log before each test
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.log after each test
      consoleLogSpy.mockRestore();
    });

    it('should call console.log with formatted JSON string', () => {
      const summary: ProcessingSummary = {
        status: 'completed',
        files_processed: 1,
        total_urls: 10,
        successful: 10,
        failed: 0,
        skipped: 0,
        duration_seconds: 60,
        output_files: ['output.json'],
        failed_files: [],
        errors: [],
      };

      printJsonSummary(summary);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(summary, null, 2));
    });

    it('should print valid parseable JSON', () => {
      const summary: ProcessingSummary = {
        status: 'partial_failure',
        files_processed: 3,
        total_urls: 50,
        successful: 45,
        failed: 5,
        skipped: 0,
        duration_seconds: 180.75,
        output_files: ['output1.json', 'output2.json', 'output3.json'],
        failed_files: ['failed1.json'],
        errors: ['Error 1', 'Error 2'],
      };

      printJsonSummary(summary);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      const printedValue = consoleLogSpy.mock.calls[0][0];

      // Verify it's valid JSON
      expect(() => JSON.parse(printedValue as string)).not.toThrow();

      // Verify content matches
      const parsed = JSON.parse(printedValue as string);
      expect(parsed).toEqual(summary);
    });

    it('should print complete_failure status correctly', () => {
      const summary: ProcessingSummary = {
        status: 'complete_failure',
        files_processed: 2,
        total_urls: 20,
        successful: 0,
        failed: 20,
        skipped: 0,
        duration_seconds: 45.5,
        output_files: [],
        failed_files: ['failed1.json', 'failed2.json'],
        errors: ['All scans failed'],
      };

      printJsonSummary(summary);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      const printedValue = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(printedValue as string);

      expect(parsed.status).toBe('complete_failure');
      expect(parsed.successful).toBe(0);
      expect(parsed.failed).toBe(20);
    });

    it('should not throw when printing empty arrays', () => {
      const summary: ProcessingSummary = {
        status: 'completed',
        files_processed: 0,
        total_urls: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        duration_seconds: 0,
        output_files: [],
        failed_files: [],
        errors: [],
      };

      expect(() => printJsonSummary(summary)).not.toThrow();
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases and integration', () => {
    it('should handle zero duration correctly', () => {
      const stats: SummaryStats = {
        startTime: new Date('2024-01-01T10:00:00.000Z'),
        endTime: new Date('2024-01-01T10:00:00.000Z'), // Same time
        filesProcessed: 1,
        totalUrls: 1,
        successful: 1,
        failed: 0,
        skipped: 0,
        outputFiles: ['output.json'],
        failedFiles: [],
        errors: [],
      };

      const summary = generateSummary(stats);

      expect(summary.duration_seconds).toBe(0);
    });

    it('should handle large numbers of URLs correctly', () => {
      const stats: SummaryStats = {
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T12:00:00Z'),
        filesProcessed: 100,
        totalUrls: 10000,
        successful: 9995,
        failed: 5,
        skipped: 0,
        outputFiles: Array.from({ length: 100 }, (_, i) => `output${i + 1}.json`),
        failedFiles: ['failed1.json'],
        errors: ['Error 1', 'Error 2', 'Error 3', 'Error 4', 'Error 5'],
      };

      const summary = generateSummary(stats);

      expect(summary.total_urls).toBe(10000);
      expect(summary.successful).toBe(9995);
      expect(summary.failed).toBe(5);
      expect(summary.files_processed).toBe(100);
      expect(summary.output_files).toHaveLength(100);
    });

    it('should produce identical results when called multiple times with same input', () => {
      const stats: SummaryStats = {
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:05:00Z'),
        filesProcessed: 2,
        totalUrls: 30,
        successful: 25,
        failed: 5,
        skipped: 0,
        outputFiles: ['output1.json', 'output2.json'],
        failedFiles: ['failed1.json'],
        errors: ['Error 1', 'Error 2'],
      };

      const summary1 = generateSummary(stats);
      const summary2 = generateSummary(stats);
      const summary3 = generateSummary(stats);

      expect(summary1).toEqual(summary2);
      expect(summary2).toEqual(summary3);
    });

    it('should maintain data integrity through full pipeline (generate → getJson → parse)', () => {
      const stats: SummaryStats = {
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:15:30.789Z'),
        filesProcessed: 5,
        totalUrls: 100,
        successful: 90,
        failed: 8,
        skipped: 2,
        outputFiles: ['output1.json', 'output2.json', 'output3.json', 'output4.json', 'output5.json'],
        failedFiles: ['failed1.json', 'failed2.json'],
        errors: ['Error 1', 'Error 2', 'Error 3', 'Error 4', 'Error 5', 'Error 6', 'Error 7', 'Error 8'],
      };

      // Generate summary
      const summary = generateSummary(stats);

      // Convert to JSON
      const jsonString = getJsonSummary(summary);

      // Parse back
      const parsed = JSON.parse(jsonString);

      // Verify all data is preserved
      expect(parsed.status).toBe(summary.status);
      expect(parsed.files_processed).toBe(summary.files_processed);
      expect(parsed.total_urls).toBe(summary.total_urls);
      expect(parsed.successful).toBe(summary.successful);
      expect(parsed.failed).toBe(summary.failed);
      expect(parsed.skipped).toBe(summary.skipped);
      expect(parsed.duration_seconds).toBe(summary.duration_seconds);
      expect(parsed.output_files).toEqual(summary.output_files);
      expect(parsed.failed_files).toEqual(summary.failed_files);
      expect(parsed.errors).toEqual(summary.errors);
    });
  });
});
