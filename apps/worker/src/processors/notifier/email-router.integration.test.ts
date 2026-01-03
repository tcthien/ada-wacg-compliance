/**
 * Email Router Integration Tests
 *
 * Integration tests for email routing functionality.
 * Tests the integration between configuration loading and the email router.
 *
 * These tests verify:
 * - Configuration loading from environment variables
 * - Provider selection for various email patterns
 * - End-to-end send flow with stubbed providers
 *
 * Per Requirements 6.2, 6.4:
 * - Configuration loading from .env
 * - Provider selection based on patterns
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EmailContent } from './email-templates.js';

// Store original process.env
const originalEnv = { ...process.env };

// Create mock provider send functions
const mockSendGridSend = vi.fn();
const mockSESSend = vi.fn();

// Mock SendGridProvider
vi.mock('./email-sender.js', () => {
  return {
    SendGridProvider: class MockSendGridProvider {
      private apiKey: string;
      private fromEmail: string;

      constructor(apiKey: string, fromEmail: string) {
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
      }

      get config() {
        return { apiKey: this.apiKey, fromEmail: this.fromEmail };
      }

      send = mockSendGridSend;
    },
  };
});

// Mock SESProvider
vi.mock('./ses-provider.js', () => {
  return {
    SESProvider: class MockSESProvider {
      private region: string;
      private fromEmail: string;

      constructor(config: { region: string; fromEmail: string }) {
        this.region = config.region;
        this.fromEmail = config.fromEmail;
      }

      get config() {
        return { region: this.region, fromEmail: this.fromEmail };
      }

      send = mockSESSend;
    },
  };
});

// Import after mocking - use dynamic imports to ensure fresh module state
async function importModules() {
  // Clear module cache for fresh imports
  vi.resetModules();

  const emailRoutingConfigModule = await import('../../config/email-routing.config.js');
  const emailRouterModule = await import('./email-router.js');

  return {
    loadEmailRoutingConfig: emailRoutingConfigModule.loadEmailRoutingConfig,
    EmailRouter: emailRouterModule.EmailRouter,
  };
}

/**
 * Create email content for testing
 */
function createEmailContent(overrides: Partial<EmailContent> = {}): EmailContent {
  return {
    subject: 'WCAG Scan Results for https://example.com',
    html: '<h1>Scan Complete</h1><p>Your scan found 5 issues.</p>',
    text: 'Scan Complete\n\nYour scan found 5 issues.',
    ...overrides,
  };
}

/**
 * Set up environment variables for testing
 */
function setupEnv(envVars: Record<string, string>): void {
  // Clear all email-related env vars first
  delete process.env['EMAIL_DEFAULT_PROVIDER'];
  delete process.env['EMAIL_SENDGRID_PATTERNS'];
  delete process.env['EMAIL_SES_PATTERNS'];
  delete process.env['SENDGRID_API_KEY'];
  delete process.env['SMTP_FROM'];
  delete process.env['AWS_SES_REGION'];

  // Set the provided env vars
  Object.entries(envVars).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Restore original environment
 */
function restoreEnv(): void {
  // Clear all keys
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('EMAIL_') || key.startsWith('AWS_') || key === 'SENDGRID_API_KEY' || key === 'SMTP_FROM') {
      delete process.env[key];
    }
  });

  // Restore original values
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (value !== undefined) {
      process.env[key] = value;
    }
  });
}

describe('EmailRouter Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log/warn during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  describe('Configuration Loading from Environment Variables', () => {
    it('should load SES as default provider from .env', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      expect(router.defaultProviderType).toBe('SES');
      expect(router.hasProvider('SES')).toBe(true);
    });

    it('should load SendGrid as default provider from .env', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SENDGRID',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      expect(router.defaultProviderType).toBe('SENDGRID');
      expect(router.hasProvider('SENDGRID')).toBe(true);
    });

    it('should load SendGrid patterns from .env', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@microsoft.com,*@outlook.com,*@hotmail.com',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      // Verify patterns route correctly
      mockSendGridSend.mockResolvedValue({ messageId: 'sg-123' });
      mockSESSend.mockResolvedValue({ messageId: 'ses-123' });

      const result = await router.send('user@microsoft.com', createEmailContent());
      expect(result.provider).toBe('SENDGRID');
      expect(mockSendGridSend).toHaveBeenCalled();
    });

    it('should load SES patterns from .env', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SENDGRID',
        EMAIL_SES_PATTERNS: '*@*.edu,*@company.com',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      // Verify patterns route correctly
      mockSendGridSend.mockResolvedValue({ messageId: 'sg-123' });
      mockSESSend.mockResolvedValue({ messageId: 'ses-123' });

      const result = await router.send('student@stanford.edu', createEmailContent());
      expect(result.provider).toBe('SES');
      expect(mockSESSend).toHaveBeenCalled();
    });

    it('should load both provider patterns from .env', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@microsoft.com,*@outlook.com',
        EMAIL_SES_PATTERNS: '*@*.edu',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      expect(router.hasProvider('SENDGRID')).toBe(true);
      expect(router.hasProvider('SES')).toBe(true);
      expect(router.providerCount).toBe(2);
    });

    it('should use default AWS region us-east-1 when not specified', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        SMTP_FROM: 'noreply@adashield.com',
        // AWS_SES_REGION intentionally not set
      });

      const { loadEmailRoutingConfig } = await importModules();
      const config = loadEmailRoutingConfig();

      // Default region should be us-east-1
      expect(config.providers.SES?.region).toBe('us-east-1');
    });

    it('should use custom AWS region when specified', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'eu-west-1',
      });

      const { loadEmailRoutingConfig } = await importModules();
      const config = loadEmailRoutingConfig();

      expect(config.providers.SES?.region).toBe('eu-west-1');
    });

    it('should fail fast with clear error when default provider is not configured', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SENDGRID',
        // SENDGRID_API_KEY intentionally not set - should cause error
        SMTP_FROM: 'noreply@adashield.com',
      });

      const { loadEmailRoutingConfig } = await importModules();

      expect(() => loadEmailRoutingConfig()).toThrow(/SENDGRID.*configuration.*missing/i);
    });
  });

  describe('Provider Selection for Email Patterns', () => {
    it('should route Microsoft emails to SendGrid based on pattern', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@microsoft.com,*@outlook.com,*@hotmail.com',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSendGridSend.mockResolvedValue({ messageId: 'sg-msg-001' });

      // Test various Microsoft domain emails
      const microsoftResult = await router.send('john@microsoft.com', createEmailContent());
      expect(microsoftResult.provider).toBe('SENDGRID');

      mockSendGridSend.mockClear();
      const outlookResult = await router.send('jane@outlook.com', createEmailContent());
      expect(outlookResult.provider).toBe('SENDGRID');

      mockSendGridSend.mockClear();
      const hotmailResult = await router.send('bob@hotmail.com', createEmailContent());
      expect(hotmailResult.provider).toBe('SENDGRID');
    });

    it('should route .edu emails to SES based on subdomain wildcard pattern', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SENDGRID',
        EMAIL_SES_PATTERNS: '*@*.edu',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSESSend.mockResolvedValue({ messageId: 'ses-msg-001' });

      // Test various .edu domain emails
      const stanfordResult = await router.send('student@stanford.edu', createEmailContent());
      expect(stanfordResult.provider).toBe('SES');

      mockSESSend.mockClear();
      const mitResult = await router.send('prof@mit.edu', createEmailContent());
      expect(mitResult.provider).toBe('SES');

      mockSESSend.mockClear();
      const harvardResult = await router.send('admin@cs.harvard.edu', createEmailContent());
      expect(harvardResult.provider).toBe('SES');
    });

    it('should route emails with prefix pattern correctly', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*-abc@gmail.com',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSendGridSend.mockResolvedValue({ messageId: 'sg-msg-001' });
      mockSESSend.mockResolvedValue({ messageId: 'ses-msg-001' });

      // Should match prefix pattern
      const matchResult = await router.send('user-abc@gmail.com', createEmailContent());
      expect(matchResult.provider).toBe('SENDGRID');

      // Should NOT match and use default
      mockSendGridSend.mockClear();
      const noMatchResult = await router.send('user@gmail.com', createEmailContent());
      expect(noMatchResult.provider).toBe('SES');
    });

    it('should use default provider when no pattern matches', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@microsoft.com',
        EMAIL_SES_PATTERNS: '*@specific.org',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSESSend.mockResolvedValue({ messageId: 'ses-default-001' });

      // Email that doesn't match any pattern should use default (SES)
      const result = await router.send('user@random-domain.com', createEmailContent());
      expect(result.provider).toBe('SES');
      expect(mockSESSend).toHaveBeenCalled();
      expect(mockSendGridSend).not.toHaveBeenCalled();
    });

    it('should perform case-insensitive pattern matching', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@Microsoft.COM',
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSendGridSend.mockResolvedValue({ messageId: 'sg-msg-001' });

      // All case variations should match
      const lowerResult = await router.send('user@microsoft.com', createEmailContent());
      expect(lowerResult.provider).toBe('SENDGRID');

      mockSendGridSend.mockClear();
      const upperResult = await router.send('USER@MICROSOFT.COM', createEmailContent());
      expect(upperResult.provider).toBe('SENDGRID');

      mockSendGridSend.mockClear();
      const mixedResult = await router.send('User@MicroSoft.Com', createEmailContent());
      expect(mixedResult.provider).toBe('SENDGRID');
    });

    it('should check SendGrid patterns before SES patterns (first match wins)', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@test.com',
        EMAIL_SES_PATTERNS: '*@test.com', // Same pattern
        SENDGRID_API_KEY: 'SG.test-api-key-123',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSendGridSend.mockResolvedValue({ messageId: 'sg-msg-001' });

      // SendGrid should win since it's checked first
      const result = await router.send('user@test.com', createEmailContent());
      expect(result.provider).toBe('SENDGRID');
      expect(mockSendGridSend).toHaveBeenCalled();
      expect(mockSESSend).not.toHaveBeenCalled();
    });
  });

  describe('End-to-End Send with Stubbed Providers', () => {
    it('should complete full send flow through SendGrid', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@sendgrid-route.com',
        SENDGRID_API_KEY: 'SG.integration-test-key',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      const expectedMessageId = 'sg-e2e-12345';
      mockSendGridSend.mockResolvedValue({ messageId: expectedMessageId });

      const content = createEmailContent({
        subject: 'Integration Test - SendGrid Route',
        html: '<h1>Test Email</h1><p>This is a test.</p>',
        text: 'Test Email\n\nThis is a test.',
      });

      const result = await router.send('recipient@sendgrid-route.com', content);

      expect(result).toEqual({
        messageId: expectedMessageId,
        provider: 'SENDGRID',
      });

      expect(mockSendGridSend).toHaveBeenCalledWith({
        to: 'recipient@sendgrid-route.com',
        subject: 'Integration Test - SendGrid Route',
        html: '<h1>Test Email</h1><p>This is a test.</p>',
        text: 'Test Email\n\nThis is a test.',
      });
    });

    it('should complete full send flow through SES', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SENDGRID',
        EMAIL_SES_PATTERNS: '*@ses-route.com',
        SENDGRID_API_KEY: 'SG.integration-test-key',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-west-2',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      const expectedMessageId = 'ses-e2e-67890';
      mockSESSend.mockResolvedValue({ messageId: expectedMessageId });

      const content = createEmailContent({
        subject: 'Integration Test - SES Route',
      });

      const result = await router.send('recipient@ses-route.com', content);

      expect(result).toEqual({
        messageId: expectedMessageId,
        provider: 'SES',
      });

      expect(mockSESSend).toHaveBeenCalledWith({
        to: 'recipient@ses-route.com',
        subject: 'Integration Test - SES Route',
        html: content.html,
        text: content.text,
      });
    });

    it('should complete full send flow using default provider', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@specific-only.com',
        SENDGRID_API_KEY: 'SG.integration-test-key',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      const expectedMessageId = 'ses-default-route-001';
      mockSESSend.mockResolvedValue({ messageId: expectedMessageId });

      const content = createEmailContent();
      const result = await router.send('user@any-other-domain.com', content);

      expect(result).toEqual({
        messageId: expectedMessageId,
        provider: 'SES',
      });

      // SendGrid should NOT have been called
      expect(mockSendGridSend).not.toHaveBeenCalled();
    });

    it('should propagate provider errors without fallback', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@error-test.com',
        SENDGRID_API_KEY: 'SG.integration-test-key',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      const providerError = new Error('SendGrid API rate limit exceeded');
      mockSendGridSend.mockRejectedValue(providerError);

      const content = createEmailContent();

      // Error should propagate without falling back to SES
      await expect(router.send('user@error-test.com', content)).rejects.toThrow(
        'SendGrid API rate limit exceeded'
      );

      // SES should NOT have been called as fallback
      expect(mockSESSend).not.toHaveBeenCalled();
    });

    it('should handle multiple sends with different routing decisions', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@microsoft.com,*@outlook.com',
        EMAIL_SES_PATTERNS: '*@*.edu',
        SENDGRID_API_KEY: 'SG.integration-test-key',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      // Set up mock responses
      let sendGridCallCount = 0;
      let sesCallCount = 0;

      mockSendGridSend.mockImplementation(() => {
        sendGridCallCount++;
        return Promise.resolve({ messageId: `sg-${sendGridCallCount}` });
      });

      mockSESSend.mockImplementation(() => {
        sesCallCount++;
        return Promise.resolve({ messageId: `ses-${sesCallCount}` });
      });

      const content = createEmailContent();

      // Send to Microsoft domain -> SendGrid
      const result1 = await router.send('user@microsoft.com', content);
      expect(result1.provider).toBe('SENDGRID');

      // Send to .edu domain -> SES
      const result2 = await router.send('student@university.edu', content);
      expect(result2.provider).toBe('SES');

      // Send to Outlook domain -> SendGrid
      const result3 = await router.send('contact@outlook.com', content);
      expect(result3.provider).toBe('SENDGRID');

      // Send to random domain -> Default (SES)
      const result4 = await router.send('random@example.com', content);
      expect(result4.provider).toBe('SES');

      // Verify call counts
      expect(sendGridCallCount).toBe(2);
      expect(sesCallCount).toBe(2);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty pattern strings gracefully', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '', // Empty string
        SENDGRID_API_KEY: 'SG.test-key',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSESSend.mockResolvedValue({ messageId: 'ses-001' });

      // All emails should go to default (SES) since no patterns are configured
      const result = await router.send('anyone@anywhere.com', createEmailContent());
      expect(result.provider).toBe('SES');
    });

    it('should handle patterns with extra whitespace', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '  *@microsoft.com  ,  *@outlook.com  ', // Extra whitespace
        SENDGRID_API_KEY: 'SG.test-key',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSendGridSend.mockResolvedValue({ messageId: 'sg-001' });

      // Patterns should still work despite whitespace
      const result = await router.send('user@microsoft.com', createEmailContent());
      expect(result.provider).toBe('SENDGRID');
    });

    it('should work with only one provider configured', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        // No SendGrid patterns or API key
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      expect(router.hasProvider('SES')).toBe(true);
      expect(router.hasProvider('SENDGRID')).toBe(false);
      expect(router.providerCount).toBe(1);

      mockSESSend.mockResolvedValue({ messageId: 'ses-only-001' });

      const result = await router.send('user@any.com', createEmailContent());
      expect(result.provider).toBe('SES');
    });

    it('should log routing configuration at startup', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@microsoft.com',
        SENDGRID_API_KEY: 'SG.test-key',
        SMTP_FROM: 'noreply@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig } = await importModules();
      loadEmailRoutingConfig();

      // Verify configuration was logged (per Requirement 6.6)
      expect(consoleSpy).toHaveBeenCalled();
      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('SES');
    });
  });

  describe('Real-World Routing Scenarios', () => {
    it('should handle typical enterprise configuration', async () => {
      // Typical configuration: SendGrid for Microsoft ecosystem, SES for everything else
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@microsoft.com,*@outlook.com,*@hotmail.com,*@live.com',
        SENDGRID_API_KEY: 'SG.enterprise-key',
        SMTP_FROM: 'notifications@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSendGridSend.mockResolvedValue({ messageId: 'sg-enterprise' });
      mockSESSend.mockResolvedValue({ messageId: 'ses-enterprise' });

      const content = createEmailContent({
        subject: 'Your Accessibility Scan Results - https://example.com',
      });

      // Enterprise Microsoft user -> SendGrid
      const msResult = await router.send('admin@microsoft.com', content);
      expect(msResult.provider).toBe('SENDGRID');

      // Personal Hotmail user -> SendGrid
      mockSendGridSend.mockClear();
      const hotmailResult = await router.send('personal@hotmail.com', content);
      expect(hotmailResult.provider).toBe('SENDGRID');

      // Regular business user -> SES (default)
      mockSESSend.mockClear();
      const businessResult = await router.send('contact@acme-corp.com', content);
      expect(businessResult.provider).toBe('SES');

      // Educational institution -> SES (default, no .edu pattern here)
      mockSESSend.mockClear();
      const eduResult = await router.send('faculty@university.edu', content);
      expect(eduResult.provider).toBe('SES');
    });

    it('should handle mixed pattern types in single configuration', async () => {
      setupEnv({
        EMAIL_DEFAULT_PROVIDER: 'SES',
        EMAIL_SENDGRID_PATTERNS: '*@microsoft.com,admin@specific.com,*-vip@gmail.com',
        EMAIL_SES_PATTERNS: '*@*.edu,*@*.gov',
        SENDGRID_API_KEY: 'SG.mixed-patterns-key',
        SMTP_FROM: 'notifications@adashield.com',
        AWS_SES_REGION: 'us-east-1',
      });

      const { loadEmailRoutingConfig, EmailRouter } = await importModules();
      const config = loadEmailRoutingConfig();
      const router = new EmailRouter(config);

      mockSendGridSend.mockResolvedValue({ messageId: 'sg-mixed' });
      mockSESSend.mockResolvedValue({ messageId: 'ses-mixed' });

      const content = createEmailContent();

      // Domain wildcard pattern -> SendGrid
      const domainResult = await router.send('anyone@microsoft.com', content);
      expect(domainResult.provider).toBe('SENDGRID');

      // Exact match pattern -> SendGrid
      mockSendGridSend.mockClear();
      const exactResult = await router.send('admin@specific.com', content);
      expect(exactResult.provider).toBe('SENDGRID');

      // Prefix pattern -> SendGrid
      mockSendGridSend.mockClear();
      const prefixResult = await router.send('user-vip@gmail.com', content);
      expect(prefixResult.provider).toBe('SENDGRID');

      // TLD wildcard pattern -> SES
      mockSESSend.mockClear();
      const eduResult = await router.send('researcher@stanford.edu', content);
      expect(eduResult.provider).toBe('SES');

      // Government TLD pattern -> SES
      mockSESSend.mockClear();
      const govResult = await router.send('official@agency.gov', content);
      expect(govResult.provider).toBe('SES');

      // No match -> Default (SES)
      mockSESSend.mockClear();
      const defaultResult = await router.send('regular@example.com', content);
      expect(defaultResult.provider).toBe('SES');
    });
  });
});
