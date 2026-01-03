/**
 * AWS SES Provider Tests
 *
 * Tests for AWS SES email provider implementation.
 * Verifies email sending, configuration, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EmailOptions } from './email-sender.js';

// Create mock functions at module scope
const mockSend = vi.fn();
const mockSESClientConstructor = vi.fn();
const mockSendEmailCommandConstructor = vi.fn();

// Mock AWS SES client before importing the module
vi.mock('@aws-sdk/client-ses', () => {
  return {
    SESClient: class MockSESClient {
      constructor(config: unknown) {
        mockSESClientConstructor(config);
      }
      send = mockSend;
    },
    SendEmailCommand: class MockSendEmailCommand {
      constructor(params: unknown) {
        mockSendEmailCommandConstructor(params);
        Object.assign(this, params);
      }
    },
  };
});

// Import after mocking
import { SESProvider, type SESConfig } from './ses-provider.js';

/**
 * Create a default SES config for testing
 */
function createSESConfig(overrides: Partial<SESConfig> = {}): SESConfig {
  return {
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    fromEmail: 'noreply@adashield.com',
    ...overrides,
  };
}

/**
 * Create email options for testing
 */
function createEmailOptions(overrides: Partial<EmailOptions> = {}): EmailOptions {
  return {
    to: 'user@example.com',
    subject: 'Your WCAG Scan Results',
    html: '<h1>Scan Complete</h1><p>Your scan found 5 issues.</p>',
    text: 'Scan Complete\n\nYour scan found 5 issues.',
    ...overrides,
  };
}

describe('SESProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with explicit credentials', () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);

      expect(provider.senderEmail).toBe('noreply@adashield.com');
      expect(provider.sesClient).toBeDefined();

      // Verify SESClient was called with correct config including credentials
      expect(mockSESClientConstructor).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      });
    });

    it('should initialize without explicit credentials (IAM role)', () => {
      const config = createSESConfig({
        accessKeyId: undefined,
        secretAccessKey: undefined,
      });
      const provider = new SESProvider(config);

      expect(provider.senderEmail).toBe('noreply@adashield.com');
      expect(provider.sesClient).toBeDefined();

      // Verify SESClient was called without credentials
      expect(mockSESClientConstructor).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: undefined,
      });
    });

    it('should use provided region', () => {
      const config = createSESConfig({ region: 'eu-west-1' });

      new SESProvider(config);

      expect(mockSESClientConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'eu-west-1',
        })
      );
    });

    it('should use provided fromEmail', () => {
      const config = createSESConfig({ fromEmail: 'support@custom.com' });
      const provider = new SESProvider(config);

      expect(provider.senderEmail).toBe('support@custom.com');
    });
  });

  describe('send', () => {
    it('should send email successfully and return messageId', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      mockSend.mockResolvedValue({
        MessageId: 'ses-message-12345',
      });

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        messageId: 'ses-message-12345',
      });
    });

    it('should generate fallback messageId when SES returns undefined', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      mockSend.mockResolvedValue({
        MessageId: undefined,
      });

      const result = await provider.send(emailOptions);

      expect(result.messageId).toMatch(/^ses-\d+$/);
    });

    it('should construct SendEmailCommand with correct parameters', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        html: '<p>HTML content</p>',
        text: 'Text content',
      });

      mockSend.mockResolvedValue({ MessageId: 'test-id' });

      await provider.send(emailOptions);

      expect(mockSendEmailCommandConstructor).toHaveBeenCalledWith({
        Source: 'noreply@adashield.com',
        Destination: {
          ToAddresses: ['recipient@test.com'],
        },
        Message: {
          Subject: {
            Data: 'Test Subject',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: '<p>HTML content</p>',
              Charset: 'UTF-8',
            },
            Text: {
              Data: 'Text content',
              Charset: 'UTF-8',
            },
          },
        },
      });
    });

    it('should log success message with email and messageId', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions({ to: 'test@example.com' });

      mockSend.mockResolvedValue({ MessageId: 'msg-123' });

      await provider.send(emailOptions);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email sent via AWS SES to test@example.com')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('msg-123'));

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should throw error with SES error code when send fails', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      const sesError = new Error('Invalid email address') as Error & {
        Code?: string;
      };
      sesError.Code = 'InvalidParameterValue';

      mockSend.mockRejectedValue(sesError);

      await expect(provider.send(emailOptions)).rejects.toThrow(
        'SES send failed [InvalidParameterValue]: Invalid email address'
      );
    });

    it('should use error name when Code is not available', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      const error = new Error('Network failure');
      error.name = 'NetworkError';

      mockSend.mockRejectedValue(error);

      await expect(provider.send(emailOptions)).rejects.toThrow(
        'SES send failed [NetworkError]: Network failure'
      );
    });

    it('should handle error without Code or name', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      const error = { message: 'Something went wrong' };

      mockSend.mockRejectedValue(error);

      await expect(provider.send(emailOptions)).rejects.toThrow(
        'SES send failed [UnknownError]: Something went wrong'
      );
    });

    it('should handle error without message', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      const error = { Code: 'MessageRejected' };

      mockSend.mockRejectedValue(error);

      await expect(provider.send(emailOptions)).rejects.toThrow(
        'SES send failed [MessageRejected]: Unknown SES error'
      );
    });

    it('should log error message when send fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      const sesError = new Error('Rate exceeded') as Error & { Code?: string };
      sesError.Code = 'Throttling';

      mockSend.mockRejectedValue(sesError);

      await expect(provider.send(emailOptions)).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('AWS SES error [Throttling]:'),
        expect.stringContaining('Rate exceeded')
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle MessageRejected error', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      const sesError = new Error('Email address is not verified') as Error & {
        Code?: string;
      };
      sesError.Code = 'MessageRejected';

      mockSend.mockRejectedValue(sesError);

      await expect(provider.send(emailOptions)).rejects.toThrow(
        'SES send failed [MessageRejected]: Email address is not verified'
      );
    });

    it('should handle ConfigurationSetDoesNotExist error', async () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);
      const emailOptions = createEmailOptions();

      const sesError = new Error('Configuration set not found') as Error & {
        Code?: string;
      };
      sesError.Code = 'ConfigurationSetDoesNotExist';

      mockSend.mockRejectedValue(sesError);

      await expect(provider.send(emailOptions)).rejects.toThrow(
        'SES send failed [ConfigurationSetDoesNotExist]: Configuration set not found'
      );
    });
  });

  describe('accessors', () => {
    it('should return sender email via senderEmail getter', () => {
      const config = createSESConfig({ fromEmail: 'sender@domain.com' });
      const provider = new SESProvider(config);

      expect(provider.senderEmail).toBe('sender@domain.com');
    });

    it('should return SES client via sesClient getter', () => {
      const config = createSESConfig();
      const provider = new SESProvider(config);

      expect(provider.sesClient).toBeDefined();
      expect(provider.sesClient).toHaveProperty('send');
    });
  });
});
