import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Mock environment variables
 */
const mockEnv = {
  NODE_ENV: 'test' as const,
  RECAPTCHA_SECRET_KEY: 'test-secret-key',
  PORT: 3001,
  HOST: '0.0.0.0',
  CORS_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'info' as const,
  API_PREFIX: '/api/v1',
};

/**
 * Mock env config before importing middleware
 */
vi.mock('../../config/env.js', () => ({
  env: mockEnv,
}));

/**
 * Mock fetch globally
 */
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Import middleware after mocks are set up
 */
const { recaptchaMiddleware, requireRecaptcha, RECAPTCHA_SCORE_THRESHOLD } =
  await import('./recaptcha.js');

/**
 * Mock Fastify request and reply objects
 */
function createMockRequestReply(options?: {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}): {
  request: FastifyRequest;
  reply: FastifyReply;
} {
  const request = {
    body: options?.body ?? {},
    headers: options?.headers ?? {},
    ip: '192.168.1.1',
    url: '/test',
    log: {
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as FastifyRequest;

  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as FastifyReply;

  return { request, reply };
}

/**
 * Mock successful reCAPTCHA response
 */
function mockSuccessfulRecaptcha(score = 0.9) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      success: true,
      score,
      action: 'submit',
      challenge_ts: '2024-01-01T00:00:00Z',
      hostname: 'localhost',
    }),
  });
}

/**
 * Mock failed reCAPTCHA response
 */
function mockFailedRecaptcha(errorCodes: string[] = ['invalid-input-response']) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      success: false,
      'error-codes': errorCodes,
    }),
  });
}

/**
 * Mock low score reCAPTCHA response
 */
function mockLowScoreRecaptcha(score = 0.1) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      success: true,
      score,
      action: 'submit',
      challenge_ts: '2024-01-01T00:00:00Z',
      hostname: 'localhost',
    }),
  });
}

/**
 * Mock reCAPTCHA API error
 */
function mockRecaptchaApiError() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
  });
}

/**
 * Mock reCAPTCHA network error
 */
function mockRecaptchaNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error('Network error'));
}

describe('recaptchaMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should skip validation when RECAPTCHA_SECRET_KEY is not configured', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      // Temporarily remove secret key
      const originalKey = mockEnv.RECAPTCHA_SECRET_KEY;
      mockEnv.RECAPTCHA_SECRET_KEY = '';

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(request.log.warn).toHaveBeenCalledWith(
        { path: '/test' },
        'reCAPTCHA not configured, skipping validation'
      );
      expect(reply.code).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore secret key
      mockEnv.RECAPTCHA_SECRET_KEY = originalKey;
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from request body', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockSuccessfulRecaptcha();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('response=test-token'),
        })
      );
    });

    it('should extract token from X-Recaptcha-Token header', async () => {
      const { request, reply } = createMockRequestReply({
        headers: { 'x-recaptcha-token': 'header-token' },
      });

      mockSuccessfulRecaptcha();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        expect.objectContaining({
          body: expect.stringContaining('response=header-token'),
        })
      );
    });

    it('should return 400 when token is missing', async () => {
      const { request, reply } = createMockRequestReply({
        body: {},
      });

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'reCAPTCHA token required',
        details: expect.stringContaining('Missing recaptchaToken'),
      });
    });

    it('should return 400 when token is empty string', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: '' },
      });

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.code).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
        })
      );
    });
  });

  describe('Client IP Extraction', () => {
    it('should extract IP from X-Forwarded-For header', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
      });

      mockSuccessfulRecaptcha();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('remoteip=203.0.113.1'),
        })
      );
    });

    it('should extract IP from X-Real-IP header', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
        headers: { 'x-real-ip': '203.0.113.5' },
      });

      mockSuccessfulRecaptcha();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('remoteip=203.0.113.5'),
        })
      );
    });

    it('should use request.ip when headers are not present', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockSuccessfulRecaptcha();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('remoteip=192.168.1.1'),
        })
      );
    });
  });

  describe('Token Verification', () => {
    it('should verify token with Google API', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockSuccessfulRecaptcha();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining('secret=test-secret-key'),
        }
      );
    });

    it('should attach score to request on successful verification', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockSuccessfulRecaptcha(0.85);

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(request.recaptchaScore).toBe(0.85);
      expect(reply.code).not.toHaveBeenCalled();
      expect(request.log.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 0.85,
        }),
        'reCAPTCHA validation successful'
      );
    });

    it('should return 403 when verification fails', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'invalid-token' },
      });

      mockFailedRecaptcha(['invalid-input-response']);

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'reCAPTCHA verification failed',
        details: 'invalid-input-response',
      });
      expect(request.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCodes: ['invalid-input-response'],
        }),
        'reCAPTCHA verification failed'
      );
    });
  });

  describe('Score Threshold', () => {
    it('should accept requests with score >= threshold', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockSuccessfulRecaptcha(RECAPTCHA_SCORE_THRESHOLD);

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(request.recaptchaScore).toBe(RECAPTCHA_SCORE_THRESHOLD);
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('should reject requests with score < threshold', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockLowScoreRecaptcha(0.1);

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'reCAPTCHA score too low',
        details: expect.stringContaining('0.10'),
      });
      expect(request.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 0.1,
          threshold: RECAPTCHA_SCORE_THRESHOLD,
        }),
        'reCAPTCHA score below threshold'
      );
    });

    it('should handle missing score as 0', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          // No score field
        }),
      });

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'reCAPTCHA score too low',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 502 when Google API returns error', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      // Set to development to see error details
      const originalEnv = mockEnv.NODE_ENV;
      mockEnv.NODE_ENV = 'development';

      mockRecaptchaApiError();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.code).toHaveBeenCalledWith(502);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Bad Gateway',
        message: 'reCAPTCHA verification error',
        details: expect.stringContaining('reCAPTCHA API request failed'),
      });
      expect(request.log.error).toHaveBeenCalled();

      // Restore environment
      mockEnv.NODE_ENV = originalEnv;
    });

    it('should return 500 on network error', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockRecaptchaNetworkError();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.code).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'reCAPTCHA verification error',
        details: expect.any(String),
      });
      expect(request.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Network error',
        }),
        'reCAPTCHA middleware error'
      );
    });

    it('should hide error details in production', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      // Mock production environment
      const originalEnv = mockEnv.NODE_ENV;
      mockEnv.NODE_ENV = 'production';

      mockRecaptchaNetworkError();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          details: 'Please try again later',
        })
      );

      // Restore environment
      mockEnv.NODE_ENV = originalEnv;
    });

    it('should show error details in development', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      // Mock development environment
      mockEnv.NODE_ENV = 'development';

      mockRecaptchaNetworkError();

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          details: 'Network error',
        })
      );
    });
  });

  describe('Request Context', () => {
    it('should include action in debug log', async () => {
      const { request, reply } = createMockRequestReply({
        body: { recaptchaToken: 'test-token' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          score: 0.9,
          action: 'submit_form',
        }),
      });

      await recaptchaMiddleware(request, reply, vi.fn());

      expect(request.log.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'submit_form',
        }),
        'reCAPTCHA validation successful'
      );
    });
  });
});

describe('requireRecaptcha', () => {
  it('should return 403 when recaptchaScore is undefined', async () => {
    const { request, reply } = createMockRequestReply();
    const mockNext = vi.fn();

    await requireRecaptcha(request, reply, mockNext);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'reCAPTCHA validation required',
    });
  });

  it('should continue when recaptchaScore is present', async () => {
    const { request, reply } = createMockRequestReply();
    const mockNext = vi.fn();

    // Simulate recaptcha middleware ran
    request.recaptchaScore = 0.9;

    await requireRecaptcha(request, reply, mockNext);

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('should continue even when score is 0', async () => {
    const { request, reply } = createMockRequestReply();
    const mockNext = vi.fn();

    // Score of 0 is still a valid score
    request.recaptchaScore = 0;

    await requireRecaptcha(request, reply, mockNext);

    expect(reply.code).not.toHaveBeenCalled();
  });
});

describe('RECAPTCHA_SCORE_THRESHOLD', () => {
  it('should export threshold constant', () => {
    expect(RECAPTCHA_SCORE_THRESHOLD).toBe(0.3);
  });
});
