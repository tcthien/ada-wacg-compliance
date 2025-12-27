/**
 * Send Email Processor Tests
 *
 * Tests for email notification functionality.
 * Verifies email sending, template rendering, and GDPR compliance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job } from 'bullmq';
import {
  processSendEmail,
  type SendEmailJobData,
  type SendEmailJobResult,
  EmailSendError,
} from '../send-email.processor.js';
import { getPrismaClient } from '../../config/prisma.js';
import { createEmailProvider } from '../notifier/email-sender.js';
import type { Scan, ScanResult, Issue, IssueImpact } from '@prisma/client';

// Mock dependencies
vi.mock('../../config/prisma.js');
vi.mock('../notifier/email-sender.js');
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
 * Create a mock BullMQ job
 */
function createMockJob(data: SendEmailJobData): Job<SendEmailJobData> {
  return {
    id: 'job-123',
    data,
    updateProgress: vi.fn(),
  } as unknown as Job<SendEmailJobData>;
}

describe('Send Email Processor', () => {
  let mockPrisma: ReturnType<typeof vi.fn>;
  let mockEmailProvider: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup Prisma mock
    mockPrisma = {
      scan: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrisma as any);

    // Setup email provider mock
    mockEmailProvider = {
      send: vi.fn().mockResolvedValue({ messageId: 'msg-123' }),
    };
    vi.mocked(createEmailProvider).mockReturnValue(mockEmailProvider as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processSendEmail', () => {
    it('should send scan completion email successfully', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan();

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

      // Verify email sent
      expect(mockEmailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('complete'),
          html: expect.stringContaining('example.com'),
          text: expect.stringContaining('example.com'),
        })
      );

      // Verify email nullified
      expect(mockPrisma.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: { email: null },
      });

      // Verify result
      expect(result).toEqual({
        sent: true,
        emailNullified: true,
        messageId: 'msg-123',
      });

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
      const scan = createMockScan({ scanResult: null as any });

      mockPrisma.scan.findUnique.mockResolvedValue(scan);

      await expect(processSendEmail(job)).rejects.toThrow(EmailSendError);
      await expect(processSendEmail(job)).rejects.toThrow('no result data');

      // Email should not be sent
      expect(mockEmailProvider.send).not.toHaveBeenCalled();
    });

    it('should handle email provider errors', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan();

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

      // Verify email contains issue breakdown
      const sendCall = mockEmailProvider.send.mock.calls[0][0];
      expect(sendCall.html).toContain('15'); // total issues
      expect(sendCall.html).toContain('3'); // critical
      expect(sendCall.html).toContain('5'); // serious
      expect(sendCall.html).toContain('4'); // moderate
      expect(sendCall.html).toContain('3'); // minor
    });

    it('should include results URL in completion email', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan();

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      await processSendEmail(job);

      const sendCall = mockEmailProvider.send.mock.calls[0][0];
      expect(sendCall.html).toContain('https://example.com/scan/scan-123');
      expect(sendCall.text).toContain('https://example.com/scan/scan-123');
    });

    it('should include GDPR notice in email', async () => {
      const jobData: SendEmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };
      const job = createMockJob(jobData);
      const scan = createMockScan();

      mockPrisma.scan.findUnique.mockResolvedValue(scan);
      mockPrisma.scan.update.mockResolvedValue({ ...scan, email: null });

      await processSendEmail(job);

      const sendCall = mockEmailProvider.send.mock.calls[0][0];
      expect(sendCall.html).toContain('GDPR');
      expect(sendCall.html).toContain('deleted');
      expect(sendCall.text).toContain('GDPR');
      expect(sendCall.text).toContain('deleted');
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

      await processSendEmail(job);

      const sendCall = mockEmailProvider.send.mock.calls[0][0];
      expect(sendCall.html).toContain('Unknown error');
      expect(sendCall.text).toContain('Unknown error');
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
});
