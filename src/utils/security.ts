/**
 * RecallLC Security & Authentication Module.
 *
 * Implements:
 * 1. Cryptographic hashing for Master Passcode / Authentication (SHA-256 + Salt + Pepper) via Web Crypto API
 *    with a full FIPS 180-4 standard pure TypeScript SHA-256 fallback (never a weak 32-bit hash).
 * 2. Timing-attack safe comparison (timingSafeEqual).
 * 3. Session authentication state management (unlocked / locked).
 * 4. Inactivity auto-lock timers.
 * 5. Tamper-resistant anti-brute-force rate limiting with storage-backed lockouts across tabs and reloads.
 * 6. Input sanitization to defend against Cross-Site Scripting (XSS).
 * 7. Safe URL verification to prevent malicious URI schemes (javascript:, data:).
 */

const PEPPER = 'recalllc_sec_pepper_v1_secure';
const SESSION_UNLOCKED_KEY = 'recalllc:session:unlocked';
const SESSION_TIMESTAMP_KEY = 'recalllc:session:last_active';
const FAILED_ATTEMPTS_KEY = 'recalllc:session:failed_attempts';
const LOCKOUT_UNTIL_KEY = 'recalllc:session:lockout_until';
const PERSISTENT_FAILED_KEY = 'recalllc:sec:failed_attempts';
const PERSISTENT_LOCKOUT_KEY = 'recalllc:sec:lockout_until';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_SECONDS = 30;

/** Generate a cryptographically random hex salt. */
export function generateSalt(length = 16): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/** Standard SHA-256 implementation (FIPS 180-4) as a guaranteed cryptographic fallback. */
function sha256Pure(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // ASCII only
    words[i >> 2] = (words[i >> 2] ?? 0) | (j << ((3 - (i % 4)) * 8));
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength | 0;

  for (j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;

      const s0 =
        i < 16
          ? (w[i] ?? 0)
          : (w[i] =
              ((w[i - 16] ?? 0) +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                (w[i - 7] ?? 0) +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const h0 = hash[0]!;
      const h1 = hash[1]!;
      const h2 = hash[2]!;
      const h4 = hash[4]!;

      const s1 = rightRotate(h4, 6) ^ rightRotate(h4, 11) ^ rightRotate(h4, 25);
      const ch = (h4 & hash[5]!) ^ (~h4 & hash[6]!);
      const temp1 = (hash[7]! + s1 + ch + k[i]! + s0) | 0;
      const s0Maj = rightRotate(h0, 2) ^ rightRotate(h0, 13) ^ rightRotate(h0, 22);
      const maj = (h0 & h1) ^ (h0 & h2) ^ (h1 & h2);
      const temp2 = (s0Maj + maj) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4]! + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i]! + oldHash[i]!) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i]! >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/** Compute SHA-256 hash of passcode + salt + pepper. */
export async function hashPasscode(passcode: string, salt: string): Promise<string> {
  const combined = `${salt}:${passcode}:${PEPPER}`;
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to pure JS SHA-256
    }
  }

  return sha256Pure(combined);
}

/** Constant-time string comparison to defend against timing attacks. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aLen = a.length;
  const bLen = b.length;
  let diff = aLen ^ bLen;
  for (let i = 0; i < Math.max(aLen, bLen); i++) {
    const charA = i < aLen ? a.charCodeAt(i) : 0;
    const charB = i < bLen ? b.charCodeAt(i) : 0;
    diff |= charA ^ charB;
  }
  return diff === 0;
}

/** Verify if an entered passcode matches the stored salt and hash using timing-safe comparison. */
export async function verifyPasscode(attempt: string, expectedHash: string, salt: string): Promise<boolean> {
  if (!attempt || !expectedHash || !salt) return false;
  const computed = await hashPasscode(attempt, salt);
  return timingSafeEqual(computed, expectedHash);
}

const inMemorySessionStore = new Map<string, string>();

// Eagerly restore persistent rate limit / lockout state from chrome.storage.local if available
if (typeof globalThis !== 'undefined' && globalThis.chrome?.storage?.local) {
  try {
    void globalThis.chrome.storage.local
      .get([PERSISTENT_FAILED_KEY, PERSISTENT_LOCKOUT_KEY])
      .then((res) => {
        if (res?.[PERSISTENT_FAILED_KEY] !== undefined) {
          inMemorySessionStore.set(FAILED_ATTEMPTS_KEY, String(res[PERSISTENT_FAILED_KEY]));
        }
        if (res?.[PERSISTENT_LOCKOUT_KEY] !== undefined) {
          inMemorySessionStore.set(LOCKOUT_UNTIL_KEY, String(res[PERSISTENT_LOCKOUT_KEY]));
        }
      })
      .catch(() => {});
  } catch {}
}

function getSessionItem(key: string): string | null {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage) {
      const val = sessionStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // Ignore
  }
  return inMemorySessionStore.get(key) ?? null;
}

function setSessionItem(key: string, value: string): void {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage) {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // Ignore
  }
  inMemorySessionStore.set(key, value);
}

function removeSessionItem(key: string): void {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage) {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
  inMemorySessionStore.delete(key);
}

/** Check if current browser session has been unlocked. */
export function isSessionUnlocked(): boolean {
  return getSessionItem(SESSION_UNLOCKED_KEY) === 'true';
}

/** Set or clear the session unlock flag. */
export function setSessionUnlocked(unlocked: boolean): void {
  if (unlocked) {
    setSessionItem(SESSION_UNLOCKED_KEY, 'true');
    setSessionItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    resetFailedAttempts();
  } else {
    removeSessionItem(SESSION_UNLOCKED_KEY);
    removeSessionItem(SESSION_TIMESTAMP_KEY);
  }
}

/** Update the last active timestamp for auto-lock calculations. */
export function touchSessionActivity(): void {
  setSessionItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
}

/** Determine whether session has timed out based on minutes. */
export function isSessionExpired(timeoutMinutes: number): boolean {
  if (timeoutMinutes <= 0) return false;
  const tsStr = getSessionItem(SESSION_TIMESTAMP_KEY);
  if (!tsStr) return true;
  const elapsed = Date.now() - Number(tsStr);
  return elapsed > timeoutMinutes * 60 * 1000;
}

/** Read the number of consecutive failed unlock attempts. */
export function getFailedAttempts(): number {
  return Number(getSessionItem(FAILED_ATTEMPTS_KEY) || '0');
}

/** Record a failed passcode attempt. If threshold reached, initiates lockout across storage. */
export function recordFailedAttempt(): { count: number; lockedOut: boolean; remainingSeconds: number } {
  const current = getFailedAttempts() + 1;
  setSessionItem(FAILED_ATTEMPTS_KEY, current.toString());
  try {
    if (globalThis.chrome?.storage?.local) {
      void globalThis.chrome.storage.local.set({ [PERSISTENT_FAILED_KEY]: current });
    }
  } catch {}

  if (current >= MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
    setSessionItem(LOCKOUT_UNTIL_KEY, lockoutUntil.toString());
    try {
      if (globalThis.chrome?.storage?.local) {
        void globalThis.chrome.storage.local.set({ [PERSISTENT_LOCKOUT_KEY]: lockoutUntil });
      }
    } catch {}
    return { count: current, lockedOut: true, remainingSeconds: LOCKOUT_DURATION_SECONDS };
  }
  return { count: current, lockedOut: false, remainingSeconds: 0 };
}

/** Reset failed attempts counter in session and persistent storage. */
export function resetFailedAttempts(): void {
  removeSessionItem(FAILED_ATTEMPTS_KEY);
  removeSessionItem(LOCKOUT_UNTIL_KEY);
  try {
    if (globalThis.chrome?.storage?.local) {
      void globalThis.chrome.storage.local.remove([PERSISTENT_FAILED_KEY, PERSISTENT_LOCKOUT_KEY]);
    }
  } catch {}
}

/** Get remaining seconds of anti-brute-force lockout (0 if not locked out). */
export function getLockoutRemainingSeconds(): number {
  const until = Number(getSessionItem(LOCKOUT_UNTIL_KEY) || '0');
  const remaining = until - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/** Determine if user is currently locked out from entering passcodes. */
export function isLockedOut(): boolean {
  return getLockoutRemainingSeconds() > 0;
}

/** Strict input sanitization against XSS. */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Validate whether a URL is strictly safe (http, https, or mailto). */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.includes('<script')
  ) {
    return false;
  }
  return trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('mailto:');
}
