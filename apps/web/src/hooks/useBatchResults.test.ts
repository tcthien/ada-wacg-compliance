/**
 * Tests for useBatchResults hook
 * Verifies partial result fetching, polling, and aggregate statistics calculation
 */

import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useBatchResults } from './useBatchResults';
import { batchApi, type BatchResultsResponse } from '@/lib/batch-api';

// Mock the batch API
vi.mock('@/lib/batch-api', () => ({
  batchApi: {
    getResults: vi.fn(),
  },
}));

describe('useBatchResults', () => {
  let queryClient: QueryClient;

  // Helper to create wrapper with QueryClient
  const createWrapper = () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
    return wrapper;
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests
          retryDelay: 0, // No delay between retries
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should fetch and return batch results with completed scans', async () => {
    const mockResults: BatchResultsResponse = {
      batchId: 'batch_123',
      status: 'COMPLETED',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      totalUrls: 3,
      completedCount: 3,
      failedCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T00:10:00.000Z',
      aggregate: {
        totalIssues: 30,
        criticalCount: 5,
        seriousCount: 10,
        moderateCount: 10,
        minorCount: 5,
        passedChecks: 100,
        urlsScanned: 3,
      },
      urls: [
        {
          id: 'scan_1',
          url: 'https://example.com',
          status: 'COMPLETED',
          pageTitle: 'Home',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          errorMessage: null,
        },
        {
          id: 'scan_2',
          url: 'https://example.com/about',
          status: 'COMPLETED',
          pageTitle: 'About',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          errorMessage: null,
        },
        {
          id: 'scan_3',
          url: 'https://example.com/contact',
          status: 'COMPLETED',
          pageTitle: 'Contact',
          totalIssues: 10,
          criticalCount: 1,
          seriousCount: 4,
          moderateCount: 4,
          minorCount: 1,
          errorMessage: null,
        },
      ],
      topCriticalUrls: [],
    };

    vi.mocked(batchApi.getResults).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBatchResults('batch_123'), {
      wrapper: createWrapper(),
    });

    // Should be loading initially
    expect(result.current.isLoading).toBe(true);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have fetched results
    expect(batchApi.getResults).toHaveBeenCalledWith('batch_123');
    expect(result.current.results).toEqual(mockResults);
    expect(result.current.completedScans).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it('should filter only completed scans from partial results', async () => {
    const mockResults: BatchResultsResponse = {
      batchId: 'batch_123',
      status: 'RUNNING',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      totalUrls: 5,
      completedCount: 2,
      failedCount: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      completedAt: null,
      aggregate: {
        totalIssues: 20,
        criticalCount: 4,
        seriousCount: 6,
        moderateCount: 6,
        minorCount: 4,
        passedChecks: 50,
        urlsScanned: 2,
      },
      urls: [
        {
          id: 'scan_1',
          url: 'https://example.com',
          status: 'COMPLETED',
          pageTitle: 'Home',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          errorMessage: null,
        },
        {
          id: 'scan_2',
          url: 'https://example.com/about',
          status: 'COMPLETED',
          pageTitle: 'About',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          errorMessage: null,
        },
        {
          id: 'scan_3',
          url: 'https://example.com/contact',
          status: 'RUNNING',
          pageTitle: null,
          totalIssues: 0,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          errorMessage: null,
        },
        {
          id: 'scan_4',
          url: 'https://example.com/blog',
          status: 'PENDING',
          pageTitle: null,
          totalIssues: 0,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          errorMessage: null,
        },
        {
          id: 'scan_5',
          url: 'https://example.com/fail',
          status: 'FAILED',
          pageTitle: null,
          totalIssues: 0,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          errorMessage: 'Network error',
        },
      ],
      topCriticalUrls: [],
    };

    vi.mocked(batchApi.getResults).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBatchResults('batch_123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should only return completed scans
    expect(result.current.completedScans).toHaveLength(2);
    expect(result.current.completedScans[0].status).toBe('COMPLETED');
    expect(result.current.completedScans[1].status).toBe('COMPLETED');
  });

  it('should calculate aggregate statistics for completed scans only', async () => {
    const mockResults: BatchResultsResponse = {
      batchId: 'batch_123',
      status: 'RUNNING',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      totalUrls: 3,
      completedCount: 2,
      failedCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      completedAt: null,
      aggregate: {
        totalIssues: 20,
        criticalCount: 4,
        seriousCount: 6,
        moderateCount: 6,
        minorCount: 4,
        passedChecks: 80,
        urlsScanned: 2,
      },
      urls: [
        {
          id: 'scan_1',
          url: 'https://example.com',
          status: 'COMPLETED',
          pageTitle: 'Home',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          errorMessage: null,
        },
        {
          id: 'scan_2',
          url: 'https://example.com/about',
          status: 'COMPLETED',
          pageTitle: 'About',
          totalIssues: 15,
          criticalCount: 3,
          seriousCount: 5,
          moderateCount: 5,
          minorCount: 2,
          errorMessage: null,
        },
        {
          id: 'scan_3',
          url: 'https://example.com/contact',
          status: 'RUNNING',
          pageTitle: null,
          totalIssues: 0,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          errorMessage: null,
        },
      ],
      topCriticalUrls: [],
    };

    vi.mocked(batchApi.getResults).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBatchResults('batch_123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const stats = result.current.aggregateStats;
    expect(stats).not.toBeNull();
    expect(stats?.totalIssues).toBe(25); // 10 + 15
    expect(stats?.criticalCount).toBe(5); // 2 + 3
    expect(stats?.seriousCount).toBe(8); // 3 + 5
    expect(stats?.moderateCount).toBe(8); // 3 + 5
    expect(stats?.minorCount).toBe(4); // 2 + 2
    expect(stats?.urlsScanned).toBe(2);
    expect(stats?.averageIssuesPerPage).toBe(12.5); // 25 / 2
  });

  it('should return null aggregate stats when no completed scans', async () => {
    const mockResults: BatchResultsResponse = {
      batchId: 'batch_123',
      status: 'RUNNING',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      totalUrls: 2,
      completedCount: 0,
      failedCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      completedAt: null,
      aggregate: {
        totalIssues: 0,
        criticalCount: 0,
        seriousCount: 0,
        moderateCount: 0,
        minorCount: 0,
        passedChecks: 0,
        urlsScanned: 0,
      },
      urls: [
        {
          id: 'scan_1',
          url: 'https://example.com',
          status: 'RUNNING',
          pageTitle: null,
          totalIssues: 0,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          errorMessage: null,
        },
        {
          id: 'scan_2',
          url: 'https://example.com/about',
          status: 'PENDING',
          pageTitle: null,
          totalIssues: 0,
          criticalCount: 0,
          seriousCount: 0,
          moderateCount: 0,
          minorCount: 0,
          errorMessage: null,
        },
      ],
      topCriticalUrls: [],
    };

    vi.mocked(batchApi.getResults).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBatchResults('batch_123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.completedScans).toHaveLength(0);
    expect(result.current.aggregateStats).toBeNull();
  });

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'Batch not found';
    vi.mocked(batchApi.getResults).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useBatchResults('batch_123'), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.results).toBeNull();
    expect(result.current.completedScans).toHaveLength(0);
    expect(result.current.aggregateStats).toBeNull();
  });

  it('should respect enabled option', async () => {
    const mockResults: BatchResultsResponse = {
      batchId: 'batch_123',
      status: 'COMPLETED',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      totalUrls: 1,
      completedCount: 1,
      failedCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T00:10:00.000Z',
      aggregate: {
        totalIssues: 10,
        criticalCount: 2,
        seriousCount: 3,
        moderateCount: 3,
        minorCount: 2,
        passedChecks: 50,
        urlsScanned: 1,
      },
      urls: [
        {
          id: 'scan_1',
          url: 'https://example.com',
          status: 'COMPLETED',
          pageTitle: 'Home',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          errorMessage: null,
        },
      ],
      topCriticalUrls: [],
    };

    vi.mocked(batchApi.getResults).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBatchResults('batch_123', { enabled: false }), {
      wrapper: createWrapper(),
    });

    // Should not fetch when disabled
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(batchApi.getResults).not.toHaveBeenCalled();
    expect(result.current.results).toBeNull();
  });

  it('should support manual refetch', async () => {
    const mockResults: BatchResultsResponse = {
      batchId: 'batch_123',
      status: 'COMPLETED',
      homepageUrl: 'https://example.com',
      wcagLevel: 'AA',
      totalUrls: 1,
      completedCount: 1,
      failedCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      completedAt: '2025-01-01T00:10:00.000Z',
      aggregate: {
        totalIssues: 10,
        criticalCount: 2,
        seriousCount: 3,
        moderateCount: 3,
        minorCount: 2,
        passedChecks: 50,
        urlsScanned: 1,
      },
      urls: [
        {
          id: 'scan_1',
          url: 'https://example.com',
          status: 'COMPLETED',
          pageTitle: 'Home',
          totalIssues: 10,
          criticalCount: 2,
          seriousCount: 3,
          moderateCount: 3,
          minorCount: 2,
          errorMessage: null,
        },
      ],
      topCriticalUrls: [],
    };

    vi.mocked(batchApi.getResults).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBatchResults('batch_123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(batchApi.getResults).toHaveBeenCalledTimes(1);

    // Trigger refetch
    result.current.refetch();

    await waitFor(() => {
      expect(batchApi.getResults).toHaveBeenCalledTimes(2);
    });
  });
});
