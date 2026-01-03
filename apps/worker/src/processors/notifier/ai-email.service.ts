/**
 * AI Email Service
 *
 * Service for generating and queuing AI-enhanced scan completion emails.
 * Handles fetching scan data with AI results and queuing email delivery.
 *
 * Part of: AI Early Bird Scan feature (Task 5.4)
 */

import { getPrismaClient } from '../../config/prisma.js';
import { addEmailJob, type EmailJobData } from '../../jobs/email-queue.js';
import type { Scan, ScanResult, Issue } from '@prisma/client';

/**
 * Type definition for scan with AI results
 * Includes scan data, result statistics, and AI-enhanced issues
 */
export type ScanWithAiResult = Scan & {
  scanResult: (ScanResult & {
    issues: Issue[];
  }) | null;
};

/**
 * AI Email Service
 *
 * Provides methods for generating and queuing AI-enhanced scan completion emails.
 */
export class AiEmailService {
  /**
   * Generate and queue combined report email for an AI-enhanced scan
   *
   * Fetches the scan with AI data and issues from the database,
   * then queues an email job for delivery. The email will include:
   * - Standard scan results (issue counts, severity breakdown)
   * - AI-generated summary
   * - Top priority fixes with AI explanations
   * - Estimated fix time
   * - Remediation preview
   *
   * Requirements:
   * - Scan must have aiEnabled=true
   * - Scan must have aiStatus=COMPLETED
   * - Scan must have scanResult with issues
   * - Scan must have email address
   *
   * @param scan - Scan entity with AI results and issues
   * @throws Error if scan validation fails
   * @returns The queued email job
   *
   * @example
   * ```typescript
   * const service = new AiEmailService();
   * const scan = await prisma.scan.findUnique({
   *   where: { id: scanId },
   *   include: {
   *     scanResult: {
   *       include: { issues: true }
   *     }
   *   }
   * });
   *
   * if (scan) {
   *   await service.generateCombinedReportEmail(scan);
   * }
   * ```
   */
  async generateCombinedReportEmail(scan: ScanWithAiResult): Promise<void> {
    // Validate scan has required data
    this.validateScanForEmail(scan);

    // Email is guaranteed to exist after validation
    const email = scan.email!;

    console.log(`📧 [AiEmailService] Generating combined report email for scan ${scan.id}`);
    console.log(`   Email: ${email}`);
    console.log(`   AI Status: ${scan.aiStatus}`);
    console.log(`   AI Summary Length: ${scan.aiSummary?.length ?? 0} chars`);

    // Queue the email job
    const job = await addEmailJob({
      scanId: scan.id,
      email,
      type: 'ai_scan_complete',
    });

    console.log(`✅ [AiEmailService] AI scan email queued (Job ID: ${job.id})`);
  }

  /**
   * Queue AI report email for a scan by ID
   *
   * Fetches the scan from the database with all required AI data and issues,
   * then queues an email job for delivery. This is a convenience method that
   * handles the database fetch automatically.
   *
   * @param scanId - ID of the scan to send email for
   * @param email - Email address to send to (optional, uses scan.email if not provided)
   * @throws Error if scan not found or validation fails
   * @returns The queued email job
   *
   * @example
   * ```typescript
   * const service = new AiEmailService();
   * await service.queueAiReportEmail('scan-123', 'user@example.com');
   * ```
   */
  async queueAiReportEmail(
    scanId: string,
    email?: string
  ): Promise<void> {
    console.log(`📧 [AiEmailService] Queuing AI report email for scan ${scanId}`);

    const prisma = getPrismaClient();

    // Fetch scan with AI data and enhanced issues
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
            },
          },
        },
      },
    });

    if (!scan) {
      throw new Error(`Scan not found: ${scanId}`);
    }

    // Use provided email or fall back to scan email
    const emailAddress = email ?? scan.email;

    if (!emailAddress) {
      throw new Error(`No email address provided for scan ${scanId}`);
    }

    // Temporarily set email for validation if using override
    const scanWithEmail = email && email !== scan.email
      ? { ...scan, email }
      : scan;

    console.log(`📧 [AiEmailService] Fetched scan data`);
    console.log(`   URL: ${scan.url}`);
    console.log(`   Total Issues: ${scan.scanResult?.totalIssues ?? 0}`);
    console.log(`   AI-Enhanced Issues: ${scan.scanResult?.issues.length ?? 0}`);

    // Queue the email using the fetched scan
    await this.generateCombinedReportEmail(scanWithEmail);
  }

  /**
   * Validate scan has required data for AI email
   *
   * Checks that the scan has:
   * - aiEnabled flag set to true
   * - aiStatus set to COMPLETED
   * - aiSummary text
   * - scanResult with issues
   * - email address
   *
   * @param scan - Scan to validate
   * @throws Error if validation fails
   */
  private validateScanForEmail(scan: ScanWithAiResult): void {
    // Check AI is enabled
    if (!scan.aiEnabled) {
      throw new Error(
        `Cannot send AI email for scan ${scan.id}: AI not enabled`
      );
    }

    // Check AI processing is complete
    if (scan.aiStatus !== 'COMPLETED') {
      throw new Error(
        `Cannot send AI email for scan ${scan.id}: AI status is ${scan.aiStatus}, expected COMPLETED`
      );
    }

    // Check AI summary exists
    if (!scan.aiSummary) {
      throw new Error(
        `Cannot send AI email for scan ${scan.id}: AI summary is missing`
      );
    }

    // Check scan has results
    if (!scan.scanResult) {
      throw new Error(
        `Cannot send AI email for scan ${scan.id}: Scan result is missing`
      );
    }

    // Check email address exists
    if (!scan.email) {
      throw new Error(
        `Cannot send AI email for scan ${scan.id}: Email address is missing`
      );
    }

    console.log(`✅ [AiEmailService] Scan validation passed for scan ${scan.id}`);
  }
}

/**
 * Singleton instance of AiEmailService
 * Export for convenience
 */
export const aiEmailService = new AiEmailService();

/**
 * Export default AiEmailService class
 */
export default AiEmailService;
