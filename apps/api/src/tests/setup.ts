/**
 * Integration Test Setup
 *
 * Provides test infrastructure for integration tests:
 * - Test database connection management
 * - Redis client mocking
 * - Test data cleanup
 * - Shared test utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getPrismaClient } from '../config/database.js';
import type { PrismaClient } from '@prisma/client';

/**
 * Global test database client
 */
let testPrisma: PrismaClient;

/**
 * Setup test database connection
 * Runs once before all tests
 */
beforeAll(async () => {
  testPrisma = getPrismaClient();

  // Verify database connection
  try {
    await testPrisma.$connect();
    console.log('✅ Test database connected');
  } catch (error) {
    console.error('❌ Test database connection failed:', error);
    throw error;
  }
});

/**
 * Cleanup test data before each test
 * Ensures test isolation by clearing all tables
 */
beforeEach(async () => {
  // Delete in correct order to avoid foreign key constraints
  await testPrisma.issue.deleteMany();
  await testPrisma.scanResult.deleteMany();
  await testPrisma.scan.deleteMany();
  await testPrisma.guestSession.deleteMany();
});

/**
 * Cleanup after each test
 * Additional cleanup if needed
 */
afterEach(async () => {
  // Optional: Additional cleanup
});

/**
 * Cleanup and disconnect after all tests
 */
afterAll(async () => {
  await testPrisma.$disconnect();
  console.log('✅ Test database disconnected');
});

/**
 * Get test Prisma client
 * Use this in tests to access the database
 */
export function getTestPrismaClient(): PrismaClient {
  return testPrisma;
}

/**
 * Create a test guest session
 *
 * @param fingerprint - Device fingerprint (default: 'test-fingerprint')
 * @returns Created guest session
 */
export async function createTestSession(fingerprint: string = 'test-fingerprint') {
  const sessionToken = `test-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 86400000); // 24 hours

  return await testPrisma.guestSession.create({
    data: {
      sessionToken,
      fingerprint,
      expiresAt,
    },
  });
}

/**
 * Create a test scan
 *
 * @param sessionId - Guest session ID
 * @param overrides - Optional field overrides
 * @returns Created scan
 */
export async function createTestScan(
  sessionId: string,
  overrides: {
    url?: string;
    email?: string;
    wcagLevel?: 'A' | 'AA' | 'AAA';
    status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  } = {}
) {
  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  return await testPrisma.scan.create({
    data: {
      id: scanId,
      guestSessionId: sessionId,
      url: overrides.url ?? 'https://example.com',
      email: overrides.email ?? null,
      wcagLevel: overrides.wcagLevel ?? 'AA',
      status: overrides.status ?? 'PENDING',
    },
  });
}

/**
 * Create a test scan result
 *
 * @param scanId - Scan ID
 * @param overrides - Optional field overrides
 * @returns Created scan result
 */
export async function createTestScanResult(
  scanId: string,
  overrides: {
    totalIssues?: number;
    criticalCount?: number;
    seriousCount?: number;
    moderateCount?: number;
    minorCount?: number;
    passedChecks?: number;
    inapplicableChecks?: number;
  } = {}
) {
  return await testPrisma.scanResult.create({
    data: {
      scanId,
      totalIssues: overrides.totalIssues ?? 0,
      criticalCount: overrides.criticalCount ?? 0,
      seriousCount: overrides.seriousCount ?? 0,
      moderateCount: overrides.moderateCount ?? 0,
      minorCount: overrides.minorCount ?? 0,
      passedChecks: overrides.passedChecks ?? 0,
      inapplicableChecks: overrides.inapplicableChecks ?? 0,
    },
  });
}

/**
 * Wait for a condition to be true
 *
 * @param condition - Async function that returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds (default: 5000)
 * @param interval - Check interval in milliseconds (default: 100)
 * @returns True if condition met, false if timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
