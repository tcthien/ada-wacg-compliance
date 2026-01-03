/**
 * S3 Client Utility
 *
 * Provides a singleton S3 client configured for MinIO or AWS S3.
 * Supports file upload, download, and presigned URL generation.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3 Configuration from environment variables
 */
export interface S3Config {
  endpoint: string | undefined;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
  publicUrl: string | undefined;
}

/**
 * Get S3 configuration from environment variables
 *
 * For MinIO: Set S3_ENDPOINT=http://localhost:9000 and S3_FORCE_PATH_STYLE=true
 * For AWS S3: Leave S3_ENDPOINT empty and set S3_FORCE_PATH_STYLE=false
 * For CDN/Cloudflare: Set S3_PUBLIC_URL=https://assets.adashield.dev
 */
export function getS3Config(): S3Config {
  // Empty string or undefined means use AWS S3 default endpoint
  const endpointEnv = process.env['S3_ENDPOINT']?.trim();
  const endpoint = endpointEnv || undefined;

  // Public URL for CDN access (e.g., Cloudflare)
  const publicUrlEnv = process.env['S3_PUBLIC_URL']?.trim();
  const publicUrl = publicUrlEnv || undefined;

  const config: S3Config = {
    endpoint,
    region: process.env['S3_REGION'] || 'us-east-1',
    accessKeyId: process.env['S3_ACCESS_KEY'] || 'minioadmin',
    secretAccessKey: process.env['S3_SECRET_KEY'] || 'minioadmin',
    bucket: process.env['S3_BUCKET'] || 'adashield',
    forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] === 'true',
    publicUrl,
  };

  return config;
}

/**
 * Check if using AWS S3 (vs MinIO or other S3-compatible storage)
 */
export function isAwsS3(): boolean {
  const endpoint = process.env['S3_ENDPOINT']?.trim();
  return !endpoint || endpoint.includes('amazonaws.com');
}

/**
 * Get the public URL for an S3 object
 *
 * Returns CDN URL if S3_PUBLIC_URL is set, otherwise returns direct S3 URL
 */
export function getPublicUrl(key: string): string {
  const config = getS3Config();

  // Use CDN/Cloudflare URL if configured
  if (config.publicUrl) {
    return `${config.publicUrl}/${key}`;
  }

  // Fallback to direct S3 URL
  if (isAwsS3()) {
    return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
  }

  // MinIO path style
  return `${config.endpoint}/${config.bucket}/${key}`;
}

// Singleton S3 client instance
let s3ClientInstance: S3Client | null = null;
let currentConfig: S3Config | null = null;

/**
 * Get or create S3 client singleton
 */
export function getS3Client(): S3Client {
  const config = getS3Config();

  // Return existing client if config hasn't changed
  if (s3ClientInstance && currentConfig) {
    if (
      currentConfig.endpoint === config.endpoint &&
      currentConfig.accessKeyId === config.accessKeyId
    ) {
      return s3ClientInstance;
    }
  }

  // Create new client
  // Only include endpoint if defined (AWS S3 uses default endpoint)
  s3ClientInstance = new S3Client({
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });

  currentConfig = config;
  return s3ClientInstance;
}

/**
 * Ensure the S3 bucket exists, create if not
 */
export async function ensureBucketExists(): Promise<void> {
  const client = getS3Client();
  const config = getS3Config();

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    console.log(`✅ S3 bucket '${config.bucket}' exists`);
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`📦 Creating S3 bucket '${config.bucket}'...`);
      await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
      console.log(`✅ Created S3 bucket '${config.bucket}'`);
    } else {
      throw error;
    }
  }
}

/**
 * Upload a buffer to S3
 *
 * @param buffer - File buffer to upload
 * @param key - S3 object key (path)
 * @param contentType - MIME type of the file
 * @returns S3 object URL (not presigned)
 *
 * @example
 * ```typescript
 * const url = await uploadToS3(pdfBuffer, 'reports/scan-123/report.pdf', 'application/pdf');
 * ```
 */
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  const config = getS3Config();

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  } as PutObjectCommandInput);

  await client.send(command);

  // Return the public URL (CDN if configured, otherwise direct S3)
  return getPublicUrl(key);
}

/**
 * Generate a URL for downloading an S3 object
 *
 * If S3_PUBLIC_URL is configured (Cloudflare CDN), returns a direct public URL.
 * Otherwise, generates a presigned URL with time-limited access.
 *
 * @param key - S3 object key
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 *                    Only used for presigned URLs (when no public URL configured)
 * @returns Download URL (public CDN URL or presigned S3 URL)
 *
 * @example
 * ```typescript
 * // With S3_PUBLIC_URL set:
 * const downloadUrl = await getPresignedUrl('reports/scan-123/report.pdf');
 * // Returns: https://assets.adashield.dev/reports/scan-123/report.pdf
 *
 * // Without S3_PUBLIC_URL:
 * const downloadUrl = await getPresignedUrl('reports/scan-123/report.pdf');
 * // Returns: https://minio:9000/adashield/reports/scan-123/report.pdf?X-Amz-...
 * ```
 */
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const config = getS3Config();

  // If public URL is configured (CDN like Cloudflare), return direct public URL
  // This is more reliable than presigned URLs for buckets with public access via CDN
  if (config.publicUrl) {
    return `${config.publicUrl}/${key}`;
  }

  // Otherwise, generate a presigned URL for private bucket access
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

/**
 * Delete an object from S3
 *
 * @param key - S3 object key to delete
 *
 * @example
 * ```typescript
 * await deleteFromS3('reports/scan-123/report.pdf');
 * ```
 */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();
  const config = getS3Config();

  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * Check if S3 connection is working
 *
 * @returns true if connection is successful
 */
export async function checkS3Connection(): Promise<boolean> {
  try {
    await ensureBucketExists();
    return true;
  } catch (error) {
    console.error('❌ S3 connection failed:', error);
    return false;
  }
}

// Content type mapping for common report formats
export const CONTENT_TYPES = {
  pdf: 'application/pdf',
  json: 'application/json',
} as const;

export type ContentTypeKey = keyof typeof CONTENT_TYPES;
