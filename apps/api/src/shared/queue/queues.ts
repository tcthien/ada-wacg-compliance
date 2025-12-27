/**
 * BullMQ Queue Definitions
 *
 * Defines all queues used in the application with proper
 * Redis connection, retry strategies, and configuration.
 */

import { Queue } from 'bullmq';
import { getRedisClient } from '../../config/redis.js';
import type { ScanJobData, ReportJobData, EmailJobData } from './types.js';

/**
 * Queue names as constants
 */
export const QueueNames = {
  SCAN_PAGE: 'scan-page',
  GENERATE_REPORT: 'generate-report',
  SEND_EMAIL: 'send-email',
} as const;

/**
 * Get BullMQ connection from ioredis client
 */
function getBullMQConnection() {
  const redisClient = getRedisClient();

  // BullMQ expects a connection object with host, port, etc.
  // Since we're using ioredis client, we need to extract connection info
  return {
    host: redisClient.options.host || 'localhost',
    port: redisClient.options.port || 6379,
    password: redisClient.options.password,
    db: redisClient.options.db || 0,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false, // BullMQ handles ready checks
  };
}

/**
 * Default queue configuration
 */
const defaultQueueOptions = {
  connection: getBullMQConnection(),
  defaultJobOptions: {
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
      count: 5000, // Keep max 5000 failed jobs
    },
  },
};

/**
 * Scan Page Queue
 *
 * Processes accessibility scans on web pages.
 * Retry strategy: 3 attempts with exponential backoff (2^attempt * 1000ms), max 30s
 */
export const scanPageQueue = new Queue<ScanJobData>(QueueNames.SCAN_PAGE, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // Base delay: 1 second
    },
  },
});

/**
 * Generate Report Queue
 *
 * Processes report generation (PDF/JSON) from scan results.
 * Retry strategy: 2 attempts with fixed 5s delay
 */
export const generateReportQueue = new Queue<ReportJobData>(
  QueueNames.GENERATE_REPORT,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 5000, // Fixed 5 second delay
      },
    },
  }
);

/**
 * Send Email Queue
 *
 * Processes email notifications and transactional emails.
 * Retry strategy: 5 attempts with exponential backoff, max 5 minutes
 */
export const sendEmailQueue = new Queue<EmailJobData>(QueueNames.SEND_EMAIL, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // Base delay: 2 seconds
    },
  },
});

/**
 * Queue health check
 */
export async function checkQueueHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  queues: Record<string, { active: number; waiting: number; failed: number }>;
}> {
  try {
    const [scanCounts, reportCounts, emailCounts] = await Promise.all([
      scanPageQueue.getJobCounts('active', 'waiting', 'failed'),
      generateReportQueue.getJobCounts('active', 'waiting', 'failed'),
      sendEmailQueue.getJobCounts('active', 'waiting', 'failed'),
    ]);

    return {
      status: 'healthy',
      queues: {
        [QueueNames.SCAN_PAGE]: {
          active: scanCounts['active'] || 0,
          waiting: scanCounts['waiting'] || 0,
          failed: scanCounts['failed'] || 0,
        },
        [QueueNames.GENERATE_REPORT]: {
          active: reportCounts['active'] || 0,
          waiting: reportCounts['waiting'] || 0,
          failed: reportCounts['failed'] || 0,
        },
        [QueueNames.SEND_EMAIL]: {
          active: emailCounts['active'] || 0,
          waiting: emailCounts['waiting'] || 0,
          failed: emailCounts['failed'] || 0,
        },
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      queues: {},
    };
  }
}

/**
 * Gracefully close all queues
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    scanPageQueue.close(),
    generateReportQueue.close(),
    sendEmailQueue.close(),
  ]);
  console.log('✅ Queues: All queues closed gracefully');
}

/**
 * Queue error event handlers
 */
scanPageQueue.on('error', (error: Error) => {
  console.error(`❌ Queue Error [${QueueNames.SCAN_PAGE}]:`, error.message);
});

generateReportQueue.on('error', (error: Error) => {
  console.error(`❌ Queue Error [${QueueNames.GENERATE_REPORT}]:`, error.message);
});

sendEmailQueue.on('error', (error: Error) => {
  console.error(`❌ Queue Error [${QueueNames.SEND_EMAIL}]:`, error.message);
});

/**
 * Export all queues
 */
export const queues = {
  scanPage: scanPageQueue,
  generateReport: generateReportQueue,
  sendEmail: sendEmailQueue,
};

export default queues;
