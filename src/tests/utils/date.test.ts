import { describe, expect, it } from 'vitest';

import {
  addLocalDays,
  endOfLocalDay,
  formatDateWithWeekday,
  getDaysUntilNextSunday,
  getNextSunday,
  isSameLocalDay,
  isSunday,
  localDayDiff,
  startOfLocalDay,
} from '../../utils/date';

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

  describe('weekly Sunday revision helpers', () => {
    // 2026-10-19 is Monday
    const monday = new Date(2026, 9, 19, 14, 0, 0).getTime();
    // 2026-10-24 is Saturday
    const saturday = new Date(2026, 9, 24, 18, 0, 0).getTime();
    // 2026-10-25 is Sunday
    const sunday = new Date(2026, 9, 25, 10, 0, 0).getTime();

    it('schedules Monday to Saturday for the coming Sunday', () => {
      expect(isSunday(getNextSunday(monday))).toBe(true);
      expect(getDaysUntilNextSunday(monday)).toBe(6);

      expect(isSunday(getNextSunday(saturday))).toBe(true);
      expect(getDaysUntilNextSunday(saturday)).toBe(1);
    });

    it('schedules Sunday for the following Sunday (7 days later)', () => {
      expect(isSunday(getNextSunday(sunday))).toBe(true);
      expect(getDaysUntilNextSunday(sunday)).toBe(7);
      expect(localDayDiff(sunday, getNextSunday(sunday))).toBe(7);
    });

    it('formats dates with weekday', () => {
      expect(formatDateWithWeekday(sunday)).toBe('Sun, 25 Oct 2026');
      expect(formatDateWithWeekday(monday)).toBe('Mon, 19 Oct 2026');
    });
  });
});
