/**
 * Send Email Processor
 *
 * Processes email notifications for async scan results.
 * Implements GDPR-compliant email handling with automatic email nullification.
 *
 * Features:
 * - SendGrid integration with fallback to stub provider
 * - Email nullification after sending (GDPR compliance)
 * - Support for scan completion and failure notifications
 * - Automatic retry with exponential backoff (5 attempts)
 */

import { Job } from 'bullmq';
import { getPrismaClient } from '../config/prisma.js';
import { createEmailProvider } from './notifier/email-sender.js';
import {
  getScanCompleteEmail,
  getScanFailedEmail,
  type ScanCompleteEmailData,
  type ScanFailedEmailData,
} from './notifier/email-templates.js';
import { env } from '../config/env.js';

/**
 * Send Email Job Data interface
 * Matches the queue job data structure
 */
export interface SendEmailJobData {
  scanId: string;
  email: string;
  type: 'scan_complete' | 'scan_failed';
}

/**
 * Send Email Job Result interface
 */
export interface SendEmailJobResult {
  sent: boolean;
  emailNullified: boolean;
  messageId?: string;
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
  const { scanId, email, type } = job.data;

  console.log(`📧 Processing send-email job: ${job.id}`);
  console.log(`   Scan ID: ${scanId}`);
  console.log(`   Email: ${email}`);
  console.log(`   Type: ${type}`);

  const prisma = getPrismaClient();

  try {
    // Update job progress: Fetching scan data
    await job.updateProgress(10);

    // 1. Fetch scan data with results
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

    // 2. Prepare email content based on type
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

    // 3. Send email using provider
    const emailProvider = createEmailProvider(
      env.SENDGRID_API_KEY,
      env.SMTP_FROM
    );

    const { messageId } = await emailProvider.send({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    console.log(`✅ Email sent successfully (Message ID: ${messageId})`);

    // Update job progress: Nullifying email
    await job.updateProgress(80);

    // 4. Nullify email in database (GDPR compliance)
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
    };

    console.log(`✅ Completed send-email job: ${job.id}`);
    return result;
  } catch (error) {
    // Log error for debugging
    console.error(`❌ Email sending failed for scan ${scanId}:`, error);

    // Re-throw EmailSendError as-is
    if (error instanceof EmailSendError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    throw new EmailSendError(
      `Failed to send email for scan ${scanId}`,
      'SEND_FAILED',
      err
    );
  }
}
