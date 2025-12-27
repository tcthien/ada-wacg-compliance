import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Worker environment configuration schema
 * Validates and parses environment variables with sensible defaults
 */
const envSchema = z.object({
  // Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Logging
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Redis Configuration
  REDIS_URL: z.string().url().optional(),

  // Worker Configuration
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Playwright Configuration
  PLAYWRIGHT_HEADLESS: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .default('true'),
  PLAYWRIGHT_TIMEOUT: z.coerce.number().int().positive().default(30000),

  // Email Configuration (for email worker)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // SendGrid Configuration
  SENDGRID_API_KEY: z.string().optional(),

  // Application URL (for email links)
  APP_URL: z.string().url().default('http://localhost:3000'),
});

/**
 * Parse and validate environment variables
 * Throws an error if validation fails
 */
function parseEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten());
    throw new Error('Invalid environment configuration');
  }

  return parsed.data;
}

/**
 * Validated environment configuration
 * Safe to use throughout the application
 */
export const env = parseEnv();

/**
 * Type-safe environment configuration
 */
export type Env = z.infer<typeof envSchema>;
