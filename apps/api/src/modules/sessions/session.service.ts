/**
 * Session Service
 *
 * Provides GDPR-compliant session anonymization and management.
 * Implements data anonymization per GDPR requirements:
 * - Hash fingerprint with SHA-256
 * - Replace session token with random value
 * - Nullify email fields in related scans
 * - Set anonymizedAt timestamp
 */

import { randomBytes } from 'node:crypto';
import { getPrismaClient } from '../../config/database.js';
import { generateAnonFingerprint } from '@adashield/core';
import type { GuestSession } from '@prisma/client';

/**
 * Session Service Error
 */
export class SessionServiceError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'SessionServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Result of session anonymization
 */
export interface AnonymizeSessionResult {
  sessionId: string;
  anonymizedAt: Date;
  affectedScans: number;
  reportsDeleted: number;
}

/**
 * Anonymize a guest session according to GDPR requirements
 *
 * This function:
 * 1. Hashes the fingerprint using SHA-256 with 'anon_' prefix
 * 2. Replaces the session token with a random value
 * 3. Nullifies email fields in all related scans
 * 4. Sets the anonymizedAt timestamp
 *
 * @param sessionToken - The session token to anonymize
 * @returns Anonymization result with affected record counts
 * @throws SessionServiceError if session not found or already anonymized
 *
 * @example
 * ```typescript
 * const result = await anonymizeSession('session-token-123');
 * console.log(`Anonymized session ${result.sessionId}`);
 * console.log(`Affected ${result.affectedScans} scans`);
 * ```
 */
export async function anonymizeSession(
  sessionToken: string
): Promise<AnonymizeSessionResult> {
  const prisma = getPrismaClient();

  try {
    // Validate input
    if (!sessionToken || typeof sessionToken !== 'string') {
      throw new SessionServiceError(
        'Session token is required and must be a string',
        'INVALID_INPUT'
      );
    }

    // Find the session with scans and reports
    const session = await prisma.guestSession.findUnique({
      where: { sessionToken },
      include: {
        scans: {
          select: {
            id: true,
            reports: {
              select: {
                id: true,
                storageKey: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new SessionServiceError(
        `Session not found: ${sessionToken}`,
        'SESSION_NOT_FOUND'
      );
    }

    // Check if already anonymized
    if (session.anonymizedAt) {
      throw new SessionServiceError(
        `Session already anonymized at ${session.anonymizedAt.toISOString()}`,
        'ALREADY_ANONYMIZED'
      );
    }

    // Generate anonymized fingerprint
    const anonFingerprint = generateAnonFingerprint(session.fingerprint);

    // Generate random session token (32 bytes = 64 hex characters)
    const anonToken = `anon_${randomBytes(32).toString('hex')}`;

    const anonymizedAt = new Date();

    // Collect report IDs and storage keys for deletion
    const reportIds: string[] = [];
    const reportStorageKeys: string[] = [];

    for (const scan of session.scans) {
      for (const report of scan.reports) {
        reportIds.push(report.id);
        if (report.storageKey) {
          reportStorageKeys.push(report.storageKey);
        }
      }
    }

    // Perform anonymization in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the session with anonymized data
      const updatedSession = await tx.guestSession.update({
        where: { sessionToken },
        data: {
          fingerprint: anonFingerprint,
          sessionToken: anonToken,
          anonymizedAt,
        },
      });

      // Nullify email fields in all related scans
      const scanUpdateResult = await tx.scan.updateMany({
        where: { guestSessionId: session.id },
        data: {
          email: null,
        },
      });

      // Delete report records from database
      let reportsDeleted = 0;
      if (reportIds.length > 0) {
        const reportDeleteResult = await tx.report.deleteMany({
          where: {
            id: {
              in: reportIds,
            },
          },
        });
        reportsDeleted = reportDeleteResult.count;
      }

      return {
        session: updatedSession,
        affectedScans: scanUpdateResult.count,
        reportsDeleted,
      };
    });

    // Delete report files from S3 (stubbed - S3 client not yet implemented)
    if (reportStorageKeys.length > 0) {
      // TODO: Implement S3 deletion when S3 client is available
      // await deleteReportsFromS3(reportStorageKeys);
      console.log(
        `⚠️  Session: S3 deletion stubbed - ${reportStorageKeys.length} report files to delete:`,
        reportStorageKeys
      );
    }

    console.log(
      `✅ Session: Anonymized session ${session.id} (${result.affectedScans} scans, ${result.reportsDeleted} reports deleted)`
    );

    return {
      sessionId: session.id,
      anonymizedAt,
      affectedScans: result.affectedScans,
      reportsDeleted: result.reportsDeleted,
    };
  } catch (error) {
    // Re-throw SessionServiceError as-is
    if (error instanceof SessionServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Session: Failed to anonymize session:', err.message);
    throw new SessionServiceError(
      'Failed to anonymize session',
      'ANONYMIZATION_FAILED',
      err
    );
  }
}

/**
 * Get session by token
 *
 * @param sessionToken - The session token to find
 * @returns The session or null if not found
 */
export async function getSessionByToken(
  sessionToken: string
): Promise<GuestSession | null> {
  const prisma = getPrismaClient();

  try {
    if (!sessionToken || typeof sessionToken !== 'string') {
      return null;
    }

    return await prisma.guestSession.findUnique({
      where: { sessionToken },
    });
  } catch (error) {
    console.error('❌ Session: Failed to get session:', error);
    return null;
  }
}

/**
 * Check if a session is anonymized
 *
 * @param sessionToken - The session token to check
 * @returns True if the session is anonymized
 */
export async function isSessionAnonymized(sessionToken: string): Promise<boolean> {
  const session = await getSessionByToken(sessionToken);
  return session?.anonymizedAt !== null && session?.anonymizedAt !== undefined;
}

/**
 * Delete a session and all related data (hard delete)
 *
 * WARNING: This is a hard delete and cannot be undone.
 * Use anonymizeSession() instead for GDPR compliance.
 *
 * @param sessionToken - The session token to delete
 * @returns True if deleted, false if not found
 */
export async function deleteSession(sessionToken: string): Promise<boolean> {
  const prisma = getPrismaClient();

  try {
    if (!sessionToken || typeof sessionToken !== 'string') {
      return false;
    }

    const session = await prisma.guestSession.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      return false;
    }

    // Delete session (cascade will delete related scans, scan results, issues, reports)
    await prisma.guestSession.delete({
      where: { sessionToken },
    });

    console.log(`✅ Session: Deleted session ${session.id}`);
    return true;
  } catch (error) {
    console.error('❌ Session: Failed to delete session:', error);
    return false;
  }
}
