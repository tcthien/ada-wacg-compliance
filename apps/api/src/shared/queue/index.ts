/**
 * Queue Module
 *
 * Exports all queue-related functionality including queues,
 * services, types, and the Bull Board dashboard plugin.
 */

// Types
export type {
  ScanJobData,
  ReportJobData,
  EmailJobData,
  WCAGLevel,
  ReportFormat,
  JobMetadata,
  JobOptionsWithMetadata,
} from './types.js';

// Queues
export {
  scanPageQueue,
  generateReportQueue,
  sendEmailQueue,
  queues,
  QueueNames,
  checkQueueHealth,
  closeQueues,
} from './queues.js';

// Queue Service
export {
  addScanJob,
  addReportJob,
  addEmailJob,
  getJob,
  removeJob,
  getJobStatus,
  QueueServiceError,
} from './queue.service.js';

// Bull Board Plugin
export { bullBoardPlugin, type BullBoardPluginOptions } from './bull-board.plugin.js';
