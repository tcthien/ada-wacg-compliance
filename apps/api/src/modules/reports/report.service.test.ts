/**
 * Report Service Tests
 *
 * Unit tests for report business logic layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReportFormat, ScanStatus } from '@prisma/client';

// Mock dependencies before imports
vi.mock('../../config/database.js');
vi.mock('./report.repository.js');
vi.mock('../../shared/queue/queue.service.js');
vi.mock('@adashield/core/storage', () => ({
  getPresignedUrl: vi.fn(),
}));

// Now safe to import
import {
  getReportStatus,
  getOrGenerateReportAdmin,
  ReportServiceError,
  type ReportStatusResult,
} from './report.service.js';
import { getPrismaClient } from '../../config/database.js';
import * as reportRepository from './report.repository.js';
import * as queueService from '../../shared/queue/queue.service.js';

describe('Report Service', () => {
  let mockPrismaClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Prisma mock
    mockPrismaClient = {
      scan: {
        findUnique: vi.fn(),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrismaClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getReportStatus', () => {
    const validScanId = '550e8400-e29b-41d4-a716-446655440000';
    const validSessionId = '660e8400-e29b-41d4-a716-446655440000';

    const mockScanWithReports = {
      id: validScanId,
      status: 'COMPLETED' as ScanStatus,
      guestSessionId: validSessionId,
      reports: [
        {
          id: 'report-pdf-123',
          scanId: validScanId,
          format: 'PDF' as ReportFormat,
          storageKey: 'reports/scan-123/report.pdf',
          fileSizeBytes: 204800,
          createdAt: new Date('2025-12-28T10:00:00.000Z'),
        },
        {
          id: 'report-json-123',
          scanId: validScanId,
          format: 'JSON' as ReportFormat,
          storageKey: 'reports/scan-123/report.json',
          fileSizeBytes: 51200,
          createdAt: new Date('2025-12-28T10:00:00.000Z'),
        },
      ],
    };

    it('should return status for existing PDF and JSON reports', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(mockScanWithReports);

      const { getPresignedUrl } = await import('@adashield/core/storage');
      vi.mocked(getPresignedUrl)
        .mockResolvedValueOnce('https://s3.example.com/report.pdf?signed=true')
        .mockResolvedValueOnce('https://s3.example.com/report.json?signed=true');

      // Act
      const result = await getReportStatus(validScanId, validSessionId);

      // Assert
      expect(result).toEqual({
        scanId: validScanId,
        scanStatus: 'COMPLETED',
        reports: {
          pdf: {
            exists: true,
            url: 'https://s3.example.com/report.pdf?signed=true',
            createdAt: '2025-12-28T10:00:00.000Z',
            fileSizeBytes: 204800,
            expiresAt: expect.any(String),
          },
          json: {
            exists: true,
            url: 'https://s3.example.com/report.json?signed=true',
            createdAt: '2025-12-28T10:00:00.000Z',
            fileSizeBytes: 51200,
            expiresAt: expect.any(String),
          },
        },
      });

      expect(mockPrismaClient.scan.findUnique).toHaveBeenCalledWith({
        where: { id: validScanId },
        select: {
          id: true,
          status: true,
          guestSessionId: true,
          reports: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
    });

    it('should return null for non-existent reports', async () => {
      // Arrange - scan exists but no reports
      const scanWithoutReports = {
        ...mockScanWithReports,
        reports: [],
      };
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(scanWithoutReports);

      // Act
      const result = await getReportStatus(validScanId, validSessionId);

      // Assert
      expect(result).toEqual({
        scanId: validScanId,
        scanStatus: 'COMPLETED',
        reports: {
          pdf: null,
          json: null,
        },
      });
    });

    it('should validate session ownership when sessionId is provided', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(mockScanWithReports);

      const { getPresignedUrl } = await import('@adashield/core/storage');
      vi.mocked(getPresignedUrl)
        .mockResolvedValueOnce('https://s3.example.com/report.pdf?signed=true')
        .mockResolvedValueOnce('https://s3.example.com/report.json?signed=true');

      // Act
      const result = await getReportStatus(validScanId, validSessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.scanId).toBe(validScanId);
    });

    it('should throw FORBIDDEN error for wrong session', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(mockScanWithReports);

      // Act & Assert
      await expect(
        getReportStatus(validScanId, 'wrong-session-id')
      ).rejects.toThrow(ReportServiceError);

      await expect(
        getReportStatus(validScanId, 'wrong-session-id')
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Scan does not belong to session',
      });
    });

    it('should throw SCAN_NOT_FOUND error for invalid scanId', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(null);

      // Act & Assert
      await expect(
        getReportStatus('invalid-scan-id', validSessionId)
      ).rejects.toThrow(ReportServiceError);

      await expect(
        getReportStatus('invalid-scan-id', validSessionId)
      ).rejects.toMatchObject({
        code: 'SCAN_NOT_FOUND',
        message: 'Scan not found',
      });
    });

    it('should bypass session check when sessionId is not provided (admin mode)', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(mockScanWithReports);

      const { getPresignedUrl } = await import('@adashield/core/storage');
      vi.mocked(getPresignedUrl)
        .mockResolvedValueOnce('https://s3.example.com/report.pdf?signed=true')
        .mockResolvedValueOnce('https://s3.example.com/report.json?signed=true');

      // Act - no sessionId provided
      const result = await getReportStatus(validScanId);

      // Assert
      expect(result).toBeDefined();
      expect(result.scanId).toBe(validScanId);
      expect(result.reports.pdf).toBeDefined();
      expect(result.reports.json).toBeDefined();
    });

    it('should handle scans with only PDF report', async () => {
      // Arrange - scan with only PDF report
      const scanWithPdfOnly = {
        ...mockScanWithReports,
        reports: [mockScanWithReports.reports[0]!], // Only PDF
      };
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(scanWithPdfOnly);

      const { getPresignedUrl } = await import('@adashield/core/storage');
      vi.mocked(getPresignedUrl).mockResolvedValueOnce(
        'https://s3.example.com/report.pdf?signed=true'
      );

      // Act
      const result = await getReportStatus(validScanId, validSessionId);

      // Assert
      expect(result.reports.pdf).toBeDefined();
      expect(result.reports.json).toBeNull();
    });

    it('should handle scans with only JSON report', async () => {
      // Arrange - scan with only JSON report
      const scanWithJsonOnly = {
        ...mockScanWithReports,
        reports: [mockScanWithReports.reports[1]!], // Only JSON
      };
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(scanWithJsonOnly);

      const { getPresignedUrl } = await import('@adashield/core/storage');
      vi.mocked(getPresignedUrl).mockResolvedValueOnce(
        'https://s3.example.com/report.json?signed=true'
      );

      // Act
      const result = await getReportStatus(validScanId, validSessionId);

      // Assert
      expect(result.reports.pdf).toBeNull();
      expect(result.reports.json).toBeDefined();
    });

    it('should ignore reports without storage key', async () => {
      // Arrange - reports without storage keys (generating)
      const scanWithGeneratingReports = {
        ...mockScanWithReports,
        reports: [
          {
            id: 'report-pdf-123',
            scanId: validScanId,
            format: 'PDF' as ReportFormat,
            storageKey: null, // No storage key yet
            fileSizeBytes: 0,
            createdAt: new Date('2025-12-28T10:00:00.000Z'),
          },
        ],
      };
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(
        scanWithGeneratingReports
      );

      // Act
      const result = await getReportStatus(validScanId, validSessionId);

      // Assert
      expect(result.reports.pdf).toBeNull();
      expect(result.reports.json).toBeNull();
    });
  });

  describe('getOrGenerateReportAdmin', () => {
    const validScanId = '550e8400-e29b-41d4-a716-446655440000';

    const mockScan = {
      id: validScanId,
      status: 'COMPLETED' as ScanStatus,
    };

    const mockReport = {
      id: 'report-123',
      scanId: validScanId,
      format: 'PDF' as ReportFormat,
      storageKey: 'reports/scan-123/report.pdf',
      fileSizeBytes: 204800,
      createdAt: new Date('2025-12-28T10:00:00.000Z'),
    };

    it('should return existing report with presigned URL', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(mockScan);
      vi.mocked(reportRepository.getReportByScanAndFormat).mockResolvedValue(mockReport);

      const { getPresignedUrl } = await import('@adashield/core/storage');
      vi.mocked(getPresignedUrl).mockResolvedValue(
        'https://s3.example.com/report.pdf?signed=true'
      );

      // Act
      const result = await getOrGenerateReportAdmin(validScanId, 'pdf');

      // Assert
      expect(result).toEqual({
        status: 'ready',
        url: 'https://s3.example.com/report.pdf?signed=true',
        expiresAt: expect.any(Date),
      });

      expect(reportRepository.getReportByScanAndFormat).toHaveBeenCalledWith(
        validScanId,
        'PDF'
      );
    });

    it('should queue report generation if report does not exist', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(mockScan);
      vi.mocked(reportRepository.getReportByScanAndFormat).mockResolvedValue(null);
      vi.mocked(queueService.addReportJob).mockResolvedValue('job-123');

      // Act
      const result = await getOrGenerateReportAdmin(validScanId, 'pdf');

      // Assert
      expect(result).toEqual({
        status: 'generating',
        jobId: 'job-123',
      });

      expect(queueService.addReportJob).toHaveBeenCalledWith(validScanId, 'PDF');
    });

    it('should return not_found for non-existent scan', async () => {
      // Arrange
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(null);

      // Act
      const result = await getOrGenerateReportAdmin('invalid-scan-id', 'pdf');

      // Assert
      expect(result).toEqual({
        status: 'not_found',
      });
    });

    it('should throw error for incomplete scan', async () => {
      // Arrange
      const incompleteScan = {
        id: validScanId,
        status: 'RUNNING' as ScanStatus,
      };
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(incompleteScan);

      // Act & Assert
      await expect(
        getOrGenerateReportAdmin(validScanId, 'pdf')
      ).rejects.toThrow(ReportServiceError);

      await expect(
        getOrGenerateReportAdmin(validScanId, 'pdf')
      ).rejects.toMatchObject({
        code: 'SCAN_NOT_COMPLETED',
        message: 'Scan must be completed before generating report',
      });
    });

    it('should handle JSON format', async () => {
      // Arrange
      const jsonReport = {
        ...mockReport,
        format: 'JSON' as ReportFormat,
        storageKey: 'reports/scan-123/report.json',
      };
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(mockScan);
      vi.mocked(reportRepository.getReportByScanAndFormat).mockResolvedValue(jsonReport);

      const { getPresignedUrl } = await import('@adashield/core/storage');
      vi.mocked(getPresignedUrl).mockResolvedValue(
        'https://s3.example.com/report.json?signed=true'
      );

      // Act
      const result = await getOrGenerateReportAdmin(validScanId, 'json');

      // Assert
      expect(result.status).toBe('ready');
      expect(reportRepository.getReportByScanAndFormat).toHaveBeenCalledWith(
        validScanId,
        'JSON'
      );
    });

    it('should bypass session validation (admin mode)', async () => {
      // Arrange - scan from different session
      const scanFromDifferentSession = {
        id: validScanId,
        status: 'COMPLETED' as ScanStatus,
        guestSessionId: 'other-session-id',
      };
      vi.mocked(mockPrismaClient.scan.findUnique).mockResolvedValue(
        scanFromDifferentSession
      );
      vi.mocked(reportRepository.getReportByScanAndFormat).mockResolvedValue(mockReport);

      const { getPresignedUrl } = await import('@adashield/core/storage');
      vi.mocked(getPresignedUrl).mockResolvedValue(
        'https://s3.example.com/report.pdf?signed=true'
      );

      // Act - should succeed without session check
      const result = await getOrGenerateReportAdmin(validScanId, 'pdf');

      // Assert
      expect(result.status).toBe('ready');
      expect(result.url).toBeDefined();
    });
  });
});
