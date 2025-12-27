/**
 * Session Service Unit Tests
 *
 * Tests for GDPR-compliant session anonymization and management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  anonymizeSession,
  getSessionByToken,
  isSessionAnonymized,
  deleteSession,
  SessionServiceError,
  type AnonymizeSessionResult,
} from './session.service.js';
import { generateAnonFingerprint } from '@adashield/core';

// Create mock Prisma client
const mockPrisma = {
  guestSession: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  scan: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

// Mock dependencies
vi.mock('../../config/database.js', () => ({
  getPrismaClient: vi.fn(() => mockPrisma),
}));

vi.mock('@adashield/core', () => ({
  generateAnonFingerprint: vi.fn((data: string) => `anon_${data}_hashed`),
}));

describe('Session Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('anonymizeSession', () => {
    it('should anonymize a session successfully', async () => {
      const sessionToken = 'test-session-token';
      const mockSession = {
        id: 'session-uuid-123',
        fingerprint: 'original-fingerprint',
        sessionToken,
        createdAt: new Date('2025-12-01'),
        expiresAt: new Date('2025-12-31'),
        anonymizedAt: null,
        scans: [
          { id: 'scan-1', reports: [] },
          { id: 'scan-2', reports: [] },
        ],
      };

      const anonFingerprint = 'anon_original-fingerprint_hashed';
      const anonymizedAt = new Date();

      // Mock findUnique to return the session
      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );

      // Mock transaction
      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          guestSession: {
            update: vi.fn().mockResolvedValue({
              ...mockSession,
              fingerprint: anonFingerprint,
              sessionToken: 'anon_random_token',
              anonymizedAt,
            }),
          },
          scan: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          report: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        } as never);
      });

      const result = await anonymizeSession(sessionToken);

      expect(result).toEqual({
        sessionId: mockSession.id,
        anonymizedAt: expect.any(Date),
        affectedScans: 2,
        reportsDeleted: 0,
      });

      expect(mockPrisma.guestSession.findUnique).toHaveBeenCalledWith({
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

      expect(generateAnonFingerprint).toHaveBeenCalledWith('original-fingerprint');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error for invalid session token', async () => {
      await expect(anonymizeSession('')).rejects.toThrow(SessionServiceError);
      await expect(anonymizeSession('')).rejects.toThrow(
        'Session token is required and must be a string'
      );
    });

    it('should throw error for non-string session token', async () => {
      await expect(anonymizeSession(null as never)).rejects.toThrow(SessionServiceError);
      await expect(anonymizeSession(undefined as never)).rejects.toThrow(
        SessionServiceError
      );
    });

    it('should throw error when session not found', async () => {
      const sessionToken = 'non-existent-token';

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(null);

      await expect(anonymizeSession(sessionToken)).rejects.toThrow(SessionServiceError);
      await expect(anonymizeSession(sessionToken)).rejects.toThrow(
        `Session not found: ${sessionToken}`
      );

      const error = await anonymizeSession(sessionToken).catch((e) => e);
      expect(error.code).toBe('SESSION_NOT_FOUND');
    });

    it('should throw error when session already anonymized', async () => {
      const sessionToken = 'already-anon-token';
      const anonymizedAt = new Date('2025-12-20');

      const mockSession = {
        id: 'session-uuid-456',
        fingerprint: 'anon_abc123',
        sessionToken,
        createdAt: new Date('2025-12-01'),
        expiresAt: new Date('2025-12-31'),
        anonymizedAt,
        scans: [],
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );

      await expect(anonymizeSession(sessionToken)).rejects.toThrow(SessionServiceError);
      await expect(anonymizeSession(sessionToken)).rejects.toThrow(
        `Session already anonymized at ${anonymizedAt.toISOString()}`
      );

      const error = await anonymizeSession(sessionToken).catch((e) => e);
      expect(error.code).toBe('ALREADY_ANONYMIZED');
    });

    it('should handle database errors gracefully', async () => {
      const sessionToken = 'test-token';

      vi.mocked(mockPrisma.guestSession.findUnique).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(anonymizeSession(sessionToken)).rejects.toThrow(SessionServiceError);

      const error = await anonymizeSession(sessionToken).catch((e) => e);
      expect(error.code).toBe('ANONYMIZATION_FAILED');
      expect(error.cause?.message).toBe('Database connection failed');
    });

    it('should anonymize session with no scans', async () => {
      const sessionToken = 'empty-session-token';
      const mockSession = {
        id: 'session-uuid-789',
        fingerprint: 'fp-123',
        sessionToken,
        createdAt: new Date('2025-12-01'),
        expiresAt: new Date('2025-12-31'),
        anonymizedAt: null,
        scans: [],
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          guestSession: {
            update: vi.fn().mockResolvedValue({
              ...mockSession,
              anonymizedAt: new Date(),
            }),
          },
          scan: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        } as never);
      });

      const result = await anonymizeSession(sessionToken);

      expect(result.affectedScans).toBe(0);
    });

    it('should delete reports when anonymizing session', async () => {
      const sessionToken = 'session-with-reports';
      const mockSession = {
        id: 'session-uuid-with-reports',
        fingerprint: 'fp-reports',
        sessionToken,
        createdAt: new Date('2025-12-01'),
        expiresAt: new Date('2025-12-31'),
        anonymizedAt: null,
        scans: [
          {
            id: 'scan-1',
            reports: [
              { id: 'report-1', storageKey: 's3-key-1.pdf' },
              { id: 'report-2', storageKey: 's3-key-2.pdf' },
            ],
          },
          {
            id: 'scan-2',
            reports: [{ id: 'report-3', storageKey: 's3-key-3.pdf' }],
          },
        ],
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );

      const mockReportDelete = vi.fn().mockResolvedValue({ count: 3 });

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          guestSession: {
            update: vi.fn().mockResolvedValue({
              ...mockSession,
              anonymizedAt: new Date(),
            }),
          },
          scan: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          report: {
            deleteMany: mockReportDelete,
          },
        } as never);
      });

      const result = await anonymizeSession(sessionToken);

      expect(result.reportsDeleted).toBe(3);
      expect(mockReportDelete).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['report-1', 'report-2', 'report-3'],
          },
        },
      });
    });

    it('should use transaction for atomicity', async () => {
      const sessionToken = 'atomic-test-token';
      const mockSession = {
        id: 'session-atomic',
        fingerprint: 'fp-atomic',
        sessionToken,
        createdAt: new Date('2025-12-01'),
        expiresAt: new Date('2025-12-31'),
        anonymizedAt: null,
        scans: [{ id: 'scan-1', reports: [] }],
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );

      const mockUpdate = vi.fn().mockResolvedValue({
        ...mockSession,
        anonymizedAt: new Date(),
      });

      const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          guestSession: { update: mockUpdate },
          scan: { updateMany: mockUpdateMany },
        } as never);
      });

      await anonymizeSession(sessionToken);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { sessionToken },
        data: {
          fingerprint: expect.stringContaining('anon_'),
          sessionToken: expect.stringContaining('anon_'),
          anonymizedAt: expect.any(Date),
        },
      });
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { guestSessionId: mockSession.id },
        data: { email: null },
      });
    });
  });

  describe('getSessionByToken', () => {
    it('should return session when found', async () => {
      const sessionToken = 'valid-token';
      const mockSession = {
        id: 'session-123',
        fingerprint: 'fp-123',
        sessionToken,
        createdAt: new Date(),
        expiresAt: new Date(),
        anonymizedAt: null,
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );

      const result = await getSessionByToken(sessionToken);

      expect(result).toEqual(mockSession);
      expect(mockPrisma.guestSession.findUnique).toHaveBeenCalledWith({
        where: { sessionToken },
      });
    });

    it('should return null when session not found', async () => {
      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(null);

      const result = await getSessionByToken('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for invalid input', async () => {
      expect(await getSessionByToken('')).toBeNull();
      expect(await getSessionByToken(null as never)).toBeNull();
      expect(await getSessionByToken(undefined as never)).toBeNull();
    });

    it('should handle database errors', async () => {
      vi.mocked(mockPrisma.guestSession.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      const result = await getSessionByToken('error-token');

      expect(result).toBeNull();
    });
  });

  describe('isSessionAnonymized', () => {
    it('should return true for anonymized session', async () => {
      const mockSession = {
        id: 'session-anon',
        fingerprint: 'anon_fp',
        sessionToken: 'anon-token',
        createdAt: new Date(),
        expiresAt: new Date(),
        anonymizedAt: new Date('2025-12-20'),
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );

      const result = await isSessionAnonymized('anon-token');

      expect(result).toBe(true);
    });

    it('should return false for non-anonymized session', async () => {
      const mockSession = {
        id: 'session-normal',
        fingerprint: 'fp',
        sessionToken: 'normal-token',
        createdAt: new Date(),
        expiresAt: new Date(),
        anonymizedAt: null,
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );

      const result = await isSessionAnonymized('normal-token');

      expect(result).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(null);

      const result = await isSessionAnonymized('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      const sessionToken = 'delete-token';
      const mockSession = {
        id: 'session-delete',
        fingerprint: 'fp-delete',
        sessionToken,
        createdAt: new Date(),
        expiresAt: new Date(),
        anonymizedAt: null,
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );
      vi.mocked(mockPrisma.guestSession.delete).mockResolvedValue(mockSession as never);

      const result = await deleteSession(sessionToken);

      expect(result).toBe(true);
      expect(mockPrisma.guestSession.delete).toHaveBeenCalledWith({
        where: { sessionToken },
      });
    });

    it('should return false when session not found', async () => {
      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(null);

      const result = await deleteSession('non-existent');

      expect(result).toBe(false);
      expect(mockPrisma.guestSession.delete).not.toHaveBeenCalled();
    });

    it('should return false for invalid input', async () => {
      expect(await deleteSession('')).toBe(false);
      expect(await deleteSession(null as never)).toBe(false);
      expect(await deleteSession(undefined as never)).toBe(false);
    });

    it('should handle deletion errors', async () => {
      const mockSession = {
        id: 'session-error',
        fingerprint: 'fp-error',
        sessionToken: 'error-token',
        createdAt: new Date(),
        expiresAt: new Date(),
        anonymizedAt: null,
      };

      vi.mocked(mockPrisma.guestSession.findUnique).mockResolvedValue(
        mockSession as never
      );
      vi.mocked(mockPrisma.guestSession.delete).mockRejectedValue(
        new Error('Delete failed')
      );

      const result = await deleteSession('error-token');

      expect(result).toBe(false);
    });
  });
});
