import { createRoot, type Root } from 'react-dom/client';

import { InlineRocketButton, triggerFlyingRocketAnimation } from './InlineRocketButton';
import { isAcceptedOnPage } from './reminder';

const INLINE_HOST_ID = 'recalllc-inline-rocket';

let inlineHost: HTMLDivElement | null = null;
let currentHost: HTMLDivElement | null = null;
let inlineRoot: Root | null = null;
let observer: MutationObserver | null = null;

function getNavReferenceNode(el: HTMLElement): { container: HTMLElement; referenceNode: HTMLElement } | null {
  if (!el.parentElement) return null;

  let refNode: HTMLElement = el;
  while (
    refNode.parentElement &&
    refNode.parentElement.children.length === 1 &&
    refNode.parentElement.parentElement &&
    !/^(nav|header|body|html)$/i.test(refNode.parentElement.tagName) &&
    !refNode.parentElement.classList.contains('monaco-editor')
  ) {
    refNode = refNode.parentElement;
  }

  return {
    container: refNode.parentElement || el.parentElement,
    referenceNode: refNode,
  };
}

function findRandomButton(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  // 1. Direct href match
  const randomLink = document.querySelector<HTMLElement>('a[href*="random-one-question"], a[href*="/problems/random"]');
  if (randomLink) return randomLink;

  // 2. Aria-label / title / locator
  const randomInteractive = document.querySelector<HTMLElement>(
    'button[aria-label*="random" i], button[aria-label*="shuffle" i], button[aria-label*="pick one" i], ' +
      'a[aria-label*="random" i], a[aria-label*="shuffle" i], a[aria-label*="pick one" i], ' +
      'button[title*="random" i], a[title*="random" i], [data-e2e-locator*="random" i]',
  );
  if (randomInteractive) return randomInteractive;

  // 3. SVG icons with shuffle / random hints in header / nav
  const navRoots = Array.from(document.querySelectorAll('header, nav, [class*="nav"], [class*="header"]'));
  for (const root of navRoots) {
    const svgs = Array.from(root.querySelectorAll('svg'));
    for (const svg of svgs) {
      const dataIcon = (svg.getAttribute('data-icon') || '').toLowerCase();
      const ariaLabel = (svg.getAttribute('aria-label') || '').toLowerCase();
      if (
        dataIcon.includes('shuffle') ||
        dataIcon.includes('random') ||
        ariaLabel.includes('random') ||
        ariaLabel.includes('shuffle')
      ) {
        const btn = svg.closest('button, a, [role="button"]') as HTMLElement | null;
        if (btn) return btn;
      }
    }
  }

  return null;
}

function findProblemListElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  // Direct href
  const link = document.querySelector<HTMLElement>('a[href="/problemset/all/"], a[href*="/problemset"]');
  if (link) return link;

  // Search by text "Problem List"
  const candidates = Array.from(
    document.querySelectorAll(
      'header a, header button, nav a, nav button, [class*="navbar"] a, [class*="navbar"] button, a, button',
    ),
  );
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.id === INLINE_HOST_ID || el.closest(`#${INLINE_HOST_ID}`)) continue;
    const txt = (el.innerText || el.textContent || '').trim();
    if (/problem\s*list/i.test(txt)) {
      return el;
    }
  }

  return null;
}

function findLastNavItemInGroup(problemListEl: HTMLElement): HTMLElement | null {
  const parent = problemListEl.closest('nav, header, div[class*="flex"], div');
  if (!parent) return problemListEl;

  const items = Array.from(parent.querySelectorAll('button, a, [role="button"]')).filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.id === INLINE_HOST_ID || el.closest(`#${INLINE_HOST_ID}`)) return false;
    const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
    if (txt.includes('run') || txt.includes('submit') || txt.includes('premium')) return false;
    return true;
  });

  const idx = items.indexOf(problemListEl);
  if (idx !== -1) {
    const cluster = items.slice(idx, idx + 4);
    return cluster[cluster.length - 1] || problemListEl;
  }

  return items[items.length - 1] || problemListEl;
}

function findRunButton(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const runBtn = document.querySelector<HTMLElement>(
    '[data-e2e-locator="console-run-button"], [data-cypress="run-code-btn"]',
  );
  if (runBtn) return runBtn;

  const candidates = Array.from(document.querySelectorAll('header button, nav button, [class*="nav"] button, button'));
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.id === INLINE_HOST_ID || el.closest(`#${INLINE_HOST_ID}`)) continue;
    const txt = (el.innerText || el.textContent || '').trim();
    if (/^run$/i.test(txt) || /^▶?\s*run\b/i.test(txt)) {
      return el;
    }
  }

  return null;
}

function findTopNavBar(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const nav = document.querySelector<HTMLElement>('header, nav, #navbar, [class*="navbar"], [id*="navbar"]');
  if (nav) return nav;

  return null;
}

function findGfgCustomInputElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  // Search for elements containing "Custom Input"
  const candidates = Array.from(document.querySelectorAll('label, div, span, button, p, a'));
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.id === INLINE_HOST_ID || el.closest(`#${INLINE_HOST_ID}`)) continue;
    const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
    if (txt === 'custom input' || (txt.startsWith('custom input') && txt.length <= 25)) {
      let cur: HTMLElement = el;
      while (
        cur.parentElement &&
        cur.parentElement.children.length === 1 &&
        !/^(nav|header|body|html)$/i.test(cur.parentElement.tagName)
      ) {
        cur = cur.parentElement;
      }
      return cur;
    }
  }

  // Fallback: checkbox with custom input nearby
  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  for (const cb of checkboxes) {
    const parent = cb.closest('label, div');
    if (parent instanceof HTMLElement && /custom\s*input/i.test(parent.textContent || '')) {
      return parent;
    }
  }

  return null;
}

function findGfgInlineTarget(): {
  container: HTMLElement;
  referenceNode: HTMLElement | null;
  position: 'after' | 'before' | 'append';
} | null {
  if (typeof document === 'undefined') return null;

  // 1. Primary for GFG: Place before Custom Input in the open free space
  const customInputEl = findGfgCustomInputElement();
  if (customInputEl) {
    const ref = getNavReferenceNode(customInputEl);
    if (ref) {
      return {
        container: ref.container,
        referenceNode: ref.referenceNode,
        position: 'before',
      };
    }
  }

  // 2. Fallback: Look for GFG Compile & Run action buttons
  const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
  for (const b of buttons) {
    if (!(b instanceof HTMLElement)) continue;
    if (b.id === INLINE_HOST_ID || b.closest(`#${INLINE_HOST_ID}`)) continue;
    const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
    if (txt.includes('compile') && txt.includes('run')) {
      const ref = getNavReferenceNode(b);
      if (ref) {
        return {
          container: ref.container,
          referenceNode: ref.referenceNode,
          position: 'before',
        };
      }
    }
  }

  // 3. Fallback: before Submit button directly
  for (const b of buttons) {
    if (!(b instanceof HTMLElement)) continue;
    if (b.id === INLINE_HOST_ID || b.closest(`#${INLINE_HOST_ID}`)) continue;
    const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
    if (txt === 'submit' || txt.startsWith('submit')) {
      const ref = getNavReferenceNode(b);
      if (ref) {
        return {
          container: ref.container,
          referenceNode: ref.referenceNode,
          position: 'before',
        };
      }
    }
  }

  // 2. Look for GFG problem tab / header
  const gfgHeader = document.querySelector<HTMLElement>(
    '.problem-tab__header, .problems_header_content, .problem_header, [class*="problemHead" i], [class*="problem-header" i]',
  );
  if (gfgHeader) {
    return {
      container: gfgHeader,
      referenceNode: null,
      position: 'append',
    };
  }

  // 3. Look for GFG editor toolbar (language selector)
  const langSelector = document.querySelector<HTMLElement>(
    '[class*="language" i], [class*="lang-select" i], select[class*="lang" i]',
  );
  if (langSelector) {
    const ref = getNavReferenceNode(langSelector);
    if (ref) {
      return {
        container: ref.container,
        referenceNode: ref.referenceNode,
        position: 'after',
      };
    }
  }

  return null;
}

export function findInlineTarget(): {
  container: HTMLElement;
  referenceNode: HTMLElement | null;
  position: 'after' | 'before' | 'append';
} | null {
  if (typeof document === 'undefined') return null;

  // On GeeksforGeeks, prioritize GFG action buttons
  if (typeof window !== 'undefined' && window.location.hostname.includes('geeksforgeeks.org')) {
    const gfgTarget = findGfgInlineTarget();
    if (gfgTarget) return gfgTarget;
  }

  // 1. Primary Strategy: Place after the Random/Shuffle button in the top navigation cluster
  const randomBtn = findRandomButton();
  if (randomBtn) {
    const ref = getNavReferenceNode(randomBtn);
    if (ref) {
      return {
        container: ref.container,
        referenceNode: ref.referenceNode,
        position: 'after',
      };
    }
  }

  // 2. GeeksforGeeks specific action targets fallback
  const gfgTarget = findGfgInlineTarget();
  if (gfgTarget) {
    return gfgTarget;
  }

  // 2. Secondary Strategy: Place after the last item in the Problem List navigation group (e.g. <, >, 🔀)
  const problemListEl = findProblemListElement();
  if (problemListEl) {
    const lastNavEl = findLastNavItemInGroup(problemListEl);
    if (lastNavEl) {
      const ref = getNavReferenceNode(lastNavEl);
      if (ref) {
        return {
          container: ref.container,
          referenceNode: ref.referenceNode,
          position: 'after',
        };
      }
    }
  }

  // 3. Tertiary Strategy: Place right before the Run button or debugger button
  const runBtn = findRunButton();
  if (runBtn) {
    const ref = getNavReferenceNode(runBtn);
    if (ref) {
      const prev = ref.referenceNode.previousElementSibling as HTMLElement | null;
      if (prev && !prev.textContent?.includes('Problem List')) {
        return {
          container: ref.container,
          referenceNode: prev,
          position: 'before',
        };
      }
      return {
        container: ref.container,
        referenceNode: ref.referenceNode,
        position: 'before',
      };
    }
  }

  // 4. Submit button strategy
  const submitBtn = document.querySelector<HTMLElement>(
    '[data-e2e-locator="console-submit-button"], [data-cypress="submit-code-btn"], [data-cy="submit-code-btn"]',
  );
  if (submitBtn) {
    const ref = getNavReferenceNode(submitBtn);
    if (ref) {
      return {
        container: ref.container,
        referenceNode: ref.referenceNode,
        position: 'before',
      };
    }
  }

  // 5. Fallback: Append into top navigation bar
  const topNav = findTopNavBar();
  if (topNav) {
    const leftCluster = (topNav.firstElementChild as HTMLElement) || topNav;
    return {
      container: leftCluster,
      referenceNode: null,
      position: 'append',
    };
  }

  // 6. Header container fallback
  const header = document.querySelector<HTMLElement>('header, [data-layout-path*="header" i], [class*="header" i]');
  if (header) {
    return {
      container: header,
      referenceNode: null,
      position: 'append',
    };
  }

  return null;
}

function ensureInlineHost(): HTMLDivElement {
  if (inlineHost && inlineHost.isConnected) return inlineHost;

  const existing = document.getElementById(INLINE_HOST_ID);
  if (existing instanceof HTMLDivElement && existing.isConnected) {
    inlineHost = existing;
    return inlineHost;
  }

  const element = existing instanceof HTMLDivElement ? existing : document.createElement('div');
  element.id = INLINE_HOST_ID;
  element.style.setProperty('display', 'inline-flex', 'important');
  element.style.setProperty('align-items', 'center', 'important');
  element.style.setProperty('align-self', 'center', 'important');
  element.style.setProperty('height', '28px', 'important');
  element.style.setProperty('max-height', '28px', 'important');
  element.style.setProperty('vertical-align', 'middle', 'important');
  element.style.setProperty('margin', '0 3px', 'important');
  element.style.setProperty('padding', '0', 'important');
  element.style.setProperty('border', 'none', 'important');
  element.style.setProperty('line-height', '1', 'important');
  element.style.setProperty('z-index', '2147483646', 'important');
  element.style.setProperty('flex-shrink', '0', 'important');
  element.style.setProperty('box-sizing', 'border-box', 'important');
  inlineHost = element;
  return inlineHost;
}

let hasLaunchedForCurrentSubmission = false;
let lastLaunchedSlug: string | null = null;

export function resetLaunchState(): void {
  hasLaunchedForCurrentSubmission = false;
  lastLaunchedSlug = null;
}

export function updateInlineRocket(
  slug: string | null,
  isAccepted = false,
  autoOpenToast = false,
  autoLaunch = false,
  onPushed?: () => void,
): void {
  if (!slug) {
    hasLaunchedForCurrentSubmission = false;
    lastLaunchedSlug = null;
    removeInlineRocket();
    return;
  }

  // Determine if this is the first launch for this submission
  const shouldLaunch = autoLaunch && (!hasLaunchedForCurrentSubmission || lastLaunchedSlug !== slug);
  if (shouldLaunch) {
    hasLaunchedForCurrentSubmission = true;
    lastLaunchedSlug = slug;
    triggerFlyingRocketAnimation();
  }

  const target = findInlineTarget();
  if (!target) return;

  const host = ensureInlineHost();

  // If host is not in the right spot, place it
  if (target.position === 'after' && target.referenceNode) {
    if (target.referenceNode.nextElementSibling !== host) {
      target.referenceNode.after(host);
    }
  } else if (target.position === 'before' && target.referenceNode) {
    if (target.referenceNode.previousElementSibling !== host) {
      target.referenceNode.before(host);
    }
  } else if (target.position === 'append') {
    if (host.parentElement !== target.container) {
      target.container.appendChild(host);
    }
  }

  // Always re-bind React root if the host DOM element changed
  if (!inlineRoot || currentHost !== host || !host.isConnected) {
    if (inlineRoot) {
      try {
        inlineRoot.unmount();
      } catch {
        // ignore
      }
      inlineRoot = null;
    }
    inlineRoot = createRoot(host);
    currentHost = host;
  }

  inlineRoot.render(
    <InlineRocketButton
      currentSlug={slug}
      autoOpen={isAccepted || autoOpenToast}
      autoLaunch={shouldLaunch}
      onPushed={() => {
        hasLaunchedForCurrentSubmission = true;
        lastLaunchedSlug = slug;
        onPushed?.();
      }}
    />,
  );
}

export function removeInlineRocket(): void {
  hasLaunchedForCurrentSubmission = false;
  lastLaunchedSlug = null;
  if (inlineRoot) {
    try {
      inlineRoot.unmount();
    } catch {
      // ignore
    }
    inlineRoot = null;
  }
  if (inlineHost && inlineHost.parentElement) {
    inlineHost.remove();
  }
  const el = typeof document !== 'undefined' ? document.getElementById(INLINE_HOST_ID) : null;
  if (el) {
    el.remove();
  }
  inlineHost = null;
  currentHost = null;
}

export function startInlineRocketObserver(
  getSlug: () => string | null,
  getAccepted?: () => boolean,
  isAlreadyAdded?: () => boolean,
  onPushed?: () => void,
): () => void {
  const check = () => {
    const slug = getSlug();
    if (!slug) {
      removeInlineRocket();
      return;
    }

    const accepted = getAccepted ? getAccepted() : isAcceptedOnPage();
    const alreadyAdded = isAlreadyAdded ? isAlreadyAdded() : false;

    if (accepted) {
      // When all testcases pass on a submission: launch rocket from ground to top through animation, then turn to Added!
      updateInlineRocket(slug, true, true, true, onPushed);
    } else if (alreadyAdded) {
      // If already added/submitted in this session, maintain Added state permanently — NEVER remove automatically!
      updateInlineRocket(slug, true, true, false, onPushed);
    } else {
      // Problem page open before submission: render clean ready rocket button (NOT added)
      updateInlineRocket(slug, false, false, false, onPushed);
    }
  };

  observer = new MutationObserver(check);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Fast check every 400ms
  const timer = setInterval(check, 400);

  // Initial check
  check();

  return () => {
    observer?.disconnect();
    observer = null;
    clearInterval(timer);
    removeInlineRocket();
  };
}
