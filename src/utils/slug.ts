/**
 * Problem slug helpers — the slug is RecallLC's stable identifier.
 */

/** Matches `/problems/<slug>` with optional trailing path segments. */
const PROBLEM_PATH_RE = /\/problems\/([^/?#]+)/i;

/**
 * Extract the problem slug from a LeetCode problem URL.
 * Returns `null` for anything that is not a problem page.
 */
export function extractSlugFromUrl(url: string): string | null {
  if (!url) return null;
  const match = PROBLEM_PATH_RE.exec(url);
  if (!match || !match[1]) return null;
  return normalizeSlug(match[1]);
}

/**
 * Normalise an arbitrary slug-ish value into the canonical LeetCode slug.
 * Accepts a full URL, a path, surrounding slashes, query strings and
 * mixed case. Returns `null` when the result is not a plausible slug.
 */
export function normalizeSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!value) return null;

  // Strip a full URL down to its slug segment.
  if (/^https?:\/\//i.test(value)) {
    const match = PROBLEM_PATH_RE.exec(value);
    if (!match || !match[1]) return null;
    value = match[1];
  }

  value = value
    .split('#')[0]!
    .split('?')[0]!
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  if (!value) return null;
  // Slugs are lowercase words joined by single hyphens.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    // Tolerate underscores and repeated hyphens before giving up.
    const relaxed = value.replace(/_/g, '-').replace(/-+/g, '-');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(relaxed)) return null;
    value = relaxed;
  }
  return value;
}

/**
 * Detects whether a slug belongs to GeeksforGeeks.
 * GFG problem slugs typically have trailing numeric identifiers
 * (e.g. `fractional-knapsack-1587115620`, `0-1-knapsack-problem0945`, `checker2744`).
 */
export function isGfgSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') return false;
  return /-\d{4,}$|[a-z]\d{3,}$/i.test(slug);
}

/** Canonical problem URL for a slug (LeetCode by default, or GeeksforGeeks if specified or detected). */
export function problemUrl(slug: string, urlOrPlatform?: string): string {
  const isGfg =
    (urlOrPlatform && (urlOrPlatform.includes('geeksforgeeks.org') || urlOrPlatform.toLowerCase() === 'gfg')) ||
    isGfgSlug(slug);
  if (isGfg) {
    return `https://www.geeksforgeeks.org/problems/${slug}/1`;
  }
  return `https://leetcode.com/problems/${slug}/`;
}

/**
 * Derive a human title from a slug.
 * "two-sum" -> "Two Sum". Used only as a fallback when no title is known.
 * Also cleans trailing numeric IDs common in GeeksforGeeks slugs.
 */
export function titleFromSlug(slug: string): string {
  const cleanedSlug = slug.replace(/-\d{4,}$|[a-z]\d{3,}$/i, (match) => {
    if (/^[a-z]\d{3,}$/i.test(match)) return match[0] ?? '';
    return '';
  });
  return cleanedSlug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
