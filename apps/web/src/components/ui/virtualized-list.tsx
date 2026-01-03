'use client';

import * as React from 'react';
import { List, type RowComponentProps } from 'react-window';
import { cn } from '@/lib/utils';

export interface VirtualizedListProps<T = any> {
  /**
   * Total number of items in the list
   */
  itemCount: number;

  /**
   * Height of each item in pixels
   */
  itemSize: number;

  /**
   * Function to render each item
   * @param index - The index of the item
   * @param style - Style object to apply (required for positioning)
   * @param data - Optional data passed to each item
   */
  renderItem: (props: { index: number; style: React.CSSProperties; data?: T[] }) => React.ReactNode;

  /**
   * Height of the virtualized list container
   * @default 400
   */
  height?: number;

  /**
   * Width of the virtualized list container
   * @default '100%'
   */
  width?: number | string;

  /**
   * Optional data to pass to each item
   */
  itemData?: T[];

  /**
   * Additional CSS class names
   */
  className?: string;

  /**
   * Overscan count for smoother scrolling
   * @default 5
   */
  overscanCount?: number;

  /**
   * ARIA label for accessibility
   */
  'aria-label'?: string;
}

/**
 * VirtualizedList - A performant list component that only renders visible items
 *
 * Uses react-window's FixedSizeList for efficient rendering of large lists.
 * Includes SSR fallback to render all items on server-side.
 *
 * @example
 * ```tsx
 * <VirtualizedList
 *   itemCount={1000}
 *   itemSize={50}
 *   height={400}
 *   renderItem={({ index, style }) => (
 *     <div style={style}>Item {index}</div>
 *   )}
 * />
 * ```
 */
export function VirtualizedList<T = any>({
  itemCount,
  itemSize,
  renderItem,
  height = 400,
  width = '100%',
  itemData,
  className,
  overscanCount = 5,
  'aria-label': ariaLabel,
}: VirtualizedListProps<T>) {
  const [isClient, setIsClient] = React.useState(false);

  // Detect client-side rendering
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // SSR fallback: render all items without virtualization
  if (!isClient) {
    return (
      <div
        className={cn('overflow-auto', className)}
        style={{ height, width }}
        role="list"
        aria-label={ariaLabel}
      >
        {Array.from({ length: itemCount }, (_, index) => {
          const props: { index: number; style: React.CSSProperties; data?: T[] } = {
            index,
            style: { height: itemSize },
          };
          if (itemData !== undefined) {
            props.data = itemData;
          }
          return (
            <div key={index}>
              {renderItem(props)}
            </div>
          );
        })}
      </div>
    );
  }

  // Wrapper component for react-window
  // The rowProps are spread into the component, so we need to match the structure
  type RowProps = { items?: T[] };
  const RowRenderer = ({ index, style, items }: RowComponentProps<RowProps>) => {
    const props: { index: number; style: React.CSSProperties; data?: T[] } = {
      index,
      style: { height: itemSize },
    };
    if (items !== undefined) {
      props.data = items;
    }
    return (
      <div style={style}>
        {renderItem(props)}
      </div>
    );
  };

  // Conditionally construct rowProps to satisfy exactOptionalPropertyTypes
  const rowProps: RowProps = {};
  if (itemData !== undefined) {
    rowProps.items = itemData;
  }

  return (
    <List
      className={cn('scrollbar-thin', className)}
      defaultHeight={height}
      rowCount={itemCount}
      rowHeight={itemSize}
      rowProps={rowProps}
      rowComponent={RowRenderer}
      overscanCount={overscanCount}
      style={{ width }}
    />
  );
}

VirtualizedList.displayName = 'VirtualizedList';
