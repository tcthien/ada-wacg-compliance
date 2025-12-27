import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';

/**
 * Redis Client Configuration
 *
 * Singleton Redis client with connection pooling, error handling,
 * and automatic reconnection for caching and rate limiting.
 */

/**
 * Redis connection configuration
 */
const redisConfig: RedisOptions = {
  // Connection pooling
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,

  // Reconnection strategy
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },

  // Connection timeouts
  connectTimeout: 10000,
  commandTimeout: 5000,

  // Keepalive
  keepAlive: 30000,

  // Lazy connect (connect when first command is executed)
  lazyConnect: false,
};

/**
 * Parse Redis URL or use default localhost configuration
 */
function getRedisConfig(): RedisOptions {
  const redisUrl = env.REDIS_URL;

  if (redisUrl) {
    // Parse URL (format: redis://[:password@]host[:port][/db])
    return {
      ...redisConfig,
      // ioredis will parse the URL automatically
    };
  }

  // Default localhost configuration for development
  return {
    ...redisConfig,
    host: 'localhost',
    port: 6379,
    db: 0,
  };
}

/**
 * Singleton Redis client instance
 */
let redisClient: Redis | null = null;

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const config = getRedisConfig();

    if (env.REDIS_URL) {
      // Create client from URL
      redisClient = new Redis(env.REDIS_URL, config);
    } else {
      // Create client with default config
      redisClient = new Redis(config);
    }

    // Connection event handlers
    redisClient.on('connect', () => {
      console.log('✅ Redis: Connected');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis: Ready to accept commands');
    });

    redisClient.on('error', (error: Error) => {
      console.error('❌ Redis Error:', error.message);
    });

    redisClient.on('close', () => {
      console.log('⚠️  Redis: Connection closed');
    });

    redisClient.on('reconnecting', (delay: number) => {
      console.log(`🔄 Redis: Reconnecting in ${delay}ms...`);
    });

    redisClient.on('end', () => {
      console.log('⚠️  Redis: Connection ended');
    });
  }

  return redisClient;
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
  latency?: number;
}> {
  try {
    const client = getRedisClient();
    const start = Date.now();
    const result = await client.ping();
    const latency = Date.now() - start;

    if (result === 'PONG') {
      return {
        status: 'healthy',
        message: 'Redis connection is healthy',
        latency,
      };
    }

    return {
      status: 'unhealthy',
      message: 'Redis PING did not return PONG',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'unhealthy',
      message: `Redis connection failed: ${errorMessage}`,
    };
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('✅ Redis: Connection closed gracefully');
      redisClient = null;
    } catch (error) {
      console.error('❌ Redis: Error during graceful shutdown:', error);
      // Force disconnect - need to check if still exists
      if (redisClient) {
        redisClient.disconnect();
      }
      redisClient = null;
    }
  }
}

/**
 * Export default Redis client getter
 */
export default getRedisClient;
