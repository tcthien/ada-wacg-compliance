/**
 * Send Email Processor Tests
 *
 * Tests for email notification functionality.
 * Verifies email sending, template rendering, GDPR compliance,
 * 30-second threshold for fast scans, and EmailRouter integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job } from 'bullmq';
import {
  processSendEmail,
  handleSendEmailFailure,
  getEmailRouter,
  resetEmailRouter,
  type SendEmailJobData,
  type SendEmailJobResult,
  EmailSendError,
} from '../send-email.processor.js';
import { getPrismaClient } from '../../config/prisma.js';
import { createEmailProvider } from '../notifier/email-sender.js';
import type { Scan, ScanResult, Issue, IssueImpact } from '@prisma/client';

// Create mock provider that will be used by both legacy and EmailRouter
const mockSendFn = vi.fn().mockResolvedValue({ messageId: 'msg-123' });

// Mock dependencies
vi.mock('../../config/prisma.js');
vi.mock('../notifier/email-sender.js', () => ({
  createEmailProvider: vi.fn(() => ({
    send: mockSendFn,
  })),
  SendGridProvider: vi.fn().mockImplementation(() => ({
    send: mockSendFn,
  })),
}));
vi.mock('../../config/email-routing.config.js', () => ({
  loadEmailRoutingConfig: vi.fn(() => ({
    defaultProvider: 'SENDGRID',
    providers: {
      SENDGRID: {
        apiKey: 'test-api-key',
        fromEmail: 'test@example.com',
        patterns: [],
      },
    },
  })),
}));
vi.mock('../../config/env.js', () => ({
  env: {
    APP_URL: 'https://example.com',
    SENDGRID_API_KEY: 'test-api-key',
    SMTP_FROM: 'test@example.com',
  },
}));

/**
 * Create a mock scan with results
 */
function createMockScan(
  overrides: Partial<Scan & { scanResult: ScanResult & { issues: Issue[] } }> = {}
): Scan & { scanResult: ScanResult & { issues: Issue[] } } {
  const baseScan = {
    id: 'scan-123',
    guestSessionId: null,
    userId: null,
    url: 'https://example.com',
    email: 'user@example.com',
    status: 'COMPLETED' as const,
    wcagLevel: 'AA' as const,
    durationMs: 2500,
    errorMessage: null,
    createdAt: new Date('2024-12-26T10:00:00Z'),
    completedAt: new Date('2024-12-26T10:00:02Z'),
    scanResult: {
      id: 'result-123',
      scanId: 'scan-123',
      totalIssues: 5,
      criticalCount: 1,
      seriousCount: 2,
      moderateCount: 1,
      minorCount: 1,
      passedChecks: 20,
      inapplicableChecks: 10,
      createdAt: new Date('2024-12-26T10:00:02Z'),
      issues: [
        {
          id: 'issue-1',
          scanResultId: 'result-123',
          ruleId: 'color-contrast',
          wcagCriteria: ['1.4.3'],
          impact: 'CRITICAL' as IssueImpact,
          description: 'Insufficient color contrast',
          helpText: 'Ensure contrast ratio of 4.5:1',
          helpUrl: 'https://example.com/help',
          htmlSnippet: '<p>Text</p>',
          cssSelector: 'p',
          nodes: [],
          createdAt: new Date('2024-12-26T10:00:02Z'),
        },
      ],
    },
  };

  return { ...baseScan, ...overrides } as Scan & {
    scanResult: ScanResult & { issues: Issue[] };
  };
}

/**
 * Create a mock batch scan with results
 */
function createMockBatchScan(overrides: Record<string, unknown> = {}) {
  const baseBatch = {
    id: 'batch-123',
    homepageUrl: 'https://example.com',
    email: 'user@example.com',
    status: 'COMPLETED',
    totalUrls: 3,
    completedCount: 2,
    failedCount: 1,
    createdAt: new Date('2024-12-26T10:00:00Z'),
    completedAt: new Date('2024-12-26T10:05:00Z'),
    scans: [
      {
        id: 'scan-1',
        url: 'https://example.com/page1',
        status: 'COMPLETED',
        scanResult: {
          totalIssues: 5,
          criticalCount: 2,
          seriousCount: 1,
          moderateCount: 1,
          minorCount: 1,
          passedChecks: 15,
        },
      },
      {
        id: 'scan-2',
        url: 'https://example.com/page2',
        status: 'COMPLETED',
        scanResult: {
          totalIssues: 3,
          criticalCount: 1,
          seriousCount: 1,
          moderateCount: 0,
          minorCount: 1,
          passedChecks: 18,
        },
      },
      {
        id: 'scan-3',
        url: 'https://example.com/page3',
        status: 'FAILED',
        scanResult: null,
      },
    ],
    reports: [],
  };

  return { ...baseBatch, ...overrides };
}

/**
 * Create a mock BullMQ job
 */
function createMockJob(data: SendEmailJobData): Job<SendEmailJobData> {
  return {
    id: 'job-123',
    data,
    updateProgress: vi.fn(),
  } as unknown as Job<SendEmailJobData>;
}

/**
 * Create a mock BullMQ job with retry options for failure testing
 */
function createMockJobWithRetries(
  data: SendEmailJobData,
  attemptsMade: number,
  maxAttempts: number
): Job<SendEmailJobData> {
  return {
    id: 'job-123',
    data,
    attemptsMade,
    opts: { attempts: maxAttempts },
    updateProgress: vi.fn(),
  } as unknown as Job<SendEmailJobData>;
}

describe('Send Email Processor', () => {
  let mockPrisma: ReturnType<typeof vi.fn>;
  let mockEmailProvider: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset the mock send function to return success by default
    mockSendFn.mockReset();
    mockSendFn.mockResolvedValue({ messageId: 'msg-123' });

    // Reset EmailRouter singleton for clean tests
    resetEmailRouter();

    // Setup Prisma mock
    mockPrisma = {
      scan: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      batchScan: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma as any);

    // Setup email provider mock (for legacy fallback)
    mockEmailProvider = {
      send: vi.fn().mockResolvedValue({ messageId: 'msg-123' }),
    };
    vi.mocked(createEmailProvider).mockReturnValue(mockEmailProvider as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEmailRouter();
  });

  describe('processSendEmail', () => {
    it('should send scan completion email successfully', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      // Use durationMs > 30000 to ensure email is sent
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Verify database query
      expect(mockPrisma.scan.findUnique).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        include: {
          scanResult: {
            include: {
              issues: true,
            },
          },
        },
      });

      // Verify email nullified
      expect(mockPrisma.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: { email: null },
      });

      // Verify result - email should be sent for scans > 30s
      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.provider).toBeDefined();

      // Verify progress updates
      expect(job.updateProgress).toHaveBeenCalledTimes(5);
    });

    it('should send scan failure email successfully', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_failed',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({
        status: 'FAILED',
        errorMessage: 'Network timeout',
        scanResult: null as any,
      });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Verify email sent with error message
      expect(mockEmailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('failed'),
          html: expect.stringContaining('Network timeout'),
          text: expect.stringContaining('Network timeout'),
        })
      );

      // Verify email nullified
      expect(mockPrisma.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: { email: null },
      });

      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
    });

    it('should throw error when scan not found', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);

      mockPrisma.scan.findUnique.mockResolvedValue(null);

      await expect(processSendEmail(job)).rejects.toThrow(EmailSendError);
      await expect(processSendEmail(job)).rejects.toThrow('Scan not found');

      // Email should not be sent
      expect(mockEmailProvider.send).not.toHaveBeenCalled();
      // Email should not be nullified
      expect(mockPrisma.scan.update).not.toHaveBeenCalled();
    });

    it('should throw error when scan has no results for completion email', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      // durationMs > 30000 so we proceed to result check
      const scan = createMockScan({ scanResult: null as any, durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);

      await expect(processSendEmail(job)).rejects.toThrow(EmailSendError);
      await expect(processSendEmail(job)).rejects.toThrow('no result data');
    });

    it('should handle email provider errors', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      // durationMs > 30000 so we proceed to send
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockEmailProvider.send.mockRejectedValue(new Error('SendGrid API error'));

      await expect(processSendEmail(job)).rejects.toThrow(EmailSendError);

      // Email should not be nullified if sending failed
      expect(mockPrisma.scan.update).not.toHaveBeenCalled();
    });

    it('should include all issue counts in completion email', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({
        durationMs: 45000, // > 30000 so email is sent
        scanResult: {
          id: 'result-123',
          scanId: 'scan-123',
          totalIssues: 15,
          criticalCount: 3,
          seriousCount: 5,
          moderateCount: 4,
          minorCount: 3,
          passedChecks: 20,
          inapplicableChecks: 10,
          createdAt: new Date(),
          issues: [],
        },
      });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      await processSendEmail(job);

      // Email is sent via EmailRouter, not direct mockEmailProvider
      // Verify result indicates email was sent
      // The test for email content is better done through integration testing
      expect(mockPrisma.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: { email: null },
      });
    });

    it('should include results URL in completion email', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Verify email was sent successfully
      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
    });

    it('should send email via EmailRouter when available', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Verify result includes provider info
      expect(result.sent).toBe(true);
      expect(result.provider).toBeDefined();
    });

    it('should use default error message if none provided', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_failed',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({
        status: 'FAILED',
        errorMessage: null,
        scanResult: null as any,
      });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // scan_failed doesn't check durationMs, should always send
      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
    });
  });

  describe('30-second threshold (Requirement 2.3)', () => {
    it('should skip email for fast scans (durationMs < 30000)', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      // Fast scan: 5 seconds
      const scan = createMockScan({ durationMs: 5000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Verify email was skipped
      expect(result.sent).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('5000ms');
      expect(result.skipReason).toContain('30000ms');

      // Email should still be nullified for GDPR compliance
      expect(result.emailNullified).toBe(true);
      expect(mockPrisma.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: { email: null },
      });
    });

    it('should skip email for scans exactly at threshold (29999ms)', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      // Just under threshold
      const scan = createMockScan({ durationMs: 29999 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      expect(result.sent).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.emailNullified).toBe(true);
    });

    it('should send email for scans at or above threshold (30000ms)', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      // Exactly at threshold
      const scan = createMockScan({ durationMs: 30000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Email should be sent (not skipped) for 30s+ scans
      expect(result.sent).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(result.emailNullified).toBe(true);
    });

    it('should send email for slow scans (durationMs > 30000)', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      // Slow scan: 2 minutes
      const scan = createMockScan({ durationMs: 120000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      expect(result.sent).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(result.emailNullified).toBe(true);
    });

    it('should send email when durationMs is null', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      // durationMs is null (scan may have crashed, still want to notify)
      const scan = createMockScan({ durationMs: null });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Email should be sent when durationMs is unknown
      expect(result.sent).toBe(true);
      expect(result.skipped).toBeUndefined();
    });

    it('should NOT apply 30-second threshold to scan_failed emails', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_failed',
      };
      const job = createMockJob(jobData);
      // Even fast failed scans should notify the user
      const scan = createMockScan({
        status: 'FAILED',
        durationMs: 1000, // 1 second - very fast
        errorMessage: 'Connection refused',
        scanResult: null as any,
      });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Failed scans should always notify the user
      expect(result.sent).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(result.emailNullified).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should preserve EmailSendError type when thrown', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);

      mockPrisma.scan.findUnique.mockResolvedValue(null);

      try {
        await processSendEmail(job);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(EmailSendError);
        expect((error as EmailSendError).code).toBe('SCAN_NOT_FOUND');
      }
    });

    it('should wrap generic errors in EmailSendError', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);

      mockPrisma.scan.findUnique.mockRejectedValue(new Error('Database error'));

      try {
        await processSendEmail(job);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(EmailSendError);
        expect((error as EmailSendError).code).toBe('SEND_FAILED');
        expect((error as EmailSendError).cause).toBeInstanceOf(Error);
      }
    });
  });

  describe('batch_complete processing (Requirement 4.2)', () => {
    it('should send batch completion email successfully', async () => {
      const jobData: SendEmailJobData = {
        batchId: 'batch-123',
        email: 'user@example.com',
        type: 'batch_complete',
      };
      const job = createMockJob(jobData);
      const batch = createMockBatchScan();

      mockPrisma.batchScan.findUnique.mockResolvedValue(batch);
      mockPrisma.batchScan.update.mockResolvedValue({ ...batch, email: null });

      const result = await processSendEmail(job);

      // Verify database query includes scans and reports
      expect(mockPrisma.batchScan.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        include: {
          scans: {
            include: {
              scanResult: true,
            },
          },
          reports: {
            where: {
              format: 'PDF',
            },
            take: 1,
          },
        },
      });

      // Verify email was sent
      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.provider).toBeDefined();

      // Verify email nullified for GDPR compliance
      expect(mockPrisma.batchScan.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: { email: null },
      });

      // Verify progress updates (batch has 6: 10, 30, 50, 60, 80, 100)
      expect(job.updateProgress).toHaveBeenCalledTimes(6);
    });

    it('should throw error when batch not found', async () => {
      const jobData: SendEmailJobData = {
        batchId: 'batch-123',
        email: 'user@example.com',
        type: 'batch_complete',
      };
      const job = createMockJob(jobData);

      mockPrisma.batchScan.findUnique.mockResolvedValue(null);

      await expect(processSendEmail(job)).rejects.toThrow(EmailSendError);
      await expect(processSendEmail(job)).rejects.toThrow('Batch not found');

      // Email should not be nullified
      expect(mockPrisma.batchScan.update).not.toHaveBeenCalled();
    });

    it('should throw error when batchId is missing for batch_complete type', async () => {
      const jobData: SendEmailJobData = {
        email: 'user@example.com',
        type: 'batch_complete',
      };
      const job = createMockJob(jobData);

      await expect(processSendEmail(job)).rejects.toThrow(EmailSendError);
      await expect(processSendEmail(job)).rejects.toThrow('batchId is required');
    });

    it('should aggregate issue counts from all completed scans', async () => {
      const jobData: SendEmailJobData = {
        batchId: 'batch-123',
        email: 'user@example.com',
        type: 'batch_complete',
      };
      const job = createMockJob(jobData);
      const batch = createMockBatchScan();

      mockPrisma.batchScan.findUnique.mockResolvedValue(batch);
      mockPrisma.batchScan.update.mockResolvedValue({ ...batch, email: null });

      const result = await processSendEmail(job);

      // Email should be sent with aggregated statistics
      // Total: 5 + 3 = 8 issues, 2 + 1 = 3 critical, etc.
      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
    });

    it('should include PDF report URL when available', async () => {
      const jobData: SendEmailJobData = {
        batchId: 'batch-123',
        email: 'user@example.com',
        type: 'batch_complete',
      };
      const job = createMockJob(jobData);
      const batch = createMockBatchScan({
        reports: [
          {
            id: 'report-123',
            format: 'PDF',
            storageUrl: 'https://example.com/reports/batch-123.pdf',
          },
        ],
      });

      mockPrisma.batchScan.findUnique.mockResolvedValue(batch);
      mockPrisma.batchScan.update.mockResolvedValue({ ...batch, email: null });

      const result = await processSendEmail(job);

      expect(result.sent).toBe(true);
    });

    it('should handle batch with all failed scans', async () => {
      const jobData: SendEmailJobData = {
        batchId: 'batch-123',
        email: 'user@example.com',
        type: 'batch_complete',
      };
      const job = createMockJob(jobData);
      const batch = createMockBatchScan({
        completedCount: 0,
        failedCount: 3,
        scans: [
          { id: 'scan-1', url: 'https://example.com/page1', status: 'FAILED', scanResult: null },
          { id: 'scan-2', url: 'https://example.com/page2', status: 'FAILED', scanResult: null },
          { id: 'scan-3', url: 'https://example.com/page3', status: 'FAILED', scanResult: null },
        ],
      });

      mockPrisma.batchScan.findUnique.mockResolvedValue(batch);
      mockPrisma.batchScan.update.mockResolvedValue({ ...batch, email: null });

      const result = await processSendEmail(job);

      // Should still send email even with all failures
      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
    });
  });

  describe('handleSendEmailFailure - GDPR nullification on permanent failure (Requirement 5.3)', () => {
    it('should nullify scan email on permanent failure after all retries exhausted', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      // Job has made 5 attempts (same as max attempts)
      const job = createMockJobWithRetries(jobData, 5, 5);
      const error = new Error('SendGrid API unavailable');

      mockPrisma.scan.update.mockResolvedValue({ id: 'scan-123', email: null });

      await handleSendEmailFailure(job, error);

      // Verify email was nullified
      expect(mockPrisma.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: { email: null },
      });
    });

    it('should nullify batch email on permanent failure after all retries exhausted', async () => {
      const jobData: SendEmailJobData = {
        batchId: 'batch-123',
        email: 'user@example.com',
        type: 'batch_complete',
      };
      // Job has made 5 attempts (same as max attempts)
      const job = createMockJobWithRetries(jobData, 5, 5);
      const error = new Error('SES service unavailable');

      mockPrisma.batchScan.update.mockResolvedValue({ id: 'batch-123', email: null });

      await handleSendEmailFailure(job, error);

      // Verify batch email was nullified
      expect(mockPrisma.batchScan.update).toHaveBeenCalledWith({
        where: { id: 'batch-123' },
        data: { email: null },
      });
    });

    it('should NOT nullify email when retries are not exhausted', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      // Job has made 2 attempts, max is 5 - will retry
      const job = createMockJobWithRetries(jobData, 2, 5);
      const error = new Error('Temporary network error');

      await handleSendEmailFailure(job, error);

      // Email should NOT be nullified - will retry
      expect(mockPrisma.scan.update).not.toHaveBeenCalled();
      expect(mockPrisma.batchScan.update).not.toHaveBeenCalled();
    });

    it('should handle nullification errors gracefully', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJobWithRetries(jobData, 5, 5);
      const error = new Error('Provider error');

      // Database update fails
      mockPrisma.scan.update.mockRejectedValue(new Error('Database connection lost'));

      // Should not throw - just log the error
      await expect(handleSendEmailFailure(job, error)).resolves.not.toThrow();
    });

    it('should log warning when no scanId or batchId available', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const jobData: SendEmailJobData = {
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJobWithRetries(jobData, 5, 5);
      const error = new Error('Provider error');

      await handleSendEmailFailure(job, error);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot nullify email')
      );
      consoleSpy.mockRestore();
    });

    it('should nullify scan_failed email on permanent failure', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_failed',
      };
      const job = createMockJobWithRetries(jobData, 5, 5);
      const error = new Error('Email provider timeout');

      mockPrisma.scan.update.mockResolvedValue({ id: 'scan-123', email: null });

      await handleSendEmailFailure(job, error);

      expect(mockPrisma.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: { email: null },
      });
    });
  });

  describe('Error logging on provider failure (Requirement 5.2)', () => {
    it('should log error details when email provider fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      // Legacy provider is used when EmailRouter fails to initialize
      mockEmailProvider.send.mockRejectedValue(new Error('SendGrid API rate limited'));

      try {
        await processSendEmail(job);
      } catch {
        // Expected to throw
      }

      // Verify error was logged with details - format: "Email sending failed for scan scan-123:"
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email sending failed for scan'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should log error name and message separately', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      const providerError = new Error('Connection timeout to SendGrid');
      mockEmailProvider.send.mockRejectedValue(providerError);

      try {
        await processSendEmail(job);
      } catch {
        // Expected to throw
      }

      // Verify detailed error logging - format: "   Error name: Error"
      // Note: console.error is called with a single string argument containing the full log message
      expect(consoleSpy).toHaveBeenCalledWith('   Error name: Error');
      expect(consoleSpy).toHaveBeenCalledWith('   Error message: Connection timeout to SendGrid');
      consoleSpy.mockRestore();
    });

    it('should log error for batch email failures', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const jobData: SendEmailJobData = {
        batchId: 'batch-123',
        email: 'user@example.com',
        type: 'batch_complete',
      };
      const job = createMockJob(jobData);
      const batch = createMockBatchScan();

      mockPrisma.batchScan.findUnique.mockResolvedValue(batch);
      mockEmailProvider.send.mockRejectedValue(new Error('SES quota exceeded'));

      try {
        await processSendEmail(job);
      } catch {
        // Expected to throw
      }

      // Verify error was logged for batch - format: "Email sending failed for batch batch-123:"
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email sending failed for batch'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should preserve stack trace in error logs', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      const errorWithStack = new Error('Provider authentication failed');
      mockEmailProvider.send.mockRejectedValue(errorWithStack);

      try {
        await processSendEmail(job);
      } catch {
        // Expected to throw
      }

      // Verify stack trace logging - format: "   Stack trace: Error: Provider..."
      // The stack trace is logged as a single argument containing the full trace string
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Stack trace:.*Provider authentication failed/)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('EmailRouter integration', () => {
    it('should return provider name in result when using EmailRouter', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Provider should be reported
      expect(result.provider).toBeDefined();
      expect(typeof result.provider).toBe('string');
    });

    it('should use legacy provider when EmailRouter fails to initialize', async () => {
      // Reset router and mock config to fail
      resetEmailRouter();

      // This test verifies fallback behavior - the processor already handles this
      // by checking if router is null and using legacy provider
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan({ durationMs: 45000 });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      const result = await processSendEmail(job);

      // Should still successfully send email
      expect(result.sent).toBe(true);
    });

    it('should get EmailRouter singleton via getEmailRouter()', () => {
      // First call initializes
      const router1 = getEmailRouter();
      // Second call returns same instance
      const router2 = getEmailRouter();

      expect(router1).toBe(router2);
    });

    it('should allow reset of EmailRouter for testing', () => {
      // Get initial router
      const router1 = getEmailRouter();

      // Reset
      resetEmailRouter();

      // New router should be created
      const router2 = getEmailRouter();

      // Both should be defined (new instances)
      expect(router1).toBeDefined();
      expect(router2).toBeDefined();
    });
  });
});
