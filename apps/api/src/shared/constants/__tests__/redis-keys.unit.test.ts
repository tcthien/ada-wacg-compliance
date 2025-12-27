import { describe, it, expect } from 'vitest';
import {
  RedisKeys,
  RedisTTL,
  validateRedisKey,
  extractKeyPattern,
  getTTLForPattern,
} from '../redis-keys.js';

describe('RedisKeys', () => {
  describe('RATE_LIMIT', () => {
    it('should build correct rate limit key', () => {
      const key = RedisKeys.RATE_LIMIT.build('192.168.1.1');
      expect(key).toBe('rate_limit:192.168.1.1');
    });

    it('should have correct TTL', () => {
      expect(RedisKeys.RATE_LIMIT.ttl).toBe(60);
    });
  });

  describe('SESSION', () => {
    it('should build correct session key', () => {
      const key = RedisKeys.SESSION.build('session-123');
      expect(key).toBe('session:session-123');
    });

    it('should have correct TTL', () => {
      expect(RedisKeys.SESSION.ttl).toBe(3600);
    });
  });

  describe('SCAN_STATUS', () => {
    it('should build correct scan status key', () => {
      const key = RedisKeys.SCAN_STATUS.build('scan-456');
      expect(key).toBe('scan:scan-456:status');
    });

    it('should have correct TTL', () => {
      expect(RedisKeys.SCAN_STATUS.ttl).toBe(86400);
    });
  });

  describe('SCAN_PROGRESS', () => {
    it('should build correct scan progress key', () => {
      const key = RedisKeys.SCAN_PROGRESS.build('scan-789');
      expect(key).toBe('scan:scan-789:progress');
    });

    it('should have correct TTL', () => {
      expect(RedisKeys.SCAN_PROGRESS.ttl).toBe(86400);
    });
  });

  describe('SCAN_RESULTS', () => {
    it('should build correct scan results key', () => {
      const key = RedisKeys.SCAN_RESULTS.build('scan-abc');
      expect(key).toBe('scan:scan-abc:results');
    });

    it('should have correct TTL', () => {
      expect(RedisKeys.SCAN_RESULTS.ttl).toBe(604800);
    });
  });

  describe('USER_SCANS', () => {
    it('should build correct user scans key', () => {
      const key = RedisKeys.USER_SCANS.build('user-123');
      expect(key).toBe('user:user-123:scans');
    });

    it('should have correct TTL', () => {
      expect(RedisKeys.USER_SCANS.ttl).toBe(2592000);
    });
  });

  describe('CACHE', () => {
    it('should build correct cache key', () => {
      const key = RedisKeys.CACHE.build('scans', 'abc123');
      expect(key).toBe('cache:scans:abc123');
    });

    it('should have correct TTL', () => {
      expect(RedisKeys.CACHE.ttl).toBe(300);
    });
  });
});

describe('RedisTTL', () => {
  it('should have correct TTL constants', () => {
    expect(RedisTTL.VERY_SHORT).toBe(60);
    expect(RedisTTL.SHORT).toBe(300);
    expect(RedisTTL.MEDIUM).toBe(3600);
    expect(RedisTTL.LONG).toBe(86400);
    expect(RedisTTL.VERY_LONG).toBe(604800);
    expect(RedisTTL.PERSISTENT).toBe(2592000);
  });
});

describe('validateRedisKey', () => {
  it('should validate correct key formats', () => {
    expect(validateRedisKey('rate_limit:192.168.1.1')).toBe(true);
    expect(validateRedisKey('session:abc-123')).toBe(true);
    expect(validateRedisKey('scan:scan-123:status')).toBe(true);
    expect(validateRedisKey('cache:endpoint:hash123')).toBe(true);
  });

  it('should reject invalid key formats', () => {
    expect(validateRedisKey('invalid')).toBe(false);
    expect(validateRedisKey('invalid:')).toBe(false);
    expect(validateRedisKey(':invalid')).toBe(false);
    expect(validateRedisKey('UPPERCASE:KEY')).toBe(false);
    expect(validateRedisKey('key with spaces:value')).toBe(false);
    expect(validateRedisKey('key:value:extra:parts')).toBe(false);
  });

  it('should accept keys with hyphens and underscores', () => {
    expect(validateRedisKey('rate_limit:user-123')).toBe(true);
    expect(validateRedisKey('session:session_id-abc')).toBe(true);
  });
});

describe('extractKeyPattern', () => {
  it('should extract pattern from two-part keys', () => {
    expect(extractKeyPattern('rate_limit:192.168.1.1')).toBe('rate_limit');
    expect(extractKeyPattern('session:abc-123')).toBe('session');
  });

  it('should extract pattern from three-part keys', () => {
    expect(extractKeyPattern('scan:scan-123:status')).toBe('scan:status');
    expect(extractKeyPattern('scan:scan-456:progress')).toBe('scan:progress');
    expect(extractKeyPattern('cache:endpoint:hash')).toBe('cache:hash');
  });

  it('should return null for invalid keys', () => {
    expect(extractKeyPattern('invalid')).toBeNull();
    expect(extractKeyPattern('')).toBeNull();
  });
});

describe('getTTLForPattern', () => {
  it('should return correct TTL for known patterns', () => {
    expect(getTTLForPattern('rate_limit')).toBe(60);
    expect(getTTLForPattern('session')).toBe(3600);
    expect(getTTLForPattern('scan:status')).toBe(86400);
    expect(getTTLForPattern('scan:progress')).toBe(86400);
    expect(getTTLForPattern('scan:results')).toBe(604800);
    expect(getTTLForPattern('user:scans')).toBe(2592000);
    expect(getTTLForPattern('cache')).toBe(300);
  });

  it('should return null for unknown patterns', () => {
    expect(getTTLForPattern('unknown')).toBeNull();
    expect(getTTLForPattern('invalid:pattern')).toBeNull();
  });
});
