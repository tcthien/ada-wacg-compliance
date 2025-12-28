/**
 * Customer Service
 *
 * Service layer for customer tracking operations.
 * Aggregates scans by email to provide customer insights and analytics.
 */

import { getPrismaClient } from '../../config/database.js';
import type { Scan } from '@prisma/client';
import type { AdminErrorCode } from './admin.types.js';

/**
 * Custom error class for customer service operations
 *
 * Provides consistent error handling across all customer service methods.
 * Extends the base Error class with additional properties for error codes
 * and error chaining through the cause property.
 *
 * @property code - Standardized error code from AdminErrorCode type
 * @property cause - Optional underlying error that caused this error
 *
 * @example
 * ```ts
 * throw new CustomerServiceError(
 *   'Invalid email filter',
 *   'UNAUTHORIZED'
 * );
 * ```
 */
export class CustomerServiceError extends Error {
  public readonly code: AdminErrorCode;
  public readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: AdminErrorCode,
    cause?: Error | undefined
  ) {
    super(message);
    this.name = 'CustomerServiceError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Customer summary with aggregated scan statistics
 *
 * Represents a unique customer identified by email with aggregated
 * metrics across all their scans.
 *
 * @property email - Customer email address
 * @property totalScans - Total number of scans for this customer
 * @property firstScanAt - Timestamp of first scan
 * @property lastScanAt - Timestamp of most recent scan
 * @property avgIssuesPerScan - Average number of issues per scan
 *
 * @example
 * ```ts
 * const customer: CustomerSummary = {
 *   email: 'user@example.com',
 *   totalScans: 15,
 *   firstScanAt: new Date('2025-01-01'),
 *   lastScanAt: new Date('2025-12-27'),
 *   avgIssuesPerScan: 8.5
 * };
 * ```
 */
export interface CustomerSummary {
  /** Customer email address */
  email: string;
  /** Total number of scans */
  totalScans: number;
  /** Timestamp of first scan */
  firstScanAt: Date;
  /** Timestamp of most recent scan */
  lastScanAt: Date;
  /** Average number of issues per scan */
  avgIssuesPerScan: number;
}

/**
 * Filter options for customer list
 */
export interface CustomerFilters {
  /** Filter by minimum number of scans */
  minScans?: number;
  /** Filter by maximum number of scans */
  maxScans?: number;
  /** Filter by date range - start date (inclusive) */
  startDate?: Date;
  /** Filter by date range - end date (inclusive) */
  endDate?: Date;
}

/**
 * Pagination options for customer list
 */
export interface PaginationInput {
  /** Page number (1-indexed) */
  page: number;
  /** Number of items per page (default: 20) */
  limit: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Array of items */
  items: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;
    /** Items per page */
    limit: number;
    /** Total number of items matching filters */
    total: number;
    /** Total number of pages */
    totalPages: number;
  };
}

/**
 * List all customers with aggregated scan statistics
 *
 * Returns unique email addresses from all scans with aggregated statistics
 * including total scans, date range, and average issues per scan.
 * Supports filtering and pagination (default 20 per page).
 *
 * @param filters - Optional filter criteria
 * @param pagination - Pagination options (defaults: page=1, limit=20)
 * @returns Paginated list of customer summaries
 * @throws CustomerServiceError if query fails
 *
 * @example
 * ```typescript
 * // Get first page with default pagination
 * const result = await listCustomers();
 *
 * // Filter by minimum scans
 * const activeCustomers = await listCustomers({ minScans: 5 });
 *
 * // Filter by date range
 * const recentCustomers = await listCustomers({
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-12-31')
 * });
 *
 * // With pagination
 * const result = await listCustomers(
 *   { minScans: 3 },
 *   { page: 2, limit: 50 }
 * );
 * ```
 */
export async function listCustomers(
  filters: CustomerFilters = {},
  pagination: PaginationInput = { page: 1, limit: 20 }
): Promise<PaginatedResult<CustomerSummary>> {
  const prisma = getPrismaClient();

  try {
    // Validate pagination parameters
    const page = Math.max(1, pagination.page);
    const limit = Math.min(100, Math.max(1, pagination.limit)); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Build where clause for date range filter
    const dateFilter: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (filters.startDate || filters.endDate) {
      dateFilter.createdAt = {};
      if (filters.startDate) {
        dateFilter.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        // Include the entire end date by setting to end of day
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.createdAt.lte = endOfDay;
      }
    }

    // Query to get all scans grouped by email with aggregations
    // We need to filter out scans without email addresses
    const scans = await prisma.scan.findMany({
      where: {
        email: { not: null },
        ...dateFilter,
      },
      select: {
        email: true,
        createdAt: true,
        scanResult: {
          select: {
            totalIssues: true,
          },
        },
      },
      orderBy: {
        email: 'asc',
      },
    });

    // Group scans by email and calculate statistics
    const customerMap = new Map<string, {
      email: string;
      scans: Array<{ createdAt: Date; totalIssues: number }>;
    }>();

    for (const scan of scans) {
      if (!scan.email) continue;

      const email = scan.email.toLowerCase(); // Normalize email for grouping
      if (!customerMap.has(email)) {
        customerMap.set(email, {
          email: scan.email, // Keep original casing
          scans: [],
        });
      }

      const customer = customerMap.get(email)!;
      customer.scans.push({
        createdAt: scan.createdAt,
        totalIssues: scan.scanResult?.totalIssues ?? 0,
      });
    }

    // Convert to CustomerSummary array and apply filters
    let customers: CustomerSummary[] = [];
    for (const [, customer] of customerMap) {
      const totalScans = customer.scans.length;

      // Apply minScans filter
      if (filters.minScans && totalScans < filters.minScans) {
        continue;
      }

      // Apply maxScans filter
      if (filters.maxScans && totalScans > filters.maxScans) {
        continue;
      }

      // Sort scans by date to get first and last
      const sortedScans = customer.scans.sort((a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime()
      );

      const firstScanAt = sortedScans[0]!.createdAt;
      const lastScanAt = sortedScans[sortedScans.length - 1]!.createdAt;

      // Calculate average issues per scan
      const totalIssues = customer.scans.reduce(
        (sum, scan) => sum + scan.totalIssues,
        0
      );
      const avgIssuesPerScan = totalScans > 0
        ? Math.round((totalIssues / totalScans) * 10) / 10 // Round to 1 decimal
        : 0;

      customers.push({
        email: customer.email,
        totalScans,
        firstScanAt,
        lastScanAt,
        avgIssuesPerScan,
      });
    }

    // Sort by totalScans descending (most active customers first)
    customers.sort((a, b) => b.totalScans - a.totalScans);

    // Get total count before pagination
    const total = customers.length;

    // Apply pagination
    const paginatedCustomers = customers.slice(skip, skip + limit);

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    console.log(
      `✅ Customer Service: Listed ${paginatedCustomers.length} customers (page ${page}/${totalPages}, total: ${total})`
    );

    return {
      items: paginatedCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Customer Service: Failed to list customers:', err.message);
    throw new CustomerServiceError(
      'Failed to list customers',
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Get all scans for a specific customer email
 *
 * Returns all scans associated with the given email address,
 * ordered by date (most recent first). Supports pagination.
 *
 * @param email - Customer email address
 * @param pagination - Pagination options (defaults: page=1, limit=20)
 * @returns Paginated list of scans for the customer
 * @throws CustomerServiceError if query fails
 *
 * @example
 * ```typescript
 * // Get customer's scans with default pagination
 * const result = await getCustomerScans('user@example.com');
 *
 * // With custom pagination
 * const result = await getCustomerScans(
 *   'user@example.com',
 *   { page: 2, limit: 50 }
 * );
 *
 * console.log(`Customer has ${result.pagination.total} scans`);
 * result.items.forEach(scan => {
 *   console.log(`${scan.url} - ${scan.status} (${scan.createdAt})`);
 * });
 * ```
 */
export async function getCustomerScans(
  email: string,
  pagination: PaginationInput = { page: 1, limit: 20 }
): Promise<PaginatedResult<Scan>> {
  const prisma = getPrismaClient();

  try {
    // Validate email parameter
    if (!email || typeof email !== 'string') {
      throw new CustomerServiceError(
        'Email is required and must be a string',
        'UNAUTHORIZED'
      );
    }

    // Validate pagination parameters
    const page = Math.max(1, pagination.page);
    const limit = Math.min(100, Math.max(1, pagination.limit)); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Execute queries in parallel for better performance
    const [items, total] = await Promise.all([
      prisma.scan.findMany({
        where: {
          email: {
            equals: email,
            mode: 'insensitive', // Case-insensitive exact match
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // Most recent first
      }),
      prisma.scan.count({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
      }),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    console.log(
      `✅ Customer Service: Retrieved ${items.length} scans for ${email} (page ${page}/${totalPages}, total: ${total})`
    );

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    // Re-throw CustomerServiceError as-is
    if (error instanceof CustomerServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Customer Service: Failed to get scans for ${email}:`,
      err.message
    );
    throw new CustomerServiceError(
      `Failed to get scans for customer ${email}`,
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Search customers by email with partial matching
 *
 * Returns customer summaries for emails that match the search query
 * using case-insensitive partial matching. Useful for autocomplete
 * and customer lookup features.
 *
 * @param query - Email search query (partial match)
 * @returns Array of matching customer summaries
 * @throws CustomerServiceError if query fails
 *
 * @example
 * ```typescript
 * // Search for customers with emails containing "example"
 * const customers = await searchByEmail('example');
 * // Returns: user@example.com, test@example.org, etc.
 *
 * // Search for specific domain
 * const gmailUsers = await searchByEmail('@gmail.com');
 *
 * // Search results
 * customers.forEach(customer => {
 *   console.log(`${customer.email}: ${customer.totalScans} scans`);
 *   console.log(`  Last scan: ${customer.lastScanAt}`);
 *   console.log(`  Avg issues: ${customer.avgIssuesPerScan}`);
 * });
 * ```
 */
export async function searchByEmail(
  query: string
): Promise<CustomerSummary[]> {
  const prisma = getPrismaClient();

  try {
    // Validate query parameter
    if (!query || typeof query !== 'string') {
      throw new CustomerServiceError(
        'Search query is required and must be a string',
        'UNAUTHORIZED'
      );
    }

    // Trim query to avoid whitespace issues
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      throw new CustomerServiceError(
        'Search query cannot be empty',
        'UNAUTHORIZED'
      );
    }

    // Query to get all scans matching the email pattern
    const scans = await prisma.scan.findMany({
      where: {
        email: {
          contains: trimmedQuery,
          mode: 'insensitive',
        },
      },
      select: {
        email: true,
        createdAt: true,
        scanResult: {
          select: {
            totalIssues: true,
          },
        },
      },
      orderBy: {
        email: 'asc',
      },
    });

    // Group scans by email and calculate statistics
    const customerMap = new Map<string, {
      email: string;
      scans: Array<{ createdAt: Date; totalIssues: number }>;
    }>();

    for (const scan of scans) {
      if (!scan.email) continue;

      const email = scan.email.toLowerCase(); // Normalize email for grouping
      if (!customerMap.has(email)) {
        customerMap.set(email, {
          email: scan.email, // Keep original casing
          scans: [],
        });
      }

      const customer = customerMap.get(email)!;
      customer.scans.push({
        createdAt: scan.createdAt,
        totalIssues: scan.scanResult?.totalIssues ?? 0,
      });
    }

    // Convert to CustomerSummary array
    const customers: CustomerSummary[] = [];
    for (const [, customer] of customerMap) {
      const totalScans = customer.scans.length;

      // Sort scans by date to get first and last
      const sortedScans = customer.scans.sort((a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime()
      );

      const firstScanAt = sortedScans[0]!.createdAt;
      const lastScanAt = sortedScans[sortedScans.length - 1]!.createdAt;

      // Calculate average issues per scan
      const totalIssues = customer.scans.reduce(
        (sum, scan) => sum + scan.totalIssues,
        0
      );
      const avgIssuesPerScan = totalScans > 0
        ? Math.round((totalIssues / totalScans) * 10) / 10 // Round to 1 decimal
        : 0;

      customers.push({
        email: customer.email,
        totalScans,
        firstScanAt,
        lastScanAt,
        avgIssuesPerScan,
      });
    }

    // Sort by totalScans descending (most active customers first)
    customers.sort((a, b) => b.totalScans - a.totalScans);

    console.log(
      `✅ Customer Service: Found ${customers.length} customers matching "${trimmedQuery}"`
    );

    return customers;
  } catch (error) {
    // Re-throw CustomerServiceError as-is
    if (error instanceof CustomerServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Customer Service: Failed to search customers:`,
      err.message
    );
    throw new CustomerServiceError(
      `Failed to search customers by email`,
      'UNAUTHORIZED',
      err
    );
  }
}

/**
 * Export customer data in CSV or JSON format
 *
 * Retrieves all customer summaries and generates a downloadable file
 * in the specified format. CSV includes headers and formatted data.
 * JSON returns an array of CustomerSummary objects.
 *
 * @param format - Export format: 'csv' or 'json'
 * @param filters - Optional filter criteria (same as listCustomers)
 * @returns Buffer containing the formatted export data
 * @throws CustomerServiceError if export generation fails
 *
 * @example
 * ```typescript
 * // Export all customers as CSV
 * const csvBuffer = await exportCustomers('csv');
 *
 * // Export filtered customers as JSON
 * const jsonBuffer = await exportCustomers('json', { minScans: 5 });
 *
 * // Save to file
 * fs.writeFileSync('customers.csv', csvBuffer);
 * ```
 */
export async function exportCustomers(
  format: 'csv' | 'json',
  filters: CustomerFilters = {}
): Promise<Buffer> {
  try {
    // Validate format parameter
    if (format !== 'csv' && format !== 'json') {
      throw new CustomerServiceError(
        'Invalid export format. Must be "csv" or "json"',
        'UNAUTHORIZED'
      );
    }

    // Get all customers without pagination
    const result = await listCustomers(filters, { page: 1, limit: 100000 });
    const customers = result.items;

    if (format === 'json') {
      // Generate JSON export
      const jsonData = JSON.stringify(customers, null, 2);
      console.log(
        `✅ Customer Service: Exported ${customers.length} customers as JSON`
      );
      return Buffer.from(jsonData, 'utf-8');
    }

    // Generate CSV export
    const csvLines: string[] = [];

    // CSV Header
    csvLines.push('email,totalScans,firstScanAt,lastScanAt,avgIssuesPerScan');

    // CSV Data rows
    for (const customer of customers) {
      const row = [
        `"${customer.email}"`, // Quote email to handle commas
        customer.totalScans.toString(),
        customer.firstScanAt.toISOString(),
        customer.lastScanAt.toISOString(),
        customer.avgIssuesPerScan.toString(),
      ].join(',');
      csvLines.push(row);
    }

    const csvData = csvLines.join('\n');
    console.log(
      `✅ Customer Service: Exported ${customers.length} customers as CSV`
    );
    return Buffer.from(csvData, 'utf-8');
  } catch (error) {
    // Re-throw CustomerServiceError as-is
    if (error instanceof CustomerServiceError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      `❌ Customer Service: Failed to export customers:`,
      err.message
    );
    throw new CustomerServiceError(
      `Failed to export customers as ${format}`,
      'UNAUTHORIZED',
      err
    );
  }
}
