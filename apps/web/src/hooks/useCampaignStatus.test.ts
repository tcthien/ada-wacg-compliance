/**
 * Tests for useCampaignStatus hook
 *
 * Tests React Query integration, campaign status fetching,
 * auto-refresh behavior, and error handling.
 *
 * Requirements: REQ-2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCampaignStatus } from './useCampaignStatus';
import { api, type CampaignStatusResponse } from '@/lib/api';

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    aiCampaign: {
      getStatus: vi.fn(),
    },
  },
}));

describe('useCampaignStatus', () => {
  let queryClient: QueryClient;

  // Create a wrapper component for React Query
  const createWrapper = () => {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  const createMockCampaignStatus = (
    overrides: Partial<CampaignStatusResponse> = {}
  ): CampaignStatusResponse => ({
    active: true,
    slotsRemaining: 550,
    totalSlots: 1000,
    percentRemaining: 55,
    urgencyLevel: 'normal',
    message: 'AI-powered analysis available',
    ...overrides,
  });

  describe('initial fetch', () => {
    it('should start in loading state', async () => {
      const mockStatus = createMockCampaignStatus();
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBeNull();

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should fetch and return campaign status', async () => {
      const mockStatus = createMockCampaignStatus();
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status).toEqual(mockStatus);
      expect(result.current.error).toBeNull();
      expect(api.aiCampaign.getStatus).toHaveBeenCalledTimes(1);
    });

    it('should return null status when no active campaign', async () => {
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(null as unknown as CampaignStatusResponse);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('urgency levels', () => {
    it('should return normal urgency for >20% remaining', async () => {
      const mockStatus = createMockCampaignStatus({
        percentRemaining: 55,
        urgencyLevel: 'normal',
      });
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status?.urgencyLevel).toBe('normal');
      });
    });

    it('should return limited urgency for 10-20% remaining', async () => {
      const mockStatus = createMockCampaignStatus({
        percentRemaining: 15,
        urgencyLevel: 'limited',
      });
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status?.urgencyLevel).toBe('limited');
      });
    });

    it('should return almost_gone urgency for 5-10% remaining', async () => {
      const mockStatus = createMockCampaignStatus({
        percentRemaining: 7,
        urgencyLevel: 'almost_gone',
      });
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status?.urgencyLevel).toBe('almost_gone');
      });
    });

    it('should return final urgency for <=5% remaining', async () => {
      const mockStatus = createMockCampaignStatus({
        percentRemaining: 3,
        urgencyLevel: 'final',
      });
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status?.urgencyLevel).toBe('final');
      });
    });

    it('should return depleted urgency for 0 slots', async () => {
      const mockStatus = createMockCampaignStatus({
        slotsRemaining: 0,
        percentRemaining: 0,
        urgencyLevel: 'depleted',
      });
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status?.urgencyLevel).toBe('depleted');
      });
    });
  });

  describe('inactive campaign', () => {
    it('should handle inactive campaign', async () => {
      const mockStatus = createMockCampaignStatus({
        active: false,
        slotsRemaining: 0,
        percentRemaining: 0,
        urgencyLevel: 'depleted',
        message: 'Campaign has ended',
      });
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status?.active).toBe(false);
      });

      expect(result.current.status?.message).toBe('Campaign has ended');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const error = new Error('Network error');
      vi.mocked(api.aiCampaign.getStatus).mockRejectedValue(error);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.status).toBeNull();
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(api.aiCampaign.getStatus).mockRejectedValue('String error');

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Error should be null since it's not an Error instance
      expect(result.current.status).toBeNull();
    });
  });

  describe('refetch function', () => {
    it('should allow manual refetch', async () => {
      const mockStatus = createMockCampaignStatus();
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.aiCampaign.getStatus).toHaveBeenCalledTimes(1);

      // Manually trigger refetch
      result.current.refetch();

      await waitFor(() => {
        expect(api.aiCampaign.getStatus).toHaveBeenCalledTimes(2);
      });
    });

    it('should update status on refetch', async () => {
      const initialStatus = createMockCampaignStatus({ slotsRemaining: 550 });
      const updatedStatus = createMockCampaignStatus({ slotsRemaining: 500 });

      vi.mocked(api.aiCampaign.getStatus)
        .mockResolvedValueOnce(initialStatus)
        .mockResolvedValueOnce(updatedStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.status?.slotsRemaining).toBe(550);
      });

      result.current.refetch();

      await waitFor(() => {
        expect(result.current.status?.slotsRemaining).toBe(500);
      });
    });
  });

  describe('query key', () => {
    it('should use correct query key for caching', async () => {
      const mockStatus = createMockCampaignStatus();
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(api.aiCampaign.getStatus).toHaveBeenCalled();
      });

      // Verify query is cached with correct key
      const cachedData = queryClient.getQueryData(['ai-campaign', 'status']);
      expect(cachedData).toEqual(mockStatus);
    });
  });

  describe('return type', () => {
    it('should return all expected properties', async () => {
      const mockStatus = createMockCampaignStatus();
      vi.mocked(api.aiCampaign.getStatus).mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useCampaignStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify all return properties exist
      expect(result.current).toHaveProperty('status');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
      expect(typeof result.current.refetch).toBe('function');
    });
  });
});
