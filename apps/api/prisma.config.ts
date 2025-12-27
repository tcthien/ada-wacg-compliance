import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma Configuration for ADAShield API
 *
 * This config is used by Prisma CLI for migrations.
 * The PrismaClient uses the adapter pattern separately.
 */
export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env['DATABASE_URL']!,
  },
  migrate: {
    adapter: async () => {
      const pg = await import('pg');
      const pool = new pg.default.Pool({
        connectionString: process.env['DATABASE_URL'],
      });
      const { PrismaPg } = await import('@prisma/adapter-pg');
      return new PrismaPg(pool);
    },
  },
});
