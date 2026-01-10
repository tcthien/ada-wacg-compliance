import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MiniBatchProcessor } from '../src/mini-batch-processor.js';
import type { MiniBatch } from '../src/batch-organizer.js';
import type { PendingScan, ScanResult } from '../src/types.js';
import { ErrorType } from '../src/types.js';
import type { Logger } from '../src/logger.js';
import type { CheckpointManager } from '../src/checkpoint-manager.js';

// Mock dependencies
vi.mock('../src/prompt-generator.js', () => ({
  generatePrompt: vi.fn(),
}));

vi.mock('../src/claude-invoker.js', () => ({
  invokeClaudeCode: vi.fn(),
}));

vi.mock('../src/result-parser.js', () => ({
  parseClaudeOutput: vi.fn(),
}));

describe('MiniBatchProcessor', () => {
  let mockLogger: Logger;
  let mockCheckpointManager: CheckpointManager;
  let generatePromptMock: ReturnType<typeof vi.fn>;
  let invokeClaudeCodeMock: ReturnType<typeof vi.fn>;
  let parseClaudeOutputMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Import mocked modules to get references
    const promptGenerator = await import('../src/prompt-generator.js');
    const claudeInvoker = await import('../src/claude-invoker.js');
    const resultParser = await import('../src/result-parser.js');

    generatePromptMock = vi.mocked(promptGenerator.generatePrompt);
    invokeClaudeCodeMock = vi.mocked(claudeInvoker.invokeClaudeCode);
    parseClaudeOutputMock = vi.mocked(resultParser.parseClaudeOutput);

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      progress: vi.fn(),
      raw: vi.fn(),
      newLine: vi.fn(),
    } as unknown as Logger;

    // Create mock checkpoint manager
    mockCheckpointManager = {
      markProcessed: vi.fn(),
      flush: vi.fn(),
      isProcessed: vi.fn(),
      saveCheckpoint: vi.fn(),
      loadCheckpoint: vi.fn(),
      clearCheckpoint: vi.fn(),
      initCheckpoint: vi.fn(),
    } as unknown as CheckpointManager;
  });

  describe('Test 1: Process 5-URL mini-batch returns 5 ScanResults', () => {
    it('should successfully process a mini-batch with 5 URLs and return 5 ScanResults', async () => {
      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example1.com', wcagLevel: 'AA' },
        { scanId: 'scan-002', url: 'https://example2.com', wcagLevel: 'AA' },
        { scanId: 'scan-003', url: 'https://example3.com', wcagLevel: 'AA' },
        { scanId: 'scan-004', url: 'https://example4.com', wcagLevel: 'AA' },
        { scanId: 'scan-005', url: 'https://example5.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      const mockPrompt = 'Mock prompt for scans';
      const mockClaudeOutput = 'Mock Claude output';
      const mockScanResults: ScanResult[] = scans.map((scan) => ({
        scanId: scan.scanId,
        url: scan.url,
        pageTitle: `Page ${scan.scanId}`,
        wcagLevel: 'AA',
        summary: `Summary for ${scan.scanId}`,
        remediationPlan: `Remediation for ${scan.scanId}`,
        issues: [],
        status: 'COMPLETED' as const,
      }));

      generatePromptMock.mockResolvedValue(mockPrompt);
      invokeClaudeCodeMock.mockResolvedValue({
        success: true,
        output: mockClaudeOutput,
        durationMs: 1000,
      });
      parseClaudeOutputMock.mockReturnValue(mockScanResults);

      const processor = new MiniBatchProcessor(mockLogger);

      // Act
      const result = await processor.processMiniBatch(miniBatch, 1);

      // Assert
      expect(result.results).toHaveLength(5);
      expect(result.failedScans).toHaveLength(0);
      expect(result.miniBatchNumber).toBe(1);
      expect(result.retryCount).toBe(0);
      expect(result.results).toEqual(mockScanResults);

      // Verify all mocks were called correctly
      expect(generatePromptMock).toHaveBeenCalledOnce();
      expect(invokeClaudeCodeMock).toHaveBeenCalledOnce();
      expect(parseClaudeOutputMock).toHaveBeenCalledWith(mockClaudeOutput);
      expect(mockLogger.success).toHaveBeenCalled();
    });
  });

  describe('Test 2: Claude invocation fails - retries 3 times with backoff', () => {
    it('should retry 3 times with exponential backoff when Claude invocation fails', async () => {
      // Use fake timers for testing delays
      vi.useFakeTimers();

      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      generatePromptMock.mockResolvedValue('Mock prompt');

      // Mock Claude invocation to fail all attempts
      invokeClaudeCodeMock.mockResolvedValue({
        success: false,
        error: 'Connection timeout',
        errorType: ErrorType.TIMEOUT,
        durationMs: 1000,
      });

      const processor = new MiniBatchProcessor(mockLogger, { retries: 3 });

      // Act
      const processPromise = processor.processMiniBatch(miniBatch, 1);

      // Fast-forward through all retry delays
      // First retry: 5000ms (5s)
      await vi.advanceTimersByTimeAsync(5000);
      // Second retry: 10000ms (10s)
      await vi.advanceTimersByTimeAsync(10000);
      // Third retry: 20000ms (20s)
      await vi.advanceTimersByTimeAsync(20000);

      const result = await processPromise;

      // Assert
      expect(result.results).toHaveLength(0);
      expect(result.failedScans).toHaveLength(1);
      expect(result.failedScans[0]).toEqual({
        scanId: 'scan-001',
        url: 'https://example.com',
        errorType: ErrorType.TIMEOUT,
        errorMessage: 'Connection timeout',
      });
      expect(result.retryCount).toBe(3);

      // Verify invocation was called 4 times (initial + 3 retries)
      expect(invokeClaudeCodeMock).toHaveBeenCalledTimes(4);

      // Verify warning logs for retries
      expect(mockLogger.warning).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  describe('Test 3: All retries fail - returns FailedScan entries', () => {
    it('should return FailedScan entries for all scans when all retries are exhausted', async () => {
      vi.useFakeTimers();

      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example1.com', wcagLevel: 'AA' },
        { scanId: 'scan-002', url: 'https://example2.com', wcagLevel: 'AA' },
        { scanId: 'scan-003', url: 'https://example3.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      generatePromptMock.mockResolvedValue('Mock prompt');
      invokeClaudeCodeMock.mockResolvedValue({
        success: false,
        error: 'Process crashed',
        errorType: ErrorType.PROCESS_CRASH,
        durationMs: 1000,
      });

      const processor = new MiniBatchProcessor(mockLogger, { retries: 3 });

      // Act
      const processPromise = processor.processMiniBatch(miniBatch, 1);

      // Fast-forward through all retries
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(10000);
      await vi.advanceTimersByTimeAsync(20000);

      const result = await processPromise;

      // Assert
      expect(result.results).toHaveLength(0);
      expect(result.failedScans).toHaveLength(3);

      // Verify all scans are in failed state
      expect(result.failedScans).toEqual([
        {
          scanId: 'scan-001',
          url: 'https://example1.com',
          errorType: ErrorType.PROCESS_CRASH,
          errorMessage: 'Process crashed',
        },
        {
          scanId: 'scan-002',
          url: 'https://example2.com',
          errorType: ErrorType.PROCESS_CRASH,
          errorMessage: 'Process crashed',
        },
        {
          scanId: 'scan-003',
          url: 'https://example3.com',
          errorType: ErrorType.PROCESS_CRASH,
          errorMessage: 'Process crashed',
        },
      ]);

      expect(mockLogger.error).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Test 4: Delay between batches - waits specified seconds', () => {
    it('should wait the specified delay between mini-batches in processBatch', async () => {
      vi.useFakeTimers();

      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example1.com', wcagLevel: 'AA' },
        { scanId: 'scan-002', url: 'https://example2.com', wcagLevel: 'AA' },
      ];

      const batch = {
        batchNumber: 1,
        scans,
        miniBatches: [
          { miniBatchNumber: 1, scans: [scans[0]] },
          { miniBatchNumber: 2, scans: [scans[1]] },
        ],
      };

      generatePromptMock.mockResolvedValue('Mock prompt');
      invokeClaudeCodeMock.mockResolvedValue({
        success: true,
        output: 'Mock output',
        durationMs: 1000,
      });
      parseClaudeOutputMock.mockImplementation((output) => [
        {
          scanId: 'scan-001',
          url: 'https://example1.com',
          pageTitle: 'Page 1',
          wcagLevel: 'AA',
          summary: 'Summary',
          remediationPlan: 'Plan',
          issues: [],
          status: 'COMPLETED' as const,
        },
      ]);

      const delaySeconds = 10;
      const processor = new MiniBatchProcessor(mockLogger, { delay: delaySeconds });

      // Act
      const processPromise = processor.processBatch(batch);

      // Wait for first mini-batch to complete
      await vi.runAllTimersAsync();

      // Advance by delay time (10 seconds = 10000ms)
      await vi.advanceTimersByTimeAsync(delaySeconds * 1000);

      const result = await processPromise;

      // Assert
      expect(result).toHaveLength(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Waiting ${delaySeconds}s before next mini-batch`)
      );

      vi.useRealTimers();
    });
  });

  describe('Test 5: Verbose mode - logs prompt via logger.debug()', () => {
    it('should log the generated prompt when verbose mode is enabled', async () => {
      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      const mockPrompt = 'This is the generated prompt for testing';
      generatePromptMock.mockResolvedValue(mockPrompt);
      invokeClaudeCodeMock.mockResolvedValue({
        success: true,
        output: 'Mock output',
        durationMs: 1000,
      });
      parseClaudeOutputMock.mockReturnValue([
        {
          scanId: 'scan-001',
          url: 'https://example.com',
          pageTitle: 'Test Page',
          wcagLevel: 'AA',
          summary: 'Summary',
          remediationPlan: 'Plan',
          issues: [],
          status: 'COMPLETED' as const,
        },
      ]);

      const processor = new MiniBatchProcessor(mockLogger, { verbose: true });

      // Act
      await processor.processMiniBatch(miniBatch, 1);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(mockPrompt)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Generated prompt:\n${mockPrompt}`
      );
    });

    it('should NOT log prompt when verbose mode is disabled', async () => {
      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      generatePromptMock.mockResolvedValue('Mock prompt');
      invokeClaudeCodeMock.mockResolvedValue({
        success: true,
        output: 'Mock output',
        durationMs: 1000,
      });
      parseClaudeOutputMock.mockReturnValue([
        {
          scanId: 'scan-001',
          url: 'https://example.com',
          pageTitle: 'Test Page',
          wcagLevel: 'AA',
          summary: 'Summary',
          remediationPlan: 'Plan',
          issues: [],
          status: 'COMPLETED' as const,
        },
      ]);

      const processor = new MiniBatchProcessor(mockLogger, { verbose: false });

      // Act
      await processor.processMiniBatch(miniBatch, 1);

      // Assert
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('Test 6: Rate limit error - uses 60s base delay for retry', () => {
    it('should use 60s base delay with exponential backoff for rate limit errors', async () => {
      vi.useFakeTimers();

      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      generatePromptMock.mockResolvedValue('Mock prompt');

      // First two calls: rate limit error
      // Third call: success
      invokeClaudeCodeMock
        .mockResolvedValueOnce({
          success: false,
          error: 'Rate limit exceeded',
          errorType: ErrorType.RATE_LIMIT,
          durationMs: 1000,
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Rate limit exceeded',
          errorType: ErrorType.RATE_LIMIT,
          durationMs: 1000,
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Success output',
          durationMs: 1000,
        });

      parseClaudeOutputMock.mockReturnValue([
        {
          scanId: 'scan-001',
          url: 'https://example.com',
          pageTitle: 'Test Page',
          wcagLevel: 'AA',
          summary: 'Summary',
          remediationPlan: 'Plan',
          issues: [],
          status: 'COMPLETED' as const,
        },
      ]);

      const processor = new MiniBatchProcessor(mockLogger, { retries: 3 });

      // Act
      const processPromise = processor.processMiniBatch(miniBatch, 1);

      // First retry: 60s delay (60000ms)
      await vi.advanceTimersByTimeAsync(60000);

      // Second retry: 120s delay (120000ms)
      await vi.advanceTimersByTimeAsync(120000);

      const result = await processPromise;

      // Assert
      expect(result.results).toHaveLength(1);
      expect(result.failedScans).toHaveLength(0);
      expect(result.retryCount).toBe(2);

      // Verify rate limit warning messages
      expect(mockLogger.warning).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit hit')
      );
      expect(mockLogger.warning).toHaveBeenCalledWith(
        expect.stringContaining('Waiting 60s before retry')
      );
      expect(mockLogger.warning).toHaveBeenCalledWith(
        expect.stringContaining('Waiting 120s before retry')
      );

      vi.useRealTimers();
    });
  });

  describe('Test 7: Checkpoint updated - markProcessed called with scan IDs', () => {
    it('should call checkpoint.markProcessed with successful scan IDs and flush', async () => {
      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example1.com', wcagLevel: 'AA' },
        { scanId: 'scan-002', url: 'https://example2.com', wcagLevel: 'AA' },
        { scanId: 'scan-003', url: 'https://example3.com', wcagLevel: 'AA' },
      ];

      const batch = {
        batchNumber: 1,
        scans,
        miniBatches: [
          { miniBatchNumber: 1, scans },
        ],
      };

      const mockScanResults: ScanResult[] = scans.map((scan) => ({
        scanId: scan.scanId,
        url: scan.url,
        pageTitle: `Page ${scan.scanId}`,
        wcagLevel: 'AA',
        summary: 'Summary',
        remediationPlan: 'Plan',
        issues: [],
        status: 'COMPLETED' as const,
      }));

      generatePromptMock.mockResolvedValue('Mock prompt');
      invokeClaudeCodeMock.mockResolvedValue({
        success: true,
        output: 'Mock output',
        durationMs: 1000,
      });
      parseClaudeOutputMock.mockReturnValue(mockScanResults);

      const processor = new MiniBatchProcessor(
        mockLogger,
        {},
        mockCheckpointManager
      );

      // Act
      await processor.processBatch(batch);

      // Assert
      expect(mockCheckpointManager.markProcessed).toHaveBeenCalledWith([
        'scan-001',
        'scan-002',
        'scan-003',
      ]);
      expect(mockCheckpointManager.flush).toHaveBeenCalled();
    });

    it('should NOT call checkpoint.markProcessed when no results are successful', async () => {
      vi.useFakeTimers();

      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example.com', wcagLevel: 'AA' },
      ];

      const batch = {
        batchNumber: 1,
        scans,
        miniBatches: [
          { miniBatchNumber: 1, scans },
        ],
      };

      generatePromptMock.mockResolvedValue('Mock prompt');
      invokeClaudeCodeMock.mockResolvedValue({
        success: false,
        error: 'Failed',
        errorType: ErrorType.UNKNOWN,
        durationMs: 1000,
      });

      const processor = new MiniBatchProcessor(
        mockLogger,
        { retries: 1 },
        mockCheckpointManager
      );

      // Act
      const processPromise = processor.processBatch(batch);
      await vi.advanceTimersByTimeAsync(5000);
      await processPromise;

      // Assert
      expect(mockCheckpointManager.markProcessed).not.toHaveBeenCalled();
      expect(mockCheckpointManager.flush).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should work without checkpoint manager when not provided', async () => {
      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      generatePromptMock.mockResolvedValue('Mock prompt');
      invokeClaudeCodeMock.mockResolvedValue({
        success: true,
        output: 'Mock output',
        durationMs: 1000,
      });
      parseClaudeOutputMock.mockReturnValue([
        {
          scanId: 'scan-001',
          url: 'https://example.com',
          pageTitle: 'Test Page',
          wcagLevel: 'AA',
          summary: 'Summary',
          remediationPlan: 'Plan',
          issues: [],
          status: 'COMPLETED' as const,
        },
      ]);

      // Create processor WITHOUT checkpoint manager
      const processor = new MiniBatchProcessor(mockLogger);

      // Act & Assert - should not throw
      await expect(
        processor.processMiniBatch(miniBatch, 1)
      ).resolves.toBeDefined();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle partial results where some scans are missing from Claude output', async () => {
      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example1.com', wcagLevel: 'AA' },
        { scanId: 'scan-002', url: 'https://example2.com', wcagLevel: 'AA' },
        { scanId: 'scan-003', url: 'https://example3.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      // Claude only returns results for 2 out of 3 scans
      const partialResults: ScanResult[] = [
        {
          scanId: 'scan-001',
          url: 'https://example1.com',
          pageTitle: 'Page 1',
          wcagLevel: 'AA',
          summary: 'Summary',
          remediationPlan: 'Plan',
          issues: [],
          status: 'COMPLETED' as const,
        },
        {
          scanId: 'scan-003',
          url: 'https://example3.com',
          pageTitle: 'Page 3',
          wcagLevel: 'AA',
          summary: 'Summary',
          remediationPlan: 'Plan',
          issues: [],
          status: 'COMPLETED' as const,
        },
      ];

      generatePromptMock.mockResolvedValue('Mock prompt');
      invokeClaudeCodeMock.mockResolvedValue({
        success: true,
        output: 'Partial output',
        durationMs: 1000,
      });
      parseClaudeOutputMock.mockReturnValue(partialResults);

      const processor = new MiniBatchProcessor(mockLogger);

      // Act
      const result = await processor.processMiniBatch(miniBatch, 1);

      // Assert
      expect(result.results).toHaveLength(2);
      expect(result.failedScans).toHaveLength(1);
      expect(result.failedScans[0]).toEqual({
        scanId: 'scan-002',
        url: 'https://example2.com',
        errorType: ErrorType.INVALID_OUTPUT,
        errorMessage: 'Scan result not found in Claude output',
      });
    });

    it('should handle unexpected exceptions during processing', async () => {
      vi.useFakeTimers();

      // Arrange
      const scans: PendingScan[] = [
        { scanId: 'scan-001', url: 'https://example.com', wcagLevel: 'AA' },
      ];

      const miniBatch: MiniBatch = {
        miniBatchNumber: 1,
        scans,
      };

      generatePromptMock.mockRejectedValue(new Error('Unexpected error'));

      const processor = new MiniBatchProcessor(mockLogger, { retries: 2 });

      // Act
      const processPromise = processor.processMiniBatch(miniBatch, 1);

      // Fast-forward through retries
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(10000);

      const result = await processPromise;

      // Assert
      expect(result.results).toHaveLength(0);
      expect(result.failedScans).toHaveLength(1);
      expect(result.failedScans[0]).toEqual({
        scanId: 'scan-001',
        url: 'https://example.com',
        errorType: ErrorType.UNKNOWN,
        errorMessage: 'Unexpected error',
      });

      vi.useRealTimers();
    });
  });
});
