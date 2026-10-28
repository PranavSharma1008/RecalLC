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
 * Elements inside the console only reflect sample test runs ("Run Code" / "Compile & Run"), never full submissions.
 */
export function isInsideConsole(el: Element | null): boolean {
  if (!el) return false;

  // Genuine submission results are NEVER sample console runs:
  const elText = (el.textContent || '').trim();
  if (
    (/\baccepted\b/i.test(elText) &&
      (/\b(?:runtime|beats|memory)\b/i.test(elText) ||
        /\b\d+\s*ms\b/i.test(elText) ||
        /\b\d+\.?\d*%\b/i.test(elText) ||
        /\b\d+\s*\/\s*\d+\s*(?:test\s*cases?|testcases)\s+passed\b/i.test(elText))) ||
    /\bproblem solved successfully\b/i.test(elText) ||
    /\bcorrect answer\b/i.test(elText) ||
    /\bbeats\b/i.test(elText)
  ) {
    return false;
  }

  // If inside a submission result panel or submission details container, it is NOT inside console
  if (
    el.closest(
      '.submission-details, [class*="submission-result" i], [data-e2e-locator*="submission-result" i], [class*="submission-status" i], [class*="submission-panel" i], [class*="submission_detail" i]',
    )
  ) {
    return false;
  }

  // 1. Selector match on self or ancestors (covers LeetCode and GeeksforGeeks console/compiler/runner)
  if (
    el.closest(
      '#console, [data-e2e-locator*="console" i], [data-cypress*="console" i], [class*="console" i], [class*="testcase" i], [id*="testcase" i], [id*="console" i], [data-track-load*="console" i], [class*="compilation" i], [class*="compile" i], [class*="output" i], [class*="terminal" i], [class*="custom-input" i], [class*="sample-test" i], [class*="run-code" i], [class*="ide-console" i]',
    )
  ) {
    return true;
  }
  // 2. DOM tree ancestor check: walk up to closest pane container (not the entire document)
  let parent = el.parentElement;
  let depth = 0;
  while (parent && parent !== document.body && parent !== document.documentElement && depth < 6) {
    depth++;
    const txt = parent.textContent || '';
    if (
      /\b(?:Case\s*[123]|Custom\s*Testcase|Run\s*Code|Expected\s*Result|Compilation\s*Completed|Compilation\s*Results|Compile\s*&\s*Run|Sample\s*Test\s*Cases?|Your\s*Output|Expected\s*Output)\b/i.test(
        txt,
      ) &&
      !/\bproblem solved successfully\b/i.test(txt) &&
      !/\bcorrect answer\b/i.test(txt) &&
      !/analysis/i.test(txt) &&
      !/all\s*submissions/i.test(txt) &&
      !/\bbeats\b/i.test(txt) &&
      !/\bsubmission\b/i.test(txt)
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
 * Only returns true when ALL testcases pass on a real submission — NEVER on sample testcase runs (Run Code / Compile & Run)
 * or while code is actively running/compiling.
 */
export function isAcceptedOnPage(): boolean {
  if (typeof document === 'undefined') return false;

  const textContent = document.body ? document.body.textContent || '' : '';
  const innerText = document.body ? document.body.innerText || '' : '';
  const body = `${innerText} ${textContent}`;

  // 0. Active compilation or test running check (code is currently executing, NOT finished/accepted!)
  const isExecuting =
    /\b(?:compiling|running|evaluating|judging|pending)\.{1,3}\b/i.test(body) ||
    Boolean(
      document.querySelector('[class*="spinner" i], [class*="loading" i], [class*="loader" i], [aria-busy="true"]'),
    );
  if (isExecuting) {
    return false;
  }

  // 1. Direct URL check: if on a specific submission page
  if (
    typeof window !== 'undefined' &&
    (/\b\/problems\/[^/]+\/submissions\/\d+/i.test(window.location.pathname) ||
      /\/submissions\/\d+/i.test(window.location.href))
  ) {
    return true;
  }

  // 2. GeeksforGeeks problem solved / correct answer detection
  if (/problem solved successfully/i.test(body) || /\bcorrect answer\b/i.test(body)) {
    return true;
  }

  // 3. Modern LeetCode accepted submission with beats metric (e.g. "Beats 84.5%"):
  // Sample test runs NEVER show "Beats" or percentile comparisons!
  const hasBeatsMetric =
    /\bbeats\b/i.test(body) &&
    (/\b\d+(\.\d+)?\s*%/i.test(body) || /\b(?:faster\s*than|memory\s*distribution|runtime\s*distribution)\b/i.test(body));
  if (/\baccepted\b/i.test(body) && hasBeatsMetric) {
    return true;
  }

  // 4. All hidden testcases passed in full submission (e.g. "66 / 66 testcases passed", "1046 / 1046 testcases passed")
  const testcasesMatch = body.match(/\b(\d+)\s*\/\s*(\d+)\s*(?:test\s*cases?|testcases)\s+passed\b/i);
  if (testcasesMatch) {
    const passed = Number(testcasesMatch[1]);
    const total = Number(testcasesMatch[2]);
    if (passed > 0 && passed === total) {
      return true;
    }
    return false;
  }

  // 5. Submission result elements on page
  const submissionResult = document.querySelector(
    '.submission-details, [class*="submission-result" i], [data-e2e-locator*="submission-result" i], [class*="submission-status" i]',
  );
  if (submissionResult) {
    const resText = (submissionResult.textContent || '').trim();
    if (/\baccepted\b/i.test(resText) && !/\bwrong\b/i.test(resText)) {
      return true;
    }
  }

  // 6. Active "Accepted" tab with close button in a tablist (LeetCode submission tab: "Accepted ✕")
  const tabs = Array.from(document.querySelectorAll('[role="tab"], [role="tablist"] [role="tab"]'));
  for (const tab of tabs) {
    if (isInsideConsole(tab)) continue;
    if (tab.closest('.monaco-editor, .view-lines, header, nav, [class*="description" i]')) continue;
    const text = (tab.textContent || '').trim();
    const hasCloseBtn = /[✕×✖]/.test(text) || Boolean(tab.querySelector('svg, button, [aria-label*="close" i]'));
    if (/^accepted/i.test(text) && hasCloseBtn && !/\d{2,}/.test(text)) {
      return true;
    }
  }

  // 7. Both Analysis AND Solution buttons together (LeetCode submission details header)
  const actionButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
  let hasAnalysis = false;
  let hasSolution = false;
  for (const b of actionButtons) {
    if (isInsideConsole(b)) continue;
    if (
      b.closest(
        '.monaco-editor, .view-lines, .view-line, header, nav, [class*="description" i], [class*="editorial" i]',
      )
    )
      continue;
    const txt = (b.textContent || '').trim();
    if (!txt || txt.length > 25) continue;
    if (/analysis/i.test(txt) && !/solutions/i.test(txt) && !/complexity/i.test(txt)) {
      hasAnalysis = true;
    }
    if (/^solution$/i.test(txt) || (/solution/i.test(txt) && !/solutions/i.test(txt) && !/approach/i.test(txt))) {
      hasSolution = true;
    }
  }
  if (hasAnalysis && hasSolution) {
    return true;
  }

  // 8. Explicit submission result panel or alert outside the console (never matching sample test runners)
  const panels = Array.from(
    document.querySelectorAll(
      '[role="alert"], [class*="submission-result" i], [data-e2e-locator*="submission-result" i]',
    ),
  );
  for (const panel of panels) {
    if (isInsideConsole(panel)) continue;
    if (panel.closest('.monaco-editor, .view-lines, header, nav, [class*="description" i]')) continue;
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

  // 9. Guard against initial problem state: "You must run your code first"
  if (/\byou must run your code first\b/i.test(body)) {
    return false;
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
