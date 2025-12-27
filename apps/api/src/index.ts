import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { env } from './config/env.js';
import { checkRedisHealth, closeRedisConnection } from './config/redis.js';
import { registerSessionRoutes } from './modules/sessions/session.controller.js';
import { registerReportRoutes } from './modules/reports/report.controller.js';
import { registerScanRoutes } from './modules/scans/scan.controller.js';

/**
 * ADAShield API Server
 * Fastify-based REST API for accessibility testing
 */
async function buildServer() {
  const loggerConfig =
    env.NODE_ENV === 'development'
      ? {
          level: env.LOG_LEVEL,
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : {
          level: env.LOG_LEVEL,
        };

  const server = Fastify({
    logger: loggerConfig,
  });

  // Security: Helmet for security headers
  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // CORS configuration
  await server.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  // Cookie support
  await server.register(cookie, {
    secret: process.env['COOKIE_SECRET'] ?? 'adashield-dev-secret',
    parseOptions: {},
  });

  // Health check endpoint
  server.get(`${env.API_PREFIX}/health`, async (request, reply) => {
    const redisHealth = await checkRedisHealth();

    const isHealthy = redisHealth.status === 'healthy';

    return reply.code(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '0.1.0',
      services: {
        redis: redisHealth,
      },
    });
  });

  // Root endpoint
  server.get('/', async (request, reply) => {
    return {
      name: 'ADAShield API',
      version: '0.1.0',
      description: 'Accessibility testing API',
      docs: `${env.API_PREFIX}/docs`,
    };
  });

  // Register module routes
  await registerSessionRoutes(server, env.API_PREFIX);
  await registerScanRoutes(server, env.API_PREFIX);
  await registerReportRoutes(server, env.API_PREFIX);

  return server;
}

/**
 * Start the server
 */
async function start() {
  try {
    const server = await buildServer();

    await server.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`
🚀 ADAShield API Server started successfully!

   Environment: ${env.NODE_ENV}
   Port:        ${env.PORT}
   API Prefix:  ${env.API_PREFIX}

   Health:      http://localhost:${env.PORT}${env.API_PREFIX}/health
   API Root:    http://localhost:${env.PORT}/
    `);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await closeRedisConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await closeRedisConnection();
  process.exit(0);
});

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer };
