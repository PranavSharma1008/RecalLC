import { describe, expect, it } from 'vitest';

import { addLocalDays, endOfLocalDay, isSameLocalDay, localDayDiff, startOfLocalDay } from '../../utils/date';

describe('local calendar helpers', () => {
  const noon = new Date(2026, 9, 21, 12, 0, 0, 0).getTime();

  it('snaps a timestamp to the start of its local day', () => {
    const expected = new Date(2026, 9, 21, 0, 0, 0, 0).getTime();
    expect(startOfLocalDay(noon)).toBe(expected);
    expect(startOfLocalDay(new Date(2026, 9, 21, 23, 59, 59, 999).getTime())).toBe(expected);
  });

  it('returns the last millisecond of the local day', () => {
    const end = endOfLocalDay(noon);
    expect(isSameLocalDay(end, noon)).toBe(true);
    expect(end - startOfLocalDay(noon)).toBeGreaterThan(22 * 60 * 60 * 1000);
  });

  it('adds calendar days, not fixed 24 hour blocks', () => {
    const result = addLocalDays(noon, 3);
    expect(new Date(result).getDate()).toBe(24);
    expect(new Date(result).getHours()).toBe(0);
  });

  it('crosses month and year boundaries', () => {
    const endOfMonth = new Date(2026, 9, 31, 12, 0, 0, 0).getTime();
    expect(new Date(addLocalDays(endOfMonth, 1)).getMonth()).toBe(10);
    const endOfYear = new Date(2026, 11, 31, 12, 0, 0, 0).getTime();
    expect(new Date(addLocalDays(endOfYear, 1)).getFullYear()).toBe(2027);
  });

  it('computes whole day differences regardless of the time of day', () => {
    const morning = new Date(2026, 9, 21, 1, 0, 0, 0).getTime();
    const evening = new Date(2026, 9, 21, 23, 0, 0, 0).getTime();
    expect(localDayDiff(morning, evening)).toBe(0);
    expect(localDayDiff(morning, addLocalDays(morning, 5))).toBe(5);
    expect(localDayDiff(addLocalDays(morning, 5), morning)).toBe(-5);
  });

  it('identifies the same local day', () => {
    expect(isSameLocalDay(noon, new Date(2026, 9, 21, 0, 0, 1).getTime())).toBe(true);
    expect(isSameLocalDay(noon, addLocalDays(noon, 1))).toBe(false);
  });
});
