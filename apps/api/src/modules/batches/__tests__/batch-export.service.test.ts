/**
 * Batch Export Service Tests
 *
 * Tests for batch export request/status functionality.
 * Verifies async job queue, caching, and status responses.
 *
 * @requirements 1.1, 2.1, 4.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../config/redis.js', () => ({
  getBullMQConnection: vi.fn(() => ({
    host: 'localhost',
    port: 6379,
  })),
}));

vi.mock('@adashield/core/storage', () => ({
  getPresignedUrl: vi.fn(),
}));

vi.mock('../../reports/report.repository.js', () => ({
  getReportByBatchAndFormat: vi.fn(),
  createPendingBatchReport: vi.fn(),
  getReportById: vi.fn(),
}));

// Mock bullmq Queue class properly
vi.mock('bullmq', () => {
  const mockAdd = vi.fn().mockResolvedValue({});
  return {
    Queue: class MockQueue {
      add = mockAdd;
    },
  };
});

// Import after mocks
import {
  requestBatchExport,
  getBatchExportStatus,
  getBatchExportStatusById,
  BatchExportError,
} from '../batch-export.service.js';
import { getPresignedUrl } from '@adashield/core/storage';
import {
  getReportByBatchAndFormat,
  createPendingBatchReport,
  getReportById,
} from '../../reports/report.repository.js';

describe('Batch Export Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('requestBatchExport', () => {
    it('should return ready status with URL for existing completed report', async () => {
      const mockReport = {
        id: 'report_123',
        status: 'COMPLETED',
        storageKey: 'reports/batch-123/report.pdf',
        expiresAt: new Date('2025-01-01T00:00:00Z'),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);
      (getPresignedUrl as Mock).mockResolvedValue('https://s3.example.com/presigned-url');

      const result = await requestBatchExport({
        batchId: 'batch_123',
        format: 'pdf',
      });

      expect(result.status).toBe('ready');
      expect(result.url).toBe('https://s3.example.com/presigned-url');
      expect(result.reportId).toBe('report_123');
      expect(result.expiresAt).toBe('2025-01-01T00:00:00.000Z');

      // Should not create new report
      expect(createPendingBatchReport).not.toHaveBeenCalled();
    });

    it('should return generating status for existing pending report', async () => {
      const mockReport = {
        id: 'report_pending',
        status: 'PENDING',
        storageKey: null,
        expiresAt: new Date(),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);

      const result = await requestBatchExport({
        batchId: 'batch_123',
        format: 'json',
      });

      expect(result.status).toBe('generating');
      expect(result.reportId).toBe('report_pending');
      expect(result.url).toBeUndefined();

      // Should not create new report
      expect(createPendingBatchReport).not.toHaveBeenCalled();
    });

    it('should return generating status for existing GENERATING report', async () => {
      const mockReport = {
        id: 'report_generating',
        status: 'GENERATING',
        storageKey: null,
        expiresAt: new Date(),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);

      const result = await requestBatchExport({
        batchId: 'batch_123',
        format: 'pdf',
      });

      expect(result.status).toBe('generating');
      expect(result.reportId).toBe('report_generating');
    });

    it('should create new report and queue job when no existing report', async () => {
      (getReportByBatchAndFormat as Mock).mockResolvedValue(null);
      (createPendingBatchReport as Mock).mockResolvedValue({
        id: 'new_report_123',
        status: 'PENDING',
      });

      const result = await requestBatchExport({
        batchId: 'batch_456',
        format: 'pdf',
        guestSessionId: 'session_789',
      });

      expect(result.status).toBe('generating');
      expect(result.reportId).toBe('new_report_123');

      // Should create pending report
      expect(createPendingBatchReport).toHaveBeenCalledWith('batch_456', 'PDF');
    });

    it('should create new report when previous attempt failed', async () => {
      const mockFailedReport = {
        id: 'failed_report',
        status: 'FAILED',
        storageKey: null,
        expiresAt: new Date(),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockFailedReport);
      (createPendingBatchReport as Mock).mockResolvedValue({
        id: 'retry_report_123',
        status: 'PENDING',
      });

      const result = await requestBatchExport({
        batchId: 'batch_retry',
        format: 'json',
      });

      expect(result.status).toBe('generating');
      expect(result.reportId).toBe('retry_report_123');

      // Should create new pending report
      expect(createPendingBatchReport).toHaveBeenCalledWith('batch_retry', 'JSON');
    });

    it('should throw BatchExportError on repository error', async () => {
      (getReportByBatchAndFormat as Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        requestBatchExport({
          batchId: 'batch_error',
          format: 'pdf',
        })
      ).rejects.toThrow(BatchExportError);
    });
  });

  describe('getBatchExportStatus', () => {
    it('should return ready status with URL for completed report', async () => {
      const mockReport = {
        id: 'report_completed',
        status: 'COMPLETED',
        storageKey: 'reports/batch-completed/report.json',
        expiresAt: new Date('2025-01-15T12:00:00Z'),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);
      (getPresignedUrl as Mock).mockResolvedValue('https://s3.example.com/json-url');

      const result = await getBatchExportStatus('batch_completed', 'json');

      expect(result.status).toBe('ready');
      expect(result.url).toBe('https://s3.example.com/json-url');
      expect(result.reportId).toBe('report_completed');
      expect(result.expiresAt).toBe('2025-01-15T12:00:00.000Z');
    });

    it('should return generating status for pending report', async () => {
      const mockReport = {
        id: 'report_pending',
        status: 'PENDING',
        storageKey: null,
        expiresAt: new Date(),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);

      const result = await getBatchExportStatus('batch_pending', 'pdf');

      expect(result.status).toBe('generating');
      expect(result.reportId).toBe('report_pending');
      expect(result.url).toBeUndefined();
    });

    it('should return generating status for GENERATING report', async () => {
      const mockReport = {
        id: 'report_in_progress',
        status: 'GENERATING',
        storageKey: null,
        expiresAt: new Date(),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);

      const result = await getBatchExportStatus('batch_in_progress', 'json');

      expect(result.status).toBe('generating');
      expect(result.reportId).toBe('report_in_progress');
    });

    it('should return failed status for failed report', async () => {
      const mockReport = {
        id: 'report_failed',
        status: 'FAILED',
        storageKey: null,
        expiresAt: new Date(),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);

      const result = await getBatchExportStatus('batch_failed', 'pdf');

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Report generation failed');
      expect(result.reportId).toBe('report_failed');
    });

    it('should return failed status when report not found', async () => {
      (getReportByBatchAndFormat as Mock).mockResolvedValue(null);

      const result = await getBatchExportStatus('batch_nonexistent', 'pdf');

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Report not found');
    });

    it('should return failed status for completed report without storage key', async () => {
      const mockReport = {
        id: 'report_no_storage',
        status: 'COMPLETED',
        storageKey: null, // Missing storage key
        expiresAt: new Date(),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);

      const result = await getBatchExportStatus('batch_no_storage', 'pdf');

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Report completed but file not found');
      expect(result.reportId).toBe('report_no_storage');
    });

    it('should throw BatchExportError on presigned URL error', async () => {
      const mockReport = {
        id: 'report_123',
        status: 'COMPLETED',
        storageKey: 'reports/batch-123/report.pdf',
        expiresAt: new Date(),
      };

      (getReportByBatchAndFormat as Mock).mockResolvedValue(mockReport);
      (getPresignedUrl as Mock).mockRejectedValue(new Error('S3 error'));

      await expect(
        getBatchExportStatus('batch_s3_error', 'pdf')
      ).rejects.toThrow(BatchExportError);
    });
  });

  describe('getBatchExportStatusById', () => {
    it('should return ready status for completed report by ID', async () => {
      const mockReport = {
        id: 'specific_report_id',
        status: 'COMPLETED',
        storageKey: 'reports/batch-specific/report.pdf',
        expiresAt: new Date('2025-02-01T00:00:00Z'),
      };

      (getReportById as Mock).mockResolvedValue(mockReport);
      (getPresignedUrl as Mock).mockResolvedValue('https://s3.example.com/specific-url');

      const result = await getBatchExportStatusById('specific_report_id');

      expect(result.status).toBe('ready');
      expect(result.url).toBe('https://s3.example.com/specific-url');
      expect(result.reportId).toBe('specific_report_id');
    });

    it('should return failed status when report ID not found', async () => {
      (getReportById as Mock).mockResolvedValue(null);

      const result = await getBatchExportStatusById('nonexistent_report_id');

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Report not found');
    });

    it('should return generating status for pending report by ID', async () => {
      const mockReport = {
        id: 'pending_report_id',
        status: 'PENDING',
        storageKey: null,
        expiresAt: new Date(),
      };

      (getReportById as Mock).mockResolvedValue(mockReport);

      const result = await getBatchExportStatusById('pending_report_id');

      expect(result.status).toBe('generating');
      expect(result.reportId).toBe('pending_report_id');
    });

    it('should throw BatchExportError on repository error', async () => {
      (getReportById as Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        getBatchExportStatusById('error_report_id')
      ).rejects.toThrow(BatchExportError);
    });
  });

  describe('BatchExportError', () => {
    it('should create error with code and cause', () => {
      const cause = new Error('Original error');
      const error = new BatchExportError(
        'Export failed',
        'EXPORT_FAILED',
        cause
      );

      expect(error.message).toBe('Export failed');
      expect(error.code).toBe('EXPORT_FAILED');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('BatchExportError');
    });

    it('should create error without cause', () => {
      const error = new BatchExportError(
        'No cause error',
        'NO_CAUSE'
      );

      expect(error.message).toBe('No cause error');
      expect(error.code).toBe('NO_CAUSE');
      expect(error.cause).toBeUndefined();
    });
  });
});
