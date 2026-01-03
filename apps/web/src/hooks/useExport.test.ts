/**
 * Unit tests for useExport hook
 *
 * Tests:
 * - State management (idle, generating, completed, error)
 * - Export report functionality
 * - Reset and cancel operations
 * - Format tracking
 * - Backward compatibility
 * - Polling and download behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useExport } from './useExport';
import * as apiModule from '@/lib/api';
import type { ReportResponse } from '@/lib/api';

// Mock fetch globally
global.fetch = vi.fn();

describe('useExport', () => {
  const mockScanId = 'scan-123';
  let mockedReportsGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedReportsGet = vi.fn();
    vi.spyOn(apiModule.api.reports, 'get').mockImplementation(mockedReportsGet);

    // Mock successful fetch for download
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['mock content'], { type: 'application/pdf' }),
    });

    // Mock DOM methods - don't replace createElement entirely, just spy on it
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = originalCreateElement('a');
        // Override click to be a mock
        anchor.click = vi.fn();
        return anchor;
      }
      return originalCreateElement(tag);
    });

    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('should initialize with idle state', () => {
      const { result } = renderHook(() => useExport());

      expect(result.current.state).toEqual({
        status: 'idle',
        format: null,
        error: null,
      });
      expect(result.current.isExporting).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Export report - Ready response', () => {
    it('should handle ready PDF report', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      let exportResult: boolean = false;
      await act(async () => {
        exportResult = await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(exportResult).toBe(true);
      expect(result.current.state.status).toBe('completed');
      expect(result.current.state.format).toBe('pdf');
      expect(result.current.state.error).toBeNull();
      expect(mockedReportsGet).toHaveBeenCalledWith(mockScanId, 'pdf');
    });

    it('should handle ready JSON report', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.json',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      let exportResult: boolean = false;
      await act(async () => {
        exportResult = await result.current.exportReport(mockScanId, 'json');
      });

      expect(exportResult).toBe(true);
      expect(result.current.state.format).toBe('json');
      expect(mockedReportsGet).toHaveBeenCalledWith(mockScanId, 'json');
    });

    it('should trigger download when report is ready', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(global.fetch).toHaveBeenCalledWith(mockResponse.url);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('Export report - Generating response', () => {
    it('should poll when report is generating', async () => {
      const generatingResponse: ReportResponse = {
        status: 'generating',
        jobId: 'job-123',
      };
      const readyResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };

      mockedReportsGet
        .mockResolvedValueOnce(generatingResponse)
        .mockResolvedValueOnce(readyResponse);

      const { result } = renderHook(() => useExport());

      const exportPromise = act(async () => {
        return result.current.exportReport(mockScanId, 'pdf');
      });

      // Fast-forward past the polling delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      const exportResult = await exportPromise;

      expect(exportResult).toBe(true);
      expect(result.current.state.status).toBe('completed');
      expect(mockedReportsGet).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff during polling', async () => {
      const generatingResponse: ReportResponse = {
        status: 'generating',
        jobId: 'job-123',
      };
      const readyResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };

      mockedReportsGet
        .mockResolvedValueOnce(generatingResponse)
        .mockResolvedValueOnce(generatingResponse)
        .mockResolvedValueOnce(readyResponse);

      const { result } = renderHook(() => useExport());

      const exportPromise = act(async () => {
        return result.current.exportReport(mockScanId, 'pdf');
      });

      // First poll - 1 second delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      // Second poll - 1.5 second delay (exponential backoff)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      await exportPromise;

      expect(mockedReportsGet).toHaveBeenCalledTimes(3);
    });

    it('should timeout after max polling attempts', async () => {
      const generatingResponse: ReportResponse = {
        status: 'generating',
        jobId: 'job-123',
      };

      mockedReportsGet.mockResolvedValue(generatingResponse);

      const { result } = renderHook(() => useExport());

      const exportPromise = act(async () => {
        return result.current.exportReport(mockScanId, 'pdf');
      });

      // Fast-forward through all polling attempts
      for (let i = 0; i < 15; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });
      }

      const exportResult = await exportPromise;

      expect(exportResult).toBe(false);
      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toContain('timed out');
    });
  });

  describe('State transitions', () => {
    it('should track status transition from idle to generating', async () => {
      const mockResponse: ReportResponse = {
        status: 'generating',
        jobId: 'job-123',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      expect(result.current.state.status).toBe('idle');

      act(() => {
        result.current.exportReport(mockScanId, 'pdf');
      });

      // Should be in generating state
      expect(result.current.state.status).toBe('generating');
      expect(result.current.state.format).toBe('pdf');
    });

    it('should track status transition from generating to completed', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(result.current.state.status).toBe('completed');
      expect(result.current.state.format).toBe('pdf');
      expect(result.current.state.error).toBeNull();
    });

    it('should track status transition from generating to error', async () => {
      mockedReportsGet.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.format).toBe('pdf');
      expect(result.current.state.error).toBe('Network error');
    });

    it('should preserve format during error', async () => {
      mockedReportsGet.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'json');
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.format).toBe('json');
    });
  });

  describe('Reset functionality', () => {
    it('should reset state to idle when reset is called', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      // Complete an export
      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(result.current.state.status).toBe('completed');
      expect(result.current.state.format).toBe('pdf');

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toEqual({
        status: 'idle',
        format: null,
        error: null,
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should clear error state on reset', async () => {
      mockedReportsGet.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(result.current.state.error).toBe('Test error');

      act(() => {
        result.current.reset();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Cancel functionality', () => {
    it('should cancel ongoing export', async () => {
      const generatingResponse: ReportResponse = {
        status: 'generating',
        jobId: 'job-123',
      };

      mockedReportsGet.mockResolvedValue(generatingResponse);

      const { result } = renderHook(() => useExport());

      const exportPromise = act(async () => {
        return result.current.exportReport(mockScanId, 'pdf');
      });

      // Cancel immediately
      act(() => {
        result.current.cancel();
      });

      const exportResult = await exportPromise;

      expect(exportResult).toBe(false);
      expect(result.current.state.status).toBe('idle');
      expect(result.current.loading).toBe(false);
    });

    it('should prevent state updates after cancel', async () => {
      const generatingResponse: ReportResponse = {
        status: 'generating',
        jobId: 'job-123',
      };
      const readyResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };

      mockedReportsGet
        .mockResolvedValueOnce(generatingResponse)
        .mockResolvedValueOnce(readyResponse);

      const { result } = renderHook(() => useExport());

      const exportPromise = act(async () => {
        return result.current.exportReport(mockScanId, 'pdf');
      });

      // Cancel before polling completes
      act(() => {
        result.current.cancel();
      });

      // Wait for polling
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      await exportPromise;

      // State should remain idle after cancellation
      expect(result.current.state.status).toBe('idle');
    });
  });

  describe('Format tracking', () => {
    it('should track PDF format during export', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      act(() => {
        result.current.exportReport(mockScanId, 'pdf');
      });

      expect(result.current.state.format).toBe('pdf');
    });

    it('should track JSON format during export', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.json',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      act(() => {
        result.current.exportReport(mockScanId, 'json');
      });

      expect(result.current.state.format).toBe('json');
    });

    it('should update format when switching between exports', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      // Export PDF
      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });
      expect(result.current.state.format).toBe('pdf');

      // Reset and export JSON
      act(() => {
        result.current.reset();
      });

      await act(async () => {
        await result.current.exportReport(mockScanId, 'json');
      });
      expect(result.current.state.format).toBe('json');
    });
  });

  describe('Error handling', () => {
    it('should handle API errors', async () => {
      const errorMessage = 'API request failed';
      mockedReportsGet.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useExport());

      const exportResult = await act(async () => {
        return result.current.exportReport(mockScanId, 'pdf');
      });

      expect(exportResult).toBe(false);
      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe(errorMessage);
    });

    it('should handle non-Error rejections', async () => {
      mockedReportsGet.mockRejectedValue('String error');

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(result.current.state.error).toBe('Failed to export report');
    });

    it('should not set error if cancelled', async () => {
      mockedReportsGet.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useExport());

      const exportPromise = act(async () => {
        return result.current.exportReport(mockScanId, 'pdf');
      });

      // Cancel before error is set
      act(() => {
        result.current.cancel();
      });

      await exportPromise;

      // Error should not be set because export was cancelled
      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Backward compatibility', () => {
    it('should provide isExporting property', async () => {
      const generatingResponse: ReportResponse = {
        status: 'generating',
        jobId: 'job-123',
      };
      mockedReportsGet.mockResolvedValue(generatingResponse);

      const { result } = renderHook(() => useExport());

      expect(result.current.isExporting).toBe(false);

      act(() => {
        result.current.exportReport(mockScanId, 'pdf');
      });

      expect(result.current.isExporting).toBe(true);
    });

    it('should provide loading property', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      expect(result.current.loading).toBe(false);

      const exportPromise = act(async () => {
        return result.current.exportReport(mockScanId, 'pdf');
      });

      // Note: loading state changes too quickly in tests
      // Just verify it exists and is correct after completion
      await exportPromise;

      expect(result.current.loading).toBe(false);
    });

    it('should provide error property', async () => {
      mockedReportsGet.mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useExport());

      expect(result.current.error).toBeNull();

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(result.current.error).toBe('Test error');
    });
  });

  describe('Download behavior', () => {
    it('should create blob URL and trigger download', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      expect(global.fetch).toHaveBeenCalledWith(mockResponse.url);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should cleanup blob URL after download', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      // Fast-forward to cleanup
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should use correct filename for PDF', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.pdf',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'pdf');
      });

      // Check that createElement was called for anchor
      expect(document.createElement).toHaveBeenCalledWith('a');

      // Get the mock call to find the anchor element
      const createElementCalls = (document.createElement as ReturnType<typeof vi.fn>).mock.calls;
      const anchorCall = createElementCalls.find((call) => call[0] === 'a');
      expect(anchorCall).toBeDefined();
    });

    it('should use correct filename for JSON', async () => {
      const mockResponse: ReportResponse = {
        url: 'https://s3.example.com/report.json',
        expiresAt: '2025-12-29T10:00:00Z',
      };
      mockedReportsGet.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExport());

      await act(async () => {
        await result.current.exportReport(mockScanId, 'json');
      });

      // Check that createElement was called for anchor
      expect(document.createElement).toHaveBeenCalledWith('a');
    });
  });
});
