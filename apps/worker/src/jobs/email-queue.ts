/**
 * Email Queue Instance
 *
 * Creates a BullMQ Queue instance for adding email notification jobs.
 * This queue is used by notification functions to queue email delivery
 * after scan completion or failure.
 *
 * The queue points to the same Redis queue that the send-email worker
 * processes, enabling the worker to add jobs to its own queue.
 *
 * Queue name: 'send-email' (must match QueueNames.SEND_EMAIL in index.ts)
 *
 * @see ../processors/send-email.processor.ts - The worker that processes these jobs
 * @see ../index.ts - Worker registration and queue names
 */

import { Queue } from 'bullmq';
import { getBullMQConnection } from '../config/redis.js';

/**
 * Queue name constant for email sending jobs
 * Must match the queue name used by the SendEmail worker
 */
export const SEND_EMAIL_QUEUE_NAME = 'send-email';

/**
 * Email job data interface
 * Matches the EmailJobData in apps/api/src/shared/queue/types.ts
 */
export interface EmailJobData {
  /** Scan ID for single scan emails */
  scanId?: string;

  /** Batch ID for batch emails */
  batchId?: string;

  /** Email address to send to */
  email: string;

  /** Type of email notification */
  type: 'scan_complete' | 'scan_failed' | 'batch_complete' | 'ai_scan_complete';
}

/**
 * Default job options for email sending
 * Configured for reliability with exponential backoff
 */
export const EMAIL_JOB_OPTIONS = {
  /** Number of retry attempts */
  attempts: 5,

  /** Backoff strategy */
  backoff: {
    type: 'exponential' as const,
    delay: 3000, // Start with 3 second delay
  },

  /** Remove completed jobs after 24 hours */
  removeOnComplete: {
    age: 24 * 60 * 60, // 24 hours in seconds
  },

  /** Keep failed jobs for debugging */
  removeOnFail: false,
};

/**
 * BullMQ Queue instance for sending email notifications
 *
 * Used by notification functions to add email jobs to the queue.
 * The send-email worker processes jobs from this queue.
 *
 * @example
 * ```typescript
 * import { sendEmailQueue, EMAIL_JOB_OPTIONS } from './email-queue.js';
 *
 * // Add a scan completion email job
 * await sendEmailQueue.add(
 *   'send-email',
 *   {
 *     scanId: 'scan-123',
 *     email: 'user@example.com',
 *     type: 'scan_complete',
 *   },
 *   EMAIL_JOB_OPTIONS
 * );
 * ```
 */
export const sendEmailQueue = new Queue<EmailJobData>(SEND_EMAIL_QUEUE_NAME, {
  connection: getBullMQConnection(),
});

/**
 * Add an email notification job to the queue
 *
 * Helper function that wraps queue.add with default job options.
 *
 * @param data - Email job data
 * @returns The created job
 *
 * @example
 * ```typescript
 * await addEmailJob({
 *   scanId: 'scan-123',
 *   email: 'user@example.com',
 *   type: 'scan_complete',
 * });
 * ```
 */
export async function addEmailJob(data: EmailJobData) {
  return sendEmailQueue.add(SEND_EMAIL_QUEUE_NAME, data, EMAIL_JOB_OPTIONS);
}

export default sendEmailQueue;
