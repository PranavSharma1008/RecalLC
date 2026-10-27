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
      const slug = extractSlugFromUrl(`https://${window.location.hostname || 'leetcode.com'}${pathname}`);
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
    if (pathname.includes('/problems/') && document.title) {
      if (document.title.includes('LeetCode')) {
        const rawTitle = document.title.split('-')[0]?.trim() || '';
        if (rawTitle && rawTitle.toLowerCase() !== 'leetcode') {
          const derivedSlug = rawTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          if (derivedSlug) return derivedSlug;
        }
      }
      if (document.title.includes('GeeksforGeeks')) {
        const rawTitle = document.title.split('|')[0]?.trim() || '';
        if (rawTitle && rawTitle.toLowerCase() !== 'geeksforgeeks') {
          const derivedSlug = rawTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          if (derivedSlug) return derivedSlug;
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/** True when the current page is a LeetCode or GeeksforGeeks problem page. */
export function isProblemPage(): boolean {
  return currentProblemSlug() !== null || window.location.pathname.startsWith(PROBLEM_PATH);
}

/**
 * Detects whether an element is located inside the testcase runner / console panel.
 * Elements inside the console only reflect sample test runs ("Run Code"), never full submissions.
 */
export function isInsideConsole(el: Element | null): boolean {
  if (!el) return false;
  // 1. Selector match on self or ancestors
  if (
    el.closest(
      '#console, [data-e2e-locator*="console" i], [data-cypress*="console" i], [class*="console" i], [class*="testcase" i], [class*="test-result" i], [class*="testResult" i], [id*="testcase" i], [id*="console" i], [data-track-load*="console" i]',
    )
  ) {
    return true;
  }
  // 2. DOM tree ancestor check: walk all the way up to body/html
  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const txt = parent.textContent || '';
    if (
      /\b(?:Case\s*1|Case\s*2|Case\s*3|Test\s*Result|Testcase|Custom\s*Testcase|Run\s*Code|Expected\s*Result)\b/i.test(txt) &&
      !/\b\d+\s*\/\s*\d+\s*(?:test\s*cases?|testcases)\s+passed\b/i.test(txt) &&
      !/analysis/i.test(txt) &&
      !/all\s*submissions/i.test(txt)
    ) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Detects if the problem page has a "Solved" indicator badge displayed (e.g. "Solved ✓" next to the problem title).
 */
export function isProblemSolvedBadgeOnPage(): boolean {
  if (typeof document === 'undefined') return false;
  const elements = Array.from(document.querySelectorAll('span, div, p, [class*="badge" i], [class*="status" i]'));
  for (const el of elements) {
    if (isInsideConsole(el)) continue;
    if (el.closest('.monaco-editor, .view-lines, header, nav')) continue;
    const txt = (el.textContent || '').trim();
    if (/^solved\s*[✓✔]?$/i.test(txt) || (/^solved\b/i.test(txt) && txt.length <= 10)) {
      return true;
    }
  }
  return false;
}

/**
 * Detects if the current page is currently displaying an "Accepted" / "Problem Solved Successfully" submission verdict.
 * Only returns true when ALL testcases pass on a real submission — NEVER on sample testcase runs (Run Code).
 */
export function isAcceptedOnPage(): boolean {
  if (typeof document === 'undefined') return false;

  const textContent = document.body ? document.body.textContent || '' : '';
  const innerText = document.body ? document.body.innerText || '' : '';
  const body = `${innerText} ${textContent}`;

  // Guard: If the page shows sample testcase indicators (e.g. Case 1, Test Result)
  // and does NOT contain genuine submission indicators, it is a sample run — NEVER a submission.
  const hasSampleRunIndicators = /\b(?:Case\s*1|Case\s*2|Test\s*Result)\b/i.test(body);
  const hasSubmissionProof =
    /\b\d+\s*\/\s*\d+\s*(?:test\s*cases?|testcases)\s+passed\b/i.test(body) ||
    /\ball\s*submissions\b/i.test(body) ||
    /\bproblem solved successfully\b/i.test(body) ||
    /\bcorrect answer\b/i.test(body) ||
    /\/submissions\/\d+/i.test(typeof window !== 'undefined' ? window.location.href : '');

  if (hasSampleRunIndicators && !hasSubmissionProof) {
    return false;
  }

  // 1. Genuinely passed testcases: ALL testcases passed (e.g. "66 / 66 testcases passed" or "1046 / 1046 testcases passed")
  // Both numbers must match (passed === total) and be > 0.
  const testcasesMatch = body.match(/\b(\d+)\s*\/\s*(\d+)\s*(?:test\s*cases?|testcases)\s+passed\b/i);
  if (testcasesMatch) {
    const passed = Number(testcasesMatch[1]);
    const total = Number(testcasesMatch[2]);
    if (passed > 0 && passed === total) {
      return true;
    }
    return false;
  }

  // 2. GeeksforGeeks problem solved / correct answer detection
  if (
    /problem solved successfully/i.test(body) ||
    /\bcorrect answer\b/i.test(body)
  ) {
    return true;
  }

  // 3. Direct URL check: if on a specific submission page
  if (
    typeof window !== 'undefined' &&
    (/\b\/problems\/[^/]+\/submissions\/\d+/i.test(window.location.pathname) ||
      /\/submissions\/\d+/i.test(window.location.href))
  ) {
    return true;
  }

  // 4. Both Analysis AND Solution buttons together (LeetCode submission details header)
  const buttons = Array.from(
    document.querySelectorAll('button, a, [role="button"], span, div, [class*="cursor-pointer"], [class*="btn"]'),
  );
  let hasAnalysis = false;
  let hasSolution = false;
  for (const b of buttons) {
    if (isInsideConsole(b)) continue;
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

  // 5. Check for active "Accepted" tab with close button in a tablist (LeetCode submission tab: "Accepted ✕")
  // Must NOT be inside the console / sample testcase runner!
  const tabs = Array.from(document.querySelectorAll('[role="tab"], [role="tablist"] [role="tab"]'));
  for (const tab of tabs) {
    if (isInsideConsole(tab)) continue;
    if (tab.closest('.monaco-editor, .view-lines, header, nav')) continue;
    const text = (tab.textContent || '').trim();
    const hasCloseBtn = /[✕×✖]/.test(text) || Boolean(tab.querySelector('svg, button, [aria-label*="close" i]'));
    if (/^accepted/i.test(text) && hasCloseBtn && !/\d{2,}/.test(text)) {
      return true;
    }
  }

  // 6. Explicit submission result panel or alert outside the console (never matching sample test runners)
  const panels = Array.from(
    document.querySelectorAll('[role="alert"], [class*="submission-result" i], [data-e2e-locator*="submission-result" i]'),
  );
  for (const panel of panels) {
    if (isInsideConsole(panel)) continue;
    if (panel.closest('.monaco-editor, .view-lines, header, nav')) continue;
    const text = (panel.textContent || '').trim();
    const hasAcceptedChild = Array.from(panel.children).some((c) =>
      /^\s*accepted(?:\s|$|[✕×✔✓])/i.test(c.textContent || ''),
    );
    if (
      (/^\s*accepted(?:\s|$|[✕×✔✓]|[^a-z0-9])/i.test(text) || hasAcceptedChild) &&
      !/^accepted\s*[\d.]+[km]/i.test(text)
    ) {
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
