// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { isTabActive } from '../../dashboard/Dashboard';

describe('Dashboard Navigation Tab Lighting & Bar Indicator', () => {
  it('correctly identifies active tab for overview root and empty hash', () => {
    expect(isTabActive('/', { path: '', segments: [] })).toBe(true);
    expect(isTabActive('/', { path: 'overview', segments: ['overview'] })).toBe(true);
    expect(isTabActive('/reminders', { path: '', segments: [] })).toBe(false);
    expect(isTabActive('/problems', { path: '', segments: [] })).toBe(false);
  });

  it('correctly identifies active tab for reminders', () => {
    expect(isTabActive('/reminders', { path: 'reminders', segments: ['reminders'] })).toBe(true);
    expect(isTabActive('/', { path: 'reminders', segments: ['reminders'] })).toBe(false);
    expect(isTabActive('/problems', { path: 'reminders', segments: ['reminders'] })).toBe(false);
  });

  it('correctly maps both problems list and recall detail routes to problems tab', () => {
    expect(isTabActive('/problems', { path: 'problems', segments: ['problems'] })).toBe(true);
    expect(isTabActive('/problems', { path: 'recall/two-sum', segments: ['recall', 'two-sum'] })).toBe(true);
    expect(isTabActive('/', { path: 'recall/two-sum', segments: ['recall', 'two-sum'] })).toBe(false);
  });

  it('correctly identifies import, settings, and support tabs', () => {
    expect(isTabActive('/import', { path: 'import', segments: ['import'] })).toBe(true);
    expect(isTabActive('/settings', { path: 'settings', segments: ['settings'] })).toBe(true);
    expect(isTabActive('/support', { path: 'support', segments: ['support'] })).toBe(true);

    expect(isTabActive('/support', { path: 'settings', segments: ['settings'] })).toBe(false);
    expect(isTabActive('/settings', { path: 'import', segments: ['import'] })).toBe(false);
  });
});
