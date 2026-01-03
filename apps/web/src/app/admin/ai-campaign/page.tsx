'use client';

/**
 * Admin AI Campaign Page
 *
 * Displays AI campaign dashboard with queue management:
 * - Campaign overview with metrics
 * - Token usage and quota status
 * - Pause/resume campaign controls
 * - AI queue table with export/import functionality
 *
 * Requirements: REQ-8
 */

import { AiCampaignDashboard } from '@/components/admin/AiCampaignDashboard';
import { AiQueueTable } from '@/components/admin/AiQueueTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, List } from 'lucide-react';

export default function AdminAiCampaignPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Sparkles className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Campaign</h1>
          <p className="text-sm text-muted-foreground">
            Manage AI Early Bird campaign and processing queue
          </p>
        </div>
      </div>

      {/* Tabs for Dashboard and Queue */}
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Processing Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <AiCampaignDashboard />
        </TabsContent>

        <TabsContent value="queue" className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">AI Processing Queue</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Export pending scans for offline AI processing, then import results back.
              Failed scans can be retried individually.
            </p>
            <AiQueueTable />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
