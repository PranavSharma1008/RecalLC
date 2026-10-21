/**
 * RecallLC — background service worker.
 *
 * The worker is the *only* context that touches the IndexedDB database, and
 * therefore the only place where the extension's own origin is used for
 * storage. Content scripts and UI pages talk to it over typed messages.
 */

import type {
  CatalogEntry,
  ImportResult,
  Problem,
  RecallRating,
  ReminderPayload,
  RevisionRecord,
  SubmissionAttempt,
} from '../types';
import {
  fail,
  MESSAGE_CHANNEL,
  ok,
  type ServiceEnvelope,
  type ServiceErrorEnvelope,
  type ServiceMap,
} from '../services/messaging';
import {
  clearAll,
  deleteProblem,
  dismiss,
  exportBackup,
  getProblem,
  getRevision,
  getStats,
  listAttempts,
  listCatalog,
  listDueProblems,
  listImports,
  listProblemSchedule,
  listProblems,
  listRevisions,
  markViewed,
  mergeCatalog,
  rateRecall,
  recordAttempt,
  recordImport,
  rescheduleProblem,
  restoreBackup,
  saveProblem,
  setPaused,
  snooze,
  updateNotes,
} from '../services/repository';
import { importFile, previewImport } from '../services/historyImporter';
import { DEFAULT_SETTINGS, readSettings, writeSettings } from '../services/storage';
import { pickReminder, summarizeDue } from '../services/revisionEngine';

/* --------------------------------------------------------------- utilities */

function now(): number {
  return Date.now();
}

/* ---------------------------------------------------------------- handlers */

type Handler<K extends keyof ServiceMap> = (payload: ServiceMap[K]['payload']) => Promise<ServiceMap[K]['response']>;

const handlers: { [K in keyof ServiceMap]: Handler<K> } = {
  'get-reminder': async (payload) => {
    const settings = await readSettings();
    const timestamp = now();
    const [candidates, revisions] = await Promise.all([listDueProblems(timestamp), listRevisions()]);
    const summary = summarizeDue(revisions, timestamp);

    const currentSlug = payload?.currentSlug ?? null;
    const eligible = candidates.filter((candidate) => candidate.slug !== currentSlug);
    const candidate = pickReminder(eligible, currentSlug, timestamp);

    const payloadResult: ReminderPayload = {
      candidate: candidate
        ? {
            slug: candidate.slug,
            title: candidate.title,
            url: candidate.url,
            difficulty: candidate.difficulty,
            topics: candidate.topics,
            attemptCount: candidate.attemptCount,
            lastAttemptAt: candidate.lastAttemptAt,
            dueAt: candidate.dueAt,
            overdue: candidate.overdue,
            overdueDays: candidate.overdueDays,
            accepted: candidate.accepted,
            language: candidate.language,
          }
        : null,
      remainingDue: Math.max(0, eligible.length - (candidate ? 1 : 0)),
      overdueCount: summary.overdue,
      dueTodayCount: summary.dueToday,
      theme: settings.theme,
      enabled: settings.remindersEnabled,
      streak: 0,
    };
    return payloadResult;
  },

  'list-due': async (payload) => listDueProblems(payload?.now ?? now()),

  'list-problems': async (payload) => listProblemSchedule(payload?.now ?? now()),

  'get-problem': async (payload) => {
    const [problem, revision, attempts] = await Promise.all([
      getProblem(payload.slug),
      getRevision(payload.slug),
      listAttempts(payload.slug),
    ]);
    return { problem: problem ?? null, revision: revision ?? null, attempts };
  },

  'save-problem': async (payload) => saveProblem(payload),

  'update-notes': async (payload) => updateNotes(payload.slug, payload.notes),

  'delete-problem': async (payload) => {
    await deleteProblem(payload.slug);
    return true;
  },

  rate: async (payload) => {
    const outcome = await rateRecall(payload.slug, payload.rating as RecallRating);
    return outcome.revision;
  },

  snooze: async (payload) => {
    const outcome = await snooze(payload.slug);
    return outcome ? outcome.revision : null;
  },

  dismiss: async (payload) => {
    const outcome = await dismiss(payload.slug);
    return outcome ? outcome.revision : null;
  },

  reschedule: async (payload) => {
    const outcome = await rescheduleProblem(payload.slug, payload.dueAt, now());
    return outcome ? outcome.revision : null;
  },

  'set-paused': async (payload) => setPaused(payload.slug, payload.paused),

  'record-attempt': async (payload) => {
    const outcome = await recordAttempt(payload);
    return { created: outcome.created, duplicate: outcome.duplicate };
  },

  'mark-viewed': async (payload) => {
    await markViewed(payload.slug);
    return true;
  },

  stats: async () => getStats(),

  'import-preview': async (payload) => previewImport(payload.fileName, payload.content),

  'import-commit': async (payload) => importFile(payload.fileName, payload.content),

  'import-history': async () => listImports(),

  export: async () => exportBackup(),

  restore: async (payload) => restoreBackup(payload.backup),

  'clear-all': async () => {
    await clearAll();
    return true;
  },

  'catalog-merge': async (payload) => mergeCatalog(payload.entries as CatalogEntry[]),

  'catalog-needed': async () => {
    const [problems, catalog] = await Promise.all([listProblems(), listCatalog()]);
    const known = new Map(catalog.map((entry) => [entry.slug, entry]));
    const slugs = problems
      .filter((problem) => {
        const entry = known.get(problem.slug);
        if (!entry) return true;
        return entry.difficulty === 'Unknown' || problem.topics.length === 0;
      })
      .map((problem) => problem.slug)
      .slice(0, 250);
    return { slugs };
  },

  'catalog-legacy-refresh': async () => {
    const { fetchCatalogViaLegacyApi } = await import('../services/leetcodeApi');
    const entries = await fetchCatalogViaLegacyApi();
    return mergeCatalog(
      entries.map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        difficulty: entry.difficulty,
        topics: entry.topics,
        paidOnly: entry.paidOnly,
        updatedAt: now(),
      })),
    );
  },

  'account-sync': async (payload): Promise<ImportResult> => {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      duplicated: 0,
      invalid: 0,
      merged: 0,
      problemsCreated: 0,
      problemsUpdated: 0,
      errors: [],
      warnings: [],
    };

    const existing = new Set((await listProblems()).map((problem: Problem) => problem.slug));
    const knownIds = new Set(
      (await listAttempts())
        .map((attempt: SubmissionAttempt) => attempt.submissionId)
        .filter((id): id is string => Boolean(id)),
    );

    for (const entry of payload.attempts) {
      try {
        if (entry.submissionId && knownIds.has(entry.submissionId)) {
          result.duplicated++;
          continue;
        }
        const outcome = await recordAttempt(
          {
            slug: entry.slug,
            title: entry.title ?? null,
            attemptedAt: entry.attemptedAt,
            accepted: entry.accepted ?? null,
            language: entry.language ?? null,
            submissionId: entry.submissionId ?? null,
            source: 'auto',
          },
          now(),
        );
        if (!outcome.created) {
          result.duplicated++;
          continue;
        }
        result.imported++;
        if (existing.has(entry.slug)) result.merged++;
        else {
          result.problemsCreated++;
          existing.add(entry.slug);
        }
        if (entry.submissionId) knownIds.add(entry.submissionId);
      } catch (error) {
        result.invalid++;
        result.errors.push({
          row: null,
          message: error instanceof Error ? error.message : 'Could not store the submission.',
        });
      }
    }

    await recordImport({
      id: `sync_${now()}`,
      fileName: 'LeetCode account sync',
      format: 'leetcode-sync',
      importedAt: now(),
      result,
    });

    return result;
  },

  'get-settings': async () => readSettings(),

  'update-settings': async (payload) => writeSettings(payload),

  'open-problem': async (payload) => {
    if (!/^https:\/\/(www\.)?leetcode\.com(\/.*)?$/i.test(payload.url)) {
      throw new Error('Refusing to open an unexpected URL.');
    }
    await chrome.tabs.create({ url: payload.url, active: true });
    return true;
  },

  'open-dashboard': async (payload) => {
    const hash = payload?.hash ?? '';
    const url = chrome.runtime.getURL(`src/dashboard/index.html${hash}`);
    await chrome.tabs.create({ url, active: true });
    return true;
  },
};

/* ---------------------------------------------------------------- dispatch */

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
    if (typeof message !== 'object' || message === null) return false;
    const envelope = message as { channel?: string; method?: string; payload?: unknown };
    if (envelope.channel !== MESSAGE_CHANNEL || typeof envelope.method !== 'string') return false;

    const method = envelope.method as keyof ServiceMap;
    const handler = handlers[method];
    if (!handler) {
      sendResponse(fail(new Error(`Unknown method "${envelope.method}"`)) satisfies ServiceErrorEnvelope);
      return false;
    }

    handler(envelope.payload as never)
      .then((data) => sendResponse(ok(data) satisfies ServiceEnvelope))
      .catch((error: unknown) => sendResponse(fail(error) satisfies ServiceErrorEnvelope));

    return true; // keep the message channel open for the async response
  },
);

/* ------------------------------------------------------------------ setup */

async function seedCatalogIfEmpty(): Promise<void> {
  try {
    const catalog = await listCatalog();
    if (catalog.length === 0) {
      await handlers['catalog-legacy-refresh'](undefined as never);
    }
  } catch {
    // Legacy catalog refresh is best-effort (e.g. offline or restricted test environment).
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const settings = await readSettings();
  if (!settings.onboardingCompleted) {
    await writeSettings({ onboardingCompleted: false });
  }

  void seedCatalogIfEmpty();

  if (details.reason === 'install') {
    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html#/onboarding') });
    } catch {
      // Opening a tab can fail in restricted contexts; the user can open the
      // dashboard from the popup instead.
    }
  }
});

// Seed catalog on worker start if it is still empty.
void seedCatalogIfEmpty();

// Make sure the defaults exist even if the install event is missed.
void readSettings().then((settings) => {
  if (settings.schemaVersion !== DEFAULT_SETTINGS.schemaVersion) {
    void writeSettings({ schemaVersion: DEFAULT_SETTINGS.schemaVersion });
  }
});

// Request persistent storage so the browser never evicts IndexedDB under disk pressure
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  void navigator.storage.persist().catch(() => {});
}

export type { RevisionRecord };
