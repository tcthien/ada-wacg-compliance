import { spawn } from 'child_process';
import { ErrorType } from './types.js';
import type { Logger } from './logger.js';

/**
 * Options for invoking Claude Code
 */
export interface InvocationOptions {
  /**
   * Maximum time to wait for Claude Code to respond (milliseconds)
   * @default 180000 (3 minutes)
   */
  timeout?: number;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Optional logger instance for logging invocation progress
   */
  logger?: Logger;
}

/**
 * Result of a Claude Code invocation
 */
export interface InvocationResult {
  /**
   * Whether the invocation was successful
   */
  success: boolean;

  /**
   * The output from Claude Code (if successful)
   */
  output?: string;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Type of error that occurred
   */
  errorType?: ErrorType;

  /**
   * Duration of the invocation in milliseconds
   */
  durationMs: number;
}

/**
 * Execute Claude Code command and capture output
 *
 * @param prompt - The prompt to send to Claude Code
 * @param options - Invocation options
 * @returns Promise resolving to invocation result
 */
export async function invokeClaudeCode(
  prompt: string,
  options: InvocationOptions = {}
): Promise<InvocationResult> {
  const timeout = options.timeout ?? 180000; // 3 minutes default
  const maxRetries = options.maxRetries ?? 3;
  const logger = options.logger;

  let attempt = 0;
  let lastError: InvocationResult | null = null;

  while (attempt < maxRetries) {
    const result = await executeClaudeCodeOnce(prompt, timeout);

    // Success - return immediately
    if (result.success) {
      logger?.success(`Claude Code invocation completed successfully in ${result.durationMs}ms`);
      return result;
    }

    lastError = result;
    attempt++;

    // If we've exhausted retries, return the last error
    if (attempt >= maxRetries) {
      logger?.error(`Claude Code invocation failed after ${maxRetries} attempts: ${result.error}`);
      return result;
    }

    // Calculate retry delay with exponential backoff
    const delay = calculateRetryDelay(result.errorType, attempt);
    const waitTimeSeconds = delay / 1000;

    // Log based on error type
    if (result.errorType === ErrorType.RATE_LIMIT) {
      logger?.warning(
        `Rate limit hit. Waiting ${waitTimeSeconds}s before retry ${attempt}/${maxRetries}`
      );
    } else {
      logger?.warning(
        `Invocation failed: ${result.error}. Waiting ${waitTimeSeconds}s before retry ${attempt}/${maxRetries}`
      );
    }

    // Wait before retrying
    await sleep(delay);
  }

  // This should never be reached, but TypeScript requires it
  return lastError!;
}

/**
 * Execute Claude Code once without retry logic
 */
async function executeClaudeCodeOnce(
  prompt: string,
  timeout: number
): Promise<InvocationResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Spawn Claude Code process
    const child = spawn('claude', ['-p', prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Set up timeout
    timeoutId = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL'); // Force kill the process
    }, timeout);

    // Set up signal handlers to kill child process cleanly
    const signalHandler = () => {
      if (!killed && child.pid) {
        killed = true;
        child.kill();
      }
    };

    process.on('SIGTERM', signalHandler);
    process.on('SIGINT', signalHandler);

    // Capture stdout
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    // Capture stderr
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process exit
    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startTime;

      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Clean up signal handlers
      process.off('SIGTERM', signalHandler);
      process.off('SIGINT', signalHandler);

      // Check for timeout
      if (killed || signal === 'SIGKILL') {
        resolve({
          success: false,
          error: `Claude Code execution timed out after ${timeout}ms`,
          errorType: ErrorType.TIMEOUT,
          durationMs,
        });
        return;
      }

      // Check for rate limit
      const isRateLimit =
        code === 429 ||
        stdout.toLowerCase().includes('rate limit') ||
        stderr.toLowerCase().includes('rate limit') ||
        stdout.includes('429') ||
        stderr.includes('429');

      if (isRateLimit) {
        resolve({
          success: false,
          error: 'Claude Code rate limit exceeded',
          errorType: ErrorType.RATE_LIMIT,
          durationMs,
        });
        return;
      }

      // Check for process crash (non-zero exit code)
      if (code !== 0) {
        resolve({
          success: false,
          error: `Claude Code exited with code ${code}: ${stderr || stdout}`,
          errorType: ErrorType.PROCESS_CRASH,
          durationMs,
        });
        return;
      }

      // Process succeeded - pass output to result parser for processing
      // The result parser handles various output formats including markdown code blocks
      resolve({
        success: true,
        output: stdout,
        durationMs,
      });
    });

    // Handle spawn errors
    child.on('error', (error) => {
      const durationMs = Date.now() - startTime;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      process.off('SIGTERM', signalHandler);
      process.off('SIGINT', signalHandler);

      resolve({
        success: false,
        error: `Failed to spawn Claude Code process: ${error.message}`,
        errorType: ErrorType.PROCESS_CRASH,
        durationMs,
      });
    });
  });
}

/**
 * Calculate retry delay based on error type and attempt number
 */
function calculateRetryDelay(errorType: ErrorType | undefined, attempt: number): number {
  if (errorType === ErrorType.RATE_LIMIT) {
    // Rate limit: 60s, 120s, 240s
    return 60000 * Math.pow(2, attempt - 1);
  } else {
    // General errors: 5s, 10s, 20s
    return 5000 * Math.pow(2, attempt - 1);
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
