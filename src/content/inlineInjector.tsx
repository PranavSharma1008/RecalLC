import { createRoot, type Root } from 'react-dom/client';

import { InlineRocketButton } from './InlineRocketButton';
import { isAcceptedOnPage } from './reminder';

const INLINE_HOST_ID = 'recalllc-inline-rocket';

let inlineHost: HTMLDivElement | null = null;
let currentHost: HTMLDivElement | null = null;
let inlineRoot: Root | null = null;
let observer: MutationObserver | null = null;

function getNavReferenceNode(el: HTMLElement): { container: HTMLElement; referenceNode: HTMLElement } | null {
  const parent = el.parentElement;
  if (!parent) return null;

  // If the parent is just a single-child wrapper around the button/link (like a tooltip wrapper or relative div)
  // and parent's parent is a flex row / navbar
  if (
    parent.children.length === 1 &&
    parent.parentElement &&
    !/^(nav|header|body|html)$/i.test(parent.tagName) &&
    !parent.parentElement.classList.contains('monaco-editor')
  ) {
    return {
      container: parent.parentElement,
      referenceNode: parent,
    };
  }

  return {
    container: parent,
    referenceNode: el,
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

export function findInlineTarget(): {
  container: HTMLElement;
  referenceNode: HTMLElement | null;
  position: 'after' | 'before' | 'append';
} | null {
  if (typeof document === 'undefined') return null;

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

  // 4. Fallback: Append into top navigation bar
  const topNav = findTopNavBar();
  if (topNav) {
    const leftCluster = (topNav.firstElementChild as HTMLElement) || topNav;
    return {
      container: leftCluster,
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
  element.style.setProperty('height', '100%', 'important');
  element.style.setProperty('vertical-align', 'middle', 'important');
  element.style.setProperty('z-index', '2147483646', 'important');
  element.style.setProperty('flex-shrink', '0', 'important');
  inlineHost = element;
  return inlineHost;
}

export function updateInlineRocket(slug: string | null, isAccepted?: boolean, autoOpenToast?: boolean): void {
  const accepted = isAccepted ?? isAcceptedOnPage();
  if (!slug || !accepted) {
    removeInlineRocket();
    return;
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

  inlineRoot.render(<InlineRocketButton currentSlug={slug} autoOpen={autoOpenToast} />);
}

export function removeInlineRocket(): void {
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
  inlineHost = null;
  currentHost = null;
}

export function startInlineRocketObserver(getSlug: () => string | null): () => void {
  const check = () => {
    const slug = getSlug();
    if (slug && isAcceptedOnPage()) {
      updateInlineRocket(slug, true);
    } else {
      removeInlineRocket();
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
