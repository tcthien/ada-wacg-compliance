import { Worker } from 'bullmq';
import { env } from './config/env.js';
import { getBullMQConnection, closeRedisConnection } from './config/redis.js';
import { processScanPage } from './processors/scan-page.processor.js';
import { processGenerateReport } from './processors/generate-report.processor.js';
import { processSendEmail, handleSendEmailFailure, SendEmailJobData } from './processors/send-email.processor.js';
import {
  processBatchReportJob,
  BATCH_REPORT_QUEUE_NAME,
  BATCH_REPORT_JOB_OPTIONS,
} from './jobs/batch-report.job.js';

/**
 * Queue names - must match the queue names in apps/api
 */
const QueueNames = {
  SCAN_PAGE: 'scan-page',
  GENERATE_REPORT: 'generate-report',
  SEND_EMAIL: 'send-email',
  BATCH_REPORT: BATCH_REPORT_QUEUE_NAME,
} as const;

/**
 * Worker instances
 */
let scanPageWorker: Worker | null = null;
let generateReportWorker: Worker | null = null;
let sendEmailWorker: Worker | null = null;
let batchReportWorker: Worker | null = null;

/**
 * Graceful shutdown flag
 */
let isShuttingDown = false;

/**
 * Create and start all workers
 */
async function startWorkers(): Promise<void> {
  const connection = getBullMQConnection();

  console.log(`
🚀 ADAShield Worker starting...

   Environment:    ${env.NODE_ENV}
   Concurrency:    ${env.WORKER_CONCURRENCY}
   Redis:          ${connection.host}:${connection.port}
  `);

  // Create Scan Page Worker
  scanPageWorker = new Worker(QueueNames.SCAN_PAGE, processScanPage, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });

  // Create Generate Report Worker
  generateReportWorker = new Worker(
    QueueNames.GENERATE_REPORT,
    processGenerateReport,
    {
      connection,
      concurrency: Math.max(1, Math.floor(env.WORKER_CONCURRENCY / 2)),
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    }
  );

  // Create Send Email Worker
  sendEmailWorker = new Worker(QueueNames.SEND_EMAIL, processSendEmail, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });

  // Create Batch Report Worker
  batchReportWorker = new Worker(QueueNames.BATCH_REPORT, processBatchReportJob, {
    connection,
    concurrency: Math.max(1, Math.floor(env.WORKER_CONCURRENCY / 2)),
    removeOnComplete: BATCH_REPORT_JOB_OPTIONS.removeOnComplete,
    removeOnFail: { count: 5000 },
  });

  // Setup event handlers
  setupWorkerEventHandlers(scanPageWorker, 'ScanPage');
  setupWorkerEventHandlers(generateReportWorker, 'GenerateReport');
  setupSendEmailWorkerEventHandlers(sendEmailWorker);
  setupWorkerEventHandlers(batchReportWorker, 'BatchReport');

  console.log(`
✅ Workers started successfully!

   Workers:
   - ${QueueNames.SCAN_PAGE} (concurrency: ${env.WORKER_CONCURRENCY})
   - ${QueueNames.GENERATE_REPORT} (concurrency: ${Math.max(1, Math.floor(env.WORKER_CONCURRENCY / 2))})
   - ${QueueNames.SEND_EMAIL} (concurrency: ${env.WORKER_CONCURRENCY})
   - ${QueueNames.BATCH_REPORT} (concurrency: ${Math.max(1, Math.floor(env.WORKER_CONCURRENCY / 2))})

   Status: Waiting for jobs...
  `);
}

/**
 * Setup event handlers for a worker
 */
function setupWorkerEventHandlers(worker: Worker, name: string): void {
  // Job completed
  worker.on('completed', (job) => {
    console.log(`✅ [${name}] Job ${job.id} completed`);
  });

  // Job failed
  worker.on('failed', (job, error) => {
    if (job) {
      console.error(`❌ [${name}] Job ${job.id} failed:`, error.message);
    } else {
      console.error(`❌ [${name}] Job failed (no job data):`, error.message);
    }
  });

  // Job active
  worker.on('active', (job) => {
    console.log(`🔄 [${name}] Job ${job.id} started`);
  });

  // Job progress
  worker.on('progress', (job, progress) => {
    console.log(`📊 [${name}] Job ${job.id} progress: ${progress}%`);
  });

  // Worker error
  worker.on('error', (error) => {
    console.error(`❌ [${name}] Worker error:`, error.message);
  });

  // Worker closed
  worker.on('closed', () => {
    console.log(`⚠️  [${name}] Worker closed`);
  });

  // Worker ready
  worker.on('ready', () => {
    console.log(`✅ [${name}] Worker ready`);
  });
}

/**
 * Setup event handlers for the SendEmail worker
 *
 * This specialized handler includes GDPR email nullification
 * when email jobs permanently fail (all retries exhausted).
 *
 * Per Requirement 5.3: If email delivery fails after all retries,
 * still nullify the email address for GDPR compliance.
 */
function setupSendEmailWorkerEventHandlers(worker: Worker<SendEmailJobData>): void {
  const name = 'SendEmail';

  // Job completed
  worker.on('completed', (job) => {
    console.log(`✅ [${name}] Job ${job.id} completed`);
  });

  // Job failed - with GDPR email nullification on permanent failure
  worker.on('failed', async (job, error) => {
    if (job) {
      console.error(`❌ [${name}] Job ${job.id} failed:`, error.message);

      // Handle GDPR email nullification on permanent failure
      // The handleSendEmailFailure function checks if all retries are exhausted
      try {
        await handleSendEmailFailure(job, error);
      } catch (nullifyError) {
        console.error(`❌ [${name}] GDPR nullification error:`, nullifyError);
      }
    } else {
      console.error(`❌ [${name}] Job failed (no job data):`, error.message);
    }
  });

  // Job active
  worker.on('active', (job) => {
    console.log(`🔄 [${name}] Job ${job.id} started`);
  });

  // Job progress
  worker.on('progress', (job, progress) => {
    console.log(`📊 [${name}] Job ${job.id} progress: ${progress}%`);
  });

  // Worker error
  worker.on('error', (error) => {
    console.error(`❌ [${name}] Worker error:`, error.message);
  });

  // Worker closed
  worker.on('closed', () => {
    console.log(`⚠️  [${name}] Worker closed`);
  });

  // Worker ready
  worker.on('ready', () => {
    console.log(`✅ [${name}] Worker ready`);
  });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n👋 Received ${signal}, shutting down gracefully...`);

  try {
    // Close all workers
    const closePromises: Promise<void>[] = [];

    if (scanPageWorker) {
      console.log('🔄 Closing ScanPage worker...');
      closePromises.push(scanPageWorker.close());
    }

    if (generateReportWorker) {
      console.log('🔄 Closing GenerateReport worker...');
      closePromises.push(generateReportWorker.close());
    }

    if (sendEmailWorker) {
      console.log('🔄 Closing SendEmail worker...');
      closePromises.push(sendEmailWorker.close());
    }

    if (batchReportWorker) {
      console.log('🔄 Closing BatchReport worker...');
      closePromises.push(batchReportWorker.close());
    }

    // Wait for all workers to close
    await Promise.all(closePromises);
    console.log('✅ All workers closed');

    // Close Redis connection
    await closeRedisConnection();

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

/**
 * Handle uncaught errors
 */
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

/**
 * Handle graceful shutdown signals
 */
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

/**
 * Start workers if this is the main module
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorkers().catch((error) => {
    console.error('❌ Failed to start workers:', error);
    process.exit(1);
  });
}

/**
 * Export for testing
 */
export { startWorkers, gracefulShutdown };
