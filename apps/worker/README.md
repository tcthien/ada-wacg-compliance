# ADAShield Worker

BullMQ worker application for processing accessibility scans, report generation, and email notifications.

## Overview

The worker application processes background jobs from BullMQ queues:

- **scan-page**: Accessibility scans using Playwright and axe-core
- **generate-report**: PDF/JSON report generation from scan results
- **send-email**: Transactional email notifications

## Architecture

```
apps/worker/
├── src/
│   ├── config/
│   │   ├── env.ts           # Environment configuration
│   │   └── redis.ts         # Redis connection management
│   ├── processors/
│   │   ├── scan-page.processor.ts        # Scan job processor
│   │   ├── generate-report.processor.ts  # Report job processor
│   │   └── send-email.processor.ts       # Email job processor
│   └── index.ts             # Worker entry point
├── package.json
└── tsconfig.json
```

## Environment Variables

```bash
# Environment
NODE_ENV=development          # development | production | test
LOG_LEVEL=info               # fatal | error | warn | info | debug | trace

# Redis
REDIS_URL=redis://localhost:6379  # Redis connection URL

# Worker Configuration
WORKER_CONCURRENCY=5         # Number of concurrent jobs per worker

# Playwright
PLAYWRIGHT_HEADLESS=true     # Run browser in headless mode
PLAYWRIGHT_TIMEOUT=30000     # Playwright timeout in milliseconds

# Email (for email worker)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=password
SMTP_FROM=noreply@adashield.com
```

## Getting Started

### Prerequisites

- Node.js 20+
- Redis 6+
- pnpm 9+

### Installation

```bash
# Install dependencies (from project root)
pnpm install
```

### Development

```bash
# Start worker in development mode with hot reload
pnpm dev

# Build TypeScript
pnpm build

# Run typecheck
pnpm typecheck
```

### Production

```bash
# Build the application
pnpm build

# Start the worker
pnpm start
```

## Queue Names

Queue names must match those defined in `apps/api`:

- `scan-page` - Accessibility scan jobs
- `generate-report` - Report generation jobs
- `send-email` - Email notification jobs

## Worker Concurrency

Workers are configured with different concurrency levels:

- **scan-page**: Full concurrency (default: 5)
- **generate-report**: Half concurrency (default: 2) - resource-intensive
- **send-email**: Full concurrency (default: 5)

Adjust `WORKER_CONCURRENCY` environment variable to change these values.

## Graceful Shutdown

Workers handle graceful shutdown on:

- `SIGTERM` - Kubernetes/Docker termination
- `SIGINT` - Ctrl+C in terminal
- `SIGQUIT` - Process quit signal

Shutdown process:

1. Stop accepting new jobs
2. Complete currently running jobs
3. Close all worker connections
4. Close Redis connection
5. Exit process

## Job Processing

### Scan Page Jobs

Placeholder implementation that will:

1. Launch Playwright browser
2. Navigate to target URL
3. Inject axe-core
4. Run accessibility scan
5. Save results to database
6. Queue report generation if needed

### Report Generation Jobs

Placeholder implementation that will:

1. Fetch scan results from database
2. Generate report in requested format (PDF/JSON)
3. Save report file to storage
4. Queue email job if recipient specified
5. Update scan record with report URL

### Email Jobs

Placeholder implementation that will:

1. Load email template
2. Render template with data
3. Connect to SMTP server
4. Send email
5. Log delivery status

## Error Handling

Workers implement retry strategies:

- **scan-page**: 3 attempts, exponential backoff (1s base)
- **generate-report**: 2 attempts, fixed delay (5s)
- **send-email**: 5 attempts, exponential backoff (2s base)

Failed jobs are kept for 7 days for debugging.

## Monitoring

Workers emit events for monitoring:

- `completed` - Job completed successfully
- `failed` - Job failed after all retries
- `active` - Job started processing
- `progress` - Job progress updated
- `error` - Worker error occurred

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Next Steps

The following tasks will implement the actual job processing logic:

- **TASK-023**: Implement scan page processor with Playwright + axe-core
- **TASK-024**: Implement report generation processor
- **TASK-025**: Implement email notification processor

## License

UNLICENSED - Private use only
