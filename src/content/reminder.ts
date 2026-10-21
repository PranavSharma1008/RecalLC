/**
 * LeetCode page helpers for the content script.
 */

import { extractSlugFromUrl } from '../utils/slug';

const PROBLEM_PATH = '/problems/';

/** The slug of the problem currently on screen, or `null` off a problem page. */
export function currentProblemSlug(): string | null {
  const { pathname } = window.location;
  if (pathname.startsWith(PROBLEM_PATH)) {
    const segment = pathname.slice(PROBLEM_PATH.length).split('/')[0] ?? '';
    if (segment) {
      const slug = extractSlugFromUrl(`https://leetcode.com${pathname}`);
      if (slug) return slug;
    }
  }

  // Fallback 1: check window.location.href
  const fromHref = extractSlugFromUrl(window.location.href);
  if (fromHref) return fromHref;

  // Fallback 2: check any link on the page pointing to /problems/<slug>
  try {
    const problemLinks = Array.from(document.querySelectorAll('a[href*="/problems/"]'));
    for (const link of problemLinks) {
      const href = link.getAttribute('href') || '';
      const slug = extractSlugFromUrl(`https://leetcode.com${href}`);
      if (slug) return slug;
    }
  } catch {
    // ignore
  }

  // Fallback 3: check document.title (e.g. "Median of Two Sorted Arrays - LeetCode")
  try {
    if (document.title && document.title.includes('LeetCode')) {
      const rawTitle = document.title.split('-')[0]?.trim() || '';
      if (rawTitle && rawTitle.toLowerCase() !== 'leetcode') {
        const derivedSlug = rawTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (derivedSlug) return derivedSlug;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/** True when the current page is a LeetCode problem page. */
export function isProblemPage(): boolean {
  return currentProblemSlug() !== null || window.location.pathname.startsWith(PROBLEM_PATH);
}

/**
 * Watch for single-page-application navigation.
 */
export function observeUrlChanges(callback: (slug: string | null) => void): () => void {
  let lastHref = window.location.href;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const check = () => {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    callback(currentProblemSlug());
  };

  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      check();
    }, 150);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);

  // Best-effort: catches navigations that do not touch the DOM at all.
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<History['pushState']>) => {
    originalPush(...args);
    schedule();
  };
  history.replaceState = (...args: Parameters<History['replaceState']>) => {
    originalReplace(...args);
    schedule();
  };

  return () => {
    observer.disconnect();
    window.removeEventListener('popstate', schedule);
    window.removeEventListener('hashchange', schedule);
    if (timer !== null) clearTimeout(timer);
  };
}
