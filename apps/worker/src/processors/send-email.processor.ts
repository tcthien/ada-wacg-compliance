/**
 * Send Email Processor
 *
 * Processes email notifications for async scan results.
 * Implements GDPR-compliant email handling with automatic email nullification.
 *
 * Features:
 * - Multi-provider email routing (SendGrid, AWS SES) via EmailRouter
 * - Pattern-based routing to different providers
 * - Fallback to legacy SendGrid-only provider if routing config fails
 * - Email nullification after sending (GDPR compliance)
 * - Support for scan completion and failure notifications
 * - Automatic retry with exponential backoff (5 attempts)
 */

import { Job } from 'bullmq';
import { getPrismaClient } from '../config/prisma.js';
import { createEmailProvider } from './notifier/email-sender.js';
import { EmailRouter } from './notifier/email-router.js';
import {
  getScanCompleteEmail,
  getScanFailedEmail,
  getBatchCompleteEmail,
  getAiScanCompleteEmail,
  type ScanCompleteEmailData,
  type ScanFailedEmailData,
  type BatchCompleteEmailData,
  type AiScanCompleteEmailData,
} from './notifier/email-templates.js';
import { env } from '../config/env.js';
import { loadEmailRoutingConfig } from '../config/email-routing.config.js';

/**
 * Module-level singleton EmailRouter instance
 *
 * Initialized lazily on first use to avoid startup failures.
 * If initialization fails, falls back to legacy provider behavior.
 */
let emailRouter: EmailRouter | null = null;
let emailRouterInitialized = false;
let emailRouterError: Error | null = null;

/**
 * Initialize the EmailRouter singleton
 *
 * Loads configuration and creates the router instance.
 * Handles errors gracefully by logging and setting error state.
 *
 * @returns The EmailRouter instance or null if initialization failed
 */
function initializeEmailRouter(): EmailRouter | null {
  if (emailRouterInitialized) {
    return emailRouter;
  }

  emailRouterInitialized = true;

  try {
    console.log('Initializing EmailRouter...');
    const config = loadEmailRoutingConfig();
    emailRouter = new EmailRouter(config);
    console.log('EmailRouter initialized successfully');
    return emailRouter;
  } catch (error) {
    emailRouterError =
      error instanceof Error ? error : new Error(String(error));
    console.warn(
      `Failed to initialize EmailRouter: ${emailRouterError.message}`
    );
    console.warn(
      'Falling back to legacy email provider (SendGrid only)'
    );
    return null;
  }
}

/**
 * Get the EmailRouter singleton, initializing if needed
 *
 * @returns The EmailRouter instance or null if not available
 */
export function getEmailRouter(): EmailRouter | null {
  if (!emailRouterInitialized) {
    return initializeEmailRouter();
  }
  return emailRouter;
}

/**
 * Reset the EmailRouter singleton state
 *
 * Used for testing purposes to allow re-initialization with different configs.
 * Should NOT be called in production code.
 */
export function resetEmailRouter(): void {
  emailRouter = null;
  emailRouterInitialized = false;
  emailRouterError = null;
}

/**
 * Get the EmailRouter initialization error if any
 *
 * @returns The error that occurred during initialization, or null if successful
 */
export function getEmailRouterError(): Error | null {
  return emailRouterError;
}

/**
 * Send Email Job Data interface
 * Matches the queue job data structure
 */
export interface SendEmailJobData {
  scanId?: string;
  batchId?: string;
  email: string;
  type: 'scan_complete' | 'scan_failed' | 'batch_complete' | 'ai_scan_complete';
}

/**
 * Send Email Job Result interface
 */
export interface SendEmailJobResult {
  sent: boolean;
  emailNullified: boolean;
  messageId?: string;
  /** Provider used to send the email (for debugging) */
  provider?: string;
}

/**
 * Email sending error
 */
export class EmailSendError extends Error {
  public readonly code: string;
  public readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'EmailSendError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Handle permanent email send failure (GDPR compliance)
 *
 * Called when a send-email job has exhausted all retry attempts.
 * Nullifies the email address in the database to comply with GDPR
 * requirement that email addresses are deleted after use.
 *
 * Per Requirement 5.3: If email delivery fails after all retries,
 * still nullify the email address for GDPR compliance.
 *
 * @param job - The failed BullMQ job
 * @param error - The error that caused the failure
 *
 * @example
 * ```typescript
 * // In worker setup:
 * sendEmailWorker.on('failed', async (job, error) => {
 *   if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
 *     await handleSendEmailFailure(job, error);
 *   }
 * });
 * ```
 */
export async function handleSendEmailFailure(
  job: Job<SendEmailJobData>,
  error: Error
): Promise<void> {
  const { scanId, batchId, type } = job.data;
  const maxAttempts = job.opts.attempts ?? 1;

  // Only nullify on permanent failure (all retries exhausted)
  if (job.attemptsMade < maxAttempts) {
    console.log(`📧 Email job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}), will retry`);
    return;
  }

  console.log(`📧 Email job ${job.id} permanently failed after ${job.attemptsMade} attempts`);
  console.log(`   Error: ${error.message}`);

  const prisma = getPrismaClient();

  try {
    if (type === 'batch_complete' && batchId) {
      // Nullify batch email
      await prisma.batchScan.update({
        where: { id: batchId },
        data: { email: null },
      });
      console.log(`📧 GDPR: Nullified email for batch ${batchId} after permanent failure`);
    } else if (scanId) {
      // Nullify scan email
      await prisma.scan.update({
        where: { id: scanId },
        data: { email: null },
      });
      console.log(`📧 GDPR: Nullified email for scan ${scanId} after permanent failure`);
    } else {
      console.warn(`📧 GDPR: Cannot nullify email - no scanId or batchId in job data`);
    }
  } catch (nullifyError) {
    // Log but don't throw - the job has already failed
    console.error(`📧 GDPR: Failed to nullify email after permanent failure:`, nullifyError);
  }
}


/**
 * Send Email Processor
 *
 * Main processor function for sending scan notification emails.
 * Handles both completion and failure notifications with GDPR compliance.
 *
 * @param job - BullMQ job containing email parameters
 * @returns Email sending result
 * @throws EmailSendError if sending fails
 *
 * @example
 * ```typescript
 * // Job data for scan completion
 * {
 *   scanId: 'scan-123',
 *   email: 'user@example.com',
 *   type: 'scan_complete'
 * }
 * ```
 */
export async function processSendEmail(
  job: Job<SendEmailJobData>
): Promise<SendEmailJobResult> {
  const { scanId, batchId, email, type } = job.data;

  console.log(`📧 Processing send-email job: ${job.id}`);
  console.log(`   Scan ID: ${scanId ?? 'N/A'}`);
  console.log(`   Batch ID: ${batchId ?? 'N/A'}`);
  console.log(`   Email: ${email}`);
  console.log(`   Type: ${type}`);

  const prisma = getPrismaClient();

  try {
    // Handle batch_complete type separately
    if (type === 'batch_complete') {
      return await processBatchCompleteEmail(job, prisma, batchId, email);
    }

    // Handle ai_scan_complete type separately
    if (type === 'ai_scan_complete') {
      return await processAiScanCompleteEmail(job, prisma, scanId, email);
    }

    // For single scan emails, require scanId
    if (!scanId) {
      throw new EmailSendError(
        'scanId is required for scan_complete and scan_failed types',
        'MISSING_SCAN_ID'
      );
    }

    // Update job progress: Fetching scan data
    await job.updateProgress(10);

    // 1. Fetch scan data with results (including durationMs for threshold check)
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        scanResult: {
          include: {
            issues: true,
          },
        },
      },
    });

    if (!scan) {
      throw new EmailSendError(`Scan not found: ${scanId}`, 'SCAN_NOT_FOUND');
    }

    // Update job progress: Preparing email content
    await job.updateProgress(30);

    // 3. Prepare email content based on type
    let emailContent: { subject: string; html: string; text: string };

    if (type === 'scan_complete') {
      // Ensure scan has results
      if (!scan.scanResult) {
        throw new EmailSendError(
          `Scan ${scanId} has no result data`,
          'SCAN_NO_RESULTS'
        );
      }

      const resultsUrl = `${env.APP_URL}/scan/${scanId}`;

      const emailData: ScanCompleteEmailData = {
        url: scan.url,
        issueCount: scan.scanResult.totalIssues,
        criticalCount: scan.scanResult.criticalCount,
        seriousCount: scan.scanResult.seriousCount,
        moderateCount: scan.scanResult.moderateCount,
        minorCount: scan.scanResult.minorCount,
        resultsUrl,
      };

      emailContent = getScanCompleteEmail(emailData);
      console.log(`📊 Scan complete email prepared`);
      console.log(`   Total Issues: ${emailData.issueCount}`);
      console.log(`   Critical: ${emailData.criticalCount}`);
      if (scan.durationMs !== null) {
        console.log(`   Duration: ${scan.durationMs}ms`);
      }
    } else {
      // scan_failed
      const errorMessage = scan.errorMessage ?? 'Unknown error occurred';

      const emailData: ScanFailedEmailData = {
        url: scan.url,
        error: errorMessage,
      };

      emailContent = getScanFailedEmail(emailData);
      console.log(`⚠️  Scan failed email prepared`);
      console.log(`   Error: ${errorMessage}`);
    }

    // Update job progress: Sending email
    await job.updateProgress(60);

    // 4. Send email using EmailRouter (with fallback to legacy provider)
    let messageId: string;
    let providerUsed: string;

    const router = getEmailRouter();

    if (router) {
      // Use EmailRouter for intelligent provider routing
      console.log(`📬 Sending email via EmailRouter...`);
      const result = await router.send(email, emailContent);
      messageId = result.messageId;
      providerUsed = result.provider;
      console.log(`✅ Email sent via ${providerUsed} (Message ID: ${messageId})`);
    } else {
      // Fallback to legacy SendGrid-only provider
      console.log(`📬 EmailRouter unavailable, using legacy SendGrid provider...`);
      const legacyProvider = createEmailProvider(
        env.SENDGRID_API_KEY,
        env.SMTP_FROM
      );

      const result = await legacyProvider.send({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      messageId = result.messageId;
      providerUsed = 'SENDGRID (legacy)';
      console.log(`✅ Email sent via legacy provider (Message ID: ${messageId})`);
    }

    // Update job progress: Nullifying email
    await job.updateProgress(80);

    // 5. Nullify email in database (GDPR compliance)
    // Skip nullification if AI is enabled - email will be nullified after ai_scan_complete email
    let emailNullified = false;
    if (scan.aiEnabled) {
      console.log(`⏳ Skipping email nullification - AI processing pending (will nullify after AI email)`);
    } else {
      await prisma.scan.update({
        where: { id: scanId },
        data: { email: null },
      });
      emailNullified = true;
      console.log(`🔒 Email address nullified for GDPR compliance`);
    }

    // Update job progress: Complete
    await job.updateProgress(100);

    const result: SendEmailJobResult = {
      sent: true,
      emailNullified,
      messageId,
      provider: providerUsed,
    };

    console.log(`✅ Completed send-email job: ${job.id}`);
    return result;
  } catch (error) {
    // Log error for debugging (Requirement 5.2)
    const entityId = type === 'batch_complete' ? batchId : scanId;
    const entityType = type === 'batch_complete' ? 'batch' : 'scan';
    console.error(`❌ Email sending failed for ${entityType} ${entityId}:`, error);
    if (error instanceof Error) {
      console.error(`   Error name: ${error.name}`);
      console.error(`   Error message: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack trace: ${error.stack}`);
      }
    }

    // Re-throw EmailSendError as-is
    if (error instanceof EmailSendError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    throw new EmailSendError(
      `Failed to send email for ${entityType} ${entityId}`,
      'SEND_FAILED',
      err
    );
  }
}

/**
 * Process batch completion email
 *
 * Handles 'batch_complete' type emails by:
 * 1. Fetching batch data with aggregate statistics
 * 2. Getting top 5 URLs with most critical issues
 * 3. Generating email using getBatchCompleteEmail template
 * 4. Sending via EmailRouter
 * 5. Nullifying email for GDPR compliance
 *
 * @param job - BullMQ job for progress tracking
 * @param prisma - Prisma client instance
 * @param batchId - Batch ID to fetch data for
 * @param email - Recipient email address
 * @returns Email sending result
 */
async function processBatchCompleteEmail(
  job: Job<SendEmailJobData>,
  prisma: ReturnType<typeof getPrismaClient>,
  batchId: string | undefined,
  email: string
): Promise<SendEmailJobResult> {
  // Validate batchId is provided
  if (!batchId) {
    throw new EmailSendError(
      'batchId is required for batch_complete type',
      'MISSING_BATCH_ID'
    );
  }

  // Update job progress: Fetching batch data
  await job.updateProgress(10);

  // 1. Fetch batch data with aggregate statistics
  const batch = await prisma.batchScan.findUnique({
    where: { id: batchId },
    include: {
      scans: {
        include: {
          scanResult: true,
        },
      },
      reports: {
        where: {
          format: 'PDF',
        },
        take: 1,
      },
    },
  });

  if (!batch) {
    throw new EmailSendError(`Batch not found: ${batchId}`, 'BATCH_NOT_FOUND');
  }

  // Update job progress: Processing batch statistics
  await job.updateProgress(30);

  // 2. Calculate aggregate statistics from completed scans
  const completedScans = batch.scans.filter(
    (scan) => scan.status === 'COMPLETED' && scan.scanResult
  );

  // Sum up all issue counts across scans
  let totalIssues = 0;
  let criticalCount = 0;
  let seriousCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  let passedChecks = 0;

  for (const scan of completedScans) {
    if (scan.scanResult) {
      totalIssues += scan.scanResult.totalIssues;
      criticalCount += scan.scanResult.criticalCount;
      seriousCount += scan.scanResult.seriousCount;
      moderateCount += scan.scanResult.moderateCount;
      minorCount += scan.scanResult.minorCount;
      passedChecks += scan.scanResult.passedChecks;
    }
  }

  // 3. Get top 5 URLs with most critical issues
  const urlsWithCritical = completedScans
    .filter((scan) => scan.scanResult && scan.scanResult.criticalCount > 0)
    .map((scan) => ({
      url: scan.url,
      criticalCount: scan.scanResult!.criticalCount,
    }))
    .sort((a, b) => b.criticalCount - a.criticalCount)
    .slice(0, 5);

  // Update job progress: Preparing email content
  await job.updateProgress(50);

  // 4. Build email data
  const resultsUrl = `${env.APP_URL}/batch/${batchId}`;
  const pdfReportUrl = batch.reports[0]?.storageUrl;

  const emailData: BatchCompleteEmailData = {
    homepageUrl: batch.homepageUrl,
    totalUrls: batch.totalUrls,
    completedCount: batch.completedCount,
    failedCount: batch.failedCount,
    totalIssues,
    criticalCount,
    seriousCount,
    moderateCount,
    minorCount,
    passedChecks,
    topCriticalUrls: urlsWithCritical,
    resultsUrl,
    pdfReportUrl,
  };

  const emailContent = getBatchCompleteEmail(emailData);
  console.log(`📊 Batch complete email prepared`);
  console.log(`   Homepage: ${batch.homepageUrl}`);
  console.log(`   Total URLs: ${batch.totalUrls}`);
  console.log(`   Completed: ${batch.completedCount}`);
  console.log(`   Failed: ${batch.failedCount}`);
  console.log(`   Total Issues: ${totalIssues}`);
  console.log(`   Critical: ${criticalCount}`);

  // Update job progress: Sending email
  await job.updateProgress(60);

  // 5. Send email using EmailRouter (with fallback to legacy provider)
  let messageId: string;
  let providerUsed: string;

  const router = getEmailRouter();

  if (router) {
    // Use EmailRouter for intelligent provider routing
    console.log(`📬 Sending batch email via EmailRouter...`);
    const result = await router.send(email, emailContent);
    messageId = result.messageId;
    providerUsed = result.provider;
    console.log(`✅ Email sent via ${providerUsed} (Message ID: ${messageId})`);
  } else {
    // Fallback to legacy SendGrid-only provider
    console.log(`📬 EmailRouter unavailable, using legacy SendGrid provider...`);
    const legacyProvider = createEmailProvider(
      env.SENDGRID_API_KEY,
      env.SMTP_FROM
    );

    const result = await legacyProvider.send({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    messageId = result.messageId;
    providerUsed = 'SENDGRID (legacy)';
    console.log(`✅ Email sent via legacy provider (Message ID: ${messageId})`);
  }

  // Update job progress: Nullifying email
  await job.updateProgress(80);

  // 6. Nullify email in database (GDPR compliance)
  await prisma.batchScan.update({
    where: { id: batchId },
    data: { email: null },
  });

  console.log(`🔒 Batch email address nullified for GDPR compliance`);

  // Update job progress: Complete
  await job.updateProgress(100);

  const result: SendEmailJobResult = {
    sent: true,
    emailNullified: true,
    messageId,
    provider: providerUsed,
  };

  console.log(`✅ Completed batch send-email job: ${job.id}`);
  return result;
}

/**
 * Process AI scan completion email
 *
 * Handles 'ai_scan_complete' type emails by:
 * 1. Fetching scan data with AI fields and enhanced issues
 * 2. Extracting top priority fixes from AI-enhanced issues
 * 3. Calculating estimated fix time from AI remediation plan
 * 4. Generating email using getAiScanCompleteEmail template
 * 5. Sending via EmailRouter
 * 6. Nullifying email for GDPR compliance
 *
 * @param job - BullMQ job for progress tracking
 * @param prisma - Prisma client instance
 * @param scanId - Scan ID to fetch data for
 * @param email - Recipient email address
 * @returns Email sending result
 */
async function processAiScanCompleteEmail(
  job: Job<SendEmailJobData>,
  prisma: ReturnType<typeof getPrismaClient>,
  scanId: string | undefined,
  email: string
): Promise<SendEmailJobResult> {
  // Validate scanId is provided
  if (!scanId) {
    throw new EmailSendError(
      'scanId is required for ai_scan_complete type',
      'MISSING_SCAN_ID'
    );
  }

  // Update job progress: Fetching scan data
  await job.updateProgress(10);

  // 1. Fetch scan data with AI fields and enhanced issues
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      scanResult: {
        include: {
          issues: {
            where: {
              aiPriority: { not: null },
            },
            orderBy: {
              aiPriority: 'desc',
            },
            take: 3,
          },
        },
      },
    },
  });

  if (!scan) {
    throw new EmailSendError(`Scan not found: ${scanId}`, 'SCAN_NOT_FOUND');
  }

  // Ensure scan has results
  if (!scan.scanResult) {
    throw new EmailSendError(
      `Scan ${scanId} has no result data`,
      'SCAN_NO_RESULTS'
    );
  }

  // Ensure scan has AI data
  if (!scan.aiSummary || scan.aiStatus !== 'COMPLETED') {
    throw new EmailSendError(
      `Scan ${scanId} has incomplete AI data (status: ${scan.aiStatus})`,
      'SCAN_NO_AI_DATA'
    );
  }

  // Update job progress: Processing AI data
  await job.updateProgress(30);

  // 2. Extract top priority fixes from AI-enhanced issues
  const topPriorityFixes = scan.scanResult.issues
    .filter(issue => issue.aiExplanation && issue.aiFixSuggestion && issue.aiPriority)
    .slice(0, 3)
    .map(issue => ({
      issue: issue.description,
      impact: issue.aiExplanation || 'No AI explanation available',
      wcagCriteria: issue.wcagCriteria.join(', '),
    }));

  // 3. Extract estimated fix time from AI remediation plan
  // Parse "estimated time: X hours" from the remediation plan
  let estimatedFixTime = 0;
  if (scan.aiRemediationPlan) {
    const timeMatch = scan.aiRemediationPlan.match(/(\d+)\s*hours?/i);
    if (timeMatch && timeMatch[1]) {
      estimatedFixTime = parseInt(timeMatch[1], 10);
    }
  }

  // 4. Extract remediation preview (first 500 characters of remediation plan)
  const remediationPreview = scan.aiRemediationPlan
    ? scan.aiRemediationPlan.substring(0, 500) + (scan.aiRemediationPlan.length > 500 ? '...' : '')
    : 'View full report for remediation details';

  // Update job progress: Preparing email content
  await job.updateProgress(50);

  // 5. Build email data
  const resultsUrl = `${env.APP_URL}/scan/${scanId}`;

  const emailData: AiScanCompleteEmailData = {
    url: scan.url,
    issueCount: scan.scanResult.totalIssues,
    criticalCount: scan.scanResult.criticalCount,
    seriousCount: scan.scanResult.seriousCount,
    moderateCount: scan.scanResult.moderateCount,
    minorCount: scan.scanResult.minorCount,
    resultsUrl,
    aiSummary: scan.aiSummary,
    topPriorityFixes,
    estimatedFixTime,
    remediationPreview,
  };

  const emailContent = getAiScanCompleteEmail(emailData);
  console.log(`📊 AI scan complete email prepared`);
  console.log(`   URL: ${scan.url}`);
  console.log(`   Total Issues: ${emailData.issueCount}`);
  console.log(`   Critical: ${emailData.criticalCount}`);
  console.log(`   AI Priority Fixes: ${topPriorityFixes.length}`);
  console.log(`   Estimated Fix Time: ${estimatedFixTime}h`);

  // Update job progress: Sending email
  await job.updateProgress(60);

  // 6. Send email using EmailRouter (with fallback to legacy provider)
  let messageId: string;
  let providerUsed: string;

  const router = getEmailRouter();

  if (router) {
    // Use EmailRouter for intelligent provider routing
    console.log(`📬 Sending AI scan email via EmailRouter...`);
    const result = await router.send(email, emailContent);
    messageId = result.messageId;
    providerUsed = result.provider;
    console.log(`✅ Email sent via ${providerUsed} (Message ID: ${messageId})`);
  } else {
    // Fallback to legacy SendGrid-only provider
    console.log(`📬 EmailRouter unavailable, using legacy SendGrid provider...`);
    const legacyProvider = createEmailProvider(
      env.SENDGRID_API_KEY,
      env.SMTP_FROM
    );

    const result = await legacyProvider.send({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    messageId = result.messageId;
    providerUsed = 'SENDGRID (legacy)';
    console.log(`✅ Email sent via legacy provider (Message ID: ${messageId})`);
  }

  // Update job progress: Nullifying email
  await job.updateProgress(80);

  // 7. Nullify email in database (GDPR compliance)
  await prisma.scan.update({
    where: { id: scanId },
    data: { email: null },
  });

  console.log(`🔒 Email address nullified for GDPR compliance`);

  // Update job progress: Complete
  await job.updateProgress(100);

  const result: SendEmailJobResult = {
    sent: true,
    emailNullified: true,
    messageId,
    provider: providerUsed,
  };

  console.log(`✅ Completed AI scan send-email job: ${job.id}`);
  return result;
}
