import React from 'react';
import { EmptyState } from './empty-state';
import { FolderOpen, Search, CheckCircle, Globe } from 'lucide-react';

/**
 * Example usage of the EmptyState component with different configurations
 */

export function EmptyStateExamples() {
  return (
    <div className="space-y-12 p-8">
      {/* Example 1: Empty History */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Empty History State</h2>
        <EmptyState
          icon={<FolderOpen />}
          title="No scans yet"
          description="Start your first accessibility scan to see results here"
          action={{
            label: 'Start First Scan',
            onClick: () => console.log('Start scan clicked'),
            variant: 'primary',
          }}
        />
      </div>

      {/* Example 2: Empty Discovery */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Empty Discovery State</h2>
        <EmptyState
          icon={<Globe />}
          title="Enter a URL to discover pages"
          description="We'll crawl your website and find all pages to scan"
          action={{
            label: 'Start Discovery',
            onClick: () => console.log('Start discovery clicked'),
            variant: 'primary',
          }}
          secondaryAction={{
            label: 'Learn More',
            onClick: () => console.log('Learn more clicked'),
          }}
        />
      </div>

      {/* Example 3: No Search Results */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">No Search Results State</h2>
        <EmptyState
          icon={<Search />}
          title="No results found"
          description="Try adjusting your search terms or filters"
          action={{
            label: 'Clear Filters',
            onClick: () => console.log('Clear filters clicked'),
            variant: 'secondary',
          }}
        />
      </div>

      {/* Example 4: Success State - No Issues */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Success State - No Issues</h2>
        <EmptyState
          icon={<CheckCircle />}
          title="No issues found!"
          description="Your website passed all accessibility checks"
          action={{
            label: 'Run Another Scan',
            onClick: () => console.log('Run another scan clicked'),
            variant: 'primary',
          }}
          secondaryAction={{
            label: 'View Report',
            onClick: () => console.log('View report clicked'),
          }}
        />
      </div>

      {/* Example 5: Minimal Configuration */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Minimal Configuration</h2>
        <EmptyState
          title="No data available"
        />
      </div>

      {/* Example 6: Custom Styling */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Custom Styling</h2>
        <EmptyState
          icon={<FolderOpen className="text-blue-500" />}
          title="Custom Styled Empty State"
          description="You can apply custom classes to the icon and container"
          className="bg-blue-50 rounded-lg"
          action={{
            label: 'Take Action',
            onClick: () => console.log('Action clicked'),
            variant: 'primary',
          }}
        />
      </div>
    </div>
  );
}

export default EmptyStateExamples;
