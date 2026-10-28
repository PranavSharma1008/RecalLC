/**
 * User settings — small, structured data kept in `chrome.storage.local`.
 *
 * Settings are readable from every extension context (service worker,
 * popup, dashboard *and* the content script), which lets the in-page
 * reminder render with the correct theme without a round-trip.
 */

import type { RecallRating, ThemePreference, UserSettings } from '../types';
import { DEFAULT_INTERVALS, DEFAULT_INITIAL_INTERVAL_DAYS } from './revisionEngine';

export const SETTINGS_KEY = 'recalllc:settings';

export const DEFAULT_SETTINGS: UserSettings = {
  schemaVersion: 1,
  theme: 'dark',
  intervals: { ...DEFAULT_INTERVALS },
  initialScheduleMode: 'weekly_sunday',
  weeklyRevisionDay: 0,
  initialIntervalDays: DEFAULT_INITIAL_INTERVAL_DAYS,
  remindersEnabled: true,
  reminderDelayMs: 800,
  maxRemindersPerSession: 5,
  autoTrackSubmissions: true,
  accountSyncEnabled: true,
  accountSyncLimit: 200,
  showTopicInReminder: true,
  onboardingCompleted: false,
  securityAuthEnabled: false,
  securityPasscodeHash: null,
  securityPasscodeSalt: null,
  securityAutoLockMinutes: 15,
  securityLastUnlockedAt: null,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Merge stored settings over the defaults, discarding malformed values. */
export function mergeSettings(stored: unknown): UserSettings {
  if (!isPlainObject(stored)) return { ...DEFAULT_SETTINGS, intervals: { ...DEFAULT_INTERVALS } };

  const intervals = { ...DEFAULT_INTERVALS };
  if (isPlainObject(stored.intervals)) {
    for (const key of Object.keys(DEFAULT_INTERVALS) as RecallRating[]) {
      const value = stored.intervals[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        intervals[key] = Math.floor(value);
      }
    }
  }

  const theme: ThemePreference =
    stored.theme === 'light' || stored.theme === 'dark' || stored.theme === 'system' ? stored.theme : 'dark';

  const initialScheduleMode: 'weekly_sunday' | 'fixed_days' =
    stored.initialScheduleMode === 'fixed_days' ? 'fixed_days' : 'weekly_sunday';

  return {
    schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    theme,
    intervals,
    initialScheduleMode,
    weeklyRevisionDay:
      typeof stored.weeklyRevisionDay === 'number' && stored.weeklyRevisionDay >= 0 && stored.weeklyRevisionDay <= 6
        ? Math.floor(stored.weeklyRevisionDay)
        : 0,
    initialIntervalDays:
      typeof stored.initialIntervalDays === 'number' && stored.initialIntervalDays >= 0
        ? Math.floor(stored.initialIntervalDays)
        : DEFAULT_INITIAL_INTERVAL_DAYS,
    remindersEnabled:
      typeof stored.remindersEnabled === 'boolean' ? stored.remindersEnabled : DEFAULT_SETTINGS.remindersEnabled,
    reminderDelayMs:
      typeof stored.reminderDelayMs === 'number' && stored.reminderDelayMs >= 0
        ? Math.min(60000, Math.floor(stored.reminderDelayMs))
        : DEFAULT_SETTINGS.reminderDelayMs,
    maxRemindersPerSession:
      typeof stored.maxRemindersPerSession === 'number' && stored.maxRemindersPerSession >= 0
        ? Math.min(50, Math.floor(stored.maxRemindersPerSession))
        : DEFAULT_SETTINGS.maxRemindersPerSession,
    autoTrackSubmissions:
      typeof stored.autoTrackSubmissions === 'boolean'
        ? stored.autoTrackSubmissions
        : DEFAULT_SETTINGS.autoTrackSubmissions,
    accountSyncEnabled:
      typeof stored.accountSyncEnabled === 'boolean' ? stored.accountSyncEnabled : DEFAULT_SETTINGS.accountSyncEnabled,
    accountSyncLimit:
      typeof stored.accountSyncLimit === 'number' && stored.accountSyncLimit > 0
        ? Math.min(2000, Math.floor(stored.accountSyncLimit))
        : DEFAULT_SETTINGS.accountSyncLimit,
    showTopicInReminder:
      typeof stored.showTopicInReminder === 'boolean'
        ? stored.showTopicInReminder
        : DEFAULT_SETTINGS.showTopicInReminder,
    onboardingCompleted:
      typeof stored.onboardingCompleted === 'boolean'
        ? stored.onboardingCompleted
        : DEFAULT_SETTINGS.onboardingCompleted,
    securityAuthEnabled:
      typeof stored.securityAuthEnabled === 'boolean'
        ? stored.securityAuthEnabled
        : DEFAULT_SETTINGS.securityAuthEnabled,
    securityPasscodeHash:
      typeof stored.securityPasscodeHash === 'string' && /^[0-9a-fA-F]{64}$/.test(stored.securityPasscodeHash)
        ? stored.securityPasscodeHash.toLowerCase()
        : DEFAULT_SETTINGS.securityPasscodeHash,
    securityPasscodeSalt:
      typeof stored.securityPasscodeSalt === 'string' && /^[0-9a-fA-F]{16,128}$/.test(stored.securityPasscodeSalt)
        ? stored.securityPasscodeSalt.toLowerCase()
        : DEFAULT_SETTINGS.securityPasscodeSalt,
    securityAutoLockMinutes:
      typeof stored.securityAutoLockMinutes === 'number' && Number.isFinite(stored.securityAutoLockMinutes)
        ? stored.securityAutoLockMinutes
        : DEFAULT_SETTINGS.securityAutoLockMinutes,
    securityLastUnlockedAt:
      typeof stored.securityLastUnlockedAt === 'number' && Number.isFinite(stored.securityLastUnlockedAt)
        ? stored.securityLastUnlockedAt
        : DEFAULT_SETTINGS.securityLastUnlockedAt,
  };
}

function storageArea(): chrome.storage.StorageArea | null {
  const area = globalThis.chrome?.storage?.local;
  if (area) return area;
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      get: async (keys?: string | string[] | null) => {
        try {
          if (!keys) {
            const out: Record<string, unknown> = {};
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k) {
                try {
                  out[k] = JSON.parse(localStorage.getItem(k) || '');
                } catch {
                  out[k] = localStorage.getItem(k);
                }
              }
            }
            return out;
          }
          const list = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const key of list) {
            const item = localStorage.getItem(key);
            if (item !== null) {
              try {
                result[key] = JSON.parse(item);
              } catch {
                result[key] = item;
              }
            }
          }
          return result;
        } catch {
          return {};
        }
      },
      set: async (items: Record<string, unknown>) => {
        try {
          for (const [k, v] of Object.entries(items)) {
            localStorage.setItem(k, JSON.stringify(v));
          }
        } catch {
          // Ignore
        }
      },
      remove: async (keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) localStorage.removeItem(k);
      },
      clear: async () => {
        localStorage.clear();
      },
    } as unknown as chrome.storage.StorageArea;
  }
  return null;
}

let cachedSettings: UserSettings | null = null;
let cachedSettingsTime = 0;
const SETTINGS_CACHE_TTL_MS = 2500;

/** Clear in-memory settings cache */
export function clearSettingsCache(): void {
  cachedSettings = null;
  cachedSettingsTime = 0;
}

try {
  globalThis.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SETTINGS_KEY]) {
      cachedSettings = mergeSettings(changes[SETTINGS_KEY].newValue);
      cachedSettingsTime = Date.now();
    }
  });
} catch {
  // Ignore in environments without chrome.storage
}

/** Read the effective settings with ultra-fast memory cache. Falls back to defaults when unavailable. */
export async function readSettings(): Promise<UserSettings> {
  if (cachedSettings && Date.now() - cachedSettingsTime < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings;
  }
  const area = storageArea();
  if (!area) return { ...DEFAULT_SETTINGS, intervals: { ...DEFAULT_INTERVALS } };
  try {
    const result = await area.get(SETTINGS_KEY);
    const settings = mergeSettings(result?.[SETTINGS_KEY]);
    cachedSettings = settings;
    cachedSettingsTime = Date.now();
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS, intervals: { ...DEFAULT_INTERVALS } };
  }
}

/** Persist a settings patch and return the merged result. */
export async function writeSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await readSettings();
  const next = mergeSettings({ ...current, ...patch });
  cachedSettings = next;
  cachedSettingsTime = Date.now();
  const area = storageArea();
  if (area) await area.set({ [SETTINGS_KEY]: next });
  return next;
}

/** Restore the shipped defaults. */
export async function resetSettings(): Promise<UserSettings> {
  const area = storageArea();
  const next = { ...DEFAULT_SETTINGS, intervals: { ...DEFAULT_INTERVALS } };
  cachedSettings = next;
  cachedSettingsTime = Date.now();
  if (area) await area.set({ [SETTINGS_KEY]: next });
  return next;
}
