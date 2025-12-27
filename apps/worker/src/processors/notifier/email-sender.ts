/**
 * Email Provider Interface and Implementations
 *
 * Provides a flexible email sending interface that can be implemented
 * by different email service providers (SendGrid, AWS SES, etc.)
 */

/**
 * Email sending options
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Email provider interface
 * Can be implemented by different email services
 */
export interface EmailProvider {
  send(options: EmailOptions): Promise<{ messageId: string }>;
}

/**
 * SendGrid email provider implementation
 * Uses SendGrid API v3 to send transactional emails
 */
export class SendGridProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly fromEmail: string;

  constructor(apiKey: string, fromEmail: string = 'noreply@adashield.com') {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async send(options: EmailOptions): Promise<{ messageId: string }> {
    const { to, subject, html, text } = options;

    const payload = {
      personalizations: [
        {
          to: [{ email: to }],
          subject,
        },
      ],
      from: { email: this.fromEmail },
      content: [
        {
          type: 'text/plain',
          value: text,
        },
        {
          type: 'text/html',
          value: html,
        },
      ],
    };

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `SendGrid API error: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      // SendGrid returns 202 Accepted with X-Message-Id header
      const messageId = response.headers.get('X-Message-Id') ?? `sg-${Date.now()}`;

      console.log(`✅ Email sent via SendGrid to ${to} (Message ID: ${messageId})`);

      return { messageId };
    } catch (error) {
      console.error('❌ SendGrid error:', error);
      throw error;
    }
  }
}

/**
 * Stub email provider for testing/development
 * Logs emails instead of sending them
 */
export class StubEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<{ messageId: string }> {
    const { to, subject } = options;
    const messageId = `stub-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log('📧 [STUB] Email would be sent:');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Message ID: ${messageId}`);

    return { messageId };
  }
}

/**
 * Factory function to create the appropriate email provider
 * based on environment configuration
 *
 * @param apiKey - SendGrid API key (optional)
 * @param fromEmail - Sender email address (optional)
 * @returns EmailProvider instance
 */
export function createEmailProvider(
  apiKey?: string,
  fromEmail?: string
): EmailProvider {
  if (!apiKey) {
    console.warn('⚠️  SENDGRID_API_KEY not set, using stub email provider');
    return new StubEmailProvider();
  }

  return new SendGridProvider(apiKey, fromEmail);
}
