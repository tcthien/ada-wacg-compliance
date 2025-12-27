# Queue Module

BullMQ-based queue system for background job processing in the ADAShield API.

## Overview

This module provides three queues for different types of background jobs:
- **scan-page**: For running accessibility scans on URLs
- **generate-report**: For generating PDF/JSON reports from scan results
- **send-email**: For sending transactional emails and notifications

## Quick Start

```typescript
import { addScanJob, addReportJob, addEmailJob } from './shared/queue/index.js';

// Add a scan job
const jobId = await addScanJob('scan-123', 'https://example.com', 'AA');

// Add a report generation job
await addReportJob('scan-123', 'PDF', {
  title: 'Accessibility Report',
  emailTo: 'user@example.com'
});

// Add an email job
await addEmailJob(
  'user@example.com',
  'scan-complete',
  { scanUrl: 'https://example.com', results: '...' }
);
```

## Queue Configuration

### scan-page Queue
- **Retry Strategy**: 3 attempts with exponential backoff (base delay: 1s)
- **Use Cases**: Web page accessibility scans
- **Job Data**: `ScanJobData` (scanId, url, wcagLevel)

### generate-report Queue
- **Retry Strategy**: 2 attempts with fixed 5s delay
- **Use Cases**: PDF/JSON report generation
- **Job Data**: `ReportJobData` (scanId, format, optional title and emailTo)

### send-email Queue
- **Retry Strategy**: 5 attempts with exponential backoff (base delay: 2s)
- **Use Cases**: Transactional emails, notifications
- **Job Data**: `EmailJobData` (to, template, data)

## Bull Board Dashboard

Access the queue monitoring dashboard at `/admin/queues` (configured in bull-board.plugin.ts).

The dashboard shows:
- Active jobs
- Waiting jobs
- Failed jobs
- Job details and retry history

## Redis Connection

Queues use the existing Redis connection from `apps/api/src/config/redis.ts`.

Connection is automatically managed with:
- Connection pooling
- Automatic reconnection
- Error handling

## Job Options

All job addition functions accept optional configuration:

```typescript
await addScanJob('scan-123', 'https://example.com', 'AA', {
  priority: 10,           // Higher = more urgent
  delay: 5000,           // Delay start by 5s
  attempts: 5,           // Override retry attempts
  metadata: {            // Custom metadata
    createdAt: Date.now(),
    source: 'api',
    correlationId: 'req-123'
  }
});
```

## Health Check

```typescript
import { checkQueueHealth } from './shared/queue/index.js';

const health = await checkQueueHealth();
// {
//   status: 'healthy',
//   queues: {
//     'scan-page': { active: 2, waiting: 5, failed: 0 },
//     'generate-report': { active: 1, waiting: 3, failed: 0 },
//     'send-email': { active: 0, waiting: 1, failed: 0 }
//   }
// }
```

## Files

- `types.ts` - TypeScript type definitions for job data
- `queues.ts` - Queue definitions with retry strategies
- `queue.service.ts` - Service functions for adding jobs
- `bull-board.plugin.ts` - Fastify plugin for queue dashboard
- `queue.service.test.ts` - Unit tests
- `index.ts` - Public API exports

## Testing

```bash
# Run all tests
pnpm test

# Run only queue service tests
pnpm test queue.service.test.ts

# Run with coverage
pnpm test:coverage
```

## Error Handling

All service functions throw `QueueServiceError` on failure:

```typescript
try {
  await addScanJob('scan-123', 'invalid-url', 'AA');
} catch (error) {
  if (error instanceof QueueServiceError) {
    console.error(`Queue error in ${error.queue}:`, error.message);
    console.error('Caused by:', error.cause);
  }
}
```

## Future Enhancements

- [ ] Worker processes for job execution
- [ ] Job progress tracking with WebSocket updates
- [ ] Rate limiting per job type
- [ ] Job priority queues
- [ ] Dead letter queue for failed jobs
- [ ] Scheduled/cron jobs
