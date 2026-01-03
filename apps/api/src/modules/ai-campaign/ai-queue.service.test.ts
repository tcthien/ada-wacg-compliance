/**
 * AI Queue Service Unit Tests
 *
 * Tests for AI Queue business logic layer:
 * - exportPendingScans() generates correct CSV
 * - exportPendingScans() updates status to DOWNLOADED
 * - importAiResults() with valid CSV
 * - importAiResults() with invalid scan_id (should fail)
 * - importAiResults() atomic rollback on error
 * - retryFailedScan() resets status
 *
 * Requirements: REQ-4 (AI Scan Queue Management)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AiStatus, Scan, ScanResult, Issue } from '@prisma/client';

// Mock dependencies before imports
vi.mock('../../config/database.js');
vi.mock('./ai-campaign.service.js');
vi.mock('../../shared/queue/queue.service.js');

// Now safe to import
import {
  exportPendingScans,
  parseAndValidateCsv,
  validateScanEligibility,
  importAiResults,
  retryFailedScan,
  getQueueStats,
  listAiScans,
  updateScanWithAiResults,
  updateIssuesWithAi,
  AiQueueServiceError,
} from './ai-queue.service.js';
import { getPrismaClient } from '../../config/database.js';
import { deductTokens } from './ai-campaign.service.js';
import { addEmailJob } from '../../shared/queue/queue.service.js';

describe('AI Queue Service', () => {
  let mockPrismaClient: any;

  // Sample scan data
  const mockScan = {
    id: 'scan-123',
    url: 'https://example.com',
    email: 'user@example.com',
    wcagLevel: 'AA',
    pageTitle: 'Example Page',
    aiEnabled: true,
    aiStatus: 'PENDING' as AiStatus,
    aiSummary: null,
    aiRemediationPlan: null,
    aiInputTokens: null,
    aiOutputTokens: null,
    aiTotalTokens: null,
    aiModel: null,
    aiProcessedAt: null,
    createdAt: new Date('2025-01-01T10:00:00.000Z'),
    updatedAt: new Date('2025-01-01T10:00:00.000Z'),
    scanResult: {
      id: 'result-123',
      scanId: 'scan-123',
      issues: [
        {
          id: 'issue-1',
          scanResultId: 'result-123',
          ruleId: 'color-contrast',
          message: 'Text has insufficient contrast',
          impact: 'serious',
          selector: 'p.text',
          html: '<p class="text">Sample</p>',
          aiExplanation: null,
          aiFixSuggestion: null,
          aiPriority: null,
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Prisma mock with transaction support
    mockPrismaClient = {
      scan: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        aggregate: vi.fn(),
      },
      issue: {
        update: vi.fn(),
      },
      $transaction: vi.fn(async (fn: Function) => fn(mockPrismaClient)),
    };
    vi.mocked(getPrismaClient).mockReturnValue(mockPrismaClient);

    // Mock email job queue
    vi.mocked(addEmailJob).mockResolvedValue('job-123');

    // Mock token deduction
    vi.mocked(deductTokens).mockResolvedValue({
      id: 'campaign-123',
      name: 'Early Bird',
      totalTokenBudget: 100000,
      usedTokens: 45000,
      reservedSlots: 0,
      avgTokensPerScan: 100,
      status: 'ACTIVE',
      startsAt: new Date(),
      endsAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // EXPORT PENDING SCANS TESTS
  // ============================================================================

  describe('exportPendingScans', () => {
    it('should generate correct CSV with header and data', async () => {
      // Arrange
      mockPrismaClient.scan.findMany.mockResolvedValue([mockScan]);
      mockPrismaClient.scan.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await exportPendingScans();

      // Assert
      expect(result.count).toBe(1);
      expect(result.scanIds).toEqual(['scan-123']);
      expect(result.csv).toContain('scan_id,url,email,wcag_level,issues_json,created_at,page_title');
      expect(result.csv).toContain('scan-123');
      expect(result.csv).toContain('https://example.com');
      expect(result.csv).toContain('user@example.com');
      expect(result.csv).toContain('AA');
      expect(result.csv).toContain('Example Page');
    });

    it('should update scan status to DOWNLOADED atomically', async () => {
      // Arrange
      mockPrismaClient.scan.findMany.mockResolvedValue([mockScan]);
      mockPrismaClient.scan.updateMany.mockResolvedValue({ count: 1 });

      // Act
      await exportPendingScans();

      // Assert
      expect(mockPrismaClient.scan.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['scan-123'] },
        },
        data: {
          aiStatus: 'DOWNLOADED',
        },
      });
    });

    it('should throw error when no pending scans available', async () => {
      // Arrange
      mockPrismaClient.scan.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(exportPendingScans()).rejects.toThrow(AiQueueServiceError);
      await expect(exportPendingScans()).rejects.toMatchObject({
        code: 'NO_PENDING_SCANS',
      });
    });

    it('should escape CSV special characters correctly', async () => {
      // Arrange - scan with quotes in URL
      const scanWithQuotes = {
        ...mockScan,
        url: 'https://example.com/page?q="test"',
        pageTitle: 'Page with "quotes" and, commas',
      };
      mockPrismaClient.scan.findMany.mockResolvedValue([scanWithQuotes]);
      mockPrismaClient.scan.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await exportPendingScans();

      // Assert - quotes should be escaped by doubling
      expect(result.csv).toContain('""test""');
      expect(result.csv).toContain('""quotes""');
    });

    it('should handle null values in optional fields', async () => {
      // Arrange
      const scanWithNulls = {
        ...mockScan,
        email: null,
        pageTitle: null,
      };
      mockPrismaClient.scan.findMany.mockResolvedValue([scanWithNulls]);
      mockPrismaClient.scan.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await exportPendingScans();

      // Assert
      expect(result.count).toBe(1);
      expect(result.csv).toContain('""'); // Null values become empty strings
    });

    it('should serialize issues to JSON in CSV', async () => {
      // Arrange
      mockPrismaClient.scan.findMany.mockResolvedValue([mockScan]);
      mockPrismaClient.scan.updateMany.mockResolvedValue({ count: 1 });

      // Act
      const result = await exportPendingScans();

      // Assert - CSV should contain JSON-serialized issues
      expect(result.csv).toContain('color-contrast');
      expect(result.csv).toContain('issue-1');
    });
  });

  // ============================================================================
  // PARSE AND VALIDATE CSV TESTS
  // ============================================================================

  describe('parseAndValidateCsv', () => {
    const validCsv = `scan_id,ai_summary,ai_remediation_plan,ai_issues_json,tokens_used,ai_model,processing_time
"scan-123","Summary of issues found.","Step 1: Fix forms. Step 2: Add labels.","[]",4500,"claude-3-opus",45`;

    it('should parse valid CSV with all fields', () => {
      // Act
      const result = parseAndValidateCsv(validCsv);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        scan_id: 'scan-123',
        ai_summary: 'Summary of issues found.',
        ai_remediation_plan: 'Step 1: Fix forms. Step 2: Add labels.',
        tokens_used: 4500,
        ai_model: 'claude-3-opus',
      });
    });

    it('should throw error for empty CSV', () => {
      // Act & Assert
      expect(() => parseAndValidateCsv('')).toThrow(AiQueueServiceError);
    });

    it('should throw error for CSV with only header', () => {
      // Arrange
      const headerOnly = 'scan_id,ai_summary,ai_remediation_plan,ai_issues_json,tokens_used,ai_model,processing_time\n';

      // Act & Assert
      expect(() => parseAndValidateCsv(headerOnly)).toThrow(AiQueueServiceError);
      expect(() => parseAndValidateCsv(headerOnly)).toThrow('empty');
    });

    it('should throw validation error for missing required fields', () => {
      // Arrange - missing ai_summary
      const invalidCsv = `scan_id,ai_remediation_plan,ai_issues_json,tokens_used,ai_model,processing_time
"scan-123","Plan","[]",4500,"claude-3-opus",45`;

      // Act & Assert
      expect(() => parseAndValidateCsv(invalidCsv)).toThrow(AiQueueServiceError);
    });

    it('should validate tokens_used is a positive number', () => {
      // Arrange - negative tokens
      const invalidCsv = `scan_id,ai_summary,ai_remediation_plan,ai_issues_json,tokens_used,ai_model,processing_time
"scan-123","Summary","Plan","[]",-100,"claude-3-opus",45`;

      // Act & Assert
      expect(() => parseAndValidateCsv(invalidCsv)).toThrow(AiQueueServiceError);
    });

    it('should handle multiple rows', () => {
      // Arrange
      const multiRowCsv = `scan_id,ai_summary,ai_remediation_plan,ai_issues_json,tokens_used,ai_model,processing_time
"scan-1","Summary 1","Plan 1","[]",1000,"claude-3-opus",10
"scan-2","Summary 2","Plan 2","[]",2000,"claude-3-opus",20
"scan-3","Summary 3","Plan 3","[]",3000,"claude-3-opus",30`;

      // Act
      const result = parseAndValidateCsv(multiRowCsv);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]!.scan_id).toBe('scan-1');
      expect(result[1]!.scan_id).toBe('scan-2');
      expect(result[2]!.scan_id).toBe('scan-3');
    });
  });

  // ============================================================================
  // VALIDATE SCAN ELIGIBILITY TESTS
  // ============================================================================

  describe('validateScanEligibility', () => {
    it('should return valid for eligible scan', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'DOWNLOADED',
      });

      // Act
      const result = await validateScanEligibility('scan-123');

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail when scan not found', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue(null);

      // Act
      const result = await validateScanEligibility('nonexistent');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('SCAN_NOT_FOUND');
    });

    it('should fail when AI is not enabled', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: false,
        aiStatus: 'PENDING',
      });

      // Act
      const result = await validateScanEligibility('scan-123');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('AI_NOT_ENABLED');
    });

    it('should fail when status is not DOWNLOADED', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'PENDING', // Should be DOWNLOADED
      });

      // Act
      const result = await validateScanEligibility('scan-123');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_AI_STATUS');
    });

    it('should fail when aiStatus is COMPLETED', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'COMPLETED', // Already completed
      });

      // Act
      const result = await validateScanEligibility('scan-123');

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_AI_STATUS');
      expect(result.error).toContain('COMPLETED');
    });
  });

  // ============================================================================
  // IMPORT AI RESULTS TESTS
  // ============================================================================

  describe('importAiResults', () => {
    const validCsv = `scan_id,ai_summary,ai_remediation_plan,ai_issues_json,tokens_used,ai_model,processing_time
"scan-123","Summary","Plan","[]",4500,"claude-3-opus",45`;

    it('should import valid CSV successfully', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'scan-123') {
          return {
            id: 'scan-123',
            aiEnabled: true,
            aiStatus: 'DOWNLOADED',
            email: 'user@example.com',
            url: 'https://example.com',
          };
        }
        return null;
      });
      mockPrismaClient.scan.update.mockResolvedValue({});

      // Act
      const result = await importAiResults(validCsv);

      // Assert
      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.tokensDeducted).toBe(4500);
    });

    it('should update scan with AI results', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'DOWNLOADED',
        email: 'user@example.com',
        url: 'https://example.com',
      });
      mockPrismaClient.scan.update.mockResolvedValue({});

      // Act
      await importAiResults(validCsv);

      // Assert
      expect(mockPrismaClient.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: expect.objectContaining({
          aiSummary: 'Summary',
          aiRemediationPlan: 'Plan',
          aiStatus: 'COMPLETED',
          aiTotalTokens: 4500,
          aiModel: 'claude-3-opus',
          aiProcessedAt: expect.any(Date),
        }),
      });
    });

    it('should fail for invalid scan_id', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue(null);

      // Act
      const result = await importAiResults(validCsv);

      // Assert
      expect(result.success).toBe(false);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.scanId).toBe('scan-123');
    });

    it('should queue email notification for completed scans', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'DOWNLOADED',
        email: 'user@example.com',
        url: 'https://example.com',
      });
      mockPrismaClient.scan.update.mockResolvedValue({});

      // Act
      await importAiResults(validCsv);

      // Assert
      expect(addEmailJob).toHaveBeenCalledWith(
        'user@example.com',
        'ai-scan-complete',
        expect.objectContaining({
          scanId: 'scan-123',
          url: 'https://example.com',
          aiSummary: 'Summary',
        }),
        expect.any(Object)
      );
    });

    it('should deduct tokens from campaign', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'DOWNLOADED',
        email: 'user@example.com',
        url: 'https://example.com',
      });
      mockPrismaClient.scan.update.mockResolvedValue({});

      // Act
      await importAiResults(validCsv);

      // Assert
      expect(deductTokens).toHaveBeenCalledWith('scan-123', 4500);
    });

    it('should handle partial success with multiple rows', async () => {
      // Arrange
      const multiRowCsv = `scan_id,ai_summary,ai_remediation_plan,ai_issues_json,tokens_used,ai_model,processing_time
"scan-1","Summary 1","Plan 1","[]",1000,"claude-3-opus",10
"scan-2","Summary 2","Plan 2","[]",2000,"claude-3-opus",20`;

      mockPrismaClient.scan.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'scan-1') {
          return {
            id: 'scan-1',
            aiEnabled: true,
            aiStatus: 'DOWNLOADED',
            email: 'user@example.com',
            url: 'https://example.com',
          };
        }
        return null; // scan-2 not found
      });
      mockPrismaClient.scan.update.mockResolvedValue({});

      // Act
      const result = await importAiResults(multiRowCsv);

      // Assert
      expect(result.success).toBe(false); // Partial failure
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.tokensDeducted).toBe(1000); // Only scan-1's tokens
    });

    it('should not fail import if email queue fails', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'DOWNLOADED',
        email: 'user@example.com',
        url: 'https://example.com',
      });
      mockPrismaClient.scan.update.mockResolvedValue({});
      vi.mocked(addEmailJob).mockRejectedValue(new Error('Email queue error'));

      // Act
      const result = await importAiResults(validCsv);

      // Assert - import should still succeed
      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
    });

    it('should not fail import if token deduction fails', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'DOWNLOADED',
        email: 'user@example.com',
        url: 'https://example.com',
      });
      mockPrismaClient.scan.update.mockResolvedValue({});
      vi.mocked(deductTokens).mockRejectedValue(new Error('Token deduction error'));

      // Act
      const result = await importAiResults(validCsv);

      // Assert - import should still succeed
      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.tokensDeducted).toBe(0); // But tokens not deducted
    });
  });

  // ============================================================================
  // RETRY FAILED SCAN TESTS
  // ============================================================================

  describe('retryFailedScan', () => {
    it('should reset FAILED scan to PENDING', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'FAILED',
        url: 'https://example.com',
      });
      mockPrismaClient.scan.update.mockResolvedValue({});

      // Act
      const result = await retryFailedScan('scan-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.aiStatus).toBe('PENDING');
      expect(mockPrismaClient.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: {
          aiStatus: 'PENDING',
          errorMessage: null,
        },
      });
    });

    it('should fail for non-FAILED status', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: true,
        aiStatus: 'COMPLETED',
        url: 'https://example.com',
      });

      // Act
      const result = await retryFailedScan('scan-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Only FAILED scans can be retried');
      expect(mockPrismaClient.scan.update).not.toHaveBeenCalled();
    });

    it('should fail when AI is not enabled', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue({
        id: 'scan-123',
        aiEnabled: false,
        aiStatus: 'FAILED',
        url: 'https://example.com',
      });

      // Act
      const result = await retryFailedScan('scan-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('AI enabled');
    });

    it('should throw error when scan not found', async () => {
      // Arrange
      mockPrismaClient.scan.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(retryFailedScan('nonexistent')).rejects.toThrow(AiQueueServiceError);
      await expect(retryFailedScan('nonexistent')).rejects.toMatchObject({
        code: 'SCAN_NOT_FOUND',
      });
    });

    it('should throw error for invalid scan ID', async () => {
      // Act & Assert
      await expect(retryFailedScan('')).rejects.toThrow(AiQueueServiceError);
      await expect(retryFailedScan('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });
  });

  // ============================================================================
  // GET QUEUE STATS TESTS
  // ============================================================================

  describe('getQueueStats', () => {
    it('should return comprehensive queue statistics', async () => {
      // Arrange
      mockPrismaClient.scan.count.mockResolvedValue(100);
      mockPrismaClient.scan.groupBy.mockResolvedValue([
        { aiStatus: 'PENDING', _count: { id: 20 } },
        { aiStatus: 'DOWNLOADED', _count: { id: 15 } },
        { aiStatus: 'PROCESSING', _count: { id: 5 } },
        { aiStatus: 'COMPLETED', _count: { id: 55 } },
        { aiStatus: 'FAILED', _count: { id: 5 } },
      ]);
      mockPrismaClient.scan.aggregate.mockResolvedValue({
        _sum: { aiTotalTokens: 275000 },
        _count: { id: 55 },
      });

      // Act
      const stats = await getQueueStats();

      // Assert
      expect(stats.totalScans).toBe(100);
      expect(stats.byStatus.PENDING).toBe(20);
      expect(stats.byStatus.DOWNLOADED).toBe(15);
      expect(stats.byStatus.PROCESSING).toBe(5);
      expect(stats.byStatus.COMPLETED).toBe(55);
      expect(stats.byStatus.FAILED).toBe(5);
      expect(stats.totalTokensUsed).toBe(275000);
      expect(stats.avgTokensPerScan).toBe(5000); // 275000 / 55
    });

    it('should handle zero completed scans', async () => {
      // Arrange
      mockPrismaClient.scan.count.mockResolvedValue(10);
      mockPrismaClient.scan.groupBy.mockResolvedValue([
        { aiStatus: 'PENDING', _count: { id: 10 } },
      ]);
      mockPrismaClient.scan.aggregate.mockResolvedValue({
        _sum: { aiTotalTokens: null },
        _count: { id: 0 },
      });

      // Act
      const stats = await getQueueStats();

      // Assert
      expect(stats.totalTokensUsed).toBe(0);
      expect(stats.avgTokensPerScan).toBe(0);
    });

    it('should initialize status counts to zero', async () => {
      // Arrange - only some statuses returned
      mockPrismaClient.scan.count.mockResolvedValue(5);
      mockPrismaClient.scan.groupBy.mockResolvedValue([
        { aiStatus: 'PENDING', _count: { id: 5 } },
      ]);
      mockPrismaClient.scan.aggregate.mockResolvedValue({
        _sum: { aiTotalTokens: null },
        _count: { id: 0 },
      });

      // Act
      const stats = await getQueueStats();

      // Assert - all statuses should be present with zeros
      expect(stats.byStatus.PENDING).toBe(5);
      expect(stats.byStatus.DOWNLOADED).toBe(0);
      expect(stats.byStatus.PROCESSING).toBe(0);
      expect(stats.byStatus.COMPLETED).toBe(0);
      expect(stats.byStatus.FAILED).toBe(0);
    });
  });

  // ============================================================================
  // LIST AI SCANS TESTS
  // ============================================================================

  describe('listAiScans', () => {
    const mockScans = [
      {
        id: 'scan-1',
        url: 'https://example1.com',
        email: 'user1@example.com',
        wcagLevel: 'AA',
        aiStatus: 'COMPLETED',
        aiSummary: 'Summary 1',
        aiTotalTokens: 1000,
        aiModel: 'claude-3-opus',
        aiProcessedAt: new Date('2025-01-01T12:00:00.000Z'),
        createdAt: new Date('2025-01-01T10:00:00.000Z'),
      },
      {
        id: 'scan-2',
        url: 'https://example2.com',
        email: 'user2@example.com',
        wcagLevel: 'A',
        aiStatus: 'PENDING',
        aiSummary: null,
        aiTotalTokens: null,
        aiModel: null,
        aiProcessedAt: null,
        createdAt: new Date('2025-01-01T09:00:00.000Z'),
      },
    ];

    it('should return paginated list of AI scans', async () => {
      // Arrange
      mockPrismaClient.scan.findMany.mockResolvedValue(mockScans);
      mockPrismaClient.scan.count.mockResolvedValue(2);

      // Act
      const result = await listAiScans({ limit: 50 });

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.nextCursor).toBeNull();
    });

    it('should filter by status', async () => {
      // Arrange
      mockPrismaClient.scan.findMany.mockResolvedValue([mockScans[0]]);
      mockPrismaClient.scan.count.mockResolvedValue(1);

      // Act
      await listAiScans({ status: ['COMPLETED'] });

      // Assert
      expect(mockPrismaClient.scan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            aiStatus: { in: ['COMPLETED'] },
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      // Arrange
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-01-31');
      mockPrismaClient.scan.findMany.mockResolvedValue(mockScans);
      mockPrismaClient.scan.count.mockResolvedValue(2);

      // Act
      await listAiScans({ dateFrom, dateTo });

      // Assert
      expect(mockPrismaClient.scan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          }),
        })
      );
    });

    it('should support cursor-based pagination', async () => {
      // Arrange - 3 items returned (limit + 1 to check for more)
      mockPrismaClient.scan.findMany.mockResolvedValue([...mockScans, {
        id: 'scan-3',
        url: 'https://example3.com',
        email: 'user3@example.com',
        wcagLevel: 'AAA',
        aiStatus: 'PENDING',
        aiSummary: null,
        aiTotalTokens: null,
        aiModel: null,
        aiProcessedAt: null,
        createdAt: new Date('2025-01-01T08:00:00.000Z'),
      }]);
      mockPrismaClient.scan.count.mockResolvedValue(10);

      // Act
      const result = await listAiScans({ limit: 2 });

      // Assert
      expect(result.items).toHaveLength(2); // Only return limit items
      expect(result.nextCursor).toBe('scan-2'); // Last item's ID
      expect(result.totalCount).toBe(10);
    });

    it('should skip cursor item when paginating', async () => {
      // Arrange
      mockPrismaClient.scan.findMany.mockResolvedValue(mockScans);
      mockPrismaClient.scan.count.mockResolvedValue(2);

      // Act
      await listAiScans({ cursor: 'scan-prev', limit: 50 });

      // Assert
      expect(mockPrismaClient.scan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'scan-prev' },
          skip: 1,
        })
      );
    });
  });

  // ============================================================================
  // UPDATE SCAN WITH AI RESULTS TESTS
  // ============================================================================

  describe('updateScanWithAiResults', () => {
    it('should update scan with all AI fields', async () => {
      // Arrange
      const mockTx = {
        scan: {
          update: vi.fn().mockResolvedValue({}),
        },
      };

      // Act
      await updateScanWithAiResults(mockTx, 'scan-123', {
        aiSummary: 'Test summary',
        aiRemediationPlan: 'Test plan',
        aiInputTokens: 1000,
        aiOutputTokens: 2000,
        aiTotalTokens: 3000,
        aiModel: 'claude-3-opus',
      });

      // Assert
      expect(mockTx.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-123' },
        data: expect.objectContaining({
          aiSummary: 'Test summary',
          aiRemediationPlan: 'Test plan',
          aiInputTokens: 1000,
          aiOutputTokens: 2000,
          aiTotalTokens: 3000,
          aiModel: 'claude-3-opus',
          aiStatus: 'COMPLETED',
          aiProcessedAt: expect.any(Date),
        }),
      });
    });
  });

  // ============================================================================
  // UPDATE ISSUES WITH AI TESTS
  // ============================================================================

  describe('updateIssuesWithAi', () => {
    it('should update multiple issues with AI enhancements', async () => {
      // Arrange
      const mockTx = {
        issue: {
          update: vi.fn().mockResolvedValue({}),
        },
      };

      const aiIssues = [
        {
          issueId: 'issue-1',
          aiExplanation: 'Explanation 1',
          aiFixSuggestion: 'Fix 1',
          aiPriority: 9,
        },
        {
          issueId: 'issue-2',
          aiExplanation: 'Explanation 2',
          aiFixSuggestion: 'Fix 2',
          aiPriority: 7,
        },
      ];

      // Act
      const count = await updateIssuesWithAi(mockTx, 'scan-123', aiIssues);

      // Assert
      expect(count).toBe(2);
      expect(mockTx.issue.update).toHaveBeenCalledTimes(2);
    });

    it('should return 0 for empty issues array', async () => {
      // Arrange
      const mockTx = {
        issue: {
          update: vi.fn(),
        },
      };

      // Act
      const count = await updateIssuesWithAi(mockTx, 'scan-123', []);

      // Assert
      expect(count).toBe(0);
      expect(mockTx.issue.update).not.toHaveBeenCalled();
    });

    it('should continue updating other issues if one fails', async () => {
      // Arrange
      const mockTx = {
        issue: {
          update: vi.fn()
            .mockRejectedValueOnce(new Error('Issue not found'))
            .mockResolvedValueOnce({}),
        },
      };

      const aiIssues = [
        { issueId: 'issue-1', aiExplanation: 'E1', aiFixSuggestion: 'F1', aiPriority: 9 },
        { issueId: 'issue-2', aiExplanation: 'E2', aiFixSuggestion: 'F2', aiPriority: 7 },
      ];

      // Act
      const count = await updateIssuesWithAi(mockTx, 'scan-123', aiIssues);

      // Assert
      expect(count).toBe(1); // Only second issue succeeded
    });
  });
});
