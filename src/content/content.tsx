/**
 * RecallLC content script — runs on https://leetcode.com/problems/*.
 *
 * Responsibilities
 * ----------------
 *  1. Work out which problem the user is looking at, including single-page
 *     application navigation.
 *  2. Render the revision reminder (a React island, mounted by this script).
 *  3. Record a *submission* when the page reports a verdict — never on a
 *     plain page view.
 *  4. Optionally enrich tracked problems with LeetCode's public metadata and
 *     (opt-in) pull the user's own submission history.
 *
 * The script never mutates the LeetCode page: it only reads the DOM and adds
 * one absolutely-positioned container for its own UI.
 */

import { createRoot, type Root } from 'react-dom/client';

import { ReminderRoot } from './ReminderRoot';
import { removeInlineRocket, resetLaunchState, startInlineRocketObserver } from './inlineInjector';
import {
  clearInterceptedSubmission,
  detectDifficultyFromPage,
  extractTitleFromPage,
  setInterceptedSubmission,
} from './pushHelper';
import { currentProblemSlug, observeUrlChanges } from './reminder';
import { callService, isExtensionContextValid } from '../services/messaging';
import { readSettings } from '../services/storage';
import {
  fetchCatalogViaGraphQL,
  fetchCatalogViaLegacyApi,
  fetchSubmissionHistory,
  statusToAccepted,
  type LeetCodeProblemMeta,
} from '../services/leetcodeApi';
import { SubmissionTracker } from '../services/submissionTracker';
import type { ThemePreference } from '../types';
import '../styles/content.css';

const HOST_ID = 'recalllc-root';
const LAST_CATALOG_SYNC_KEY = 'recalllc:lastCatalogSync';
const LAST_ACCOUNT_SYNC_KEY = 'recalllc:lastAccountSync';

const CATALOG_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

let host: HTMLDivElement | null = null;
let reactRoot: Root | null = null;
let currentSlug: string | null = null;
let tracker: SubmissionTracker | null = null;
let hasSuccessfulSubmit = false;

/* ------------------------------------------------------------------ helpers */

function resolveTheme(preference: ThemePreference): 'dark' | 'light' {
  if (preference === 'dark' || preference === 'light') return preference;
  const media = window.matchMedia?.('(prefers-color-scheme: light)');
  return media?.matches ? 'light' : 'dark';
}

async function getLocal<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(key);
    return (result?.[key] as T) ?? null;
  } catch {
    return null;
  }
}

async function setLocal(key: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch {
    // Storage failures must never break the page.
  }
}

/* -------------------------------------------------------------- the island */

function applyHostStyles(element: HTMLElement): void {
  element.style.setProperty('position', 'fixed', 'important');
  element.style.setProperty('right', '24px', 'important');
  element.style.setProperty('bottom', '44px', 'important');
  element.style.setProperty('z-index', '2147483647', 'important');
  element.style.setProperty('pointer-events', 'none', 'important');
  element.style.setProperty('display', 'block', 'important');
}

function ensureHost(): HTMLDivElement {
  if (host && host.isConnected) {
    applyHostStyles(host);
    return host;
  }
  const existing = document.getElementById(HOST_ID);
  if (existing instanceof HTMLDivElement && existing.isConnected) {
    host = existing;
    applyHostStyles(host);
    return host;
  }
  const element = existing instanceof HTMLDivElement ? existing : document.createElement('div');
  element.id = HOST_ID;
  element.setAttribute('data-theme', 'dark');
  applyHostStyles(element);
  (document.body ?? document.documentElement).appendChild(element);
  host = element;
  return host;
}

let currentHostElement: HTMLDivElement | null = null;

function renderReminder(slug: string | null): void {
  const element = ensureHost();
  if (!reactRoot || currentHostElement !== element || !element.isConnected) {
    if (reactRoot) {
      try {
        reactRoot.unmount();
      } catch {
        // ignore
      }
      reactRoot = null;
    }
    reactRoot = createRoot(element);
    currentHostElement = element;
  }
  reactRoot.render(<ReminderRoot currentSlug={slug} />);
}

async function applyTheme(): Promise<void> {
  const settings = await readSettings();
  ensureHost().setAttribute('data-theme', resolveTheme(settings.theme));
}

/* ---------------------------------------------------------------- tracking */

function startTracker(): void {
  if (tracker) return;
  tracker = new SubmissionTracker({
    onSubmit: () => {
      resetLaunchState();
      hasSuccessfulSubmit = false;
    },
    onAttempt: (attempt) => {
      void handleAttempt(attempt);
    },
  });
  tracker.start();
}

function stopTracker(): void {
  tracker?.stop();
  tracker = null;
}

async function handleAttempt(attempt: {
  accepted: boolean | null;
  language: string | null;
  verdict: string;
  at: number;
}): Promise<void> {
  if (!isExtensionContextValid()) return;

  // History tracking if enabled — NEVER auto-pushes problem to RecallLC!
  const settings = await readSettings().catch(() => null);
  if (settings?.autoTrackSubmissions !== false && !attempt.accepted) {
    void recordAttempt(attempt);
  }
}

async function recordAttempt(attempt: {
  accepted: boolean | null;
  language: string | null;
  verdict: string;
  at: number;
}): Promise<void> {
  if (!isExtensionContextValid()) return;

  const slug = currentProblemSlug();
  if (!slug) return;
  try {
    const detectedDiff = detectDifficultyFromPage();
    const difficulty =
      detectedDiff !== 'Unknown' ? detectedDiff : slug.toLowerCase() === 'two-sum' ? 'Easy' : undefined;
    const title = extractTitleFromPage() || null;
    await callService('record-attempt', {
      slug,
      title,
      url: window.location.href,
      difficulty,
      attemptedAt: attempt.at,
      accepted: attempt.accepted,
      language: attempt.language,
      submissionId: null,
      source: 'auto',
    });
  } catch (error) {
    if (isExtensionContextValid()) {
      console.debug?.('[RecallLC] could not record the attempt:', error);
    }
  }
}

/* ------------------------------------------------------------ enrichment */

async function maybeEnrichCatalogue(): Promise<void> {
  if (!window.location.hostname.includes('leetcode.com')) return;
  if (!isExtensionContextValid()) return;

  try {
    const last = await getLocal<number>(LAST_CATALOG_SYNC_KEY);
    if (last && Date.now() - last < CATALOG_REFRESH_INTERVAL_MS) return;

    const { slugs } = await callService('catalog-needed');
    if (slugs.length === 0) {
      await setLocal(LAST_CATALOG_SYNC_KEY, Date.now());
      return;
    }

    let catalogue: LeetCodeProblemMeta[];
    try {
      catalogue = await fetchCatalogViaGraphQL();
    } catch {
      catalogue = await fetchCatalogViaLegacyApi().catch(() => []);
    }

    const wanted = new Set(slugs);
    const entries = catalogue
      .filter((entry) => wanted.has(entry.slug))
      .map((entry) => ({ ...entry, updatedAt: Date.now() }));

    if (entries.length > 0) {
      await callService('catalog-merge', { entries });
    }
    await setLocal(LAST_CATALOG_SYNC_KEY, Date.now());
  } catch {
    // Metadata enrichment is optional — silent fallback to avoid console noise
  }
}

async function maybeSyncAccountHistory(): Promise<void> {
  if (!window.location.hostname.includes('leetcode.com')) return;
  if (!isExtensionContextValid()) return;

  try {
    const settings = await readSettings();
    if (!settings.accountSyncEnabled) return;

    const last = await getLocal<number>(LAST_ACCOUNT_SYNC_KEY);
    if (last && Date.now() - last < ACCOUNT_SYNC_INTERVAL_MS) return;

    const submissions = await fetchSubmissionHistory(settings.accountSyncLimit, currentSlug || undefined);
    if (submissions.length === 0) {
      await setLocal(LAST_ACCOUNT_SYNC_KEY, Date.now());
      return;
    }

    await callService('account-sync', {
      attempts: submissions.map((submission) => ({
        slug: submission.slug,
        title: submission.title,
        attemptedAt: submission.timestamp,
        accepted: statusToAccepted(submission.status),
        language: submission.language,
        submissionId: submission.id,
      })),
    });
    await setLocal(LAST_ACCOUNT_SYNC_KEY, Date.now());
  } catch {
    // Account sync is optional — silent fallback
  }
}

/* ----------------------------------------------------------------- startup */

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showProblemOpenToast(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('rlc-problem-open-toast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.id = 'rlc-problem-open-toast';
  toast.style.cssText = `
    position: fixed !important;
    top: 24px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: rgba(18, 14, 30, 0.96) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1.5px solid rgba(168, 85, 247, 0.85) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(168, 85, 247, 0.4) !important;
    border-radius: 9999px !important;
    padding: 8px 18px !important;
    color: #ffffff !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    opacity: 1 !important;
    transition: opacity 0.3s ease, transform 0.3s ease !important;
    letter-spacing: -0.01em !important;
  `;
  toast.innerHTML = `
    <span style="font-size:16px;line-height:1;">🚀</span>
    <span>Click rocket to push question to RecallLC</span>
  `;
  (document.body ?? document.documentElement).appendChild(toast);

  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, 350);
  }, 2000);
}

function onSlugChange(slug: string | null): void {
  if (!isExtensionContextValid()) return;

  // If navigating within the same problem (e.g. from problem description to submission details /submissions/123)
  if (slug && currentSlug === slug) {
    renderReminder(slug);
    return;
  }

  currentSlug = slug;
  // Always reset on slug change: rocket starts fresh ready for manual click!
  hasSuccessfulSubmit = false;
  clearInterceptedSubmission();
  renderReminder(slug);
  removeInlineRocket();

  if (!slug) {
    stopTracker();
    return;
  }

  // Show 2-second in-page prompt to remind user they can push with the rocket
  showProblemOpenToast();

  // Opening a problem is *not* an attempt — it only refreshes metadata.
  void callService('mark-viewed', { slug, url: window.location.href }).catch(() => undefined);

  startTracker();
}

function boot(): void {
  if (typeof document === 'undefined') return;

  console.log('[RecallLC] Content script loaded on:', window.location.href);
  currentSlug = currentProblemSlug();
  // Start session fresh — rocket is clean and ready for user to click!
  hasSuccessfulSubmit = false;
  clearInterceptedSubmission();
  console.log('[RecallLC] Initial slug:', currentSlug);
  ensureHost();
  void applyTheme();
  renderReminder(currentSlug);
  removeInlineRocket();

  if (currentSlug) {
    showProblemOpenToast();
    void callService('mark-viewed', { slug: currentSlug, url: window.location.href }).catch(() => undefined);
    startTracker();
  }

  observeUrlChanges((slug) => {
    console.log('[RecallLC] URL changed to:', window.location.href, 'slug:', slug);
    onSlugChange(slug);
  });

  // Ensure island container stays attached
  const islandTimer = setInterval(() => {
    if (!isExtensionContextValid()) {
      clearInterval(islandTimer);
      return;
    }
    const slug = currentProblemSlug();
    if (slug) {
      const el = document.getElementById(HOST_ID);
      if (!el || !el.isConnected) {
        ensureHost();
        renderReminder(slug);
      }
    }
  }, 1000);

  // Listen for verified network interception events from MAIN world interceptor
  window.addEventListener('recalllc:submit-started', (event: Event) => {
    const customEvt = event as CustomEvent<{ slug: string; code?: string; lang?: string; submissionId?: string }>;
    if (customEvt.detail?.code) {
      setInterceptedSubmission(customEvt.detail.code, customEvt.detail.lang);
    }
  });

  window.addEventListener('recalllc:submission-accepted', (event: Event) => {
    const customEvt = event as CustomEvent<{
      slug: string;
      code?: string;
      lang?: string;
      submissionId?: string;
    }>;
    const detail = customEvt.detail;
    if (detail?.code) {
      setInterceptedSubmission(detail.code, detail.lang);
    }
    console.log('[RecallLC] Submission verified accepted. User can click rocket button to push to RecallLC:', detail?.slug);
  });

  window.addEventListener('recalllc:submission-rejected', (event: Event) => {
    const customEvt = event as CustomEvent<{ slug: string; verdict: string; submissionId?: string }>;
    const detail = customEvt.detail;
    const slug = detail?.slug || currentSlug || currentProblemSlug();
    if (!slug || !isExtensionContextValid()) return;

    console.log('[RecallLC] Intercepted submission rejected (' + detail.verdict + ') for:', slug);

    void readSettings().then((s) => {
      if (s?.autoTrackSubmissions !== false) {
        void recordAttempt({
          accepted: false,
          language: null,
          verdict: detail.verdict,
          at: Date.now(),
        });
      }
    }).catch(() => undefined);
  });

  // Start watching for submission result rows to inject inline rocket
  // STRICTLY MANUAL: Rocket only turns into Added when the user clicks the button!
  startInlineRocketObserver(
    () => currentProblemSlug(),
    () => hasSuccessfulSubmit,
    () => {
      hasSuccessfulSubmit = true;
    },
  );

  void maybeEnrichCatalogue();
  void maybeSyncAccountHistory();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
