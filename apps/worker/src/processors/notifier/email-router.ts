/**
 * Email Router
 *
 * Central router for email provider selection based on routing configuration.
 * Supports pattern-based routing to different email providers (SendGrid, SES).
 *
 * Per Requirement 6.4:
 * - Initializes provider instances based on configuration
 * - Stores providers in Map for efficient lookup
 * - Provides routing and sending capabilities
 */

import { minimatch } from 'minimatch';
import type {
  EmailRoutingConfig,
  EmailProviderType,
} from '../../config/email-routing.config.js';
import type { EmailProvider } from './email-sender.js';
import { SendGridProvider } from './email-sender.js';
import { SESProvider } from './ses-provider.js';
import { SMTPProvider } from './smtp-provider.js';
import type { EmailContent } from './email-templates.js';

/**
 * Result of sending an email through the router
 */
export interface EmailSendResult {
  /** Unique message ID from the provider */
  messageId: string;
  /** Name of the provider that sent the email */
  provider: string;
}

/**
 * Email Router class
 *
 * Manages email provider instances and routes emails to the appropriate
 * provider based on configured patterns.
 */
export class EmailRouter {
  private readonly config: EmailRoutingConfig;
  private readonly providers: Map<EmailProviderType, EmailProvider>;

  /**
   * Creates a new EmailRouter instance
   *
   * @param config - Email routing configuration with provider settings and patterns
   */
  constructor(config: EmailRoutingConfig) {
    this.config = config;
    this.providers = new Map();

    this.initializeProviders();
  }

  /**
   * Initialize provider instances based on configuration
   *
   * Creates provider instances for each configured provider and stores
   * them in the providers Map for efficient lookup during routing.
   */
  private initializeProviders(): void {
    // Initialize SendGrid provider if configured
    if (this.config.providers.SENDGRID) {
      const sendgridConfig = this.config.providers.SENDGRID;
      const provider = new SendGridProvider(
        sendgridConfig.apiKey,
        sendgridConfig.fromEmail
      );
      this.providers.set('SENDGRID', provider);
      console.log('  EmailRouter: SendGrid provider initialized');
    }

    // Initialize SES provider if configured
    if (this.config.providers.SES) {
      const sesConfig = this.config.providers.SES;
      const provider = new SESProvider({
        region: sesConfig.region,
        fromEmail: sesConfig.fromEmail,
      });
      this.providers.set('SES', provider);
      console.log('  EmailRouter: SES provider initialized');
    }

    // Initialize SMTP provider if configured (for local dev with Mailpit, etc.)
    if (this.config.providers.SMTP) {
      const smtpConfig = this.config.providers.SMTP;
      const provider = new SMTPProvider({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        fromEmail: smtpConfig.fromEmail,
      });
      this.providers.set('SMTP', provider);
      console.log('  EmailRouter: SMTP provider initialized');
    }

    // Log initialization summary
    console.log(
      `  EmailRouter: ${this.providers.size} provider(s) initialized, ` +
        `default: ${this.config.defaultProvider}`
    );
  }

  /**
   * Find matching provider for email address
   *
   * Routes the email to the appropriate provider based on configured patterns.
   * Patterns are checked in order: first match wins.
   * Falls back to the default provider if no pattern matches.
   *
   * Per Requirement 6.3 and 6.4:
   * - Supports domain match: `*@microsoft.com`
   * - Supports subdomain wildcard: `*@*.edu`
   * - Supports prefix pattern: `*-abc@gmail.com`
   * - Supports exact match: `admin@example.com`
   * - Pattern matching is case-insensitive
   *
   * @param email - The recipient email address to route
   * @returns The EmailProvider instance to use for this email
   */
  route(email: string): EmailProvider {
    // Iterate through all configured providers and their patterns
    // Check patterns in order: first match wins
    const providerTypes: EmailProviderType[] = ['SENDGRID', 'SES', 'SMTP'];

    for (const providerType of providerTypes) {
      const providerConfig = this.config.providers[providerType];

      // Skip if provider not configured or no patterns defined
      if (!providerConfig || !providerConfig.patterns) {
        continue;
      }

      // Check each pattern for this provider
      for (const pattern of providerConfig.patterns) {
        // Use minimatch with nocase option for case-insensitive matching
        // Per Requirement 6.3: Pattern matching SHALL be case-insensitive
        if (minimatch(email, pattern, { nocase: true })) {
          const matchedProvider = this.providers.get(providerType);

          if (matchedProvider) {
            console.log(
              `  EmailRouter: Matched pattern "${pattern}" for "${email}" -> ${providerType}`
            );
            return matchedProvider;
          }
        }
      }
    }

    // No pattern matched, return the default provider
    const defaultProvider = this.providers.get(this.config.defaultProvider);

    if (!defaultProvider) {
      throw new Error(
        `Default provider ${this.config.defaultProvider} is not configured`
      );
    }

    console.log(
      `  EmailRouter: No pattern matched for "${email}" -> using default ${this.config.defaultProvider}`
    );

    return defaultProvider;
  }

  /**
   * Send email through routed provider
   *
   * Determines the appropriate provider for the recipient email address
   * and sends the email through that provider.
   *
   * Per Requirement 6.4:
   * - Routes email to appropriate provider based on patterns
   * - Returns message ID and provider name for logging
   *
   * Per Requirement 6.5:
   * - Does NOT fall back to another provider on failure
   * - Lets errors propagate to caller for retry handling
   *
   * @param to - Recipient email address
   * @param content - Email content (subject, html, text)
   * @returns Promise resolving to the message ID and provider name
   * @throws Error if provider fails (no automatic fallback per Req 6.5)
   */
  async send(to: string, content: EmailContent): Promise<EmailSendResult> {
    // Route to appropriate provider based on email patterns
    const provider = this.route(to);

    // Find the provider name for logging
    const providerName = this.getProviderName(provider);

    // Create EmailOptions from content and recipient
    const emailOptions = {
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    };

    // Send through the routed provider
    // Per Requirement 6.5: Do NOT catch/fallback on provider failure
    // Let errors propagate to caller for retry handling
    const result = await provider.send(emailOptions);

    return {
      messageId: result.messageId,
      provider: providerName,
    };
  }

  /**
   * Get the provider name from a provider instance
   *
   * @param provider - The provider instance to identify
   * @returns The provider name (e.g., 'SENDGRID', 'SES') or 'UNKNOWN'
   */
  private getProviderName(provider: EmailProvider): string {
    // Iterate through provider types to find matching instance
    const providerTypes: EmailProviderType[] = ['SENDGRID', 'SES', 'SMTP'];

    for (const providerType of providerTypes) {
      const instance = this.providers.get(providerType);
      if (instance === provider) {
        return providerType;
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Get the default provider type
   */
  get defaultProviderType(): EmailProviderType {
    return this.config.defaultProvider;
  }

  /**
   * Get the number of initialized providers
   */
  get providerCount(): number {
    return this.providers.size;
  }

  /**
   * Check if a specific provider is available
   *
   * @param providerType - The provider type to check
   * @returns True if the provider is initialized and available
   */
  hasProvider(providerType: EmailProviderType): boolean {
    return this.providers.has(providerType);
  }

  /**
   * Get a specific provider by type (for testing purposes)
   *
   * @param providerType - The provider type to retrieve
   * @returns The provider instance or undefined if not available
   */
  getProvider(providerType: EmailProviderType): EmailProvider | undefined {
    return this.providers.get(providerType);
  }
}
