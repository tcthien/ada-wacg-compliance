import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * Database Configuration
 *
 * Singleton Prisma client instance for database operations.
 * Implements connection pooling, logging, and graceful shutdown.
 * Uses Prisma 7.x adapter pattern with pg driver.
 */

/**
 * Prisma Client singleton instance
 */
let prismaClient: PrismaClient | null = null;

/**
 * PostgreSQL connection pool
 */
let pool: pg.Pool | null = null;

/**
 * Get or create Prisma client instance
 * Uses singleton pattern to ensure single connection pool
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    // Create connection pool
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    prismaClient = new PrismaClient({
      adapter,
      log:
        process.env['NODE_ENV'] === 'development'
          ? ['query', 'error', 'warn']
          : ['error', 'warn'],
      errorFormat: 'pretty',
    });

    // Log connection
    console.log('✅ Prisma: Client initialized with pg adapter');
  }

  return prismaClient;
}

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
  latency?: number;
}> {
  try {
    const client = getPrismaClient();
    const start = Date.now();
    await client.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      status: 'healthy',
      message: 'Database connection is healthy',
      latency,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'unhealthy',
      message: `Database connection failed: ${errorMessage}`,
    };
  }
}

/**
 * Gracefully disconnect from database
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (prismaClient) {
    try {
      await prismaClient.$disconnect();
      console.log('✅ Prisma: Disconnected gracefully');
      prismaClient = null;
    } catch (error) {
      console.error('❌ Prisma: Error during disconnect:', error);
      prismaClient = null;
    }
  }

  if (pool) {
    try {
      await pool.end();
      console.log('✅ PostgreSQL pool: Closed gracefully');
      pool = null;
    } catch (error) {
      console.error('❌ PostgreSQL pool: Error during close:', error);
      pool = null;
    }
  }
}

/**
 * Export default Prisma client getter
 */
export default getPrismaClient;
