import '@fastify/cookie';
import type { GuestSession } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    guestSession?: GuestSession;
    recaptchaScore?: number;
  }
}
