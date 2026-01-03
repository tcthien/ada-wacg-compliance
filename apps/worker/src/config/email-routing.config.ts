import { z } from 'zod';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded
config();

/**
 * Default YAML configuration file paths to check (in order of priority)
 */
const DEFAULT_YAML_PATHS = [
  path.resolve(process.cwd(), 'config', 'email-routing.yml'),
  path.resolve(process.cwd(), 'config', 'email-routing.yaml'),
  path.resolve(__dirname, '..', '..', 'config', 'email-routing.yml'),
  path.resolve(__dirname, '..', '..', 'config', 'email-routing.yaml'),
];

/**
 * Email Routing Configuration
 *
 * Loads email provider routing configuration from environment variables.
 * Supports pattern-based routing to different email providers (SendGrid, SES).
 *
 * Environment Variables:
 * - EMAIL_DEFAULT_PROVIDER: Default provider when no pattern matches ('SENDGRID' | 'SES')
 * - EMAIL_SENDGRID_PATTERNS: Comma-separated glob patterns for SendGrid routing
 * - EMAIL_SES_PATTERNS: Comma-separated glob patterns for SES routing
 * - SENDGRID_API_KEY: SendGrid API key
 * - SMTP_FROM: From email address (used by both providers)
 * - AWS_SES_REGION: AWS SES region (defaults to 'us-east-1')
 */

/**
 * Valid email provider types
 */
export type EmailProviderType = 'SENDGRID' | 'SES' | 'SMTP';

/**
 * SendGrid provider configuration
 */
export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  patterns: string[];
}

/**
 * AWS SES provider configuration
 */
export interface SESConfig {
  region: string;
  fromEmail: string;
  patterns: string[];
}

/**
 * SMTP provider configuration (for Mailpit, local dev, etc.)
 */
export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  fromEmail: string;
  patterns: string[];
}

/**
 * Email routing configuration interface
 * Defines the structure for email provider routing rules
 */
export interface EmailRoutingConfig {
  defaultProvider: EmailProviderType;
  providers: {
    SENDGRID?: SendGridConfig;
    SES?: SESConfig;
    SMTP?: SMTPConfig;
  };
}

/**
 * Zod schema for validating email provider type
 */
const providerTypeSchema = z.enum(['SENDGRID', 'SES', 'SMTP']);

/**
 * Zod schema for validating email routing environment variables
 */
const emailRoutingEnvSchema = z.object({
  // Default provider (required)
  EMAIL_DEFAULT_PROVIDER: providerTypeSchema.default('SES'),

  // Pattern configuration (comma-separated glob patterns)
  EMAIL_SENDGRID_PATTERNS: z.string().optional(),
  EMAIL_SES_PATTERNS: z.string().optional(),
  EMAIL_SMTP_PATTERNS: z.string().optional(),

  // SendGrid configuration
  SENDGRID_API_KEY: z.string().optional(),

  // From email address (used by all providers)
  SMTP_FROM: z.string().email().optional(),

  // AWS SES configuration
  AWS_SES_REGION: z.string().default('us-east-1'),

  // SMTP configuration (for Mailpit, local dev, etc.)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
});

/**
 * YAML configuration file structure
 * Matches the format specified in Requirement 6.2 Option B
 *
 * Example YAML structure:
 * ```yaml
 * email-routing:
 *   default-provider: SES
 *   providers:
 *     SENDGRID:
 *       patterns:
 *         - "*@microsoft.com"
 *         - "*@outlook.com"
 *     SES:
 *       patterns:
 *         - "*@*.edu"
 *         - "*@company.com"
 * ```
 */
interface YamlEmailRoutingConfig {
  'email-routing': {
    'default-provider': string;
    providers: {
      SENDGRID?: {
        patterns: string[];
      };
      SES?: {
        patterns: string[];
      };
    };
  };
}

/**
 * Zod schema for validating YAML configuration structure
 */
const yamlConfigSchema = z.object({
  'email-routing': z.object({
    'default-provider': providerTypeSchema,
    providers: z.object({
      SENDGRID: z
        .object({
          patterns: z.array(z.string()),
        })
        .optional(),
      SES: z
        .object({
          patterns: z.array(z.string()),
        })
        .optional(),
    }),
  }),
});

/**
 * Find the first existing YAML configuration file from the default paths
 *
 * @param customPath - Optional custom path to check first
 * @returns The path to the YAML file if found, null otherwise
 */
function findYamlConfigFile(customPath?: string): string | null {
  const pathsToCheck = customPath ? [customPath, ...DEFAULT_YAML_PATHS] : DEFAULT_YAML_PATHS;

  for (const filePath of pathsToCheck) {
    try {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    } catch {
      // Ignore access errors, continue to next path
    }
  }

  return null;
}

/**
 * Load and parse YAML configuration file
 *
 * @param filePath - Path to the YAML configuration file
 * @returns Parsed and validated YAML configuration, or null if invalid
 */
function loadYamlConfig(filePath: string): YamlEmailRoutingConfig | null {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(fileContent);

    // Validate against schema
    const validated = yamlConfigSchema.safeParse(parsed);

    if (!validated.success) {
      console.warn(
        `⚠️ Invalid YAML configuration at ${filePath}:`,
        validated.error.flatten()
      );
      return null;
    }

    return validated.data as YamlEmailRoutingConfig;
  } catch (error) {
    console.warn(
      `⚠️ Failed to load YAML configuration from ${filePath}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Convert YAML configuration to EmailRoutingConfig
 *
 * @param yamlConfig - The parsed YAML configuration
 * @param envOverrides - Environment variable overrides for sensitive values
 * @returns EmailRoutingConfig
 */
function convertYamlToConfig(
  yamlConfig: YamlEmailRoutingConfig,
  envOverrides: {
    sendgridApiKey?: string;
    smtpFrom?: string;
    sesRegion: string;
  }
): EmailRoutingConfig {
  const routing = yamlConfig['email-routing'];
  const providers: EmailRoutingConfig['providers'] = {};

  // Configure SendGrid if patterns exist and API key is available
  if (routing.providers.SENDGRID && envOverrides.sendgridApiKey && envOverrides.smtpFrom) {
    providers.SENDGRID = {
      apiKey: envOverrides.sendgridApiKey,
      fromEmail: envOverrides.smtpFrom,
      patterns: routing.providers.SENDGRID.patterns,
    };
  }

  // Configure SES if patterns exist and from email is available
  if (routing.providers.SES && envOverrides.smtpFrom) {
    providers.SES = {
      region: envOverrides.sesRegion,
      fromEmail: envOverrides.smtpFrom,
      patterns: routing.providers.SES.patterns,
    };
  }

  return {
    defaultProvider: routing['default-provider'] as EmailProviderType,
    providers,
  };
}

/**
 * Check if environment variables are set for email routing
 * Used to determine if we should fallback to YAML configuration
 *
 * @returns true if EMAIL_DEFAULT_PROVIDER or pattern variables are set
 */
function hasEnvRoutingConfig(): boolean {
  return !!(
    process.env['EMAIL_DEFAULT_PROVIDER'] ||
    process.env['EMAIL_SENDGRID_PATTERNS'] ||
    process.env['EMAIL_SES_PATTERNS'] ||
    process.env['EMAIL_SMTP_PATTERNS']
  );
}

/**
 * Parse comma-separated patterns into an array
 * Trims whitespace and filters empty strings
 *
 * @param patterns - Comma-separated pattern string
 * @returns Array of pattern strings
 */
function parsePatterns(patterns: string | undefined): string[] {
  if (!patterns || patterns.trim() === '') {
    return [];
  }
  return patterns
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Validate that the default provider has required configuration
 *
 * @param config - The parsed email routing configuration
 * @throws Error if default provider is not properly configured
 */
function validateDefaultProvider(config: EmailRoutingConfig): void {
  const { defaultProvider, providers } = config;

  if (defaultProvider === 'SENDGRID') {
    if (!providers.SENDGRID) {
      throw new Error(
        'EMAIL_DEFAULT_PROVIDER is set to SENDGRID but SENDGRID configuration is missing. ' +
          'Required: SENDGRID_API_KEY and SMTP_FROM environment variables.'
      );
    }
  }

  if (defaultProvider === 'SES') {
    if (!providers.SES) {
      throw new Error(
        'EMAIL_DEFAULT_PROVIDER is set to SES but SES configuration is missing. ' +
          'Required: SMTP_FROM and optionally AWS_SES_REGION environment variables.'
      );
    }
  }

  if (defaultProvider === 'SMTP') {
    if (!providers.SMTP) {
      throw new Error(
        'EMAIL_DEFAULT_PROVIDER is set to SMTP but SMTP configuration is missing. ' +
          'Required: SMTP_FROM, SMTP_HOST, and SMTP_PORT environment variables.'
      );
    }
  }
}

/**
 * Load email routing configuration from environment variables (internal function)
 *
 * @param env - Validated environment variables
 * @returns EmailRoutingConfig built from environment variables
 */
function loadConfigFromEnv(
  env: z.infer<typeof emailRoutingEnvSchema>
): EmailRoutingConfig {
  // Build provider configurations
  const providers: EmailRoutingConfig['providers'] = {};

  // Configure SendGrid if API key is provided
  if (env.SENDGRID_API_KEY && env.SMTP_FROM) {
    providers.SENDGRID = {
      apiKey: env.SENDGRID_API_KEY,
      fromEmail: env.SMTP_FROM,
      patterns: parsePatterns(env.EMAIL_SENDGRID_PATTERNS),
    };
  }

  // Configure SES if from email is provided (SES uses IAM roles or env credentials)
  if (env.SMTP_FROM) {
    providers.SES = {
      region: env.AWS_SES_REGION,
      fromEmail: env.SMTP_FROM,
      patterns: parsePatterns(env.EMAIL_SES_PATTERNS),
    };
  }

  // Configure SMTP if from email is provided (for local dev with Mailpit, etc.)
  if (env.SMTP_FROM) {
    providers.SMTP = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      fromEmail: env.SMTP_FROM,
      patterns: parsePatterns(env.EMAIL_SMTP_PATTERNS),
    };
  }

  return {
    defaultProvider: env.EMAIL_DEFAULT_PROVIDER,
    providers,
  };
}

/**
 * Load email routing configuration with YAML fallback support
 *
 * This function reads configuration from environment variables first.
 * If no routing-specific env vars are set (EMAIL_DEFAULT_PROVIDER, EMAIL_*_PATTERNS),
 * it falls back to loading configuration from a YAML file.
 *
 * Configuration priority:
 * 1. Environment variables (if routing vars are set)
 * 2. YAML configuration file (config/email-routing.yml or .yaml)
 * 3. Default values
 *
 * Note: Sensitive values like SENDGRID_API_KEY and SMTP_FROM are always
 * read from environment variables, even when using YAML configuration.
 *
 * Per Requirement 6.6:
 * - Loads and validates email routing configuration at startup
 * - Logs the active routing rules for debugging
 * - Fails fast with clear error message if configuration is invalid
 *
 * @param options - Optional configuration options
 * @param options.yamlPath - Custom path to YAML configuration file
 * @returns EmailRoutingConfig - The validated email routing configuration
 * @throws Error if configuration is invalid or missing required values
 */
export function loadEmailRoutingConfig(options?: {
  yamlPath?: string;
}): EmailRoutingConfig {
  // Parse and validate environment variables
  const parsed = emailRoutingEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.flatten();
    console.error('  Invalid email routing configuration:', errors);
    throw new Error(
      `Invalid email routing configuration: ${JSON.stringify(errors.fieldErrors)}`
    );
  }

  const env = parsed.data;
  let config: EmailRoutingConfig;
  let configSource = 'environment variables';

  // Check if env vars have routing configuration
  if (hasEnvRoutingConfig()) {
    // Use environment variables for configuration
    config = loadConfigFromEnv(env);
  } else {
    // Try to load from YAML configuration file
    const yamlPath = findYamlConfigFile(options?.yamlPath);

    if (yamlPath) {
      const yamlConfig = loadYamlConfig(yamlPath);

      if (yamlConfig) {
        config = convertYamlToConfig(yamlConfig, {
          sendgridApiKey: env.SENDGRID_API_KEY,
          smtpFrom: env.SMTP_FROM,
          sesRegion: env.AWS_SES_REGION,
        });
        configSource = `YAML file (${yamlPath})`;
        console.log(`  Loading email routing configuration from ${yamlPath}`);
      } else {
        // YAML file exists but is invalid, fall back to env vars
        console.warn('  YAML configuration invalid, falling back to environment variables');
        config = loadConfigFromEnv(env);
      }
    } else {
      // No YAML file found, use environment variables
      config = loadConfigFromEnv(env);
    }
  }

  // Validate that default provider is configured
  validateDefaultProvider(config);

  // Log active routing rules for debugging (per Requirement 6.6)
  logRoutingConfiguration(config, configSource);

  return config;
}

/**
 * Log the active routing configuration for debugging
 * Does not log sensitive information like API keys
 *
 * @param config - The email routing configuration
 * @param source - The configuration source (e.g., 'environment variables', 'YAML file')
 */
function logRoutingConfiguration(
  config: EmailRoutingConfig,
  source = 'environment variables'
): void {
  console.log(`  Email routing configuration loaded from ${source}:`);
  console.log(`   Default provider: ${config.defaultProvider}`);

  if (config.providers.SENDGRID) {
    const patterns = config.providers.SENDGRID.patterns;
    console.log(
      `   SendGrid patterns: ${patterns.length > 0 ? patterns.join(', ') : '(none)'}`
    );
  }

  if (config.providers.SES) {
    const patterns = config.providers.SES.patterns;
    console.log(`   SES region: ${config.providers.SES.region}`);
    console.log(
      `   SES patterns: ${patterns.length > 0 ? patterns.join(', ') : '(none)'}`
    );
  }

  if (config.providers.SMTP) {
    const patterns = config.providers.SMTP.patterns;
    console.log(`   SMTP host: ${config.providers.SMTP.host}:${config.providers.SMTP.port}`);
    console.log(
      `   SMTP patterns: ${patterns.length > 0 ? patterns.join(', ') : '(none)'}`
    );
  }
}

/**
 * Type guard to check if a provider is configured
 *
 * @param config - The email routing configuration
 * @param provider - The provider type to check
 * @returns True if the provider is configured
 */
export function isProviderConfigured(
  config: EmailRoutingConfig,
  provider: EmailProviderType
): boolean {
  return provider in config.providers && config.providers[provider] !== undefined;
}
