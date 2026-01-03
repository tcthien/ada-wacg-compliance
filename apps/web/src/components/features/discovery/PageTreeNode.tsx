'use client';

import { useId, forwardRef, useState, useRef, useCallback } from 'react';
import type { PageSource } from '@/lib/discovery-api';
import { CopyButton } from '@/components/ui/copy-button';

/** Indentation per level - responsive: mobile 16px, desktop 24px */
const INDENT_MOBILE = 16;
const INDENT_DESKTOP = 24;

/** Swipe threshold in pixels to trigger selection change */
const SWIPE_THRESHOLD = 50;

/** Maximum vertical movement allowed during swipe */
const MAX_VERTICAL_MOVEMENT = 30;

/**
 * Props for PageTreeNode component
 */
export interface PageTreeNodeProps {
  /** Unique node identifier */
  nodeId: string;
  /** Page URL */
  url: string;
  /** Page title */
  title: string | null;
  /** How the page was discovered */
  source: PageSource;
  /** Tree depth level (0 = root) */
  depth: number;
  /** Whether this node is selected */
  isSelected: boolean;
  /** Whether this node has children */
  hasChildren: boolean;
  /** Whether this node is expanded */
  isExpanded: boolean;
  /** Whether selection is indeterminate (partial children selection) */
  isIndeterminate: boolean;
  /** Whether this node is focused */
  isFocused: boolean;
  /** Callback when checkbox is toggled */
  onToggleSelect: () => void;
  /** Callback when expand/collapse is toggled */
  onToggleExpand: () => void;
  /** Callback when node is clicked (for focus) */
  onClick: () => void;
  /** Whether interactions are disabled */
  disabled?: boolean;
  /** Tab index for roving tabindex pattern */
  tabIndex?: number;
  /** Whether viewing on mobile viewport */
  isMobile?: boolean;
}

/**
 * Source badge configuration
 */
interface SourceBadgeConfig {
  label: string;
  bgColor: string;
  textColor: string;
}

/**
 * Source badge configurations
 */
const SOURCE_BADGES: Record<PageSource, SourceBadgeConfig> = {
  SITEMAP: {
    label: 'Sitemap',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
  NAVIGATION: {
    label: 'Nav',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
  },
  CRAWLED: {
    label: 'Crawled',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
  },
  MANUAL: {
    label: 'Manual',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
  },
};

/**
 * Get display label for a URL
 */
function getDisplayLabel(url: string, title: string | null): string {
  if (title) {
    return title;
  }

  try {
    const parsed = new URL(url);
    // Return path without leading slash, or hostname if just root
    const path = parsed.pathname === '/' ? parsed.hostname : parsed.pathname.replace(/^\//, '');
    return path || url;
  } catch {
    return url;
  }
}

/**
 * PageTreeNode component
 *
 * Renders a single tree node with checkbox, expand/collapse arrow, label,
 * and source badge. Implements ARIA treeitem pattern for accessibility.
 *
 * @example
 * ```tsx
 * <PageTreeNode
 *   nodeId="page-1"
 *   url="https://example.com/about"
 *   title="About Us"
 *   source="SITEMAP"
 *   depth={1}
 *   isSelected={true}
 *   hasChildren={false}
 *   isExpanded={false}
 *   isIndeterminate={false}
 *   isFocused={false}
 *   onToggleSelect={() => {}}
 *   onToggleExpand={() => {}}
 *   onClick={() => {}}
 * />
 * ```
 */
export const PageTreeNode = forwardRef<HTMLDivElement, PageTreeNodeProps>(
  function PageTreeNode(
    {
      nodeId,
      url,
      title,
      source,
      depth,
      isSelected,
      hasChildren,
      isExpanded,
      isIndeterminate,
      isFocused,
      onToggleSelect,
      onToggleExpand,
      onClick,
      disabled = false,
      tabIndex = -1,
      isMobile = false,
    },
    ref
  ) {
    const checkboxId = useId();
    const labelId = useId();

    const badge = SOURCE_BADGES[source];
    const displayLabel = getDisplayLabel(url, title);
    // Responsive indentation: 16px on mobile, 24px on desktop
    const indentPx = depth * (isMobile ? INDENT_MOBILE : INDENT_DESKTOP);

    // Touch-friendly sizes: 44x44px minimum on mobile
    const touchTargetClass = isMobile ? 'min-h-[44px]' : '';
    const buttonSizeClass = isMobile ? 'w-11 h-11' : 'w-5 h-5';
    const checkboxSizeClass = isMobile ? 'h-5 w-5' : 'h-4 w-4';
    const spacingClass = isMobile ? 'gap-3' : 'gap-2';

    // Swipe gesture state (mobile only)
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwipeActive, setIsSwipeActive] = useState(false);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    // Handle touch start
    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (!isMobile || disabled) return;
        const touch = e.touches[0];
        if (!touch) return;
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        setIsSwipeActive(true);
      },
      [isMobile, disabled]
    );

    // Handle touch move
    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (!isMobile || !touchStartRef.current || disabled) return;

        const touch = e.touches[0];
        if (!touch) return;
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

        // Cancel swipe if vertical movement is too large (user is scrolling)
        if (deltaY > MAX_VERTICAL_MOVEMENT) {
          touchStartRef.current = null;
          setSwipeOffset(0);
          setIsSwipeActive(false);
          return;
        }

        // Limit swipe distance and add resistance at edges
        const maxOffset = SWIPE_THRESHOLD * 1.5;
        const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX));
        setSwipeOffset(clampedOffset);
      },
      [isMobile, disabled]
    );

    // Handle touch end
    const handleTouchEnd = useCallback(() => {
      if (!isMobile || disabled) {
        setSwipeOffset(0);
        setIsSwipeActive(false);
        return;
      }

      // Check if swipe exceeded threshold
      if (Math.abs(swipeOffset) >= SWIPE_THRESHOLD) {
        if (swipeOffset > 0 && !isSelected) {
          // Swipe right = select
          onToggleSelect();
        } else if (swipeOffset < 0 && isSelected) {
          // Swipe left = deselect
          onToggleSelect();
        }
      }

      // Reset swipe state
      touchStartRef.current = null;
      setSwipeOffset(0);
      setIsSwipeActive(false);
    }, [isMobile, disabled, swipeOffset, isSelected, onToggleSelect]);

    // Swipe visual feedback
    const getSwipeStyle = (): React.CSSProperties => {
      if (!isMobile || !isSwipeActive || swipeOffset === 0) return {};

      return {
        transform: `translateX(${swipeOffset * 0.3}px)`,
        transition: isSwipeActive ? 'none' : 'transform 0.2s ease-out',
      };
    };

    const getSwipeFeedbackClass = (): string => {
      if (!isMobile || !isSwipeActive) return '';

      if (swipeOffset >= SWIPE_THRESHOLD && !isSelected) {
        return 'bg-green-50 border-l-4 border-green-500';
      } else if (swipeOffset <= -SWIPE_THRESHOLD && isSelected) {
        return 'bg-red-50 border-l-4 border-red-500';
      }
      return '';
    };

    return (
      <div
        ref={ref}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={depth + 1}
        aria-labelledby={labelId}
        tabIndex={tabIndex}
        onClick={onClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`
          group flex items-center py-2 px-3 rounded-md cursor-pointer
          transition-colors duration-150
          ${touchTargetClass}
          ${isFocused ? 'bg-blue-50 ring-2 ring-blue-500 ring-inset' : 'hover:bg-gray-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${getSwipeFeedbackClass()}
        `}
        style={{
          paddingLeft: `${12 + indentPx}px`,
          ...getSwipeStyle(),
        }}
      >
        {/* Expand/Collapse button - touch-friendly on mobile */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) {
              onToggleExpand();
            }
          }}
          disabled={disabled || !hasChildren}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          aria-hidden={!hasChildren}
          className={`
            flex-shrink-0 ${buttonSizeClass}
            flex items-center justify-center
            rounded transition-colors
            ${isMobile ? 'mr-1' : 'mr-2'}
            ${hasChildren ? 'hover:bg-gray-200 active:bg-gray-300' : 'invisible'}
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
          tabIndex={-1}
        >
          <svg
            className={`
              ${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-gray-500
              transition-transform duration-200
              ${isExpanded ? 'rotate-90' : ''}
            `}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Checkbox - touch-friendly wrapper with larger hit area on mobile */}
        <label
          htmlFor={checkboxId}
          className={`
            flex-shrink-0 flex items-center justify-center
            ${isMobile ? 'min-w-[44px] min-h-[44px] -my-2' : 'mr-3'}
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            id={checkboxId}
            checked={isSelected}
            ref={(el) => {
              if (el) {
                el.indeterminate = isIndeterminate;
              }
            }}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            disabled={disabled}
            aria-labelledby={labelId}
            className={`
              ${checkboxSizeClass} rounded border-gray-300
              text-blue-600 focus:ring-blue-500
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
            tabIndex={-1}
          />
        </label>

        {/* Label - slightly larger text on mobile */}
        <span
          id={labelId}
          className={`
            flex-1 min-w-0 truncate text-gray-900
            ${isMobile ? 'text-base' : 'text-sm'}
          `}
          title={url}
        >
          {displayLabel}
        </span>

        {/* Copy URL button - icon-only variant */}
        <div onClick={(e) => e.stopPropagation()}>
          <CopyButton
            text={url}
            variant="icon"
            size="sm"
            className={`
              flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100
              transition-opacity
              ${isMobile ? 'opacity-100' : ''}
            `}
            aria-label={`Copy URL: ${url}`}
          />
        </div>

        {/* Source badge - responsive sizing */}
        <span
          className={`
            ml-2 flex-shrink-0
            inline-flex items-center rounded
            ${isMobile ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs'}
            font-medium
            ${badge.bgColor} ${badge.textColor}
          `}
        >
          {badge.label}
        </span>
      </div>
    );
  }
);
