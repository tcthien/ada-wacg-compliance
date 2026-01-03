/**
 * Email Notification Integration Tests
 *
 * Integration tests for the email notification job flow.
 * Tests the end-to-end flow from job creation to processing.
 *
 * Tests cover:
 * - queueEmailNotification creates correct job (scan emails)
 * - queueBatchEmailNotification creates correct job (batch emails)
 * - Job processing flow with mocked providers
 * - Retry configuration (5 attempts with exponential backoff)
 *
 * Per Requirements 2.1, 4.2, 5.1:
 * - Single scan email notifications
 * - Batch scan email notifications
 * - Job queue integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Job } from 'bullmq';
import type { EmailJobData } from './email-queue.js';
import type { SendEmailJobData } from '../processors/send-email.processor.js';

// ============================================================================
// Mock Dependencies
// ============================================================================

// Store created jobs for inspection
let createdJobs: Array<{
  name: string;
  data: EmailJobData;
  opts: Record<string, unknown>;
}> = [];

// Mock add function
const mockQueueAdd = vi.fn();

// Mock BullMQ Queue as a class
vi.mock('bullmq', () => {
  class MockQueue {
    name: string;

    constructor(name: string) {
      this.name = name;
    }

    add = vi.fn().mockImplementation(
      (jobName: string, data: EmailJobData, opts: Record<string, unknown>) => {
        const mockJob = {
          id: `mock-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: jobName,
          data,
          opts,
        };
        createdJobs.push({ name: jobName, data, opts });
        mockQueueAdd(jobName, data, opts);
        return Promise.resolve(mockJob);
      }
    );

    close = vi.fn().mockResolvedValue(undefined);
  }

  return {
    Queue: MockQueue,
    Job: vi.fn(),
  };
});

// Mock Redis config
vi.mock('../config/redis.js', () => ({
  getBullMQConnection: vi.fn().mockReturnValue({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }),
}));

// Mock Prisma client
const mockPrismaFindUnique = vi.fn();
const mockPrismaUpdate = vi.fn();
const mockPrismaBatchFindUnique = vi.fn();
const mockPrismaBatchUpdate = vi.fn();

vi.mock('../config/prisma.js', () => ({
  getPrismaClient: vi.fn(() => ({
    scan: {
      findUnique: mockPrismaFindUnique,
      update: mockPrismaUpdate,
    },
    batchScan: {
      findUnique: mockPrismaBatchFindUnique,
      update: mockPrismaBatchUpdate,
    },
  })),
  default: vi.fn(() => ({
    scan: {
      findUnique: mockPrismaFindUnique,
      update: mockPrismaUpdate,
    },
    batchScan: {
      findUnique: mockPrismaBatchFindUnique,
      update: mockPrismaBatchUpdate,
    },
  })),
}));

// Mock EmailRouter with send function
const mockEmailRouterSend = vi.fn();

vi.mock('../processors/notifier/email-router.js', () => ({
  EmailRouter: vi.fn().mockImplementation(() => ({
    send: mockEmailRouterSend,
    hasProvider: vi.fn().mockReturnValue(true),
    defaultProviderType: 'SES',
  })),
}));

// Mock email routing config
vi.mock('../config/email-routing.config.js', () => ({
  loadEmailRoutingConfig: vi.fn().mockReturnValue({
    defaultProvider: 'SES',
    providers: {
      SES: { region: 'us-east-1', fromEmail: 'noreply@test.com' },
    },
    patterns: [],
  }),
}));

// Mock legacy email sender (fallback when EmailRouter is not available)
const mockLegacyProviderSend = vi.fn();

vi.mock('../processors/notifier/email-sender.js', () => ({
  createEmailProvider: vi.fn().mockImplementation(() => ({
    send: mockLegacyProviderSend,
  })),
  SendGridProvider: vi.fn().mockImplementation(() => ({
    send: mockLegacyProviderSend,
  })),
}));

// Mock env
vi.mock('../config/env.js', () => ({
  env: {
    APP_URL: 'https://test.adashield.com',
    SENDGRID_API_KEY: 'SG.test-key',
    SMTP_FROM: 'noreply@test.com',
  },
}));

// ============================================================================
// Import modules after mocking
// ============================================================================

// We need to dynamically import after mocking
async function importModules() {
  // Reset module cache for fresh imports
  vi.resetModules();

  const emailQueueModule = await import('./email-queue.js');
  const batchStatusModule = await import('../services/batch-status.service.js');
  const sendEmailProcessorModule = await import('../processors/send-email.processor.js');

  return {
    sendEmailQueue: emailQueueModule.sendEmailQueue,
    addEmailJob: emailQueueModule.addEmailJob,
    EMAIL_JOB_OPTIONS: emailQueueModule.EMAIL_JOB_OPTIONS,
    SEND_EMAIL_QUEUE_NAME: emailQueueModule.SEND_EMAIL_QUEUE_NAME,
    queueBatchEmailNotification: batchStatusModule.queueBatchEmailNotification,
    processSendEmail: sendEmailProcessorModule.processSendEmail,
    resetEmailRouter: sendEmailProcessorModule.resetEmailRouter,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Email Notification Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdJobs = [];

    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queueEmailNotification (Single Scan Emails)', () => {
    it('should create job with correct data for scan_complete', async () => {
      const { addEmailJob } = await importModules();

      const jobData: EmailJobData = {
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      };

      const job = await addEmailJob(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();

      // Verify job was created with correct data
      expect(createdJobs).toHaveLength(1);
      expect(createdJobs[0].data).toEqual({
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'scan_complete',
      });
    });

    it('should create job with correct data for scan_failed', async () => {
      const { addEmailJob } = await importModules();

      const jobData: EmailJobData = {
        scanId: 'scan-456',
        email: 'admin@company.com',
        type: 'scan_failed',
      };

      const job = await addEmailJob(jobData);

      expect(job).toBeDefined();
      expect(createdJobs).toHaveLength(1);
      expect(createdJobs[0].data).toEqual({
        scanId: 'scan-456',
        email: 'admin@company.com',
        type: 'scan_failed',
      });
    });

    it('should use correct queue name', async () => {
      const { addEmailJob, SEND_EMAIL_QUEUE_NAME } = await importModules();

      await addEmailJob({
        scanId: 'scan-789',
        email: 'test@test.com',
        type: 'scan_complete',
      });

      expect(createdJobs).toHaveLength(1);
      expect(createdJobs[0].name).toBe(SEND_EMAIL_QUEUE_NAME);
    });

    it('should include correct job options (retry config)', async () => {
      const { addEmailJob, EMAIL_JOB_OPTIONS } = await importModules();

      await addEmailJob({
        scanId: 'scan-101',
        email: 'test@test.com',
        type: 'scan_complete',
      });

      expect(createdJobs).toHaveLength(1);
      expect(createdJobs[0].opts).toEqual(EMAIL_JOB_OPTIONS);
    });
  });

  describe('queueBatchEmailNotification (Batch Emails)', () => {
    it('should create job with correct data for batch_complete', async () => {
      const { queueBatchEmailNotification } = await importModules();

      await queueBatchEmailNotification('batch-123', 'batch-owner@example.com');

      expect(createdJobs).toHaveLength(1);
      expect(createdJobs[0].data).toEqual({
        batchId: 'batch-123',
        email: 'batch-owner@example.com',
        type: 'batch_complete',
      });
    });

    it('should NOT include scanId for batch emails', async () => {
      const { queueBatchEmailNotification } = await importModules();

      await queueBatchEmailNotification('batch-456', 'user@domain.com');

      expect(createdJobs).toHaveLength(1);
      expect(createdJobs[0].data.scanId).toBeUndefined();
      expect(createdJobs[0].data.batchId).toBe('batch-456');
    });

    it('should handle errors gracefully without throwing', async () => {
      const { sendEmailQueue, queueBatchEmailNotification } = await importModules();

      // Force the queue.add to throw
      sendEmailQueue.add.mockRejectedValueOnce(
        new Error('Redis connection failed')
      );

      // Should not throw, just log error
      await expect(
        queueBatchEmailNotification('batch-fail', 'user@test.com')
      ).resolves.not.toThrow();
    });
  });

  describe('Retry Configuration', () => {
    it('should configure 5 retry attempts', async () => {
      const { EMAIL_JOB_OPTIONS } = await importModules();

      expect(EMAIL_JOB_OPTIONS.attempts).toBe(5);
    });

    it('should configure exponential backoff starting at 3 seconds', async () => {
      const { EMAIL_JOB_OPTIONS } = await importModules();

      expect(EMAIL_JOB_OPTIONS.backoff).toEqual({
        type: 'exponential',
        delay: 3000,
      });
    });

    it('should configure job removal settings', async () => {
      const { EMAIL_JOB_OPTIONS } = await importModules();

      // Completed jobs removed after 24 hours
      expect(EMAIL_JOB_OPTIONS.removeOnComplete).toEqual({
        age: 24 * 60 * 60, // 24 hours in seconds
      });

      // Failed jobs kept for debugging
      expect(EMAIL_JOB_OPTIONS.removeOnFail).toBe(false);
    });

    it('should apply retry config to all email jobs', async () => {
      const { addEmailJob, EMAIL_JOB_OPTIONS } = await importModules();

      // Create multiple different job types
      await addEmailJob({
        scanId: 'scan-1',
        email: 'user1@test.com',
        type: 'scan_complete',
      });

      await addEmailJob({
        scanId: 'scan-2',
        email: 'user2@test.com',
        type: 'scan_failed',
      });

      await addEmailJob({
        batchId: 'batch-1',
        email: 'user3@test.com',
        type: 'batch_complete',
      });

      // All jobs should have same retry options
      expect(createdJobs).toHaveLength(3);
      createdJobs.forEach((job) => {
        expect(job.opts).toEqual(EMAIL_JOB_OPTIONS);
      });
    });
  });

  describe('Job Processing Flow with Mocked Providers', () => {
    const createMockJob = (data: SendEmailJobData): Job<SendEmailJobData> => {
      return {
        id: `test-job-${Date.now()}`,
        data,
        opts: { attempts: 5 },
        attemptsMade: 1,
        updateProgress: vi.fn().mockResolvedValue(undefined),
        progress: 0,
      } as unknown as Job<SendEmailJobData>;
    };

    beforeEach(() => {
      // Reset mocks for processing tests
      mockEmailRouterSend.mockReset();
      mockLegacyProviderSend.mockReset();
      mockPrismaFindUnique.mockReset();
      mockPrismaUpdate.mockReset();
      mockPrismaBatchFindUnique.mockReset();
      mockPrismaBatchUpdate.mockReset();
    });

    it('should process scan_complete job through mocked provider', async () => {
      const { processSendEmail, resetEmailRouter } = await importModules();

      // Reset router to force re-initialization with our mock
      resetEmailRouter();

      // Mock scan data
      mockPrismaFindUnique.mockResolvedValue({
        id: 'scan-process-1',
        url: 'https://example.com',
        status: 'COMPLETED',
        durationMs: 45000, // Over 30s threshold
        scanResult: {
          totalIssues: 5,
          criticalCount: 2,
          seriousCount: 1,
          moderateCount: 1,
          minorCount: 1,
        },
      });

      // Mock email send for both router and legacy fallback
      mockEmailRouterSend.mockResolvedValue({
        messageId: 'msg-12345',
        provider: 'SES',
      });
      mockLegacyProviderSend.mockResolvedValue({
        messageId: 'msg-legacy-12345',
      });

      // Mock update
      mockPrismaUpdate.mockResolvedValue({});

      const mockJob = createMockJob({
        scanId: 'scan-process-1',
        email: 'user@example.com',
        type: 'scan_complete',
      });

      const result = await processSendEmail(mockJob);

      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
      // Should use either the router or legacy provider based on router initialization
      expect(result.messageId).toBeDefined();

      // Verify GDPR nullification was called
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: 'scan-process-1' },
        data: { email: null },
      });
    }, 10000);

    it('should process scan_failed job through mocked provider', async () => {
      const { processSendEmail, resetEmailRouter } = await importModules();

      resetEmailRouter();

      // Mock failed scan data
      mockPrismaFindUnique.mockResolvedValue({
        id: 'scan-fail-1',
        url: 'https://broken.com',
        status: 'FAILED',
        durationMs: 5000,
        errorMessage: 'Navigation timeout',
        scanResult: null,
      });

      mockEmailRouterSend.mockResolvedValue({
        messageId: 'msg-fail-123',
        provider: 'SENDGRID',
      });
      mockLegacyProviderSend.mockResolvedValue({
        messageId: 'msg-legacy-fail-123',
      });

      mockPrismaUpdate.mockResolvedValue({});

      const mockJob = createMockJob({
        scanId: 'scan-fail-1',
        email: 'admin@example.com',
        type: 'scan_failed',
      });

      const result = await processSendEmail(mockJob);

      expect(result.sent).toBe(true);
      expect(result.messageId).toBeDefined();
    }, 10000);

    it('should process batch_complete job through mocked provider', async () => {
      const { processSendEmail, resetEmailRouter } = await importModules();

      resetEmailRouter();

      // Mock batch data
      mockPrismaBatchFindUnique.mockResolvedValue({
        id: 'batch-process-1',
        homepageUrl: 'https://example.com',
        totalUrls: 10,
        completedCount: 8,
        failedCount: 2,
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
              passedChecks: 50,
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
              moderateCount: 1,
              minorCount: 0,
              passedChecks: 60,
            },
          },
        ],
        reports: [],
      });

      mockEmailRouterSend.mockResolvedValue({
        messageId: 'msg-batch-456',
        provider: 'SES',
      });
      mockLegacyProviderSend.mockResolvedValue({
        messageId: 'msg-legacy-batch-456',
      });

      mockPrismaBatchUpdate.mockResolvedValue({});

      const mockJob = createMockJob({
        batchId: 'batch-process-1',
        email: 'batch-owner@example.com',
        type: 'batch_complete',
      });

      const result = await processSendEmail(mockJob);

      expect(result.sent).toBe(true);
      expect(result.emailNullified).toBe(true);
      expect(result.messageId).toBeDefined();

      // Verify batch email nullification
      expect(mockPrismaBatchUpdate).toHaveBeenCalledWith({
        where: { id: 'batch-process-1' },
        data: { email: null },
      });
    }, 10000);

    it('should skip email for fast scans (under 30 seconds)', async () => {
      const { processSendEmail, resetEmailRouter } = await importModules();

      resetEmailRouter();

      // Mock fast scan data (under 30s threshold)
      mockPrismaFindUnique.mockResolvedValue({
        id: 'scan-fast-1',
        url: 'https://example.com',
        status: 'COMPLETED',
        durationMs: 15000, // Under 30s threshold
        scanResult: {
          totalIssues: 2,
          criticalCount: 0,
          seriousCount: 1,
          moderateCount: 1,
          minorCount: 0,
        },
      });

      mockPrismaUpdate.mockResolvedValue({});

      const mockJob = createMockJob({
        scanId: 'scan-fast-1',
        email: 'user@example.com',
        type: 'scan_complete',
      });

      const result = await processSendEmail(mockJob);

      // Email should be skipped but still nullified for GDPR
      expect(result.sent).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('15000ms');
      expect(result.emailNullified).toBe(true);

      // Neither provider should have been called
      expect(mockEmailRouterSend).not.toHaveBeenCalled();
      expect(mockLegacyProviderSend).not.toHaveBeenCalled();

      // Email should still be nullified
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: 'scan-fast-1' },
        data: { email: null },
      });
    });

    it('should propagate provider errors for retry', async () => {
      const { processSendEmail, resetEmailRouter } = await importModules();

      resetEmailRouter();

      mockPrismaFindUnique.mockResolvedValue({
        id: 'scan-error-1',
        url: 'https://example.com',
        status: 'COMPLETED',
        durationMs: 45000,
        scanResult: {
          totalIssues: 1,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 1,
          minorCount: 0,
        },
      });

      // Mock provider error on both router and legacy
      mockEmailRouterSend.mockRejectedValue(
        new Error('SendGrid API rate limit exceeded')
      );
      mockLegacyProviderSend.mockRejectedValue(
        new Error('SendGrid API rate limit exceeded')
      );

      const mockJob = createMockJob({
        scanId: 'scan-error-1',
        email: 'user@example.com',
        type: 'scan_complete',
      });

      // Should throw error for BullMQ to retry
      await expect(processSendEmail(mockJob)).rejects.toThrow(
        /SendGrid API rate limit exceeded|Failed to send email/
      );
    }, 10000);
  });

  describe('Queue Instance Configuration', () => {
    it('should create queue with correct name', async () => {
      const { SEND_EMAIL_QUEUE_NAME } = await importModules();

      expect(SEND_EMAIL_QUEUE_NAME).toBe('send-email');
    });

    it('should use BullMQ connection configuration', async () => {
      const { sendEmailQueue } = await importModules();

      expect(sendEmailQueue).toBeDefined();
      expect(sendEmailQueue.name).toBe('send-email');
    });
  });

  describe('End-to-End Job Flow', () => {
    it('should complete full flow: queue -> create job -> correct data structure', async () => {
      const { addEmailJob, EMAIL_JOB_OPTIONS, SEND_EMAIL_QUEUE_NAME } =
        await importModules();

      // Simulate what happens when a scan completes and queues an email
      const scanCompleteData: EmailJobData = {
        scanId: 'e2e-scan-123',
        email: 'e2e-test@example.com',
        type: 'scan_complete',
      };

      const job = await addEmailJob(scanCompleteData);

      // Verify job creation
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.data).toEqual(scanCompleteData);

      // Verify job is ready for processing
      expect(createdJobs).toHaveLength(1);
      const createdJob = createdJobs[0];

      // Verify correct queue
      expect(createdJob.name).toBe(SEND_EMAIL_QUEUE_NAME);

      // Verify job data matches what processor expects
      expect(createdJob.data.scanId).toBe('e2e-scan-123');
      expect(createdJob.data.email).toBe('e2e-test@example.com');
      expect(createdJob.data.type).toBe('scan_complete');

      // Verify retry configuration
      expect(createdJob.opts.attempts).toBe(5);
      expect(createdJob.opts.backoff).toEqual({
        type: 'exponential',
        delay: 3000,
      });
    });

    it('should handle multiple concurrent job creations', async () => {
      const { addEmailJob } = await importModules();

      // Simulate multiple scans completing at once
      const jobs = await Promise.all([
        addEmailJob({
          scanId: 'concurrent-1',
          email: 'user1@test.com',
          type: 'scan_complete',
        }),
        addEmailJob({
          scanId: 'concurrent-2',
          email: 'user2@test.com',
          type: 'scan_failed',
        }),
        addEmailJob({
          batchId: 'concurrent-batch-1',
          email: 'batch@test.com',
          type: 'batch_complete',
        }),
      ]);

      expect(jobs).toHaveLength(3);
      expect(createdJobs).toHaveLength(3);

      // Each job should have unique ID
      const jobIds = jobs.map((j) => j.id);
      const uniqueIds = new Set(jobIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing scanId for scan emails gracefully', async () => {
      const { processSendEmail } = await importModules();

      const mockJob = {
        id: 'error-job-1',
        data: {
          email: 'user@test.com',
          type: 'scan_complete' as const,
          // scanId intentionally missing
        },
        opts: { attempts: 5 },
        attemptsMade: 1,
        updateProgress: vi.fn(),
      } as unknown as Job<SendEmailJobData>;

      // Match actual error message
      await expect(processSendEmail(mockJob)).rejects.toThrow(
        /scanId is required/
      );
    });

    it('should handle missing batchId for batch emails gracefully', async () => {
      const { processSendEmail } = await importModules();

      const mockJob = {
        id: 'error-job-2',
        data: {
          email: 'user@test.com',
          type: 'batch_complete' as const,
          // batchId intentionally missing
        },
        opts: { attempts: 5 },
        attemptsMade: 1,
        updateProgress: vi.fn(),
      } as unknown as Job<SendEmailJobData>;

      // Match actual error message
      await expect(processSendEmail(mockJob)).rejects.toThrow(
        /batchId is required/
      );
    });

    it('should handle scan not found error', async () => {
      const { processSendEmail, resetEmailRouter } = await importModules();

      resetEmailRouter();
      mockPrismaFindUnique.mockResolvedValue(null);

      const mockJob = {
        id: 'error-job-3',
        data: {
          scanId: 'non-existent-scan',
          email: 'user@test.com',
          type: 'scan_complete' as const,
        },
        opts: { attempts: 5 },
        attemptsMade: 1,
        updateProgress: vi.fn(),
      } as unknown as Job<SendEmailJobData>;

      // Match actual error message (case insensitive)
      await expect(processSendEmail(mockJob)).rejects.toThrow(
        /[Ss]can not found/
      );
    });
  });
});
