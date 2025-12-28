import '@fastify/cookie';
import type { GuestSession, AdminUser } from '@prisma/client';
import type { AdminTokenPayload } from '../modules/admin/admin.types.js';

declare module 'fastify' {
  interface FastifyRequest {
    // Guest session (public API)
    guestSession?: GuestSession;
    recaptchaScore?: number;

    // Admin authentication (admin API)
    adminUser?: AdminUser;
    adminToken?: string;
    adminTokenPayload?: AdminTokenPayload;
  }
}
