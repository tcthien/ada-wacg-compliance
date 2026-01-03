'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, X, Layers, Loader2 } from 'lucide-react';
import { adminApi, type AdminBatchSummary } from '@/lib/admin-api';

/**
 * Search result type
 */
interface SearchResult {
  batches: AdminBatchSummary[];
}

/**
 * Get batch status badge styling
 */
function getStatusStyle(status: string) {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'RUNNING':
      return 'bg-blue-100 text-blue-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800';
    case 'STALE':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Format date to relative time
 */
function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * AdminSearch component
 *
 * This component:
 * - Provides a search input for searching batches
 * - Searches by: ID (exact match), homepage URL (partial), session ID (exact)
 * - Displays batch results in a dropdown (max 10, sorted by created desc)
 * - Links to batch detail page on result click
 * - Debounces search to prevent excessive API calls
 *
 * Requirements:
 * - REQ 6.1: Search input with text field
 * - REQ 6.2: Search batches by ID, homepage URL, session ID
 */
export function AdminSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Search for batches
   */
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Search batches using the list API with homepage URL filter
      // The API will search by homepage URL (partial match)
      // For ID/session ID exact match, we check if query looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchQuery.trim());

      let batches: AdminBatchSummary[] = [];

      if (isUUID) {
        // Try exact ID match first
        try {
          const batchDetail = await adminApi.batches.get(searchQuery.trim());
          if (batchDetail && batchDetail.batch) {
            batches = [{
              id: batchDetail.batch.id,
              homepageUrl: batchDetail.batch.homepageUrl,
              wcagLevel: batchDetail.batch.wcagLevel,
              status: batchDetail.batch.status,
              totalUrls: batchDetail.batch.totalUrls,
              completedCount: batchDetail.batch.completedCount,
              failedCount: batchDetail.batch.failedCount,
              totalIssues: batchDetail.batch.totalIssues || 0,
              criticalCount: 0,
              seriousCount: 0,
              moderateCount: 0,
              minorCount: 0,
              createdAt: batchDetail.batch.createdAt,
              completedAt: batchDetail.batch.completedAt,
              sessionId: null,
            }];
          }
        } catch {
          // Not found by ID, try session ID
          const sessionResponse = await adminApi.batches.list({
            sessionId: searchQuery.trim(),
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          });
          batches = sessionResponse.batches || [];
        }
      } else {
        // Search by homepage URL (partial match)
        const response = await adminApi.batches.list({
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        // Filter client-side for URL partial match
        batches = (response.batches || []).filter(
          (batch: AdminBatchSummary) =>
            batch.homepageUrl.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setResults({ batches: batches.slice(0, 10) });
      setIsOpen(true);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Debounced search handler
   */
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch]
  );

  /**
   * Handle form submit (immediate search)
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    performSearch(query);
  };

  /**
   * Clear search
   */
  const handleClear = () => {
    setQuery('');
    setResults(null);
    setIsOpen(false);
  };

  /**
   * Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className="relative">
      {/* Search input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => results && setIsOpen(true)}
            placeholder="Search batches by ID, URL, or session..."
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg bg-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Search batches"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              aria-label="Clear search"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </form>

      {/* Search results dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-auto">
          {error && (
            <div className="p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {results && results.batches.length === 0 && !error && (
            <div className="p-4 text-sm text-gray-500 text-center">
              No batches found for "{query}"
            </div>
          )}

          {results && results.batches.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Batches ({results.batches.length})
                </h4>
              </div>
              <ul className="divide-y divide-gray-100">
                {results.batches.map((batch) => (
                  <li key={batch.id}>
                    <Link
                      href={`/admin/batches/${batch.id}`}
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {batch.homepageUrl}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {batch.completedCount + batch.failedCount}/{batch.totalUrls} URLs • {formatRelativeTime(batch.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(batch.status)}`}
                        >
                          {batch.status}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                <Link
                  href="/admin/batches"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  View all batches →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
