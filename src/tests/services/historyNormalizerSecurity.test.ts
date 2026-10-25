import { describe, expect, it } from 'vitest';

import { normalizeRecord } from '../../services/historyNormalizer';

describe('History Normalizer Security & Phishing Defense', () => {
  it('enforces canonical leetcode.com URL even if imported file contains off-domain URL', () => {
    const malicious = {
      slug: 'two-sum',
      url: 'https://evil-phishing.com/fake-login',
      attemptedAt: 1700000000000,
    };

    const result = normalizeRecord(malicious);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Must be sanitized to safe canonical LeetCode problem URL
    expect(result.value.url).toBe('https://leetcode.com/problems/two-sum/');
  });

  it('rejects javascript: and data: URLs and falls back to safe problemUrl', () => {
    const malicious = {
      slug: 'reverse-linked-list',
      url: 'javascript:alert(document.cookie)',
      attemptedAt: 1700000000000,
    };

    const result = normalizeRecord(malicious);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.url).toBe('https://leetcode.com/problems/reverse-linked-list/');
  });

  it('preserves valid leetcode.com problem URLs', () => {
    const record = {
      slug: 'lru-cache',
      url: 'https://leetcode.com/problems/lru-cache/',
      attemptedAt: 1700000000000,
    };

    const result = normalizeRecord(record);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.url).toBe('https://leetcode.com/problems/lru-cache/');
  });

  it('handles prototype pollution attempts in imported records gracefully', () => {
    const polluted = JSON.parse(
      '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"evil":true}},"slug":"3sum","attemptedAt":1700000000000}',
    );

    const result = normalizeRecord(polluted);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.slug).toBe('3sum');
    // Ensure prototype was NOT modified
    // @ts-expect-error testing prototype pollution
    expect(Object.prototype.polluted).toBeUndefined();
    // @ts-expect-error testing prototype pollution
    expect(Object.prototype.evil).toBeUndefined();
  });

  it('neutralizes CSV formula injection in imported title and language fields', () => {
    const formulaPayload = {
      slug: 'two-sum',
      title: "=cmd|' /C calc'!A0",
      language: '+cmd|',
      attemptedAt: 1700000000000,
    };

    const result = normalizeRecord(formulaPayload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Must be prepended with single-quote to neutralize Excel / Calc macro execution
    expect(result.value.title).toBe("'=cmd|' /C calc'!A0");
    expect(result.value.language).toBe("'+cmd|");
  });
});
