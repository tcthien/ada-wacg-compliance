import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  encryptEmail,
  decryptEmail,
  EncryptionError,
  DecryptionError,
} from './encryption';

describe('Email Encryption Utility', () => {
  const originalEnv = process.env.EMAIL_ENCRYPTION_KEY;
  const validKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars (32 bytes)

  beforeEach(() => {
    // Set a valid encryption key for tests
    process.env.EMAIL_ENCRYPTION_KEY = validKey;
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.EMAIL_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.EMAIL_ENCRYPTION_KEY;
    }
  });

  describe('encryptEmail', () => {
    it('should encrypt an email address successfully', () => {
      const email = 'user@example.com';
      const encrypted = encryptEmail(email);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should produce different ciphertext for same email (random IV)', () => {
      const email = 'user@example.com';
      const encrypted1 = encryptEmail(email);
      const encrypted2 = encryptEmail(email);

      expect(encrypted1).not.toBe(encrypted2);
      // IVs should be different
      expect(encrypted1.split(':')[0]).not.toBe(encrypted2.split(':')[0]);
    });

    it('should produce ciphertext in correct format (iv:authTag:encryptedData)', () => {
      const email = 'test@domain.com';
      const encrypted = encryptEmail(email);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);

      // Validate hex encoding
      expect(parts[0]).toMatch(/^[a-f0-9]+$/i); // IV
      expect(parts[1]).toMatch(/^[a-f0-9]+$/i); // Auth tag
      expect(parts[2]).toMatch(/^[a-f0-9]+$/i); // Encrypted data

      // Validate lengths (hex string length = byte length * 2)
      expect(parts[0].length).toBe(24); // 12 bytes IV = 24 hex chars
      expect(parts[1].length).toBe(32); // 16 bytes auth tag = 32 hex chars
    });

    it('should throw EncryptionError for empty string', () => {
      expect(() => encryptEmail('')).toThrow(EncryptionError);
      expect(() => encryptEmail('')).toThrow('non-empty string');
    });

    it('should throw EncryptionError for non-string input', () => {
      expect(() => encryptEmail(null as any)).toThrow(EncryptionError);
      expect(() => encryptEmail(undefined as any)).toThrow(EncryptionError);
      expect(() => encryptEmail(123 as any)).toThrow(EncryptionError);
    });

    it('should throw EncryptionError when EMAIL_ENCRYPTION_KEY is not set', () => {
      delete process.env.EMAIL_ENCRYPTION_KEY;

      expect(() => encryptEmail('test@example.com')).toThrow(EncryptionError);
      expect(() => encryptEmail('test@example.com')).toThrow(
        'EMAIL_ENCRYPTION_KEY environment variable is not set'
      );

      // Restore for other tests
      process.env.EMAIL_ENCRYPTION_KEY = validKey;
    });

    it('should throw EncryptionError for invalid key length', () => {
      // Key too short (16 bytes instead of 32)
      process.env.EMAIL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

      expect(() => encryptEmail('test@example.com')).toThrow(EncryptionError);
      expect(() => encryptEmail('test@example.com')).toThrow(
        'Invalid encryption key format'
      );

      // Restore for other tests
      process.env.EMAIL_ENCRYPTION_KEY = validKey;
    });

    it('should handle long email addresses', () => {
      const longEmail = 'very.long.email.address.with.many.dots@example.com';
      const encrypted = encryptEmail(longEmail);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should handle special characters in email', () => {
      const specialEmail = "user+test.123_abc-xyz@sub-domain.example.co.uk";
      const encrypted = encryptEmail(specialEmail);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(':')).toHaveLength(3);
    });
  });

  describe('decryptEmail', () => {
    it('should decrypt an encrypted email successfully', () => {
      const originalEmail = 'user@example.com';
      const encrypted = encryptEmail(originalEmail);
      const decrypted = decryptEmail(encrypted);

      expect(decrypted).toBe(originalEmail);
    });

    it('should handle round-trip encryption/decryption', () => {
      const emails = [
        'simple@test.com',
        'user+tag@example.com',
        'very.long.email.address.with.many.dots@subdomain.example.co.uk',
        'user_123@test-domain.org',
      ];

      for (const email of emails) {
        const encrypted = encryptEmail(email);
        const decrypted = decryptEmail(encrypted);
        expect(decrypted).toBe(email);
      }
    });

    it('should throw DecryptionError for empty string', () => {
      expect(() => decryptEmail('')).toThrow(DecryptionError);
      expect(() => decryptEmail('')).toThrow('non-empty string');
    });

    it('should throw DecryptionError for non-string input', () => {
      expect(() => decryptEmail(null as any)).toThrow(DecryptionError);
      expect(() => decryptEmail(undefined as any)).toThrow(DecryptionError);
      expect(() => decryptEmail(123 as any)).toThrow(DecryptionError);
    });

    it('should throw DecryptionError for invalid format (missing parts)', () => {
      expect(() => decryptEmail('invalid')).toThrow(DecryptionError);
      expect(() => decryptEmail('invalid')).toThrow('Invalid encrypted email format');

      expect(() => decryptEmail('part1:part2')).toThrow(DecryptionError);
      expect(() => decryptEmail('part1:part2')).toThrow(
        'Invalid encrypted email format'
      );
    });

    it('should throw DecryptionError for non-hex encoded parts', () => {
      expect(() => decryptEmail('invalid:hex:data')).toThrow(DecryptionError);
      expect(() => decryptEmail('invalid:hex:data')).toThrow(
        'All parts must be hex encoded'
      );

      expect(() =>
        decryptEmail('abcdef123456:xyz:0123456789abcdef')
      ).toThrow(DecryptionError);
    });

    it('should throw DecryptionError for invalid IV length', () => {
      // Too short IV (4 bytes instead of 12)
      const invalidIv = 'abcdef12:' + '0'.repeat(32) + ':' + '0'.repeat(20);

      expect(() => decryptEmail(invalidIv)).toThrow(DecryptionError);
      expect(() => decryptEmail(invalidIv)).toThrow('Invalid IV length');
    });

    it('should throw DecryptionError for invalid auth tag length', () => {
      // Valid IV (12 bytes), invalid auth tag (4 bytes instead of 16)
      const invalidAuthTag = '0'.repeat(24) + ':abcdef12:' + '0'.repeat(20);

      expect(() => decryptEmail(invalidAuthTag)).toThrow(DecryptionError);
      expect(() => decryptEmail(invalidAuthTag)).toThrow(
        'Invalid auth tag length'
      );
    });

    it('should throw DecryptionError for tampered ciphertext', () => {
      const email = 'user@example.com';
      const encrypted = encryptEmail(email);

      // Tamper with the encrypted data
      const parts = encrypted.split(':');
      const tamperedData = parts[2].slice(0, -2) + 'ff'; // Change last byte
      const tamperedEncrypted = `${parts[0]}:${parts[1]}:${tamperedData}`;

      expect(() => decryptEmail(tamperedEncrypted)).toThrow(DecryptionError);
      expect(() => decryptEmail(tamperedEncrypted)).toThrow(
        'Data has been tampered with or corrupted'
      );
    });

    it('should throw DecryptionError for tampered auth tag', () => {
      const email = 'user@example.com';
      const encrypted = encryptEmail(email);

      // Tamper with the auth tag
      const parts = encrypted.split(':');
      const tamperedTag = parts[1].slice(0, -2) + 'ff'; // Change last byte
      const tamperedEncrypted = `${parts[0]}:${tamperedTag}:${parts[2]}`;

      expect(() => decryptEmail(tamperedEncrypted)).toThrow(DecryptionError);
      expect(() => decryptEmail(tamperedEncrypted)).toThrow(
        'Data has been tampered with or corrupted'
      );
    });

    it('should throw DecryptionError when EMAIL_ENCRYPTION_KEY is not set', () => {
      const email = 'user@example.com';
      const encrypted = encryptEmail(email);

      delete process.env.EMAIL_ENCRYPTION_KEY;

      expect(() => decryptEmail(encrypted)).toThrow(EncryptionError);
      expect(() => decryptEmail(encrypted)).toThrow(
        'EMAIL_ENCRYPTION_KEY environment variable is not set'
      );

      // Restore for other tests
      process.env.EMAIL_ENCRYPTION_KEY = validKey;
    });

    it('should throw DecryptionError when using wrong key', () => {
      const email = 'user@example.com';
      const encrypted = encryptEmail(email);

      // Use a different key
      process.env.EMAIL_ENCRYPTION_KEY =
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      expect(() => decryptEmail(encrypted)).toThrow(DecryptionError);

      // Restore for other tests
      process.env.EMAIL_ENCRYPTION_KEY = validKey;
    });
  });

  describe('Error Classes', () => {
    it('should have correct error names', () => {
      const encError = new EncryptionError('test');
      const decError = new DecryptionError('test');

      expect(encError.name).toBe('EncryptionError');
      expect(decError.name).toBe('DecryptionError');
    });

    it('should be instances of Error', () => {
      const encError = new EncryptionError('test');
      const decError = new DecryptionError('test');

      expect(encError).toBeInstanceOf(Error);
      expect(decError).toBeInstanceOf(Error);
    });
  });

  describe('Security Properties', () => {
    it('should use different IVs for each encryption', () => {
      const email = 'test@example.com';
      const ivs = new Set();

      // Encrypt 100 times
      for (let i = 0; i < 100; i++) {
        const encrypted = encryptEmail(email);
        const iv = encrypted.split(':')[0];
        ivs.add(iv);
      }

      // All IVs should be unique
      expect(ivs.size).toBe(100);
    });

    it('should produce different ciphertext lengths for different email lengths', () => {
      const shortEmail = 'a@b.c';
      const longEmail = 'very.long.email.address@subdomain.example.com';

      const shortEncrypted = encryptEmail(shortEmail);
      const longEncrypted = encryptEmail(longEmail);

      const shortData = shortEncrypted.split(':')[2];
      const longData = longEncrypted.split(':')[2];

      expect(longData.length).toBeGreaterThan(shortData.length);
    });

    it('should not leak information about plaintext in ciphertext structure', () => {
      const email1 = 'user@example.com';
      const email2 = 'user@example.org'; // Similar but different

      const encrypted1 = encryptEmail(email1);
      const encrypted2 = encryptEmail(email2);

      // Different IVs
      expect(encrypted1.split(':')[0]).not.toBe(encrypted2.split(':')[0]);

      // Different ciphertext
      expect(encrypted1.split(':')[2]).not.toBe(encrypted2.split(':')[2]);

      // Different auth tags
      expect(encrypted1.split(':')[1]).not.toBe(encrypted2.split(':')[1]);
    });
  });
});
