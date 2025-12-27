import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Job } from 'bullmq';
import {
  processScanPageJob,
  type ScanPageJobData,
} from './scan-page.job.js';
import { ScanStage } from '../utils/progress-tracker.js';

/**
 * Test Suite for Scan Page Job Processor
 *
 * Tests the complete scanning workflow including:
 * - Successful scan flow
 * - Progress tracking
 * - Database operations
 * - Error handling and retries
 * - Email notification logic
 */

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock Prisma client
const mockPrismaUpdate = vi.fn();
const mockPrismaCreate = vi.fn();

vi.mock('../config/prisma.js', () => ({
  default: vi.fn(() => ({
    scan: {
      update: mockPrismaUpdate,
    },
    scanResult: {
      create: mockPrismaCreate,
    },
  })),
}));

// Mock scanner
const mockScanPage = vi.fn();

vi.mock('../processors/scanner/index.js', () => ({
  scanPage: (...args: unknown[]) => mockScanPage(...args),
  getIssueSummary: vi.fn((issues: unknown[]) => ({
    total: issues.length,
    critical: issues.filter((i: any) => i.impact === 'CRITICAL').length,
    serious: issues.filter((i: any) => i.impact === 'SERIOUS').length,
    moderate: issues.filter((i: any) => i.impact === 'MODERATE').length,
    minor: issues.filter((i: any) => i.impact === 'MINOR').length,
  })),
}));

// Mock progress tracker
const mockUpdateScanProgress = vi.fn();
const mockCalculateEstimatedTimeRemaining = vi.fn((stage: ScanStage) => {
  const estimates: Record<ScanStage, number> = {
    [ScanStage.QUEUED]: 0,
    [ScanStage.STARTING]: 23000,
    [ScanStage.NAVIGATING]: 21000,
    [ScanStage.ANALYZING]: 13000,
    [ScanStage.PROCESSING]: 1000,
    [ScanStage.COMPLETED]: 0,
    [ScanStage.FAILED]: 0,
  };
  return estimates[stage];
});

vi.mock('../utils/progress-tracker.js', async () => {
  const actual = await vi.importActual('../utils/progress-tracker.js');
  return {
    ...actual,
    updateScanProgress: (...args: unknown[]) =>
      mockUpdateScanProgress(...args),
    calculateEstimatedTimeRemaining: (...args: unknown[]) =>
      mockCalculateEstimatedTimeRemaining(...args),
  };
});

// ============================================================================
// Test Data
// ============================================================================

const mockJobData: ScanPageJobData = {
  scanId: 'scan-123',
  url: 'https://example.com',
  wcagLevel: 'AA',
  email: 'user@example.com',
  sessionId: 'session-123',
};

const mockScanResult = {
  url: 'https://example.com',
  finalUrl: 'https://example.com',
  title: 'Example Site',
  scanDuration: 5000,
  issues: [
    {
      id: 'issue-1',
      ruleId: 'color-contrast',
      impact: 'SERIOUS',
      description: 'Elements must have sufficient color contrast',
      helpText: 'Ensure color contrast meets WCAG standards',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
      wcagCriteria: ['1.4.3'],
      cssSelector: '.btn',
      htmlSnippet: '<button class="btn">Click me</button>',
      nodes: [
        {
          html: '<button class="btn">Click me</button>',
          target: ['.btn'],
          failureSummary: 'Fix color contrast',
        },
      ],
    },
    {
      id: 'issue-2',
      ruleId: 'image-alt',
      impact: 'CRITICAL',
      description: 'Images must have alternate text',
      helpText: 'Ensure all images have alt attributes',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/image-alt',
      wcagCriteria: ['1.1.1'],
      cssSelector: 'img',
      htmlSnippet: '<img src="logo.png">',
      nodes: [
        {
          html: '<img src="logo.png">',
          target: ['img'],
          failureSummary: 'Add alt text',
        },
      ],
    },
  ],
  passes: 15,
  inapplicable: 8,
  timestamp: new Date(),
};

// ============================================================================
// Tests
// ============================================================================

describe('processScanPageJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScanPage.mockResolvedValue(mockScanResult);
    mockPrismaUpdate.mockResolvedValue({});
    mockPrismaCreate.mockResolvedValue({});
    mockUpdateScanProgress.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete scan successfully with all stages', async () => {
    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    const result = await processScanPageJob(mockJob);

    // Verify result
    expect(result.scanId).toBe('scan-123');
    expect(result.issueCount).toBe(2);
    expect(result.status).toBe('COMPLETED');
    expect(result.duration).toBeGreaterThanOrEqual(0);

    // Verify progress updates (all stages)
    expect(mockUpdateScanProgress).toHaveBeenCalledWith(
      'scan-123',
      ScanStage.STARTING,
      { message: 'Initializing scan...' }
    );

    expect(mockUpdateScanProgress).toHaveBeenCalledWith(
      'scan-123',
      ScanStage.NAVIGATING,
      expect.objectContaining({
        message: 'Navigating to page...',
        estimatedTimeRemaining: expect.any(Number),
      })
    );

    expect(mockUpdateScanProgress).toHaveBeenCalledWith(
      'scan-123',
      ScanStage.ANALYZING,
      expect.objectContaining({
        message: 'Running accessibility analysis...',
        estimatedTimeRemaining: expect.any(Number),
      })
    );

    expect(mockUpdateScanProgress).toHaveBeenCalledWith(
      'scan-123',
      ScanStage.PROCESSING,
      expect.objectContaining({
        message: 'Processing results...',
        estimatedTimeRemaining: expect.any(Number),
      })
    );

    expect(mockUpdateScanProgress).toHaveBeenCalledWith(
      'scan-123',
      ScanStage.COMPLETED,
      expect.objectContaining({
        message: expect.stringContaining('Scan completed'),
      })
    );
  });

  it('should update scan status to RUNNING at start', async () => {
    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    await processScanPageJob(mockJob);

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'scan-123' },
      data: { status: 'RUNNING' },
    });
  });

  it('should call scanPage with correct parameters', async () => {
    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    await processScanPageJob(mockJob);

    expect(mockScanPage).toHaveBeenCalledWith({
      url: 'https://example.com',
      wcagLevel: 'AA',
    });
  });

  it('should save scan results to database with correct data', async () => {
    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    await processScanPageJob(mockJob);

    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: {
        scanId: 'scan-123',
        totalIssues: 2,
        criticalCount: 1,
        seriousCount: 1,
        moderateCount: 0,
        minorCount: 0,
        passedChecks: 15,
        inapplicableChecks: 8,
        issues: {
          create: expect.arrayContaining([
            expect.objectContaining({
              id: 'issue-1',
              ruleId: 'color-contrast',
              impact: 'SERIOUS',
            }),
            expect.objectContaining({
              id: 'issue-2',
              ruleId: 'image-alt',
              impact: 'CRITICAL',
            }),
          ]),
        },
      },
    });
  });

  it('should update scan status to COMPLETED with duration', async () => {
    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    await processScanPageJob(mockJob);

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'scan-123' },
      data: {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        durationMs: expect.any(Number),
      },
    });
  });

  it('should NOT queue email for scans under 30 seconds', async () => {
    // Mock fast scan (under 30s)
    const fastScanResult = { ...mockScanResult, scanDuration: 5000 };
    mockScanPage.mockResolvedValue(fastScanResult);

    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;
    const consoleSpy = vi.spyOn(console, 'log');

    await processScanPageJob(mockJob);

    // Should NOT queue email notification
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('scan_complete')
    );

    consoleSpy.mockRestore();
  });

  it('should queue email for scans over 30 seconds', async () => {
    // Mock slow scan (over 30s) by delaying
    // We need to delay the actual processing, not just the scan
    const originalDateNow = Date.now;
    let startTime = 0;

    // Override Date.now to simulate passage of time
    vi.spyOn(Date, 'now').mockImplementation(() => {
      if (startTime === 0) {
        startTime = originalDateNow();
        return startTime;
      }
      // Return a time 31 seconds later
      return startTime + 31000;
    });

    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;
    const consoleSpy = vi.spyOn(console, 'log');

    await processScanPageJob(mockJob);

    // Should queue email notification
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('scan_complete')
    );

    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should NOT queue email if no email provided', async () => {
    const mockJob = {
      data: { ...mockJobData, email: undefined },
    } as Job<ScanPageJobData>;
    const consoleSpy = vi.spyOn(console, 'log');

    await processScanPageJob(mockJob);

    // Should NOT queue email notification
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Would queue')
    );

    consoleSpy.mockRestore();
  });

  it('should handle scan errors and update status to FAILED', async () => {
    const scanError = new Error('Navigation timeout');
    mockScanPage.mockRejectedValue(scanError);

    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    await expect(processScanPageJob(mockJob)).rejects.toThrow(
      'Navigation timeout'
    );

    // Verify progress updated to FAILED
    expect(mockUpdateScanProgress).toHaveBeenCalledWith(
      'scan-123',
      ScanStage.FAILED,
      expect.objectContaining({
        message: 'Scan failed',
        error: 'Navigation timeout',
      })
    );

    // Verify scan status updated to FAILED
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'scan-123' },
      data: {
        status: 'FAILED',
        errorMessage: 'Navigation timeout',
        completedAt: expect.any(Date),
        durationMs: expect.any(Number),
      },
    });
  });

  it('should queue failure email on error if email provided', async () => {
    const scanError = new Error('Network error');
    mockScanPage.mockRejectedValue(scanError);

    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;
    const consoleSpy = vi.spyOn(console, 'log');

    await expect(processScanPageJob(mockJob)).rejects.toThrow('Network error');

    // Should queue failure email notification
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('scan_failed')
    );

    consoleSpy.mockRestore();
  });

  it('should handle unknown errors gracefully', async () => {
    // Mock non-Error rejection
    mockScanPage.mockRejectedValue('Unknown error string');

    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    await expect(processScanPageJob(mockJob)).rejects.toBe(
      'Unknown error string'
    );

    // Verify error message defaults to 'Unknown error'
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'scan-123' },
      data: expect.objectContaining({
        errorMessage: 'Unknown error',
      }),
    });
  });

  it('should calculate estimated time remaining for each stage', async () => {
    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    await processScanPageJob(mockJob);

    // Verify calculateEstimatedTimeRemaining called for each stage
    expect(mockCalculateEstimatedTimeRemaining).toHaveBeenCalledWith(
      ScanStage.NAVIGATING
    );
    expect(mockCalculateEstimatedTimeRemaining).toHaveBeenCalledWith(
      ScanStage.ANALYZING
    );
    expect(mockCalculateEstimatedTimeRemaining).toHaveBeenCalledWith(
      ScanStage.PROCESSING
    );
  });

  it('should handle scans with zero issues', async () => {
    const emptyResult = {
      ...mockScanResult,
      issues: [],
    };
    mockScanPage.mockResolvedValue(emptyResult);

    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    const result = await processScanPageJob(mockJob);

    expect(result.issueCount).toBe(0);
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        totalIssues: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
      }),
    });
  });

  it('should handle scans with different WCAG levels', async () => {
    const mockJobAAA = {
      data: { ...mockJobData, wcagLevel: 'AAA' as const },
    } as Job<ScanPageJobData>;

    await processScanPageJob(mockJobAAA);

    expect(mockScanPage).toHaveBeenCalledWith({
      url: 'https://example.com',
      wcagLevel: 'AAA',
    });
  });

  it('should preserve all issue data when saving to database', async () => {
    const mockJob = { data: mockJobData } as Job<ScanPageJobData>;

    await processScanPageJob(mockJob);

    const createCall = mockPrismaCreate.mock.calls[0][0];
    const savedIssues = createCall.data.issues.create;

    // Verify first issue
    expect(savedIssues[0]).toEqual({
      id: 'issue-1',
      ruleId: 'color-contrast',
      impact: 'SERIOUS',
      description: 'Elements must have sufficient color contrast',
      helpText: 'Ensure color contrast meets WCAG standards',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
      wcagCriteria: ['1.4.3'],
      cssSelector: '.btn',
      htmlSnippet: '<button class="btn">Click me</button>',
      nodes: [
        {
          html: '<button class="btn">Click me</button>',
          target: ['.btn'],
          failureSummary: 'Fix color contrast',
        },
      ],
    });
  });
});
