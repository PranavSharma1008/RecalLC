import { describe, expect, it } from 'vitest';

import {
  generateSalt,
  getFailedAttempts,
  getLockoutRemainingSeconds,
  hashPasscode,
  isLockedOut,
  isSafeUrl,
  isSessionExpired,
  isSessionUnlocked,
  recordFailedAttempt,
  resetFailedAttempts,
  sanitizeInput,
  setSessionUnlocked,
  touchSessionActivity,
  verifyPasscode,
} from '../../utils/security';

describe('security utility', () => {
  it('generates random hex salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).toBeTruthy();
    expect(salt2).toBeTruthy();
    expect(salt1).not.toBe(salt2);
  });

  it('hashes passcode with salt deterministically', async () => {
    const salt = 'testsalt1234';
    const hash1 = await hashPasscode('mySecretPass123', salt);
    const hash2 = await hashPasscode('mySecretPass123', salt);
    const differentHash = await hashPasscode('otherPass', salt);

    expect(hash1).toBeTruthy();
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(differentHash);
  });

  it('verifies passcode successfully and rejects incorrect passcode', async () => {
    const salt = generateSalt();
    const hash = await hashPasscode('correctPasscode', salt);

    const valid = await verifyPasscode('correctPasscode', hash, salt);
    const invalid = await verifyPasscode('wrongPasscode', hash, salt);
    const empty = await verifyPasscode('', hash, salt);

    expect(valid).toBe(true);
    expect(invalid).toBe(false);
    expect(empty).toBe(false);
  });

  it('manages session unlocked state and expiration', () => {
    setSessionUnlocked(false);
    expect(isSessionUnlocked()).toBe(false);

    setSessionUnlocked(true);
    expect(isSessionUnlocked()).toBe(true);

    touchSessionActivity();
    expect(isSessionExpired(15)).toBe(false);

    setSessionUnlocked(false);
    expect(isSessionUnlocked()).toBe(false);
  });

  it('tracks failed attempts and triggers lockout after threshold', () => {
    resetFailedAttempts();
    expect(getFailedAttempts()).toBe(0);
    expect(isLockedOut()).toBe(false);

    recordFailedAttempt();
    expect(getFailedAttempts()).toBe(1);

    recordFailedAttempt();
    recordFailedAttempt();
    recordFailedAttempt();
    const outcome = recordFailedAttempt(); // 5th attempt

    expect(outcome.lockedOut).toBe(true);
    expect(outcome.remainingSeconds).toBeGreaterThan(0);
    expect(isLockedOut()).toBe(true);
    expect(getLockoutRemainingSeconds()).toBeGreaterThan(0);

    resetFailedAttempts();
    expect(getFailedAttempts()).toBe(0);
    expect(isLockedOut()).toBe(false);
  });

  it('sanitizes input against XSS', () => {
    const dangerous = `<script>alert("hack")</script><img src=x onerror=alert(1)>`;
    const safe = sanitizeInput(dangerous);
    expect(safe).not.toContain('<script>');
    expect(safe).toContain('&lt;script&gt;');
    expect(safe).toContain('&quot;hack&quot;');
  });

  it('validates safe URLs and rejects malicious URI schemes', () => {
    expect(isSafeUrl('https://leetcode.com')).toBe(true);
    expect(isSafeUrl('http://localhost:5173')).toBe(true);
    expect(isSafeUrl('mailto:pranav2410991479@gmail.com')).toBe(true);

    expect(isSafeUrl('javascript:alert(document.cookie)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox("test")')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });
});
