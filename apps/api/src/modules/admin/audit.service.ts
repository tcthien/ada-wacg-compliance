/**
 * Audit Service
 *
 * Service layer for audit trail management.
 * Implements Requirements 6.1 (audit logging) and 6.2 (audit query with pagination and filters).
 *
 * Design Principles:
 * - Fire-and-forget logging for non-blocking performance (Requirement 6.1)
 * - Automatic data sanitization to prevent sensitive data leakage
 * - Comprehensive filtering and pagination for audit queries (Requirement 6.2)
 * - Error handling follows AdminServiceError pattern
 */

import { getPrismaClient } from '../../config/database.js';
import { AdminServiceError } from './admin.service.js';
import type { AuditAction, CreateAuditInput } from './admin.types.js';

/**
 * Filters for querying audit logs
 *
 * All filters are optional and can be combined.
 * Date filters are inclusive (includes both boundaries).
 *
 * @property dateFrom - Start date for filtering (inclusive)
 * @property dateTo - End date for filtering (inclusive)
 * @property adminId - Filter by specific admin user
 * @property action - Filter by specific action type
 *
 * @example
 * ```typescript
 * const filters: AuditFilters = {
 *   dateFrom: new Date('2025-01-01'),
 *   dateTo: new Date('2025-12-31'),
 *   adminId: 'admin-123',
 *   action: 'UPDATE_ADMIN'
 * };
 * ```
 */
export interface AuditFilters {
  /** Start date for filtering (inclusive) */
  dateFrom?: Date;
  /** End date for filtering (inclusive) */
  dateTo?: Date;
  /** Filter by specific admin user */
  adminId?: string;
  /** Filter by specific action type */
  action?: AuditAction;
}

/**
 * Pagination input for audit queries
 *
 * @property page - Page number (1-based, defaults to 1)
 * @property limit - Items per page (defaults to 20, max 100)
 *
 * @example
 * ```typescript
 * const pagination: PaginationInput = {
 *   page: 1,
 *   limit: 50
 * };
 * ```
 */
export interface PaginationInput {
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * Audit log entry returned from queries
 *
 * Contains all audit information including admin details and action metadata.
 * Sensitive data is sanitized before storage.
 *
 * @property id - Unique audit log ID
 * @property adminId - ID of the admin who performed the action
 * @property adminEmail - Email of the admin who performed the action
 * @property action - Type of action performed
 * @property targetId - Optional ID of affected resource
 * @property targetType - Optional type of affected resource
 * @property details - Action-specific details (sanitized)
 * @property ipAddress - Client IP address
 * @property userAgent - Client user agent string
 * @property createdAt - Timestamp when action occurred
 */
export interface AuditEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: AuditAction;
  targetId?: string;
  targetType?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

/**
 * Paginated result for audit queries
 *
 * @property items - Array of audit log entries
 * @property totalCount - Total number of items matching the query
 * @property page - Current page number
 * @property limit - Items per page
 * @property totalPages - Total number of pages
 */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Sensitive field names that should be redacted from audit logs
 *
 * These fields are automatically sanitized during logging to prevent
 * accidentally storing sensitive information in audit trails.
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'privateKey',
  'sessionToken',
  'jwt',
  'authorization',
];

/**
 * Sanitize sensitive data from objects
 *
 * Recursively walks through objects and arrays to remove sensitive fields.
 * Sensitive fields are replaced with '[REDACTED]' placeholder.
 *
 * @param data - Data to sanitize
 * @returns Sanitized data with sensitive fields redacted
 *
 * @example
 * ```typescript
 * const input = {
 *   email: 'admin@example.com',
 *   password: 'secret123',
 *   role: 'ADMIN'
 * };
 * const sanitized = sanitizeData(input);
 * // Result: { email: 'admin@example.com', password: '[REDACTED]', role: 'ADMIN' }
 * ```
 */
function sanitizeData(data: unknown): unknown {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays - recursively sanitize each element
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  // Handle objects - recursively sanitize each property
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      // Check if field name is sensitive (case-insensitive)
      const isSensitive = SENSITIVE_FIELDS.some(
        (field) => key.toLowerCase().includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }

    return sanitized;
  }

  // Primitive values pass through unchanged
  return data;
}

/**
 * Log an audit event
 *
 * Creates an audit log entry for admin actions. This method is fire-and-forget
 * (async but non-blocking) to prevent performance impact on admin operations.
 *
 * Automatically sanitizes sensitive data from the details object.
 * Errors are logged but not thrown to prevent audit failures from breaking operations.
 *
 * Implements Requirement 6.1: Log admin actions with timestamp, admin ID, action type,
 * target entity, and before/after values.
 *
 * @param entry - Audit log entry to create
 * @returns Promise that resolves when logging completes (or fails silently)
 *
 * @example
 * ```typescript
 * // Fire-and-forget logging - doesn't block the operation
 * log({
 *   adminId: 'admin-123',
 *   action: 'UPDATE_ADMIN',
 *   targetId: 'admin-456',
 *   targetType: 'Admin',
 *   details: {
 *     changes: {
 *       role: { from: 'ADMIN', to: 'SUPER_ADMIN' }
 *     }
 *   },
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...'
 * }).catch(err => {
 *   // Errors are logged but don't propagate
 *   console.error('Audit logging failed:', err);
 * });
 * ```
 */
export async function log(entry: CreateAuditInput): Promise<void> {
  const prisma = getPrismaClient();

  try {
    // Sanitize details to remove sensitive data
    const sanitizedDetails = sanitizeData(entry.details ?? {}) as Record<string, unknown>;

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        targetId: entry.targetId ?? null,
        targetType: entry.targetType ?? null,
        details: sanitizedDetails as Record<string, never>,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });

    console.log(`✅ Audit Service: Logged ${entry.action} by admin ${entry.adminId}`);
  } catch (error) {
    // Log error but don't throw - audit failures should not break operations
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`❌ Audit Service: Failed to log audit entry:`, {
      action: entry.action,
      adminId: entry.adminId,
      error: err.message,
    });
  }
}

/**
 * Build where clause for audit log filters
 *
 * Helper function to construct Prisma where clause from AuditFilters.
 * Used by both list() and export() functions for consistent filtering.
 *
 * @param filters - Audit log filters
 * @returns Prisma where clause object
 */
function buildWhereClause(filters: AuditFilters): {
  adminId?: string;
  action?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
} {
  const where: {
    adminId?: string;
    action?: string;
    createdAt?: {
      gte?: Date;
      lte?: Date;
    };
  } = {};

  // Apply admin filter
  if (filters.adminId) {
    where.adminId = filters.adminId;
  }

  // Apply action filter
  if (filters.action) {
    where.action = filters.action;
  }

  // Apply date range filters
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};

    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }

    if (filters.dateTo) {
      // Make dateTo inclusive by adding 1 day and using less than
      const endDate = new Date(filters.dateTo);
      endDate.setDate(endDate.getDate() + 1);
      where.createdAt.lte = endDate;
    }
  }

  return where;
}

/**
 * List audit logs with filtering and pagination
 *
 * Retrieves audit logs with optional filters for date range, admin, and action type.
 * Results are paginated with configurable page size (default 20, max 100).
 * Joins with AdminUser to include admin email in results.
 *
 * Implements Requirement 6.2: Return logs with pagination and filtering by date range,
 * admin, and action type.
 *
 * @param filters - Optional filters for querying audit logs
 * @param pagination - Pagination options (page and limit)
 * @returns Paginated audit log results
 * @throws AdminServiceError if query fails
 *
 * @example
 * ```typescript
 * // Get recent audit logs with default pagination
 * const logs = await list({}, { page: 1, limit: 20 });
 * console.log(`Found ${logs.totalCount} audit entries`);
 *
 * // Filter by date range and admin
 * const filtered = await list({
 *   dateFrom: new Date('2025-01-01'),
 *   dateTo: new Date('2025-12-31'),
 *   adminId: 'admin-123',
 *   action: 'UPDATE_ADMIN'
 * }, { page: 1, limit: 50 });
 *
 * // Process results
 * for (const entry of filtered.items) {
 *   console.log(`${entry.adminEmail} performed ${entry.action} at ${entry.createdAt}`);
 * }
 * ```
 */
export async function list(
  filters: AuditFilters = {},
  pagination: PaginationInput = {}
): Promise<PaginatedResult<AuditEntry>> {
  const prisma = getPrismaClient();

  try {
    // Default pagination values (Requirement 6.2: default 20 per page)
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.max(1, Math.min(100, pagination.limit ?? 20)); // Cap at 100

    // Calculate offset for pagination
    const skip = (page - 1) * limit;

    // Build where clause for filters
    const where = buildWhereClause(filters);

    // Execute query with pagination and filters
    const [items, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip,
        orderBy: [
          { createdAt: 'desc' }, // Most recent first
        ],
        include: {
          admin: {
            select: {
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Transform database results to AuditEntry format
    const auditEntries: AuditEntry[] = items.map((item) => ({
      id: item.id,
      adminId: item.adminId,
      adminEmail: item.admin.email,
      action: item.action as AuditAction,
      targetId: item.targetId ?? undefined,
      targetType: item.targetType ?? undefined,
      details: item.details as Record<string, unknown>,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      createdAt: item.createdAt,
    }));

    return {
      items: auditEntries,
      totalCount,
      page,
      limit,
      totalPages,
    };
  } catch (error) {
    // Wrap errors in AdminServiceError
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Audit Service: Failed to list audit logs:', err.message);

    throw new AdminServiceError(
      'Failed to retrieve audit logs',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Export audit logs to CSV or JSON format
 *
 * Generates a downloadable file buffer containing audit logs that match the specified filters.
 * Fetches all matching records without pagination for complete export.
 *
 * CSV format includes headers: id, adminId, adminEmail, action, targetId, targetType, ipAddress, userAgent, createdAt
 * JSON format returns a formatted array of AuditEntry objects.
 *
 * Implements Requirement 6.3: Generate downloadable file in JSON or CSV format.
 *
 * @param filters - Optional filters for querying audit logs (same as list function)
 * @param format - Export format ('csv' or 'json')
 * @returns Buffer containing the exported file data
 * @throws AdminServiceError if export fails
 *
 * @example
 * ```typescript
 * // Export all audit logs as CSV
 * const csvBuffer = await exportAuditLogs({}, 'csv');
 *
 * // Export filtered logs as JSON
 * const jsonBuffer = await exportAuditLogs({
 *   dateFrom: new Date('2025-01-01'),
 *   dateTo: new Date('2025-12-31'),
 *   adminId: 'admin-123'
 * }, 'json');
 *
 * // Return as HTTP response
 * reply.header('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
 * reply.header('Content-Disposition', `attachment; filename="audit-logs.${format}"`);
 * reply.send(buffer);
 * ```
 */
export async function exportAuditLogs(
  filters: AuditFilters = {},
  format: 'csv' | 'json'
): Promise<Buffer> {
  const prisma = getPrismaClient();

  try {
    // Build where clause for filters (same as list function)
    const where = buildWhereClause(filters);

    // Fetch all matching records (no pagination for export)
    const items = await prisma.auditLog.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' }, // Most recent first
      ],
      include: {
        admin: {
          select: {
            email: true,
          },
        },
      },
    });

    // Transform database results to AuditEntry format
    const auditEntries: AuditEntry[] = items.map((item) => ({
      id: item.id,
      adminId: item.adminId,
      adminEmail: item.admin.email,
      action: item.action as AuditAction,
      targetId: item.targetId ?? undefined,
      targetType: item.targetType ?? undefined,
      details: item.details as Record<string, unknown>,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      createdAt: item.createdAt,
    }));

    // Generate export based on format
    if (format === 'csv') {
      return generateCsvBuffer(auditEntries);
    } else {
      return generateJsonBuffer(auditEntries);
    }
  } catch (error) {
    // Wrap errors in AdminServiceError
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Audit Service: Failed to export audit logs:', err.message);

    throw new AdminServiceError(
      'Failed to export audit logs',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Generate CSV buffer from audit entries
 *
 * Creates a CSV file with headers and properly escaped values.
 * Handles special characters (commas, quotes, newlines) according to CSV RFC 4180.
 *
 * @param entries - Array of audit entries to export
 * @returns Buffer containing CSV data
 */
function generateCsvBuffer(entries: AuditEntry[]): Buffer {
  // CSV headers
  const headers = [
    'id',
    'adminId',
    'adminEmail',
    'action',
    'targetId',
    'targetType',
    'ipAddress',
    'userAgent',
    'createdAt',
  ];

  // Build CSV rows
  const rows: string[] = [headers.join(',')];

  for (const entry of entries) {
    const row = [
      escapeCsvValue(entry.id),
      escapeCsvValue(entry.adminId),
      escapeCsvValue(entry.adminEmail),
      escapeCsvValue(entry.action),
      escapeCsvValue(entry.targetId ?? ''),
      escapeCsvValue(entry.targetType ?? ''),
      escapeCsvValue(entry.ipAddress),
      escapeCsvValue(entry.userAgent),
      escapeCsvValue(entry.createdAt.toISOString()),
    ];

    rows.push(row.join(','));
  }

  // Join rows with newline and convert to buffer
  const csvContent = rows.join('\n');
  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Escape CSV value according to RFC 4180
 *
 * Wraps values in quotes if they contain special characters (comma, quote, newline).
 * Escapes quotes by doubling them.
 *
 * @param value - Value to escape
 * @returns Escaped CSV value
 */
function escapeCsvValue(value: string): string {
  // Check if value needs escaping (contains comma, quote, or newline)
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    // Wrap in quotes
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Generate JSON buffer from audit entries
 *
 * Creates a formatted JSON array of audit entries.
 * Uses 2-space indentation for readability.
 *
 * @param entries - Array of audit entries to export
 * @returns Buffer containing JSON data
 */
function generateJsonBuffer(entries: AuditEntry[]): Buffer {
  // Format JSON with 2-space indentation for readability
  const jsonContent = JSON.stringify(entries, null, 2);
  return Buffer.from(jsonContent, 'utf-8');
}
