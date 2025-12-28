/**
 * Admin Service Unit Tests
 *
 * Tests for admin authentication, token management, and CRUD operations.
 * Covers Requirements 1.1, 1.2, and 2.1 from admin-module specification.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AdminRole } from '@prisma/client';
import type { AdminTokenPayload } from '../admin.types.js';

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

// Import service after mocking
import {
  login,
  logout,
  verifyToken,
  hashPassword,
  verifyPassword,
  generateToken,
  isTokenBlacklisted,
  AdminServiceError,
} from '../admin.service.js';

describe('Admin Service', () => {
  let mockRedisClient: any;
  let adminRepository: any;
  let getRedisClient: any;
  let bcrypt: any;
  let jwt: any;
  let randomUUID: any;

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
    };
    vi.mocked(getRedisClient).mockReturnValue(mockRedisClient);
    vi.mocked(randomUUID).mockReturnValue('test-uuid-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt with cost 12', async () => {
      const password = 'SecureP@ssw0rd';
      const hash = '$2b$12$hashedpassword';

      bcrypt.hash.mockResolvedValue(hash as never);

      const result = await hashPassword(password);

      expect(result).toBe(hash);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should throw AdminServiceError if hashing fails', async () => {
      const password = 'password';
      const error = new Error('Hashing failed');

      bcrypt.hash.mockRejectedValue(error);

      await expect(hashPassword(password)).rejects.toThrow(AdminServiceError);
      await expect(hashPassword(password)).rejects.toThrow('Failed to hash password');

      const thrownError = await hashPassword(password).catch((e) => e);
      expect(thrownError.code).toBe('INVALID_PASSWORD');
      expect(thrownError.cause).toBe(error);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching password', async () => {
      const password = 'password';
      const hash = '$2b$12$hashedpassword';

      bcrypt.compare.mockResolvedValue(true as never);

      const result = await verifyPassword(password, hash);

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
    });

    it('should return false for non-matching password', async () => {
      const password = 'wrong-password';
      const hash = '$2b$12$hashedpassword';

      bcrypt.compare.mockResolvedValue(false as never);

      const result = await verifyPassword(password, hash);

      expect(result).toBe(false);
    });

    it('should throw AdminServiceError if verification fails', async () => {
      const password = 'password';
      const hash = 'invalid-hash';
      const error = new Error('Verification failed');

      bcrypt.compare.mockRejectedValue(error);

      await expect(verifyPassword(password, hash)).rejects.toThrow(AdminServiceError);
      await expect(verifyPassword(password, hash)).rejects.toThrow(
        'Failed to verify password'
      );

      const thrownError = await verifyPassword(password, hash).catch((e) => e);
      expect(thrownError.code).toBe('INVALID_PASSWORD');
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload', () => {
      const adminId = 'admin-123';
      const email = 'admin@example.com';
      const role: AdminRole = 'ADMIN';
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

      jwt.sign.mockReturnValue(token as never);

      const result = generateToken(adminId, email, role);

      expect(result).toBe(token);
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          sub: adminId,
          email,
          role,
          jti: 'test-uuid-123',
        },
        expect.any(String), // JWT_SECRET
        { expiresIn: '24h' }
      );
    });

    it('should generate token for SUPER_ADMIN role', () => {
      const token = 'token-123';
      jwt.sign.mockReturnValue(token as never);

      const result = generateToken('admin-456', 'super@example.com', 'SUPER_ADMIN');

      expect(result).toBe(token);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'SUPER_ADMIN' }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('login', () => {
    it('should authenticate admin with valid credentials (Requirement 1.1)', async () => {
      const email = 'admin@example.com';
      const password = 'SecureP@ssw0rd';
      const mockAdmin = {
        id: 'admin-123',
        email: email.toLowerCase(),
        passwordHash: '$2b$12$hashedpassword',
        role: 'ADMIN' as AdminRole,
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        createdById: null,
      };

      adminRepository.findByEmail.mockResolvedValue(mockAdmin);
      bcrypt.compare.mockResolvedValue(true as never);
      adminRepository.update.mockResolvedValue({
        ...mockAdmin,
        lastLoginAt: new Date(),
      } as never);

      const result = await login(email, password);

      expect(result).toEqual({
        admin: {
          id: mockAdmin.id,
          email: mockAdmin.email,
          role: mockAdmin.role,
          mustChangePassword: false,
        },
        expiresAt: expect.any(Date),
      });

      // Verify token expiration is 24 hours from now (Requirement 1.1)
      const expiresAt = result.expiresAt;
      const expectedExpiration = new Date();
      expectedExpiration.setHours(expectedExpiration.getHours() + 24);
      expect(Math.abs(expiresAt.getTime() - expectedExpiration.getTime())).toBeLessThan(
        1000
      ); // Within 1 second

      expect(adminRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockAdmin.passwordHash);
      expect(adminRepository.update).toHaveBeenCalledWith(mockAdmin.id, {
        lastLoginAt: expect.any(Date),
      });
    });

    it('should return 401 for invalid email without revealing which field (Requirement 1.2)', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password';

      adminRepository.findByEmail.mockResolvedValue(null);

      await expect(login(email, password)).rejects.toThrow(AdminServiceError);
      await expect(login(email, password)).rejects.toThrow('Invalid email or password');

      const error = await login(email, password).catch((e) => e);
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid password without revealing which field (Requirement 1.2)', async () => {
      const email = 'admin@example.com';
      const password = 'wrong-password';
      const mockAdmin = {
        id: 'admin-123',
        email,
        passwordHash: '$2b$12$hashedpassword',
        role: 'ADMIN' as AdminRole,
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        createdById: null,
      };

      adminRepository.findByEmail.mockResolvedValue(mockAdmin);
      bcrypt.compare.mockResolvedValue(false as never);

      await expect(login(email, password)).rejects.toThrow(AdminServiceError);
      await expect(login(email, password)).rejects.toThrow('Invalid email or password');

      const error = await login(email, password).catch((e) => e);
      expect(error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for deactivated account', async () => {
      const email = 'deactivated@example.com';
      const password = 'password';
      const mockAdmin = {
        id: 'admin-deactivated',
        email,
        passwordHash: '$2b$12$hashedpassword',
        role: 'ADMIN' as AdminRole,
        isActive: false, // Account is deactivated
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        createdById: null,
      };

      adminRepository.findByEmail.mockResolvedValue(mockAdmin);

      await expect(login(email, password)).rejects.toThrow(AdminServiceError);
      await expect(login(email, password)).rejects.toThrow('Account has been deactivated');

      const error = await login(email, password).catch((e) => e);
      expect(error.code).toBe('ACCOUNT_DEACTIVATED');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return mustChangePassword flag correctly', async () => {
      const email = 'newadmin@example.com';
      const password = 'TempP@ssw0rd';
      const mockAdmin = {
        id: 'admin-new',
        email,
        passwordHash: '$2b$12$hashedpassword',
        role: 'ADMIN' as AdminRole,
        isActive: true,
        mustChangePassword: true, // New admin must change password
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        createdById: 'creator-admin-id',
      };

      adminRepository.findByEmail.mockResolvedValue(mockAdmin);
      bcrypt.compare.mockResolvedValue(true as never);
      adminRepository.update.mockResolvedValue({
        ...mockAdmin,
        lastLoginAt: new Date(),
      } as never);

      const result = await login(email, password);

      expect(result.admin.mustChangePassword).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const email = 'admin@example.com';
      const password = 'password';
      const dbError = new Error('Database connection failed');

      adminRepository.findByEmail.mockRejectedValue(dbError);

      await expect(login(email, password)).rejects.toThrow(AdminServiceError);
      await expect(login(email, password)).rejects.toThrow('Login failed');

      const error = await login(email, password).catch((e) => e);
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(error.cause).toBe(dbError);
    });

    it('should update lastLoginAt on successful login', async () => {
      const email = 'admin@example.com';
      const password = 'password';
      const mockAdmin = {
        id: 'admin-123',
        email,
        passwordHash: '$2b$12$hashedpassword',
        role: 'ADMIN' as AdminRole,
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        createdById: null,
      };

      adminRepository.findByEmail.mockResolvedValue(mockAdmin);
      bcrypt.compare.mockResolvedValue(true as never);
      adminRepository.update.mockResolvedValue(mockAdmin as never);

      await login(email, password);

      expect(adminRepository.update).toHaveBeenCalledWith(mockAdmin.id, {
        lastLoginAt: expect.any(Date),
      });
    });
  });

  describe('logout', () => {
    it('should blacklist token in Redis with correct TTL', async () => {
      const tokenId = 'test-uuid-123';

      await logout(tokenId);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining(tokenId), // Key should contain token ID
        86400, // 24 hours in seconds
        '1'
      );
    });

    it('should throw AdminServiceError if blacklisting fails', async () => {
      const tokenId = 'test-uuid-123';
      const redisError = new Error('Redis connection failed');

      mockRedisClient.setex.mockRejectedValue(redisError);

      await expect(logout(tokenId)).rejects.toThrow(AdminServiceError);
      await expect(logout(tokenId)).rejects.toThrow('Failed to logout');

      const error = await logout(tokenId).catch((e) => e);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.cause).toBe(redisError);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      const tokenId = 'blacklisted-token';

      mockRedisClient.get.mockResolvedValue('1');

      const result = await isTokenBlacklisted(tokenId);

      expect(result).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalledWith(expect.stringContaining(tokenId));
    });

    it('should return false for non-blacklisted token', async () => {
      const tokenId = 'valid-token';

      mockRedisClient.get.mockResolvedValue(null);

      const result = await isTokenBlacklisted(tokenId);

      expect(result).toBe(false);
    });

    it('should return false on Redis error (fail open)', async () => {
      const tokenId = 'error-token';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await isTokenBlacklisted(tokenId);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to check token blacklist:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token and return payload', async () => {
      const token = 'valid-jwt-token';
      const payload: AdminTokenPayload & { jti: string } = {
        sub: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        jti: 'token-uuid',
      };

      jwt.verify.mockReturnValue(payload as never);
      mockRedisClient.get.mockResolvedValue(null);

      const result = await verifyToken(token);

      expect(result).toEqual(payload);
      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(mockRedisClient.get).toHaveBeenCalledWith(expect.stringContaining(payload.jti));
    });

    it('should reject blacklisted token', async () => {
      const token = 'blacklisted-token';
      const payload: AdminTokenPayload & { jti: string } = {
        sub: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        jti: 'blacklisted-uuid',
      };

      jwt.verify.mockReturnValue(payload as never);
      mockRedisClient.get.mockResolvedValue('1'); // Token is blacklisted

      await expect(verifyToken(token)).rejects.toThrow(AdminServiceError);
      await expect(verifyToken(token)).rejects.toThrow('Token has been revoked');

      const error = await verifyToken(token).catch((e) => e);
      expect(error.code).toBe('TOKEN_BLACKLISTED');
    });

    it('should reject expired token', async () => {
      const token = 'expired-token';
      const tokenExpiredError = new jwt.TokenExpiredError('Token expired');

      jwt.verify.mockImplementation(() => {
        throw tokenExpiredError;
      });

      await expect(verifyToken(token)).rejects.toThrow(AdminServiceError);
      await expect(verifyToken(token)).rejects.toThrow('Token has expired');

      const error = await verifyToken(token).catch((e) => e);
      expect(error.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject invalid token', async () => {
      const token = 'invalid-token';
      const jsonWebTokenError = new jwt.JsonWebTokenError('Invalid token');

      jwt.verify.mockImplementation(() => {
        throw jsonWebTokenError;
      });

      await expect(verifyToken(token)).rejects.toThrow(AdminServiceError);
      await expect(verifyToken(token)).rejects.toThrow('Invalid token');

      const error = await verifyToken(token).catch((e) => e);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should handle unexpected errors during verification', async () => {
      const token = 'error-token';
      const unexpectedError = new Error('Unexpected error');

      jwt.verify.mockImplementation(() => {
        throw unexpectedError;
      });

      await expect(verifyToken(token)).rejects.toThrow(AdminServiceError);
      await expect(verifyToken(token)).rejects.toThrow('Token verification failed');

      const error = await verifyToken(token).catch((e) => e);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.cause).toBe(unexpectedError);
    });
  });

  describe('AdminServiceError', () => {
    it('should create error with code and message', () => {
      const error = new AdminServiceError('Test error', 'INVALID_CREDENTIALS');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(error.name).toBe('AdminServiceError');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new AdminServiceError('Test error', 'UNAUTHORIZED', cause);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.cause).toBe(cause);
    });

    it('should be instanceof Error', () => {
      const error = new AdminServiceError('Test', 'UNAUTHORIZED');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AdminServiceError).toBe(true);
    });
  });
});
