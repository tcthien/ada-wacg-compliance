# Worker Services

## ScanEventService

The ScanEventService provides event logging functionality for the worker process. It logs scan events to PostgreSQL (primary storage) and caches them in Redis for real-time retrieval by the API.

### Usage

```typescript
import { logEvent } from '../services/scan-event.service.js';

// In a processor
export async function processScanPage(job: Job<ScanJobData>) {
  const { scanId, url } = job.data;

  // Log initialization
  await logEvent({
    scanId,
    type: 'INIT',
    level: 'INFO',
    message: 'Scan processing started',
    metadata: { jobId: job.id },
    adminOnly: true // Only visible to admins
  });

  // Log fetch operation
  await logEvent({
    scanId,
    type: 'FETCH',
    level: 'INFO',
    message: `Fetching page: ${url}`,
    metadata: { url }
  });

  try {
    // Your scanning logic here
    const results = await scanPage(url);

    // Log success
    await logEvent({
      scanId,
      type: 'RESULT',
      level: 'SUCCESS',
      message: `Scan completed! Found ${results.issueCount} issues`,
      metadata: { issueCount: results.issueCount }
    });
  } catch (error) {
    // Log error (admin-only with stack trace)
    await logEvent({
      scanId,
      type: 'ERROR',
      level: 'ERROR',
      message: 'Scan failed',
      metadata: {
        error: error.message,
        stack: error.stack
      },
      adminOnly: true
    });

    // Log user-friendly error
    await logEvent({
      scanId,
      type: 'ERROR',
      level: 'ERROR',
      message: 'Unable to complete scan. Please try again.'
    });

    throw error;
  }
}
```

### Event Types

- `INIT` - Scan initialization
- `QUEUE` - Job queued/processing started
- `FETCH` - Page fetching operations
- `ANALYSIS` - Accessibility analysis in progress
- `RESULT` - Scan results available
- `ERROR` - Error occurred
- `DEBUG` - Debug information (admin-only)

### Log Levels

- `DEBUG` - Detailed debug information
- `INFO` - General information
- `SUCCESS` - Successful operation
- `WARNING` - Warning message
- `ERROR` - Error occurred

### Error Handling

The `logEvent` function is designed to never throw errors. If logging fails:
- Returns `null` instead of throwing
- Logs error to console for debugging
- Scan processing continues normally

This ensures that event logging failures don't break the scan workflow.

### Architecture Notes

This implementation duplicates the API's ScanEventService to avoid cross-app imports which cause TypeScript rootDir issues in the monorepo. Both implementations should be kept in sync.

The service automatically uses the worker's Prisma and Redis clients via the `getPrismaClient()` and `getRedisClient()` singleton functions.
