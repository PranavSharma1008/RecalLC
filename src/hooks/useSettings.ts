import { useCallback, useEffect, useState } from 'react';

import { mergeSettings, readSettings, writeSettings } from '../services/storage';
import { applyTheme } from './useTheme';
import type { UserSettings } from '../types';

export interface SettingsState {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  update: (patch: Partial<UserSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

// Module-level subscribers to synchronize all useSettings instances within the same page
const subscribers = new Set<(settings: UserSettings) => void>();
let cachedSettings: UserSettings | null = null;

function broadcastSettings(next: UserSettings): void {
  cachedSettings = next;
  if (next.theme) {
    applyTheme(next.theme);
  }
  for (const subscriber of subscribers) {
    try {
      subscriber(next);
    } catch (err) {
      console.error('Settings subscriber error:', err);
    }
  }
}

// Listen to storage changes across extension tabs/popups
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['recalllc:settings']?.newValue) {
      const merged = mergeSettings(changes['recalllc:settings'].newValue);
      broadcastSettings(merged);
    }
  });
}

/** Read and update the persisted user settings. */
export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<UserSettings | null>(cachedSettings);
  const [loading, setLoading] = useState(!cachedSettings);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(!cachedSettings);
      const loaded = await readSettings();
      cachedSettings = loaded;
      setSettings(loaded);
      if (loaded.theme) {
        applyTheme(loaded.theme);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read the settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const subscriber = (next: UserSettings) => {
      setSettings(next);
    };
    subscribers.add(subscriber);

    void reload();

    return () => {
      subscribers.delete(subscriber);
    };
  }, [reload]);

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    try {
      const next = await writeSettings(patch);
      setSettings(next);
      broadcastSettings(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the settings.');
      throw cause;
    }
  }, []);

  return { settings, loading, error, update, reload };
}
