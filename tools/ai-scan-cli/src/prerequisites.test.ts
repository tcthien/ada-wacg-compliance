import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'child_process';
import {
  checkPrerequisites,
  getInstallationInstructions,
  arePrerequisitesMet,
  type PrerequisiteResult,
} from './prerequisites.js';

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
}));

const mockedExecFile = vi.mocked(execFile);

describe('prerequisites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkPrerequisites', () => {
    it('should detect Claude CLI installed with version', async () => {
      mockedExecFile
        .mockResolvedValueOnce({ stdout: 'claude version 1.2.3', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: 'playwright\nother-server', stderr: '' } as never);

      const result = await checkPrerequisites();

      expect(result.claudeInstalled).toBe(true);
      expect(result.claudeVersion).toBe('1.2.3');
      expect(result.playwrightMcpConfigured).toBe(true);
      expect(result.mcpServers).toContain('playwright');
      expect(result.errors).toHaveLength(0);
    });

    it('should detect Claude not installed', async () => {
      const error = new Error('Command not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockedExecFile.mockRejectedValueOnce(error);

      const result = await checkPrerequisites();

      expect(result.claudeInstalled).toBe(false);
      expect(result.claudeVersion).toBeUndefined();
      expect(result.errors).toContain('Claude Code CLI is not installed.');
    });

    it('should detect Playwright MCP not configured', async () => {
      mockedExecFile
        .mockResolvedValueOnce({ stdout: 'claude version 1.2.3', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: 'other-server\nanother-server', stderr: '' } as never);

      const result = await checkPrerequisites();

      expect(result.claudeInstalled).toBe(true);
      expect(result.playwrightMcpConfigured).toBe(false);
      expect(result.errors).toContain('Playwright MCP server is not configured.');
    });

    it('should parse version from different formats', async () => {
      mockedExecFile
        .mockResolvedValueOnce({ stdout: '1.2.3', stderr: '' } as never)
        .mockResolvedValueOnce({ stdout: 'playwright', stderr: '' } as never);

      const result = await checkPrerequisites();

      expect(result.claudeVersion).toBe('1.2.3');
    });

    it('should handle MCP list command errors', async () => {
      mockedExecFile
        .mockResolvedValueOnce({ stdout: 'claude version 1.2.3', stderr: '' } as never)
        .mockRejectedValueOnce(new Error('MCP command failed'));

      const result = await checkPrerequisites();

      expect(result.claudeInstalled).toBe(true);
      expect(result.playwrightMcpConfigured).toBe(false);
      expect(result.errors.some(e => e.includes('Failed to check MCP configuration'))).toBe(true);
    });
  });

  describe('getInstallationInstructions', () => {
    it('should return Claude installation instructions when not installed', () => {
      const result: PrerequisiteResult = {
        claudeInstalled: false,
        playwrightMcpConfigured: false,
        mcpServers: [],
        errors: ['Claude Code CLI is not installed.'],
      };

      const instructions = getInstallationInstructions(result);

      expect(instructions).toContain('Claude Code CLI is not installed.');
      expect(instructions).toContain('Install with: npm install -g @anthropic-ai/claude-code');
      expect(instructions).toContain('Then authenticate with: claude auth login');
    });

    it('should return Playwright MCP instructions when Claude installed but MCP not configured', () => {
      const result: PrerequisiteResult = {
        claudeInstalled: true,
        claudeVersion: '1.2.3',
        playwrightMcpConfigured: false,
        mcpServers: ['other-server'],
        errors: ['Playwright MCP server is not configured.'],
      };

      const instructions = getInstallationInstructions(result);

      expect(instructions).toContain('Playwright MCP server is not configured.');
      expect(instructions).toContain('Add it to your Claude Code config: claude mcp add playwright');
    });

    it('should return empty array when all prerequisites are met', () => {
      const result: PrerequisiteResult = {
        claudeInstalled: true,
        claudeVersion: '1.2.3',
        playwrightMcpConfigured: true,
        mcpServers: ['playwright'],
        errors: [],
      };

      const instructions = getInstallationInstructions(result);

      expect(instructions).toHaveLength(0);
    });
  });

  describe('arePrerequisitesMet', () => {
    it('should return true when all prerequisites are met', () => {
      const result: PrerequisiteResult = {
        claudeInstalled: true,
        claudeVersion: '1.2.3',
        playwrightMcpConfigured: true,
        mcpServers: ['playwright'],
        errors: [],
      };

      expect(arePrerequisitesMet(result)).toBe(true);
    });

    it('should return false when Claude is not installed', () => {
      const result: PrerequisiteResult = {
        claudeInstalled: false,
        playwrightMcpConfigured: true,
        mcpServers: ['playwright'],
        errors: ['Claude Code CLI is not installed.'],
      };

      expect(arePrerequisitesMet(result)).toBe(false);
    });

    it('should return false when Playwright MCP is not configured', () => {
      const result: PrerequisiteResult = {
        claudeInstalled: true,
        claudeVersion: '1.2.3',
        playwrightMcpConfigured: false,
        mcpServers: [],
        errors: ['Playwright MCP server is not configured.'],
      };

      expect(arePrerequisitesMet(result)).toBe(false);
    });
  });
});
