import { Queue } from 'bullmq';
import { getPrismaClient } from '../../config/database.js';
import { getRedisClient } from '../../config/redis.js';
import { AdminRedisKeys } from '../../shared/constants/redis-keys.js';
import { AdminServiceError } from './admin.service.js';
import { env } from '../../config/env.js';

/**
 * Dashboard Metrics Service
 *
 * Provides aggregated metrics for the admin dashboard with Redis caching.
 * Implements 5-minute cache TTL for performance optimization.
 *
 * Features:
 * - Scan statistics (today/week/month/total)
 * - Success rate calculation
 * - Active session count
 * - Unique customer count
 * - Average scan duration
 * - Redis caching with 5-minute TTL
 *
 * Requirements:
 * - REQ 5.1: Dashboard key metrics display
 * - NFR-Performance: 5-minute cache for dashboard metrics
 */

/**
 * Dashboard metrics interface
 *
 * Provides comprehensive statistics for the admin dashboard.
 */
export interface DashboardMetrics {
  /** Scan count statistics */
  scans: {
    /** Number of scans created today */
    today: number;
    /** Number of scans created this week */
    thisWeek: number;
    /** Number of scans created this month */
    thisMonth: number;
    /** Total number of scans in the system */
    total: number;
  };
  /** Success rate as a percentage (0-100) */
  successRate: number;
  /** Number of active guest sessions (not expired, not anonymized) */
  activeSessions: number;
  /** Number of unique customer emails */
  uniqueCustomers: number;
  /** Average scan duration in milliseconds */
  avgScanDuration: number;
}

/**
 * Get dashboard metrics with Redis caching
 *
 * Retrieves aggregated dashboard metrics from cache if available,
 * otherwise calculates from database and caches the result.
 *
 * Caching strategy:
 * - Cache key: admin:dashboard:metrics
 * - TTL: 5 minutes (300 seconds)
 * - Cache invalidation: Time-based only
 *
 * Metrics calculated:
 * - Scan counts: Aggregated by time periods (today/week/month/total)
 * - Success rate: Percentage of COMPLETED vs total scans (excluding PENDING)
 * - Active sessions: Guest sessions not expired and not anonymized
 * - Unique customers: Distinct email addresses from scans
 * - Average duration: Mean duration of completed scans
 *
 * @returns Dashboard metrics object
 * @throws AdminServiceError if metrics calculation fails
 *
 * @example
 * ```typescript
 * try {
 *   const metrics = await getMetrics();
 *   console.log(`Total scans: ${metrics.scans.total}`);
 *   console.log(`Success rate: ${metrics.successRate}%`);
 *   console.log(`Active sessions: ${metrics.activeSessions}`);
 * } catch (error) {
 *   if (error instanceof AdminServiceError) {
 *     console.error(`Failed to get metrics: ${error.code}`);
 *   }
 * }
 * ```
 */
export async function getMetrics(): Promise<DashboardMetrics> {
  try {
    const redis = getRedisClient();
    const cacheKey = AdminRedisKeys.DASHBOARD_METRICS.build();

    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as DashboardMetrics;
      } catch (parseError) {
        // Cache corrupted, continue to recalculate
        console.error('Failed to parse cached dashboard metrics:', parseError);
      }
    }

    // Calculate metrics from database
    const metrics = await calculateMetrics();

    // Cache the result
    try {
      await redis.setex(
        cacheKey,
        AdminRedisKeys.DASHBOARD_METRICS.ttl,
        JSON.stringify(metrics)
      );
    } catch (cacheError) {
      // Non-critical error, log and continue
      console.error('Failed to cache dashboard metrics:', cacheError);
    }

    return metrics;
  } catch (error) {
    throw new AdminServiceError(
      'Failed to retrieve dashboard metrics',
      'UNAUTHORIZED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Calculate dashboard metrics from database
 *
 * Internal method that performs all database queries to calculate metrics.
 * Uses Prisma aggregations and raw queries for optimal performance.
 *
 * @returns Calculated dashboard metrics
 * @throws Error if database queries fail
 */
async function calculateMetrics(): Promise<DashboardMetrics> {
  const prisma = getPrismaClient();
  const now = new Date();

  // Calculate time boundaries
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Query 1: Get scan counts by time period
  const [totalScans, todayScans, weekScans, monthScans] = await Promise.all([
    prisma.scan.count(),
    prisma.scan.count({
      where: {
        createdAt: {
          gte: startOfToday,
        },
      },
    }),
    prisma.scan.count({
      where: {
        createdAt: {
          gte: startOfWeek,
        },
      },
    }),
    prisma.scan.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    }),
  ]);

  // Query 2: Calculate success rate (COMPLETED / (total - PENDING))
  const [completedCount, totalNonPendingCount] = await Promise.all([
    prisma.scan.count({
      where: {
        status: 'COMPLETED',
      },
    }),
    prisma.scan.count({
      where: {
        status: {
          not: 'PENDING',
        },
      },
    }),
  ]);

  // Calculate success rate as percentage
  const successRate =
    totalNonPendingCount > 0
      ? Math.round((completedCount / totalNonPendingCount) * 100 * 10) / 10 // Round to 1 decimal
      : 0;

  // Query 3: Count active guest sessions (not expired, not anonymized)
  const activeSessions = await prisma.guestSession.count({
    where: {
      expiresAt: {
        gt: now,
      },
      anonymizedAt: null,
    },
  });

  // Query 4: Count unique customer emails
  const uniqueCustomersResult = await prisma.scan.findMany({
    where: {
      email: {
        not: null,
      },
    },
    select: {
      email: true,
    },
    distinct: ['email'],
  });
  const uniqueCustomers = uniqueCustomersResult.length;

  // Query 5: Calculate average scan duration for completed scans
  const avgDurationResult = await prisma.scan.aggregate({
    where: {
      status: 'COMPLETED',
      durationMs: {
        not: null,
      },
    },
    _avg: {
      durationMs: true,
    },
  });

  // Round to nearest millisecond
  const avgScanDuration = Math.round(avgDurationResult._avg.durationMs ?? 0);

  return {
    scans: {
      today: todayScans,
      thisWeek: weekScans,
      thisMonth: monthScans,
      total: totalScans,
    },
    successRate,
    activeSessions,
    uniqueCustomers,
    avgScanDuration,
  };
}

/**
 * Scan trend data point interface
 *
 * Represents scan statistics for a single day.
 */
export interface ScanTrend {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Total number of scans created on this day */
  count: number;
  /** Number of successful (COMPLETED) scans */
  successCount: number;
  /** Number of failed (FAILED) scans */
  failedCount: number;
}

/**
 * Get scan trends over time with Redis caching
 *
 * Retrieves daily scan statistics for the specified number of days.
 * Uses PostgreSQL DATE_TRUNC for efficient daily aggregation.
 *
 * Caching strategy:
 * - Cache key: admin:dashboard:trends:{days}
 * - TTL: 5 minutes (300 seconds)
 * - Cache invalidation: Time-based only
 *
 * Query optimization:
 * - Uses DATE_TRUNC for daily aggregation at database level
 * - Filters by time range before aggregation
 * - Groups by date and status for success/failed breakdown
 *
 * @param days Number of days to retrieve (default: 30)
 * @returns Array of daily scan trend data points, ordered by date ascending
 * @throws AdminServiceError if trend calculation fails
 *
 * @example
 * ```typescript
 * try {
 *   const trends = await getScanTrends(30);
 *   trends.forEach(trend => {
 *     console.log(`${trend.date}: ${trend.count} scans (${trend.successCount} success, ${trend.failedCount} failed)`);
 *   });
 * } catch (error) {
 *   if (error instanceof AdminServiceError) {
 *     console.error(`Failed to get scan trends: ${error.code}`);
 *   }
 * }
 * ```
 */
export async function getScanTrends(days = 30): Promise<ScanTrend[]> {
  try {
    const redis = getRedisClient();
    const cacheKey = AdminRedisKeys.DASHBOARD_TRENDS.build(days);

    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as ScanTrend[];
      } catch (parseError) {
        // Cache corrupted, continue to recalculate
        console.error('Failed to parse cached scan trends:', parseError);
      }
    }

    // Calculate trends from database
    const trends = await calculateScanTrends(days);

    // Cache the result
    try {
      await redis.setex(
        cacheKey,
        AdminRedisKeys.DASHBOARD_TRENDS.ttl,
        JSON.stringify(trends)
      );
    } catch (cacheError) {
      // Non-critical error, log and continue
      console.error('Failed to cache scan trends:', cacheError);
    }

    return trends;
  } catch (error) {
    throw new AdminServiceError(
      'Failed to retrieve scan trends',
      'UNAUTHORIZED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Calculate scan trends from database using DATE_TRUNC aggregation
 *
 * Internal method that performs raw SQL query for optimal performance.
 * Uses PostgreSQL's DATE_TRUNC function to aggregate by day.
 *
 * @param days Number of days to retrieve
 * @returns Array of daily scan trend data points
 * @throws Error if database query fails
 */
async function calculateScanTrends(days: number): Promise<ScanTrend[]> {
  const prisma = getPrismaClient();
  const now = new Date();

  // Calculate start date (days ago at midnight)
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Raw SQL query using DATE_TRUNC for daily aggregation
  // Groups by date and status, then pivots in application logic
  const rawResults = await prisma.$queryRaw<
    Array<{
      date: Date;
      status: string;
      count: bigint;
    }>
  >`
    SELECT
      DATE_TRUNC('day', "createdAt")::date as date,
      status,
      COUNT(*)::bigint as count
    FROM "scans"
    WHERE "createdAt" >= ${startDate}::timestamptz
    GROUP BY DATE_TRUNC('day', "createdAt")::date, status
    ORDER BY date ASC
  `;

  // Aggregate results by date
  const trendMap = new Map<string, ScanTrend>();

  for (const row of rawResults) {
    const dateStr = row.date.toISOString().split('T')[0] as string;
    const count = Number(row.count);

    if (!trendMap.has(dateStr)) {
      trendMap.set(dateStr, {
        date: dateStr,
        count: 0,
        successCount: 0,
        failedCount: 0,
      });
    }

    const trend = trendMap.get(dateStr)!;
    trend.count += count;

    if (row.status === 'COMPLETED') {
      trend.successCount += count;
    } else if (row.status === 'FAILED') {
      trend.failedCount += count;
    }
  }

  // Fill in missing dates with zero counts
  const result: ScanTrend[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split('T')[0] as string;

    result.push(
      trendMap.get(dateStr) ?? {
        date: dateStr,
        count: 0,
        successCount: 0,
        failedCount: 0,
      }
    );
  }

  return result;
}

/**
 * Issue distribution interface
 *
 * Breakdown of issues by severity level across all scan results.
 */
export interface IssueDistribution {
  /** Number of critical severity issues */
  critical: number;
  /** Number of serious severity issues */
  serious: number;
  /** Number of moderate severity issues */
  moderate: number;
  /** Number of minor severity issues */
  minor: number;
}

/**
 * Get issue distribution by severity with Redis caching
 *
 * Retrieves the count of issues grouped by severity level (critical, serious, moderate, minor).
 * Aggregates from all issues across all scan results in the system.
 *
 * Caching strategy:
 * - Cache key: admin:dashboard:issue_distribution
 * - TTL: 5 minutes (300 seconds)
 * - Cache invalidation: Time-based only
 *
 * Query optimization:
 * - Uses Prisma groupBy for efficient aggregation at database level
 * - Single query to retrieve all severity counts
 *
 * @returns Issue distribution object with counts by severity
 * @throws AdminServiceError if calculation fails
 *
 * @example
 * ```typescript
 * try {
 *   const distribution = await getIssueDistribution();
 *   console.log(`Critical: ${distribution.critical}`);
 *   console.log(`Serious: ${distribution.serious}`);
 *   console.log(`Moderate: ${distribution.moderate}`);
 *   console.log(`Minor: ${distribution.minor}`);
 * } catch (error) {
 *   if (error instanceof AdminServiceError) {
 *     console.error(`Failed to get issue distribution: ${error.code}`);
 *   }
 * }
 * ```
 */
export async function getIssueDistribution(): Promise<IssueDistribution> {
  try {
    const redis = getRedisClient();
    const cacheKey = AdminRedisKeys.ISSUE_DISTRIBUTION.build();

    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as IssueDistribution;
      } catch (parseError) {
        // Cache corrupted, continue to recalculate
        console.error('Failed to parse cached issue distribution:', parseError);
      }
    }

    // Calculate distribution from database
    const distribution = await calculateIssueDistribution();

    // Cache the result
    try {
      await redis.setex(
        cacheKey,
        AdminRedisKeys.ISSUE_DISTRIBUTION.ttl,
        JSON.stringify(distribution)
      );
    } catch (cacheError) {
      // Non-critical error, log and continue
      console.error('Failed to cache issue distribution:', cacheError);
    }

    return distribution;
  } catch (error) {
    throw new AdminServiceError(
      'Failed to retrieve issue distribution',
      'UNAUTHORIZED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Calculate issue distribution from database
 *
 * Internal method that performs groupBy query to count issues by severity.
 * Uses Prisma's groupBy aggregation for optimal performance.
 *
 * @returns Calculated issue distribution
 * @throws Error if database query fails
 */
async function calculateIssueDistribution(): Promise<IssueDistribution> {
  const prisma = getPrismaClient();

  // Group by impact and count
  const groupedResults = await prisma.issue.groupBy({
    by: ['impact'],
    _count: {
      impact: true,
    },
  });

  // Initialize all severity counts to zero
  const distribution: IssueDistribution = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  // Map database results to distribution object
  for (const result of groupedResults) {
    const count = result._count.impact;
    switch (result.impact) {
      case 'CRITICAL':
        distribution.critical = count;
        break;
      case 'SERIOUS':
        distribution.serious = count;
        break;
      case 'MODERATE':
        distribution.moderate = count;
        break;
      case 'MINOR':
        distribution.minor = count;
        break;
    }
  }

  return distribution;
}

/**
 * Top domain interface
 *
 * Represents a scanned domain with statistics.
 */
export interface TopDomain {
  /** Domain name extracted from URLs */
  domain: string;
  /** Number of scans for this domain */
  scanCount: number;
  /** Timestamp of most recent scan */
  lastScanned: Date;
}

/**
 * Get top scanned domains with Redis caching
 *
 * Retrieves the most frequently scanned domains from all scans in the system.
 * Extracts domain from URL and groups by domain with count and last scanned timestamp.
 *
 * Caching strategy:
 * - Cache key: admin:dashboard:top_domains:{limit}
 * - TTL: 5 minutes (300 seconds)
 * - Cache invalidation: Time-based only
 *
 * Query optimization:
 * - Uses raw SQL with DISTINCT ON for efficient domain extraction
 * - Extracts domain using PostgreSQL's regexp_replace function
 * - Groups and orders at database level for performance
 *
 * @param limit Maximum number of top domains to return (default: 10)
 * @returns Array of top domains ordered by scan count descending
 * @throws AdminServiceError if calculation fails
 *
 * @example
 * ```typescript
 * try {
 *   const topDomains = await getTopDomains(5);
 *   topDomains.forEach(domain => {
 *     console.log(`${domain.domain}: ${domain.scanCount} scans, last: ${domain.lastScanned}`);
 *   });
 * } catch (error) {
 *   if (error instanceof AdminServiceError) {
 *     console.error(`Failed to get top domains: ${error.code}`);
 *   }
 * }
 * ```
 */
export async function getTopDomains(limit = 10): Promise<TopDomain[]> {
  try {
    const redis = getRedisClient();
    const cacheKey = AdminRedisKeys.TOP_DOMAINS.build(limit);

    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as TopDomain[];
      } catch (parseError) {
        // Cache corrupted, continue to recalculate
        console.error('Failed to parse cached top domains:', parseError);
      }
    }

    // Calculate top domains from database
    const topDomains = await calculateTopDomains(limit);

    // Cache the result
    try {
      await redis.setex(
        cacheKey,
        AdminRedisKeys.TOP_DOMAINS.ttl,
        JSON.stringify(topDomains)
      );
    } catch (cacheError) {
      // Non-critical error, log and continue
      console.error('Failed to cache top domains:', cacheError);
    }

    return topDomains;
  } catch (error) {
    throw new AdminServiceError(
      'Failed to retrieve top domains',
      'UNAUTHORIZED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Calculate top domains from database using domain extraction
 *
 * Internal method that performs raw SQL query to extract domains from URLs,
 * group by domain, and aggregate counts.
 *
 * Domain extraction logic:
 * - Removes protocol (http://, https://)
 * - Removes www. prefix
 * - Extracts hostname before first /
 * - Groups identical domains together
 *
 * @param limit Maximum number of top domains to return
 * @returns Array of top domains with scan counts and last scanned timestamp
 * @throws Error if database query fails
 */
async function calculateTopDomains(limit: number): Promise<TopDomain[]> {
  const prisma = getPrismaClient();

  // Raw SQL query to extract domain from URL and aggregate
  // Domain extraction steps:
  // 1. Remove protocol (http://, https://)
  // 2. Remove www. prefix
  // 3. Extract hostname (everything before first /)
  const rawResults = await prisma.$queryRaw<
    Array<{
      domain: string;
      scan_count: bigint;
      last_scanned: Date;
    }>
  >`
    SELECT
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          SPLIT_PART(
            REGEXP_REPLACE(url, '^https?://', ''),
            '/',
            1
          ),
          '^www\.',
          ''
        ),
        ':[0-9]+$',
        ''
      ) as domain,
      COUNT(*)::bigint as scan_count,
      MAX("createdAt") as last_scanned
    FROM "scans"
    WHERE url IS NOT NULL AND url != ''
    GROUP BY domain
    ORDER BY scan_count DESC, last_scanned DESC
    LIMIT ${limit}
  `;

  // Map to TopDomain interface
  return rawResults.map((row) => ({
    domain: row.domain,
    scanCount: Number(row.scan_count),
    lastScanned: row.last_scanned,
  }));
}

/**
 * Invalidate dashboard metrics cache
 *
 * Forces recalculation of metrics on next request.
 * Should be called when significant data changes occur.
 *
 * @returns Promise that resolves when cache is cleared
 *
 * @example
 * ```typescript
 * // After bulk data import or cleanup
 * await invalidateMetricsCache();
 * ```
 */
export async function invalidateMetricsCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    const cacheKey = AdminRedisKeys.DASHBOARD_METRICS.build();
    await redis.del(cacheKey);
  } catch (error) {
    // Non-critical error, log and continue
    console.error('Failed to invalidate dashboard metrics cache:', error);
  }
}

/**
 * System health interface
 *
 * Real-time health status of system components including queues, Redis, and database.
 */
export interface SystemHealth {
  /** BullMQ queue health metrics */
  queues: {
    /** Scan page queue job counts */
    scanPage: {
      /** Number of jobs waiting to be processed */
      waiting: number;
      /** Number of jobs currently being processed */
      active: number;
      /** Number of successfully completed jobs */
      completed: number;
      /** Number of failed jobs */
      failed: number;
    };
    /** Generate report queue job counts */
    generateReport: {
      /** Number of jobs waiting to be processed */
      waiting: number;
      /** Number of jobs currently being processed */
      active: number;
      /** Number of successfully completed jobs */
      completed: number;
      /** Number of failed jobs */
      failed: number;
    };
  };
  /** Redis connection health */
  redis: {
    /** Connection status */
    status: 'ok' | 'error';
    /** Latency in milliseconds */
    latencyMs: number;
  };
  /** Database connection health */
  database: {
    /** Connection status */
    status: 'ok' | 'error';
    /** Latency in milliseconds */
    latencyMs: number;
  };
  /** Error rate percentage for scans in last 24 hours */
  errorRate24h: number;
}

/**
 * Queue names - must match worker queue names
 */
const QueueNames = {
  SCAN_PAGE: 'scan-page',
  GENERATE_REPORT: 'generate-report',
} as const;

/**
 * Get Redis connection configuration for BullMQ
 *
 * Returns connection options compatible with BullMQ Queue instances.
 *
 * @returns BullMQ connection configuration object
 */
function getBullMQConnection() {
  const redisUrl = env.REDIS_URL;

  if (redisUrl) {
    // Parse URL for BullMQ
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      db: url.pathname ? parseInt(url.pathname.slice(1), 10) : 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  // Default localhost configuration
  return {
    host: 'localhost',
    port: 6379,
    db: 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/**
 * Get system health status (NO caching - real-time data)
 *
 * Retrieves real-time health metrics for all system components including
 * BullMQ queues, Redis connection, database connection, and error rates.
 *
 * Health checks performed:
 * - BullMQ Queues: Job counts for scan-page and generate-report queues
 * - Redis: Connection status and latency measurement
 * - Database: Connection status and latency measurement
 * - Error Rate: Percentage of failed scans in last 24 hours
 *
 * Note: No caching is applied to health checks to ensure real-time accuracy.
 *
 * @returns System health metrics
 * @throws AdminServiceError if health check fails
 *
 * @example
 * ```typescript
 * try {
 *   const health = await getSystemHealth();
 *   console.log(`Redis status: ${health.redis.status}`);
 *   console.log(`Database latency: ${health.database.latencyMs}ms`);
 *   console.log(`Error rate: ${health.errorRate24h}%`);
 * } catch (error) {
 *   if (error instanceof AdminServiceError) {
 *     console.error(`Failed to get system health: ${error.code}`);
 *   }
 * }
 * ```
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  try {
    const connection = getBullMQConnection();

    // Create queue instances for health checks
    const scanPageQueue = new Queue(QueueNames.SCAN_PAGE, { connection });
    const generateReportQueue = new Queue(QueueNames.GENERATE_REPORT, {
      connection,
    });

    try {
      // Parallel health checks for better performance
      const [scanPageCounts, generateReportCounts, redisHealth, dbHealth, errorRate] =
        await Promise.all([
          // Query queue job counts
          scanPageQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
          generateReportQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
          // Check Redis health
          checkRedisHealth(),
          // Check database health
          checkDatabaseHealth(),
          // Calculate error rate
          calculateErrorRate24h(),
        ]);

      // Close queue connections
      await Promise.all([scanPageQueue.close(), generateReportQueue.close()]);

      return {
        queues: {
          scanPage: {
            waiting: scanPageCounts['waiting'] ?? 0,
            active: scanPageCounts['active'] ?? 0,
            completed: scanPageCounts['completed'] ?? 0,
            failed: scanPageCounts['failed'] ?? 0,
          },
          generateReport: {
            waiting: generateReportCounts['waiting'] ?? 0,
            active: generateReportCounts['active'] ?? 0,
            completed: generateReportCounts['completed'] ?? 0,
            failed: generateReportCounts['failed'] ?? 0,
          },
        },
        redis: {
          status: redisHealth.status === 'ok' ? 'ok' : 'error',
          latencyMs: redisHealth.latencyMs,
        },
        database: {
          status: dbHealth.status === 'ok' ? 'ok' : 'error',
          latencyMs: dbHealth.latencyMs,
        },
        errorRate24h: errorRate,
      };
    } finally {
      // Ensure queues are closed even if errors occur
      await Promise.allSettled([
        scanPageQueue.close(),
        generateReportQueue.close(),
      ]);
    }
  } catch (error) {
    throw new AdminServiceError(
      'Failed to retrieve system health',
      'UNAUTHORIZED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check Redis connection health and measure latency
 *
 * Internal method that performs a PING command to verify Redis connectivity
 * and measure response time.
 *
 * @returns Redis health status with latency measurement
 */
async function checkRedisHealth(): Promise<{
  status: 'ok' | 'error';
  latencyMs: number;
}> {
  try {
    const redis = getRedisClient();
    const start = Date.now();
    const result = await redis.ping();
    const latency = Date.now() - start;

    if (result === 'PONG') {
      return {
        status: 'ok',
        latencyMs: latency,
      };
    }

    return {
      status: 'error',
      latencyMs: 0,
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: 0,
    };
  }
}

/**
 * Check database connection health and measure latency
 *
 * Internal method that performs a simple SELECT 1 query to verify database
 * connectivity and measure response time.
 *
 * @returns Database health status with latency measurement
 */
async function checkDatabaseHealth(): Promise<{
  status: 'ok' | 'error';
  latencyMs: number;
}> {
  try {
    const prisma = getPrismaClient();
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      status: 'ok',
      latencyMs: latency,
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: 0,
    };
  }
}

/**
 * Calculate error rate for scans in last 24 hours
 *
 * Internal method that calculates the percentage of failed scans
 * out of all scans (excluding PENDING status) created in the last 24 hours.
 *
 * Error rate formula: (FAILED scans / (total scans - PENDING scans)) * 100
 *
 * @returns Error rate percentage (0-100)
 */
async function calculateErrorRate24h(): Promise<number> {
  try {
    const prisma = getPrismaClient();
    const now = new Date();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);

    // Query failed and total non-pending scans in parallel
    const [failedCount, totalNonPendingCount] = await Promise.all([
      prisma.scan.count({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: twentyFourHoursAgo,
          },
        },
      }),
      prisma.scan.count({
        where: {
          status: {
            not: 'PENDING',
          },
          createdAt: {
            gte: twentyFourHoursAgo,
          },
        },
      }),
    ]);

    // Calculate error rate as percentage
    if (totalNonPendingCount === 0) {
      return 0;
    }

    const errorRate = (failedCount / totalNonPendingCount) * 100;
    // Round to 1 decimal place
    return Math.round(errorRate * 10) / 10;
  } catch (error) {
    // Return 0 if error occurs during calculation
    console.error('Error calculating error rate:', error);
    return 0;
  }
}
