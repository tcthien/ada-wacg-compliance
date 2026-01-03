import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Email Encryption Utility
 *
 * Provides AES-256-GCM encryption/decryption for email addresses to protect PII.
 * Uses authenticated encryption to ensure both confidentiality and integrity.
 *
 * Format: `iv:authTag:encryptedData` (all hex encoded)
 *
 * Security considerations:
 * - Uses AES-256-GCM (authenticated encryption)
 * - Random IV for each encryption operation
 * - Authentication tag prevents tampering
 * - 256-bit key required (32 bytes)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Encryption error types
 */
export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Validate encryption key format
 *
 * @param key - Encryption key (hex string or Buffer)
 * @throws {EncryptionError} If key is invalid
 */
function validateKey(key: string | Buffer): Buffer {
  let keyBuffer: Buffer;

  if (typeof key === 'string') {
    // Expect hex-encoded key
    if (!/^[a-f0-9]{64}$/i.test(key)) {
      throw new EncryptionError(
        'Invalid encryption key format. Expected 64 hex characters (32 bytes).'
      );
    }
    keyBuffer = Buffer.from(key, 'hex');
  } else {
    keyBuffer = key;
  }

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new EncryptionError(
      `Invalid key length. Expected ${KEY_LENGTH} bytes, got ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

/**
 * Get encryption key from environment
 *
 * @returns Encryption key buffer
 * @throws {EncryptionError} If key is missing or invalid
 */
function getEncryptionKey(): Buffer {
  const key = process.env['EMAIL_ENCRYPTION_KEY'];

  if (!key) {
    throw new EncryptionError(
      'EMAIL_ENCRYPTION_KEY environment variable is not set'
    );
  }

  return validateKey(key);
}

/**
 * Encrypt an email address using AES-256-GCM
 *
 * Returns encrypted data in format: `iv:authTag:encryptedData` (hex encoded)
 *
 * @param email - Email address to encrypt
 * @returns Encrypted email string
 * @throws {EncryptionError} If encryption fails
 *
 * @example
 * const encrypted = encryptEmail('user@example.com');
 * // Returns: "a1b2c3d4e5f6g7h8:1234567890abcdef:9876543210fedcba..."
 */
export function encryptEmail(email: string): string {
  try {
    // Input validation
    if (!email || typeof email !== 'string') {
      throw new EncryptionError('Email must be a non-empty string');
    }

    // Get and validate encryption key
    const key = getEncryptionKey();

    // Generate random IV
    const iv = randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt email
    let encrypted = cipher.update(email, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(
      `Failed to encrypt email: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt an email address encrypted with AES-256-GCM
 *
 * Expects input in format: `iv:authTag:encryptedData` (hex encoded)
 *
 * @param encryptedEmail - Encrypted email string
 * @returns Decrypted email address
 * @throws {DecryptionError} If decryption fails or data is tampered
 *
 * @example
 * const email = decryptEmail('a1b2c3d4e5f6g7h8:1234567890abcdef:9876543210fedcba...');
 * // Returns: "user@example.com"
 */
export function decryptEmail(encryptedEmail: string): string {
  try {
    // Input validation
    if (!encryptedEmail || typeof encryptedEmail !== 'string') {
      throw new DecryptionError('Encrypted email must be a non-empty string');
    }

    // Parse encrypted data
    const parts = encryptedEmail.split(':');
    if (parts.length !== 3) {
      throw new DecryptionError(
        'Invalid encrypted email format. Expected format: iv:authTag:encryptedData'
      );
    }

    const ivHex = parts[0];
    const authTagHex = parts[1];
    const encryptedHex = parts[2];

    // Validate that parts exist
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new DecryptionError(
        'Invalid encrypted email format. Missing required parts.'
      );
    }

    // Validate hex strings
    if (
      !/^[a-f0-9]+$/i.test(ivHex) ||
      !/^[a-f0-9]+$/i.test(authTagHex) ||
      !/^[a-f0-9]+$/i.test(encryptedHex)
    ) {
      throw new DecryptionError(
        'Invalid encrypted email format. All parts must be hex encoded.'
      );
    }

    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new DecryptionError(
        `Invalid IV length. Expected ${IV_LENGTH} bytes, got ${iv.length} bytes.`
      );
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new DecryptionError(
        `Invalid auth tag length. Expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length} bytes.`
      );
    }

    // Get and validate encryption key
    const key = getEncryptionKey();

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt email
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    if (error instanceof DecryptionError || error instanceof EncryptionError) {
      throw error;
    }

    // Authentication tag verification failure indicates tampering
    if (error instanceof Error && error.message.includes('auth')) {
      throw new DecryptionError(
        'Decryption failed: Data has been tampered with or corrupted'
      );
    }

    throw new DecryptionError(
      `Failed to decrypt email: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
