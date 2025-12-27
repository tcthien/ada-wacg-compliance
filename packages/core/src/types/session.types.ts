/**
 * Session-related types for ADAShield
 */

/**
 * Guest session for anonymous scan requests
 */
export interface GuestSession {
  /** Unique identifier for the guest session */
  id: string;

  /** Browser fingerprint for session tracking */
  fingerprint: string;

  /** Secure session token for authentication */
  sessionToken: string;

  /** Timestamp when session was created */
  createdAt: Date;

  /** Timestamp when session expires */
  expiresAt: Date;

  /** Timestamp when session data was anonymized (null if not anonymized) */
  anonymizedAt: Date | null;
}

/**
 * Input data for creating a new guest session
 */
export interface CreateGuestSessionInput {
  fingerprint: string;
  expirationHours?: number; // Default: 24 hours
}

/**
 * Input data for validating a guest session
 */
export interface ValidateGuestSessionInput {
  sessionToken: string;
  fingerprint: string;
}

/**
 * Guest session validation result
 */
export interface GuestSessionValidation {
  isValid: boolean;
  session?: GuestSession;
  reason?: 'expired' | 'invalid_token' | 'fingerprint_mismatch' | 'anonymized';
}

/**
 * Guest session metadata for tracking
 */
export interface GuestSessionMetadata {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  isExpired: boolean;
  isAnonymized: boolean;
  scanCount?: number;
}
