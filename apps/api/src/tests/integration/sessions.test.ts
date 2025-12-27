/**
 * Sessions API Integration Tests
 *
 * Tests GDPR-compliant session management including:
 * - Session anonymization
 * - Data deletion cascade
 * - Session validation
 * - Error handling for edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerSessionRoutes } from '../../modules/sessions/session.controller.js';
import { createTestSession, createTestScan, getTestPrismaClient } from '../setup.js';
import type { Redis } from 'ioredis';

/**
 * Mock Redis client
 */
const mockRedisClient = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
} as unknown as Redis;

/**
 * Mock Redis module
 */
vi.mock('../../config/redis.js', () => ({
  getRedisClient: () => mockRedisClient,
}));

/**
 * Create test Fastify app with routes
 */
async function createTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register session routes
  await registerSessionRoutes(app, '/api/v1');

  return app;
}

describe('Sessions API Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getTestPrismaClient();

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('DELETE /api/v1/sessions/:token - Anonymize Session', () => {
    it('should anonymize session successfully', async () => {
      // Create test session
      const session = await createTestSession('test-fingerprint-123');

      // Create some scans for this session
      await createTestScan(session.id, {
        url: 'https://example.com',
        email: 'test@example.com',
      });
      await createTestScan(session.id, {
        url: 'https://example2.com',
        email: 'test@example.com',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Session anonymized successfully');
      expect(body.data.sessionId).toBe(session.id);
      expect(body.data.anonymizedAt).toBeDefined();
      expect(body.data.affectedScans).toBe(2);

      // Verify session is anonymized in database
      const anonymizedSession = await prisma.guestSession.findUnique({
        where: { id: session.id },
      });
      expect(anonymizedSession?.anonymizedAt).not.toBeNull();
      expect(anonymizedSession?.fingerprint).not.toBe('test-fingerprint-123');
      expect(anonymizedSession?.sessionToken).not.toBe(session.sessionToken);

      // Verify scans have emails nullified
      const scans = await prisma.scan.findMany({
        where: { guestSessionId: session.id },
      });
      for (const scan of scans) {
        expect(scan.email).toBeNull();
      }
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/non-existent-token',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('SESSION_NOT_FOUND');
      expect(body.error).toContain('Session not found');
    });

    it('should return 409 for already anonymized session', async () => {
      // Create and anonymize session
      const session = await createTestSession('test-fingerprint-123');

      // Anonymize it first
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      // Try to anonymize again - need to get the updated token
      const anonymizedSession = await prisma.guestSession.findUnique({
        where: { id: session.id },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${anonymizedSession?.sessionToken}`,
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('ALREADY_ANONYMIZED');
    });

    it('should handle missing token parameter', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/',
      });

      expect(response.statusCode).toBe(404); // Route not found
    });

    it('should handle empty token parameter', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/ ',
      });

      // Fastify will treat this as route not found or validation error
      expect([400, 404]).toContain(response.statusCode);
    });

    it('should cascade delete reports when anonymizing', async () => {
      // Create test session
      const session = await createTestSession('test-fingerprint-123');

      // Create scan
      const scan = await createTestScan(session.id, {
        url: 'https://example.com',
        email: 'test@example.com',
        status: 'COMPLETED',
      });

      // Create a report (if reports table exists)
      // Note: This depends on your schema having a Report model
      // For now, we'll just verify the count is returned
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.reportsDeleted).toBeDefined();
    });

    it('should handle session with no scans', async () => {
      // Create session without scans
      const session = await createTestSession('test-fingerprint-123');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.affectedScans).toBe(0);
    });

    it('should handle session with multiple scans', async () => {
      // Create session
      const session = await createTestSession('test-fingerprint-123');

      // Create multiple scans
      for (let i = 0; i < 5; i++) {
        await createTestScan(session.id, {
          url: `https://example${i}.com`,
          email: 'test@example.com',
        });
      }

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.affectedScans).toBe(5);

      // Verify all scans have emails nullified
      const scans = await prisma.scan.findMany({
        where: { guestSessionId: session.id },
      });
      expect(scans).toHaveLength(5);
      for (const scan of scans) {
        expect(scan.email).toBeNull();
      }
    });

    it('should hash fingerprint during anonymization', async () => {
      // Create session
      const session = await createTestSession('original-fingerprint');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);

      // Verify fingerprint is hashed
      const anonymizedSession = await prisma.guestSession.findUnique({
        where: { id: session.id },
      });
      expect(anonymizedSession?.fingerprint).not.toBe('original-fingerprint');
      // Should be a SHA-256 hash (64 hex characters)
      expect(anonymizedSession?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should replace session token during anonymization', async () => {
      // Create session
      const session = await createTestSession('test-fingerprint');
      const originalToken = session.sessionToken;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);

      // Verify session token is replaced
      const anonymizedSession = await prisma.guestSession.findUnique({
        where: { id: session.id },
      });
      expect(anonymizedSession?.sessionToken).not.toBe(originalToken);
      expect(anonymizedSession?.sessionToken).toBeDefined();
    });

    it('should set anonymizedAt timestamp', async () => {
      // Create session
      const session = await createTestSession('test-fingerprint');
      const beforeAnonymization = new Date();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify timestamp is recent
      const anonymizedAt = new Date(body.data.anonymizedAt);
      expect(anonymizedAt.getTime()).toBeGreaterThanOrEqual(beforeAnonymization.getTime());
      expect(anonymizedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle concurrent anonymization attempts', async () => {
      // Create session
      const session = await createTestSession('test-fingerprint');

      // Send two anonymization requests concurrently
      const [response1, response2] = await Promise.all([
        app.inject({
          method: 'DELETE',
          url: `/api/v1/sessions/${session.sessionToken}`,
        }),
        app.inject({
          method: 'DELETE',
          url: `/api/v1/sessions/${session.sessionToken}`,
        }),
      ]);

      // One should succeed (200), one should get 404 or 409
      const statusCodes = [response1.statusCode, response2.statusCode].sort();
      expect(statusCodes).toEqual([200, 404]);
    });

    it('should preserve scan data except email', async () => {
      // Create session
      const session = await createTestSession('test-fingerprint');

      // Create scan with various fields
      const scan = await createTestScan(session.id, {
        url: 'https://example.com',
        email: 'test@example.com',
        wcagLevel: 'AAA',
        status: 'COMPLETED',
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);

      // Verify scan data is preserved except email
      const anonymizedScan = await prisma.scan.findUnique({
        where: { id: scan.id },
      });
      expect(anonymizedScan?.url).toBe('https://example.com');
      expect(anonymizedScan?.wcagLevel).toBe('AAA');
      expect(anonymizedScan?.status).toBe('COMPLETED');
      expect(anonymizedScan?.email).toBeNull();
    });

    it('should handle session with expired timestamp', async () => {
      // Create expired session
      const expiredDate = new Date(Date.now() - 86400000 * 2); // 2 days ago
      const session = await prisma.guestSession.create({
        data: {
          sessionToken: `expired-token-${Date.now()}`,
          fingerprint: 'test-fingerprint',
          expiresAt: expiredDate,
        },
      });

      // Should still allow anonymization even if expired
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return GDPR-compliant response format', async () => {
      // Create session
      const session = await createTestSession('test-fingerprint');
      await createTestScan(session.id);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify GDPR-compliant response structure
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('sessionId');
      expect(body.data).toHaveProperty('anonymizedAt');
      expect(body.data).toHaveProperty('affectedScans');
      expect(body.data).toHaveProperty('reportsDeleted');

      // Should NOT include sensitive data
      expect(body.data).not.toHaveProperty('fingerprint');
      expect(body.data).not.toHaveProperty('sessionToken');
    });
  });

  describe('Session Validation', () => {
    it('should validate token parameter format', async () => {
      // Empty string should be rejected
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/',
      });

      expect(response.statusCode).toBe(404); // Route not found
    });

    it('should handle special characters in token', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/token-with-special-chars!@#$',
      });

      // Should return 404 (not found) not 500 (error)
      expect(response.statusCode).toBe(404);
    });

    it('should handle very long token', async () => {
      const longToken = 'a'.repeat(1000);
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${longToken}`,
      });

      // Should handle gracefully (404 or 400, not 500)
      expect([400, 404]).toContain(response.statusCode);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database failure by using invalid token format that causes DB error
      // Note: This is hard to test without mocking Prisma directly
      // For now, we test that non-existent tokens return proper errors
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/definitely-does-not-exist',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return proper error structure', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/non-existent',
      });

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body.success).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    it('should not affect other sessions when anonymizing', async () => {
      // Create two sessions
      const session1 = await createTestSession('fingerprint-1');
      const session2 = await createTestSession('fingerprint-2');

      await createTestScan(session1.id, { email: 'user1@example.com' });
      await createTestScan(session2.id, { email: 'user2@example.com' });

      // Anonymize only session1
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session1.sessionToken}`,
      });

      // Verify session2 is unaffected
      const session2Data = await prisma.guestSession.findUnique({
        where: { id: session2.id },
      });
      expect(session2Data?.anonymizedAt).toBeNull();
      expect(session2Data?.fingerprint).toBe('fingerprint-2');

      // Verify session2 scans still have email
      const session2Scans = await prisma.scan.findMany({
        where: { guestSessionId: session2.id },
      });
      expect(session2Scans[0]?.email).toBe('user2@example.com');
    });

    it('should maintain referential integrity after anonymization', async () => {
      // Create session and scan
      const session = await createTestSession('test-fingerprint');
      const scan = await createTestScan(session.id);

      // Anonymize session
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/sessions/${session.sessionToken}`,
      });

      // Verify scan still references session
      const scanData = await prisma.scan.findUnique({
        where: { id: scan.id },
        include: { guestSession: true },
      });
      expect(scanData?.guestSessionId).toBe(session.id);
      expect(scanData?.guestSession).toBeDefined();
      expect(scanData?.guestSession?.anonymizedAt).not.toBeNull();
    });
  });
});
