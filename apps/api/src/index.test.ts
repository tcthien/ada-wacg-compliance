import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from './index.js';
import type { FastifyInstance } from 'fastify';

describe('ADAShield API Server', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      // Health check may return 200 (all healthy) or 503 (Redis unavailable in test)
      expect([200, 503]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        environment: 'test',
        version: '0.1.0',
      });
      expect(body.timestamp).toBeDefined();
      // Status should be 'ok' or 'degraded' depending on Redis availability
      expect(['ok', 'degraded']).toContain(body.status);
    });
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        name: 'ADAShield API',
        version: '0.1.0',
        description: 'Accessibility testing API',
        docs: '/api/v1/docs',
      });
    });
  });
});
