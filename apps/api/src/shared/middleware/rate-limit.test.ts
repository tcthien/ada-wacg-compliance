import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';
import {
  createRateLimitMiddleware,
  RATE_LIMIT_CONFIG,
  checkBatchRateLimit,
  BATCH_RATE_LIMIT_CONFIG,
  type BatchRateLimitInfo,
} from './rate-limit.js';

/**
 * Mock Redis client
 */
const mockRedisClient = {
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  pipeline: vi.fn(),
} as unknown as Redis;

/**
 * Mock Redis module
 */
vi.mock('../../config/redis.js', () => ({
  getRedisClient: () => mockRedisClient,
}));

/**
 * Mock fingerprint utility
 */
vi.mock('../utils/fingerprint.js', () => ({
  generateFingerprint: () => 'test-fingerprint',
}));

/**
 * Create mock request and reply objects
 */
function createMockRequestReply(
  url?: string,
  method: 'body' | 'query' = 'body'
): {
  request: FastifyRequest;
  reply: FastifyReply;
} {
  const request = {
    body: method === 'body' && url ? { url } : {},
    query: method === 'query' && url ? { url } : {},
    headers: {
      'user-agent': 'Mozilla/5.0 (Test)',
      'accept-language': 'en-US',
      'accept-encoding': 'gzip',
    },
    log: {
      error: vi.fn(),
    },
  } as unknown as FastifyRequest;

  const reply = {
    header: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;

  return { request, reply };
}

/**
 * Create mock pipeline
 */
function createMockPipeline(count: number) {
  return {
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, count], // INCR result
      [null, 'OK'],  // EXPIRE result
    ]),
  };
}

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createRateLimitMiddleware', () => {
    it('should allow request when under rate limit', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com');
      const mockNext = vi.fn();

      // Mock Redis responses
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('5');
      const mockPipeline = createMockPipeline(6);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(1800);

      await middleware(request, reply, mockNext);

      // Should set rate limit headers
      expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
      expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));

      // Should not block request
      expect(reply.code).not.toHaveBeenCalledWith(429);
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should block request when rate limit exceeded', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com');
      const mockNext = vi.fn();

      // Mock Redis responses - already at limit
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('10');
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(1800);

      await middleware(request, reply, mockNext);

      // Should set rate limit headers
      expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
      expect(reply.header).toHaveBeenCalledWith('Retry-After', '1800');

      // Should return 429
      expect(reply.code).toHaveBeenCalledWith(429);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: expect.stringContaining('Rate limit exceeded'),
        retryAfter: 1800,
      });
    });

    it('should handle first request (no existing count)', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com');
      const mockNext = vi.fn();

      // Mock Redis responses - no existing count
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await middleware(request, reply, mockNext);

      // Should increment counter
      expect(mockPipeline.incr).toHaveBeenCalled();
      expect(mockPipeline.expire).toHaveBeenCalledWith(expect.any(String), 3600);

      // Should set headers with 9 remaining
      expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');

      // Should not block
      expect(reply.code).not.toHaveBeenCalledWith(429);
    });

    it('should skip rate limiting when no URL provided', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply(); // No URL
      const mockNext = vi.fn();

      await middleware(request, reply, mockNext);

      // Should not interact with Redis
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(mockRedisClient.pipeline).not.toHaveBeenCalled();

      // Should not set headers or block
      expect(reply.header).not.toHaveBeenCalled();
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('should handle URL from query parameter', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com', 'query');
      const mockNext = vi.fn();

      // Mock Redis responses
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await middleware(request, reply, mockNext);

      // Should process rate limit
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    });

    it('should use custom URL parameter name', async () => {
      const middleware = createRateLimitMiddleware('targetUrl');
      const request = {
        body: { targetUrl: 'https://example.com' },
        headers: {
          'user-agent': 'Mozilla/5.0 (Test)',
          'accept-language': 'en-US',
          'accept-encoding': 'gzip',
        },
        log: { error: vi.fn() },
      } as unknown as FastifyRequest;

      const reply = {
        header: vi.fn().mockReturnThis(),
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      const mockNext = vi.fn();

      // Mock Redis responses
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await middleware(request, reply, mockNext);

      // Should process rate limit
      expect(mockRedisClient.get).toHaveBeenCalled();
    });

    it('should normalize URLs for consistent rate limiting', async () => {
      const middleware = createRateLimitMiddleware('url');
      const mockNext = vi.fn();

      // Mock Redis responses
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      // Test with different URL formats
      const { request: req1, reply: reply1 } = createMockRequestReply('https://example.com');
      const { request: req2, reply: reply2 } = createMockRequestReply('HTTPS://EXAMPLE.COM');
      const { request: req3, reply: reply3 } = createMockRequestReply('  https://example.com  ');

      await middleware(req1, reply1, mockNext);
      const key1 = (mockRedisClient.get as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

      vi.clearAllMocks();
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('1');
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);

      await middleware(req2, reply2, mockNext);
      const key2 = (mockRedisClient.get as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

      vi.clearAllMocks();
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('2');
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);

      await middleware(req3, reply3, mockNext);
      const key3 = (mockRedisClient.get as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

      // All should use same key
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it('should handle Redis errors gracefully (fail open)', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com');
      const mockNext = vi.fn();

      // Mock Redis error
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Redis connection failed')
      );

      await middleware(request, reply, mockNext);

      // Should log error
      expect(request.log.error).toHaveBeenCalled();

      // Should not block request (fail open)
      expect(reply.code).not.toHaveBeenCalledWith(429);
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should handle pipeline errors gracefully', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com');
      const mockNext = vi.fn();

      // Mock successful get but failed pipeline
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('5');
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Pipeline failed')),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);

      await middleware(request, reply, mockNext);

      // Should log error
      expect(request.log.error).toHaveBeenCalled();

      // Should not block request (fail open)
      expect(reply.code).not.toHaveBeenCalledWith(429);
    });

    it('should handle TTL errors gracefully', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com');
      const mockNext = vi.fn();

      // Mock Redis responses
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('5');
      const mockPipeline = createMockPipeline(6);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('TTL failed')
      );

      await middleware(request, reply, mockNext);

      // Should use default TTL
      expect(reply.header).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );

      // Should not block request
      expect(reply.code).not.toHaveBeenCalledWith(429);
    });

    it('should calculate correct reset time', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com');
      const mockNext = vi.fn();

      const ttl = 1800; // 30 minutes
      const now = Date.now();

      // Mock Redis responses
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('5');
      const mockPipeline = createMockPipeline(6);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(ttl);

      await middleware(request, reply, mockNext);

      // Get the reset time from header call
      const resetCall = (reply.header as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === 'X-RateLimit-Reset'
      );
      const resetTime = parseInt(resetCall?.[1] as string, 10);

      // Should be approximately now + ttl (allow 5 second variance)
      const expectedReset = Math.floor(now / 1000) + ttl;
      expect(resetTime).toBeGreaterThanOrEqual(expectedReset - 5);
      expect(resetTime).toBeLessThanOrEqual(expectedReset + 5);
    });

    it('should enforce exact rate limit (10 requests)', async () => {
      const middleware = createRateLimitMiddleware('url');
      const mockNext = vi.fn();

      // Test requests 1-9: should pass
      for (let i = 1; i <= 9; i++) {
        vi.clearAllMocks();
        const { request, reply } = createMockRequestReply('https://example.com');

        (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(String(i - 1));
        const mockPipeline = createMockPipeline(i);
        (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
        (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

        await middleware(request, reply, mockNext);

        expect(reply.code).not.toHaveBeenCalledWith(429);
        expect(reply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', String(10 - i));
      }

      // Request 10: should pass (at limit)
      vi.clearAllMocks();
      const { request: req10, reply: reply10 } = createMockRequestReply('https://example.com');
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('9');
      const mockPipeline10 = createMockPipeline(10);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline10);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await middleware(req10, reply10, mockNext);

      expect(reply10.code).not.toHaveBeenCalledWith(429);
      expect(reply10.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');

      // Request 11: should be blocked
      vi.clearAllMocks();
      const { request: req11, reply: reply11 } = createMockRequestReply('https://example.com');
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('10');
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await middleware(req11, reply11, mockNext);

      expect(reply11.code).toHaveBeenCalledWith(429);
      expect(reply11.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
        })
      );
    });

    it('should differentiate rate limits by URL', async () => {
      const middleware = createRateLimitMiddleware('url');
      const mockNext = vi.fn();

      // Request to URL 1
      const { request: req1, reply: reply1 } = createMockRequestReply('https://example.com');
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline1 = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline1);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await middleware(req1, reply1, mockNext);
      const key1 = (mockRedisClient.get as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

      // Request to URL 2
      vi.clearAllMocks();
      const { request: req2, reply: reply2 } = createMockRequestReply('https://different.com');
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');
      const mockPipeline2 = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline2);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await middleware(req2, reply2, mockNext);
      const key2 = (mockRedisClient.get as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];

      // Keys should be different
      expect(key1).not.toBe(key2);
    });

    it('should set correct TTL on key creation', async () => {
      const middleware = createRateLimitMiddleware('url');
      const { request, reply } = createMockRequestReply('https://example.com');
      const mockNext = vi.fn();

      // Mock Redis responses
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const mockPipeline = createMockPipeline(1);
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await middleware(request, reply, mockNext);

      // Should set 1 hour TTL
      expect(mockPipeline.expire).toHaveBeenCalledWith(
        expect.any(String),
        RATE_LIMIT_CONFIG.WINDOW_SECONDS
      );
    });
  });

  describe('checkBatchRateLimit', () => {
    it('should allow batch submission when under limits', async () => {
      // Mock Redis responses - no previous usage
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const mockPipeline = {
        incrby: vi.fn().mockReturnThis(),
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 10], // incrby result
          [null, 'OK'], // expire result
          [null, 1], // incr result
          [null, 'OK'], // expire result
        ]),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      const result = await checkBatchRateLimit('test-session', 10);

      expect(result.exceeded).toBe(false);
      expect(result.urlCount).toBe(10);
      expect(result.batchCount).toBe(1);
      expect(result.remainingUrls).toBe(BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR - 10);
      expect(result.remainingBatches).toBe(BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR - 1);
      expect(result.maxUrls).toBe(100);
      expect(result.maxBatches).toBe(2);
    });

    it('should throw when URL limit exceeded', async () => {
      // Mock Redis responses - 95 URLs already used
      (mockRedisClient.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('95') // URL count
        .mockResolvedValueOnce('1'); // Batch count
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await expect(checkBatchRateLimit('test-session', 10)).rejects.toMatchObject({
        exceeded: true,
        message: expect.stringContaining('URL limit exceeded'),
        urlCount: 95,
        remainingUrls: 5,
      });
    });

    it('should throw when batch limit exceeded', async () => {
      // Mock Redis responses - 2 batches already used
      (mockRedisClient.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('50') // URL count
        .mockResolvedValueOnce('2'); // Batch count
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await expect(checkBatchRateLimit('test-session', 10)).rejects.toMatchObject({
        exceeded: true,
        message: expect.stringContaining('Batch limit exceeded'),
        batchCount: 2,
        remainingBatches: 0,
      });
    });

    it('should include both error messages when both limits exceeded', async () => {
      // Mock Redis responses - both limits at max
      (mockRedisClient.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('95') // URL count
        .mockResolvedValueOnce('2'); // Batch count
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      try {
        await checkBatchRateLimit('test-session', 10);
        expect.fail('Should have thrown');
      } catch (error) {
        const rateLimitError = error as BatchRateLimitInfo;
        expect(rateLimitError.exceeded).toBe(true);
        expect(rateLimitError.message).toContain('URL limit exceeded');
        expect(rateLimitError.message).toContain('Batch limit exceeded');
      }
    });

    it('should return correct rate limit info with partial usage', async () => {
      // Mock Redis responses - 30 URLs, 1 batch already used
      (mockRedisClient.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('30') // URL count
        .mockResolvedValueOnce('1'); // Batch count

      const mockPipeline = {
        incrby: vi.fn().mockReturnThis(),
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 50], // incrby result (30 + 20)
          [null, 'OK'], // expire result
          [null, 2], // incr result (1 + 1)
          [null, 'OK'], // expire result
        ]),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(1800);

      const result = await checkBatchRateLimit('test-session', 20);

      expect(result.urlCount).toBe(50); // 30 + 20
      expect(result.batchCount).toBe(2); // 1 + 1
      expect(result.remainingUrls).toBe(50); // 100 - 50
      expect(result.remainingBatches).toBe(0); // 2 - 2
      expect(result.resetTime).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should fail open on Redis errors', async () => {
      vi.clearAllMocks(); // Clear any previous mocks

      // Mock Redis to completely fail
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Redis connection failed')
      );

      const mockFailPipeline = {
        incrby: vi.fn().mockReturnThis(),
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis pipeline failed')),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockFailPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Redis TTL failed')
      );

      const result = await checkBatchRateLimit('test-session-fail-open', 10);

      expect(result.exceeded).toBe(false);
      expect(result.urlCount).toBe(0); // Should be 0 when failed open
      expect(result.remainingUrls).toBe(BATCH_RATE_LIMIT_CONFIG.MAX_URLS_PER_HOUR);
      expect(result.remainingBatches).toBe(BATCH_RATE_LIMIT_CONFIG.MAX_BATCHES_PER_HOUR);
    });

    it('should use Redis pipeline for atomic updates', async () => {
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');

      const mockPipeline = {
        incrby: vi.fn().mockReturnThis(),
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 10],
          [null, 'OK'],
          [null, 1],
          [null, 'OK'],
        ]),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await checkBatchRateLimit('test-session', 10);

      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(mockPipeline.incrby).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit_batch_urls:test-session'),
        10
      );
      expect(mockPipeline.incr).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit_batch_count:test-session')
      );
      expect(mockPipeline.expire).toHaveBeenCalledTimes(2);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should enforce exact URL limit (100 URLs)', async () => {
      // Mock 99 URLs already used
      (mockRedisClient.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('99')
        .mockResolvedValueOnce('0');

      const mockPipeline = {
        incrby: vi.fn().mockReturnThis(),
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 100],
          [null, 'OK'],
          [null, 1],
          [null, 'OK'],
        ]),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      // Should allow exactly 1 more URL
      const result = await checkBatchRateLimit('test-session', 1);
      expect(result.exceeded).toBe(false);
      expect(result.urlCount).toBe(100);
      expect(result.remainingUrls).toBe(0);

      // Should reject 2 URLs
      vi.clearAllMocks();
      (mockRedisClient.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('99')
        .mockResolvedValueOnce('0');
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await expect(checkBatchRateLimit('test-session', 2)).rejects.toMatchObject({
        exceeded: true,
        message: expect.stringContaining('URL limit exceeded'),
      });
    });

    it('should enforce exact batch limit (2 batches)', async () => {
      // Mock 1 batch already used
      (mockRedisClient.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('30')
        .mockResolvedValueOnce('1');

      const mockPipeline = {
        incrby: vi.fn().mockReturnThis(),
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 40],
          [null, 'OK'],
          [null, 2],
          [null, 'OK'],
        ]),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      // Should allow exactly 1 more batch
      const result = await checkBatchRateLimit('test-session', 10);
      expect(result.exceeded).toBe(false);
      expect(result.batchCount).toBe(2);
      expect(result.remainingBatches).toBe(0);

      // Should reject 3rd batch
      vi.clearAllMocks();
      (mockRedisClient.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('40')
        .mockResolvedValueOnce('2');
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await expect(checkBatchRateLimit('test-session', 10)).rejects.toMatchObject({
        exceeded: true,
        message: expect.stringContaining('Batch limit exceeded'),
      });
    });

    it('should include reset time in response', async () => {
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');

      const mockPipeline = {
        incrby: vi.fn().mockReturnThis(),
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 10], [null, 'OK'], [null, 1], [null, 'OK']]),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);

      const ttl = 1800;
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(ttl);

      const now = Math.floor(Date.now() / 1000);
      const result = await checkBatchRateLimit('test-session', 10);

      expect(result.resetTime).toBeGreaterThanOrEqual(now + ttl - 5);
      expect(result.resetTime).toBeLessThanOrEqual(now + ttl + 5);
    });

    it('should set correct TTL on keys', async () => {
      (mockRedisClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('0');

      const mockPipeline = {
        incrby: vi.fn().mockReturnThis(),
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 10], [null, 'OK'], [null, 1], [null, 'OK']]),
      };
      (mockRedisClient.pipeline as ReturnType<typeof vi.fn>).mockReturnValue(mockPipeline);
      (mockRedisClient.ttl as ReturnType<typeof vi.fn>).mockResolvedValue(3600);

      await checkBatchRateLimit('test-session', 10);

      expect(mockPipeline.expire).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit_batch_urls:test-session'),
        3600
      );
      expect(mockPipeline.expire).toHaveBeenCalledWith(
        expect.stringContaining('rate_limit_batch_count:test-session'),
        3600
      );
    });
  });
});
