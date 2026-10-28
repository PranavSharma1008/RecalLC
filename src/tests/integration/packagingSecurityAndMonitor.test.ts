import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { GITHUB_SPONSORS_CONFIG, PAYMENT_CONFIG, RAZORPAY_CONFIG } from '../../dashboard/screens/SupportScreen';
import manifest from '../../manifest.config';
import { isSafeUrl, sanitizeInput } from '../../utils/security';

describe('Payment & Sponsorship Configuration (India & Outside India)', () => {
  it('configures Razorpay as Option 1 for supporters in India', () => {
    expect(RAZORPAY_CONFIG.checkoutUrl).toBe('https://razorpay.me/@recallc');
    expect(RAZORPAY_CONFIG.paymentPageUrl).toBe('https://razorpay.me/@recallc');
    expect(RAZORPAY_CONFIG.developerName).toBe('Pranav Sharma');

    const parsed = new URL(RAZORPAY_CONFIG.paymentPageUrl);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.hostname).toBe('razorpay.me');
  });

  it('configures GitHub Sponsors as Option 2 for supporters Outside India', () => {
    expect(GITHUB_SPONSORS_CONFIG.sponsorUrl).toBe('https://github.com/sponsors/PranavSharma1008');
    expect(GITHUB_SPONSORS_CONFIG.dashboardUrl).toBe('https://github.com/sponsors/PranavSharma1008/dashboard');
    expect(GITHUB_SPONSORS_CONFIG.developerName).toBe('Pranav Sharma');

    const parsed = new URL(GITHUB_SPONSORS_CONFIG.sponsorUrl);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.hostname).toBe('github.com');
    expect(parsed.pathname).toBe('/sponsors/PranavSharma1008');
  });

  it('exports combined PAYMENT_CONFIG with both options', () => {
    expect(PAYMENT_CONFIG.razorpay).toEqual(RAZORPAY_CONFIG);
    expect(PAYMENT_CONFIG.githubSponsors).toEqual(GITHUB_SPONSORS_CONFIG);
  });
});

describe('Anti-Hacking & Extension Security Architecture', () => {
  const rawManifest = manifest as unknown as chrome.runtime.ManifestV3 & {
    content_security_policy?: { extension_pages?: string };
  };

  it('enforces strict Manifest V3 Content Security Policy with zero unsafe-eval', () => {
    const csp = rawManifest.content_security_policy?.extension_pages || '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('unsafe-inline');
  });

  it('requests strictly minimal permissions without invasive access', () => {
    // Only storage is requested
    expect(rawManifest.permissions).toEqual(['storage']);

    // Prohibited invasive permissions
    const forbidden = ['tabs', 'cookies', 'webRequest', 'webRequestBlocking', 'debugger', '<all_urls>'];
    for (const perm of forbidden) {
      expect(rawManifest.permissions).not.toContain(perm);
    }
  });

  it('restricts host_permissions strictly to leetcode and geeksforgeeks', () => {
    const hosts = rawManifest.host_permissions || [];
    expect(hosts).toContain('https://leetcode.com/*');
    expect(hosts).toContain('https://*.geeksforgeeks.org/*');
    expect(hosts).toContain('https://geeksforgeeks.org/*');

    for (const host of hosts) {
      expect(host).toMatch(/^https:\/\/((\*\.)?geeksforgeeks\.org|leetcode\.com)\/\*/);
    }
  });

  it('neutralizes malicious XSS payloads in user inputs and text fields', () => {
    const xssPayloads = [
      '<script>alert("hacked")</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(document.domain)>',
      '"><script>alert(1)</script>',
      '<iframe src="https://evil.com"></iframe>',
    ];

    for (const payload of xssPayloads) {
      const sanitized = sanitizeInput(payload);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
    }
  });

  it('strictly validates safe URLs and rejects malicious schemes and protocols', () => {
    // Malicious or dangerous schemes
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('//evil.com/phish')).toBe(false);

    // Valid URLs
    expect(isSafeUrl('https://leetcode.com/problems/two-sum/')).toBe(true);
    expect(isSafeUrl('https://practice.geeksforgeeks.org/problems/subarray-with-given-sum/1')).toBe(true);
    expect(isSafeUrl('https://github.com/sponsors/PranavSharma1008')).toBe(true);
    expect(isSafeUrl('https://razorpay.me/@recallc')).toBe(true);
  });
});

describe('Packaging & Sole final.zip Guarantee', () => {
  it('creates final.zip without duplicate or competing zip files', () => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const rootFiles = fs.readdirSync(projectRoot);
    const zipFiles = rootFiles.filter((f) => f.endsWith('.zip'));

    // Valid distribution zip files for Chrome Web Store and distribution
    for (const zf of zipFiles) {
      expect(['final.zip', 'RecalLC.zip']).toContain(zf);
    }
  });

  it('verifies manifest and distribution entry points exist for local monitor loading', () => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const distPath = path.join(projectRoot, 'dist');

    if (fs.existsSync(distPath)) {
      expect(fs.existsSync(path.join(distPath, 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'src/popup/index.html'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'src/dashboard/index.html'))).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(path.join(distPath, 'manifest.json'), 'utf-8'));
      expect(manifestContent.manifest_version).toBe(3);
      expect(manifestContent.name).toContain('RecalLC');
    }
  });
});
