import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, access, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parse } from 'csv-parse/sync';
import { parseInputCsv } from '../src/csv-parser.js';
import { organizeBatches } from '../src/batch-organizer.js';
import { MiniBatchProcessor } from '../src/mini-batch-processor.js';
import { transformToImportFormat } from '../src/result-transformer.js';
import { writeCsv } from '../src/csv-writer.js';
import { CheckpointManager } from '../src/checkpoint-manager.js';
import { LockManager } from '../src/lock-manager.js';
import {
  scanDirectory,
  moveToProcessed,
  moveToFailed,
  ensureSubdirectories,
} from '../src/directory-scanner.js';
import { generateSummary, getJsonSummary } from '../src/summary-generator.js';
import type { Logger } from '../src/logger.js';
import type { ScanResult, Issue } from '../src/types.js';

// Mock only ClaudeInvoker
vi.mock('../src/claude-invoker.js', () => ({
  invokeClaudeCode: vi.fn(),
}));

describe('Integration Test - Single File Processing', () => {
  let testDir: string;
  let outputDir: string;
  let checkpointDir: string;
  let mockLogger: Logger;
  let invokeClaudeCodeMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Create unique temporary directories for each test
    testDir = await mkdtemp(join(tmpdir(), 'integration-test-'));
    outputDir = join(testDir, 'output');
    checkpointDir = join(testDir, 'checkpoint');

    // Create subdirectories
    const { mkdir } = await import('fs/promises');
    await mkdir(outputDir, { recursive: true });
    await mkdir(checkpointDir, { recursive: true });

    // Import mocked module
    const claudeInvoker = await import('../src/claude-invoker.js');
    invokeClaudeCodeMock = vi.mocked(claudeInvoker.invokeClaudeCode);

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

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should process complete end-to-end workflow with 10 URLs', async () => {
    // ======================================
    // Step 1: Parse input CSV with 10 URLs
    // ======================================
    const inputCsvPath = join(__dirname, 'fixtures', 'integration-input.csv');

    const parseResult = await parseInputCsv(inputCsvPath);

    expect(parseResult.scans).toHaveLength(10);
    expect(parseResult.skipped).toHaveLength(0);
    expect(parseResult.totalRows).toBe(10);

    // Verify first and last scan IDs
    expect(parseResult.scans[0].scanId).toBe('scan-int-001');
    expect(parseResult.scans[9].scanId).toBe('scan-int-010');

    // =====================================================
    // Step 2: Organize into batches (batchSize=5, miniBatchSize=2)
    // =====================================================
    const batchSize = 5;
    const miniBatchSize = 2;
    const batches = organizeBatches(parseResult.scans, batchSize, miniBatchSize);

    // With 10 URLs, batchSize=5, we should get 2 batches
    expect(batches).toHaveLength(2);

    // Each batch should have 5 scans
    expect(batches[0].scans).toHaveLength(5);
    expect(batches[1].scans).toHaveLength(5);

    // With miniBatchSize=2, each batch of 5 scans should have 3 mini-batches
    // [2, 2, 1]
    expect(batches[0].miniBatches).toHaveLength(3);
    expect(batches[1].miniBatches).toHaveLength(3);

    expect(batches[0].miniBatches[0].scans).toHaveLength(2);
    expect(batches[0].miniBatches[1].scans).toHaveLength(2);
    expect(batches[0].miniBatches[2].scans).toHaveLength(1);

    // ========================================================
    // Step 3: Mock Claude invoker with realistic responses
    // ========================================================
    // Mock Claude to return realistic scan results for each mini-batch
    invokeClaudeCodeMock.mockImplementation(async (prompt: string) => {
      // Simulate successful Claude invocation
      // Extract scan IDs from prompt (they're mentioned in the prompt)
      const scanIds: string[] = [];
      const matches = prompt.matchAll(/scan-int-\d+/g);
      for (const match of matches) {
        if (!scanIds.includes(match[0])) {
          scanIds.push(match[0]);
        }
      }

      // Create realistic scan results
      const results: ScanResult[] = scanIds.map((scanId) => {
        // Create some sample issues
        const issues: Issue[] = [
          {
            id: `issue-${scanId}-1`,
            ruleId: 'color-contrast',
            wcagCriteria: '1.4.3',
            impact: 'SERIOUS',
            description: 'Elements must have sufficient color contrast',
            helpText: 'Ensure text has a contrast ratio of at least 4.5:1',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.6/color-contrast',
            htmlSnippet: '<button class="btn-primary">Click Here</button>',
            cssSelector: 'button.btn-primary',
            aiExplanation:
              'This button has insufficient contrast between text and background color',
            aiFixSuggestion:
              'Increase the color contrast ratio to meet WCAG AA standards (4.5:1 minimum)',
            aiPriority: 8,
          },
          {
            id: `issue-${scanId}-2`,
            ruleId: 'image-alt',
            wcagCriteria: '1.1.1',
            impact: 'CRITICAL',
            description: 'Images must have alternate text',
            helpText: 'All images must have an alt attribute',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.6/image-alt',
            htmlSnippet: '<img src="logo.png">',
            cssSelector: 'img[src="logo.png"]',
            aiExplanation: 'This image is missing alternative text for screen readers',
            aiFixSuggestion: 'Add descriptive alt text: <img src="logo.png" alt="Company Logo">',
            aiPriority: 10,
          },
          {
            id: `issue-${scanId}-3`,
            ruleId: 'label',
            wcagCriteria: '4.1.2',
            impact: 'MODERATE',
            description: 'Form elements must have labels',
            helpText: 'Every form input should have a corresponding label',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.6/label',
            htmlSnippet: '<input type="text" name="email">',
            cssSelector: 'input[name="email"]',
            aiExplanation: 'This input field lacks a proper label for accessibility',
            aiFixSuggestion:
              'Add a label element: <label for="email">Email Address</label><input type="text" id="email" name="email">',
            aiPriority: 6,
          },
        ];

        return {
          scanId,
          url: `https://example-${scanId}.com`,
          pageTitle: `Test Page ${scanId}`,
          wcagLevel: 'AA',
          summary: `Scan completed for ${scanId}. Found ${issues.length} accessibility issues that need attention. The page has critical issues with image alt text, serious color contrast problems, and moderate form labeling concerns.`,
          remediationPlan: `1. Fix critical image alt text issues immediately\n2. Address color contrast problems in buttons\n3. Add proper labels to all form inputs\n4. Retest after implementing fixes`,
          issues,
          status: 'COMPLETED',
        } as ScanResult;
      });

      // Return as JSON string (Claude output is JSON)
      const output = JSON.stringify(results);

      return {
        success: true,
        output,
        durationMs: 2000,
      };
    });

    // ====================================================
    // Step 4: Process with mocked Claude invoker
    // ====================================================
    const checkpointPath = join(checkpointDir, 'test-checkpoint.json');
    const checkpointManager = new CheckpointManager(checkpointPath);

    // Initialize checkpoint
    const checkpoint = checkpointManager.initCheckpoint('integration-input.csv');
    await checkpointManager.saveCheckpoint(checkpoint);

    const processor = new MiniBatchProcessor(
      mockLogger,
      {
        delay: 0, // No delay in tests
        timeout: 180000,
        retries: 3,
        verbose: false,
      },
      checkpointManager
    );

    // Process all batches
    const miniBatchResults = await processor.processAllBatches(batches);

    // Collect all results
    const allResults = miniBatchResults.flatMap((mbResult) => mbResult.results);
    const allFailedScans = miniBatchResults.flatMap((mbResult) => mbResult.failedScans);

    // Verify all scans were successful
    expect(allResults).toHaveLength(10);
    expect(allFailedScans).toHaveLength(0);

    // Verify scan results have correct structure
    expect(allResults[0]).toHaveProperty('scanId');
    expect(allResults[0]).toHaveProperty('url');
    expect(allResults[0]).toHaveProperty('pageTitle');
    expect(allResults[0]).toHaveProperty('wcagLevel');
    expect(allResults[0]).toHaveProperty('summary');
    expect(allResults[0]).toHaveProperty('remediationPlan');
    expect(allResults[0]).toHaveProperty('issues');
    expect(allResults[0]).toHaveProperty('status');

    // Verify issues exist
    expect(allResults[0].issues).toHaveLength(3);

    // ============================================
    // Step 5: Transform results to import format
    // ============================================
    const importRows = transformToImportFormat(allResults);

    expect(importRows).toHaveLength(10);

    // Verify import row structure
    const firstRow = importRows[0];
    expect(firstRow).toHaveProperty('scan_id');
    expect(firstRow).toHaveProperty('url');
    expect(firstRow).toHaveProperty('page_title');
    expect(firstRow).toHaveProperty('wcag_level');
    expect(firstRow).toHaveProperty('ai_summary');
    expect(firstRow).toHaveProperty('ai_remediation_plan');
    expect(firstRow).toHaveProperty('ai_model');
    expect(firstRow).toHaveProperty('total_issues');
    expect(firstRow).toHaveProperty('critical_count');
    expect(firstRow).toHaveProperty('serious_count');
    expect(firstRow).toHaveProperty('moderate_count');
    expect(firstRow).toHaveProperty('minor_count');
    expect(firstRow).toHaveProperty('issues_with_ai_json');
    expect(firstRow).toHaveProperty('status');
    expect(firstRow).toHaveProperty('error_message');

    // Verify counts
    expect(firstRow.total_issues).toBe(3);
    expect(firstRow.critical_count).toBe(1);
    expect(firstRow.serious_count).toBe(1);
    expect(firstRow.moderate_count).toBe(1);
    expect(firstRow.minor_count).toBe(0);
    expect(firstRow.ai_model).toBe('claude-code-playwright');
    expect(firstRow.status).toBe('COMPLETED');
    expect(firstRow.error_message).toBeNull();

    // Verify issues_with_ai_json is valid JSON
    const parsedIssues = JSON.parse(firstRow.issues_with_ai_json);
    expect(Array.isArray(parsedIssues)).toBe(true);
    expect(parsedIssues).toHaveLength(3);

    // ==============================
    // Step 6: Write output CSV
    // ==============================
    const outputPath = join(outputDir, 'integration-output.csv');
    await writeCsv(outputPath, importRows);

    // Verify file was created
    await expect(access(outputPath)).resolves.toBeUndefined();

    // ===================================================
    // Step 7: Verify output CSV format matches import schema
    // ===================================================
    const csvContent = await readFile(outputPath, 'utf-8');

    // Parse CSV to verify structure
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    expect(records).toHaveLength(10);

    // Verify all required columns are present
    const firstRecord = records[0];
    expect(firstRecord).toHaveProperty('scan_id');
    expect(firstRecord).toHaveProperty('url');
    expect(firstRecord).toHaveProperty('page_title');
    expect(firstRecord).toHaveProperty('wcag_level');
    expect(firstRecord).toHaveProperty('ai_summary');
    expect(firstRecord).toHaveProperty('ai_remediation_plan');
    expect(firstRecord).toHaveProperty('ai_model');
    expect(firstRecord).toHaveProperty('total_issues');
    expect(firstRecord).toHaveProperty('critical_count');
    expect(firstRecord).toHaveProperty('serious_count');
    expect(firstRecord).toHaveProperty('moderate_count');
    expect(firstRecord).toHaveProperty('minor_count');
    expect(firstRecord).toHaveProperty('issues_with_ai_json');
    expect(firstRecord).toHaveProperty('status');
    expect(firstRecord).toHaveProperty('error_message');

    // Verify data types and values
    expect(firstRecord.total_issues).toBe('3');
    expect(firstRecord.critical_count).toBe('1');
    expect(firstRecord.serious_count).toBe('1');
    expect(firstRecord.moderate_count).toBe('1');
    expect(firstRecord.minor_count).toBe('0');
    expect(firstRecord.ai_model).toBe('claude-code-playwright');
    expect(firstRecord.status).toBe('COMPLETED');

    // Verify issues_with_ai_json can be parsed
    const issuesJson = JSON.parse(firstRecord.issues_with_ai_json);
    expect(Array.isArray(issuesJson)).toBe(true);
    expect(issuesJson).toHaveLength(3);

    // Verify issue structure
    const firstIssue = issuesJson[0];
    expect(firstIssue).toHaveProperty('id');
    expect(firstIssue).toHaveProperty('ruleId');
    expect(firstIssue).toHaveProperty('wcagCriteria');
    expect(firstIssue).toHaveProperty('impact');
    expect(firstIssue).toHaveProperty('description');
    expect(firstIssue).toHaveProperty('helpText');
    expect(firstIssue).toHaveProperty('helpUrl');
    expect(firstIssue).toHaveProperty('htmlSnippet');
    expect(firstIssue).toHaveProperty('cssSelector');
    expect(firstIssue).toHaveProperty('aiExplanation');
    expect(firstIssue).toHaveProperty('aiFixSuggestion');
    expect(firstIssue).toHaveProperty('aiPriority');

    // ==================================================
    // Step 8: Verify checkpoint creation during processing
    // ==================================================
    // Checkpoint file should exist during processing
    const checkpointExists = async () => {
      try {
        await access(checkpointPath);
        return true;
      } catch {
        return false;
      }
    };

    // After processing, checkpoint should have been created and flushed
    // (It will be cleaned up manually in the real CLI, but during processing it should exist)
    expect(await checkpointExists()).toBe(true);

    // Load checkpoint and verify
    const loadedCheckpoint = await checkpointManager.loadCheckpoint();
    expect(loadedCheckpoint).not.toBeNull();
    expect(loadedCheckpoint?.processedScanIds).toHaveLength(10);

    // Verify all scan IDs are in checkpoint
    for (let i = 1; i <= 10; i++) {
      const scanId = `scan-int-${String(i).padStart(3, '0')}`;
      expect(loadedCheckpoint?.processedScanIds).toContain(scanId);
    }

    // ==================================================
    // Step 9: Verify checkpoint cleanup after successful completion
    // ==================================================
    // Clear checkpoint (simulates successful completion)
    await checkpointManager.clearCheckpoint();

    // Verify checkpoint file is removed
    expect(await checkpointExists()).toBe(false);

    // ===============================
    // Final Verification
    // ===============================
    // Verify Claude was called correct number of times
    // 2 batches × 3 mini-batches each = 6 total invocations
    expect(invokeClaudeCodeMock).toHaveBeenCalledTimes(6);

    // Verify logger was used
    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockLogger.success).toHaveBeenCalled();
  });

  it('should handle checkpoint resume workflow', async () => {
    // ======================================
    // Simulate interrupted processing scenario
    // ======================================
    const inputCsvPath = join(__dirname, 'fixtures', 'integration-input.csv');

    const parseResult = await parseInputCsv(inputCsvPath);
    const batches = organizeBatches(parseResult.scans, 5, 2);

    const checkpointPath = join(checkpointDir, 'resume-checkpoint.json');
    const checkpointManager = new CheckpointManager(checkpointPath);

    // Initialize checkpoint
    const checkpoint = checkpointManager.initCheckpoint('integration-input.csv');
    await checkpointManager.saveCheckpoint(checkpoint);

    // Simulate processing first 5 scans
    const firstFiveScans = parseResult.scans.slice(0, 5);
    checkpointManager.markProcessed(firstFiveScans.map((s) => s.scanId));
    await checkpointManager.flush();

    // Verify checkpoint has 5 processed scans
    const midCheckpoint = await checkpointManager.loadCheckpoint();
    expect(midCheckpoint?.processedScanIds).toHaveLength(5);

    // =====================================
    // Resume processing (load checkpoint and filter)
    // =====================================
    const resumeManager = new CheckpointManager(checkpointPath);
    const resumeCheckpoint = await resumeManager.loadCheckpoint();

    expect(resumeCheckpoint).not.toBeNull();
    expect(resumeCheckpoint?.processedScanIds).toHaveLength(5);

    // Filter out already processed scans
    const remainingScans = parseResult.scans.filter(
      (scan) => !resumeManager.isProcessed(scan.scanId)
    );

    expect(remainingScans).toHaveLength(5);
    expect(remainingScans[0].scanId).toBe('scan-int-006');
    expect(remainingScans[4].scanId).toBe('scan-int-010');

    // Mock Claude for remaining scans
    invokeClaudeCodeMock.mockImplementation(async (prompt: string) => {
      const scanIds: string[] = [];
      const matches = prompt.matchAll(/scan-int-\d+/g);
      for (const match of matches) {
        if (!scanIds.includes(match[0])) {
          scanIds.push(match[0]);
        }
      }

      const results: ScanResult[] = scanIds.map((scanId) => ({
        scanId,
        url: `https://example-${scanId}.com`,
        pageTitle: `Test Page ${scanId}`,
        wcagLevel: 'AA',
        summary: `Scan completed for ${scanId}`,
        remediationPlan: 'Fix all issues',
        issues: [],
        status: 'COMPLETED',
      })) as ScanResult[];

      return {
        success: true,
        output: JSON.stringify(results),
        durationMs: 2000,
      };
    });

    // Process remaining scans
    const remainingBatches = organizeBatches(remainingScans, 5, 2);
    const processor = new MiniBatchProcessor(
      mockLogger,
      { delay: 0, timeout: 180000, retries: 3, verbose: false },
      resumeManager
    );

    const results = await processor.processAllBatches(remainingBatches);
    const allResults = results.flatMap((r) => r.results);

    expect(allResults).toHaveLength(5);

    // Verify checkpoint now has all 10 scans
    const finalCheckpoint = await resumeManager.loadCheckpoint();
    expect(finalCheckpoint?.processedScanIds).toHaveLength(10);

    // Clean up
    await resumeManager.clearCheckpoint();
  });

  it('should create checkpoint during processing and verify structure', async () => {
    // Test that checkpoint is properly created and maintained during processing
    const inputCsvPath = join(__dirname, 'fixtures', 'integration-input.csv');

    const parseResult = await parseInputCsv(inputCsvPath);
    const batches = organizeBatches(parseResult.scans, 10, 5); // Single batch, 2 mini-batches

    const checkpointPath = join(checkpointDir, 'structure-checkpoint.json');
    const checkpointManager = new CheckpointManager(checkpointPath);

    // Initialize checkpoint
    const checkpoint = checkpointManager.initCheckpoint('integration-input.csv');
    await checkpointManager.saveCheckpoint(checkpoint);

    // Mock Claude
    invokeClaudeCodeMock.mockImplementation(async (prompt: string) => {
      const scanIds: string[] = [];
      const matches = prompt.matchAll(/scan-int-\d+/g);
      for (const match of matches) {
        if (!scanIds.includes(match[0])) {
          scanIds.push(match[0]);
        }
      }

      const results: ScanResult[] = scanIds.map((scanId) => ({
        scanId,
        url: `https://example-${scanId}.com`,
        pageTitle: `Test Page ${scanId}`,
        wcagLevel: 'AA',
        summary: `Summary for ${scanId}`,
        remediationPlan: 'Remediation plan',
        issues: [],
        status: 'COMPLETED',
      })) as ScanResult[];

      return {
        success: true,
        output: JSON.stringify(results),
        durationMs: 1000,
      };
    });

    const processor = new MiniBatchProcessor(
      mockLogger,
      { delay: 0, timeout: 180000, retries: 3, verbose: false },
      checkpointManager
    );

    await processor.processAllBatches(batches);

    // Verify checkpoint file structure
    const checkpointContent = await readFile(checkpointPath, 'utf-8');
    const savedCheckpoint = JSON.parse(checkpointContent);

    expect(savedCheckpoint).toHaveProperty('inputFile');
    expect(savedCheckpoint).toHaveProperty('processedScanIds');
    expect(savedCheckpoint).toHaveProperty('lastBatch');
    expect(savedCheckpoint).toHaveProperty('lastMiniBatch');
    expect(savedCheckpoint).toHaveProperty('startedAt');
    expect(savedCheckpoint).toHaveProperty('updatedAt');

    expect(savedCheckpoint.processedScanIds).toHaveLength(10);
    expect(Array.isArray(savedCheckpoint.processedScanIds)).toBe(true);

    // Verify timestamps are valid ISO strings
    expect(new Date(savedCheckpoint.startedAt).toISOString()).toBe(savedCheckpoint.startedAt);
    expect(new Date(savedCheckpoint.updatedAt).toISOString()).toBe(savedCheckpoint.updatedAt);
  });
});

describe('Integration Test - Directory Mode', () => {
  let testDir: string;
  let mockLogger: Logger;

  beforeEach(async () => {
    // Create unique temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'dir-mode-test-'));

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

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should scan directory with multiple CSV files and sort alphabetically', async () => {
    // ================================================
    // Step 1: Create 3 CSV files with different names
    // ================================================
    const csvContent1 = 'scan_id,url,wcag_level\nscan-001,https://example1.com,AA\n';
    const csvContent2 = 'scan_id,url,wcag_level\nscan-002,https://example2.com,AA\n';
    const csvContent3 = 'scan_id,url,wcag_level\nscan-003,https://example3.com,AA\n';

    // Create files with names that will be sorted: a.csv, b.csv, c.csv
    const file1 = join(testDir, 'batch-2026-01-01.csv');
    const file2 = join(testDir, 'batch-2026-01-02.csv');
    const file3 = join(testDir, 'batch-2026-01-03.csv');

    await writeFile(file1, csvContent1, 'utf-8');
    await writeFile(file2, csvContent2, 'utf-8');
    await writeFile(file3, csvContent3, 'utf-8');

    // =======================================
    // Step 2: Scan directory for CSV files
    // =======================================
    const result = await scanDirectory(testDir);

    // Verify all 3 files were found
    expect(result.totalFound).toBe(3);
    expect(result.files).toHaveLength(3);

    // Verify files are sorted alphabetically
    expect(result.files[0]).toBe(file1);
    expect(result.files[1]).toBe(file2);
    expect(result.files[2]).toBe(file3);
  });

  it('should handle lock file creation and release', async () => {
    // =======================================
    // Step 1: Create lock manager and acquire lock
    // =======================================
    const lockPath = join(testDir, '.ai-scan.lock');
    const lockManager = new LockManager(lockPath);

    // Verify lock file doesn't exist initially
    const initialLockInfo = await lockManager.readLockInfo();
    expect(initialLockInfo).toBeNull();

    // =======================================
    // Step 2: Acquire lock
    // =======================================
    const acquired = await lockManager.acquireLock();
    expect(acquired).toBe(true);

    // Verify lock file exists
    await expect(access(lockPath)).resolves.toBeUndefined();

    // =======================================
    // Step 3: Read lock info and verify structure
    // =======================================
    const lockInfo = await lockManager.readLockInfo();
    expect(lockInfo).not.toBeNull();
    expect(lockInfo?.pid).toBe(process.pid);
    expect(lockInfo?.hostname).toBeTruthy();
    expect(lockInfo?.startedAt).toBeTruthy();

    // Verify timestamp is a valid ISO string
    expect(new Date(lockInfo!.startedAt).toISOString()).toBe(lockInfo!.startedAt);

    // =======================================
    // Step 4: Try to acquire lock again (should fail)
    // =======================================
    const secondAcquire = await lockManager.acquireLock();
    expect(secondAcquire).toBe(false);

    // =======================================
    // Step 5: Release lock
    // =======================================
    await lockManager.releaseLock();

    // Verify lock file is removed
    try {
      await access(lockPath);
      // If we reach here, file still exists - should not happen
      expect.fail('Lock file should have been removed');
    } catch (error) {
      // Expected - file should not exist
      expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
    }

    // Verify lock info is null after release
    const afterRelease = await lockManager.readLockInfo();
    expect(afterRelease).toBeNull();
  });

  it('should move files to processed and failed directories correctly', async () => {
    // =======================================
    // Step 1: Ensure subdirectories exist
    // =======================================
    await ensureSubdirectories(testDir);

    // Verify subdirectories were created
    await expect(access(join(testDir, 'processed'))).resolves.toBeUndefined();
    await expect(access(join(testDir, 'failed'))).resolves.toBeUndefined();

    // =======================================
    // Step 2: Create test files
    // =======================================
    const successFile = join(testDir, 'success.csv');
    const failFile = join(testDir, 'fail.csv');

    await writeFile(successFile, 'test content success', 'utf-8');
    await writeFile(failFile, 'test content fail', 'utf-8');

    // Verify files exist in main directory
    await expect(access(successFile)).resolves.toBeUndefined();
    await expect(access(failFile)).resolves.toBeUndefined();

    // =======================================
    // Step 3: Move successful file to processed/
    // =======================================
    const newSuccessPath = await moveToProcessed(successFile, testDir);

    // Verify file is in processed/ directory
    expect(newSuccessPath).toBe(join(testDir, 'processed', 'success.csv'));
    await expect(access(newSuccessPath)).resolves.toBeUndefined();

    // Verify original file no longer exists
    try {
      await access(successFile);
      expect.fail('Original success file should have been moved');
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
    }

    // =======================================
    // Step 4: Move failed file to failed/
    // =======================================
    const newFailPath = await moveToFailed(failFile, testDir);

    // Verify file is in failed/ directory
    expect(newFailPath).toBe(join(testDir, 'failed', 'fail.csv'));
    await expect(access(newFailPath)).resolves.toBeUndefined();

    // Verify original file no longer exists
    try {
      await access(failFile);
      expect.fail('Original fail file should have been moved');
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
    }

    // =======================================
    // Step 5: Verify files in input directory are gone
    // =======================================
    const result = await scanDirectory(testDir);
    expect(result.files).toHaveLength(0);
    expect(result.totalFound).toBe(0);
  });

  it('should generate JSON summary with correct structure and counts', async () => {
    // =======================================
    // Step 1: Create summary statistics
    // =======================================
    const startTime = new Date('2026-01-03T10:00:00.000Z');
    const endTime = new Date('2026-01-03T10:05:30.500Z');

    const stats = {
      startTime,
      endTime,
      filesProcessed: 3,
      totalUrls: 15,
      successful: 12,
      failed: 2,
      skipped: 1,
      outputFiles: [
        '/path/to/output/batch-001.csv',
        '/path/to/output/batch-002.csv',
        '/path/to/output/batch-003.csv',
      ],
      failedFiles: ['/path/to/failed/batch-002.csv'],
      errors: ['Connection timeout on scan-005', 'Invalid response for scan-008'],
    };

    // =======================================
    // Step 2: Generate summary
    // =======================================
    const summary = generateSummary(stats);

    // Verify summary structure
    expect(summary).toHaveProperty('status');
    expect(summary).toHaveProperty('files_processed');
    expect(summary).toHaveProperty('total_urls');
    expect(summary).toHaveProperty('successful');
    expect(summary).toHaveProperty('failed');
    expect(summary).toHaveProperty('skipped');
    expect(summary).toHaveProperty('duration_seconds');
    expect(summary).toHaveProperty('output_files');
    expect(summary).toHaveProperty('failed_files');
    expect(summary).toHaveProperty('errors');

    // Verify counts
    expect(summary.status).toBe('partial_failure'); // Has both successes and failures
    expect(summary.files_processed).toBe(3);
    expect(summary.total_urls).toBe(15);
    expect(summary.successful).toBe(12);
    expect(summary.failed).toBe(2);
    expect(summary.skipped).toBe(1);

    // Verify duration calculation (5 minutes 30.5 seconds = 330.5 seconds)
    expect(summary.duration_seconds).toBe(330.5);

    // Verify arrays
    expect(summary.output_files).toHaveLength(3);
    expect(summary.failed_files).toHaveLength(1);
    expect(summary.errors).toHaveLength(2);

    // =======================================
    // Step 3: Generate JSON string
    // =======================================
    const jsonString = getJsonSummary(summary);

    // Verify JSON is valid
    const parsed = JSON.parse(jsonString);
    expect(parsed.status).toBe('partial_failure');
    expect(parsed.files_processed).toBe(3);
    expect(parsed.duration_seconds).toBe(330.5);

    // Verify JSON is formatted (contains newlines and indentation)
    expect(jsonString).toContain('\n');
    expect(jsonString).toContain('  '); // 2-space indentation
  });

  it('should handle complete success status in summary', async () => {
    const startTime = new Date('2026-01-03T10:00:00.000Z');
    const endTime = new Date('2026-01-03T10:01:00.000Z');

    const stats = {
      startTime,
      endTime,
      filesProcessed: 2,
      totalUrls: 10,
      successful: 10,
      failed: 0,
      skipped: 0,
      outputFiles: ['/path/to/output/batch-001.csv', '/path/to/output/batch-002.csv'],
      failedFiles: [],
      errors: [],
    };

    const summary = generateSummary(stats);

    // Verify status is 'completed' when no failures
    expect(summary.status).toBe('completed');
    expect(summary.successful).toBe(10);
    expect(summary.failed).toBe(0);
    expect(summary.duration_seconds).toBe(60); // 1 minute
  });

  it('should handle complete failure status in summary', async () => {
    const startTime = new Date('2026-01-03T10:00:00.000Z');
    const endTime = new Date('2026-01-03T10:00:15.000Z');

    const stats = {
      startTime,
      endTime,
      filesProcessed: 1,
      totalUrls: 5,
      successful: 0,
      failed: 5,
      skipped: 0,
      outputFiles: [],
      failedFiles: ['/path/to/failed/batch-001.csv'],
      errors: [
        'Network error',
        'Timeout',
        'Invalid URL',
        'Connection refused',
        'DNS lookup failed',
      ],
    };

    const summary = generateSummary(stats);

    // Verify status is 'complete_failure' when all failed
    expect(summary.status).toBe('complete_failure');
    expect(summary.successful).toBe(0);
    expect(summary.failed).toBe(5);
    expect(summary.duration_seconds).toBe(15); // 15 seconds
    expect(summary.errors).toHaveLength(5);
  });
});
