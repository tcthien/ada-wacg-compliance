import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LockManager, LockInfo } from '../src/lock-manager.js';
import { mkdtemp, rm, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LockManager', () => {
  let testDir: string;
  let lockPath: string;
  let manager: LockManager;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'lock-test-'));
    lockPath = join(testDir, 'test.lock');
    manager = new LockManager(lockPath);
  });

  afterEach(async () => {
    // Clean up test directory and all its contents
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Acquire lock (no existing)', () => {
    it('should create lock file and return true', async () => {
      const acquired = await manager.acquireLock();

      expect(acquired).toBe(true);

      // Verify lock file exists
      await expect(access(lockPath)).resolves.toBeUndefined();

      // Verify lock file contains valid JSON
      const content = await readFile(lockPath, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(content);

      expect(lockInfo).toHaveProperty('pid');
      expect(lockInfo.pid).toBe(process.pid);
      expect(lockInfo).toHaveProperty('startedAt');
      expect(lockInfo).toHaveProperty('hostname');
    });

    it('should create properly formatted lock file with current process info', async () => {
      await manager.acquireLock();

      const content = await readFile(lockPath, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(content);

      // Verify PID matches current process
      expect(lockInfo.pid).toBe(process.pid);

      // Verify timestamp is recent (within 5 seconds)
      const startedAt = new Date(lockInfo.startedAt);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - startedAt.getTime());
      expect(timeDiff).toBeLessThan(5000);

      // Verify hostname is set
      expect(lockInfo.hostname).toBeDefined();
      expect(lockInfo.hostname.length).toBeGreaterThan(0);
    });

    it('should create lock file with proper JSON formatting', async () => {
      await manager.acquireLock();

      const content = await readFile(lockPath, 'utf-8');

      // Verify JSON is formatted (has newlines and indentation)
      expect(content).toContain('\n');
      expect(content).toContain('  ');
      expect(content).toMatch(/"pid":\s+\d+/);
      expect(content).toMatch(/"startedAt":\s+"/);
      expect(content).toMatch(/"hostname":\s+"/);
    });
  });

  describe('Acquire lock (existing, running PID)', () => {
    it('should return false when lock file exists with running PID', async () => {
      // Create first lock
      const firstAcquired = await manager.acquireLock();
      expect(firstAcquired).toBe(true);

      // Try to acquire again (same manager, same PID)
      const secondAcquired = await manager.acquireLock();
      expect(secondAcquired).toBe(false);
    });

    it('should return false when another manager tries to acquire lock', async () => {
      // First manager acquires lock
      const manager1 = new LockManager(lockPath);
      const acquired1 = await manager1.acquireLock();
      expect(acquired1).toBe(true);

      // Second manager tries to acquire same lock
      const manager2 = new LockManager(lockPath);
      const acquired2 = await manager2.acquireLock();
      expect(acquired2).toBe(false);
    });

    it('should preserve existing lock file when acquisition fails', async () => {
      // First acquisition
      await manager.acquireLock();

      // Read original lock info
      const originalContent = await readFile(lockPath, 'utf-8');
      const originalLock: LockInfo = JSON.parse(originalContent);

      // Try to acquire again
      await manager.acquireLock();

      // Verify lock file is unchanged
      const currentContent = await readFile(lockPath, 'utf-8');
      const currentLock: LockInfo = JSON.parse(currentContent);

      expect(currentLock.pid).toBe(originalLock.pid);
      expect(currentLock.startedAt).toBe(originalLock.startedAt);
      expect(currentLock.hostname).toBe(originalLock.hostname);
    });
  });

  describe('Acquire lock (existing, dead PID)', () => {
    it('should remove stale lock and acquire when PID is dead', async () => {
      // Create lock file with a very high PID that doesn't exist
      const staleLock: LockInfo = {
        pid: 999999,
        startedAt: new Date().toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(staleLock, null, 2), 'utf-8');

      // Try to acquire lock
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);

      // Verify lock file now contains current process PID
      const content = await readFile(lockPath, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(content);
      expect(lockInfo.pid).toBe(process.pid);
    });

    it('should handle stale lock with non-existent high PID', async () => {
      // Create lock file with very high PID that doesn't exist
      const staleLock: LockInfo = {
        pid: 888888,
        startedAt: new Date().toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(staleLock, null, 2), 'utf-8');

      // Should successfully acquire
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);

      // Verify new lock info
      const content = await readFile(lockPath, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(content);
      expect(lockInfo.pid).toBe(process.pid);
    });

    it('should recursively acquire after removing stale lock', async () => {
      // Create stale lock
      const staleLock: LockInfo = {
        pid: 999999,
        startedAt: new Date().toISOString(),
        hostname: 'old-host',
      };
      await writeFile(lockPath, JSON.stringify(staleLock, null, 2), 'utf-8');

      // Acquire should succeed (removes stale, then acquires)
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);

      // Verify the lock is properly acquired
      const lockInfo = await manager.readLockInfo();
      expect(lockInfo).not.toBeNull();
      expect(lockInfo?.pid).toBe(process.pid);
    });
  });

  describe('Acquire lock (existing, >24h old)', () => {
    it('should remove lock older than 24 hours and acquire', async () => {
      // Create lock with timestamp >24 hours ago
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const oldLock: LockInfo = {
        pid: process.pid, // Use current PID (process is running)
        startedAt: twentyFiveHoursAgo.toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(oldLock, null, 2), 'utf-8');

      // Should acquire because lock is too old
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);

      // Verify new lock has recent timestamp
      const content = await readFile(lockPath, 'utf-8');
      const lockInfo: LockInfo = JSON.parse(content);

      const startedAt = new Date(lockInfo.startedAt);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - startedAt.getTime());
      expect(timeDiff).toBeLessThan(5000); // Recent timestamp
    });

    it('should treat 24h+ lock as stale even if PID is running', async () => {
      // Create lock with current PID but very old timestamp
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
      const oldLock: LockInfo = {
        pid: process.pid, // Current process PID
        startedAt: thirtyHoursAgo.toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(oldLock, null, 2), 'utf-8');

      // Should still acquire because of age
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);
    });

    it('should not treat 23h old lock as stale if PID is running', async () => {
      // Create lock 23 hours ago with current PID
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
      const recentLock: LockInfo = {
        pid: process.pid,
        startedAt: twentyThreeHoursAgo.toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(recentLock, null, 2), 'utf-8');

      // Should NOT acquire because lock is not stale yet
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(false);
    });

    it('should remove lock exactly at 24h boundary', async () => {
      // Create lock exactly 24 hours + 1 second ago
      const exactlyTwentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000 + 1000));
      const oldLock: LockInfo = {
        pid: process.pid,
        startedAt: exactlyTwentyFourHoursAgo.toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(oldLock, null, 2), 'utf-8');

      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);
    });
  });

  describe('Release lock', () => {
    it('should remove lock file', async () => {
      // Create lock
      await manager.acquireLock();
      await expect(access(lockPath)).resolves.toBeUndefined();

      // Release lock
      await manager.releaseLock();

      // Verify lock file is removed
      await expect(access(lockPath)).rejects.toThrow();
    });

    it('should not throw error if lock file does not exist', async () => {
      // Should not throw
      await expect(manager.releaseLock()).resolves.toBeUndefined();
    });

    it('should allow reacquisition after release', async () => {
      // Acquire, release, acquire again
      const acquired1 = await manager.acquireLock();
      expect(acquired1).toBe(true);

      await manager.releaseLock();

      const acquired2 = await manager.acquireLock();
      expect(acquired2).toBe(true);
    });

    it('should clean up lock file completely', async () => {
      await manager.acquireLock();
      await manager.releaseLock();

      // Verify file truly doesn't exist
      try {
        await access(lockPath);
        // If we get here, file exists (should not happen)
        expect.fail('Lock file should not exist after release');
      } catch (error) {
        // Expected - file should not exist
        expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });
  });

  describe('Concurrent acquire attempts', () => {
    it('should allow only one acquisition to succeed', async () => {
      // Use the 'wx' flag behavior - first write succeeds, second fails
      const manager1 = new LockManager(lockPath);
      const manager2 = new LockManager(lockPath);

      // Both try to acquire simultaneously
      const [acquired1, acquired2] = await Promise.all([
        manager1.acquireLock(),
        manager2.acquireLock(),
      ]);

      // Exactly one should succeed
      const successCount = [acquired1, acquired2].filter((result) => result === true).length;
      expect(successCount).toBe(1);

      // Verify only one lock file exists
      await expect(access(lockPath)).resolves.toBeUndefined();

      // Verify lock file contains valid info
      const lockInfo = await manager1.readLockInfo();
      expect(lockInfo).not.toBeNull();
      expect(lockInfo?.pid).toBe(process.pid);
    });

    it('should handle race condition with multiple managers', async () => {
      const manager1 = new LockManager(lockPath);
      const manager2 = new LockManager(lockPath);
      const manager3 = new LockManager(lockPath);

      // Three managers try to acquire
      const results = await Promise.all([
        manager1.acquireLock(),
        manager2.acquireLock(),
        manager3.acquireLock(),
      ]);

      // Only one should succeed
      const successCount = results.filter((result) => result === true).length;
      expect(successCount).toBe(1);
    });

    it('should use exclusive file creation flag', async () => {
      // First acquisition
      await manager.acquireLock();

      // Try to create lock file manually with 'wx' flag (should fail)
      const lockInfo: LockInfo = {
        pid: 12345,
        startedAt: new Date().toISOString(),
        hostname: 'test',
      };

      await expect(
        writeFile(lockPath, JSON.stringify(lockInfo), { flag: 'wx' })
      ).rejects.toThrow();
    });
  });

  describe('isProcessRunning', () => {
    it('should return true for current process PID', async () => {
      // Acquire lock (uses current PID)
      await manager.acquireLock();

      // Read lock and verify PID is running
      const lockInfo = await manager.readLockInfo();
      expect(lockInfo).not.toBeNull();
      expect(lockInfo?.pid).toBe(process.pid);

      // Try to acquire again - should fail because PID is running
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(false);
    });

    it('should return false for invalid PID', async () => {
      // Create lock with very large PID that doesn't exist
      const invalidLock: LockInfo = {
        pid: 999999,
        startedAt: new Date().toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(invalidLock, null, 2), 'utf-8');

      // Should successfully acquire (PID doesn't exist)
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);
    });

    it('should return false for very high non-existent PID', async () => {
      const invalidLock: LockInfo = {
        pid: 777777,
        startedAt: new Date().toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(invalidLock, null, 2), 'utf-8');

      // Should successfully acquire
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);
    });

    it('should return false for another very high non-existent PID', async () => {
      const invalidLock: LockInfo = {
        pid: 666666,
        startedAt: new Date().toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(invalidLock, null, 2), 'utf-8');

      // Should successfully acquire
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);
    });

    it('should handle PID check correctly for running process', async () => {
      // First manager acquires lock
      const manager1 = new LockManager(lockPath);
      const acquired1 = await manager1.acquireLock();
      expect(acquired1).toBe(true);

      // Second manager tries to acquire - should fail because process is running
      const manager2 = new LockManager(lockPath);
      const acquired2 = await manager2.acquireLock();
      expect(acquired2).toBe(false);
    });
  });

  describe('readLockInfo', () => {
    it('should return lock information when file exists', async () => {
      await manager.acquireLock();

      const lockInfo = await manager.readLockInfo();
      expect(lockInfo).not.toBeNull();
      expect(lockInfo?.pid).toBe(process.pid);
      expect(lockInfo?.startedAt).toBeDefined();
      expect(lockInfo?.hostname).toBeDefined();
    });

    it('should return null when file does not exist', async () => {
      const lockInfo = await manager.readLockInfo();
      expect(lockInfo).toBeNull();
    });

    it('should return null for invalid JSON file', async () => {
      // Write invalid JSON
      await writeFile(lockPath, '{ invalid json', 'utf-8');

      const lockInfo = await manager.readLockInfo();
      expect(lockInfo).toBeNull();
    });

    it('should return null for corrupted JSON', async () => {
      // Write partially corrupted JSON
      await writeFile(lockPath, '{"pid": 12345, "startedAt":', 'utf-8');

      const lockInfo = await manager.readLockInfo();
      expect(lockInfo).toBeNull();
    });
  });

  describe('getLockFilePath', () => {
    it('should return the correct lock file path', () => {
      const path = manager.getLockFilePath();
      expect(path).toBe(lockPath);
    });

    it('should return the path provided in constructor', () => {
      const customPath = join(testDir, 'custom.lock');
      const customManager = new LockManager(customPath);

      expect(customManager.getLockFilePath()).toBe(customPath);
    });
  });

  describe('Integration - full lock lifecycle', () => {
    it('should handle complete acquire-release cycle', async () => {
      // Acquire lock
      const acquired1 = await manager.acquireLock();
      expect(acquired1).toBe(true);

      // Verify lock info
      const lockInfo1 = await manager.readLockInfo();
      expect(lockInfo1?.pid).toBe(process.pid);

      // Try to acquire again (should fail)
      const acquired2 = await manager.acquireLock();
      expect(acquired2).toBe(false);

      // Release lock
      await manager.releaseLock();

      // Verify lock file is gone
      const lockInfo2 = await manager.readLockInfo();
      expect(lockInfo2).toBeNull();

      // Acquire again (should succeed)
      const acquired3 = await manager.acquireLock();
      expect(acquired3).toBe(true);

      // Clean up
      await manager.releaseLock();
    });

    it('should handle stale lock cleanup and reacquisition', async () => {
      // Create stale lock (dead PID)
      const staleLock: LockInfo = {
        pid: 999999,
        startedAt: new Date().toISOString(),
        hostname: 'old-host',
      };
      await writeFile(lockPath, JSON.stringify(staleLock, null, 2), 'utf-8');

      // Acquire should remove stale lock and succeed
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);

      // Verify new lock info
      const lockInfo = await manager.readLockInfo();
      expect(lockInfo?.pid).toBe(process.pid);
      expect(lockInfo?.hostname).not.toBe('old-host');

      // Release
      await manager.releaseLock();
      const finalLockInfo = await manager.readLockInfo();
      expect(finalLockInfo).toBeNull();
    });

    it('should handle old lock cleanup (>24h)', async () => {
      // Create old lock with current PID
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const oldLock: LockInfo = {
        pid: process.pid,
        startedAt: oldTimestamp.toISOString(),
        hostname: 'test-host',
      };
      await writeFile(lockPath, JSON.stringify(oldLock, null, 2), 'utf-8');

      // Should acquire because lock is too old
      const acquired = await manager.acquireLock();
      expect(acquired).toBe(true);

      // Verify new lock has recent timestamp
      const lockInfo = await manager.readLockInfo();
      const lockAge = Date.now() - new Date(lockInfo!.startedAt).getTime();
      expect(lockAge).toBeLessThan(5000); // Less than 5 seconds old
    });
  });
});
