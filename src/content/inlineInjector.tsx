import { createRoot, type Root } from 'react-dom/client';

import { InlineRocketButton } from './InlineRocketButton';

const INLINE_HOST_ID = 'recalllc-inline-rocket';

let inlineHost: HTMLDivElement | null = null;
let inlineRoot: Root | null = null;
let observer: MutationObserver | null = null;

export function findInlineTarget(): {
  container: HTMLElement;
  referenceNode: HTMLElement | null;
  position: 'after' | 'before' | 'append';
} | null {
  const elements = Array.from(document.querySelectorAll('button, a, [role="button"], div[class*="btn"]'));

  let analysisBtn: HTMLElement | null = null;
  let solutionBtn: HTMLElement | null = null;

  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.id === INLINE_HOST_ID || el.closest(`#${INLINE_HOST_ID}`)) continue;

    const text = (el.innerText || el.textContent || '').trim();

    // Check for Analysis button (e.g. "Analysis" or "✨ Analysis")
    if (
      !analysisBtn &&
      (/analysis/i.test(text) || el.getAttribute('data-e2e-locator')?.toLowerCase().includes('analysis'))
    ) {
      analysisBtn = el;
    }

    // Check for Solution button (e.g. "Solution" or "📝 Solution")
    // Notice: we do NOT match "Solutions" (plural tab at top of screen)
    if (
      !solutionBtn &&
      ((/solution/i.test(text) && !/solutions/i.test(text)) ||
        el.getAttribute('data-e2e-locator')?.toLowerCase().includes('solution') ||
        (text.includes('Solution') && el.classList.toString().includes('green')) ||
        (text.includes('Solution') && (el.style.backgroundColor?.includes('green') || el.style.backgroundColor?.includes('rgb(34'))))
    ) {
      solutionBtn = el;
    }
  }

  // 1. Ideal: both Analysis and Solution found -> insert right between them!
  if (analysisBtn && solutionBtn) {
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
  element.style.display = 'inline-flex';
  element.style.alignItems = 'center';
  element.style.margin = '0 6px';
  element.style.verticalAlign = 'middle';
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

  if (!inlineRoot || !host.isConnected) {
    inlineRoot = createRoot(host);
  }

  inlineRoot.render(<InlineRocketButton currentSlug={slug} />);
}

export function removeInlineRocket(): void {
  if (inlineRoot) {
    inlineRoot.unmount();
    inlineRoot = null;
  }
  if (inlineHost && inlineHost.parentElement) {
    inlineHost.remove();
  }
  inlineHost = null;
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

  // Periodic safeguard
  const timer = setInterval(check, 1000);

  // Initial check
  check();

  return () => {
    observer?.disconnect();
    observer = null;
    clearInterval(timer);
    removeInlineRocket();
  };
}
