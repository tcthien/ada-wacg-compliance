/**
 * Admin Repository
 *
 * Data access layer for admin user operations using Prisma ORM.
 * Implements clean architecture - repository handles only database operations.
 */

import { getPrismaClient } from '../../config/database.js';
import type { AdminUser, AdminRole } from '@prisma/client';

/**
 * Admin Repository Error
 */
export class AdminRepositoryError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error | undefined) {
    super(message);
    this.name = 'AdminRepositoryError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Pagination options for listing admins
 */
export interface AdminPaginationOptions {
  /** Page number (1-based) */
  page?: number;
  /** Number of items per page */
  limit?: number;
}

/**
 * Paginated admin result
 */
export interface PaginatedAdminResult {
  /** Array of admin users */
  items: AdminUser[];
  /** Total number of admins matching query */
  totalCount: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Input data for creating a new admin user
 */
export interface CreateAdminData {
  /** Admin email (must be unique) */
  email: string;
  /** Bcrypt password hash */
  passwordHash: string;
  /** Admin role (defaults to ADMIN) */
  role?: AdminRole;
  /** ID of the admin who created this user */
  createdById?: string;
}

/**
 * Input data for updating an admin user
 */
export interface UpdateAdminData {
  /** New email (must be unique if provided) */
  email?: string;
  /** New bcrypt password hash */
  passwordHash?: string;
  /** New role */
  role?: AdminRole;
  /** Active status */
  isActive?: boolean;
  /** Force password change on next login */
  mustChangePassword?: boolean;
  /** Last login timestamp */
  lastLoginAt?: Date;
}

/**
 * Find admin user by email
 *
 * @param email - Admin email address
 * @returns The admin user or null if not found
 *
 * @example
 * ```typescript
 * const admin = await findByEmail('admin@example.com');
 * if (admin) {
 *   console.log(`Found admin: ${admin.email}, role: ${admin.role}`);
 * }
 * ```
 */
export async function findByEmail(email: string): Promise<AdminUser | null> {
  const prisma = getPrismaClient();

  try {
    if (!email || typeof email !== 'string') {
      return null;
    }

    // Use email index for efficient lookup
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    return admin;
  } catch (error) {
    console.error('❌ Admin Repository: Failed to find admin by email:', error);
    throw new AdminRepositoryError(
      `Failed to find admin by email: ${email}`,
      'FIND_FAILED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Find admin user by ID
 *
 * @param id - Admin user ID
 * @returns The admin user or null if not found
 *
 * @example
 * ```typescript
 * const admin = await findById('550e8400-e29b-41d4-a716-446655440000');
 * if (admin && admin.isActive) {
 *   console.log('Admin is active');
 * }
 * ```
 */
export async function findById(id: string): Promise<AdminUser | null> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id },
    });

    return admin;
  } catch (error) {
    console.error('❌ Admin Repository: Failed to find admin by ID:', error);
    throw new AdminRepositoryError(
      `Failed to find admin by ID: ${id}`,
      'FIND_FAILED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Create a new admin user
 *
 * @param data - Admin creation data
 * @returns The created admin user
 * @throws AdminRepositoryError if validation fails or database error occurs
 *
 * @example
 * ```typescript
 * const admin = await create({
 *   email: 'newadmin@example.com',
 *   passwordHash: '$2b$10$...', // bcrypt hash
 *   role: 'ADMIN',
 *   createdById: 'creator-admin-id'
 * });
 * ```
 */
export async function create(data: CreateAdminData): Promise<AdminUser> {
  const prisma = getPrismaClient();

  try {
    // Validate required fields
    if (!data.email || typeof data.email !== 'string') {
      throw new AdminRepositoryError(
        'Email is required and must be a string',
        'INVALID_INPUT'
      );
    }

    if (!data.passwordHash || typeof data.passwordHash !== 'string') {
      throw new AdminRepositoryError(
        'Password hash is required and must be a string',
        'INVALID_INPUT'
      );
    }

    // Normalize email to lowercase
    const normalizedEmail = data.email.toLowerCase();

    // Check if email already exists
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (existingAdmin) {
      throw new AdminRepositoryError(
        `Admin with email ${normalizedEmail} already exists`,
        'DUPLICATE_EMAIL'
      );
    }

    // Create admin user
    const admin = await prisma.adminUser.create({
      data: {
        email: normalizedEmail,
        passwordHash: data.passwordHash,
        role: data.role ?? 'ADMIN',
        createdById: data.createdById ?? null,
      },
    });

    console.log(`✅ Admin Repository: Created admin ${admin.id} with email ${admin.email}`);
    return admin;
  } catch (error) {
    // Re-throw AdminRepositoryError as-is
    if (error instanceof AdminRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Admin Repository: Failed to create admin:', err.message);
    throw new AdminRepositoryError(
      'Failed to create admin user',
      'CREATE_FAILED',
      err
    );
  }
}

/**
 * Update an admin user
 *
 * @param id - Admin user ID
 * @param data - Update data (partial)
 * @returns The updated admin user
 * @throws AdminRepositoryError if admin not found or update fails
 *
 * @example
 * ```typescript
 * // Update admin role
 * await update('admin-id', { role: 'SUPER_ADMIN' });
 *
 * // Record login
 * await update('admin-id', { lastLoginAt: new Date() });
 *
 * // Deactivate admin
 * await update('admin-id', { isActive: false });
 * ```
 */
export async function update(id: string, data: UpdateAdminData): Promise<AdminUser> {
  const prisma = getPrismaClient();

  try {
    if (!id || typeof id !== 'string') {
      throw new AdminRepositoryError(
        'Admin ID is required and must be a string',
        'INVALID_INPUT'
      );
    }

    // Validate that at least one field is being updated
    if (Object.keys(data).length === 0) {
      throw new AdminRepositoryError(
        'At least one field must be provided for update',
        'INVALID_INPUT'
      );
    }

    // Check if admin exists
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!existingAdmin) {
      throw new AdminRepositoryError(
        `Admin not found: ${id}`,
        'NOT_FOUND'
      );
    }

    // Build update data
    const updateData: {
      email?: string;
      passwordHash?: string;
      role?: AdminRole;
      isActive?: boolean;
      mustChangePassword?: boolean;
      lastLoginAt?: Date;
    } = {};

    // Normalize email if provided
    if (data.email !== undefined) {
      const normalizedEmail = data.email.toLowerCase();

      // Check for duplicate email (excluding current admin)
      const duplicateAdmin = await prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (duplicateAdmin && duplicateAdmin.id !== id) {
        throw new AdminRepositoryError(
          `Email ${normalizedEmail} is already in use`,
          'DUPLICATE_EMAIL'
        );
      }

      updateData.email = normalizedEmail;
    }

    if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.mustChangePassword !== undefined) updateData.mustChangePassword = data.mustChangePassword;
    if (data.lastLoginAt !== undefined) updateData.lastLoginAt = data.lastLoginAt;

    // Update admin
    const admin = await prisma.adminUser.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Admin Repository: Updated admin ${id}`);
    return admin;
  } catch (error) {
    // Re-throw AdminRepositoryError as-is
    if (error instanceof AdminRepositoryError) {
      throw error;
    }

    // Wrap other errors
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Admin Repository: Failed to update admin:', err.message);
    throw new AdminRepositoryError(
      `Failed to update admin ${id}`,
      'UPDATE_FAILED',
      err
    );
  }
}

/**
 * List admin users with page-based pagination
 *
 * @param options - Pagination options
 * @returns Paginated list of admin users
 *
 * @example
 * ```typescript
 * // Get first page with default limit (20)
 * const result = await listAdmins();
 * console.log(`Found ${result.totalCount} admins, showing page ${result.page}/${result.totalPages}`);
 *
 * // Get second page with custom limit
 * const page2 = await listAdmins({ page: 2, limit: 10 });
 * console.log(`Admins: ${page2.items.map(a => a.email).join(', ')}`);
 * ```
 */
export async function listAdmins(
  options: AdminPaginationOptions = {}
): Promise<PaginatedAdminResult> {
  const prisma = getPrismaClient();

  try {
    // Default to page 1 and limit 20 (Requirement 2.2)
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20)); // Cap at 100

    // Calculate offset
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [items, totalCount] = await Promise.all([
      prisma.adminUser.findMany({
        take: limit,
        skip,
        orderBy: [
          { createdAt: 'desc' }, // Most recent first
        ],
      }),
      prisma.adminUser.count(),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    return {
      items,
      totalCount,
      page,
      limit,
      totalPages,
    };
  } catch (error) {
    console.error('❌ Admin Repository: Failed to list admins:', error);
    throw new AdminRepositoryError(
      'Failed to list admin users',
      'LIST_FAILED',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
