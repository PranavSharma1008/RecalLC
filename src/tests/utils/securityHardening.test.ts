import { beforeEach, describe, expect, it } from 'vitest';

import {
  generateSalt,
  getFailedAttempts,
  getLockoutRemainingSeconds,
  hashPasscode,
  isLockedOut,
  isSafeUrl,
  recordFailedAttempt,
  resetFailedAttempts,
  sanitizeInput,
  setSessionUnlocked,
  timingSafeEqual,
  verifyPasscode,
} from '../../utils/security';

describe('Security Hardening & Penetration Defense', () => {
  beforeEach(() => {
    resetFailedAttempts();
    setSessionUnlocked(false);
  });

  describe('timingSafeEqual', () => {
    it('returns true for identical strings', () => {
      expect(timingSafeEqual('a7f9b8c2', 'a7f9b8c2')).toBe(true);
      expect(timingSafeEqual('', '')).toBe(true);
      expect(
        timingSafeEqual(
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        ),
      ).toBe(true);
    });

    it('returns false for different lengths without early character matching leak', () => {
      expect(timingSafeEqual('abc', 'abcd')).toBe(false);
      expect(timingSafeEqual('abcd', 'abc')).toBe(false);
      expect(timingSafeEqual('', 'a')).toBe(false);
    });

    it('returns false for strings of same length with different characters', () => {
      expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
      expect(timingSafeEqual('xbcdef', 'abcdef')).toBe(false);
      expect(timingSafeEqual('12345678', '87654321')).toBe(false);
    });

    it('rejects non-string inputs safely', () => {
      // @ts-expect-error Testing invalid types
      expect(timingSafeEqual(null, 'test')).toBe(false);
      // @ts-expect-error Testing invalid types
      expect(timingSafeEqual('test', undefined)).toBe(false);
    });
  });

  describe('Cryptographic Passcode Hashing (SHA-256 + Salt + Pepper)', () => {
    it('produces 64-character hex digests (256 bits)', async () => {
      const salt = generateSalt();
      const hash = await hashPasscode('master1234', salt);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is immune to empty or swapped parameters', async () => {
      const salt = generateSalt();
      const hash1 = await hashPasscode('passcodeA', salt);
      const hash2 = await hashPasscode('passcodeB', salt);
      expect(hash1).not.toBe(hash2);

      const isValid = await verifyPasscode('wrong', hash1, salt);
      expect(isValid).toBe(false);

      const isCorrect = await verifyPasscode('passcodeA', hash1, salt);
      expect(isCorrect).toBe(true);
    });
  });

  describe('Tamper-Resistant Anti-Brute-Force Rate Limiting', () => {
    it('locks out strictly after MAX_FAILED_ATTEMPTS (5)', () => {
      expect(isLockedOut()).toBe(false);
      expect(getFailedAttempts()).toBe(0);

      for (let i = 1; i <= 4; i++) {
        const attempt = recordFailedAttempt();
        expect(attempt.lockedOut).toBe(false);
        expect(attempt.count).toBe(i);
        expect(isLockedOut()).toBe(false);
      }

      // 5th attempt locks out
      const fifth = recordFailedAttempt();
      expect(fifth.lockedOut).toBe(true);
      expect(fifth.remainingSeconds).toBe(30);
      expect(isLockedOut()).toBe(true);
      expect(getLockoutRemainingSeconds()).toBeGreaterThan(0);
    });

    it('resets lockout cleanly upon resetFailedAttempts', () => {
      for (let i = 0; i < 5; i++) recordFailedAttempt();
      expect(isLockedOut()).toBe(true);

      resetFailedAttempts();
      expect(isLockedOut()).toBe(false);
      expect(getFailedAttempts()).toBe(0);
      expect(getLockoutRemainingSeconds()).toBe(0);
    });
  });

  describe('Safe URL Sanitization against URI Scheme Injection', () => {
    it('rejects javascript: schemes with various encodings', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
      expect(isSafeUrl('  javascript:void(0)  ')).toBe(false);
    });

    it('rejects data: URI schemes', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('DATA:image/svg+xml,...')).toBe(false);
    });

    it('rejects vbscript: and embedded script tags', () => {
      expect(isSafeUrl('vbscript:msgbox("test")')).toBe(false);
      expect(isSafeUrl('https://leetcode.com/<script>alert(1)</script>')).toBe(false);
    });

    it('accepts legitimate https, http, and mailto URLs', () => {
      expect(isSafeUrl('https://leetcode.com/problems/two-sum/')).toBe(true);
      expect(isSafeUrl('http://localhost:5173/')).toBe(true);
      expect(isSafeUrl('mailto:pranav2410991479@gmail.com')).toBe(true);
    });
  });

  describe('XSS Input Sanitization', () => {
    it('neutralizes HTML injection characters', () => {
      const malicious = '<img src=x onerror="alert(\'pwned\')">&<b onmouseover=evil()>';
      const sanitized = sanitizeInput(malicious);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain("'");
      expect(sanitized).toContain('&lt;img');
      expect(sanitized).toContain('&amp;');
    });
  });
});
