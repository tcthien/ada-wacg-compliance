/**
 * SMTP Email Provider Implementation
 *
 * Uses nodemailer to send emails via SMTP.
 * Ideal for local development with Mailpit or other SMTP servers.
 */

import { createTransport, type Transporter } from 'nodemailer';

import type { EmailOptions, EmailProvider } from './email-sender.js';

/**
 * SMTP configuration options
 */
export interface SMTPConfig {
  host: string;
  port: number;
  secure?: boolean; // true for 465, false for other ports
  fromEmail: string;
  auth?: {
    user: string;
    pass: string;
  };
}

/**
 * SMTP email provider implementation
 * Uses nodemailer to send emails via SMTP server
 */
export class SMTPProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly fromEmail: string;

  constructor(config: SMTPConfig) {
    this.fromEmail = config.fromEmail;

    // When secure is explicitly false, also disable STARTTLS for plain SMTP servers like Mailpit
    const useTLS = config.secure ?? false;

    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: useTLS,
      auth: config.auth,
      // For Mailpit and local dev, completely disable TLS
      ignoreTLS: !useTLS,
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log(`📧 SMTP Provider initialized: ${config.host}:${config.port}`);
  }

  async send(options: EmailOptions): Promise<{ messageId: string }> {
    const { to, subject, html, text } = options;

    try {
      const result = await this.transporter.sendMail({
        from: this.fromEmail,
        to,
        subject,
        text,
        html,
      });

      const messageId = result.messageId ?? `smtp-${Date.now()}`;

      console.log(`✅ Email sent via SMTP to ${to} (Message ID: ${messageId})`);

      return { messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ SMTP error sending to ${to}:`, errorMessage);
      throw new Error(`SMTP send failed: ${errorMessage}`);
    }
  }

  /**
   * Verify SMTP connection (useful for health checks)
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection failed:', error);
      return false;
    }
  }
}
