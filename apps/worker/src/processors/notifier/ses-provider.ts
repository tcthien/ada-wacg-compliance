/**
 * AWS SES Email Provider Implementation
 *
 * Provides email sending functionality using AWS Simple Email Service (SES).
 * Implements the EmailProvider interface for consistent email handling.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { EmailOptions, EmailProvider } from './email-sender.js';

/**
 * Configuration options for AWS SES provider
 */
export interface SESConfig {
  /** AWS region where SES is configured (e.g., 'us-east-1') */
  region: string;
  /** AWS access key ID - optional if using IAM role or environment credentials */
  accessKeyId?: string;
  /** AWS secret access key - optional if using IAM role or environment credentials */
  secretAccessKey?: string;
  /** Verified sender email address in SES */
  fromEmail: string;
}

/**
 * AWS SES email provider implementation
 *
 * Uses AWS SDK v3 to send emails through Simple Email Service.
 * Supports both explicit credentials and IAM role-based authentication.
 */
export class SESProvider implements EmailProvider {
  private readonly client: SESClient;
  private readonly fromEmail: string;

  /**
   * Creates a new SES provider instance
   *
   * @param config - SES configuration options
   */
  constructor(config: SESConfig) {
    this.fromEmail = config.fromEmail;

    // Build credentials object only if explicit credentials provided
    const credentials =
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined;

    // Initialize SES client with provided configuration
    this.client = new SESClient({
      region: config.region,
      credentials,
    });
  }

  /**
   * Sends an email via AWS SES
   *
   * @param options - Email options (to, subject, html, text)
   * @returns Promise resolving to object with messageId
   * @throws Error if SES fails to send the email
   */
  async send(options: EmailOptions): Promise<{ messageId: string }> {
    const { to, subject, html, text } = options;

    // Create the SendEmailCommand with HTML and text body
    const command = new SendEmailCommand({
      Source: this.fromEmail,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
          Text: {
            Data: text,
            Charset: 'UTF-8',
          },
        },
      },
    });

    try {
      const response = await this.client.send(command);

      // SES returns MessageId on success
      const messageId = response.MessageId ?? `ses-${Date.now()}`;

      console.log(`✅ Email sent via AWS SES to ${to} (Message ID: ${messageId})`);

      return { messageId };
    } catch (error) {
      // Handle SES-specific errors
      const sesError = error as Error & { name?: string; Code?: string };
      const errorCode = sesError.Code ?? sesError.name ?? 'UnknownError';
      const errorMessage = sesError.message ?? 'Unknown SES error';

      console.error(`❌ AWS SES error [${errorCode}]:`, errorMessage);

      // Re-throw with more context for upstream handling
      throw new Error(`SES send failed [${errorCode}]: ${errorMessage}`);
    }
  }

  /**
   * Gets the configured sender email address
   */
  get senderEmail(): string {
    return this.fromEmail;
  }

  /**
   * Gets the SES client instance (useful for testing)
   */
  get sesClient(): SESClient {
    return this.client;
  }
}
