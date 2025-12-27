import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as dns } from 'dns';
import {
  validateUrl,
  isPrivateIP,
  isBlockedHostname,
  normalizeUrl,
} from './url-validator.js';

// Mock dns module
vi.mock('dns', () => ({
  promises: {
    lookup: vi.fn(),
  },
}));

const mockDnsLookup = vi.mocked(dns.lookup);

describe('url-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isPrivateIP', () => {
    describe('IPv4 Private Ranges', () => {
      it('should detect 10.x.x.x range', () => {
        expect(isPrivateIP('10.0.0.1')).toBe(true);
        expect(isPrivateIP('10.255.255.255')).toBe(true);
        expect(isPrivateIP('10.123.45.67')).toBe(true);
      });

      it('should detect 172.16.x.x - 172.31.x.x range', () => {
        expect(isPrivateIP('172.16.0.0')).toBe(true);
        expect(isPrivateIP('172.31.255.255')).toBe(true);
        expect(isPrivateIP('172.20.10.5')).toBe(true);
      });

      it('should detect 192.168.x.x range', () => {
        expect(isPrivateIP('192.168.0.1')).toBe(true);
        expect(isPrivateIP('192.168.255.255')).toBe(true);
        expect(isPrivateIP('192.168.1.100')).toBe(true);
      });

      it('should detect 127.x.x.x loopback range', () => {
        expect(isPrivateIP('127.0.0.1')).toBe(true);
        expect(isPrivateIP('127.255.255.255')).toBe(true);
        expect(isPrivateIP('127.1.2.3')).toBe(true);
      });

      it('should detect 169.254.x.x link-local range', () => {
        expect(isPrivateIP('169.254.0.1')).toBe(true);
        expect(isPrivateIP('169.254.169.254')).toBe(true);
        expect(isPrivateIP('169.254.255.255')).toBe(true);
      });

      it('should detect 0.x.x.x range', () => {
        expect(isPrivateIP('0.0.0.0')).toBe(true);
        expect(isPrivateIP('0.255.255.255')).toBe(true);
      });

      it('should allow public IPv4 addresses', () => {
        expect(isPrivateIP('8.8.8.8')).toBe(false); // Google DNS
        expect(isPrivateIP('1.1.1.1')).toBe(false); // Cloudflare DNS
        expect(isPrivateIP('93.184.216.34')).toBe(false); // example.com
        expect(isPrivateIP('142.250.185.46')).toBe(false); // google.com
      });
    });

    describe('IPv6 Private Ranges', () => {
      it('should detect ::1 loopback', () => {
        expect(isPrivateIP('::1')).toBe(true);
      });

      it('should detect fc00::/7 unique local addresses', () => {
        expect(isPrivateIP('fc00::1')).toBe(true);
        expect(isPrivateIP('fd12:3456:789a::1')).toBe(true);
      });

      it('should detect fe80::/10 link-local addresses', () => {
        expect(isPrivateIP('fe80::1')).toBe(true);
        expect(isPrivateIP('feb0::1234')).toBe(true);
      });

      it('should detect IPv4-mapped IPv6 addresses', () => {
        expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
        expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true);
      });

      it('should allow public IPv6 addresses', () => {
        expect(isPrivateIP('2001:4860:4860::8888')).toBe(false); // Google DNS
        expect(isPrivateIP('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
      });
    });

    describe('Cloud Metadata Endpoints', () => {
      it('should block AWS/GCP/Azure metadata IP', () => {
        expect(isPrivateIP('169.254.169.254')).toBe(true);
      });
    });
  });

  describe('isBlockedHostname', () => {
    describe('Localhost Variations', () => {
      it('should block localhost', () => {
        expect(isBlockedHostname('localhost')).toBe(true);
        expect(isBlockedHostname('LOCALHOST')).toBe(true);
        expect(isBlockedHostname('LocalHost')).toBe(true);
      });

      it('should block .localhost domains', () => {
        expect(isBlockedHostname('app.localhost')).toBe(true);
        expect(isBlockedHostname('test.localhost')).toBe(true);
      });
    });

    describe('Internal/Local TLDs', () => {
      it('should block .local domains', () => {
        expect(isBlockedHostname('server.local')).toBe(true);
        expect(isBlockedHostname('app.local')).toBe(true);
      });

      it('should block .internal domains', () => {
        expect(isBlockedHostname('api.internal')).toBe(true);
        expect(isBlockedHostname('db.internal')).toBe(true);
      });
    });

    describe('Reserved/Example TLDs', () => {
      it('should block .test domains', () => {
        expect(isBlockedHostname('example.test')).toBe(true);
      });

      it('should block .example domains', () => {
        expect(isBlockedHostname('foo.example')).toBe(true);
      });

      it('should block .invalid domains', () => {
        expect(isBlockedHostname('test.invalid')).toBe(true);
      });
    });

    describe('Cloud Metadata Hostnames', () => {
      it('should block metadata.google.internal', () => {
        expect(isBlockedHostname('metadata.google.internal')).toBe(true);
      });
    });

    describe('No TLD Hostnames', () => {
      it('should block hostnames without dots', () => {
        expect(isBlockedHostname('intranet')).toBe(true);
        expect(isBlockedHostname('server')).toBe(true);
      });
    });

    describe('IP Addresses as Hostnames', () => {
      it('should block private IPv4 addresses', () => {
        expect(isBlockedHostname('127.0.0.1')).toBe(true);
        expect(isBlockedHostname('192.168.1.1')).toBe(true);
        expect(isBlockedHostname('10.0.0.1')).toBe(true);
      });

      it('should block IPv6 addresses in brackets', () => {
        expect(isBlockedHostname('[::1]')).toBe(true);
        expect(isBlockedHostname('[fe80::1]')).toBe(true);
      });

      it('should allow public IP addresses', () => {
        expect(isBlockedHostname('8.8.8.8')).toBe(false);
        expect(isBlockedHostname('1.1.1.1')).toBe(false);
      });
    });

    describe('Valid Public Hostnames', () => {
      it('should allow valid public domains', () => {
        expect(isBlockedHostname('example.com')).toBe(false);
        expect(isBlockedHostname('google.com')).toBe(false);
        expect(isBlockedHostname('sub.domain.example.org')).toBe(false);
      });
    });
  });

  describe('normalizeUrl', () => {
    it('should lowercase hostname', () => {
      expect(normalizeUrl('https://EXAMPLE.COM/path')).toBe(
        'https://example.com/path',
      );
      expect(normalizeUrl('http://WWW.EXAMPLE.COM')).toBe(
        'http://www.example.com/',
      );
    });

    it('should remove trailing slash from pathname', () => {
      expect(normalizeUrl('https://example.com/path/')).toBe(
        'https://example.com/path',
      );
      expect(normalizeUrl('https://example.com/path/to/page/')).toBe(
        'https://example.com/path/to/page',
      );
    });

    it('should preserve root path trailing slash', () => {
      expect(normalizeUrl('https://example.com/')).toBe(
        'https://example.com/',
      );
    });

    it('should remove default ports', () => {
      expect(normalizeUrl('http://example.com:80/path')).toBe(
        'http://example.com/path',
      );
      expect(normalizeUrl('https://example.com:443/path')).toBe(
        'https://example.com/path',
      );
    });

    it('should preserve non-default ports', () => {
      expect(normalizeUrl('http://example.com:8080/path')).toBe(
        'http://example.com:8080/path',
      );
      expect(normalizeUrl('https://example.com:8443/path')).toBe(
        'https://example.com:8443/path',
      );
    });

    it('should preserve query strings and fragments', () => {
      expect(normalizeUrl('https://example.com/path?foo=bar')).toBe(
        'https://example.com/path?foo=bar',
      );
      expect(normalizeUrl('https://example.com/path#section')).toBe(
        'https://example.com/path#section',
      );
    });
  });

  describe('validateUrl', () => {
    describe('Valid Public URLs', () => {
      it('should validate example.com', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '93.184.216.34',
          family: 4,
        });

        const result = await validateUrl('https://example.com');

        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe('https://example.com/');
        expect(result.hostname).toBe('example.com');
        expect(result.resolvedIp).toBe('93.184.216.34');
        expect(result.error).toBeUndefined();
      });

      it('should validate google.com', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '142.250.185.46',
          family: 4,
        });

        const result = await validateUrl('https://google.com');

        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe('https://google.com/');
      });

      it('should validate URLs with paths and query strings', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '93.184.216.34',
          family: 4,
        });

        const result = await validateUrl(
          'https://example.com/path/to/page?foo=bar#section',
        );

        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe(
          'https://example.com/path/to/page?foo=bar#section',
        );
      });
    });

    describe('Invalid URL Format', () => {
      it('should reject malformed URLs', async () => {
        const result = await validateUrl('not-a-url');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });

      it('should reject URLs without protocol', async () => {
        const result = await validateUrl('example.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });
    });

    describe('Invalid Protocols', () => {
      it('should reject ftp:// protocol', async () => {
        const result = await validateUrl('ftp://example.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid protocol');
      });

      it('should reject file:// protocol', async () => {
        const result = await validateUrl('file:///etc/passwd');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid protocol');
      });

      it('should reject javascript: protocol', async () => {
        const result = await validateUrl('javascript:alert(1)');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid protocol');
      });

      it('should reject data: protocol', async () => {
        const result = await validateUrl('data:text/html,<h1>Test</h1>');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid protocol');
      });
    });

    describe('URLs with Credentials', () => {
      it('should reject URLs with username and password', async () => {
        const result = await validateUrl('https://user:pass@example.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URLs with credentials are not allowed');
      });

      it('should reject URLs with username only', async () => {
        const result = await validateUrl('https://user@example.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URLs with credentials are not allowed');
      });
    });

    describe('Localhost Variations', () => {
      it('should reject localhost', async () => {
        const result = await validateUrl('http://localhost');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });

      it('should reject 127.0.0.1', async () => {
        const result = await validateUrl('http://127.0.0.1');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });

      it('should reject [::1]', async () => {
        const result = await validateUrl('http://[::1]');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });
    });

    describe('Private IP Addresses', () => {
      it('should reject 10.x.x.x range', async () => {
        const result = await validateUrl('http://10.0.0.1');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });

      it('should reject 172.16.x.x range', async () => {
        const result = await validateUrl('http://172.16.0.1');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });

      it('should reject 192.168.x.x range', async () => {
        const result = await validateUrl('http://192.168.1.1');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });
    });

    describe('DNS Rebinding Protection', () => {
      it('should reject if hostname resolves to private IP', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '192.168.1.100',
          family: 4,
        });

        const result = await validateUrl('http://attacker.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Resolved to private IP address');
        expect(result.resolvedIp).toBe('192.168.1.100');
      });

      it('should reject if hostname resolves to 127.x.x.x', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '127.0.0.1',
          family: 4,
        });

        const result = await validateUrl('http://rebinding-attack.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Resolved to private IP address');
      });

      it('should reject if hostname resolves to metadata IP', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '169.254.169.254',
          family: 4,
        });

        const result = await validateUrl('http://metadata-attack.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Resolved to private IP address');
      });
    });

    describe('Cloud Metadata Endpoints', () => {
      it('should reject 169.254.169.254 (AWS metadata)', async () => {
        const result = await validateUrl('http://169.254.169.254');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });

      it('should reject metadata.google.internal', async () => {
        const result = await validateUrl('http://metadata.google.internal');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });
    });

    describe('Internal/Local Domains', () => {
      it('should reject .local domains', async () => {
        const result = await validateUrl('http://server.local');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });

      it('should reject .internal domains', async () => {
        const result = await validateUrl('http://api.internal');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });

      it('should reject .test domains', async () => {
        const result = await validateUrl('http://example.test');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });
    });

    describe('DNS Resolution Failures', () => {
      it('should reject if DNS lookup fails', async () => {
        mockDnsLookup.mockRejectedValue(new Error('ENOTFOUND'));

        const result = await validateUrl('https://nonexistent-domain-12345.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('DNS resolution failed');
      });
    });

    describe('URLs with Ports', () => {
      it('should validate public URL with custom port', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '93.184.216.34',
          family: 4,
        });

        const result = await validateUrl('https://example.com:8443');

        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe('https://example.com:8443/');
      });

      it('should reject private IP with custom port', async () => {
        const result = await validateUrl('http://192.168.1.1:8080');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Blocked hostname');
      });
    });

    describe('Edge Cases', () => {
      it('should handle uppercase hostnames', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '93.184.216.34',
          family: 4,
        });

        const result = await validateUrl('https://EXAMPLE.COM');

        expect(result.isValid).toBe(true);
        expect(result.hostname).toBe('example.com');
        expect(result.normalizedUrl).toBe('https://example.com/');
      });

      it('should handle URLs with trailing slashes', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '93.184.216.34',
          family: 4,
        });

        const result = await validateUrl('https://example.com/path/');

        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe('https://example.com/path');
      });

      it('should handle internationalized domain names (IDN)', async () => {
        mockDnsLookup.mockResolvedValue({
          address: '93.184.216.34',
          family: 4,
        });

        // Punycode encoded IDN
        const result = await validateUrl('https://xn--e1afmkfd.xn--p1ai');

        expect(result.isValid).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should handle unexpected errors gracefully', async () => {
        mockDnsLookup.mockRejectedValue(new Error('Unexpected error'));

        const result = await validateUrl('https://example.com');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('DNS resolution failed');
      });
    });
  });
});
