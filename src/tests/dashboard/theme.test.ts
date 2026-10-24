// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { applyTheme, resolveTheme } from '../../hooks/useTheme';

describe('theme resolution & application', () => {
  it('resolves dark theme directly', () => {
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('resolves light theme directly', () => {
    expect(resolveTheme('light')).toBe('light');
  });

  it('resolves system theme based on matchMedia or fallback', () => {
    const resolved = resolveTheme('system');
    expect(['dark', 'light']).toContain(resolved);
  });

  it('applies theme attribute to document element', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
