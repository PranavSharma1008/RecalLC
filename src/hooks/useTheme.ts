import { useEffect, useState } from 'react';

import type { ThemePreference } from '../types';

export interface ThemeState {
  theme: ThemePreference;
  resolved: 'dark' | 'light';
}

/**
 * Resolve a theme preference to either 'dark' or 'light'.
 */
export function resolveTheme(preference: ThemePreference | null | undefined): 'dark' | 'light' {
  if (preference === 'dark' || preference === 'light') return preference;
  const media =
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  return media?.matches ? 'light' : 'dark';
}

/**
 * Apply the theme preference directly to document.documentElement.
 */
export function applyTheme(preference: ThemePreference | null | undefined): 'dark' | 'light' {
  const resolved = resolveTheme(preference);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', resolved);
  }
  return resolved;
}

/**
 * Apply the user's theme preference to the document.
 *
 * The theme lives on `data-theme` so a single custom Tailwind variant drives
 * both the extension pages and the in-page reminder.
 */
export function useTheme(theme: ThemePreference | null | undefined): ThemeState {
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => resolveTheme(theme));

  useEffect(() => {
    if (!theme) return;

    const next = applyTheme(theme);
    setResolved(next);

    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia('(prefers-color-scheme: light)');
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
