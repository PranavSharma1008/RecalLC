import { createRoot, type Root } from 'react-dom/client';

import { InlineRocketButton } from './InlineRocketButton';

const INLINE_HOST_ID = 'recalllc-inline-rocket';

let inlineHost: HTMLDivElement | null = null;
let currentHost: HTMLDivElement | null = null;
let inlineRoot: Root | null = null;
let observer: MutationObserver | null = null;

function getClickableAncestor(el: HTMLElement): HTMLElement {
  const candidate = el.closest('button, a, [role="button"], [class*="cursor-pointer"]');
  if (candidate instanceof HTMLElement) return candidate;
  return el;
}

export function findInlineTarget(): {
  container: HTMLElement;
  referenceNode: HTMLElement | null;
  position: 'after' | 'before' | 'append';
} | null {
  // Strategy 1: Search for buttons or clickable elements containing "Analysis" and "Solution"
  const allElements = Array.from(document.querySelectorAll('button, a, [role="button"], div, span'));

  let analysisBtn: HTMLElement | null = null;
  let solutionBtn: HTMLElement | null = null;

  for (const el of allElements) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.id === INLINE_HOST_ID || el.closest(`#${INLINE_HOST_ID}`)) continue;
    if (el.id === 'recalllc-root' || el.closest('#recalllc-root')) continue;

    const text = (el.innerText || el.textContent || '').trim();
    if (!text || text.length > 40) continue;

    // Check for "Analysis" (e.g. "Analysis" or "✨ Analysis")
    if (!analysisBtn && /analysis/i.test(text) && !/solutions/i.test(text)) {
      if (text.length <= 20) {
        analysisBtn = getClickableAncestor(el);
      }
    }

    // Check for "Solution" (e.g. "Solution" or "📝 Solution"), strictly exclude "Solutions" tab
    if (!solutionBtn && /solution/i.test(text) && !/solutions/i.test(text)) {
      if (!text.includes('class') && text.length <= 20) {
        solutionBtn = getClickableAncestor(el);
      }
    }
  }

  // 1. Ideal: both Analysis and Solution found -> insert right between them!
  if (analysisBtn && solutionBtn) {
    if (analysisBtn.parentElement === solutionBtn.parentElement && analysisBtn.parentElement) {
      return {
        container: analysisBtn.parentElement,
        referenceNode: analysisBtn,
        position: 'after',
      };
    }

    // If wrapped in nested container
    let aParent: HTMLElement | null = analysisBtn;
    let sParent: HTMLElement | null = solutionBtn;
    while (aParent && aParent.parentElement && aParent.parentElement !== document.body) {
      if (aParent.parentElement === sParent?.parentElement) {
        return {
          container: aParent.parentElement,
          referenceNode: aParent,
          position: 'after',
        };
      }
      aParent = aParent.parentElement;
      sParent = sParent?.parentElement ?? null;
    }

    if (analysisBtn.parentElement) {
      return {
        container: analysisBtn.parentElement,
        referenceNode: analysisBtn,
        position: 'after',
      };
    }
  }

  // 2. Found Analysis button -> insert right after it
  if (analysisBtn && analysisBtn.parentElement) {
    return {
      container: analysisBtn.parentElement,
      referenceNode: analysisBtn,
      position: 'after',
    };
  }

  // 3. Found Solution button -> insert right before it
  if (solutionBtn && solutionBtn.parentElement) {
    return {
      container: solutionBtn.parentElement,
      referenceNode: solutionBtn,
      position: 'before',
    };
  }

  // 4. Fallback: look for "Accepted" banner row
  const acceptedEls = Array.from(document.querySelectorAll('span, div, h4, h3, p')).filter((el) => {
    const text = (el.textContent || '').trim();
    return (
      text === 'Accepted' ||
      text.startsWith('Accepted ') ||
      text.includes('testcases passed')
    );
  });

  for (const acc of acceptedEls) {
    const row = acc.closest('div[class*="flex"], div[class*="row"], div[class*="header"]');
    if (row instanceof HTMLElement) {
      const btnGroup = row.querySelector('div[class*="flex"]:last-child, div:last-child');
      if (btnGroup instanceof HTMLElement) {
        return { container: btnGroup, referenceNode: null, position: 'append' };
      }
      return { container: row, referenceNode: null, position: 'append' };
    }
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
  element.style.setProperty('margin', '0 6px', 'important');
  element.style.setProperty('vertical-align', 'middle', 'important');
  element.style.setProperty('z-index', '20', 'important');
  inlineHost = element;
  return inlineHost;
}

export function updateInlineRocket(slug: string | null): void {
  if (!slug) {
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

  // FIX: Always re-bind React root if the host DOM element changed
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

  inlineRoot.render(<InlineRocketButton currentSlug={slug} />);
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
    if (slug) {
      updateInlineRocket(slug);
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
