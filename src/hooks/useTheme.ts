import { useEffect, useState } from 'react';

import type { ThemePreference } from '../types';

export interface ThemeState {
  theme: ThemePreference;
  resolved: 'dark' | 'light';
}

/**
 * Apply the user's theme preference to the document.
 *
 * The theme lives on `data-theme` so a single custom Tailwind variant drives
 * both the extension pages and the in-page reminder.
 */
export function useTheme(theme: ThemePreference | null | undefined): ThemeState {
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (!theme) return;

    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    const next = theme === 'system' ? (media?.matches ? 'light' : 'dark') : theme;
    setResolved(next);
    document.documentElement.setAttribute('data-theme', next);

    if (theme !== 'system' || !media) return;

    const onChange = (event: MediaQueryListEvent) => {
      const updated = event.matches ? 'light' : 'dark';
      setResolved(updated);
      document.documentElement.setAttribute('data-theme', updated);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return { theme: theme ?? 'dark', resolved };
}
