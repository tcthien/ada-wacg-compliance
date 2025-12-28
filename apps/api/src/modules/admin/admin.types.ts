import type { AdminRole } from '@prisma/client';

/**
 * Admin Module Type Definitions
 *
 * This module provides type definitions for the admin authentication and management system.
 * All types follow the project's type-safety patterns and integrate with Prisma schema.
 */

/**
 * JWT payload for admin authentication tokens
 *
 * Contains essential claims for admin session management and authorization.
 * Used by JWT middleware to validate and decode admin access tokens.
 *
 * @property sub - Subject claim: admin user ID
 * @property email - Admin user email address
 * @property role - Admin role for authorization (ADMIN, SUPER_ADMIN)
 * @property iat - Issued at timestamp (seconds since epoch)
 * @property exp - Expiration timestamp (seconds since epoch)
 *
 * @example
 * ```ts
 * const payload: AdminTokenPayload = {
 *   sub: 'admin_abc123',
 *   email: 'admin@example.com',
 *   role: 'SUPER_ADMIN',
 *   iat: 1234567890,
 *   exp: 1234657890
 * };
 * ```
 */
export interface AdminTokenPayload {
  /** Admin user ID */
  sub: string;
  /** Admin email address */
  email: string;
  /** Admin role for authorization */
  role: AdminRole;
  /** Issued at timestamp (seconds since epoch) */
  iat: number;
  /** Expiration timestamp (seconds since epoch) */
  exp: number;
}

/**
 * Error codes for admin operations
 *
 * Standardized error codes for admin authentication and management failures.
 * Used for consistent error handling and client-side error messaging.
 *
 * @example
 * ```ts
 * throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
 * ```
 */
export type AdminErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DEACTIVATED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_BLACKLISTED'
  | 'UNAUTHORIZED'
  | 'ADMIN_NOT_FOUND'
  | 'EMAIL_EXISTS'
  | 'INVALID_PASSWORD'
  | 'RATE_LIMITED';

/**
 * Input for creating a new admin user
 *
 * Used by super admins to create new admin accounts.
 * Password will be hashed using bcrypt before storage.
 *
 * @property email - Admin email address (unique)
 * @property password - Plain text password (will be hashed)
 * @property role - Admin role (defaults to ADMIN if not specified)
 *
 * @example
 * ```ts
 * const input: CreateAdminInput = {
 *   email: 'newadmin@example.com',
 *   password: 'SecureP@ssw0rd',
 *   role: 'ADMIN'
 * };
 * ```
 */
export interface CreateAdminInput {
  /** Admin email address (must be unique) */
  email: string;
  /** Plain text password (will be hashed before storage) */
  password: string;
  /** Admin role (defaults to ADMIN) */
  role?: AdminRole;
}

/**
 * Input for updating an existing admin user
 *
 * All fields are optional for partial updates.
 * Password updates are handled separately via password change endpoint.
 *
 * @property email - New email address
 * @property role - New admin role
 * @property isActive - Active status (false = deactivate account)
 *
 * @example
 * ```ts
 * const update: UpdateAdminInput = {
 *   role: 'SUPER_ADMIN',
 *   isActive: true
 * };
 * ```
 */
export interface UpdateAdminInput {
  /** New email address */
  email?: string;
  /** New admin role */
  role?: AdminRole;
  /** Active status (false = deactivate) */
  isActive?: boolean;
}

/**
 * Login result returned to client
 *
 * Contains admin user information and session metadata.
 * Token is sent via httpOnly cookie, not in response body.
 *
 * @property admin - Admin user information
 * @property admin.id - Admin user ID
 * @property admin.email - Admin email address
 * @property admin.role - Admin role
 * @property admin.mustChangePassword - Whether admin must change password on next login
 * @property expiresAt - Token expiration timestamp
 *
 * @example
 * ```ts
 * const result: LoginResult = {
 *   admin: {
 *     id: 'admin_abc123',
 *     email: 'admin@example.com',
 *     role: 'SUPER_ADMIN',
 *     mustChangePassword: false
 *   },
 *   expiresAt: new Date('2025-12-28T00:00:00Z')
 * };
 * ```
 */
export interface LoginResult {
  /** Admin user information */
  admin: {
    /** Admin user ID */
    id: string;
    /** Admin email address */
    email: string;
    /** Admin role */
    role: AdminRole;
    /** Whether admin must change password */
    mustChangePassword: boolean;
  };
  /** Token expiration timestamp */
  expiresAt: Date;
}

/**
 * Audit action types for admin activity logging
 *
 * Represents all auditable admin actions in the system.
 * Used for compliance, security monitoring, and troubleshooting.
 *
 * @example
 * ```ts
 * const action: AuditAction = 'CREATE_ADMIN';
 * ```
 */
export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE_ADMIN'
  | 'UPDATE_ADMIN'
  | 'DEACTIVATE_ADMIN'
  | 'RESET_PASSWORD'
  | 'CHANGE_PASSWORD'
  | 'DELETE_SCAN'
  | 'RETRY_SCAN'
  | 'EXPORT_DATA';

/**
 * Audit log details (stored as JSON in database)
 *
 * Flexible structure for storing action-specific metadata.
 * All fields are optional to accommodate different action types.
 *
 * @property targetId - ID of the affected resource
 * @property targetType - Type of the affected resource (e.g., 'Admin', 'Scan')
 * @property changes - Field-level changes with before/after values
 * @property metadata - Additional action-specific metadata
 *
 * @example
 * ```ts
 * const details: AuditDetails = {
 *   targetId: 'admin_xyz789',
 *   targetType: 'Admin',
 *   changes: {
 *     role: { from: 'ADMIN', to: 'SUPER_ADMIN' },
 *     isActive: { from: true, to: false }
 *   },
 *   metadata: {
 *     reason: 'Promotion to super admin',
 *     approvedBy: 'admin_abc123'
 *   }
 * };
 * ```
 */
export interface AuditDetails {
  /** ID of the affected resource */
  targetId?: string;
  /** Type of the affected resource */
  targetType?: string;
  /** Field-level changes with before/after values */
  changes?: Record<string, { from: unknown; to: unknown }>;
  /** Additional action-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating an audit log entry
 *
 * Used internally by the audit service to log admin actions.
 * All admin actions should be logged for compliance and security.
 *
 * @property adminId - ID of the admin performing the action
 * @property action - Type of action being logged
 * @property targetId - Optional ID of affected resource
 * @property targetType - Optional type of affected resource
 * @property details - Optional action-specific details
 * @property ipAddress - Client IP address
 * @property userAgent - Client user agent string
 *
 * @example
 * ```ts
 * const auditInput: CreateAuditInput = {
 *   adminId: 'admin_abc123',
 *   action: 'UPDATE_ADMIN',
 *   targetId: 'admin_xyz789',
 *   targetType: 'Admin',
 *   details: {
 *     changes: {
 *       role: { from: 'ADMIN', to: 'SUPER_ADMIN' }
 *     }
 *   },
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...'
 * };
 * ```
 */
export interface CreateAuditInput {
  /** ID of the admin performing the action */
  adminId: string;
  /** Type of action being logged */
  action: AuditAction;
  /** Optional ID of affected resource */
  targetId?: string;
  /** Optional type of affected resource */
  targetType?: string;
  /** Optional action-specific details */
  details?: AuditDetails;
  /** Client IP address */
  ipAddress: string;
  /** Client user agent string */
  userAgent: string;
}

/**
 * Type guard to check if a value is a valid AdminRole
 *
 * @param value - Value to check
 * @returns True if value is a valid AdminRole
 *
 * @example
 * ```ts
 * if (isAdminRole(input)) {
 *   // TypeScript knows input is 'ADMIN' | 'SUPER_ADMIN'
 *   console.log(`Valid admin role: ${input}`);
 * }
 * ```
 */
export function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === 'string' && (value === 'ADMIN' || value === 'SUPER_ADMIN')
  );
}

/**
 * Type guard to check if a value is a valid AuditAction
 *
 * @param value - Value to check
 * @returns True if value is a valid AuditAction
 *
 * @example
 * ```ts
 * if (isAuditAction(input)) {
 *   // TypeScript knows input is a valid AuditAction
 *   console.log(`Valid audit action: ${input}`);
 * }
 * ```
 */
export function isAuditAction(value: unknown): value is AuditAction {
  return (
    typeof value === 'string' &&
    (value === 'LOGIN' ||
      value === 'LOGOUT' ||
      value === 'CREATE_ADMIN' ||
      value === 'UPDATE_ADMIN' ||
      value === 'DEACTIVATE_ADMIN' ||
      value === 'RESET_PASSWORD' ||
      value === 'CHANGE_PASSWORD' ||
      value === 'DELETE_SCAN' ||
      value === 'RETRY_SCAN' ||
      value === 'EXPORT_DATA')
  );
}

/**
 * Type guard to check if a value is a valid AdminErrorCode
 *
 * @param value - Value to check
 * @returns True if value is a valid AdminErrorCode
 *
 * @example
 * ```ts
 * if (isAdminErrorCode(code)) {
 *   // TypeScript knows code is a valid AdminErrorCode
 *   console.log(`Valid error code: ${code}`);
 * }
 * ```
 */
export function isAdminErrorCode(value: unknown): value is AdminErrorCode {
  return (
    typeof value === 'string' &&
    (value === 'INVALID_CREDENTIALS' ||
      value === 'ACCOUNT_DEACTIVATED' ||
      value === 'TOKEN_EXPIRED' ||
      value === 'TOKEN_BLACKLISTED' ||
      value === 'UNAUTHORIZED' ||
      value === 'ADMIN_NOT_FOUND' ||
      value === 'EMAIL_EXISTS' ||
      value === 'INVALID_PASSWORD' ||
      value === 'RATE_LIMITED')
  );
}
