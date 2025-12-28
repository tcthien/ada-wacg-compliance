import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Environment configuration schema
 * Validates and parses environment variables with sensible defaults
 */
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3080),
  HOST: z.string().default('0.0.0.0'),

  // CORS Configuration
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // API Configuration
  API_PREFIX: z.string().default('/api/v1'),

  // Redis Configuration
  REDIS_URL: z.string().url().optional(),

  // reCAPTCHA Configuration
  RECAPTCHA_SECRET_KEY: z.string().optional(),
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
