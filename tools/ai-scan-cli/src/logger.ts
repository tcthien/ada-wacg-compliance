import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export interface LoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
  logFilePath?: string;
}

export class Logger {
  private quiet: boolean;
  private verbose: boolean;
  private logFilePath?: string;

  constructor(options: LoggerOptions = {}) {
    this.quiet = options.quiet ?? false;
    this.verbose = options.verbose ?? false;
    this.logFilePath = options.logFilePath;

    // Ensure log file directory exists if logFilePath is provided
    if (this.logFilePath) {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * Get current timestamp in ISO format
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Write log entry to file with timestamp
   */
  private writeToFile(level: string, message: string): void {
    if (!this.logFilePath) {
      return;
    }

    const timestamp = this.getTimestamp();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;

    try {
      fs.appendFileSync(this.logFilePath, logEntry, 'utf8');
    } catch (error) {
      // If we can't write to log file, just continue (avoid infinite loop)
      console.error(`Failed to write to log file: ${error}`);
    }
  }

  /**
   * Log info message (blue)
   */
  info(message: string): void {
    if (!this.quiet) {
      console.log(chalk.blue('ℹ'), message);
    }
    this.writeToFile('INFO', message);
  }

  /**
   * Log success message (green)
   */
  success(message: string): void {
    if (!this.quiet) {
      console.log(chalk.green('✓'), message);
    }
    this.writeToFile('SUCCESS', message);
  }

  /**
   * Log warning message (yellow)
   */
  warning(message: string): void {
    if (!this.quiet) {
      console.warn(chalk.yellow('⚠'), message);
    }
    this.writeToFile('WARNING', message);
  }

  /**
   * Log error message (red) - always shown even in quiet mode
   */
  error(message: string, error?: Error): void {
    const fullMessage = error ? `${message}: ${error.message}` : message;
    console.error(chalk.red('✗'), fullMessage);
    this.writeToFile('ERROR', fullMessage);

    // Log stack trace to file if error object provided
    if (error && error.stack) {
      this.writeToFile('ERROR', error.stack);
    }
  }

  /**
   * Log debug message (gray) - only shown in verbose mode
   */
  debug(message: string): void {
    if (this.verbose && !this.quiet) {
      console.log(chalk.gray('🔍'), message);
    }
    if (this.verbose) {
      this.writeToFile('DEBUG', message);
    }
  }

  /**
   * Log progress message (cyan) - shows ongoing operation
   */
  progress(message: string): void {
    if (!this.quiet) {
      console.log(chalk.cyan('⏳'), message);
    }
    this.writeToFile('PROGRESS', message);
  }

  /**
   * Log raw message without formatting - always shown
   */
  raw(message: string): void {
    console.log(message);
    this.writeToFile('RAW', message);
  }

  /**
   * Create a new line for better readability
   */
  newLine(): void {
    if (!this.quiet) {
      console.log();
    }
  }
}
