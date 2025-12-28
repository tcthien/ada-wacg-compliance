/**
 * Admin Controller Integration Tests
 *
 * Integration tests for admin API endpoints covering:
 * - Authentication flow (login, logout, me)
 * - Rate limiting
 * - Protected routes with auth middleware
 * - Admin user CRUD operations
 *
 * Covers Requirements 1.1, 1.2, 1.3, 2.1 from admin-module specification.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import type { Admin, AdminRole } from '@prisma/client';

// Mock modules with factory functions - must be at top level
vi.mock('../admin.repository.js', () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  listAdmins: vi.fn(),
}));

vi.mock('../../config/redis.js', () => ({
  getRedisClient: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
    TokenExpiredError: class TokenExpiredError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'TokenExpiredError';
      }
    },
    JsonWebTokenError: class JsonWebTokenError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'JsonWebTokenError';
      }
    },
  },
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(),
}));

// Import controller after mocking
import { registerAdminRoutes } from '../admin.controller.js';

describe('Admin Controller Integration Tests', () => {
  let fastify: FastifyInstance;
  let mockRedisClient: any;
  let adminRepository: any;
  let getRedisClient: any;
  let bcrypt: any;
  let jwt: any;
  let randomUUID: any;

  // Test data
  const mockAdmin: Admin = {
    id: 'admin-123',
    email: 'admin@example.com',
    passwordHash: '$2b$12$hashedpassword',
    role: 'ADMIN' as AdminRole,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    lastLoginAt: null,
    createdById: null,
  };

  const mockSuperAdmin: Admin = {
    id: 'super-admin-123',
    email: 'super@example.com',
    passwordHash: '$2b$12$hashedpassword',
    role: 'SUPER_ADMIN' as AdminRole,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    lastLoginAt: null,
    createdById: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked module references
    adminRepository = await import('../admin.repository.js');
    const redisModule = await import('../../config/redis.js');
    getRedisClient = redisModule.getRedisClient;
    const bcryptModule = await import('bcrypt');
    bcrypt = bcryptModule.default;
    const jwtModule = await import('jsonwebtoken');
    jwt = jwtModule.default;
    const cryptoModule = await import('node:crypto');
    randomUUID = cryptoModule.randomUUID;

    // Setup Redis mock
    mockRedisClient = {
      setex: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue(null),
      ttl: vi.fn().mockResolvedValue(900),
    };
    vi.mocked(getRedisClient).mockReturnValue(mockRedisClient);
    vi.mocked(randomUUID).mockReturnValue('test-uuid-123');

    // Setup bcrypt mocks
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$hashedpassword' as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    // Setup JWT mocks
    vi.mocked(jwt.sign).mockReturnValue('valid-jwt-token' as never);
    vi.mocked(jwt.verify).mockReturnValue({
      sub: mockAdmin.id,
      email: mockAdmin.email,
      role: mockAdmin.role,
      jti: 'test-uuid-123',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never);

    // Create fresh Fastify instance
    fastify = Fastify({
      logger: false, // Disable logging in tests
    });

    // Register cookie plugin
    await fastify.register(fastifyCookie);

    // Register admin routes
    await registerAdminRoutes(fastify, '/api/v1');

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/admin/auth/login', () => {
    it('should login with valid credentials and return JWT cookie (Requirement 1.1)', async () => {
      // Setup mocks
      vi.mocked(adminRepository.findByEmail).mockResolvedValue(mockAdmin);
      vi.mocked(adminRepository.update).mockResolvedValue({
        ...mockAdmin,
        lastLoginAt: new Date(),
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'SecureP@ssw0rd',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.admin).toEqual({
        id: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
        mustChangePassword: false,
      });
      expect(body.data.expiresAt).toBeDefined();

      // Verify JWT token is set in cookie
      const cookies = response.cookies;
      expect(cookies).toHaveLength(1);
      expect(cookies[0]?.name).toBe('adashield_admin_token');
      expect(cookies[0]?.value).toBe('valid-jwt-token');
      expect(cookies[0]?.httpOnly).toBe(true);

      // Verify token expiration is 24 hours (Requirement 1.1)
      const expiresAt = new Date(body.data.expiresAt);
      const expectedExpiration = new Date();
      expectedExpiration.setHours(expectedExpiration.getHours() + 24);
      expect(Math.abs(expiresAt.getTime() - expectedExpiration.getTime())).toBeLessThan(
        2000
      ); // Within 2 seconds
    });

    it('should return 401 for invalid email (Requirement 1.2)', async () => {
      // Setup mocks
      vi.mocked(adminRepository.findByEmail).mockResolvedValue(null);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_CREDENTIALS');
      expect(body.error).toBe('Invalid email or password'); // Doesn't reveal which field is wrong
    });

    it('should return 401 for invalid password (Requirement 1.2)', async () => {
      // Setup mocks
      vi.mocked(adminRepository.findByEmail).mockResolvedValue(mockAdmin);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'wrong-password',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_CREDENTIALS');
      expect(body.error).toBe('Invalid email or password'); // Doesn't reveal which field is wrong
    });

    it('should return 401 for deactivated account', async () => {
      const deactivatedAdmin = { ...mockAdmin, isActive: false };
      vi.mocked(adminRepository.findByEmail).mockResolvedValue(deactivatedAdmin);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('ACCOUNT_DEACTIVATED');
    });

    it('should rate limit after 5 failed attempts', async () => {
      // Setup mock to simulate rate limit
      mockRedisClient.get.mockResolvedValue('5'); // 5 attempts already

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TOO_MANY_REQUESTS');
      expect(body.error).toContain('Too many login attempts');
      expect(response.headers['retry-after']).toBeDefined();
    });
  });

  describe('POST /api/v1/admin/auth/logout', () => {
    it('should logout and blacklist token', async () => {
      // Setup valid token
      vi.mocked(adminRepository.findById).mockResolvedValue(mockAdmin);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/logout',
        cookies: {
          adashield_admin_token: 'valid-jwt-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Logged out successfully');

      // Verify token was blacklisted in Redis
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('test-uuid-123'),
        86400, // 24 hours in seconds
        '1'
      );

      // Verify cookie was cleared
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      if (typeof setCookieHeader === 'string') {
        expect(setCookieHeader).toContain('adashield_admin_token=');
        expect(setCookieHeader).toContain('Max-Age=0');
      } else if (Array.isArray(setCookieHeader)) {
        const clearCookie = setCookieHeader.find((c) =>
          c.includes('adashield_admin_token')
        );
        expect(clearCookie).toContain('Max-Age=0');
      }
    });

    it('should return 401 without valid token', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/logout',
        // No cookie
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/admin/auth/me', () => {
    it('should return current admin info with valid token', async () => {
      // Setup valid token
      vi.mocked(adminRepository.findById).mockResolvedValue(mockAdmin);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        cookies: {
          adashield_admin_token: 'valid-jwt-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        id: mockAdmin.id,
        email: mockAdmin.email,
        role: mockAdmin.role,
        isActive: mockAdmin.isActive,
        mustChangePassword: mockAdmin.mustChangePassword,
        lastLoginAt: null,
        createdAt: mockAdmin.createdAt.toISOString(),
      });
    });

    it('should return 401 without valid token', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        // No cookie
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when token is expired (Requirement 1.3)', async () => {
      // Setup expired token
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        cookies: {
          adashield_admin_token: 'expired-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TOKEN_EXPIRED');
    });

    it('should return 401 when token is blacklisted', async () => {
      // Setup blacklisted token
      mockRedisClient.get.mockResolvedValue('1'); // Token is blacklisted
      vi.mocked(adminRepository.findById).mockResolvedValue(mockAdmin);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        cookies: {
          adashield_admin_token: 'blacklisted-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('TOKEN_BLACKLISTED');
    });
  });

  describe('POST /api/v1/admin/users', () => {
    it('should create new admin with SUPER_ADMIN role (Requirement 2.1)', async () => {
      // Setup super admin authentication
      vi.mocked(jwt.verify).mockReturnValue({
        sub: mockSuperAdmin.id,
        email: mockSuperAdmin.email,
        role: mockSuperAdmin.role,
        jti: 'super-admin-token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      } as never);
      vi.mocked(adminRepository.findById).mockResolvedValue(mockSuperAdmin);

      const newAdmin = {
        id: 'new-admin-123',
        email: 'newadmin@example.com',
        passwordHash: '$2b$12$newhash',
        role: 'ADMIN' as AdminRole,
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        createdById: mockSuperAdmin.id,
      };
      vi.mocked(adminRepository.create).mockResolvedValue(newAdmin);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        cookies: {
          adashield_admin_token: 'super-admin-token',
        },
        payload: {
          email: 'newadmin@example.com',
          password: 'SecureP@ssw0rd123',
          role: 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('newadmin@example.com');
      expect(body.data.role).toBe('ADMIN');
      expect(body.data.mustChangePassword).toBe(true);

      // Verify password was hashed (Requirement 2.1)
      expect(bcrypt.hash).toHaveBeenCalledWith('SecureP@ssw0rd123', 12);
    });

    it('should return 403 when non-SUPER_ADMIN tries to create admin', async () => {
      // Setup regular admin authentication
      vi.mocked(adminRepository.findById).mockResolvedValue(mockAdmin);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        cookies: {
          adashield_admin_token: 'admin-token',
        },
        payload: {
          email: 'newadmin@example.com',
          password: 'SecureP@ssw0rd123',
          role: 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('should return 401 without authentication', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/users',
        // No cookie
        payload: {
          email: 'newadmin@example.com',
          password: 'SecureP@ssw0rd123',
          role: 'ADMIN',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('should list admins with SUPER_ADMIN authentication', async () => {
      // Setup super admin authentication
      vi.mocked(jwt.verify).mockReturnValue({
        sub: mockSuperAdmin.id,
        email: mockSuperAdmin.email,
        role: mockSuperAdmin.role,
        jti: 'super-admin-token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      } as never);
      vi.mocked(adminRepository.findById).mockResolvedValue(mockSuperAdmin);
      vi.mocked(adminRepository.listAdmins).mockResolvedValue({
        items: [mockAdmin, mockSuperAdmin],
        totalCount: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/users?page=1&limit=20',
        cookies: {
          adashield_admin_token: 'super-admin-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        totalCount: 2,
        totalPages: 1,
      });
    });

    it('should return 403 when non-SUPER_ADMIN tries to list admins', async () => {
      // Setup regular admin authentication
      vi.mocked(adminRepository.findById).mockResolvedValue(mockAdmin);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/users',
        cookies: {
          adashield_admin_token: 'admin-token',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('should return 401 without authentication', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/users',
        // No cookie
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authentication flow integration', () => {
    it('should complete full auth flow: login → access protected route → logout', async () => {
      // Step 1: Login
      vi.mocked(adminRepository.findByEmail).mockResolvedValue(mockAdmin);
      vi.mocked(adminRepository.update).mockResolvedValue({
        ...mockAdmin,
        lastLoginAt: new Date(),
      });

      const loginResponse = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'admin@example.com',
          password: 'SecureP@ssw0rd',
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      const token = loginResponse.cookies.find((c) => c.name === 'adashield_admin_token')
        ?.value;
      expect(token).toBeDefined();

      // Step 2: Access protected route
      vi.mocked(adminRepository.findById).mockResolvedValue(mockAdmin);

      const meResponse = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        cookies: {
          adashield_admin_token: token!,
        },
      });

      expect(meResponse.statusCode).toBe(200);
      const meBody = JSON.parse(meResponse.body);
      expect(meBody.data.email).toBe('admin@example.com');

      // Step 3: Logout
      const logoutResponse = await fastify.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/logout',
        cookies: {
          adashield_admin_token: token!,
        },
      });

      expect(logoutResponse.statusCode).toBe(200);

      // Step 4: Verify token is blacklisted
      mockRedisClient.get.mockResolvedValue('1'); // Token is blacklisted

      const meAfterLogoutResponse = await fastify.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        cookies: {
          adashield_admin_token: token!,
        },
      });

      expect(meAfterLogoutResponse.statusCode).toBe(401);
    });
  });
});
