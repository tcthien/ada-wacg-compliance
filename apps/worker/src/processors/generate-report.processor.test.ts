/**
 * Generate Report Processor Tests
 *
 * Tests for the generate-report job processor.
 * Covers PDF generation, JSON generation, error handling, and retries.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Job } from 'bullmq';
import { processGenerateReport, ReportGenerationError } from './generate-report.processor.js';

// Mock dependencies
vi.mock('../config/prisma.js', () => ({
  getPrismaClient: vi.fn(),
}));

vi.mock('./reporter/pdf-generator.js', () => ({
  generatePdfReport: vi.fn(),
  uploadToS3: vi.fn(),
}));

vi.mock('./reporter/json-exporter.js', () => ({
  exportJsonReport: vi.fn(),
  uploadJsonToS3: vi.fn(),
}));

vi.mock('../utils/result-formatter.js', () => ({
  formatResult: vi.fn(),
}));

import { getPrismaClient } from '../config/prisma.js';
import { generatePdfReport, uploadToS3 as uploadPdfToS3 } from './reporter/pdf-generator.js';
import { exportJsonReport, uploadJsonToS3 } from './reporter/json-exporter.js';
import { formatResult } from '../utils/result-formatter.js';

describe('processGenerateReport', () => {
  // Mock Prisma client
  const mockPrisma = {
    scan: {
      findUnique: vi.fn(),
    },
    report: {
      create: vi.fn(),
    },
  };

  // Mock job
  const mockJob = {
    id: 'job-123',
    updateProgress: vi.fn(),
    data: {
      scanId: 'scan-123',
      format: 'PDF' as const,
      requestedBy: 'session-456',
    },
  } as unknown as Job;

  // Mock scan data
  const mockScan = {
    id: 'scan-123',
    url: 'https://example.com',
    status: 'COMPLETED',
    wcagLevel: 'AA',
    durationMs: 5000,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    completedAt: new Date('2024-01-01T00:00:05Z'),
    scanResult: {
      id: 'result-123',
      scanId: 'scan-123',
      totalIssues: 10,
      criticalCount: 2,
      seriousCount: 3,
      moderateCount: 3,
      minorCount: 2,
      passedChecks: 50,
      inapplicableChecks: 5,
      createdAt: new Date('2024-01-01T00:00:05Z'),
      issues: [
        {
          id: 'issue-1',
          scanResultId: 'result-123',
          ruleId: 'color-contrast',
          wcagCriteria: ['1.4.3'],
          impact: 'SERIOUS',
          description: 'Elements must have sufficient color contrast',
          helpText: 'Ensure text color contrasts with background',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/color-contrast',
          htmlSnippet: '<div>Low contrast text</div>',
          cssSelector: 'div.text',
          nodes: [],
          createdAt: new Date(),
        },
      ],
    },
  };

  // Mock formatted result
  const mockFormattedResult = {
    scanId: 'scan-123',
    url: 'https://example.com',
    wcagLevel: 'AA' as const,
    completedAt: new Date('2024-01-01T00:00:05Z'),
    summary: {
      totalIssues: 10,
      critical: 2,
      serious: 3,
      moderate: 3,
      minor: 2,
      passed: 50,
    },
    issuesByImpact: {
      critical: [],
      serious: [],
      moderate: [],
      minor: [],
    },
    metadata: {
      coverageNote: 'Automated testing detects approximately 57% of WCAG issues.',
      wcagVersion: '2.1',
      toolVersion: '1.0.0',
      scanDuration: 5000,
      inapplicableChecks: 5,
    },
  };

  // Mock report
  const mockReport = {
    id: 'report-123',
    scanId: 'scan-123',
    format: 'PDF' as const,
    storageKey: 'reports/scan-123/report.pdf',
    storageUrl: 'https://s3.example.com/reports/scan-123/report.pdf',
    fileSizeBytes: 1024,
    createdAt: new Date('2024-01-01T00:00:10Z'),
    expiresAt: new Date('2024-01-31T00:00:10Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma as any);
  });

  describe('PDF Generation', () => {
    it('should generate PDF report successfully', async () => {
      // Arrange
      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);
      vi.mocked(formatResult).mockReturnValue(mockFormattedResult);

      const pdfBuffer = Buffer.from('PDF content');
      vi.mocked(generatePdfReport).mockResolvedValue(pdfBuffer);
      vi.mocked(uploadPdfToS3).mockResolvedValue('https://s3.example.com/reports/scan-123/report.pdf');

      mockPrisma.report.create.mockResolvedValue(mockReport);

      // Act
      const result = await processGenerateReport(mockJob);

      // Assert
      expect(mockPrisma.scan.findUnique).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        include: {
          scanResult: {
            include: {
              issues: {
                orderBy: {
                  impact: 'asc',
                },
              },
            },
          },
        },
      });

      expect(formatResult).toHaveBeenCalledWith(mockScan);
      expect(generatePdfReport).toHaveBeenCalledWith(mockFormattedResult);
      expect(uploadPdfToS3).toHaveBeenCalledWith(pdfBuffer, 'reports/scan-123/report.pdf');

      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scanId: 'scan-123',
          format: 'PDF',
          storageKey: 'reports/scan-123/report.pdf',
          storageUrl: 'https://s3.example.com/reports/scan-123/report.pdf',
          fileSizeBytes: pdfBuffer.length,
        }),
      });

      expect(result).toEqual({
        reportId: 'report-123',
        scanId: 'scan-123',
        format: 'PDF',
        storageKey: 'reports/scan-123/report.pdf',
        storageUrl: 'https://s3.example.com/reports/scan-123/report.pdf',
        generatedAt: mockReport.createdAt,
      });

      // Verify progress updates
      expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(30);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(80);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });
  });

  describe('JSON Generation', () => {
    it('should generate JSON report successfully', async () => {
      // Arrange
      const jsonJob = {
        ...mockJob,
        data: {
          scanId: 'scan-123',
          format: 'JSON' as const,
        },
      } as unknown as Job;

      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);
      vi.mocked(formatResult).mockReturnValue(mockFormattedResult);

      const jsonBuffer = Buffer.from(JSON.stringify({ report: 'data' }));
      vi.mocked(exportJsonReport).mockResolvedValue({
        buffer: jsonBuffer,
        key: 'reports/scan-123/report.json',
      });
      vi.mocked(uploadJsonToS3).mockResolvedValue('https://s3.example.com/reports/scan-123/report.json');

      const jsonReport = {
        ...mockReport,
        format: 'JSON' as const,
        storageKey: 'reports/scan-123/report.json',
        storageUrl: 'https://s3.example.com/reports/scan-123/report.json',
      };
      mockPrisma.report.create.mockResolvedValue(jsonReport);

      // Act
      const result = await processGenerateReport(jsonJob);

      // Assert
      expect(formatResult).toHaveBeenCalledWith(mockScan);
      expect(exportJsonReport).toHaveBeenCalledWith(mockFormattedResult);
      expect(uploadJsonToS3).toHaveBeenCalledWith(jsonBuffer, 'reports/scan-123/report.json');

      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scanId: 'scan-123',
          format: 'JSON',
          storageKey: 'reports/scan-123/report.json',
          storageUrl: 'https://s3.example.com/reports/scan-123/report.json',
          fileSizeBytes: jsonBuffer.length,
        }),
      });

      expect(result.format).toBe('JSON');
      expect(result.storageKey).toBe('reports/scan-123/report.json');
    });
  });

  describe('Error Handling', () => {
    it('should throw ReportGenerationError when scan not found', async () => {
      // Arrange
      mockPrisma.scan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(processGenerateReport(mockJob)).rejects.toThrow(ReportGenerationError);
      await expect(processGenerateReport(mockJob)).rejects.toThrow('Scan not found: scan-123');

      try {
        await processGenerateReport(mockJob);
      } catch (error) {
        expect(error).toBeInstanceOf(ReportGenerationError);
        expect((error as ReportGenerationError).code).toBe('SCAN_NOT_FOUND');
      }
    });

    it('should throw ReportGenerationError when scan has no result data', async () => {
      // Arrange
      const incompleteScan = {
        ...mockScan,
        scanResult: null,
      };
      mockPrisma.scan.findUnique.mockResolvedValue(incompleteScan);

      // Act & Assert
      await expect(processGenerateReport(mockJob)).rejects.toThrow(ReportGenerationError);
      await expect(processGenerateReport(mockJob)).rejects.toThrow('has no result data');

      try {
        await processGenerateReport(mockJob);
      } catch (error) {
        expect(error).toBeInstanceOf(ReportGenerationError);
        expect((error as ReportGenerationError).code).toBe('SCAN_NOT_COMPLETE');
      }
    });

    it('should throw ReportGenerationError when scan is not completed', async () => {
      // Arrange
      const runningScan = {
        ...mockScan,
        status: 'RUNNING',
      };
      mockPrisma.scan.findUnique.mockResolvedValue(runningScan);

      // Act & Assert
      await expect(processGenerateReport(mockJob)).rejects.toThrow(ReportGenerationError);
      await expect(processGenerateReport(mockJob)).rejects.toThrow('is not complete');

      try {
        await processGenerateReport(mockJob);
      } catch (error) {
        expect(error).toBeInstanceOf(ReportGenerationError);
        expect((error as ReportGenerationError).code).toBe('SCAN_NOT_COMPLETE');
      }
    });

    it('should wrap PDF generation errors in ReportGenerationError', async () => {
      // Arrange
      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);
      vi.mocked(formatResult).mockReturnValue(mockFormattedResult);

      const pdfError = new Error('PDF generation failed');
      vi.mocked(generatePdfReport).mockRejectedValue(pdfError);

      // Act & Assert
      await expect(processGenerateReport(mockJob)).rejects.toThrow(ReportGenerationError);

      try {
        await processGenerateReport(mockJob);
      } catch (error) {
        expect(error).toBeInstanceOf(ReportGenerationError);
        expect((error as ReportGenerationError).code).toBe('GENERATION_FAILED');
        expect((error as ReportGenerationError).cause).toBe(pdfError);
      }
    });

    it('should wrap database errors in ReportGenerationError', async () => {
      // Arrange
      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);
      vi.mocked(formatResult).mockReturnValue(mockFormattedResult);

      const pdfBuffer = Buffer.from('PDF content');
      vi.mocked(generatePdfReport).mockResolvedValue(pdfBuffer);
      vi.mocked(uploadPdfToS3).mockResolvedValue('https://s3.example.com/report.pdf');

      const dbError = new Error('Database connection failed');
      mockPrisma.report.create.mockRejectedValue(dbError);

      // Act & Assert
      await expect(processGenerateReport(mockJob)).rejects.toThrow(ReportGenerationError);

      try {
        await processGenerateReport(mockJob);
      } catch (error) {
        expect(error).toBeInstanceOf(ReportGenerationError);
        expect((error as ReportGenerationError).code).toBe('GENERATION_FAILED');
        expect((error as ReportGenerationError).cause).toBe(dbError);
      }
    });
  });

  describe('Progress Tracking', () => {
    it('should update job progress at each stage', async () => {
      // Arrange
      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);
      vi.mocked(formatResult).mockReturnValue(mockFormattedResult);

      const pdfBuffer = Buffer.from('PDF content');
      vi.mocked(generatePdfReport).mockResolvedValue(pdfBuffer);
      vi.mocked(uploadPdfToS3).mockResolvedValue('https://s3.example.com/report.pdf');

      mockPrisma.report.create.mockResolvedValue(mockReport);

      // Act
      await processGenerateReport(mockJob);

      // Assert - verify progress updates in order
      const progressCalls = mockJob.updateProgress.mock.calls.map(call => call[0]);
      expect(progressCalls).toEqual([10, 30, 50, 80, 100]);
    });
  });

  describe('Report Metadata', () => {
    it('should set expiration date to 30 days from creation', async () => {
      // Arrange
      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);
      vi.mocked(formatResult).mockReturnValue(mockFormattedResult);

      const pdfBuffer = Buffer.from('PDF content');
      vi.mocked(generatePdfReport).mockResolvedValue(pdfBuffer);
      vi.mocked(uploadPdfToS3).mockResolvedValue('https://s3.example.com/report.pdf');

      mockPrisma.report.create.mockResolvedValue(mockReport);

      // Act
      await processGenerateReport(mockJob);

      // Assert
      const createCall = mockPrisma.report.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const now = new Date();
      const daysDiff = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(30);
    });

    it('should include file size in bytes', async () => {
      // Arrange
      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);
      vi.mocked(formatResult).mockReturnValue(mockFormattedResult);

      const pdfBuffer = Buffer.from('This is a test PDF with specific length');
      vi.mocked(generatePdfReport).mockResolvedValue(pdfBuffer);
      vi.mocked(uploadPdfToS3).mockResolvedValue('https://s3.example.com/report.pdf');

      mockPrisma.report.create.mockResolvedValue(mockReport);

      // Act
      await processGenerateReport(mockJob);

      // Assert
      const createCall = mockPrisma.report.create.mock.calls[0][0];
      expect(createCall.data.fileSizeBytes).toBe(pdfBuffer.length);
    });
  });
});
