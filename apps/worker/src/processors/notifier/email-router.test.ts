/**
 * Email Router Tests
 *
 * Tests for email routing functionality.
 * Verifies pattern matching, provider selection, and error handling.
 *
 * Per Requirements 6.3, 6.4, 6.5:
 * - Pattern matching for domain, subdomain, prefix, and exact patterns
 * - Case-insensitive matching
 * - Default provider selection when no pattern matches
 * - No automatic fallback on provider error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EmailRoutingConfig } from '../../config/email-routing.config.js';
import type { EmailContent } from './email-templates.js';

// Create mock provider instances at module scope
const mockSendGridSend = vi.fn();
const mockSESSend = vi.fn();

// Mock SendGridProvider - use class syntax for proper constructor mocking
vi.mock('./email-sender.js', () => {
  return {
    SendGridProvider: class MockSendGridProvider {
      constructor() {
        // Constructor called with (apiKey, fromEmail)
      }
      send = mockSendGridSend;
    },
  };
});

// Mock SESProvider - use class syntax for proper constructor mocking
vi.mock('./ses-provider.js', () => {
  return {
    SESProvider: class MockSESProvider {
      constructor() {
        // Constructor called with ({ region, fromEmail })
      }
      send = mockSESSend;
    },
  };
});

// Import after mocking
import { EmailRouter } from './email-router.js';
import { SendGridProvider } from './email-sender.js';
import { SESProvider } from './ses-provider.js';

/**
 * Create a default email routing config for testing
 */
function createRoutingConfig(
  overrides: Partial<EmailRoutingConfig> = {}
): EmailRoutingConfig {
  return {
    defaultProvider: 'SENDGRID',
    providers: {
      SENDGRID: {
        apiKey: 'test-sendgrid-api-key',
        fromEmail: 'noreply@adashield.com',
        patterns: ['*@microsoft.com', '*@outlook.com'],
      },
      SES: {
        region: 'us-east-1',
        fromEmail: 'noreply@adashield.com',
        patterns: ['*@*.edu', '*@company.com'],
      },
    },
    ...overrides,
  };
}

/**
 * Create email content for testing
 */
function createEmailContent(
  overrides: Partial<EmailContent> = {}
): EmailContent {
  return {
    subject: 'Your WCAG Scan Results',
    html: '<h1>Scan Complete</h1><p>Your scan found 5 issues.</p>',
    text: 'Scan Complete\n\nYour scan found 5 issues.',
    ...overrides,
  };
}

describe('EmailRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with SendGrid provider when configured', () => {
      const config = createRoutingConfig({
        providers: {
          SENDGRID: {
            apiKey: 'test-api-key',
            fromEmail: 'test@example.com',
            patterns: [],
          },
        },
      });

      const router = new EmailRouter(config);

      // Verify SendGrid provider is available
      expect(router.hasProvider('SENDGRID')).toBe(true);
      expect(router.providerCount).toBe(1);
      // Verify SES is not configured
      expect(router.hasProvider('SES')).toBe(false);
    });

    it('should initialize with SES provider when configured', () => {
      const config = createRoutingConfig({
        providers: {
          SES: {
            region: 'eu-west-1',
            fromEmail: 'ses@example.com',
            patterns: [],
          },
        },
      });

      const router = new EmailRouter(config);

      // Verify SES provider is available
      expect(router.hasProvider('SES')).toBe(true);
      expect(router.providerCount).toBe(1);
      // Verify SendGrid is not configured
      expect(router.hasProvider('SENDGRID')).toBe(false);
    });

    it('should initialize both providers when both configured', () => {
      const config = createRoutingConfig();

      const router = new EmailRouter(config);

      expect(router.hasProvider('SENDGRID')).toBe(true);
      expect(router.hasProvider('SES')).toBe(true);
      expect(router.providerCount).toBe(2);
    });

    it('should set default provider type correctly', () => {
      const config = createRoutingConfig({ defaultProvider: 'SES' });

      const router = new EmailRouter(config);

      expect(router.defaultProviderType).toBe('SES');
    });
  });

  describe('route - pattern matching', () => {
    describe('domain patterns (*@domain.com)', () => {
      it('should match exact domain pattern', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*@microsoft.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);
        const provider = router.route('user@microsoft.com');

        expect(provider).toBe(router.getProvider('SENDGRID'));
      });

      it('should match with different username prefixes', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*@outlook.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        // Various username patterns should all match
        expect(router.route('john@outlook.com')).toBe(router.getProvider('SENDGRID'));
        expect(router.route('john.doe@outlook.com')).toBe(router.getProvider('SENDGRID'));
        expect(router.route('admin123@outlook.com')).toBe(router.getProvider('SENDGRID'));
      });

      it('should not match subdomain of pattern domain', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*@microsoft.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        // Subdomain should not match the exact domain pattern
        expect(router.route('user@mail.microsoft.com')).toBe(router.getProvider('SES'));
      });
    });

    describe('subdomain wildcard patterns (*@*.domain)', () => {
      it('should match any subdomain with wildcard pattern', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: [],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: ['*@*.edu'],
            },
          },
          defaultProvider: 'SENDGRID',
        });

        const router = new EmailRouter(config);

        expect(router.route('student@university.edu')).toBe(router.getProvider('SES'));
        expect(router.route('prof@stanford.edu')).toBe(router.getProvider('SES'));
        expect(router.route('admin@mit.edu')).toBe(router.getProvider('SES'));
      });

      it('should match nested subdomains with wildcard pattern', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: [],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: ['*@*.company.org'],
            },
          },
          defaultProvider: 'SENDGRID',
        });

        const router = new EmailRouter(config);

        expect(router.route('user@dept.company.org')).toBe(router.getProvider('SES'));
        expect(router.route('admin@hr.company.org')).toBe(router.getProvider('SES'));
      });
    });

    describe('prefix patterns (*-suffix@domain.com)', () => {
      it('should match prefix pattern with hyphen', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*-abc@gmail.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        expect(router.route('user-abc@gmail.com')).toBe(router.getProvider('SENDGRID'));
        expect(router.route('test-abc@gmail.com')).toBe(router.getProvider('SENDGRID'));
      });

      it('should not match emails without the suffix pattern', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*-abc@gmail.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        // These should NOT match and fall back to default
        expect(router.route('user@gmail.com')).toBe(router.getProvider('SES'));
        expect(router.route('user-xyz@gmail.com')).toBe(router.getProvider('SES'));
        expect(router.route('abc@gmail.com')).toBe(router.getProvider('SES'));
      });
    });

    describe('exact match patterns', () => {
      it('should match exact email address', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['admin@example.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        expect(router.route('admin@example.com')).toBe(router.getProvider('SENDGRID'));
      });

      it('should not match different emails with exact pattern', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['admin@example.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        expect(router.route('user@example.com')).toBe(router.getProvider('SES'));
        expect(router.route('admin@other.com')).toBe(router.getProvider('SES'));
      });
    });

    describe('case-insensitive matching (Requirement 6.3)', () => {
      it('should match patterns case-insensitively', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*@Microsoft.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        // All case variations should match
        expect(router.route('user@microsoft.com')).toBe(router.getProvider('SENDGRID'));
        expect(router.route('user@MICROSOFT.COM')).toBe(router.getProvider('SENDGRID'));
        expect(router.route('user@Microsoft.Com')).toBe(router.getProvider('SENDGRID'));
        expect(router.route('USER@MICROSOFT.COM')).toBe(router.getProvider('SENDGRID'));
      });

      it('should match exact patterns case-insensitively', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['Admin@Example.COM'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        expect(router.route('admin@example.com')).toBe(router.getProvider('SENDGRID'));
        expect(router.route('ADMIN@EXAMPLE.COM')).toBe(router.getProvider('SENDGRID'));
      });
    });

    describe('default provider selection', () => {
      it('should use default provider when no pattern matches', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*@specific.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: ['*@another.com'],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        // Email that doesn't match any pattern should use default
        expect(router.route('user@unmatched.com')).toBe(router.getProvider('SES'));
      });

      it('should use default provider when patterns array is empty', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: [],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SENDGRID',
        });

        const router = new EmailRouter(config);

        expect(router.route('any@email.com')).toBe(router.getProvider('SENDGRID'));
      });

      it('should throw error when default provider is not configured', () => {
        const config: EmailRoutingConfig = {
          defaultProvider: 'SES',
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: [],
            },
            // SES is not configured
          },
        };

        const router = new EmailRouter(config);

        expect(() => router.route('user@test.com')).toThrow(
          'Default provider SES is not configured'
        );
      });
    });

    describe('pattern priority', () => {
      it('should use first matching pattern (SendGrid checked before SES)', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*@test.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: ['*@test.com'], // Same pattern
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        // SendGrid is checked first, so it should win
        expect(router.route('user@test.com')).toBe(router.getProvider('SENDGRID'));
      });

      it('should check patterns in order within a provider', () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['admin@test.com', '*@test.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);

        // Both patterns match, but first one should be used
        expect(router.route('admin@test.com')).toBe(router.getProvider('SENDGRID'));
        expect(router.route('user@test.com')).toBe(router.getProvider('SENDGRID'));
      });
    });
  });

  describe('send', () => {
    it('should send email through routed provider and return result', async () => {
      const config = createRoutingConfig({
        providers: {
          SENDGRID: {
            apiKey: 'key',
            fromEmail: 'from@test.com',
            patterns: ['*@sendgrid.com'],
          },
          SES: {
            region: 'us-east-1',
            fromEmail: 'from@test.com',
            patterns: [],
          },
        },
        defaultProvider: 'SES',
      });

      const router = new EmailRouter(config);
      const content = createEmailContent();

      mockSendGridSend.mockResolvedValue({ messageId: 'sg-message-123' });

      const result = await router.send('user@sendgrid.com', content);

      expect(mockSendGridSend).toHaveBeenCalledWith({
        to: 'user@sendgrid.com',
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      expect(result).toEqual({
        messageId: 'sg-message-123',
        provider: 'SENDGRID',
      });
    });

    it('should return correct provider name for SES', async () => {
      const config = createRoutingConfig({
        providers: {
          SENDGRID: {
            apiKey: 'key',
            fromEmail: 'from@test.com',
            patterns: [],
          },
          SES: {
            region: 'us-east-1',
            fromEmail: 'from@test.com',
            patterns: ['*@ses.com'],
          },
        },
        defaultProvider: 'SENDGRID',
      });

      const router = new EmailRouter(config);
      const content = createEmailContent();

      mockSESSend.mockResolvedValue({ messageId: 'ses-message-456' });

      const result = await router.send('user@ses.com', content);

      expect(result).toEqual({
        messageId: 'ses-message-456',
        provider: 'SES',
      });
    });

    it('should use default provider when no pattern matches', async () => {
      const config = createRoutingConfig({
        providers: {
          SENDGRID: {
            apiKey: 'key',
            fromEmail: 'from@test.com',
            patterns: ['*@specific.com'],
          },
          SES: {
            region: 'us-east-1',
            fromEmail: 'from@test.com',
            patterns: [],
          },
        },
        defaultProvider: 'SES',
      });

      const router = new EmailRouter(config);
      const content = createEmailContent();

      mockSESSend.mockResolvedValue({ messageId: 'ses-default-789' });

      const result = await router.send('user@unmatched.com', content);

      expect(mockSESSend).toHaveBeenCalled();
      expect(result.provider).toBe('SES');
    });

    describe('no fallback on provider error (Requirement 6.5)', () => {
      it('should propagate provider error without fallback', async () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: ['*@test.com'],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);
        const content = createEmailContent();

        const providerError = new Error('SendGrid API rate limit exceeded');
        mockSendGridSend.mockRejectedValue(providerError);

        // Error should propagate, not fall back to SES
        await expect(router.send('user@test.com', content)).rejects.toThrow(
          'SendGrid API rate limit exceeded'
        );

        // SES should NOT have been called as fallback
        expect(mockSESSend).not.toHaveBeenCalled();
      });

      it('should propagate SES provider error without fallback', async () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: [],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: ['*@ses-route.com'],
            },
          },
          defaultProvider: 'SENDGRID',
        });

        const router = new EmailRouter(config);
        const content = createEmailContent();

        const sesError = new Error('SES MessageRejected: Email address not verified');
        mockSESSend.mockRejectedValue(sesError);

        // Error should propagate, not fall back to SendGrid
        await expect(router.send('user@ses-route.com', content)).rejects.toThrow(
          'SES MessageRejected: Email address not verified'
        );

        // SendGrid should NOT have been called as fallback
        expect(mockSendGridSend).not.toHaveBeenCalled();
      });

      it('should propagate default provider error', async () => {
        const config = createRoutingConfig({
          providers: {
            SENDGRID: {
              apiKey: 'key',
              fromEmail: 'from@test.com',
              patterns: [],
            },
            SES: {
              region: 'us-east-1',
              fromEmail: 'from@test.com',
              patterns: [],
            },
          },
          defaultProvider: 'SES',
        });

        const router = new EmailRouter(config);
        const content = createEmailContent();

        const defaultError = new Error('Default provider failed');
        mockSESSend.mockRejectedValue(defaultError);

        await expect(router.send('user@any.com', content)).rejects.toThrow(
          'Default provider failed'
        );
      });
    });
  });

  describe('accessors', () => {
    it('should return default provider type via defaultProviderType getter', () => {
      const config = createRoutingConfig({ defaultProvider: 'SES' });
      const router = new EmailRouter(config);

      expect(router.defaultProviderType).toBe('SES');
    });

    it('should return correct provider count', () => {
      const config = createRoutingConfig();
      const router = new EmailRouter(config);

      expect(router.providerCount).toBe(2);
    });

    it('should correctly check if provider exists with hasProvider', () => {
      const config = createRoutingConfig({
        providers: {
          SENDGRID: {
            apiKey: 'key',
            fromEmail: 'from@test.com',
            patterns: [],
          },
        },
      });

      const router = new EmailRouter(config);

      expect(router.hasProvider('SENDGRID')).toBe(true);
      expect(router.hasProvider('SES')).toBe(false);
    });

    it('should return provider instance via getProvider', () => {
      const config = createRoutingConfig();
      const router = new EmailRouter(config);

      const sendgridProvider = router.getProvider('SENDGRID');
      const sesProvider = router.getProvider('SES');

      expect(sendgridProvider).toBeDefined();
      expect(sesProvider).toBeDefined();
    });

    it('should return undefined for unconfigured provider via getProvider', () => {
      const config = createRoutingConfig({
        providers: {
          SENDGRID: {
            apiKey: 'key',
            fromEmail: 'from@test.com',
            patterns: [],
          },
        },
      });

      const router = new EmailRouter(config);

      expect(router.getProvider('SES')).toBeUndefined();
    });
  });
});
