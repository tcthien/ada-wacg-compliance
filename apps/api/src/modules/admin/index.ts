/**
 * Admin Module
 *
 * Exports all admin-related functionality for external use.
 * This module provides authentication and user management for admin dashboard.
 */

// Controller exports
export { registerAdminRoutes } from './admin.controller.js';
export { registerBatchAdminRoutes } from './batch-admin.controller.js';

// Service exports
export {
  login,
  logout,
  verifyToken,
  hashPassword,
  verifyPassword,
  generateToken,
  isTokenBlacklisted,
  AdminServiceError,
} from './admin.service.js';

// Repository exports
export {
  findByEmail,
  findById,
  create,
  update,
  listAdmins,
  AdminRepositoryError,
} from './admin.repository.js';

// Middleware exports
export {
  adminAuthMiddleware,
  requireSuperAdmin,
  loginRateLimitMiddleware,
  recordFailedLogin,
  clearLoginAttempts,
  getClientIP,
  ADMIN_COOKIE_NAME,
  LOGIN_RATE_LIMIT,
} from './admin.middleware.js';

// Schema exports
export {
  loginSchema,
  passwordSchema,
  createAdminSchema,
  updateAdminSchema,
  changePasswordSchema,
  paginationSchema,
  adminIdParamSchema,
  AdminRoleSchema,
} from './admin.schema.js';

// Type exports
export type {
  AdminTokenPayload,
  AdminErrorCode,
  CreateAdminInput,
  UpdateAdminInput,
  LoginResult,
  AuditAction,
  AuditDetails,
  CreateAuditInput,
} from './admin.types.js';

// Type guard exports
export {
  isAdminRole,
  isAuditAction,
  isAdminErrorCode,
} from './admin.types.js';
