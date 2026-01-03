'use client';

/**
 * AI Campaign Dashboard Component
 *
 * Displays AI campaign overview and metrics for admin dashboard:
 * - Campaign status card (name, status, dates)
 * - Token usage progress bar (used vs remaining)
 * - Scan count metrics (completed, pending, failed)
 * - Average tokens per scan
 * - Estimated remaining scans
 *
 * Requirements: REQ-8 AC 1
 */

import { useAdminAiCampaign } from '@/hooks/useAdminAiCampaign';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Pause,
  Play,
  RefreshCw,
  Zap,
  Calculator,
} from 'lucide-react';

/**
 * Format number with commas for display
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get status badge variant based on campaign status
 */
function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'PAUSED':
      return 'secondary';
    case 'DEPLETED':
    case 'ENDED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function AiCampaignDashboard() {
  const {
    metrics,
    isLoading,
    error,
    refetch,
    pauseCampaign,
    resumeCampaign,
    isUpdating,
  } = useAdminAiCampaign();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-8 bg-white rounded-lg border">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading AI campaign data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load AI campaign data: {error}
          <Button variant="outline" size="sm" className="ml-4" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center border">
        <Sparkles className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">No Active Campaign</h3>
        <p className="text-sm text-gray-500">
          No AI campaign is currently configured. Create a campaign in the database to get started.
        </p>
      </div>
    );
  }

  const isActive = metrics.campaignStatus === 'ACTIVE';
  const percentUsed = metrics.percentUsed;
  const percentRemaining = 100 - percentUsed;

  return (
    <div className="space-y-6">
      {/* Campaign Overview Card */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">AI Early Bird Campaign</h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(metrics.startsAt)} - {formatDate(metrics.endsAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={getStatusVariant(metrics.campaignStatus)}>
              {metrics.campaignStatus}
            </Badge>
            {(isActive || metrics.campaignStatus === 'PAUSED') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => (isActive ? pauseCampaign() : resumeCampaign())}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isActive ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Token Usage Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Token Usage</span>
            <span className="font-medium">
              {formatNumber(metrics.usedTokens)} / {formatNumber(metrics.totalTokenBudget)}
            </span>
          </div>
          <Progress value={percentUsed} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{percentUsed.toFixed(1)}% used</span>
            <span>{formatNumber(metrics.remainingTokens)} remaining</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            label="Completed"
            value={metrics.completedScans}
            color="text-green-600"
          />
          <MetricCard
            icon={<Clock className="h-5 w-5 text-yellow-600" />}
            label="Pending"
            value={metrics.pendingScans}
            color="text-yellow-600"
          />
          <MetricCard
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            label="Failed"
            value={metrics.failedScans}
            color="text-red-600"
          />
          <MetricCard
            icon={<Zap className="h-5 w-5 text-blue-600" />}
            label="Reserved Slots"
            value={metrics.reservedSlots}
            color="text-blue-600"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Average Tokens Per Scan */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calculator className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-muted-foreground">Avg Tokens/Scan</span>
          </div>
          <p className="text-2xl font-bold">{formatNumber(metrics.avgTokensPerScan)}</p>
        </div>

        {/* Estimated Remaining Scans */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Sparkles className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-muted-foreground">Est. Remaining Scans</span>
          </div>
          <p className="text-2xl font-bold">{formatNumber(metrics.projectedSlotsRemaining)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {formatNumber(metrics.avgTokensPerScan)} tokens/scan avg
          </p>
        </div>

        {/* Quota Status */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`p-2 rounded-lg ${
                percentRemaining > 20
                  ? 'bg-green-100'
                  : percentRemaining > 10
                    ? 'bg-yellow-100'
                    : percentRemaining > 5
                      ? 'bg-orange-100'
                      : 'bg-red-100'
              }`}
            >
              <Zap
                className={`h-5 w-5 ${
                  percentRemaining > 20
                    ? 'text-green-600'
                    : percentRemaining > 10
                      ? 'text-yellow-600'
                      : percentRemaining > 5
                        ? 'text-orange-600'
                        : 'text-red-600'
                }`}
              />
            </div>
            <span className="text-sm text-muted-foreground">Quota Status</span>
          </div>
          <p
            className={`text-2xl font-bold ${
              percentRemaining > 20
                ? 'text-green-600'
                : percentRemaining > 10
                  ? 'text-yellow-600'
                  : percentRemaining > 5
                    ? 'text-orange-600'
                    : 'text-red-600'
            }`}
          >
            {percentRemaining.toFixed(1)}% left
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {percentRemaining > 20
              ? 'Quota healthy'
              : percentRemaining > 10
                ? 'Running low'
                : percentRemaining > 5
                  ? 'Almost depleted'
                  : 'Critical - nearing end'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{formatNumber(value)}</p>
    </div>
  );
}
