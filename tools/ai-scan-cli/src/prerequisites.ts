import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Result of prerequisite checks
 */
export interface PrerequisiteResult {
  claudeInstalled: boolean;
  claudeVersion?: string;
  playwrightMcpConfigured: boolean;
  mcpServers: string[];
  errors: string[];
}

/**
 * Check if Claude Code CLI is installed and configured properly
 *
 * Validates:
 * - Claude CLI installation and version
 * - Playwright MCP server configuration
 *
 * @returns PrerequisiteResult with all findings
 */
export async function checkPrerequisites(): Promise<PrerequisiteResult> {
  const result: PrerequisiteResult = {
    claudeInstalled: false,
    playwrightMcpConfigured: false,
    mcpServers: [],
    errors: [],
  };

  // Check Claude CLI installation and version
  try {
    const { stdout } = await execFileAsync('claude', ['--version']);
    result.claudeInstalled = true;

    // Parse version from output (expected format: "claude version X.Y.Z")
    const versionMatch = stdout.trim().match(/(?:claude\s+)?(?:version\s+)?(\d+\.\d+\.\d+)/i);
    if (versionMatch) {
      result.claudeVersion = versionMatch[1];
    } else {
      result.claudeVersion = stdout.trim();
    }
  } catch (error) {
    result.claudeInstalled = false;

    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      result.errors.push('Claude Code CLI is not installed.');
    } else {
      result.errors.push(`Failed to check Claude CLI version: ${(error as Error).message}`);
    }
  }

  // Check MCP server configuration (only if Claude is installed)
  if (result.claudeInstalled) {
    try {
      const { stdout } = await execFileAsync('claude', ['mcp', 'list']);

      // Parse MCP server list from output
      const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean);

      // Look for server entries (typically listed as names or with additional info)
      for (const line of lines) {
        // Skip header lines or empty lines
        if (line.toLowerCase().includes('mcp server') ||
            line.toLowerCase().includes('available') ||
            line.startsWith('-') ||
            line.startsWith('=')) {
          continue;
        }

        // Extract server name (may be in format "name" or "name - description")
        const serverMatch = line.match(/^([a-zA-Z0-9_-]+)/);
        if (serverMatch) {
          result.mcpServers.push(serverMatch[1]);
        }
      }

      // Check if playwright is in the list (case-insensitive)
      result.playwrightMcpConfigured = result.mcpServers.some(
        server => server.toLowerCase() === 'playwright'
      );

      if (!result.playwrightMcpConfigured) {
        result.errors.push('Playwright MCP server is not configured.');
      }
    } catch (error) {
      result.errors.push(`Failed to check MCP configuration: ${(error as Error).message}`);
    }
  }

  return result;
}

/**
 * Display installation instructions for missing prerequisites
 *
 * @param result - PrerequisiteResult from checkPrerequisites()
 * @returns Array of instruction messages
 */
export function getInstallationInstructions(result: PrerequisiteResult): string[] {
  const instructions: string[] = [];

  if (!result.claudeInstalled) {
    instructions.push(
      'Claude Code CLI is not installed.',
      'Install with: npm install -g @anthropic-ai/claude-code',
      'Then authenticate with: claude auth login'
    );
  }

  if (result.claudeInstalled && !result.playwrightMcpConfigured) {
    instructions.push(
      'Playwright MCP server is not configured.',
      'Add it to your Claude Code config: claude mcp add playwright'
    );
  }

  return instructions;
}

/**
 * Check if all prerequisites are met
 *
 * @param result - PrerequisiteResult from checkPrerequisites()
 * @returns true if all prerequisites are satisfied
 */
export function arePrerequisitesMet(result: PrerequisiteResult): boolean {
  return result.claudeInstalled && result.playwrightMcpConfigured;
}
