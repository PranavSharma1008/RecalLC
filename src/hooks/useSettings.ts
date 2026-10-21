import { useCallback, useEffect, useState } from 'react';

import { readSettings, writeSettings } from '../services/storage';
import type { UserSettings } from '../types';

export interface SettingsState {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  update: (patch: Partial<UserSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

/** Read and update the persisted user settings. */
export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setSettings(await readSettings());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read the settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    try {
      const next = await writeSettings(patch);
      setSettings(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the settings.');
      throw cause;
    }
  }, []);

  return { settings, loading, error, update, reload };
}
