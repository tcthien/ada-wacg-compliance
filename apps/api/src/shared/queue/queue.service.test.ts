/**
 * Queue Service Unit Tests
 *
 * Tests for queue job addition, validation, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addScanJob, addReportJob, addEmailJob, QueueServiceError } from './queue.service.js';
import { scanPageQueue, generateReportQueue, sendEmailQueue } from './queues.js';

// Mock the queues
vi.mock('./queues.js', () => ({
  scanPageQueue: {
    add: vi.fn(),
  },
  generateReportQueue: {
    add: vi.fn(),
  },
  sendEmailQueue: {
    add: vi.fn(),
  },
  QueueNames: {
    SCAN_PAGE: 'scan-page',
    GENERATE_REPORT: 'generate-report',
    SEND_EMAIL: 'send-email',
  },
}));

describe('Queue Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addScanJob', () => {
    it('should add a scan job with valid data', async () => {
      const mockJob = { id: 'job-123' };
      vi.mocked(scanPageQueue.add).mockResolvedValue(mockJob as never);

      const jobId = await addScanJob('scan-1', 'https://example.com', 'AA');

      expect(scanPageQueue.add).toHaveBeenCalledWith(
        'scan-scan-1',
        {
          scanId: 'scan-1',
          url: 'https://example.com',
          wcagLevel: 'AA',
          userId: undefined,
          sessionId: undefined,
        },
        {}
      );
      expect(jobId).toBe('job-123');
    });

    it('should add a scan job with user ID and session ID', async () => {
      const mockJob = { id: 'job-456' };
      vi.mocked(scanPageQueue.add).mockResolvedValue(mockJob as never);

      const jobId = await addScanJob('scan-2', 'https://example.com', 'AAA', {
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(scanPageQueue.add).toHaveBeenCalledWith(
        'scan-scan-2',
        {
          scanId: 'scan-2',
          url: 'https://example.com',
          wcagLevel: 'AAA',
          userId: 'user-1',
          sessionId: 'session-1',
        },
        {}
      );
      expect(jobId).toBe('job-456');
    });

    it('should throw error for invalid scanId', async () => {
      await expect(addScanJob('', 'https://example.com', 'AA')).rejects.toThrow(
        QueueServiceError
      );
    });

    it('should throw error for invalid URL', async () => {
      await expect(addScanJob('scan-1', 'not-a-url', 'AA')).rejects.toThrow(
        QueueServiceError
      );
    });

    it('should throw error for invalid WCAG level', async () => {
      await expect(
        addScanJob('scan-1', 'https://example.com', 'INVALID' as never)
      ).rejects.toThrow(QueueServiceError);
    });

    it('should handle queue errors gracefully', async () => {
      vi.mocked(scanPageQueue.add).mockRejectedValue(new Error('Redis connection failed'));

      await expect(addScanJob('scan-1', 'https://example.com', 'AA')).rejects.toThrow(
        QueueServiceError
      );
    });

    it('should use default WCAG level AA if not provided', async () => {
      const mockJob = { id: 'job-789' };
      vi.mocked(scanPageQueue.add).mockResolvedValue(mockJob as never);

      await addScanJob('scan-3', 'https://example.com');

      expect(scanPageQueue.add).toHaveBeenCalledWith(
        'scan-scan-3',
        expect.objectContaining({
          wcagLevel: 'AA',
        }),
        {}
      );
    });
  });

  describe('addReportJob', () => {
    it('should add a report job with valid data', async () => {
      const mockJob = { id: 'report-123' };
      vi.mocked(generateReportQueue.add).mockResolvedValue(mockJob as never);

      const jobId = await addReportJob('scan-1', 'PDF');

      expect(generateReportQueue.add).toHaveBeenCalledWith(
        'report-scan-1-pdf',
        {
          scanId: 'scan-1',
          format: 'PDF',
          title: undefined,
          emailTo: undefined,
        },
        {}
      );
      expect(jobId).toBe('report-123');
    });

    it('should add a report job with optional fields', async () => {
      const mockJob = { id: 'report-456' };
      vi.mocked(generateReportQueue.add).mockResolvedValue(mockJob as never);

      const jobId = await addReportJob('scan-2', 'JSON', {
        title: 'Custom Report',
        emailTo: 'user@example.com',
      });

      expect(generateReportQueue.add).toHaveBeenCalledWith(
        'report-scan-2-json',
        {
          scanId: 'scan-2',
          format: 'JSON',
          title: 'Custom Report',
          emailTo: 'user@example.com',
        },
        {}
      );
      expect(jobId).toBe('report-456');
    });

    it('should throw error for invalid scanId', async () => {
      await expect(addReportJob('', 'PDF')).rejects.toThrow(QueueServiceError);
    });

    it('should throw error for invalid format', async () => {
      await expect(addReportJob('scan-1', 'INVALID' as never)).rejects.toThrow(
        QueueServiceError
      );
    });

    it('should handle queue errors gracefully', async () => {
      vi.mocked(generateReportQueue.add).mockRejectedValue(
        new Error('Queue connection failed')
      );

      await expect(addReportJob('scan-1', 'PDF')).rejects.toThrow(QueueServiceError);
    });
  });

  describe('addEmailJob', () => {
    it('should add an email job with valid data', async () => {
      const mockJob = { id: 'email-123' };
      vi.mocked(sendEmailQueue.add).mockResolvedValue(mockJob as never);

      const data = { name: 'John Doe', scanUrl: 'https://example.com' };
      const jobId = await addEmailJob('user@example.com', 'scan-complete', data);

      expect(sendEmailQueue.add).toHaveBeenCalledWith(
        expect.stringContaining('email-scan-complete-'),
        {
          to: 'user@example.com',
          template: 'scan-complete',
          data,
          subject: undefined,
          from: undefined,
        },
        {}
      );
      expect(jobId).toBe('email-123');
    });

    it('should add an email job with optional fields', async () => {
      const mockJob = { id: 'email-456' };
      vi.mocked(sendEmailQueue.add).mockResolvedValue(mockJob as never);

      const data = { code: '123456' };
      const jobId = await addEmailJob('user@example.com', 'verification', data, {
        subject: 'Verify Your Email',
        from: 'noreply@adashield.com',
      });

      expect(sendEmailQueue.add).toHaveBeenCalledWith(
        expect.stringContaining('email-verification-'),
        {
          to: 'user@example.com',
          template: 'verification',
          data,
          subject: 'Verify Your Email',
          from: 'noreply@adashield.com',
        },
        {}
      );
      expect(jobId).toBe('email-456');
    });

    it('should throw error for invalid email', async () => {
      await expect(addEmailJob('invalid-email', 'template', {})).rejects.toThrow(
        QueueServiceError
      );
    });

    it('should throw error for missing template', async () => {
      await expect(addEmailJob('user@example.com', '', {})).rejects.toThrow(
        QueueServiceError
      );
    });

    it('should throw error for invalid data', async () => {
      await expect(
        addEmailJob('user@example.com', 'template', null as never)
      ).rejects.toThrow(QueueServiceError);
    });

    it('should handle queue errors gracefully', async () => {
      vi.mocked(sendEmailQueue.add).mockRejectedValue(new Error('SMTP connection failed'));

      await expect(
        addEmailJob('user@example.com', 'template', { key: 'value' })
      ).rejects.toThrow(QueueServiceError);
    });
  });
});
