/**
 * Queue Service
 *
 * Provides helper functions to add jobs to queues with proper
 * error handling, validation, and metadata tracking.
 */

import type { JobsOptions } from 'bullmq';
import { scanPageQueue, generateReportQueue, sendEmailQueue } from './queues.js';
import type {
  ScanJobData,
  ReportJobData,
  TemplateEmailJobData,
  WCAGLevel,
  ReportFormat,
  JobOptionsWithMetadata,
} from './types.js';

/**
 * Queue Service Error
 */
export class QueueServiceError extends Error {
  public readonly queue: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, queue: string, cause?: Error | undefined) {
    super(message);
    this.name = 'QueueServiceError';
    this.queue = queue;
    this.cause = cause;
  }
}

/**
 * Convert our custom job options to BullMQ JobsOptions
 */
function toBullMQOptions(options?: JobOptionsWithMetadata): JobsOptions {
  if (!options) return {};

  const { metadata, ...bullmqOptions } = options;

  // Add metadata to job data if present
  const result: JobsOptions = { ...bullmqOptions };

  // Store metadata separately in job options
  if (metadata) {
    // BullMQ doesn't have a metadata field, but we can add it to the job
    // It will be available in job.opts when processing
    (result as JobsOptions & { metadata?: unknown }).metadata = metadata;
  }

  return result;
}

/**
 * Add a scan job to the queue
 *
 * @param scanId - Unique scan identifier
 * @param url - URL to scan
 * @param wcagLevel - WCAG compliance level (A, AA, AAA)
 * @param options - Optional job configuration
 * @returns Job ID
 */
export async function addScanJob(
  scanId: string,
  url: string,
  wcagLevel: WCAGLevel = 'AA',
  options?: JobOptionsWithMetadata & { userId?: string; sessionId?: string; email?: string }
): Promise<string> {
  try {
    // Validate inputs
    if (!scanId || typeof scanId !== 'string') {
      throw new Error('scanId is required and must be a string');
    }
    if (!url || typeof url !== 'string') {
      throw new Error('url is required and must be a string');
    }
    if (!['A', 'AA', 'AAA'].includes(wcagLevel)) {
      throw new Error('wcagLevel must be A, AA, or AAA');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error('url must be a valid URL');
    }

    const { userId, sessionId, email, ...jobOptions } = options || {};

    const jobData: ScanJobData = {
      scanId,
      url,
      wcagLevel,
      ...(userId && { userId }),
      ...(sessionId && { sessionId }),
      ...(email && { email }),
    };

    const job = await scanPageQueue.add(
      `scan-${scanId}` as string,
      jobData,
      toBullMQOptions(jobOptions)
    );

    console.log(`✅ Queue: Added scan job ${job.id} for ${url}`);
    return job.id ?? scanId;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Queue: Failed to add scan job:', err.message);
    throw new QueueServiceError('Failed to add scan job', 'scan-page', err);
  }
}

/**
 * Add a report generation job to the queue
 *
 * @param scanId - Scan identifier to generate report for
 * @param format - Report format (PDF or JSON)
 * @param options - Optional job configuration
 * @returns Job ID
 */
export async function addReportJob(
  scanId: string,
  format: ReportFormat,
  options?: JobOptionsWithMetadata & { title?: string; emailTo?: string }
): Promise<string> {
  try {
    // Validate inputs
    if (!scanId || typeof scanId !== 'string') {
      throw new Error('scanId is required and must be a string');
    }
    if (!['PDF', 'JSON'].includes(format)) {
      throw new Error('format must be PDF or JSON');
    }

    const { title, emailTo, ...jobOptions } = options || {};

    const jobData: ReportJobData = {
      scanId,
      format,
      ...(title && { title }),
      ...(emailTo && { emailTo }),
    };

    const job = await generateReportQueue.add(
      `report-${scanId}-${format.toLowerCase()}` as string,
      jobData,
      toBullMQOptions(jobOptions)
    );

    console.log(`✅ Queue: Added report job ${job.id} for scan ${scanId}`);
    return job.id ?? `${scanId}-${format}`;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Queue: Failed to add report job:', err.message);
    throw new QueueServiceError('Failed to add report job', 'generate-report', err);
  }
}

/**
 * Add an email job to the queue
 *
 * @param to - Recipient email address
 * @param template - Email template name
 * @param data - Template data
 * @param options - Optional job configuration
 * @returns Job ID
 */
export async function addEmailJob(
  to: string,
  template: string,
  data: Record<string, unknown>,
  options?: JobOptionsWithMetadata & { subject?: string; from?: string }
): Promise<string> {
  try {
    // Validate inputs
    if (!to || typeof to !== 'string') {
      throw new Error('to is required and must be a string');
    }
    if (!template || typeof template !== 'string') {
      throw new Error('template is required and must be a string');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('data is required and must be an object');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error('to must be a valid email address');
    }

    const { subject, from, ...jobOptions } = options || {};

    const jobData: TemplateEmailJobData = {
      to,
      template,
      data,
      ...(subject && { subject }),
      ...(from && { from }),
    };

    const job = await sendEmailQueue.add(
      `email-${template}-${Date.now()}` as string,
      jobData as unknown as Parameters<typeof sendEmailQueue.add>[1],
      toBullMQOptions(jobOptions)
    );

    console.log(`✅ Queue: Added email job ${job.id} to ${to}`);
    return job.id ?? `${to}-${template}`;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Queue: Failed to add email job:', err.message);
    throw new QueueServiceError('Failed to add email job', 'send-email', err);
  }
}

/**
 * Get job by ID from any queue
 *
 * @param jobId - Job identifier
 * @param queueName - Queue name to search in
 * @returns Job or null if not found
 */
export async function getJob(jobId: string, queueName: string) {
  try {
    switch (queueName) {
      case 'scan-page':
        return await scanPageQueue.getJob(jobId);
      case 'generate-report':
        return await generateReportQueue.getJob(jobId);
      case 'send-email':
        return await sendEmailQueue.getJob(jobId);
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  } catch (error) {
    console.error(`❌ Queue: Failed to get job ${jobId}:`, error);
    return null;
  }
}

/**
 * Remove job by ID from queue
 *
 * @param jobId - Job identifier
 * @param queueName - Queue name
 * @returns true if removed, false otherwise
 */
export async function removeJob(jobId: string, queueName: string): Promise<boolean> {
  try {
    const job = await getJob(jobId, queueName);
    if (!job) return false;

    await job.remove();
    console.log(`✅ Queue: Removed job ${jobId} from ${queueName}`);
    return true;
  } catch (error) {
    console.error(`❌ Queue: Failed to remove job ${jobId}:`, error);
    return false;
  }
}

/**
 * Get job status and progress
 *
 * @param jobId - Job identifier
 * @param queueName - Queue name
 * @returns Job status or null if not found
 */
export async function getJobStatus(jobId: string, queueName: string) {
  try {
    const job = await getJob(jobId, queueName);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  } catch (error) {
    console.error(`❌ Queue: Failed to get job status ${jobId}:`, error);
    return null;
  }
}
