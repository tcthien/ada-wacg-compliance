/**
 * AI Email Service Tests
 *
 * Tests for AI-enhanced scan email generation and queuing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiEmailService, type ScanWithAiResult } from './ai-email.service.js';
import * as prismaModule from '../../config/prisma.js';
import * as emailQueueModule from '../../jobs/email-queue.js';
import type { Job } from 'bullmq';

// Mock dependencies
vi.mock('../../config/prisma.js');
vi.mock('../../jobs/email-queue.js');

describe('AiEmailService', () => {
  let service: AiEmailService;
  let mockPrisma: any;
  let mockAddEmailJob: any;

  beforeEach(() => {
    service = new AiEmailService();

    // Mock Prisma client
    mockPrisma = {
      scan: {
        findUnique: vi.fn(),
      },
    };
    vi.mocked(prismaModule.getPrismaClient).mockReturnValue(mockPrisma);

    // Mock email queue
    mockAddEmailJob = vi.fn().mockResolvedValue({
      id: 'job-123',
      data: {},
    } as Job);
    vi.mocked(emailQueueModule.addEmailJob).mockImplementation(mockAddEmailJob);

    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCombinedReportEmail', () => {
    it('should queue email job for valid AI scan', async () => {
      const scan: ScanWithAiResult = {
        id: 'scan-123',
        url: 'https://example.com',
        email: 'user@example.com',
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        aiSummary: 'This is an AI-generated summary of the accessibility issues found.',
        aiRemediationPlan: 'Step 1: Fix alt text. Estimated time: 2 hours',
        aiProcessedAt: new Date(),
        aiInputTokens: 1000,
        aiOutputTokens: 500,
        aiTotalTokens: 1500,
        aiModel: 'gpt-4',
        aiProcessingTime: 5,
        status: 'COMPLETED',
        guestSessionId: null,
        userId: null,
        wcagLevel: 'AA',
        durationMs: 5000,
        errorMessage: null,
        eventSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        batchId: null,
        pageTitle: null,
        scanResult: {
          id: 'result-123',
          scanId: 'scan-123',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          passedChecks: 20,
          inapplicableChecks: 5,
          createdAt: new Date(),
          issues: [
            {
              id: 'issue-1',
              scanResultId: 'result-123',
              ruleId: 'color-contrast',
              wcagCriteria: ['1.4.3'],
              impact: 'SERIOUS',
              description: 'Insufficient color contrast',
              helpText: 'Ensure text has sufficient contrast',
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.0/color-contrast',
              htmlSnippet: '<div>Text</div>',
              cssSelector: 'div',
              nodes: [],
              createdAt: new Date(),
              aiExplanation: 'Users with low vision may struggle to read this text',
              aiFixSuggestion: 'Change color to #000000 for better contrast',
              aiPriority: 9,
            },
          ],
        },
      };

      await service.generateCombinedReportEmail(scan);

      expect(mockAddEmailJob).toHaveBeenCalledWith({
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'ai_scan_complete',
      });
    });

    it('should throw error if AI not enabled', async () => {
      const scan: ScanWithAiResult = {
        id: 'scan-123',
        url: 'https://example.com',
        email: 'user@example.com',
        aiEnabled: false, // AI not enabled
        aiStatus: null,
        aiSummary: null,
        aiRemediationPlan: null,
        aiProcessedAt: null,
        aiInputTokens: null,
        aiOutputTokens: null,
        aiTotalTokens: null,
        aiModel: null,
        aiProcessingTime: null,
        status: 'COMPLETED',
        guestSessionId: null,
        userId: null,
        wcagLevel: 'AA',
        durationMs: 5000,
        errorMessage: null,
        eventSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        batchId: null,
        pageTitle: null,
        scanResult: null,
      };

      await expect(service.generateCombinedReportEmail(scan)).rejects.toThrow(
        'Cannot send AI email for scan scan-123: AI not enabled'
      );
    });

    it('should throw error if AI status not COMPLETED', async () => {
      const scan: ScanWithAiResult = {
        id: 'scan-123',
        url: 'https://example.com',
        email: 'user@example.com',
        aiEnabled: true,
        aiStatus: 'PENDING', // Not completed
        aiSummary: null,
        aiRemediationPlan: null,
        aiProcessedAt: null,
        aiInputTokens: null,
        aiOutputTokens: null,
        aiTotalTokens: null,
        aiModel: null,
        aiProcessingTime: null,
        status: 'COMPLETED',
        guestSessionId: null,
        userId: null,
        wcagLevel: 'AA',
        durationMs: 5000,
        errorMessage: null,
        eventSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        batchId: null,
        pageTitle: null,
        scanResult: null,
      };

      await expect(service.generateCombinedReportEmail(scan)).rejects.toThrow(
        'Cannot send AI email for scan scan-123: AI status is PENDING, expected COMPLETED'
      );
    });

    it('should throw error if AI summary missing', async () => {
      const scan: ScanWithAiResult = {
        id: 'scan-123',
        url: 'https://example.com',
        email: 'user@example.com',
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        aiSummary: null, // Missing summary
        aiRemediationPlan: 'Some plan',
        aiProcessedAt: new Date(),
        aiInputTokens: 1000,
        aiOutputTokens: 500,
        aiTotalTokens: 1500,
        aiModel: 'gpt-4',
        aiProcessingTime: 5,
        status: 'COMPLETED',
        guestSessionId: null,
        userId: null,
        wcagLevel: 'AA',
        durationMs: 5000,
        errorMessage: null,
        eventSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        batchId: null,
        pageTitle: null,
        scanResult: {
          id: 'result-123',
          scanId: 'scan-123',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          passedChecks: 20,
          inapplicableChecks: 5,
          createdAt: new Date(),
          issues: [],
        },
      };

      await expect(service.generateCombinedReportEmail(scan)).rejects.toThrow(
        'Cannot send AI email for scan scan-123: AI summary is missing'
      );
    });

    it('should throw error if scan result missing', async () => {
      const scan: ScanWithAiResult = {
        id: 'scan-123',
        url: 'https://example.com',
        email: 'user@example.com',
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        aiSummary: 'AI summary',
        aiRemediationPlan: 'Plan',
        aiProcessedAt: new Date(),
        aiInputTokens: 1000,
        aiOutputTokens: 500,
        aiTotalTokens: 1500,
        aiModel: 'gpt-4',
        aiProcessingTime: 5,
        status: 'COMPLETED',
        guestSessionId: null,
        userId: null,
        wcagLevel: 'AA',
        durationMs: 5000,
        errorMessage: null,
        eventSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        batchId: null,
        pageTitle: null,
        scanResult: null, // Missing result
      };

      await expect(service.generateCombinedReportEmail(scan)).rejects.toThrow(
        'Cannot send AI email for scan scan-123: Scan result is missing'
      );
    });

    it('should throw error if email address missing', async () => {
      const scan: ScanWithAiResult = {
        id: 'scan-123',
        url: 'https://example.com',
        email: null, // Missing email
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        aiSummary: 'AI summary',
        aiRemediationPlan: 'Plan',
        aiProcessedAt: new Date(),
        aiInputTokens: 1000,
        aiOutputTokens: 500,
        aiTotalTokens: 1500,
        aiModel: 'gpt-4',
        aiProcessingTime: 5,
        status: 'COMPLETED',
        guestSessionId: null,
        userId: null,
        wcagLevel: 'AA',
        durationMs: 5000,
        errorMessage: null,
        eventSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        batchId: null,
        pageTitle: null,
        scanResult: {
          id: 'result-123',
          scanId: 'scan-123',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          passedChecks: 20,
          inapplicableChecks: 5,
          createdAt: new Date(),
          issues: [],
        },
      };

      await expect(service.generateCombinedReportEmail(scan)).rejects.toThrow(
        'Cannot send AI email for scan scan-123: Email address is missing'
      );
    });
  });

  describe('queueAiReportEmail', () => {
    it('should fetch scan and queue email with scan email', async () => {
      const mockScan = {
        id: 'scan-123',
        url: 'https://example.com',
        email: 'user@example.com',
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        aiSummary: 'AI summary',
        aiRemediationPlan: 'Plan',
        aiProcessedAt: new Date(),
        scanResult: {
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          issues: [],
        },
      };

      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);

      await service.queueAiReportEmail('scan-123');

      expect(mockPrisma.scan.findUnique).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        include: {
          scanResult: {
            include: {
              issues: {
                where: {
                  aiPriority: { not: null },
                },
                orderBy: {
                  aiPriority: 'desc',
                },
              },
            },
          },
        },
      });

      expect(mockAddEmailJob).toHaveBeenCalledWith({
        scanId: 'scan-123',
        email: 'user@example.com',
        type: 'ai_scan_complete',
      });
    });

    it('should queue email with provided email override', async () => {
      const mockScan = {
        id: 'scan-123',
        url: 'https://example.com',
        email: 'old@example.com',
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        aiSummary: 'AI summary',
        aiRemediationPlan: 'Plan',
        aiProcessedAt: new Date(),
        scanResult: {
          totalIssues: 10,
          issues: [],
        },
      };

      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);

      await service.queueAiReportEmail('scan-123', 'new@example.com');

      expect(mockAddEmailJob).toHaveBeenCalledWith({
        scanId: 'scan-123',
        email: 'new@example.com',
        type: 'ai_scan_complete',
      });
    });

    it('should throw error if scan not found', async () => {
      mockPrisma.scan.findUnique.mockResolvedValue(null);

      await expect(
        service.queueAiReportEmail('scan-999')
      ).rejects.toThrow('Scan not found: scan-999');
    });

    it('should throw error if no email provided and scan has no email', async () => {
      const mockScan = {
        id: 'scan-123',
        email: null,
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        aiSummary: 'AI summary',
        scanResult: { issues: [] },
      };

      mockPrisma.scan.findUnique.mockResolvedValue(mockScan);

      await expect(
        service.queueAiReportEmail('scan-123')
      ).rejects.toThrow('No email address provided for scan scan-123');
    });
  });
});
