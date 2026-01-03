/**
 * Unit tests for useDiscovery hook
 *
 * Tests:
 * - Initial load and polling behavior
 * - Create discovery flow
 * - Manual URL operations (add, remove, batch)
 * - Session persistence (selection storage)
 * - Error handling
 * - Cleanup on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDiscovery } from './useDiscovery';
import * as discoveryApiModule from '@/lib/discovery-api';
import type {
  DiscoveryWithPages,
  Discovery,
  DiscoveredPage,
  CreateDiscoveryResponse,
  GetDiscoveryResponse,
  AddUrlResponse,
  AddUrlsResponse,
  CancelDiscoveryResponse,
  RemoveUrlResponse,
} from '@/lib/discovery-api';

describe('useDiscovery', () => {
  const mockDiscoveryId = 'discovery-123';
  const mockHomepageUrl = 'https://example.com';

  // Mock API functions
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockGet: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let mockAddUrl: ReturnType<typeof vi.fn>;
  let mockAddUrls: ReturnType<typeof vi.fn>;
  let mockRemoveUrl: ReturnType<typeof vi.fn>;

  // Mock sessionStorage
  const mockSessionStorage: Record<string, string> = {};

  // Helper to create mock discovery
  const createMockDiscovery = (
    overrides: Partial<Discovery> = {}
  ): Discovery => ({
    id: mockDiscoveryId,
    sessionId: 'session-123',
    homepageUrl: mockHomepageUrl,
    mode: 'AUTO',
    status: 'PENDING',
    phase: null,
    maxPages: 10,
    maxDepth: 1,
    partialResults: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    completedAt: null,
    errorMessage: null,
    errorCode: null,
    ...overrides,
  });

  // Helper to create mock page
  const createMockPage = (
    id: string,
    url: string,
    overrides: Partial<DiscoveredPage> = {}
  ): DiscoveredPage => ({
    id,
    discoveryId: mockDiscoveryId,
    url,
    title: `Page ${id}`,
    source: 'SITEMAP',
    depth: 1,
    httpStatus: 200,
    contentType: 'text/html',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  // Helper to create mock discovery with pages
  const createMockDiscoveryWithPages = (
    pages: DiscoveredPage[] = [],
    overrides: Partial<Discovery> = {}
  ): DiscoveryWithPages => ({
    ...createMockDiscovery(overrides),
    pages,
  });

  beforeEach(() => {
    // Setup mocks
    mockCreate = vi.fn();
    mockGet = vi.fn();
    mockCancel = vi.fn();
    mockAddUrl = vi.fn();
    mockAddUrls = vi.fn();
    mockRemoveUrl = vi.fn();

    vi.spyOn(discoveryApiModule.discoveryApi, 'create').mockImplementation(
      mockCreate
    );
    vi.spyOn(discoveryApiModule.discoveryApi, 'get').mockImplementation(
      mockGet
    );
    vi.spyOn(discoveryApiModule.discoveryApi, 'cancel').mockImplementation(
      mockCancel
    );
    vi.spyOn(discoveryApiModule.discoveryApi, 'addUrl').mockImplementation(
      mockAddUrl
    );
    vi.spyOn(discoveryApiModule.discoveryApi, 'addUrls').mockImplementation(
      mockAddUrls
    );
    vi.spyOn(discoveryApiModule.discoveryApi, 'removeUrl').mockImplementation(
      mockRemoveUrl
    );

    // Setup fake timers
    vi.useFakeTimers();

    // Setup mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
        clear: vi.fn(() => {
          Object.keys(mockSessionStorage).forEach(
            (key) => delete mockSessionStorage[key]
          );
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.keys(mockSessionStorage).forEach(
      (key) => delete mockSessionStorage[key]
    );
  });

  describe('Initial state', () => {
    it('should return initial state without discovery ID', () => {
      const { result } = renderHook(() => useDiscovery());

      expect(result.current.discovery).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isOperating).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.cacheMetadata).toBeNull();
      expect(result.current.selectedPageIds.size).toBe(0);
    });

    it('should load discovery when initial ID provided', async () => {
      const pages = [createMockPage('page-1', 'https://example.com/about')];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });
      const response: GetDiscoveryResponse = { discovery };

      mockGet.mockResolvedValue(response);

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.discovery).toEqual(discovery);
      expect(result.current.error).toBeNull();
      expect(mockGet).toHaveBeenCalledWith(mockDiscoveryId, false);
    });
  });

  describe('Create discovery', () => {
    it('should create a new discovery', async () => {
      const discovery = createMockDiscovery({ status: 'PENDING' });
      const response: CreateDiscoveryResponse = { discovery };

      mockCreate.mockResolvedValue(response);

      const { result } = renderHook(() => useDiscovery());

      await act(async () => {
        await result.current.createDiscovery({ homepageUrl: mockHomepageUrl });
      });

      expect(result.current.discovery).toEqual({ ...discovery, pages: [] });
      expect(result.current.error).toBeNull();
      expect(mockCreate).toHaveBeenCalledWith({ homepageUrl: mockHomepageUrl });
    });

    it('should handle create discovery error', async () => {
      const errorMessage = 'URL validation failed';
      mockCreate.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useDiscovery());

      await expect(
        act(async () => {
          await result.current.createDiscovery({ homepageUrl: 'invalid' });
        })
      ).rejects.toThrow(errorMessage);

      expect(result.current.discovery).toBeNull();
      expect(result.current.error).toBe(errorMessage);
    });

    it('should clear previous selection on new discovery', async () => {
      const discovery = createMockDiscovery({ status: 'PENDING' });
      const response: CreateDiscoveryResponse = { discovery };

      mockCreate.mockResolvedValue(response);

      const { result } = renderHook(() => useDiscovery());

      // Set some initial selection
      act(() => {
        result.current.setSelectedPageIds(new Set(['page-1', 'page-2']));
      });

      expect(result.current.selectedPageIds.size).toBe(2);

      await act(async () => {
        await result.current.createDiscovery({ homepageUrl: mockHomepageUrl });
      });

      expect(result.current.selectedPageIds.size).toBe(0);
    });
  });

  describe('Polling behavior', () => {
    it('should start polling when discovery is PENDING', async () => {
      const discovery = createMockDiscoveryWithPages([], { status: 'PENDING' });
      const response: GetDiscoveryResponse = { discovery };

      mockGet.mockResolvedValue(response);

      const { result } = renderHook(() =>
        useDiscovery(mockDiscoveryId, { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(2);
      });
    });

    it('should start polling when discovery is RUNNING', async () => {
      const discovery = createMockDiscoveryWithPages([], { status: 'RUNNING' });
      const response: GetDiscoveryResponse = { discovery };

      mockGet.mockResolvedValue(response);

      const { result } = renderHook(() =>
        useDiscovery(mockDiscoveryId, { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(2);
      });
    });

    it('should stop polling when discovery COMPLETED', async () => {
      const discovery = createMockDiscoveryWithPages([], {
        status: 'COMPLETED',
      });
      const response: GetDiscoveryResponse = { discovery };

      mockGet.mockResolvedValue(response);

      const { result } = renderHook(() =>
        useDiscovery(mockDiscoveryId, { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds - should NOT poll
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should stop polling when discovery FAILED', async () => {
      const discovery = createMockDiscoveryWithPages([], { status: 'FAILED' });
      const response: GetDiscoveryResponse = { discovery };

      mockGet.mockResolvedValue(response);

      const { result } = renderHook(() =>
        useDiscovery(mockDiscoveryId, { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);

      // Advance time - should NOT poll
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should stop polling when discovery CANCELLED', async () => {
      const discovery = createMockDiscoveryWithPages([], {
        status: 'CANCELLED',
      });
      const response: GetDiscoveryResponse = { discovery };

      mockGet.mockResolvedValue(response);

      const { result } = renderHook(() =>
        useDiscovery(mockDiscoveryId, { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);

      // Advance time - should NOT poll
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should call onComplete callback when discovery completes', async () => {
      const discovery = createMockDiscoveryWithPages([], {
        status: 'COMPLETED',
      });
      const response: GetDiscoveryResponse = { discovery };
      const onComplete = vi.fn();

      mockGet.mockResolvedValue(response);

      renderHook(() => useDiscovery(mockDiscoveryId, { onComplete }));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(discovery);
      });
    });

    it('should call onError callback when discovery fails', async () => {
      const discovery = createMockDiscoveryWithPages([], {
        status: 'FAILED',
        errorMessage: 'Discovery failed',
      });
      const response: GetDiscoveryResponse = { discovery };
      const onError = vi.fn();

      mockGet.mockResolvedValue(response);

      renderHook(() => useDiscovery(mockDiscoveryId, { onError }));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Discovery failed');
      });
    });

    it('should call onStatusChange when status changes', async () => {
      const pendingDiscovery = createMockDiscoveryWithPages([], {
        status: 'PENDING',
      });
      const runningDiscovery = createMockDiscoveryWithPages([], {
        status: 'RUNNING',
      });
      const onStatusChange = vi.fn();

      mockGet
        .mockResolvedValueOnce({ discovery: pendingDiscovery })
        .mockResolvedValueOnce({ discovery: runningDiscovery });

      const { result } = renderHook(() =>
        useDiscovery(mockDiscoveryId, {
          pollInterval: 2000,
          onStatusChange,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(onStatusChange).toHaveBeenCalledWith('PENDING');

      // Advance time to trigger poll
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith('RUNNING');
      });
    });
  });

  describe('Manual URL operations', () => {
    it('should add a single manual URL', async () => {
      const pages = [createMockPage('page-1', 'https://example.com/about')];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });
      const newPage = createMockPage(
        'page-2',
        'https://example.com/contact',
        { source: 'MANUAL' }
      );
      const addResponse: AddUrlResponse = {
        success: true,
        page: newPage,
        message: 'URL added',
      };

      mockGet.mockResolvedValue({ discovery });
      mockAddUrl.mockResolvedValue(addResponse);

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.addManualUrl('https://example.com/contact');
      });

      expect(result.current.discovery?.pages).toHaveLength(2);
      expect(result.current.discovery?.pages[1]).toEqual(newPage);
      expect(mockAddUrl).toHaveBeenCalledWith(mockDiscoveryId, {
        url: 'https://example.com/contact',
      });
    });

    it('should handle add URL failure', async () => {
      const pages = [createMockPage('page-1', 'https://example.com/about')];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      mockGet.mockResolvedValue({ discovery });
      mockAddUrl.mockRejectedValue(new Error('Domain mismatch'));

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.addManualUrl('https://other.com/page');
        })
      ).rejects.toThrow('Domain mismatch');

      expect(result.current.error).toBe('Domain mismatch');
      // Pages should remain unchanged
      expect(result.current.discovery?.pages).toHaveLength(1);
    });

    it('should add multiple URLs', async () => {
      const discovery = createMockDiscoveryWithPages([], {
        status: 'COMPLETED',
      });
      const newPages = [
        createMockPage('page-1', 'https://example.com/about', {
          source: 'MANUAL',
        }),
        createMockPage('page-2', 'https://example.com/contact', {
          source: 'MANUAL',
        }),
      ];
      const addResponse: AddUrlsResponse = {
        results: [
          { url: 'https://example.com/about', success: true, page: newPages[0] },
          {
            url: 'https://example.com/contact',
            success: true,
            page: newPages[1],
          },
        ],
        successCount: 2,
        failureCount: 0,
      };

      mockGet.mockResolvedValue({ discovery });
      mockAddUrls.mockResolvedValue(addResponse);

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.addManualUrls([
          'https://example.com/about',
          'https://example.com/contact',
        ]);
      });

      expect(result.current.discovery?.pages).toHaveLength(2);
      expect(mockAddUrls).toHaveBeenCalledWith(mockDiscoveryId, {
        urls: ['https://example.com/about', 'https://example.com/contact'],
      });
    });

    it('should remove a manual URL', async () => {
      const pages = [
        createMockPage('page-1', 'https://example.com/about'),
        createMockPage('page-2', 'https://example.com/contact', {
          source: 'MANUAL',
        }),
      ];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });
      const removeResponse: RemoveUrlResponse = {
        success: true,
        message: 'URL removed',
      };

      mockGet.mockResolvedValue({ discovery });
      mockRemoveUrl.mockResolvedValue(removeResponse);

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Select the page first
      act(() => {
        result.current.togglePageSelection('page-2');
      });

      expect(result.current.selectedPageIds.has('page-2')).toBe(true);

      await act(async () => {
        await result.current.removeManualUrl('page-2');
      });

      expect(result.current.discovery?.pages).toHaveLength(1);
      expect(result.current.discovery?.pages[0].id).toBe('page-1');
      // Should also be removed from selection
      expect(result.current.selectedPageIds.has('page-2')).toBe(false);
      expect(mockRemoveUrl).toHaveBeenCalledWith(mockDiscoveryId, 'page-2');
    });
  });

  describe('Selection management', () => {
    it('should toggle page selection', async () => {
      const pages = [createMockPage('page-1', 'https://example.com/about')];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedPageIds.has('page-1')).toBe(false);

      act(() => {
        result.current.togglePageSelection('page-1');
      });

      expect(result.current.selectedPageIds.has('page-1')).toBe(true);

      act(() => {
        result.current.togglePageSelection('page-1');
      });

      expect(result.current.selectedPageIds.has('page-1')).toBe(false);
    });

    it('should select all pages', async () => {
      const pages = [
        createMockPage('page-1', 'https://example.com/about'),
        createMockPage('page-2', 'https://example.com/contact'),
        createMockPage('page-3', 'https://example.com/products'),
      ];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.selectAllPages();
      });

      expect(result.current.selectedPageIds.size).toBe(3);
      expect(result.current.selectedPageIds.has('page-1')).toBe(true);
      expect(result.current.selectedPageIds.has('page-2')).toBe(true);
      expect(result.current.selectedPageIds.has('page-3')).toBe(true);
    });

    it('should deselect all pages', async () => {
      const pages = [
        createMockPage('page-1', 'https://example.com/about'),
        createMockPage('page-2', 'https://example.com/contact'),
      ];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.selectAllPages();
      });

      expect(result.current.selectedPageIds.size).toBe(2);

      act(() => {
        result.current.deselectAllPages();
      });

      expect(result.current.selectedPageIds.size).toBe(0);
    });
  });

  describe('Session persistence', () => {
    it('should persist selection to sessionStorage', async () => {
      const pages = [createMockPage('page-1', 'https://example.com/about')];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.togglePageSelection('page-1');
      });

      // Check sessionStorage was called
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        `discovery:selection:${mockDiscoveryId}`,
        JSON.stringify(['page-1'])
      );
    });

    it('should load persisted selection on mount', async () => {
      const pages = [
        createMockPage('page-1', 'https://example.com/about'),
        createMockPage('page-2', 'https://example.com/contact'),
      ];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      // Pre-populate sessionStorage
      mockSessionStorage[`discovery:selection:${mockDiscoveryId}`] =
        JSON.stringify(['page-1', 'page-2']);

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.selectedPageIds.size).toBe(2);
      expect(result.current.selectedPageIds.has('page-1')).toBe(true);
      expect(result.current.selectedPageIds.has('page-2')).toBe(true);
    });

    it('should filter out invalid page IDs from persisted selection', async () => {
      const pages = [createMockPage('page-1', 'https://example.com/about')];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      // Pre-populate sessionStorage with an invalid ID
      mockSessionStorage[`discovery:selection:${mockDiscoveryId}`] =
        JSON.stringify(['page-1', 'invalid-page']);

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only have valid page ID
      expect(result.current.selectedPageIds.size).toBe(1);
      expect(result.current.selectedPageIds.has('page-1')).toBe(true);
      expect(result.current.selectedPageIds.has('invalid-page')).toBe(false);
    });
  });

  describe('Cancel discovery', () => {
    it('should cancel a running discovery', async () => {
      const discovery = createMockDiscoveryWithPages([], { status: 'RUNNING' });
      const cancelledDiscovery = createMockDiscovery({ status: 'CANCELLED' });
      const cancelResponse: CancelDiscoveryResponse = {
        discovery: cancelledDiscovery,
      };

      mockGet.mockResolvedValue({ discovery });
      mockCancel.mockResolvedValue(cancelResponse);

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.cancelDiscovery();
      });

      expect(result.current.discovery?.status).toBe('CANCELLED');
      expect(mockCancel).toHaveBeenCalledWith(mockDiscoveryId);
    });

    it('should throw error if no discovery to cancel', async () => {
      const { result } = renderHook(() => useDiscovery());

      await expect(
        act(async () => {
          await result.current.cancelDiscovery();
        })
      ).rejects.toThrow('No discovery to cancel');
    });
  });

  describe('Reset', () => {
    it('should reset all state', async () => {
      const pages = [createMockPage('page-1', 'https://example.com/about')];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Select a page
      act(() => {
        result.current.togglePageSelection('page-1');
      });

      expect(result.current.discovery).not.toBeNull();
      expect(result.current.selectedPageIds.size).toBe(1);

      act(() => {
        result.current.reset();
      });

      expect(result.current.discovery).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.selectedPageIds.size).toBe(0);
    });

    it('should clear persisted selection on reset', async () => {
      const pages = [createMockPage('page-1', 'https://example.com/about')];
      const discovery = createMockDiscoveryWithPages(pages, {
        status: 'COMPLETED',
      });

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.reset();
      });

      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith(
        `discovery:selection:${mockDiscoveryId}`
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup interval on unmount', async () => {
      const discovery = createMockDiscoveryWithPages([], { status: 'RUNNING' });

      mockGet.mockResolvedValue({ discovery });

      const { result, unmount } = renderHook(() =>
        useDiscovery(mockDiscoveryId, { pollInterval: 2000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);

      unmount();

      // Advance time - should NOT poll after unmount
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache metadata', () => {
    it('should include cache metadata when present', async () => {
      const discovery = createMockDiscoveryWithPages([], {
        status: 'COMPLETED',
      });
      const cacheMetadata = {
        cachedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-02T00:00:00Z',
        pageCount: 5,
      };

      mockGet.mockResolvedValue({ discovery, cacheMetadata });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.cacheMetadata).toEqual(cacheMetadata);
    });

    it('should refresh cache when refresh flag is true', async () => {
      const discovery = createMockDiscoveryWithPages([], {
        status: 'COMPLETED',
      });

      mockGet.mockResolvedValue({ discovery });

      const { result } = renderHook(() => useDiscovery(mockDiscoveryId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGet).toHaveBeenLastCalledWith(mockDiscoveryId, true);
    });
  });
});
