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

  // Fallback 2: check canonical problem link tag on page
  try {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical?.href) {
      const slug = extractSlugFromUrl(canonical.href);
      if (slug) return slug;
    }
  } catch {
    // ignore
  }

  // Fallback 3: check document.title ONLY if on a problem URL path
  try {
    if (pathname.includes('/problems/') && document.title && document.title.includes('LeetCode')) {
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
 * Detects if the current LeetCode page is currently displaying an "Accepted" submission verdict.
 */
export function isAcceptedOnPage(): boolean {
  if (typeof document === 'undefined') return false;

  const body = document.body ? document.body.innerText || document.body.textContent || '' : '';

  // 1. Genuinely passed testcases (e.g. "1569 / 1569 testcases passed" or "66 / 66 testcases passed")
  if (/\b\d+\s*\/\s*\d+\s*testcases\s+passed\b/i.test(body)) {
    return true;
  }

  // 2. Direct URL check: if on a specific submission page
  if (
    /\/problems\/[^/]+\/submissions\/\d+/i.test(window.location.pathname) ||
    /\/submissions\/\d+/i.test(window.location.href)
  ) {
    return true;
  }

  // 3. Both Analysis AND Solution buttons together (LeetCode submission details header)
  const buttons = Array.from(
    document.querySelectorAll('button, a, [role="button"], span, div, [class*="cursor-pointer"], [class*="btn"]'),
  );
  let hasAnalysis = false;
  let hasSolution = false;
  for (const b of buttons) {
    if (b.closest('.monaco-editor, .view-lines, .view-line, header, nav')) continue;
    const txt = (b.textContent || '').trim();
    if (!txt || txt.length > 25) continue;
    if (/analysis/i.test(txt) && !/solutions/i.test(txt)) {
      hasAnalysis = true;
    }
    if (/^solution$/i.test(txt) || (/solution/i.test(txt) && !/solutions/i.test(txt))) {
      hasSolution = true;
    }
  }
  if (hasAnalysis && hasSolution) {
    return true;
  }

  // 4. Check for active "Accepted" tab with close button in a tablist (not description stats like "Accepted 5.2M")
  const tabs = Array.from(document.querySelectorAll('[role="tab"], [role="tablist"] [role="tab"], div[class*="tab"]'));
  for (const tab of tabs) {
    if (tab.closest('.monaco-editor, .view-lines, header, nav')) continue;
    const text = (tab.textContent || '').trim();
    if (/^accepted\s*(?:[✕×✔✓].*)?$/i.test(text) && !/\d{2,}/.test(text)) {
      return true;
    }
  }

  return false;
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
