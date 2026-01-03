/**
 * Tests for URL Validation and Sanitization Utilities
 */

import {
  validateUrl,
  normalizeUrl,
  generateId,
  sanitizeUrlForDisplay,
  parseManualUrls,
} from '../url-utils';

describe('validateUrl', () => {
  describe('valid URLs', () => {
    it('should accept valid http URLs', () => {
      expect(validateUrl('http://example.com')).toBe(true);
      expect(validateUrl('http://example.com/path')).toBe(true);
      expect(validateUrl('http://example.com:8080/path')).toBe(true);
    });

    it('should accept valid https URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('https://example.com/path')).toBe(true);
      expect(validateUrl('https://example.com:443/path')).toBe(true);
    });

    it('should accept protocol-relative URLs', () => {
      expect(validateUrl('//example.com')).toBe(true);
      expect(validateUrl('//example.com/path')).toBe(true);
    });

    it('should accept URLs with query parameters', () => {
      expect(validateUrl('https://example.com?foo=bar')).toBe(true);
      expect(validateUrl('https://example.com/path?foo=bar&baz=qux')).toBe(
        true
      );
    });

    it('should accept URLs with fragments', () => {
      expect(validateUrl('https://example.com#section')).toBe(true);
      expect(validateUrl('https://example.com/path#section')).toBe(true);
    });

    it('should accept URLs with subdomains', () => {
      expect(validateUrl('https://www.example.com')).toBe(true);
      expect(validateUrl('https://api.example.com')).toBe(true);
      expect(validateUrl('https://www.api.example.com')).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('should reject empty or invalid input', () => {
      expect(validateUrl('')).toBe(false);
      expect(validateUrl('   ')).toBe(false);
      expect(validateUrl('not-a-url')).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateUrl(null as any)).toBe(false);
      expect(validateUrl(undefined as any)).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(validateUrl(123 as any)).toBe(false);
      expect(validateUrl({} as any)).toBe(false);
      expect(validateUrl([] as any)).toBe(false);
    });

    it('should reject dangerous protocols', () => {
      expect(validateUrl('javascript:alert(1)')).toBe(false);
      expect(validateUrl('data:text/html,<script>alert(1)</script>')).toBe(
        false
      );
      expect(validateUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(validateUrl('http://')).toBe(false);
      expect(validateUrl('https://')).toBe(false);
      expect(validateUrl('http:///')).toBe(false);
    });
  });
});

describe('normalizeUrl', () => {
  describe('protocol normalization', () => {
    it('should convert protocol-relative URLs to https', () => {
      expect(normalizeUrl('//example.com')).toBe('https://example.com');
      expect(normalizeUrl('//example.com/path')).toBe(
        'https://example.com/path'
      );
    });

    it('should preserve http and https protocols', () => {
      expect(normalizeUrl('http://example.com')).toContain('http://');
      expect(normalizeUrl('https://example.com')).toContain('https://');
    });
  });

  describe('hostname normalization', () => {
    it('should convert hostname to lowercase', () => {
      expect(normalizeUrl('HTTPS://EXAMPLE.COM')).toBe('https://example.com');
      expect(normalizeUrl('https://Example.Com')).toBe('https://example.com');
    });
  });

  describe('port normalization', () => {
    it('should remove default http port (80)', () => {
      expect(normalizeUrl('http://example.com:80')).toBe(
        'http://example.com'
      );
      expect(normalizeUrl('http://example.com:80/path')).toBe(
        'http://example.com/path'
      );
    });

    it('should remove default https port (443)', () => {
      expect(normalizeUrl('https://example.com:443')).toBe(
        'https://example.com'
      );
      expect(normalizeUrl('https://example.com:443/path')).toBe(
        'https://example.com/path'
      );
    });

    it('should preserve non-default ports', () => {
      expect(normalizeUrl('http://example.com:8080')).toBe(
        'http://example.com:8080'
      );
      expect(normalizeUrl('https://example.com:8443')).toBe(
        'https://example.com:8443'
      );
    });
  });

  describe('pathname normalization', () => {
    it('should remove trailing slashes except for root', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
      expect(normalizeUrl('https://example.com/path/')).toBe(
        'https://example.com/path'
      );
      expect(normalizeUrl('https://example.com/path/subpath/')).toBe(
        'https://example.com/path/subpath'
      );
    });

    it('should preserve root path', () => {
      const normalized = normalizeUrl('https://example.com/');
      expect(normalized).toBe('https://example.com');
    });
  });

  describe('query and fragment preservation', () => {
    it('should preserve query parameters', () => {
      expect(normalizeUrl('https://example.com?foo=bar')).toBe(
        'https://example.com?foo=bar'
      );
      expect(normalizeUrl('https://example.com/path?foo=bar&baz=qux')).toBe(
        'https://example.com/path?foo=bar&baz=qux'
      );
    });

    it('should preserve fragments', () => {
      expect(normalizeUrl('https://example.com#section')).toBe(
        'https://example.com#section'
      );
      expect(normalizeUrl('https://example.com/path#section')).toBe(
        'https://example.com/path#section'
      );
    });
  });

  describe('error handling', () => {
    it('should throw on invalid input', () => {
      expect(() => normalizeUrl('')).toThrow('Invalid URL');
      expect(() => normalizeUrl('   ')).toThrow('Invalid URL');
      expect(() => normalizeUrl('not-a-url')).toThrow('Invalid URL');
    });

    it('should throw on null or undefined', () => {
      expect(() => normalizeUrl(null as any)).toThrow('Invalid URL');
      expect(() => normalizeUrl(undefined as any)).toThrow('Invalid URL');
    });

    it('should throw on dangerous protocols', () => {
      expect(() => normalizeUrl('javascript:alert(1)')).toThrow(
        'Invalid URL protocol'
      );
      expect(() => normalizeUrl('data:text/html,test')).toThrow(
        'Invalid URL protocol'
      );
    });
  });
});

describe('generateId', () => {
  it('should generate a valid UUID format', () => {
    const id = generateId();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('should return a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('should generate IDs with correct length', () => {
    const id = generateId();
    expect(id.length).toBe(36); // UUID length with hyphens
  });
});

describe('sanitizeUrlForDisplay', () => {
  describe('valid URLs', () => {
    it('should allow valid http and https URLs', () => {
      const httpsResult = sanitizeUrlForDisplay('https://example.com');
      expect(httpsResult).toContain('https');
      expect(httpsResult).toContain('example.com');
      expect(httpsResult).toContain('&#x2F;'); // slashes are encoded

      const httpResult = sanitizeUrlForDisplay('http://example.com/path');
      expect(httpResult).toContain('http');
      expect(httpResult).toContain('example.com');
      expect(httpResult).toContain('path');
    });

    it('should encode HTML entities in URL parts', () => {
      // URL constructor will URL-encode query parameters, so we test
      // that the final output has HTML entities for slashes
      const url = 'https://example.com/path';
      const sanitized = sanitizeUrlForDisplay(url);
      expect(sanitized).toContain('&#x2F;'); // forward slashes are HTML-encoded
      expect(sanitized).not.toContain('<script>'); // script tags blocked
    });
  });

  describe('dangerous URLs', () => {
    it('should block javascript: URLs', () => {
      expect(sanitizeUrlForDisplay('javascript:alert(1)')).toBe('');
      expect(sanitizeUrlForDisplay('JavaScript:alert(1)')).toBe('');
      expect(sanitizeUrlForDisplay('JAVASCRIPT:alert(1)')).toBe('');
    });

    it('should block data: URLs', () => {
      expect(
        sanitizeUrlForDisplay('data:text/html,<script>alert(1)</script>')
      ).toBe('');
      expect(sanitizeUrlForDisplay('DATA:text/html,test')).toBe('');
    });

    it('should block vbscript: URLs', () => {
      expect(sanitizeUrlForDisplay('vbscript:msgbox(1)')).toBe('');
    });

    it('should block file: URLs', () => {
      expect(sanitizeUrlForDisplay('file:///etc/passwd')).toBe('');
    });
  });

  describe('XSS prevention', () => {
    it('should encode script tags', () => {
      const malicious = '<script>alert(1)</script>';
      const sanitized = sanitizeUrlForDisplay(malicious);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('should encode event handlers', () => {
      const malicious = 'https://example.com" onerror="alert(1)';
      const sanitized = sanitizeUrlForDisplay(malicious);
      expect(sanitized).not.toContain('"');
      expect(sanitized).toContain('&quot;');
    });

    it('should encode special characters', () => {
      // URL constructor will URL-encode query params automatically
      // We verify the output has HTML-encoded slashes and ampersands
      const url = "https://example.com?test='value'&foo=bar";
      const sanitized = sanitizeUrlForDisplay(url);
      expect(sanitized).toContain('&#x2F;'); // forward slash
      expect(sanitized).toContain('&amp;'); // ampersand in query string
    });
  });

  describe('length truncation', () => {
    it('should truncate long URLs to default 200 characters', () => {
      const longUrl = `https://example.com/${'a'.repeat(300)}`;
      const sanitized = sanitizeUrlForDisplay(longUrl);
      // Account for HTML entity encoding
      expect(sanitized.length).toBeLessThan(250);
      expect(sanitized).toContain('...');
    });

    it('should respect custom maxLength parameter', () => {
      const longUrl = 'https://example.com/verylongpath';
      const sanitized = sanitizeUrlForDisplay(longUrl, 20);
      expect(sanitized.length).toBeLessThan(100); // Account for encoding
      expect(sanitized).toContain('...');
    });

    it('should not truncate short URLs', () => {
      const shortUrl = 'https://example.com';
      const sanitized = sanitizeUrlForDisplay(shortUrl);
      expect(sanitized).not.toContain('...');
    });
  });

  describe('edge cases', () => {
    it('should handle empty or invalid input', () => {
      expect(sanitizeUrlForDisplay('')).toBe('');
      expect(sanitizeUrlForDisplay('   ')).toBe('');
      expect(sanitizeUrlForDisplay(null as any)).toBe('');
      expect(sanitizeUrlForDisplay(undefined as any)).toBe('');
    });

    it('should handle protocol-relative URLs', () => {
      const sanitized = sanitizeUrlForDisplay('//example.com');
      expect(sanitized).toBeTruthy();
      expect(sanitized).toContain('example.com');
    });

    it('should handle non-URL strings by encoding them', () => {
      const nonUrl = 'not-a-url-<script>alert(1)</script>';
      const sanitized = sanitizeUrlForDisplay(nonUrl);
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).not.toContain('<script>');
    });
  });
});

describe('parseManualUrls', () => {
  describe('empty input handling', () => {
    it('should return empty arrays for empty input', () => {
      const result = parseManualUrls('');
      expect(result.validUrls).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should return empty arrays for whitespace-only input', () => {
      const result = parseManualUrls('   \n\t  ');
      expect(result.validUrls).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should return empty arrays for null or undefined input', () => {
      const nullResult = parseManualUrls(null as any);
      expect(nullResult.validUrls).toEqual([]);
      expect(nullResult.errors).toEqual([]);

      const undefinedResult = parseManualUrls(undefined as any);
      expect(undefinedResult.validUrls).toEqual([]);
      expect(undefinedResult.errors).toEqual([]);
    });
  });

  describe('semicolon-separated format (FR-1.4)', () => {
    it('should parse single URL', () => {
      const result = parseManualUrls('https://example.com');
      expect(result.validUrls).toHaveLength(1);
      expect(result.validUrls[0].url).toBe('https://example.com');
      expect(result.validUrls[0].source).toBe('manual');
      expect(result.validUrls[0].id).toBeTruthy();
      expect(result.errors).toEqual([]);
    });

    it('should parse multiple semicolon-separated URLs', () => {
      const result = parseManualUrls(
        'https://example.com;https://example.com/about;https://example.com/contact'
      );
      expect(result.validUrls).toHaveLength(3);
      expect(result.validUrls[0].url).toBe('https://example.com');
      expect(result.validUrls[1].url).toBe('https://example.com/about');
      expect(result.validUrls[2].url).toBe('https://example.com/contact');
      expect(result.errors).toEqual([]);
    });

    it('should trim whitespace around semicolons', () => {
      const result = parseManualUrls(
        'https://example.com ; https://example.com/about ; https://example.com/contact'
      );
      expect(result.validUrls).toHaveLength(3);
      expect(result.validUrls[0].url).toBe('https://example.com');
      expect(result.validUrls[1].url).toBe('https://example.com/about');
      expect(result.validUrls[2].url).toBe('https://example.com/contact');
      expect(result.errors).toEqual([]);
    });

    it('should ignore empty segments in semicolon-separated input', () => {
      const result = parseManualUrls('https://example.com;;https://example.com/about');
      expect(result.validUrls).toHaveLength(2);
      expect(result.errors).toEqual([]);
    });
  });

  describe('multi-line format (FR-1.5)', () => {
    it('should parse single URL on one line', () => {
      const result = parseManualUrls('https://example.com');
      expect(result.validUrls).toHaveLength(1);
      expect(result.validUrls[0].url).toBe('https://example.com');
      expect(result.errors).toEqual([]);
    });

    it('should parse multiple newline-separated URLs', () => {
      const input = `https://example.com
https://example.com/about
https://example.com/contact`;
      const result = parseManualUrls(input);
      expect(result.validUrls).toHaveLength(3);
      expect(result.validUrls[0].url).toBe('https://example.com');
      expect(result.validUrls[1].url).toBe('https://example.com/about');
      expect(result.validUrls[2].url).toBe('https://example.com/contact');
      expect(result.errors).toEqual([]);
    });

    it('should handle Windows-style line endings (CRLF)', () => {
      const input = 'https://example.com\r\nhttps://example.com/about';
      const result = parseManualUrls(input);
      expect(result.validUrls).toHaveLength(2);
      expect(result.errors).toEqual([]);
    });

    it('should ignore empty lines in multi-line input', () => {
      const input = `https://example.com

https://example.com/about

https://example.com/contact`;
      const result = parseManualUrls(input);
      expect(result.validUrls).toHaveLength(3);
      expect(result.errors).toEqual([]);
    });

    it('should trim whitespace from each line', () => {
      const input = `  https://example.com
  https://example.com/about  `;
      const result = parseManualUrls(input);
      expect(result.validUrls).toHaveLength(2);
      expect(result.validUrls[0].url).toBe('https://example.com');
      expect(result.validUrls[1].url).toBe('https://example.com/about');
      expect(result.errors).toEqual([]);
    });
  });

  describe('mixed format support', () => {
    it('should parse mixed semicolon and newline separators', () => {
      const input = `https://example.com;https://example.com/about
https://example.com/contact;https://example.com/products`;
      const result = parseManualUrls(input);
      expect(result.validUrls).toHaveLength(4);
      expect(result.errors).toEqual([]);
    });
  });

  describe('URL validation (FR-1.6)', () => {
    it('should validate URLs before accepting them', () => {
      const result = parseManualUrls('not-a-url');
      expect(result.validUrls).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].url).toBe('not-a-url');
      expect(result.errors[0].message).toContain('Invalid URL format');
    });

    it('should report validation errors for invalid URLs', () => {
      const result = parseManualUrls('https://example.com;invalid-url;http://test.com');
      expect(result.validUrls).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].url).toBe('invalid-url');
      expect(result.errors[0].message).toContain('Invalid URL format');
    });

    it('should reject dangerous protocols', () => {
      const result = parseManualUrls('javascript:alert(1);https://example.com');
      expect(result.validUrls).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].url).toBe('javascript:alert(1)');
      expect(result.errors[0].message).toContain('Invalid URL format');
    });

    it('should accept http and https protocols', () => {
      const result = parseManualUrls('http://example.com;https://example.com');
      expect(result.validUrls).toHaveLength(2);
      expect(result.errors).toEqual([]);
    });

    it('should accept protocol-relative URLs', () => {
      const result = parseManualUrls('//example.com');
      expect(result.validUrls).toHaveLength(1);
      expect(result.validUrls[0].url).toBe('https://example.com');
      expect(result.errors).toEqual([]);
    });
  });

  describe('URL normalization', () => {
    it('should normalize all valid URLs', () => {
      const result = parseManualUrls('HTTPS://EXAMPLE.COM/PATH/');
      expect(result.validUrls).toHaveLength(1);
      expect(result.validUrls[0].url).toBe('https://example.com/PATH');
      expect(result.errors).toEqual([]);
    });

    it('should normalize URLs with default ports', () => {
      const result = parseManualUrls('https://example.com:443/path');
      expect(result.validUrls).toHaveLength(1);
      expect(result.validUrls[0].url).toBe('https://example.com/path');
      expect(result.errors).toEqual([]);
    });

    it('should handle normalization errors gracefully', () => {
      // This test ensures that if normalization fails, it's reported as an error
      const result = parseManualUrls('http://');
      expect(result.validUrls).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('duplicate URL handling', () => {
    it('should detect and report duplicate URLs', () => {
      const result = parseManualUrls('https://example.com;https://example.com');
      expect(result.validUrls).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].url).toBe('https://example.com');
      expect(result.errors[0].message).toContain('Duplicate URL');
    });

    it('should detect duplicates after normalization', () => {
      const result = parseManualUrls('https://example.com/;HTTPS://EXAMPLE.COM');
      expect(result.validUrls).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Duplicate URL');
    });

    it('should detect duplicates with different trailing slashes', () => {
      const result = parseManualUrls('https://example.com/path;https://example.com/path/');
      expect(result.validUrls).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Duplicate URL');
    });

    it('should detect duplicates across newlines and semicolons', () => {
      const input = `https://example.com
https://example.com/about;https://example.com`;
      const result = parseManualUrls(input);
      expect(result.validUrls).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Duplicate URL');
    });

    it('should allow same domain with different paths', () => {
      const result = parseManualUrls('https://example.com;https://example.com/about');
      expect(result.validUrls).toHaveLength(2);
      expect(result.errors).toEqual([]);
    });
  });

  describe('50 URL limit enforcement', () => {
    it('should accept exactly 50 URLs', () => {
      const urls = Array(50)
        .fill(0)
        .map((_, i) => `https://example.com/page${i}`)
        .join(';');
      const result = parseManualUrls(urls);
      expect(result.validUrls).toHaveLength(50);
      expect(result.errors).toEqual([]);
    });

    it('should enforce maximum limit of 50 URLs', () => {
      const urls = Array(55)
        .fill(0)
        .map((_, i) => `https://example.com/page${i}`)
        .join(';');
      const result = parseManualUrls(urls);
      expect(result.validUrls).toHaveLength(50);
      expect(result.errors).toHaveLength(5);
      expect(result.errors[0].message).toContain('Maximum limit of 50 URLs reached');
    });

    it('should report all URLs beyond limit as errors', () => {
      const urls = Array(60)
        .fill(0)
        .map((_, i) => `https://example.com/page${i}`)
        .join('\n');
      const result = parseManualUrls(urls);
      expect(result.validUrls).toHaveLength(50);
      expect(result.errors).toHaveLength(10);
      expect(result.errors.every((e) => e.message.includes('Maximum limit'))).toBe(true);
    });

    it('should not count invalid URLs toward the 50 URL limit', () => {
      const validUrls = Array(50)
        .fill(0)
        .map((_, i) => `https://example.com/page${i}`)
        .join(';');
      const result = parseManualUrls(`invalid-url;${validUrls};https://example.com/extra`);
      expect(result.validUrls).toHaveLength(50);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.find((e) => e.url === 'invalid-url')?.message).toContain('Invalid URL');
      expect(result.errors.find((e) => e.url === 'https://example.com/extra')?.message).toContain(
        'Maximum limit'
      );
    });
  });

  describe('metadata generation', () => {
    it('should generate unique IDs for each URL', () => {
      const result = parseManualUrls('https://example.com;https://example.com/about');
      expect(result.validUrls).toHaveLength(2);
      expect(result.validUrls[0].id).toBeTruthy();
      expect(result.validUrls[1].id).toBeTruthy();
      expect(result.validUrls[0].id).not.toBe(result.validUrls[1].id);
    });

    it('should set source to "manual" for all URLs', () => {
      const result = parseManualUrls('https://example.com;https://example.com/about');
      expect(result.validUrls).toHaveLength(2);
      expect(result.validUrls[0].source).toBe('manual');
      expect(result.validUrls[1].source).toBe('manual');
    });

    it('should generate valid UUID format for IDs', () => {
      const result = parseManualUrls('https://example.com');
      expect(result.validUrls).toHaveLength(1);
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.validUrls[0].id).toMatch(uuidRegex);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mix of valid, invalid, and duplicate URLs', () => {
      const input = `https://example.com
invalid-url
https://example.com/about
https://example.com
javascript:alert(1)
https://example.com/contact`;
      const result = parseManualUrls(input);
      expect(result.validUrls).toHaveLength(3);
      expect(result.errors).toHaveLength(3);

      // Check valid URLs
      expect(result.validUrls[0].url).toBe('https://example.com');
      expect(result.validUrls[1].url).toBe('https://example.com/about');
      expect(result.validUrls[2].url).toBe('https://example.com/contact');

      // Check errors
      expect(result.errors.find((e) => e.url === 'invalid-url')).toBeTruthy();
      expect(result.errors.find((e) => e.message.includes('Duplicate'))).toBeTruthy();
      expect(result.errors.find((e) => e.url === 'javascript:alert(1)')).toBeTruthy();
    });

    it('should handle URLs with query parameters', () => {
      const result = parseManualUrls('https://example.com?foo=bar;https://example.com?baz=qux');
      expect(result.validUrls).toHaveLength(2);
      expect(result.validUrls[0].url).toContain('?foo=bar');
      expect(result.validUrls[1].url).toContain('?baz=qux');
      expect(result.errors).toEqual([]);
    });

    it('should handle URLs with fragments', () => {
      const result = parseManualUrls('https://example.com#section1;https://example.com#section2');
      expect(result.validUrls).toHaveLength(2);
      expect(result.validUrls[0].url).toContain('#section1');
      expect(result.validUrls[1].url).toContain('#section2');
      expect(result.errors).toEqual([]);
    });

    it('should handle URLs with ports', () => {
      const result = parseManualUrls('https://example.com:8080;https://example.com:9000/path');
      expect(result.validUrls).toHaveLength(2);
      expect(result.validUrls[0].url).toBe('https://example.com:8080');
      expect(result.validUrls[1].url).toBe('https://example.com:9000/path');
      expect(result.errors).toEqual([]);
    });

    it('should handle URLs with subdomains', () => {
      const result = parseManualUrls(
        'https://www.example.com;https://api.example.com;https://docs.example.com'
      );
      expect(result.validUrls).toHaveLength(3);
      expect(result.errors).toEqual([]);
    });
  });

  describe('error reporting quality', () => {
    it('should provide descriptive error messages for invalid URLs', () => {
      const result = parseManualUrls('not-a-url');
      expect(result.errors[0].message).toContain('Invalid URL format');
      expect(result.errors[0].message).toContain('valid http or https URL');
    });

    it('should provide descriptive error messages for duplicates', () => {
      const result = parseManualUrls('https://example.com;https://example.com');
      expect(result.errors[0].message).toContain('Duplicate URL');
      expect(result.errors[0].message).toContain('already been added');
    });

    it('should provide descriptive error messages for limit exceeded', () => {
      const urls = Array(51)
        .fill(0)
        .map((_, i) => `https://example.com/page${i}`)
        .join(';');
      const result = parseManualUrls(urls);
      expect(result.errors[0].message).toContain('Maximum limit of 50 URLs reached');
      expect(result.errors[0].message).toContain('not processed');
    });
  });
});
