/** Stable id generation that works in a service worker, page and Node. */

export function createId(prefix = ''): string {
  const globalCrypto = globalThis.crypto;
  let core: string;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    core = globalCrypto.randomUUID();
  } else if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    const bytes = globalCrypto.getRandomValues(new Uint8Array(16));
    core = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    core = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
  return prefix ? `${prefix}_${core}` : core;
}

/** Deterministic id for an attempt — lets de-duplication work across imports. */
export function attemptId(
  submissionId: string | null,
  slug: string,
  attemptedAt: number,
  language?: string | null,
): string {
  const lang = language ? language.trim().toLowerCase() : '';
  const key = submissionId ? `sid:${submissionId}` : `k:${slug}:${attemptedAt}:${lang}`;
  return `att_${hashString(key)}`;
}

/** FNV-1a, rendered as base36. Stable across sessions and platforms. */
export function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
