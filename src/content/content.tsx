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

import { triggerFlyingRocketAnimation } from './InlineRocketButton';
import { ReminderRoot } from './ReminderRoot';
import { removeInlineRocket, resetLaunchState, startInlineRocketObserver, updateInlineRocket } from './inlineInjector';
import { detectDifficultyFromPage, extractTitleFromPage } from './pushHelper';
import { currentProblemSlug, observeUrlChanges } from './reminder';
import { callService } from '../services/messaging';
import { readSettings } from '../services/storage';
import { fetchCatalogViaGraphQL, fetchSubmissionHistory, statusToAccepted } from '../services/leetcodeApi';
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
  const settings = await readSettings();
  if (settings.autoTrackSubmissions) {
    void recordAttempt(attempt);
  }

  // When a solution is submitted and accepted, update the inline rocket button and launch animation
  if (attempt.accepted) {
    hasSuccessfulSubmit = true;
    triggerFlyingRocketAnimation();
    updateInlineRocket(currentSlug, true, true, true);
  }
}

async function recordAttempt(attempt: {
  accepted: boolean | null;
  language: string | null;
  verdict: string;
  at: number;
}): Promise<void> {
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
    console.warn('[RecallLC] could not record the attempt:', error);
  }
}

/* ------------------------------------------------------------ enrichment */

async function maybeEnrichCatalogue(): Promise<void> {
  if (!window.location.hostname.includes('leetcode.com')) return;
  try {
    const last = await getLocal<number>(LAST_CATALOG_SYNC_KEY);
    if (last && Date.now() - last < CATALOG_REFRESH_INTERVAL_MS) return;

    const { slugs } = await callService('catalog-needed');
    if (slugs.length === 0) {
      await setLocal(LAST_CATALOG_SYNC_KEY, Date.now());
      return;
    }

    const catalogue = await fetchCatalogViaGraphQL();
    const wanted = new Set(slugs);
    const entries = catalogue
      .filter((entry) => wanted.has(entry.slug))
      .map((entry) => ({ ...entry, updatedAt: Date.now() }));

    if (entries.length > 0) {
      await callService('catalog-merge', { entries });
    }
    await setLocal(LAST_CATALOG_SYNC_KEY, Date.now());
  } catch (error) {
    // Metadata enrichment is optional — the catalogue endpoint may be
    // unreachable or the schema may have changed.
    console.warn('[RecallLC] catalogue refresh skipped:', error);
  }
}

async function maybeSyncAccountHistory(): Promise<void> {
  if (!window.location.hostname.includes('leetcode.com')) return;
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
  } catch (error) {
    console.debug?.('[RecallLC] account sync skipped:', error);
  }
}

/* ----------------------------------------------------------------- startup */

function onSlugChange(slug: string | null): void {
  currentSlug = slug;
  // Always reset on slug change: rocket only shows after all testcases pass in this session!
  hasSuccessfulSubmit = false;
  renderReminder(slug);
  removeInlineRocket();

  if (!slug) {
    stopTracker();
    return;
  }

  // Opening a problem is *not* an attempt — it only refreshes metadata.
  void callService('mark-viewed', { slug, url: window.location.href }).catch(() => undefined);

  startTracker();
}

function boot(): void {
  if (typeof document === 'undefined') return;

  console.log('[RecallLC] Content script loaded on:', window.location.href);
  currentSlug = currentProblemSlug();
  // Start session fresh — do NOT show rocket or Added before running testcases!
  hasSuccessfulSubmit = false;
  console.log('[RecallLC] Initial slug:', currentSlug);
  ensureHost();
  void applyTheme();
  renderReminder(currentSlug);
  removeInlineRocket();

  if (currentSlug) {
    void callService('mark-viewed', { slug: currentSlug, url: window.location.href }).catch(() => undefined);
    startTracker();
  }

  observeUrlChanges((slug) => {
    console.log('[RecallLC] URL changed to:', window.location.href, 'slug:', slug);
    onSlugChange(slug);
  });

  // Ensure island container stays attached
  setInterval(() => {
    const slug = currentProblemSlug();
    if (slug) {
      const el = document.getElementById(HOST_ID);
      if (!el || !el.isConnected) {
        ensureHost();
        renderReminder(slug);
      }
    }
  }, 1000);

  // Start watching for submission result rows to inject inline rocket
  startInlineRocketObserver(
    () => currentProblemSlug(),
    () => false, // Never auto-launch animation on page open or observer ticks
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
