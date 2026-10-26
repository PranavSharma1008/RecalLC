/**
 * Typed messaging between the extension contexts.
 *
 * The service worker owns the IndexedDB database, so every bulk read/write
 * travels through `chrome.runtime.sendMessage`. Settings are the exception:
 * they live in `chrome.storage.local` and are read directly (the content
 * script needs the theme before it can paint).
 */

import type {
  BackupFile,
  CatalogEntry,
  DashboardStats,
  ImportPreview,
  ImportResult,
  Problem,
  ProblemWithSchedule,
  RecallRating,
  ReminderCandidate,
  ReminderPayload,
  RevisionRecord,
  SubmissionAttempt,
  UserSettings,
} from '../types';
import type { ImportBatch } from './db';
import type { AttemptInput, ManualSaveInput } from './repository';

export const MESSAGE_CHANNEL = 'recalllc';

export interface ServiceMap {
  'get-reminder': { payload: { currentSlug: string | null }; response: ReminderPayload };
  'list-due': { payload: { now?: number } | void; response: ReminderCandidate[] };
  'list-problems': { payload: { now?: number } | void; response: ProblemWithSchedule[] };
  'get-problem': {
    payload: { slug: string };
    response: { problem: Problem | null; revision: RevisionRecord | null; attempts: SubmissionAttempt[] };
  };
  'save-problem': { payload: ManualSaveInput; response: Problem };
  'update-notes': { payload: { slug: string; notes: string }; response: Problem | null };
  'delete-problem': { payload: { slug: string }; response: boolean };
  rate: { payload: { slug: string; rating: RecallRating }; response: RevisionRecord | null };
  snooze: { payload: { slug: string }; response: RevisionRecord | null };
  dismiss: { payload: { slug: string }; response: RevisionRecord | null };
  reschedule: { payload: { slug: string; dueAt: number }; response: RevisionRecord | null };
  'set-paused': { payload: { slug: string; paused: boolean }; response: RevisionRecord | null };
  'record-attempt': {
    payload: AttemptInput;
    response: { created: boolean; duplicate: boolean };
  };
  'mark-viewed': { payload: { slug: string }; response: boolean };
  stats: { payload: void; response: DashboardStats };
  'import-preview': { payload: { fileName: string; content: string }; response: ImportPreview };
  'import-commit': { payload: { fileName: string; content: string }; response: ImportResult };
  'import-history': { payload: void; response: ImportBatch[] };
  export: { payload: void; response: BackupFile };
  restore: { payload: { backup: BackupFile }; response: { problems: number; attempts: number } };
  'clear-all': { payload: void; response: boolean };
  'purge-sample-data': {
    payload: void;
    response: { deletedAttempts: number; deletedProblems: number };
  };
  'catalog-merge': { payload: { entries: CatalogEntry[] }; response: number };
  'catalog-needed': { payload: void; response: { slugs: string[] } };
  'catalog-legacy-refresh': { payload: void; response: number };
  'account-sync': {
    payload: {
      attempts: Array<{
        slug: string;
        title?: string | null;
        attemptedAt: number;
        accepted?: boolean | null;
        language?: string | null;
        submissionId?: string | null;
      }>;
    };
    response: ImportResult;
  };
  'get-settings': { payload: void; response: UserSettings };
  'update-settings': { payload: Partial<UserSettings>; response: UserSettings };
  'open-problem': { payload: { url: string }; response: boolean };
  'open-dashboard': { payload: { hash?: string } | void; response: boolean };
}

export type ServiceMethod = keyof ServiceMap;

export interface Envelope<K extends ServiceMethod = ServiceMethod> {
  channel: typeof MESSAGE_CHANNEL;
  method: K;
  payload?: unknown;
}

export interface ServiceEnvelope {
  ok: true;
  data: unknown;
}

export interface ServiceErrorEnvelope {
  ok: false;
  error: string;
}

function isServiceEnvelope(value: unknown): value is ServiceEnvelope | ServiceErrorEnvelope {
  return (
    typeof value === 'object' && value !== null && 'ok' in value && typeof (value as { ok: unknown }).ok === 'boolean'
  );
}

/** Read methods eligible for high-speed in-memory caching & request coalescing */
const CACHABLE_READ_METHODS = new Set<ServiceMethod>([
  'stats',
  'list-due',
  'list-problems',
  'get-problem',
  'get-reminder',
  'get-settings',
  'catalog-needed',
  'import-history',
]);

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const serviceCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const DEFAULT_CACHE_TTL_MS = 1200;

/** Invalidate all or specific cached service responses */
export function invalidateServiceCache(method?: ServiceMethod): void {
  if (method) {
    const prefix = `${method}:`;
    for (const key of serviceCache.keys()) {
      if (key.startsWith(prefix)) {
        serviceCache.delete(key);
      }
    }
  } else {
    serviceCache.clear();
  }
}

export interface CallOptions {
  bypassCache?: boolean;
}

/** Call a service method on the background worker with ultra-fast caching and coalescing. */
export async function callService<K extends ServiceMethod>(
  method: K,
  payload?: ServiceMap[K]['payload'],
  options?: CallOptions,
): Promise<ServiceMap[K]['response']> {
  const isCachable = CACHABLE_READ_METHODS.has(method);
  const cacheKey = `${method}:${payload ? JSON.stringify(payload) : ''}`;

  // If a mutation/write method is called, immediately invalidate cached reads
  if (!isCachable) {
    invalidateServiceCache();
  }

  // Check ultra-fast in-memory cache for read methods
  if (isCachable && !options?.bypassCache) {
    const cached = serviceCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < DEFAULT_CACHE_TTL_MS) {
      return cached.data as ServiceMap[K]['response'];
    }
  }

  // Deduplicate in-flight requests for identical method + payload
  if (inFlightRequests.has(cacheKey) && !options?.bypassCache) {
    return inFlightRequests.get(cacheKey) as Promise<ServiceMap[K]['response']>;
  }

  const envelope: Envelope<K> = { channel: MESSAGE_CHANNEL, method, payload };

  const execute = async (): Promise<ServiceMap[K]['response']> => {
    try {
      const response = (await chrome.runtime.sendMessage(envelope)) as
        ServiceEnvelope | ServiceErrorEnvelope | undefined;

      if (!response) {
        throw new Error('The RecallLC background worker did not respond.');
      }
      if (isServiceEnvelope(response)) {
        if (!response.ok) {
          throw new Error((response as ServiceErrorEnvelope).error);
        }
        const data = response.data as ServiceMap[K]['response'];
        if (isCachable) {
          serviceCache.set(cacheKey, { data, cachedAt: Date.now() });
        } else {
          invalidateServiceCache();
        }
        return data;
      }
      throw new Error('The RecallLC background worker returned an unreadable response.');
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  };

  const promise = execute();
  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/** Build the success envelope (service-worker side). */
export function ok<T>(data: T): ServiceEnvelope {
  return { ok: true, data };
}

/** Build the failure envelope (service-worker side). */
export function fail(error: unknown): ServiceErrorEnvelope {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message };
}
