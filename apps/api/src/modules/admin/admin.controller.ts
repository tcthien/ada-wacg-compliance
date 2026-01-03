/**
 * Admin Controller
 *
 * Fastify route handlers for admin authentication and management operations.
 * Implements middleware chain: rate limit → handler
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AdminTokenPayload } from './admin.types.js';
import { z } from 'zod';
import {
  login,
  logout,
  generateToken,
  hashPassword,
  verifyPassword,
  AdminServiceError,
} from './admin.service.js';
import { update, create, listAdmins, findById } from './admin.repository.js';
import {
  loginRateLimitMiddleware,
  adminAuthMiddleware,
  requireSuperAdmin,
  recordFailedLogin,
  clearLoginAttempts,
  getClientIP,
  ADMIN_COOKIE_NAME,
} from './admin.middleware.js';
import {
  loginSchema,
  changePasswordSchema,
  createAdminSchema,
  updateAdminSchema,
  paginationSchema,
  adminIdParamSchema,
  scanListQuerySchema,
  scanIdParamSchema,
  deleteScanQuerySchema,
  customerListQuerySchema,
  customerEmailParamSchema,
  customerExportQuerySchema,
  dashboardTrendsQuerySchema,
  dashboardDomainsQuerySchema,
  auditListQuerySchema,
  auditExportQuerySchema,
  reportParamsSchema,
} from './admin.schema.js';
import {
  listAllScans,
  getScanDetails,
  deleteScan,
  retryScan,
  ScanAdminServiceError,
  type ScanListFilters,
  type ScanListPagination,
} from './scan-admin.service.js';
import {
  listCustomers,
  getCustomerScans,
  searchByEmail,
  exportCustomers,
  CustomerServiceError,
  type CustomerFilters,
  type PaginationInput,
} from './customer.service.js';
import {
  getMetrics,
  getScanTrends,
  getIssueDistribution,
  getTopDomains,
  getSystemHealth,
} from './dashboard.service.js';
import {
  list as listAuditLogs,
  exportAuditLogs,
  log as logAuditEvent,
  type AuditFilters,
} from './audit.service.js';

/**
 * Cookie configuration for admin JWT tokens
 * Follows security best practices from design document
 */
const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  // Use 'lax' in development to allow cross-port requests (3000 -> 3080)
  // Use 'strict' in production for maximum security
  sameSite: (process.env['NODE_ENV'] === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 24 * 60 * 60, // 24 hours in seconds
  path: '/',
};

/**
 * Request body type for login
 */
type LoginBody = z.infer<typeof loginSchema>;

/**
 * POST /api/v1/admin/auth/login
 *
 * Authenticate admin and set JWT cookie.
 *
 * Middleware chain:
 * 1. loginRateLimit - Prevents brute force (5 attempts/15 min)
 * 2. handler - Validates credentials and sets cookie
 *
 * @param request - Fastify request with LoginBody
 * @param reply - Fastify reply
 * @returns Admin info (NOT token) and expiration time
 *
 * @example
 * POST /api/v1/admin/auth/login
 * Body: {
 *   "email": "admin@example.com",
 *   "password": "MyP@ssw0rd123"
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "admin": {
 *       "id": "uuid-123",
 *       "email": "admin@example.com",
 *       "role": "ADMIN",
 *       "mustChangePassword": false
 *     },
 *     "expiresAt": "2025-12-28T12:00:00.000Z"
 *   }
 * }
 *
 * Sets cookie: adashield_admin_token=jwt-token (HTTP-only, secure)
 */
async function loginHandler(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
) {
  const ip = getClientIP(request);

  try {
    // Validate request body
    const body = loginSchema.parse(request.body);

    // Attempt login
    const result = await login(body.email, body.password);

    // Generate JWT token
    const token = generateToken(
      result.admin.id,
      result.admin.email,
      result.admin.role
    );

    // Set HTTP-only cookie
    reply.setCookie(ADMIN_COOKIE_NAME, token, COOKIE_CONFIG);

    // Clear failed login attempts on success
    await clearLoginAttempts(ip);

    // Return admin info (NOT the token)
    return reply.code(200).send({
      success: true,
      data: {
        admin: {
          id: result.admin.id,
          email: result.admin.email,
          role: result.admin.role,
          mustChangePassword: result.admin.mustChangePassword,
        },
        expiresAt: result.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    // Record failed login attempt
    await recordFailedLogin(ip);

    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in loginHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Request body type for password change
 */
type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

/**
 * POST /api/v1/admin/auth/logout
 *
 * Logout admin by clearing cookie and blacklisting token.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Blacklists token and clears cookie
 *
 * @param request - Fastify request with adminTokenPayload
 * @param reply - Fastify reply
 * @returns Success message
 *
 * @example
 * POST /api/v1/admin/auth/logout
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Logged out successfully"
 * }
 *
 * Clears cookie: adashield_admin_token
 */
async function logoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get token ID from payload (set by adminAuthMiddleware)
    const payload = request.adminTokenPayload as AdminTokenPayload & { jti: string };

    if (payload?.jti) {
      // Blacklist the token
      await logout(payload.jti);
    }

    // Clear the cookie
    reply.clearCookie(ADMIN_COOKIE_NAME, {
      path: '/',
    });

    return reply.code(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    // Log error but still clear cookie
    request.log.error(error, 'Error during logout');

    // Clear the cookie anyway
    reply.clearCookie(ADMIN_COOKIE_NAME, {
      path: '/',
    });

    return reply.code(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  }
}

/**
 * GET /api/v1/admin/auth/me
 *
 * Get current authenticated admin's information.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT and attaches adminUser
 * 2. handler - Returns admin info
 *
 * @param request - Fastify request with adminUser
 * @param reply - Fastify reply
 * @returns Current admin information
 *
 * @example
 * GET /api/v1/admin/auth/me
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid-123",
 *     "email": "admin@example.com",
 *     "role": "ADMIN",
 *     "isActive": true,
 *     "mustChangePassword": false,
 *     "lastLoginAt": "2025-12-27T10:00:00.000Z",
 *     "createdAt": "2025-12-01T00:00:00.000Z"
 *   }
 * }
 */
async function meHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const admin = request.adminUser;

  if (!admin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  return reply.code(200).send({
    success: true,
    data: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
      createdAt: admin.createdAt.toISOString(),
    },
  });
}

/**
 * PUT /api/v1/admin/auth/password
 *
 * Change the current admin's password.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT and attaches adminUser
 * 2. handler - Validates current password and updates to new password
 *
 * Security:
 * - Requires current password verification
 * - New password must meet complexity requirements
 * - Clears mustChangePassword flag after successful change
 *
 * @param request - Fastify request with ChangePasswordBody
 * @param reply - Fastify reply
 * @returns Success message
 *
 * @example
 * PUT /api/v1/admin/auth/password
 * Cookie: adashield_admin_token=jwt-token
 * Body: {
 *   "currentPassword": "OldP@ssw0rd123",
 *   "newPassword": "NewP@ssw0rd456"
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Password changed successfully"
 * }
 */
async function changePasswordHandler(
  request: FastifyRequest<{ Body: ChangePasswordBody }>,
  reply: FastifyReply
) {
  const admin = request.adminUser;

  if (!admin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate request body
    const body = changePasswordSchema.parse(request.body);

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(
      body.currentPassword,
      admin.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return reply.code(401).send({
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD',
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(body.newPassword);

    // Update password and clear mustChangePassword flag
    await update(admin.id, {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
    });

    return reply.code(200).send({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in changePasswordHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Request body type for creating admin
 */
type CreateAdminBody = z.infer<typeof createAdminSchema>;

/**
 * Query params type for pagination
 */
type PaginationQuery = z.infer<typeof paginationSchema>;

/**
 * GET /api/v1/admin/users
 *
 * List all admin users with pagination.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. requireSuperAdmin - Ensures SUPER_ADMIN role
 * 3. handler - Returns paginated admin list
 *
 * @param request - Fastify request with pagination query params
 * @param reply - Fastify reply
 * @returns Paginated list of admin users
 *
 * @example
 * GET /api/v1/admin/users?page=1&limit=20
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       { "id": "uuid", "email": "admin@example.com", "role": "ADMIN", ... }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "totalCount": 5,
 *       "totalPages": 1
 *     }
 *   }
 * }
 */
async function listAdminsHandler(
  request: FastifyRequest<{ Querystring: PaginationQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate query params
    const query = paginationSchema.parse(request.query);

    // Get paginated admin list
    const result = await listAdmins({
      page: query.page,
      limit: query.limit,
    });

    // Transform response (exclude passwordHash)
    const items = result.items.map((admin) => ({
      id: admin.id,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
      createdById: admin.createdById,
    }));

    return reply.code(200).send({
      success: true,
      data: {
        items,
        pagination: {
          page: result.page,
          limit: result.limit,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in listAdminsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/admin/users
 *
 * Create a new admin user.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. requireSuperAdmin - Ensures SUPER_ADMIN role
 * 3. handler - Creates new admin
 *
 * Security:
 * - Only SUPER_ADMIN can create new admins
 * - Password must meet complexity requirements
 * - Email must be unique
 * - New admins are set to mustChangePassword=true by default
 *
 * @param request - Fastify request with CreateAdminBody
 * @param reply - Fastify reply
 * @returns Created admin info (without password)
 *
 * @example
 * POST /api/v1/admin/users
 * Cookie: adashield_admin_token=jwt-token
 * Body: {
 *   "email": "newadmin@example.com",
 *   "password": "SecureP@ssw0rd123",
 *   "role": "ADMIN"
 * }
 *
 * Response 201:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid-123",
 *     "email": "newadmin@example.com",
 *     "role": "ADMIN",
 *     "isActive": true,
 *     "mustChangePassword": true,
 *     "createdAt": "2025-12-27T12:00:00.000Z"
 *   }
 * }
 */
async function createAdminHandler(
  request: FastifyRequest<{ Body: CreateAdminBody }>,
  reply: FastifyReply
) {
  const currentAdmin = request.adminUser;

  if (!currentAdmin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate request body
    const body = createAdminSchema.parse(request.body);

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Create admin with mustChangePassword=true
    const newAdmin = await create({
      email: body.email,
      passwordHash,
      role: body.role,
      createdById: currentAdmin.id,
    });

    // Note: For new admins, we want them to change password on first login
    // This is done by setting mustChangePassword to true after creation
    await update(newAdmin.id, { mustChangePassword: true });

    return reply.code(201).send({
      success: true,
      data: {
        id: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        isActive: newAdmin.isActive,
        mustChangePassword: true,
        createdAt: newAdmin.createdAt.toISOString(),
        createdById: currentAdmin.id,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle repository errors (e.g., duplicate email)
    if (error instanceof Error && error.message.includes('already exists')) {
      return reply.code(409).send({
        success: false,
        error: 'Email already exists',
        code: 'EMAIL_EXISTS',
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in createAdminHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Request params type for admin ID
 */
type AdminIdParams = z.infer<typeof adminIdParamSchema>;

/**
 * Request body type for updating admin
 */
type UpdateAdminBody = z.infer<typeof updateAdminSchema>;

/**
 * GET /api/v1/admin/users/:id
 *
 * Get a single admin user by ID.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. requireSuperAdmin - Ensures SUPER_ADMIN role
 * 3. handler - Returns admin info
 *
 * @param request - Fastify request with admin ID param
 * @param reply - Fastify reply
 * @returns Admin user information
 *
 * @example
 * GET /api/v1/admin/users/uuid-123
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid-123",
 *     "email": "admin@example.com",
 *     "role": "ADMIN",
 *     ...
 *   }
 * }
 */
async function getAdminHandler(
  request: FastifyRequest<{ Params: AdminIdParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = adminIdParamSchema.parse(request.params);

    // Get admin by ID
    const admin = await findById(params.id);

    if (!admin) {
      return reply.code(404).send({
        success: false,
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    return reply.code(200).send({
      success: true,
      data: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        mustChangePassword: admin.mustChangePassword,
        lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
        createdAt: admin.createdAt.toISOString(),
        updatedAt: admin.updatedAt.toISOString(),
        createdById: admin.createdById,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid admin ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getAdminHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * PUT /api/v1/admin/users/:id
 *
 * Update an admin user.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. requireSuperAdmin - Ensures SUPER_ADMIN role
 * 3. handler - Updates admin
 *
 * Security:
 * - Only SUPER_ADMIN can update other admins
 * - Cannot deactivate yourself
 * - Cannot change your own role
 *
 * @param request - Fastify request with admin ID param and update body
 * @param reply - Fastify reply
 * @returns Updated admin info
 *
 * @example
 * PUT /api/v1/admin/users/uuid-123
 * Cookie: adashield_admin_token=jwt-token
 * Body: {
 *   "role": "SUPER_ADMIN",
 *   "isActive": true
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid-123",
 *     "email": "admin@example.com",
 *     "role": "SUPER_ADMIN",
 *     ...
 *   }
 * }
 */
async function updateAdminHandler(
  request: FastifyRequest<{ Params: AdminIdParams; Body: UpdateAdminBody }>,
  reply: FastifyReply
) {
  const currentAdmin = request.adminUser;

  if (!currentAdmin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate params and body
    const params = adminIdParamSchema.parse(request.params);
    const body = updateAdminSchema.parse(request.body);

    // Check if admin exists
    const targetAdmin = await findById(params.id);
    if (!targetAdmin) {
      return reply.code(404).send({
        success: false,
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    // Prevent self-deactivation
    if (params.id === currentAdmin.id && body.isActive === false) {
      return reply.code(400).send({
        success: false,
        error: 'Cannot deactivate yourself',
        code: 'SELF_DEACTIVATION',
      });
    }

    // Prevent self-role-change
    if (params.id === currentAdmin.id && body.role !== undefined) {
      return reply.code(400).send({
        success: false,
        error: 'Cannot change your own role',
        code: 'SELF_ROLE_CHANGE',
      });
    }

    // Update admin
    const updatedAdmin = await update(params.id, body);

    return reply.code(200).send({
      success: true,
      data: {
        id: updatedAdmin.id,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        isActive: updatedAdmin.isActive,
        mustChangePassword: updatedAdmin.mustChangePassword,
        lastLoginAt: updatedAdmin.lastLoginAt?.toISOString() ?? null,
        createdAt: updatedAdmin.createdAt.toISOString(),
        updatedAt: updatedAdmin.updatedAt.toISOString(),
        createdById: updatedAdmin.createdById,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle repository errors (e.g., duplicate email)
    if (error instanceof Error && error.message.includes('already in use')) {
      return reply.code(409).send({
        success: false,
        error: 'Email already exists',
        code: 'EMAIL_EXISTS',
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in updateAdminHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * DELETE /api/v1/admin/users/:id
 *
 * Deactivate an admin user (soft delete).
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. requireSuperAdmin - Ensures SUPER_ADMIN role
 * 3. handler - Deactivates admin
 *
 * Security:
 * - Only SUPER_ADMIN can deactivate admins
 * - Cannot deactivate yourself
 * - This is a soft delete (sets isActive=false)
 *
 * @param request - Fastify request with admin ID param
 * @param reply - Fastify reply
 * @returns Success message
 *
 * @example
 * DELETE /api/v1/admin/users/uuid-123
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Admin deactivated successfully"
 * }
 */
async function deactivateAdminHandler(
  request: FastifyRequest<{ Params: AdminIdParams }>,
  reply: FastifyReply
) {
  const currentAdmin = request.adminUser;

  if (!currentAdmin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate params
    const params = adminIdParamSchema.parse(request.params);

    // Check if admin exists
    const targetAdmin = await findById(params.id);
    if (!targetAdmin) {
      return reply.code(404).send({
        success: false,
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    // Prevent self-deactivation
    if (params.id === currentAdmin.id) {
      return reply.code(400).send({
        success: false,
        error: 'Cannot deactivate yourself',
        code: 'SELF_DEACTIVATION',
      });
    }

    // Soft delete - set isActive to false
    await update(params.id, { isActive: false });

    return reply.code(200).send({
      success: true,
      message: 'Admin deactivated successfully',
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid admin ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in deactivateAdminHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/admin/users/:id/reset-password
 *
 * Reset an admin's password (SUPER_ADMIN only).
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. requireSuperAdmin - Ensures SUPER_ADMIN role
 * 3. handler - Resets password and sets mustChangePassword
 *
 * Security:
 * - Only SUPER_ADMIN can reset passwords
 * - New password must meet complexity requirements
 * - Sets mustChangePassword=true so admin must change on next login
 *
 * @param request - Fastify request with admin ID param and new password
 * @param reply - Fastify reply
 * @returns Success message
 *
 * @example
 * POST /api/v1/admin/users/uuid-123/reset-password
 * Cookie: adashield_admin_token=jwt-token
 * Body: {
 *   "newPassword": "NewP@ssw0rd123"
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Password reset successfully. User must change password on next login."
 * }
 */
async function resetPasswordHandler(
  request: FastifyRequest<{ Params: AdminIdParams; Body: { newPassword: string } }>,
  reply: FastifyReply
) {
  const currentAdmin = request.adminUser;

  if (!currentAdmin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate params
    const params = adminIdParamSchema.parse(request.params);

    // Validate new password using the password schema
    const passwordResult = z.object({
      newPassword: z.string()
        .min(12, 'Password must be at least 12 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    }).parse(request.body);

    // Check if admin exists
    const targetAdmin = await findById(params.id);
    if (!targetAdmin) {
      return reply.code(404).send({
        success: false,
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(passwordResult.newPassword);

    // Update password and set mustChangePassword=true
    await update(params.id, {
      passwordHash: newPasswordHash,
      mustChangePassword: true,
    });

    return reply.code(200).send({
      success: true,
      message: 'Password reset successfully. User must change password on next login.',
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in resetPasswordHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Map admin service error codes to HTTP status codes
 */
function getStatusCodeForAdminError(code: string): number {
  switch (code) {
    case 'INVALID_CREDENTIALS':
    case 'INVALID_PASSWORD':
      return 401;
    case 'ACCOUNT_DEACTIVATED':
      return 403;
    case 'TOKEN_EXPIRED':
    case 'TOKEN_BLACKLISTED':
    case 'UNAUTHORIZED':
      return 401;
    case 'ADMIN_NOT_FOUND':
      return 404;
    case 'EMAIL_EXISTS':
      return 409;
    case 'RATE_LIMITED':
      return 429;
    default:
      return 500;
  }
}

// ==================== SCAN MANAGEMENT HANDLERS ====================

/**
 * Request query type for scan list
 */
type ScanListQuery = z.infer<typeof scanListQuerySchema>;

/**
 * Request params type for scan ID
 */
type ScanIdParams = z.infer<typeof scanIdParamSchema>;

/**
 * Request query type for delete scan
 */
type DeleteScanQuery = z.infer<typeof deleteScanQuerySchema>;

/**
 * GET /api/v1/admin/scans
 *
 * List all scans with filtering and pagination.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns paginated scan list
 *
 * Query Parameters:
 * - status: Filter by scan status (PENDING, RUNNING, COMPLETED, FAILED)
 * - startDate: Filter by date range start (ISO date string)
 * - endDate: Filter by date range end (ISO date string)
 * - email: Filter by customer email (partial match)
 * - url: Filter by scan URL (partial match)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns Paginated list of scans
 *
 * @example
 * GET /api/v1/admin/scans?status=COMPLETED&page=1&limit=20
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "id": "uuid",
 *         "url": "https://example.com",
 *         "status": "COMPLETED",
 *         "wcagLevel": "AA",
 *         ...
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 */
async function listScansHandler(
  request: FastifyRequest<{ Querystring: ScanListQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate query parameters
    const query = scanListQuerySchema.parse(request.query);

    // Build filters object
    const filters: ScanListFilters = {
      ...(query.status && { status: query.status }),
      ...(query.startDate && { startDate: query.startDate }),
      ...(query.endDate && { endDate: query.endDate }),
      ...(query.email && { email: query.email }),
      ...(query.url && { url: query.url }),
    };

    // Build pagination object
    const pagination: ScanListPagination = {
      page: query.page,
      limit: query.limit,
    };

    // Get paginated scan list
    const result = await listAllScans(filters, pagination);

    // Transform response (serialize dates)
    const items = result.items.map((scan) => ({
      id: scan.id,
      url: scan.url,
      status: scan.status,
      wcagLevel: scan.wcagLevel,
      email: scan.email,
      guestSessionId: scan.guestSessionId,
      userId: scan.userId,
      createdAt: scan.createdAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
      durationMs: scan.durationMs,
      errorMessage: scan.errorMessage,
    }));

    return reply.code(200).send({
      success: true,
      data: {
        items,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle scan admin service errors
    if (error instanceof ScanAdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in listScansHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/scans/:id
 *
 * Get scan details with full related data.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns scan details
 *
 * Returns:
 * - Scan information
 * - Scan results (if available)
 * - All issues (if available)
 * - Guest session info (if available)
 *
 * @param request - Fastify request with scan ID param
 * @param reply - Fastify reply
 * @returns Scan with full related data
 *
 * @example
 * GET /api/v1/admin/scans/550e8400-e29b-41d4-a716-446655440000
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "url": "https://example.com",
 *     "status": "COMPLETED",
 *     "scanResult": {
 *       "totalIssues": 10,
 *       "criticalCount": 2,
 *       "issues": [...]
 *     },
 *     "guestSession": {
 *       "id": "uuid",
 *       "fingerprint": "hash"
 *     }
 *   }
 * }
 */
async function getScanDetailsHandler(
  request: FastifyRequest<{ Params: ScanIdParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = scanIdParamSchema.parse(request.params);

    // Get scan details
    const scan = await getScanDetails(params.id);

    // Transform response (serialize dates and nested data)
    const data = {
      id: scan.id,
      url: scan.url,
      status: scan.status,
      wcagLevel: scan.wcagLevel,
      email: scan.email,
      guestSessionId: scan.guestSessionId,
      userId: scan.userId,
      createdAt: scan.createdAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
      durationMs: scan.durationMs,
      errorMessage: scan.errorMessage,
      scanResult: scan.scanResult
        ? {
            id: scan.scanResult.id,
            totalIssues: scan.scanResult.totalIssues,
            criticalCount: scan.scanResult.criticalCount,
            seriousCount: scan.scanResult.seriousCount,
            moderateCount: scan.scanResult.moderateCount,
            minorCount: scan.scanResult.minorCount,
            passedChecks: scan.scanResult.passedChecks,
            inapplicableChecks: scan.scanResult.inapplicableChecks,
            createdAt: scan.scanResult.createdAt.toISOString(),
            issues: scan.scanResult.issues.map((issue) => ({
              id: issue.id,
              ruleId: issue.ruleId,
              impact: issue.impact,
              description: issue.description,
              helpText: issue.helpText,
              helpUrl: issue.helpUrl,
              wcagCriteria: issue.wcagCriteria,
              htmlSnippet: issue.htmlSnippet,
              cssSelector: issue.cssSelector,
              nodes: issue.nodes,
              createdAt: issue.createdAt.toISOString(),
            })),
          }
        : null,
      guestSession: scan.guestSession
        ? {
            id: scan.guestSession.id,
            fingerprint: scan.guestSession.fingerprint,
            createdAt: scan.guestSession.createdAt.toISOString(),
          }
        : null,
    };

    return reply.code(200).send({
      success: true,
      data,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid scan ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle scan admin service errors
    if (error instanceof ScanAdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getScanDetailsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * DELETE /api/v1/admin/scans/:id
 *
 * Delete a scan and all associated data.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Deletes scan
 *
 * Query Parameters:
 * - soft: Use soft delete (set deletedAt) instead of hard delete (default: false)
 *
 * Behavior:
 * - Hard delete: Permanently removes scan, results, issues, and reports
 * - Soft delete: Sets deletedAt timestamp (TODO: not yet implemented)
 *
 * @param request - Fastify request with scan ID param and query
 * @param reply - Fastify reply
 * @returns Success message
 *
 * @example
 * DELETE /api/v1/admin/scans/550e8400-e29b-41d4-a716-446655440000?soft=true
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Scan deleted successfully"
 * }
 */
async function deleteScanHandler(
  request: FastifyRequest<{ Params: ScanIdParams; Querystring: DeleteScanQuery }>,
  reply: FastifyReply
) {
  const admin = request.adminUser;

  if (!admin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate params and query
    const params = scanIdParamSchema.parse(request.params);
    const query = deleteScanQuerySchema.parse(request.query);

    // Delete scan
    await deleteScan(params.id, { soft: query.soft });

    // Log audit event
    request.log.info({
      event: 'ADMIN_DELETE_SCAN',
      adminId: admin.id,
      adminEmail: admin.email,
      scanId: params.id,
      softDelete: query.soft,
      timestamp: new Date().toISOString(),
    });

    return reply.code(200).send({
      success: true,
      message: 'Scan deleted successfully',
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle scan admin service errors
    if (error instanceof ScanAdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in deleteScanHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * POST /api/v1/admin/scans/:id/retry
 *
 * Retry a failed scan.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Queues retry job
 *
 * Behavior:
 * - Queues a new scan job with the same parameters as the original scan
 * - Resets scan status to PENDING
 * - Clears error message and completedAt timestamp
 * - Returns new job ID
 *
 * @param request - Fastify request with scan ID param
 * @param reply - Fastify reply
 * @returns New job ID
 *
 * @example
 * POST /api/v1/admin/scans/550e8400-e29b-41d4-a716-446655440000/retry
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "jobId": "job-123",
 *     "message": "Scan retry job queued successfully"
 *   }
 * }
 */
async function retryScanHandler(
  request: FastifyRequest<{ Params: ScanIdParams }>,
  reply: FastifyReply
) {
  const admin = request.adminUser;

  if (!admin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate params
    const params = scanIdParamSchema.parse(request.params);

    // Retry scan
    const jobId = await retryScan(params.id);

    // Log audit event
    request.log.info({
      event: 'ADMIN_RETRY_SCAN',
      adminId: admin.id,
      adminEmail: admin.email,
      scanId: params.id,
      jobId,
      timestamp: new Date().toISOString(),
    });

    return reply.code(200).send({
      success: true,
      data: {
        jobId,
        message: 'Scan retry job queued successfully',
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid scan ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle scan admin service errors
    if (error instanceof ScanAdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in retryScanHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/scans/:scanId/reports
 *
 * Get report status for any scan (admin bypass)
 *
 * Admin-only endpoint that retrieves report status for both PDF and JSON formats
 * without session ownership validation. This allows admins to check report status
 * for any scan in the system.
 *
 * @param request - Fastify request with scan ID param
 * @param reply - Fastify reply
 * @returns Report status for both PDF and JSON formats
 *
 * @example
 * GET /api/v1/admin/scans/550e8400-e29b-41d4-a716-446655440000/reports
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "scanId": "550e8400-e29b-41d4-a716-446655440000",
 *     "scanStatus": "COMPLETED",
 *     "reports": {
 *       "pdf": {
 *         "exists": true,
 *         "url": "https://s3.amazonaws.com/...",
 *         "createdAt": "2024-01-15T10:30:00.000Z",
 *         "fileSizeBytes": 245678,
 *         "expiresAt": "2024-01-15T11:30:00.000Z"
 *       },
 *       "json": null
 *     }
 *   }
 * }
 *
 * Response 404:
 * {
 *   "success": false,
 *   "error": "Scan not found",
 *   "code": "SCAN_NOT_FOUND"
 * }
 */
async function getScanReportsHandler(
  request: FastifyRequest<{ Params: ScanIdParams }>,
  reply: FastifyReply
) {
  const admin = request.adminUser;

  if (!admin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate params
    const params = scanIdParamSchema.parse(request.params);

    // Get report status without sessionId (admin bypass)
    const { getReportStatus } = await import('../reports/report.service.js');
    const status = await getReportStatus(params.id);

    // Log audit event
    request.log.info({
      event: 'ADMIN_GET_SCAN_REPORTS',
      adminId: admin.id,
      adminEmail: admin.email,
      scanId: params.id,
      timestamp: new Date().toISOString(),
    });

    return reply.code(200).send({
      success: true,
      data: status,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid scan ID',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle report service errors
    if (error && typeof error === 'object' && 'code' in error) {
      const reportError = error as { code: string; message: string };

      if (reportError.code === 'SCAN_NOT_FOUND') {
        return reply.code(404).send({
          success: false,
          error: reportError.message,
          code: reportError.code,
        });
      }

      return reply.code(500).send({
        success: false,
        error: reportError.message,
        code: reportError.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getScanReportsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Request params type for report generation
 */
type ReportParams = z.infer<typeof reportParamsSchema>;

/**
 * POST /api/v1/admin/reports/:scanId/:format
 *
 * Generate or retrieve a report for any scan (admin bypass)
 *
 * Admin-only endpoint that generates or retrieves reports for any scan in the system
 * without session ownership validation. This allows admins to generate reports for
 * any scan regardless of who created it.
 *
 * @param request - Fastify request with scanId and format params
 * @param reply - Fastify reply
 * @returns Report URL (200), generation status (202), or error
 *
 * @example
 * POST /api/v1/admin/reports/550e8400-e29b-41d4-a716-446655440000/pdf
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200 (report exists):
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://s3.amazonaws.com/...",
 *     "expiresAt": "2025-12-28T13:00:00.000Z"
 *   }
 * }
 *
 * Response 202 (generating):
 * {
 *   "success": true,
 *   "data": {
 *     "status": "generating",
 *     "jobId": "12345"
 *   }
 * }
 *
 * Response 404:
 * {
 *   "success": false,
 *   "error": "Scan not found",
 *   "code": "SCAN_NOT_FOUND"
 * }
 *
 * Response 409:
 * {
 *   "success": false,
 *   "error": "Scan must be completed before generating report",
 *   "code": "SCAN_NOT_COMPLETED"
 * }
 */
async function generateReportHandler(
  request: FastifyRequest<{ Params: ReportParams }>,
  reply: FastifyReply
) {
  const admin = request.adminUser;

  if (!admin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Validate params
    const params = reportParamsSchema.parse(request.params);

    // Get or generate report without session check (admin bypass)
    const { getOrGenerateReportAdmin } = await import('../reports/report.service.js');
    const result = await getOrGenerateReportAdmin(params.scanId, params.format);

    // Log audit event
    request.log.info({
      event: 'ADMIN_GENERATE_REPORT',
      adminId: admin.id,
      adminEmail: admin.email,
      scanId: params.scanId,
      format: params.format,
      timestamp: new Date().toISOString(),
    });

    // Handle result based on status
    switch (result.status) {
      case 'ready':
        return reply.code(200).send({
          success: true,
          data: {
            url: result.url,
            expiresAt: result.expiresAt?.toISOString(),
          },
        });

      case 'generating':
        return reply.code(202).send({
          success: true,
          data: {
            status: 'generating',
            jobId: result.jobId,
          },
        });

      case 'not_found':
        return reply.code(404).send({
          success: false,
          error: 'Scan not found',
          code: 'SCAN_NOT_FOUND',
        });

      default:
        // This should never happen due to TypeScript's exhaustive checking
        return reply.code(500).send({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
    }
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle report service errors
    if (error && typeof error === 'object' && 'code' in error) {
      const reportError = error as { code: string; message: string };

      if (reportError.code === 'SCAN_NOT_FOUND') {
        return reply.code(404).send({
          success: false,
          error: reportError.message,
          code: reportError.code,
        });
      }

      if (reportError.code === 'SCAN_NOT_COMPLETED') {
        return reply.code(409).send({
          success: false,
          error: reportError.message,
          code: reportError.code,
        });
      }

      return reply.code(500).send({
        success: false,
        error: reportError.message,
        code: reportError.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in generateReportHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ==================== CUSTOMER MANAGEMENT HANDLERS ====================

/**
 * Request query type for customer list
 */
type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

/**
 * Request params type for customer email
 */
type CustomerEmailParams = z.infer<typeof customerEmailParamSchema>;

/**
 * Request query type for customer export
 */
type CustomerExportQuery = z.infer<typeof customerExportQuerySchema>;

/**
 * GET /api/v1/admin/customers
 *
 * List all customers with aggregated scan statistics.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns paginated customer list
 *
 * Query Parameters:
 * - minScans: Filter by minimum number of scans (optional)
 * - maxScans: Filter by maximum number of scans (optional)
 * - startDate: Filter by date range start (ISO date string) (optional)
 * - endDate: Filter by date range end (ISO date string) (optional)
 * - search: Search by email partial match (case-insensitive) (optional)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns Paginated list of customer summaries
 *
 * @example
 * GET /api/v1/admin/customers?minScans=5&page=1&limit=20
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "email": "user@example.com",
 *         "totalScans": 15,
 *         "firstScanAt": "2025-01-01T00:00:00.000Z",
 *         "lastScanAt": "2025-12-27T10:00:00.000Z",
 *         "avgIssuesPerScan": 8.5
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 */
async function listCustomersHandler(
  request: FastifyRequest<{ Querystring: CustomerListQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate query parameters
    const query = customerListQuerySchema.parse(request.query);

    // Build filters object
    const filters: CustomerFilters = {
      ...(query.minScans && { minScans: query.minScans }),
      ...(query.maxScans && { maxScans: query.maxScans }),
      ...(query.startDate && { startDate: query.startDate }),
      ...(query.endDate && { endDate: query.endDate }),
    };

    // Build pagination object
    const pagination: PaginationInput = {
      page: query.page,
      limit: query.limit,
    };

    // If search query provided, use searchByEmail instead
    if (query.search) {
      const customers = await searchByEmail(query.search);

      // Apply pagination manually
      const total = customers.length;
      const totalPages = Math.ceil(total / pagination.limit);
      const skip = (pagination.page - 1) * pagination.limit;
      const items = customers.slice(skip, skip + pagination.limit);

      // Transform response (serialize dates)
      const transformedItems = items.map((customer) => ({
        email: customer.email,
        totalScans: customer.totalScans,
        firstScanAt: customer.firstScanAt.toISOString(),
        lastScanAt: customer.lastScanAt.toISOString(),
        avgIssuesPerScan: customer.avgIssuesPerScan,
      }));

      return reply.code(200).send({
        success: true,
        data: {
          items: transformedItems,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            totalPages,
          },
        },
      });
    }

    // Get paginated customer list
    const result = await listCustomers(filters, pagination);

    // Transform response (serialize dates)
    const items = result.items.map((customer) => ({
      email: customer.email,
      totalScans: customer.totalScans,
      firstScanAt: customer.firstScanAt.toISOString(),
      lastScanAt: customer.lastScanAt.toISOString(),
      avgIssuesPerScan: customer.avgIssuesPerScan,
    }));

    return reply.code(200).send({
      success: true,
      data: {
        items,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle customer service errors
    if (error instanceof CustomerServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in listCustomersHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/customers/:email
 *
 * Get customer details by email.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns customer summary
 *
 * @param request - Fastify request with email param
 * @param reply - Fastify reply
 * @returns Customer summary with aggregated statistics
 *
 * @example
 * GET /api/v1/admin/customers/user@example.com
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "email": "user@example.com",
 *     "totalScans": 15,
 *     "firstScanAt": "2025-01-01T00:00:00.000Z",
 *     "lastScanAt": "2025-12-27T10:00:00.000Z",
 *     "avgIssuesPerScan": 8.5
 *   }
 * }
 */
async function getCustomerHandler(
  request: FastifyRequest<{ Params: CustomerEmailParams }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = customerEmailParamSchema.parse(request.params);

    // Search for customer by exact email match
    const customers = await searchByEmail(params.email);

    // Find exact match (case-insensitive)
    const customer = customers.find(
      (c) => c.email.toLowerCase() === params.email.toLowerCase()
    );

    if (!customer) {
      return reply.code(404).send({
        success: false,
        error: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      });
    }

    // Transform response (serialize dates)
    const data = {
      email: customer.email,
      totalScans: customer.totalScans,
      firstScanAt: customer.firstScanAt.toISOString(),
      lastScanAt: customer.lastScanAt.toISOString(),
      avgIssuesPerScan: customer.avgIssuesPerScan,
    };

    return reply.code(200).send({
      success: true,
      data,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid customer email',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle customer service errors
    if (error instanceof CustomerServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getCustomerHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/customers/:email/scans
 *
 * Get all scans for a specific customer email.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns paginated scan list for customer
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * @param request - Fastify request with email param and query
 * @param reply - Fastify reply
 * @returns Paginated list of scans for the customer
 *
 * @example
 * GET /api/v1/admin/customers/user@example.com/scans?page=1&limit=20
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "id": "uuid",
 *         "url": "https://example.com",
 *         "status": "COMPLETED",
 *         "wcagLevel": "AA",
 *         "createdAt": "2025-12-27T10:00:00.000Z",
 *         ...
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 15,
 *       "totalPages": 1
 *     }
 *   }
 * }
 */
async function getCustomerScansHandler(
  request: FastifyRequest<{ Params: CustomerEmailParams; Querystring: { page?: number; limit?: number } }>,
  reply: FastifyReply
) {
  try {
    // Validate params
    const params = customerEmailParamSchema.parse(request.params);

    // Parse pagination parameters
    const page = request.query.page ? Number(request.query.page) : 1;
    const limit = request.query.limit ? Number(request.query.limit) : 20;

    // Get customer's scans
    const result = await getCustomerScans(params.email, { page, limit });

    // Transform response (serialize dates)
    const items = result.items.map((scan) => ({
      id: scan.id,
      url: scan.url,
      status: scan.status,
      wcagLevel: scan.wcagLevel,
      email: scan.email,
      guestSessionId: scan.guestSessionId,
      userId: scan.userId,
      createdAt: scan.createdAt.toISOString(),
      completedAt: scan.completedAt?.toISOString() ?? null,
      durationMs: scan.durationMs,
      errorMessage: scan.errorMessage,
    }));

    return reply.code(200).send({
      success: true,
      data: {
        items,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle customer service errors
    if (error instanceof CustomerServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getCustomerScansHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/customers/export
 *
 * Export customer data in CSV or JSON format.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Generates and returns export file
 *
 * Query Parameters:
 * - format: Export format ('csv' or 'json', default: 'csv')
 * - minScans: Filter by minimum scans (optional)
 * - maxScans: Filter by maximum scans (optional)
 * - startDate: Filter by date range start (optional)
 * - endDate: Filter by date range end (optional)
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns CSV or JSON file with customer data
 *
 * @example
 * GET /api/v1/admin/customers/export?format=csv&minScans=5
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * Content-Type: text/csv
 * Content-Disposition: attachment; filename="customers-2025-12-27.csv"
 *
 * email,totalScans,firstScanAt,lastScanAt,avgIssuesPerScan
 * "user@example.com",15,2025-01-01T00:00:00.000Z,2025-12-27T10:00:00.000Z,8.5
 */
async function exportCustomersHandler(
  request: FastifyRequest<{ Querystring: CustomerExportQuery }>,
  reply: FastifyReply
) {
  const admin = request.adminUser;

  if (!admin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Parse and validate query parameters
    const query = customerExportQuerySchema.parse(request.query);

    // Build filters object
    const filters: CustomerFilters = {
      ...(query.minScans && { minScans: query.minScans }),
      ...(query.maxScans && { maxScans: query.maxScans }),
      ...(query.startDate && { startDate: query.startDate }),
      ...(query.endDate && { endDate: query.endDate }),
    };

    // Generate export buffer
    const exportBuffer = await exportCustomers(query.format, filters);

    // Log audit event
    request.log.info({
      event: 'ADMIN_EXPORT_CUSTOMERS',
      adminId: admin.id,
      adminEmail: admin.email,
      format: query.format,
      filters,
      timestamp: new Date().toISOString(),
    });

    // Set appropriate headers based on format
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `customers-${timestamp}.${query.format}`;

    if (query.format === 'csv') {
      reply.header('Content-Type', 'text/csv');
    } else {
      reply.header('Content-Type', 'application/json');
    }

    reply.header('Content-Disposition', `attachment; filename="${filename}"`);

    return reply.code(200).send(exportBuffer);
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle customer service errors
    if (error instanceof CustomerServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in exportCustomersHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ==================== DASHBOARD HANDLERS ====================

/**
 * Request query type for dashboard trends
 */
type DashboardTrendsQuery = z.infer<typeof dashboardTrendsQuerySchema>;

/**
 * Request query type for dashboard top domains
 */
type DashboardDomainsQuery = z.infer<typeof dashboardDomainsQuerySchema>;

/**
 * Request query type for audit list
 */
type AuditListQuery = z.infer<typeof auditListQuerySchema>;

/**
 * Request query type for audit export
 */
type AuditExportQuery = z.infer<typeof auditExportQuerySchema>;

/**
 * GET /api/v1/admin/dashboard/metrics
 *
 * Get key dashboard metrics with Redis caching.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns dashboard metrics
 *
 * Metrics included:
 * - Scan counts (today, this week, this month, total)
 * - Success rate percentage
 * - Active guest sessions count
 * - Unique customers count
 * - Average scan duration
 *
 * Caching: 5-minute Redis cache for performance
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Dashboard metrics object
 *
 * @example
 * GET /api/v1/admin/dashboard/metrics
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "scans": {
 *       "today": 15,
 *       "thisWeek": 87,
 *       "thisMonth": 342,
 *       "total": 1543
 *     },
 *     "successRate": 94.5,
 *     "activeSessions": 23,
 *     "uniqueCustomers": 156,
 *     "avgScanDuration": 3456
 *   }
 * }
 */
async function getDashboardMetricsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const metrics = await getMetrics();

    return reply.code(200).send({
      success: true,
      data: metrics,
    });
  } catch (error) {
    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getDashboardMetricsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/dashboard/trends
 *
 * Get scan trends over time with Redis caching.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns scan trend data
 *
 * Query Parameters:
 * - days: Number of days to retrieve (default: 30, range: 1-365)
 *
 * Caching: 5-minute Redis cache for performance
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns Array of daily scan trends
 *
 * @example
 * GET /api/v1/admin/dashboard/trends?days=30
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "date": "2025-12-01",
 *       "count": 45,
 *       "successCount": 42,
 *       "failedCount": 3
 *     },
 *     ...
 *   ]
 * }
 */
async function getDashboardTrendsHandler(
  request: FastifyRequest<{ Querystring: DashboardTrendsQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate query parameters
    const query = dashboardTrendsQuerySchema.parse(request.query);

    // Get scan trends
    const trends = await getScanTrends(query.days);

    return reply.code(200).send({
      success: true,
      data: trends,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getDashboardTrendsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/dashboard/issues
 *
 * Get issue distribution by severity with Redis caching.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns issue distribution
 *
 * Caching: 5-minute Redis cache for performance
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Issue distribution by severity
 *
 * @example
 * GET /api/v1/admin/dashboard/issues
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "critical": 45,
 *     "serious": 123,
 *     "moderate": 267,
 *     "minor": 89
 *   }
 * }
 */
async function getDashboardIssuesHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const distribution = await getIssueDistribution();

    return reply.code(200).send({
      success: true,
      data: distribution,
    });
  } catch (error) {
    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getDashboardIssuesHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/dashboard/domains
 *
 * Get top scanned domains with Redis caching.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns top domains
 *
 * Query Parameters:
 * - limit: Maximum number of domains to return (default: 10, range: 1-100)
 *
 * Caching: 5-minute Redis cache for performance
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns Array of top domains
 *
 * @example
 * GET /api/v1/admin/dashboard/domains?limit=10
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "domain": "example.com",
 *       "scanCount": 45,
 *       "lastScanned": "2025-12-27T10:00:00.000Z"
 *     },
 *     ...
 *   ]
 * }
 */
async function getDashboardDomainsHandler(
  request: FastifyRequest<{ Querystring: DashboardDomainsQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate query parameters
    const query = dashboardDomainsQuerySchema.parse(request.query);

    // Get top domains
    const topDomains = await getTopDomains(query.limit);

    // Transform response (serialize dates)
    const data = topDomains.map((domain) => ({
      domain: domain.domain,
      scanCount: domain.scanCount,
      lastScanned: domain.lastScanned.toISOString(),
    }));

    return reply.code(200).send({
      success: true,
      data,
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getDashboardDomainsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/dashboard/health
 *
 * Get system health status (NO caching - real-time data).
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns system health
 *
 * Health checks:
 * - BullMQ queue metrics (scan-page, generate-report)
 * - Redis connection and latency
 * - Database connection and latency
 * - Error rate in last 24 hours
 *
 * Note: No caching to ensure real-time health status
 *
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns System health metrics
 *
 * @example
 * GET /api/v1/admin/dashboard/health
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "queues": {
 *       "scanPage": {
 *         "waiting": 5,
 *         "active": 2,
 *         "completed": 1234,
 *         "failed": 12
 *       },
 *       "generateReport": {
 *         "waiting": 1,
 *         "active": 0,
 *         "completed": 567,
 *         "failed": 3
 *       }
 *     },
 *     "redis": {
 *       "status": "ok",
 *       "latencyMs": 2
 *     },
 *     "database": {
 *       "status": "ok",
 *       "latencyMs": 5
 *     },
 *     "errorRate24h": 1.2
 *   }
 * }
 */
async function getDashboardHealthHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const health = await getSystemHealth();

    return reply.code(200).send({
      success: true,
      data: health,
    });
  } catch (error) {
    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in getDashboardHealthHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ==================== AUDIT LOG HANDLERS ====================

/**
 * GET /api/v1/admin/audit
 *
 * List audit logs with filtering and pagination.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Returns paginated audit logs
 *
 * Query Parameters:
 * - dateFrom: Filter by date range start (ISO date string)
 * - dateTo: Filter by date range end (ISO date string)
 * - adminId: Filter by specific admin user (UUID)
 * - action: Filter by specific action type
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns Paginated list of audit logs
 *
 * @example
 * GET /api/v1/admin/audit?action=UPDATE_ADMIN&page=1&limit=20
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [
 *       {
 *         "id": "uuid",
 *         "adminId": "admin-uuid",
 *         "adminEmail": "admin@example.com",
 *         "action": "UPDATE_ADMIN",
 *         "targetId": "target-uuid",
 *         "targetType": "Admin",
 *         "details": {},
 *         "ipAddress": "192.168.1.1",
 *         "userAgent": "Mozilla/5.0...",
 *         "createdAt": "2025-12-27T10:00:00.000Z"
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "totalCount": 150,
 *       "totalPages": 8
 *     }
 *   }
 * }
 */
async function listAuditLogsHandler(
  request: FastifyRequest<{ Querystring: AuditListQuery }>,
  reply: FastifyReply
) {
  try {
    // Parse and validate query parameters
    const query = auditListQuerySchema.parse(request.query);

    // Build filters object
    const filters: AuditFilters = {
      ...(query.dateFrom && { dateFrom: query.dateFrom }),
      ...(query.dateTo && { dateTo: query.dateTo }),
      ...(query.adminId && { adminId: query.adminId }),
      ...(query.action && { action: query.action }),
    };

    // Get paginated audit logs
    const result = await listAuditLogs(filters, {
      page: query.page,
      limit: query.limit,
    });

    // Transform response (serialize dates)
    const items = result.items.map((entry) => ({
      id: entry.id,
      adminId: entry.adminId,
      adminEmail: entry.adminEmail,
      action: entry.action,
      targetId: entry.targetId,
      targetType: entry.targetType,
      details: entry.details,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      createdAt: entry.createdAt.toISOString(),
    }));

    return reply.code(200).send({
      success: true,
      data: {
        items,
        pagination: {
          page: result.page,
          limit: result.limit,
          totalCount: result.totalCount,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in listAuditLogsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /api/v1/admin/audit/export
 *
 * Export audit logs to CSV or JSON format.
 *
 * Middleware chain:
 * 1. adminAuthMiddleware - Verifies JWT from cookie
 * 2. handler - Generates and returns export file
 *
 * Query Parameters:
 * - format: Export format ('csv' or 'json', default: 'csv')
 * - dateFrom: Filter by date range start (ISO date string) (optional)
 * - dateTo: Filter by date range end (ISO date string) (optional)
 * - adminId: Filter by specific admin user (UUID) (optional)
 * - action: Filter by specific action type (optional)
 *
 * @param request - Fastify request with query parameters
 * @param reply - Fastify reply
 * @returns CSV or JSON file with audit log data
 *
 * @example
 * GET /api/v1/admin/audit/export?format=csv&action=UPDATE_ADMIN
 * Cookie: adashield_admin_token=jwt-token
 *
 * Response 200:
 * Content-Type: text/csv
 * Content-Disposition: attachment; filename="audit-logs-2025-12-27.csv"
 *
 * id,adminId,adminEmail,action,targetId,targetType,ipAddress,userAgent,createdAt
 * "uuid","admin-uuid","admin@example.com","UPDATE_ADMIN","target-uuid","Admin","192.168.1.1","Mozilla/5.0...","2025-12-27T10:00:00.000Z"
 */
async function exportAuditLogsHandler(
  request: FastifyRequest<{ Querystring: AuditExportQuery }>,
  reply: FastifyReply
) {
  const admin = request.adminUser;

  if (!admin) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    // Parse and validate query parameters
    const query = auditExportQuerySchema.parse(request.query);

    // Build filters object
    const filters: AuditFilters = {
      ...(query.dateFrom && { dateFrom: query.dateFrom }),
      ...(query.dateTo && { dateTo: query.dateTo }),
      ...(query.adminId && { adminId: query.adminId }),
      ...(query.action && { action: query.action }),
    };

    // Generate export buffer
    const exportBuffer = await exportAuditLogs(filters, query.format);

    // Log audit event for export action
    const ip = getClientIP(request);
    await logAuditEvent({
      adminId: admin.id,
      action: 'EXPORT_DATA',
      targetType: 'AuditLog',
      details: {
        metadata: {
          format: query.format,
          filters,
        },
      },
      ipAddress: ip,
      userAgent: request.headers['user-agent'] ?? 'Unknown',
    });

    // Set appropriate headers based on format
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `audit-logs-${timestamp}.${query.format}`;

    if (query.format === 'csv') {
      reply.header('Content-Type', 'text/csv');
    } else {
      reply.header('Content-Type', 'application/json');
    }

    reply.header('Content-Disposition', `attachment; filename="${filename}"`);

    return reply.code(200).send(exportBuffer);
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }

    // Handle admin service errors
    if (error instanceof AdminServiceError) {
      const statusCode = getStatusCodeForAdminError(error.code);
      return reply.code(statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Handle unexpected errors
    request.log.error(error, 'Unexpected error in exportAuditLogsHandler');
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Register admin routes
 *
 * Auth endpoints:
 * - POST /api/v1/admin/auth/login - Authenticate admin
 * - POST /api/v1/admin/auth/logout - Logout admin (requires auth)
 * - GET /api/v1/admin/auth/me - Get current admin info (requires auth)
 * - PUT /api/v1/admin/auth/password - Change password (requires auth)
 *
 * User management endpoints:
 * - GET /api/v1/admin/users - List admins (requires SUPER_ADMIN)
 * - POST /api/v1/admin/users - Create admin (requires SUPER_ADMIN)
 * - GET /api/v1/admin/users/:id - Get single admin (requires SUPER_ADMIN)
 * - PUT /api/v1/admin/users/:id - Update admin (requires SUPER_ADMIN)
 * - DELETE /api/v1/admin/users/:id - Deactivate admin (requires SUPER_ADMIN)
 * - POST /api/v1/admin/users/:id/reset-password - Reset password (requires SUPER_ADMIN)
 *
 * Scan management endpoints:
 * - GET /api/v1/admin/scans - List all scans with filters (requires auth)
 * - GET /api/v1/admin/scans/:id - Get scan details (requires auth)
 * - DELETE /api/v1/admin/scans/:id - Delete scan (requires auth)
 * - POST /api/v1/admin/scans/:id/retry - Retry failed scan (requires auth)
 * - GET /api/v1/admin/scans/:id/reports - Get scan report status (requires auth)
 * - POST /api/v1/admin/reports/:scanId/:format - Generate report for any scan (requires auth)
 *
 * Customer management endpoints:
 * - GET /api/v1/admin/customers - List all customers (requires auth)
 * - GET /api/v1/admin/customers/export - Export customer data (requires auth)
 * - GET /api/v1/admin/customers/:email - Get customer details (requires auth)
 * - GET /api/v1/admin/customers/:email/scans - Get customer's scans (requires auth)
 *
 * Dashboard endpoints:
 * - GET /api/v1/admin/dashboard/metrics - Get key metrics (requires auth)
 * - GET /api/v1/admin/dashboard/trends - Get scan trends (requires auth)
 * - GET /api/v1/admin/dashboard/issues - Get issue distribution (requires auth)
 * - GET /api/v1/admin/dashboard/domains - Get top domains (requires auth)
 * - GET /api/v1/admin/dashboard/health - Get system health (requires auth)
 *
 * Audit log endpoints:
 * - GET /api/v1/admin/audit - List audit logs with filters (requires auth)
 * - GET /api/v1/admin/audit/export - Export audit logs (requires auth)
 *
 * @param fastify - Fastify instance
 * @param prefix - API prefix (e.g., '/api/v1')
 */
export async function registerAdminRoutes(
  fastify: FastifyInstance,
  prefix: string
): Promise<void> {
  // ==================== AUTH ROUTES ====================

  // POST /api/v1/admin/auth/login
  fastify.post(
    `${prefix}/admin/auth/login`,
    {
      preHandler: [loginRateLimitMiddleware],
    },
    loginHandler as any
  );

  // POST /api/v1/admin/auth/logout
  fastify.post(
    `${prefix}/admin/auth/logout`,
    {
      preHandler: [adminAuthMiddleware],
    },
    logoutHandler as any
  );

  // GET /api/v1/admin/auth/me
  fastify.get(
    `${prefix}/admin/auth/me`,
    {
      preHandler: [adminAuthMiddleware],
    },
    meHandler as any
  );

  // PUT /api/v1/admin/auth/password
  fastify.put(
    `${prefix}/admin/auth/password`,
    {
      preHandler: [adminAuthMiddleware],
    },
    changePasswordHandler as any
  );

  // ==================== USER MANAGEMENT ROUTES ====================

  // GET /api/v1/admin/users - List all admins (SUPER_ADMIN only)
  fastify.get(
    `${prefix}/admin/users`,
    {
      preHandler: [adminAuthMiddleware, requireSuperAdmin],
    },
    listAdminsHandler as any
  );

  // POST /api/v1/admin/users - Create new admin (SUPER_ADMIN only)
  fastify.post(
    `${prefix}/admin/users`,
    {
      preHandler: [adminAuthMiddleware, requireSuperAdmin],
    },
    createAdminHandler as any
  );

  // GET /api/v1/admin/users/:id - Get single admin (SUPER_ADMIN only)
  fastify.get(
    `${prefix}/admin/users/:id`,
    {
      preHandler: [adminAuthMiddleware, requireSuperAdmin],
    },
    getAdminHandler as any
  );

  // PUT /api/v1/admin/users/:id - Update admin (SUPER_ADMIN only)
  fastify.put(
    `${prefix}/admin/users/:id`,
    {
      preHandler: [adminAuthMiddleware, requireSuperAdmin],
    },
    updateAdminHandler as any
  );

  // DELETE /api/v1/admin/users/:id - Deactivate admin (SUPER_ADMIN only)
  fastify.delete(
    `${prefix}/admin/users/:id`,
    {
      preHandler: [adminAuthMiddleware, requireSuperAdmin],
    },
    deactivateAdminHandler as any
  );

  // POST /api/v1/admin/users/:id/reset-password - Reset password (SUPER_ADMIN only)
  fastify.post(
    `${prefix}/admin/users/:id/reset-password`,
    {
      preHandler: [adminAuthMiddleware, requireSuperAdmin],
    },
    resetPasswordHandler as any
  );

  // ==================== SCAN MANAGEMENT ROUTES ====================

  // GET /api/v1/admin/scans - List all scans (requires admin auth)
  fastify.get(
    `${prefix}/admin/scans`,
    {
      preHandler: [adminAuthMiddleware],
    },
    listScansHandler as any
  );

  // GET /api/v1/admin/scans/:id - Get scan details (requires admin auth)
  fastify.get(
    `${prefix}/admin/scans/:id`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getScanDetailsHandler as any
  );

  // DELETE /api/v1/admin/scans/:id - Delete scan (requires admin auth)
  fastify.delete(
    `${prefix}/admin/scans/:id`,
    {
      preHandler: [adminAuthMiddleware],
    },
    deleteScanHandler as any
  );

  // POST /api/v1/admin/scans/:id/retry - Retry failed scan (requires admin auth)
  fastify.post(
    `${prefix}/admin/scans/:id/retry`,
    {
      preHandler: [adminAuthMiddleware],
    },
    retryScanHandler as any
  );

  // GET /api/v1/admin/scans/:id/reports - Get scan report status (requires admin auth)
  fastify.get(
    `${prefix}/admin/scans/:id/reports`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getScanReportsHandler as any
  );

  // POST /api/v1/admin/reports/:scanId/:format - Generate report for any scan (requires admin auth)
  fastify.post(
    `${prefix}/admin/reports/:scanId/:format`,
    {
      preHandler: [adminAuthMiddleware],
    },
    generateReportHandler as any
  );

  // ==================== CUSTOMER MANAGEMENT ROUTES ====================

  // GET /api/v1/admin/customers - List all customers (requires admin auth)
  fastify.get(
    `${prefix}/admin/customers`,
    {
      preHandler: [adminAuthMiddleware],
    },
    listCustomersHandler as any
  );

  // IMPORTANT: Register export route BEFORE :email route to avoid route conflicts
  // GET /api/v1/admin/customers/export - Export customer data (requires admin auth)
  fastify.get(
    `${prefix}/admin/customers/export`,
    {
      preHandler: [adminAuthMiddleware],
    },
    exportCustomersHandler as any
  );

  // GET /api/v1/admin/customers/:email - Get customer details (requires admin auth)
  fastify.get(
    `${prefix}/admin/customers/:email`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getCustomerHandler as any
  );

  // GET /api/v1/admin/customers/:email/scans - Get customer's scans (requires admin auth)
  fastify.get(
    `${prefix}/admin/customers/:email/scans`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getCustomerScansHandler as any
  );

  // ==================== DASHBOARD ROUTES ====================

  // GET /api/v1/admin/dashboard/metrics - Get key metrics (requires admin auth)
  fastify.get(
    `${prefix}/admin/dashboard/metrics`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getDashboardMetricsHandler as any
  );

  // GET /api/v1/admin/dashboard/trends - Get scan trends (requires admin auth)
  fastify.get(
    `${prefix}/admin/dashboard/trends`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getDashboardTrendsHandler as any
  );

  // GET /api/v1/admin/dashboard/issues - Get issue distribution (requires admin auth)
  fastify.get(
    `${prefix}/admin/dashboard/issues`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getDashboardIssuesHandler as any
  );

  // GET /api/v1/admin/dashboard/domains - Get top domains (requires admin auth)
  fastify.get(
    `${prefix}/admin/dashboard/domains`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getDashboardDomainsHandler as any
  );

  // GET /api/v1/admin/dashboard/health - Get system health (requires admin auth)
  fastify.get(
    `${prefix}/admin/dashboard/health`,
    {
      preHandler: [adminAuthMiddleware],
    },
    getDashboardHealthHandler as any
  );

  // ==================== AUDIT LOG ROUTES ====================

  // IMPORTANT: Register /export route BEFORE the list route to avoid route conflicts
  // GET /api/v1/admin/audit/export - Export audit logs (requires admin auth)
  fastify.get(
    `${prefix}/admin/audit/export`,
    {
      preHandler: [adminAuthMiddleware],
    },
    exportAuditLogsHandler as any
  );

  // GET /api/v1/admin/audit - List audit logs (requires admin auth)
  fastify.get(
    `${prefix}/admin/audit`,
    {
      preHandler: [adminAuthMiddleware],
    },
    listAuditLogsHandler as any
  );

  fastify.log.info('✅ Admin routes registered (auth + user management + scan management + customer management + dashboard + audit logs)');
}
