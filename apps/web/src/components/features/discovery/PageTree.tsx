'use client';

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useId,
} from 'react';
// Note: react-window temporarily disabled due to render-time state update issues
// import { List } from 'react-window';
import { PageTreeNode } from './PageTreeNode';
import type { DiscoveredPage, PageSource } from '@/lib/discovery-api';

// ============================================================================
// MOBILE DETECTION HOOK
// ============================================================================

/**
 * Hook to detect mobile viewport
 */
function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Handle changes
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return isMobile;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tree node structure
 */
export interface TreeNode {
  /** Unique node ID (page ID or generated path ID) */
  id: string;
  /** Page data (null for virtual path nodes) */
  page: DiscoveredPage | null;
  /** Display label */
  label: string;
  /** Full URL path segment */
  pathSegment: string;
  /** Child nodes */
  children: TreeNode[];
  /** Depth level */
  depth: number;
  /** Parent node ID */
  parentId: string | null;
}

/**
 * Flattened tree node for virtual list
 */
interface FlattenedNode {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isIndeterminate: boolean;
  hasChildren: boolean;
}

/**
 * Props for PageTree component
 */
export interface PageTreeProps {
  /** Discovered pages to display */
  pages: DiscoveredPage[];
  /** Set of selected page IDs */
  selectedIds: Set<string>;
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: Set<string>) => void;
  /** Height of the tree container */
  height?: number;
  /** Whether interactions are disabled */
  disabled?: boolean;
  /** Optional class name for styling */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ROW_HEIGHT = 44;
const ANNOUNCEMENT_THROTTLE_MS = 500;

/** Indentation per level - responsive: mobile 16px, desktop 24px */
export const INDENT_MOBILE = 16;
export const INDENT_DESKTOP = 24;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build tree structure from flat page list
 */
function buildTreeFromPages(pages: DiscoveredPage[]): TreeNode[] {
  const root: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  // Sort pages by URL for consistent ordering
  const sortedPages = [...pages].sort((a, b) => a.url.localeCompare(b.url));

  for (const page of sortedPages) {
    try {
      const url = new URL(page.url);
      const pathParts = url.pathname
        .split('/')
        .filter(Boolean);

      let currentLevel = root;
      let currentPath = url.origin;
      let parentId: string | null = null;
      let depth = 0;

      // Handle root page
      if (pathParts.length === 0) {
        const nodeId = page.id;
        const node: TreeNode = {
          id: nodeId,
          page,
          label: url.hostname,
          pathSegment: '/',
          children: [],
          depth: 0,
          parentId: null,
        };
        nodeMap.set(nodeId, node);

        // Check if we already have this root
        const existingIndex = currentLevel.findIndex(
          (n) => n.label === url.hostname && !n.page
        );
        if (existingIndex >= 0) {
          // Merge with existing virtual node
          currentLevel[existingIndex] = node;
          node.children = currentLevel[existingIndex].children;
        } else {
          currentLevel.push(node);
        }
        continue;
      }

      // Create intermediate path nodes and leaf node
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (!part) continue; // Skip empty parts
        currentPath = `${currentPath}/${part}`;
        depth = i + 1;
        const isLast = i === pathParts.length - 1;

        // Check if node already exists at this level
        let existingNode = currentLevel.find((n) => n.pathSegment === part);

        if (existingNode) {
          if (isLast && !existingNode.page) {
            // Replace virtual node with actual page node
            existingNode.page = page;
            existingNode.id = page.id;
            nodeMap.set(page.id, existingNode);
          }
          parentId = existingNode.id;
          currentLevel = existingNode.children;
        } else {
          // Create new node
          const nodeId = isLast ? page.id : `path:${currentPath}`;
          const newNode: TreeNode = {
            id: nodeId,
            page: isLast ? page : null,
            label: part,
            pathSegment: part,
            children: [],
            depth,
            parentId,
          };
          nodeMap.set(nodeId, newNode);
          currentLevel.push(newNode);
          parentId = nodeId;
          currentLevel = newNode.children;
        }
      }
    } catch {
      // Skip invalid URLs
      console.warn(`Invalid URL: ${page.url}`);
    }
  }

  return root;
}

/**
 * Flatten tree for virtual list rendering
 */
function flattenTree(
  nodes: TreeNode[],
  expandedIds: Set<string>,
  selectedIds: Set<string>,
  depth = 0
): FlattenedNode[] {
  const result: FlattenedNode[] = [];

  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = node.page ? selectedIds.has(node.page.id) : false;

    // Calculate indeterminate state for parent nodes
    let isIndeterminate = false;
    if (hasChildren && !isSelected) {
      const descendantPages = getAllDescendantPages(node);
      const selectedCount = descendantPages.filter((p) =>
        selectedIds.has(p.id)
      ).length;
      isIndeterminate = selectedCount > 0 && selectedCount < descendantPages.length;
    }

    result.push({
      node,
      depth,
      isExpanded,
      isSelected,
      isIndeterminate,
      hasChildren,
    });

    if (hasChildren && isExpanded) {
      result.push(
        ...flattenTree(node.children, expandedIds, selectedIds, depth + 1)
      );
    }
  }

  return result;
}

/**
 * Get all descendant pages from a node
 */
function getAllDescendantPages(node: TreeNode): DiscoveredPage[] {
  const pages: DiscoveredPage[] = [];

  function collectPages(n: TreeNode) {
    if (n.page) {
      pages.push(n.page);
    }
    for (const child of n.children) {
      collectPages(child);
    }
  }

  for (const child of node.children) {
    collectPages(child);
  }

  return pages;
}

/**
 * Get all descendant page IDs from a node
 */
function getAllDescendantPageIds(node: TreeNode): string[] {
  return getAllDescendantPages(node).map((p) => p.id);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PageTree component
 *
 * Displays discovered pages in a hierarchical tree structure with checkboxes
 * for selection. Implements ARIA tree pattern for accessibility and uses
 * virtual scrolling for performance with large page counts.
 *
 * Features:
 * - Hierarchical URL-based tree structure
 * - Checkbox selection with parent/child propagation
 * - Keyboard navigation (arrow keys, Enter, Space)
 * - Virtual scrolling with react-window
 * - ARIA live announcements for screen readers
 *
 * @example
 * ```tsx
 * const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 *
 * <PageTree
 *   pages={discoveredPages}
 *   selectedIds={selectedIds}
 *   onSelectionChange={setSelectedIds}
 *   height={400}
 * />
 * ```
 */
export function PageTree({
  pages,
  selectedIds,
  onSelectionChange,
  height = 400,
  disabled = false,
  className = '',
}: PageTreeProps) {
  const treeId = useId();
  // Ref for scrollable container (replaces react-window listRef)
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Mobile detection
  const isMobile = useIsMobile();

  // State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  // Refs for throttling announcements
  const lastAnnouncementRef = useRef(0);

  // Ensure pages is always an array (defensive check)
  const safePages = pages ?? [];

  // Ensure selectedIds is always a Set (defensive check)
  const safeSelectedIds = selectedIds ?? new Set<string>();

  // Build tree structure from pages
  const tree = useMemo(() => buildTreeFromPages(safePages), [safePages]);

  // Compute initial expanded IDs (root nodes) - done synchronously to avoid render-time state updates
  const initialExpandedIds = useMemo(() => {
    if (tree.length > 0) {
      return new Set(tree.map((n) => n.id));
    }
    return new Set<string>();
  }, [tree]);

  // Merge user-driven expansions with initial expansions
  const effectiveExpandedIds = useMemo(() => {
    // If user hasn't made any changes, use initial expanded state
    if (expandedIds.size === 0 && initialExpandedIds.size > 0) {
      return initialExpandedIds;
    }
    return expandedIds;
  }, [expandedIds, initialExpandedIds]);

  // Flatten tree for virtual list using effective expanded state
  const flattenedNodes = useMemo(
    () => flattenTree(tree, effectiveExpandedIds, safeSelectedIds),
    [tree, effectiveExpandedIds, safeSelectedIds]
  );

  /**
   * Announce for screen readers (throttled)
   */
  const announce = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastAnnouncementRef.current > ANNOUNCEMENT_THROTTLE_MS) {
      setAnnouncement(message);
      lastAnnouncementRef.current = now;
    }
  }, []);

  /**
   * Toggle node expansion
   */
  const toggleExpand = useCallback(
    (nodeId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
          announce('Collapsed');
        } else {
          next.add(nodeId);
          announce('Expanded');
        }
        return next;
      });
    },
    [announce]
  );

  /**
   * Toggle node selection
   */
  const toggleSelect = useCallback(
    (node: TreeNode) => {
      if (disabled) return;

      const newSelected = new Set(safeSelectedIds);

      if (node.page) {
        // Leaf node - toggle individual selection
        if (safeSelectedIds.has(node.page.id)) {
          newSelected.delete(node.page.id);
          announce(`${node.label} deselected`);
        } else {
          newSelected.add(node.page.id);
          announce(`${node.label} selected`);
        }
      } else {
        // Parent node - toggle all descendants
        const descendantIds = getAllDescendantPageIds(node);
        const allSelected = descendantIds.every((id) => safeSelectedIds.has(id));

        if (allSelected) {
          descendantIds.forEach((id) => newSelected.delete(id));
          announce(`${descendantIds.length} pages deselected`);
        } else {
          descendantIds.forEach((id) => newSelected.add(id));
          announce(`${descendantIds.length} pages selected`);
        }
      }

      onSelectionChange(newSelected);
    },
    [safeSelectedIds, onSelectionChange, disabled, announce]
  );

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || flattenedNodes.length === 0) return;

      const currentNode = flattenedNodes[focusedIndex];
      if (!currentNode) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (focusedIndex < flattenedNodes.length - 1) {
            setFocusedIndex(focusedIndex + 1);
            scrollContainerRef.current?.children[focusedIndex + 1]?.scrollIntoView({ block: 'nearest' });
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (focusedIndex > 0) {
            setFocusedIndex(focusedIndex - 1);
            scrollContainerRef.current?.children[focusedIndex - 1]?.scrollIntoView({ block: 'nearest' });
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (currentNode.hasChildren && !currentNode.isExpanded) {
            toggleExpand(currentNode.node.id);
          } else if (currentNode.hasChildren && currentNode.isExpanded) {
            // Move to first child
            if (focusedIndex < flattenedNodes.length - 1) {
              setFocusedIndex(focusedIndex + 1);
              scrollContainerRef.current?.children[focusedIndex + 1]?.scrollIntoView({ block: 'nearest' });
            }
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (currentNode.hasChildren && currentNode.isExpanded) {
            toggleExpand(currentNode.node.id);
          } else if (currentNode.node.parentId) {
            // Move to parent
            const parentIndex = flattenedNodes.findIndex(
              (n) => n.node.id === currentNode.node.parentId
            );
            if (parentIndex >= 0) {
              setFocusedIndex(parentIndex);
              scrollContainerRef.current?.children[parentIndex]?.scrollIntoView({ block: 'nearest' });
            }
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          toggleSelect(currentNode.node);
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          scrollContainerRef.current?.children[0]?.scrollIntoView({ block: 'nearest' });
          break;

        case 'End':
          e.preventDefault();
          setFocusedIndex(flattenedNodes.length - 1);
          scrollContainerRef.current?.children[flattenedNodes.length - 1]?.scrollIntoView({ block: 'nearest' });
          break;

        case 'a':
        case 'A':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // Select all pages
            const allIds = new Set(
              safePages.filter((p) => p.id).map((p) => p.id)
            );
            onSelectionChange(allIds);
            announce(`${allIds.size} pages selected`);
          }
          break;
      }
    },
    [
      disabled,
      flattenedNodes,
      focusedIndex,
      safePages,
      toggleExpand,
      toggleSelect,
      onSelectionChange,
      announce,
    ]
  );

  // Note: renderRow callback removed - now rendering inline without react-window

  // Empty state
  if (safePages.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-dashed border-gray-300 ${className}`}
      >
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500">No pages discovered yet</p>
        </div>
      </div>
    );
  }

  // Calculate maximum depth for horizontal scroll width
  const maxDepth = useMemo(() => {
    return flattenedNodes.reduce((max, item) => Math.max(max, item.depth), 0);
  }, [flattenedNodes]);

  // Calculate minimum width needed for deep trees (prevents content clipping)
  const minContentWidth = useMemo(() => {
    const indent = isMobile ? INDENT_MOBILE : INDENT_DESKTOP;
    // Base width (checkbox, expand button, label, badge) + indentation
    const baseWidth = 300;
    return baseWidth + maxDepth * indent;
  }, [maxDepth, isMobile]);

  return (
    <div className={`relative ${className}`}>
      {/* ARIA live region for announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Responsive container with horizontal scroll for deep nesting */}
      <div
        className={`
          w-full max-w-full
          ${isMobile ? 'overflow-x-auto -mx-4 px-4' : ''}
        `}
      >
        {/* Tree container */}
        <div
          role="tree"
          aria-label="Discovered pages"
          aria-multiselectable="true"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg bg-white border border-gray-200"
          style={{
            minWidth: isMobile && maxDepth > 3 ? `${minContentWidth}px` : undefined,
          }}
        >
          {/* Simple scrollable list (bypassing react-window virtualization issue) */}
          {flattenedNodes.length > 0 ? (
            <div
              ref={scrollContainerRef}
              style={{ height, overflowY: 'auto' }}
              className="border border-gray-100 rounded"
            >
              {flattenedNodes.map((item, index) => {
                const { node, depth, isExpanded, isSelected, isIndeterminate, hasChildren } = item;
                return (
                  <div key={node.id} style={{ height: ROW_HEIGHT }}>
                    <PageTreeNode
                      nodeId={node.id}
                      url={node.page?.url || node.pathSegment}
                      title={node.page?.title || null}
                      source={node.page?.source || 'CRAWLED'}
                      depth={depth}
                      isSelected={isSelected}
                      hasChildren={hasChildren}
                      isExpanded={isExpanded}
                      isIndeterminate={isIndeterminate}
                      isFocused={index === focusedIndex}
                      onToggleSelect={() => toggleSelect(node)}
                      onToggleExpand={() => toggleExpand(node.id)}
                      onClick={() => setFocusedIndex(index)}
                      disabled={disabled}
                      tabIndex={index === focusedIndex ? 0 : -1}
                      isMobile={isMobile}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="flex items-center justify-center text-gray-500"
              style={{ height: height || 400 }}
            >
              {safePages.length === 0 ? 'No pages to display' : 'Loading pages...'}
            </div>
          )}
        </div>
      </div>

      {/* Selection summary - responsive text */}
      <div className="mt-2 text-sm text-gray-500 sm:text-base">
        {safeSelectedIds.size} of {safePages.length} pages selected
      </div>
    </div>
  );
}
