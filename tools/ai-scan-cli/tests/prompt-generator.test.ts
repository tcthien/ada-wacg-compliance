import { describe, it, expect } from 'vitest';
import {
  generatePrompt,
  getDefaultTemplatePath,
  validateTemplate,
  loadCustomTemplate,
  type PromptContext,
} from '../src/prompt-generator.js';
import type { PendingScan } from '../src/types.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

// Get directory path for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to get fixture file path
function getFixturePath(filename: string): string {
  return resolve(__dirname, 'fixtures', filename);
}

describe('Prompt Generator', () => {
  describe('generatePrompt with default template', () => {
    it('should render default template with 3 scans and include all URLs and scan IDs', async () => {
      // Arrange: Create 3 test scans
      const scans: PendingScan[] = [
        {
          scanId: 'scan-001',
          url: 'https://example.com',
          wcagLevel: 'AA',
          email: 'user1@example.com',
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          scanId: 'scan-002',
          url: 'https://demo.org',
          wcagLevel: 'AA',
        },
        {
          scanId: 'scan-003',
          url: 'https://test.io',
          wcagLevel: 'AA',
          email: 'user3@example.com',
        },
      ];

      const context: PromptContext = {
        scans,
        wcagLevel: 'AA',
      };

      // Act: Generate prompt using default template
      const prompt = await generatePrompt(context);

      // Assert: Verify all scan IDs are in the rendered prompt
      expect(prompt).toContain('scan-001');
      expect(prompt).toContain('scan-002');
      expect(prompt).toContain('scan-003');

      // Assert: Verify all URLs are in the rendered prompt
      expect(prompt).toContain('https://example.com');
      expect(prompt).toContain('https://demo.org');
      expect(prompt).toContain('https://test.io');

      // Assert: Verify WCAG level is mentioned
      expect(prompt).toContain('AA');

      // Assert: Verify prompt contains key sections from default template
      expect(prompt).toContain('web accessibility auditor');
      expect(prompt).toContain('WCAG');
      expect(prompt).toContain('Output Format Requirements');
      expect(prompt).toContain('JSON');
    });
  });

  describe('generatePrompt with wcagLevel parameter', () => {
    it('should render prompt with wcagLevel="AAA" appearing in the rendered output', async () => {
      // Arrange: Create a scan with AAA level
      const scans: PendingScan[] = [
        {
          scanId: 'scan-aaa-001',
          url: 'https://aaa-compliance.com',
          wcagLevel: 'AAA',
        },
      ];

      const context: PromptContext = {
        scans,
        wcagLevel: 'AAA',
      };

      // Act: Generate prompt
      const prompt = await generatePrompt(context);

      // Assert: Verify AAA appears multiple times in the template
      // The default template uses {{wcagLevel}} in several places
      const aaaMatches = prompt.match(/AAA/g);
      expect(aaaMatches).toBeDefined();
      expect(aaaMatches!.length).toBeGreaterThan(1);

      // Assert: Verify specific phrases that should contain AAA
      expect(prompt).toContain('WCAG AAA');
      expect(prompt).toContain('"wcagLevel": "AAA"');
    });
  });

  describe('generatePrompt with custom template path', () => {
    it('should load and use custom template when templatePath is provided', async () => {
      // Arrange: Create test scans
      const scans: PendingScan[] = [
        {
          scanId: 'custom-001',
          url: 'https://custom-template-test.com',
          wcagLevel: 'AA',
        },
        {
          scanId: 'custom-002',
          url: 'https://another-custom-test.org',
          wcagLevel: 'AA',
        },
      ];

      const context: PromptContext = {
        scans,
        wcagLevel: 'AA',
      };

      const customTemplatePath = getFixturePath('custom-template-valid.hbs');

      // Act: Generate prompt with custom template
      const prompt = await generatePrompt(context, customTemplatePath);

      // Assert: Verify custom template content is used
      expect(prompt).toContain('Custom Template for WCAG AA Testing');
      expect(prompt).toContain('This is a valid custom template');

      // Assert: Verify scan data is rendered
      expect(prompt).toContain('custom-001');
      expect(prompt).toContain('custom-002');
      expect(prompt).toContain('https://custom-template-test.com');
      expect(prompt).toContain('https://another-custom-test.org');

      // Assert: Verify default template content is NOT present
      expect(prompt).not.toContain('web accessibility auditor');
      expect(prompt).not.toContain('Output Format Requirements');
    });
  });

  describe('validateTemplate - missing required placeholders', () => {
    it('should throw validation error when custom template is missing {{wcagLevel}} placeholder', async () => {
      // Arrange: Template missing wcagLevel placeholder
      const customTemplatePath = getFixturePath('custom-template-missing-wcaglevel.hbs');
      const templateContent = await readFile(customTemplatePath, 'utf-8');

      // Act & Assert: Expect validation to fail
      expect(() => validateTemplate(templateContent)).toThrow('Template validation failed');

      try {
        validateTemplate(templateContent);
        // If we reach here, the test should fail
        expect.fail('Expected validateTemplate to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Template validation failed');
        expect((error as Error).message).toContain('Missing required placeholders');
        expect((error as Error).message).toContain('{{wcagLevel}}');
      }
    });

    it('should throw validation error when generating prompt with missing placeholder template', async () => {
      // Arrange: Use template missing wcagLevel
      const scans: PendingScan[] = [
        {
          scanId: 'error-test-001',
          url: 'https://error-test.com',
          wcagLevel: 'AA',
        },
      ];

      const context: PromptContext = {
        scans,
        wcagLevel: 'AA',
      };

      const customTemplatePath = getFixturePath('custom-template-missing-wcaglevel.hbs');

      // Act & Assert: Expect generatePrompt to fail validation
      await expect(generatePrompt(context, customTemplatePath)).rejects.toThrow('Template validation failed');

      try {
        await generatePrompt(context, customTemplatePath);
        // If we reach here, the test should fail
        expect.fail('Expected generatePrompt to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Template validation failed');
        expect((error as Error).message).toContain('{{wcagLevel}}');
      }
    });
  });

  describe('Custom template with syntax error - Handlebars errors', () => {
    it('should compile template even with mismatched block helpers (Handlebars validates at render time)', async () => {
      // Arrange: Template with mismatched block helpers (each/if)
      // Note: Handlebars.compile() is very permissive and succeeds even with issues
      const customTemplatePath = getFixturePath('custom-template-syntax-error.hbs');
      const templateContent = await readFile(customTemplatePath, 'utf-8');

      // Act: Validate template - Handlebars.compile will succeed despite mismatched helpers
      // Handlebars throws most errors at render time, not compile time
      expect(() => validateTemplate(templateContent)).not.toThrow();

      // Assert: Template passes compile-time validation
      // The error will only be caught when trying to render the template
    });

    it('should throw Handlebars error when rendering template with syntax error', async () => {
      // Arrange: Use template with mismatched block helpers
      const scans: PendingScan[] = [
        {
          scanId: 'syntax-error-001',
          url: 'https://syntax-error-test.com',
          wcagLevel: 'AA',
        },
      ];

      const context: PromptContext = {
        scans,
        wcagLevel: 'AA',
      };

      const customTemplatePath = getFixturePath('custom-template-syntax-error.hbs');

      // Act & Assert: Expect generatePrompt to fail at render time with Handlebars error
      await expect(generatePrompt(context, customTemplatePath)).rejects.toThrow();

      try {
        await generatePrompt(context, customTemplatePath);
        // If we reach here, the test should fail
        expect.fail('Expected generatePrompt to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // The error comes from Handlebars render with mismatched block helpers
        expect((error as Error).message).toMatch(/doesn't match/i);
      }
    });
  });

  describe('getDefaultTemplatePath', () => {
    it('should return valid path to templates/default-prompt.hbs', () => {
      // Act: Get the default template path
      const templatePath = getDefaultTemplatePath();

      // Assert: Verify path is a string
      expect(typeof templatePath).toBe('string');

      // Assert: Verify path ends with correct structure
      expect(templatePath).toContain('templates');
      expect(templatePath).toContain('default-prompt.hbs');
      expect(templatePath).toMatch(/templates[\/\\]default-prompt\.hbs$/);

      // Assert: Verify the file actually exists at that path
      expect(existsSync(templatePath)).toBe(true);
    });

    it('should return absolute path, not relative path', () => {
      // Act: Get the default template path
      const templatePath = getDefaultTemplatePath();

      // Assert: Verify it's an absolute path (starts with / on Unix or drive letter on Windows)
      const isAbsolute = templatePath.startsWith('/') || /^[A-Z]:\\/.test(templatePath);
      expect(isAbsolute).toBe(true);
    });
  });

  describe('loadCustomTemplate', () => {
    it('should successfully load custom template file content', async () => {
      // Arrange: Custom template path
      const customTemplatePath = getFixturePath('custom-template-valid.hbs');

      // Act: Load the template
      const templateContent = await loadCustomTemplate(customTemplatePath);

      // Assert: Verify content is loaded
      expect(typeof templateContent).toBe('string');
      expect(templateContent.length).toBeGreaterThan(0);
      expect(templateContent).toContain('Custom Template for WCAG');
      expect(templateContent).toContain('{{wcagLevel}}');
      expect(templateContent).toContain('{{#each scans}}');
      expect(templateContent).toContain('{{this.scanId}}');
      expect(templateContent).toContain('{{this.url}}');
    });

    it('should throw error when template file does not exist', async () => {
      // Arrange: Non-existent template path
      const nonExistentPath = getFixturePath('non-existent-template.hbs');

      // Act & Assert: Expect loading to fail
      await expect(loadCustomTemplate(nonExistentPath)).rejects.toThrow();
    });
  });

  describe('Edge cases and integration', () => {
    it('should handle empty scans array gracefully', async () => {
      // Arrange: Context with no scans
      const context: PromptContext = {
        scans: [],
        wcagLevel: 'AA',
      };

      // Act: Generate prompt with empty scans
      const prompt = await generatePrompt(context);

      // Assert: Should still generate valid prompt
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);

      // Assert: Should still contain WCAG level
      expect(prompt).toContain('AA');

      // Assert: Should mention 0 URLs
      expect(prompt).toContain('0 URL');
    });

    it('should handle single scan correctly', async () => {
      // Arrange: Context with one scan
      const scans: PendingScan[] = [
        {
          scanId: 'single-scan',
          url: 'https://single-test.com',
          wcagLevel: 'A',
        },
      ];

      const context: PromptContext = {
        scans,
        wcagLevel: 'A',
      };

      // Act: Generate prompt
      const prompt = await generatePrompt(context);

      // Assert: Verify scan data is present
      expect(prompt).toContain('single-scan');
      expect(prompt).toContain('https://single-test.com');
      expect(prompt).toContain('A');

      // Assert: Should mention 1 URL
      expect(prompt).toContain('1 URL');
    });

    it('should preserve WCAG level case sensitivity', async () => {
      // Arrange: Test all three WCAG levels
      const levels: Array<'A' | 'AA' | 'AAA'> = ['A', 'AA', 'AAA'];

      for (const level of levels) {
        const scans: PendingScan[] = [
          {
            scanId: `scan-${level}`,
            url: `https://${level.toLowerCase()}-test.com`,
            wcagLevel: level,
          },
        ];

        const context: PromptContext = {
          scans,
          wcagLevel: level,
        };

        // Act: Generate prompt
        const prompt = await generatePrompt(context);

        // Assert: Verify exact case is preserved
        expect(prompt).toContain(level);
      }
    });

    it('should handle scans with optional fields missing', async () => {
      // Arrange: Scans with minimal required fields
      const scans: PendingScan[] = [
        {
          scanId: 'minimal-001',
          url: 'https://minimal-test.com',
          wcagLevel: 'AA',
          // No email or createdAt
        },
        {
          scanId: 'minimal-002',
          url: 'https://another-minimal.com',
          wcagLevel: 'AA',
          email: 'test@example.com',
          // No createdAt
        },
        {
          scanId: 'minimal-003',
          url: 'https://third-minimal.com',
          wcagLevel: 'AA',
          createdAt: '2024-01-01T00:00:00Z',
          // No email
        },
      ];

      const context: PromptContext = {
        scans,
        wcagLevel: 'AA',
      };

      // Act: Generate prompt
      const prompt = await generatePrompt(context);

      // Assert: All scans should be included
      expect(prompt).toContain('minimal-001');
      expect(prompt).toContain('minimal-002');
      expect(prompt).toContain('minimal-003');
      expect(prompt).toContain('https://minimal-test.com');
      expect(prompt).toContain('https://another-minimal.com');
      expect(prompt).toContain('https://third-minimal.com');
    });
  });
});
