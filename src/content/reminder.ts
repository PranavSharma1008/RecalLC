/**
 * LeetCode page helpers for the content script.
 */

import { extractSlugFromUrl } from '../utils/slug';

const PROBLEM_PATH = '/problems/';

/** The slug of the problem currently on screen, or `null` off a problem page. */
export function currentProblemSlug(): string | null {
  const { pathname } = window.location;
  if (!pathname.startsWith(PROBLEM_PATH)) return null;
  const segment = pathname.slice(PROBLEM_PATH.length).split('/')[0] ?? '';
  if (!segment) return null;
  return extractSlugFromUrl(`https://leetcode.com${pathname}`);
}

/** True when the current page is a LeetCode problem page. */
export function isProblemPage(): boolean {
  return window.location.pathname.startsWith(PROBLEM_PATH);
}

/**
 * Watch for single-page-application navigation.
 *
 * LeetCode is a Next.js app: moving between problems changes the URL without
 * a page load. Content scripts live in an isolated world, so patching
 * `history.pushState` does *not* intercept the page's own calls — the
 * reliable signal is a DOM mutation (which always accompanies a navigation)
 * combined with `popstate` for back/forward.
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
