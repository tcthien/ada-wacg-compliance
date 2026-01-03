# Improved Scan Export - Design Document

## Overview

This document details the technical design for improving the scan export functionality based on approved requirements.

**Status**: Approved
**Requirements**: [requirements.md](./requirements.md)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐ │
│  │ ScanResult   │    │ ExportButton     │    │ Admin Scan    │ │
│  │ Page         │───▶│ (updated)        │    │ Detail Page   │ │
│  └──────────────┘    └────────┬─────────┘    └───────┬───────┘ │
│                               │                       │         │
│                               ▼                       ▼         │
│                      ┌────────────────┐    ┌─────────────────┐ │
│                      │ ExportModal    │    │ AdminExport     │ │
│                      │ (new)          │    │ Button (new)    │ │
│                      └────────┬───────┘    └────────┬────────┘ │
│                               │                      │          │
│                               ▼                      ▼          │
│                      ┌─────────────────────────────────────┐   │
│                      │ useExport hook (enhanced)           │   │
│                      │ useReportStatus hook (new)          │   │
│                      └─────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                           API                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GET /api/v1/scans/:scanId/reports        → Report status        │
│  GET /api/v1/reports/:scanId/:format      → Get/generate report  │
│  GET /api/v1/admin/scans/:scanId/reports  → Admin report status  │
│  POST /api/v1/admin/reports/:scanId/:format → Admin generate     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## API Design

### 1. Report Status Endpoint (New)

**Endpoint**: `GET /api/v1/scans/:scanId/reports`

**Purpose**: Check if reports exist for a scan without triggering generation.

**Middleware**: `sessionMiddleware` (validates session ownership)

**Request**:
```
GET /api/v1/scans/550e8400-e29b-41d4-a716-446655440000/reports
```

**Response** (200 OK):
```typescript
interface ReportStatusResponse {
  success: true;
  data: {
    scanId: string;
    scanStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    reports: {
      pdf: ReportInfo | null;
      json: ReportInfo | null;
    };
  };
}

interface ReportInfo {
  exists: true;
  url: string;           // Presigned URL
  createdAt: string;     // ISO 8601
  fileSizeBytes: number;
  expiresAt: string;     // URL expiration
}
```

**Response** (when reports don't exist):
```json
{
  "success": true,
  "data": {
    "scanId": "550e8400-...",
    "scanStatus": "COMPLETED",
    "reports": {
      "pdf": null,
      "json": null
    }
  }
}
```

**Implementation Location**: `apps/api/src/modules/reports/report.controller.ts`

### 2. Admin Report Status Endpoint (New)

**Endpoint**: `GET /api/v1/admin/scans/:scanId/reports`

**Purpose**: Check report status for any scan (admin only).

**Middleware**: `adminMiddleware` (validates admin JWT)

**Response**: Same as user endpoint.

**Implementation Location**: `apps/api/src/modules/admin/admin.controller.ts`

### 3. Admin Report Generation Endpoint (New)

**Endpoint**: `POST /api/v1/admin/reports/:scanId/:format`

**Purpose**: Generate report as admin (bypasses session ownership).

**Middleware**: `adminMiddleware`

**Request**:
```
POST /api/v1/admin/reports/550e8400-.../pdf
```

**Response**: Same as existing `GET /api/v1/reports/:scanId/:format`

**Implementation Location**: `apps/api/src/modules/admin/admin.controller.ts`

## Frontend Components

### 1. ExportModal Component (New)

**Location**: `apps/web/src/components/features/export/ExportModal.tsx`

**Purpose**: Display progress during report generation.

**Props**:
```typescript
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: 'pdf' | 'json';
  status: 'generating' | 'completed' | 'error';
  errorMessage?: string;
  onRetry: () => void;
  onCancel: () => void;
}
```

**UI States**:

1. **Generating State**:
   ```
   ┌────────────────────────────────────┐
   │                                    │
   │      [Spinner Animation]           │
   │                                    │
   │    Generating PDF Report...        │
   │                                    │
   │    This may take a few moments     │
   │                                    │
   │         [ Cancel ]                 │
   │                                    │
   └────────────────────────────────────┘
   ```

2. **Completed State** (brief, auto-dismiss):
   ```
   ┌────────────────────────────────────┐
   │                                    │
   │            ✓                       │
   │                                    │
   │    Download started!               │
   │                                    │
   └────────────────────────────────────┘
   ```

3. **Error State**:
   ```
   ┌────────────────────────────────────┐
   │                                    │
   │            ✕                       │
   │                                    │
   │    Failed to generate report       │
   │    [Error message here]            │
   │                                    │
   │    [ Retry ]    [ Close ]          │
   │                                    │
   └────────────────────────────────────┘
   ```

**Accessibility**:
- Focus trap when open
- ESC key to close
- aria-modal="true"
- aria-labelledby for title

### 2. Updated ExportButton Component

**Location**: `apps/web/src/components/features/export/ExportButton.tsx`

**Changes**:
- Integrate with `useReportStatus` hook
- Show report links if reports exist
- Trigger modal for generation

**New UI**:
```
When reports exist:
┌─────────────────────────────────────┐
│  Export Report  ▼                   │
├─────────────────────────────────────┤
│  📄 PDF Report                      │
│     Ready • 245 KB • Download ↓     │
│─────────────────────────────────────│
│  📋 JSON Data                       │
│     Ready • 128 KB • Download ↓     │
└─────────────────────────────────────┘

When reports don't exist:
┌─────────────────────────────────────┐
│  Export Report  ▼                   │
├─────────────────────────────────────┤
│  📄 PDF Report                      │
│     Generate formatted document     │
│─────────────────────────────────────│
│  📋 JSON Data                       │
│     Generate raw scan data          │
└─────────────────────────────────────┘
```

### 3. AdminExportButton Component (New)

**Location**: `apps/web/src/components/admin/AdminExportButton.tsx`

**Purpose**: Export button for admin scan detail page.

**Props**:
```typescript
interface AdminExportButtonProps {
  scanId: string;
  scanStatus: ScanStatus;
}
```

**Behavior**:
- Uses admin API endpoints
- Same modal UX as user export
- Disabled if scan not completed

### 4. useReportStatus Hook (New)

**Location**: `apps/web/src/hooks/useReportStatus.ts`

**Purpose**: Fetch and cache report status for a scan.

**Interface**:
```typescript
interface UseReportStatusOptions {
  enabled?: boolean;  // Only fetch when true
}

interface ReportStatus {
  pdf: ReportInfo | null;
  json: ReportInfo | null;
}

interface UseReportStatusReturn {
  status: ReportStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useReportStatus(
  scanId: string,
  options?: UseReportStatusOptions
): UseReportStatusReturn;
```

**Implementation**:
```typescript
export function useReportStatus(
  scanId: string,
  options: UseReportStatusOptions = {}
): UseReportStatusReturn {
  const { enabled = true } = options;
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.scans.getReportStatus(scanId);
      setStatus(response.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  }, [scanId, enabled]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, isLoading, error, refetch: fetchStatus };
}
```

### 5. Enhanced useExport Hook

**Location**: `apps/web/src/hooks/useExport.ts`

**Changes**:
- Add `onProgress` callback for modal updates
- Return more granular status for UI

**Updated Interface**:
```typescript
interface ExportState {
  status: 'idle' | 'generating' | 'completed' | 'error';
  format: 'pdf' | 'json' | null;
  error: string | null;
}

interface UseExportReturn {
  exportReport: (scanId: string, format: 'pdf' | 'json') => Promise<boolean>;
  state: ExportState;
  cancel: () => void;
  reset: () => void;  // Reset to idle state
}
```

## Data Flow

### User Export Flow

```
1. User lands on scan result page
   │
   ├─▶ useReportStatus(scanId) fetches report status
   │
   ├─▶ If reports exist:
   │     └─▶ ExportButton shows "Download" links
   │         └─▶ Click triggers direct download (blob fetch)
   │
   └─▶ If reports don't exist:
         └─▶ ExportButton shows "Generate" options
             └─▶ Click triggers:
                 ├─▶ ExportModal opens (generating state)
                 ├─▶ useExport.exportReport() called
                 ├─▶ Polls until complete
                 ├─▶ ExportModal shows success
                 ├─▶ Auto-download triggered
                 ├─▶ useReportStatus.refetch()
                 └─▶ Modal closes
```

### Admin Export Flow

```
1. Admin views scan detail page
   │
   ├─▶ useAdminReportStatus(scanId) fetches status
   │
   └─▶ AdminExportButton shows based on status
       │
       └─▶ Click triggers:
           ├─▶ ExportModal opens
           ├─▶ useAdminExport.exportReport() (uses admin endpoint)
           ├─▶ Same polling/download flow
           └─▶ Modal closes
```

## API Client Updates

**Location**: `apps/web/src/lib/api.ts`

**New Methods**:
```typescript
export const api = {
  scans: {
    // ... existing methods
    getReportStatus: (scanId: string) =>
      apiClient<ReportStatusResponse>(`/api/v1/scans/${scanId}/reports`),
  },
  // ... existing
};
```

**Location**: `apps/web/src/lib/admin-api.ts`

**New Methods**:
```typescript
export const adminApi = {
  // ... existing methods
  reports: {
    getStatus: (scanId: string) =>
      adminApiClient<ReportStatusResponse>(`/api/v1/admin/scans/${scanId}/reports`),
    generate: (scanId: string, format: 'pdf' | 'json') =>
      adminApiClient<ReportResponse>(`/api/v1/admin/reports/${scanId}/${format}`, {
        method: 'POST',
      }),
  },
};
```

## Backend Implementation

### Report Status Service

**Location**: `apps/api/src/modules/reports/report.service.ts`

**New Function**:
```typescript
export interface ReportStatusResult {
  scanId: string;
  scanStatus: ScanStatus;
  reports: {
    pdf: ReportInfo | null;
    json: ReportInfo | null;
  };
}

export async function getReportStatus(
  scanId: string,
  sessionId?: string  // Optional for admin
): Promise<ReportStatusResult> {
  const prisma = getPrismaClient();

  // Get scan with reports
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      reports: {
        select: {
          format: true,
          storageKey: true,
          fileSizeBytes: true,
          createdAt: true,
          expiresAt: true,
        },
      },
    },
  });

  if (!scan) {
    throw new ReportServiceError('Scan not found', 'NOT_FOUND');
  }

  // Validate ownership if sessionId provided
  if (sessionId && scan.guestSessionId !== sessionId) {
    throw new ReportServiceError('Forbidden', 'FORBIDDEN');
  }

  // Build response
  const pdfReport = scan.reports.find(r => r.format === 'PDF');
  const jsonReport = scan.reports.find(r => r.format === 'JSON');

  return {
    scanId: scan.id,
    scanStatus: scan.status,
    reports: {
      pdf: pdfReport ? await buildReportInfo(pdfReport) : null,
      json: jsonReport ? await buildReportInfo(jsonReport) : null,
    },
  };
}

async function buildReportInfo(report: Report): Promise<ReportInfo> {
  const url = await generatePresignedUrl(report.storageKey);
  return {
    exists: true,
    url,
    createdAt: report.createdAt.toISOString(),
    fileSizeBytes: report.fileSizeBytes,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}
```

### Admin Report Controller

**Location**: `apps/api/src/modules/admin/admin.controller.ts`

**New Routes**:
```typescript
// GET /api/v1/admin/scans/:scanId/reports
fastify.get<{ Params: { scanId: string } }>(
  `${prefix}/admin/scans/:scanId/reports`,
  { preHandler: [adminMiddleware] },
  async (request, reply) => {
    const status = await getReportStatus(request.params.scanId);
    return reply.send({ success: true, data: status });
  }
);

// POST /api/v1/admin/reports/:scanId/:format
fastify.post<{ Params: { scanId: string; format: 'pdf' | 'json' } }>(
  `${prefix}/admin/reports/:scanId/:format`,
  { preHandler: [adminMiddleware] },
  async (request, reply) => {
    const result = await getOrGenerateReportAdmin(
      request.params.scanId,
      request.params.format
    );
    // Same response format as user endpoint
    // ... handle result
  }
);
```

## File Structure

```
apps/web/src/
├── components/
│   ├── features/
│   │   └── export/
│   │       ├── ExportButton.tsx      # Updated
│   │       ├── ExportOptions.tsx     # Updated
│   │       ├── ExportModal.tsx       # New
│   │       └── index.ts              # Updated
│   └── admin/
│       └── AdminExportButton.tsx     # New
├── hooks/
│   ├── useExport.ts                  # Enhanced
│   ├── useReportStatus.ts            # New
│   └── useAdminExport.ts             # New
└── lib/
    ├── api.ts                        # Updated
    └── admin-api.ts                  # Updated

apps/api/src/modules/
├── reports/
│   ├── report.controller.ts          # Updated (new route)
│   └── report.service.ts             # Updated (new function)
└── admin/
    └── admin.controller.ts           # Updated (new routes)
```

## Testing Strategy

### Unit Tests

1. **useReportStatus hook**: Mock API, test loading/error/success states
2. **useExport hook**: Test enhanced status management
3. **ExportModal component**: Test all UI states, accessibility
4. **Report service**: Test getReportStatus function

### Integration Tests

1. **Report status API**: Test with existing/non-existing reports
2. **Admin report API**: Test authorization, generation

### E2E Tests

1. **User export flow**:
   - View scan with existing reports → Download works
   - View scan without reports → Generate → Download
2. **Admin export flow**:
   - Admin can export any scan
   - Progress modal works correctly

## Migration Notes

- No database migrations required
- Backward compatible with existing report API
- Frontend changes are additive

## Open Questions (Resolved)

1. ~~SSE vs Polling~~ → Using polling with exponential backoff (existing)
2. ~~Pre-generate reports~~ → Out of scope for this iteration
3. ~~Progress percentage~~ → Using spinner (no percentage tracking)

## Dependencies

- Existing report generation worker
- S3/MinIO for storage
- Presigned URL generation (`@adashield/core/storage`)
