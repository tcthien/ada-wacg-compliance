/**
 * Discovery Feature Components
 *
 * Export all discovery-related components for clean imports.
 *
 * @example
 * ```tsx
 * import {
 *   DiscoveryModeSelector,
 *   DiscoveryProgress,
 *   DiscoveryResults,
 *   PageTree,
 * } from '@/components/features/discovery';
 * ```
 */

// Core components
export { DiscoveryModeSelector } from './DiscoveryModeSelector';
export type { DiscoveryModeSelectorProps } from './DiscoveryModeSelector';

export { DiscoveryProgress } from './DiscoveryProgress';
export type { DiscoveryProgressProps } from './DiscoveryProgress';

export { CachedResultsPrompt } from './CachedResultsPrompt';
export type { CachedResultsPromptProps } from './CachedResultsPrompt';

export { ManualUrlEntry } from './ManualUrlEntry';
export type { ManualUrlEntryProps } from './ManualUrlEntry';

// Tree components
export { PageTreeNode } from './PageTreeNode';
export type { PageTreeNodeProps } from './PageTreeNode';

export { PageTree } from './PageTree';
export type { PageTreeProps, TreeNode } from './PageTree';

// Results container
export { DiscoveryResults } from './DiscoveryResults';
export type { DiscoveryResultsProps } from './DiscoveryResults';

// URL Selection
export { UrlSelectionList } from './UrlSelectionList';
export type { UrlSelectionListProps, ParsedUrl } from './UrlSelectionList';

export { SelectAllControls } from './SelectAllControls';

// Discovery Flow V2 Step Containers
export { Step1InputUrls } from './Step1InputUrls';
export type { Step1InputUrlsProps } from './Step1InputUrls';

export { Step2SelectUrls } from './Step2SelectUrls';

export { PreviewTable } from './PreviewTable';
export type { PreviewTableProps } from './PreviewTable';

export { Step3Preview } from './Step3Preview';
export type { Step3PreviewProps } from './Step3Preview';

// Utilities
export {
  AVG_SCAN_TIME_PER_PAGE,
  PARALLEL_FACTOR,
  LARGE_SCAN_THRESHOLD,
  calculateEstimatedTime,
  formatEstimatedTime,
  isLargeScan,
  extractDomain,
  getUrlPath,
  truncateUrlPath,
  getSelectionSummary,
  isAllSelected,
  isNoneSelected,
  isSomeSelected,
} from './utils';
