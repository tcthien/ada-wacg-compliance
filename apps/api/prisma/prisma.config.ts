import type { PrismaConfig } from '@prisma/client';

const config: PrismaConfig = {
  datasource: {
    url: process.env.DATABASE_URL!,
  },
};

export default config;
