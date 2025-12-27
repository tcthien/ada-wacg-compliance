/**
 * Bull Board Dashboard Plugin
 *
 * Fastify plugin that mounts the Bull Board dashboard
 * for monitoring and managing BullMQ queues.
 */

import type { FastifyPluginAsync } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { scanPageQueue, generateReportQueue, sendEmailQueue } from './queues.js';

/**
 * Bull Board plugin options
 */
export interface BullBoardPluginOptions {
  /** Base path for the dashboard (default: /admin/queues) */
  basePath?: string;
  /** Enable authentication (default: false for development) */
  enableAuth?: boolean;
  /** Username for basic auth */
  username?: string;
  /** Password for basic auth */
  password?: string;
}

/**
 * Bull Board Fastify Plugin
 *
 * Mounts the Bull Board UI at the specified base path.
 * In production, this should be protected with authentication.
 */
export const bullBoardPlugin: FastifyPluginAsync<BullBoardPluginOptions> = async (
  fastify,
  options
) => {
  const basePath = options.basePath || '/admin/queues';

  // Create Fastify adapter
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(basePath);

  // Create Bull Board with all queues
  createBullBoard({
    queues: [
      new BullMQAdapter(scanPageQueue),
      new BullMQAdapter(generateReportQueue),
      new BullMQAdapter(sendEmailQueue),
    ],
    serverAdapter,
  });

  // Register the adapter as a Fastify route
  await fastify.register(serverAdapter.registerPlugin(), {
    prefix: basePath,
  });

  // Add authentication hook if enabled
  if (options.enableAuth && options.username && options.password) {
    fastify.addHook('onRequest', async (request, reply) => {
      // Only protect the bull-board routes
      if (!request.url.startsWith(basePath)) {
        return;
      }

      // Basic authentication
      const auth = request.headers.authorization;
      if (!auth || !auth.startsWith('Basic ')) {
        reply.code(401).header('WWW-Authenticate', 'Basic realm="Bull Board"').send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const credentials = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');

      if (username !== options.username || password !== options.password) {
        reply.code(401).header('WWW-Authenticate', 'Basic realm="Bull Board"').send({
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
        return;
      }
    });
  }

  console.log(`✅ Bull Board: Dashboard mounted at ${basePath}`);
};

export default bullBoardPlugin;
