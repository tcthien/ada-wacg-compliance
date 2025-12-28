/**
 * Unit tests for useScanEvents hook
 *
 * Tests:
 * - Polling starts when scan is active (PENDING/RUNNING)
 * - Polling stops when scan completes (COMPLETED/FAILED)
 * - Events accumulate correctly across polls
 * - Error handling for API failures
 * - Admin flag filters adminOnly events
 * - Refetch functionality
 * - Cleanup on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useScanEvents } from './useScanEvents';
import * as apiModule from '@/lib/api';
import type { ScanStatus } from '@/lib/api';
import type { ScanEvent, GetEventsResponse } from '@/types/scan-event';

describe('useScanEvents', () => {
  const mockScanId = 'scan-123';
  let mockedGetEvents: ReturnType<typeof vi.fn>;

  // Helper to create mock events
  const createMockEvent = (
    id: string,
    message: string,
    adminOnly = false,
    createdAt = new Date().toISOString()
  ): ScanEvent => ({
    id,
    scanId: mockScanId,
    type: 'INIT',
    level: 'INFO',
    message,
    metadata: null,
    adminOnly,
    createdAt,
  });

  // Helper to create mock API response
  const createMockResponse = (
    events: ScanEvent[],
    lastTimestamp: string | null = null
  ): GetEventsResponse => ({
    events,
    lastTimestamp,
    hasMore: false,
  });

  beforeEach(() => {
    mockedGetEvents = vi.fn();
    vi.spyOn(apiModule.api.scans, 'getEvents').mockImplementation(mockedGetEvents);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial fetch', () => {
    it('should fetch events on mount', async () => {
      const mockEvents = [createMockEvent('1', 'Test event')];
      const mockResponse = createMockResponse(mockEvents, '2024-01-01T00:00:00Z');

      mockedGetEvents.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING')
      );

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.events).toEqual([]);

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.events).toEqual(mockEvents);
      expect(result.current.error).toBeNull();
      expect(mockedGetEvents).toHaveBeenCalledWith(mockScanId, {});
    });

    it('should handle empty events on initial fetch', async () => {
      const mockResponse = createMockResponse([]);

      mockedGetEvents.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.events).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle API errors on initial fetch', async () => {
      const errorMessage = 'API connection failed';
      mockedGetEvents.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.events).toEqual([]);
      expect(result.current.error).toBe(errorMessage);
    });
  });

  describe('Polling behavior', () => {
    it('should start polling when scan status is PENDING', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents, '2024-01-01T00:00:00Z');

      mockedGetEvents.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'PENDING', { pollInterval: 2000 })
      );

      // Initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockedGetEvents).toHaveBeenCalledTimes(1);

      // Fast-forward time by 2 seconds
      vi.advanceTimersByTime(2000);

      // Wait for the next poll
      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });

      // Second poll should use 'since' parameter
      expect(mockedGetEvents).toHaveBeenLastCalledWith(mockScanId, {
        since: '2024-01-01T00:00:00Z',
      });
    });

    it('should start polling when scan status is RUNNING', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents, '2024-01-01T00:00:00Z');

      mockedGetEvents.mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockedGetEvents).toHaveBeenCalledTimes(1);

      // Fast-forward time by 2 seconds
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });
    });

    it('should not start polling when scan status is COMPLETED', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents);

      mockedGetEvents.mockResolvedValue(mockResponse);

      renderHook(() =>
        useScanEvents(mockScanId, 'COMPLETED', { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(1);
      });

      // Fast-forward time by 10 seconds
      vi.advanceTimersByTime(10000);

      // Should still only have been called once (no polling)
      expect(mockedGetEvents).toHaveBeenCalledTimes(1);
    });

    it('should not start polling when scan status is FAILED', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents);

      mockedGetEvents.mockResolvedValue(mockResponse);

      renderHook(() =>
        useScanEvents(mockScanId, 'FAILED', { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(1);
      });

      // Fast-forward time by 10 seconds
      vi.advanceTimersByTime(10000);

      // Should still only have been called once (no polling)
      expect(mockedGetEvents).toHaveBeenCalledTimes(1);
    });

    it('should stop polling when scan status changes to COMPLETED', async () => {
      const mockEvents1 = [createMockEvent('1', 'Event 1')];
      const mockEvents2 = [createMockEvent('2', 'Event 2')];

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse(mockEvents1, '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(createMockResponse(mockEvents2, '2024-01-01T00:00:01Z'));

      const { result, rerender } = renderHook(
        ({ status }: { status: ScanStatus }) =>
          useScanEvents(mockScanId, status, { pollInterval: 2000 }),
        { initialProps: { status: 'RUNNING' as ScanStatus } }
      );

      // Initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockedGetEvents).toHaveBeenCalledTimes(1);

      // Fast-forward time by 2 seconds for second poll
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });

      // Change status to COMPLETED
      rerender({ status: 'COMPLETED' });

      // Fast-forward time by 10 seconds
      vi.advanceTimersByTime(10000);

      // Should not poll anymore
      expect(mockedGetEvents).toHaveBeenCalledTimes(2);
    });

    it('should use custom poll interval', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents, '2024-01-01T00:00:00Z');

      mockedGetEvents.mockResolvedValue(mockResponse);

      renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 5000 })
      );

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(1);
      });

      // Fast-forward by 4 seconds (should not poll yet)
      vi.advanceTimersByTime(4000);
      expect(mockedGetEvents).toHaveBeenCalledTimes(1);

      // Fast-forward by 1 more second (total 5 seconds)
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Event accumulation', () => {
    it('should accumulate events across multiple polls', async () => {
      const event1 = createMockEvent('1', 'Event 1', false, '2024-01-01T00:00:00Z');
      const event2 = createMockEvent('2', 'Event 2', false, '2024-01-01T00:00:01Z');
      const event3 = createMockEvent('3', 'Event 3', false, '2024-01-01T00:00:02Z');

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse([event1], '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(createMockResponse([event2], '2024-01-01T00:00:01Z'))
        .mockResolvedValueOnce(createMockResponse([event3], '2024-01-01T00:00:02Z'));

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 1000 })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });
      expect(result.current.events[0].message).toBe('Event 1');

      // First poll
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(result.current.events).toHaveLength(2);
      });
      expect(result.current.events.map((e) => e.message)).toEqual([
        'Event 1',
        'Event 2',
      ]);

      // Second poll
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(result.current.events).toHaveLength(3);
      });
      expect(result.current.events.map((e) => e.message)).toEqual([
        'Event 1',
        'Event 2',
        'Event 3',
      ]);
    });

    it('should not duplicate events if API returns empty on subsequent polls', async () => {
      const event1 = createMockEvent('1', 'Event 1', false, '2024-01-01T00:00:00Z');

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse([event1], '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(createMockResponse([], '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(createMockResponse([], '2024-01-01T00:00:00Z'));

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 1000 })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      // First poll (no new events)
      vi.advanceTimersByTime(1000);
      await vi.waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });
      expect(result.current.events).toHaveLength(1);

      // Second poll (no new events)
      vi.advanceTimersByTime(1000);
      await vi.waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(3);
      });
      expect(result.current.events).toHaveLength(1);
    });

    it('should sort events by createdAt timestamp', async () => {
      // Return events out of order
      const event1 = createMockEvent('1', 'Event 1', false, '2024-01-01T00:00:00Z');
      const event2 = createMockEvent('2', 'Event 2', false, '2024-01-01T00:00:03Z'); // Later timestamp
      const event3 = createMockEvent('3', 'Event 3', false, '2024-01-01T00:00:01Z'); // Middle timestamp

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse([event1], '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(
          createMockResponse([event2, event3], '2024-01-01T00:00:03Z')
        );

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 1000 })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      // First poll
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(result.current.events).toHaveLength(3);
      });

      // Should be sorted by timestamp
      expect(result.current.events.map((e) => e.message)).toEqual([
        'Event 1', // 00:00:00
        'Event 3', // 00:00:01
        'Event 2', // 00:00:03
      ]);
    });

    it('should use lastTimestamp for subsequent polls', async () => {
      const event1 = createMockEvent('1', 'Event 1');
      const event2 = createMockEvent('2', 'Event 2');

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse([event1], '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(createMockResponse([event2], '2024-01-01T00:00:01Z'));

      renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 1000 })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(1);
      });

      // First call should not have 'since' parameter
      expect(mockedGetEvents).toHaveBeenCalledWith(mockScanId, {});

      // First poll
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });

      // Second call should use 'since' parameter
      expect(mockedGetEvents).toHaveBeenLastCalledWith(mockScanId, {
        since: '2024-01-01T00:00:00Z',
      });
    });
  });

  describe('Admin filter', () => {
    it('should filter out adminOnly events when isAdmin is false', async () => {
      const publicEvent = createMockEvent('1', 'Public event', false);
      const adminEvent = createMockEvent('2', 'Admin event', true);

      mockedGetEvents.mockResolvedValue(
        createMockResponse([publicEvent, adminEvent])
      );

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'COMPLETED', { isAdmin: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only include public event
      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0].message).toBe('Public event');
    });

    it('should include adminOnly events when isAdmin is true', async () => {
      const publicEvent = createMockEvent('1', 'Public event', false);
      const adminEvent = createMockEvent('2', 'Admin event', true);

      mockedGetEvents.mockResolvedValue(
        createMockResponse([publicEvent, adminEvent])
      );

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'COMPLETED', { isAdmin: true })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should include both events
      expect(result.current.events).toHaveLength(2);
      expect(result.current.events.map((e) => e.message)).toEqual([
        'Public event',
        'Admin event',
      ]);
    });

    it('should apply admin filter across multiple polls', async () => {
      const publicEvent1 = createMockEvent('1', 'Public 1', false);
      const adminEvent1 = createMockEvent('2', 'Admin 1', true);
      const publicEvent2 = createMockEvent('3', 'Public 2', false);
      const adminEvent2 = createMockEvent('4', 'Admin 2', true);

      mockedGetEvents
        .mockResolvedValueOnce(
          createMockResponse([publicEvent1, adminEvent1], '2024-01-01T00:00:00Z')
        )
        .mockResolvedValueOnce(
          createMockResponse([publicEvent2, adminEvent2], '2024-01-01T00:00:01Z')
        );

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', {
          pollInterval: 1000,
          isAdmin: false,
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });
      expect(result.current.events[0].message).toBe('Public 1');

      // First poll
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(result.current.events).toHaveLength(2);
      });

      // Should only include public events
      expect(result.current.events.map((e) => e.message)).toEqual([
        'Public 1',
        'Public 2',
      ]);
    });
  });

  describe('Error handling', () => {
    it('should set error state when API call fails', async () => {
      const errorMessage = 'Network error';
      mockedGetEvents.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.events).toEqual([]);
    });

    it('should handle non-Error rejections', async () => {
      mockedGetEvents.mockRejectedValue('String error');

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch events');
    });

    it('should continue polling after errors', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents, '2024-01-01T00:00:00Z');

      mockedGetEvents
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 1000 })
      );

      // Initial fetch fails
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // First poll succeeds
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.events).toEqual(mockEvents);
    });

    it('should preserve existing events when subsequent polls fail', async () => {
      const event1 = createMockEvent('1', 'Event 1');
      const mockResponse = createMockResponse([event1], '2024-01-01T00:00:00Z');

      mockedGetEvents
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 1000 })
      );

      // Initial fetch succeeds
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      // First poll fails
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Events should be preserved
      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0].message).toBe('Event 1');
    });
  });

  describe('Refetch functionality', () => {
    it('should manually refetch events when refetch is called', async () => {
      const event1 = createMockEvent('1', 'Event 1');
      const event2 = createMockEvent('2', 'Event 2');

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse([event1], '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(createMockResponse([event2], '2024-01-01T00:00:01Z'));

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'COMPLETED')
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      expect(mockedGetEvents).toHaveBeenCalledTimes(1);

      // Manual refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });

      expect(result.current.events).toHaveLength(2);
    });

    it('should use lastTimestamp when manually refetching', async () => {
      const event1 = createMockEvent('1', 'Event 1');
      const event2 = createMockEvent('2', 'Event 2');

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse([event1], '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(createMockResponse([event2], '2024-01-01T00:00:01Z'));

      const { result } = renderHook(() =>
        useScanEvents(mockScanId, 'COMPLETED')
      );

      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      // Manual refetch
      await result.current.refetch();

      // Should use 'since' parameter from first response
      expect(mockedGetEvents).toHaveBeenLastCalledWith(mockScanId, {
        since: '2024-01-01T00:00:00Z',
      });
    });
  });

  describe('API options', () => {
    it('should pass apiOptions to API calls', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents);

      mockedGetEvents.mockResolvedValue(mockResponse);

      renderHook(() =>
        useScanEvents(mockScanId, 'COMPLETED', {
          apiOptions: { limit: 50 },
        })
      );

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledWith(mockScanId, {
          limit: 50,
        });
      });
    });

    it('should merge apiOptions with since parameter', async () => {
      const mockEvents1 = [createMockEvent('1', 'Event 1')];
      const mockEvents2 = [createMockEvent('2', 'Event 2')];

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse(mockEvents1, '2024-01-01T00:00:00Z'))
        .mockResolvedValueOnce(createMockResponse(mockEvents2, '2024-01-01T00:00:01Z'));

      renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', {
          pollInterval: 1000,
          apiOptions: { limit: 100 },
        })
      );

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(1);
      });

      // First poll
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });

      // Should merge apiOptions with since
      expect(mockedGetEvents).toHaveBeenLastCalledWith(mockScanId, {
        limit: 100,
        since: '2024-01-01T00:00:00Z',
      });
    });
  });

  describe('Cleanup and lifecycle', () => {
    it('should cleanup interval on unmount', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents, '2024-01-01T00:00:00Z');

      mockedGetEvents.mockResolvedValue(mockResponse);

      const { unmount } = renderHook(() =>
        useScanEvents(mockScanId, 'RUNNING', { pollInterval: 1000 })
      );

      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(1);
      });

      // Unmount
      unmount();

      // Fast-forward time
      vi.advanceTimersByTime(10000);

      // Should not poll after unmount
      expect(mockedGetEvents).toHaveBeenCalledTimes(1);
    });

    it('should reset state when scanId changes', async () => {
      const mockEvents1 = [createMockEvent('1', 'Event 1')];
      const mockEvents2 = [createMockEvent('2', 'Event 2')];

      mockedGetEvents
        .mockResolvedValueOnce(createMockResponse(mockEvents1))
        .mockResolvedValueOnce(createMockResponse(mockEvents2));

      const { result, rerender } = renderHook(
        ({ scanId }: { scanId: string }) => useScanEvents(scanId, 'COMPLETED'),
        { initialProps: { scanId: 'scan-1' } }
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.events).toHaveLength(1);
      });

      // Change scanId
      rerender({ scanId: 'scan-2' });

      // Should reset state and be loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have new events
      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0].message).toBe('Event 2');
    });

    it('should restart polling when scanStatus changes from COMPLETED to RUNNING', async () => {
      const mockEvents = [createMockEvent('1', 'Event 1')];
      const mockResponse = createMockResponse(mockEvents, '2024-01-01T00:00:00Z');

      mockedGetEvents.mockResolvedValue(mockResponse);

      const { rerender } = renderHook(
        ({ status }: { status: ScanStatus }) =>
          useScanEvents(mockScanId, status, { pollInterval: 1000 }),
        { initialProps: { status: 'COMPLETED' as ScanStatus } }
      );

      // Initial fetch (no polling)
      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(1);
      });

      vi.advanceTimersByTime(5000);
      expect(mockedGetEvents).toHaveBeenCalledTimes(1);

      // Change to RUNNING
      rerender({ status: 'RUNNING' });

      // Should reset and start polling
      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(2);
      });

      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(mockedGetEvents).toHaveBeenCalledTimes(3);
      });
    });
  });
});
