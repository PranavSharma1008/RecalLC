import { describe, expect, it } from 'vitest';

import { describeAmbiguity, normalizeTimestamp } from '../../utils/time';

describe('normalizeTimestamp', () => {
  it('reads small numbers as Unix seconds', () => {
    const result = normalizeTimestamp(1792454400);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(1792454400000);
    expect(result.ambiguity).toBe('unix-seconds');
  });

  it('reads large numbers as Unix milliseconds', () => {
    const result = normalizeTimestamp(1792454400000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(1792454400000);
    expect(result.ambiguity).toBe('unix-milliseconds');
  });

  it('treats numeric strings exactly like numbers', () => {
    const seconds = normalizeTimestamp('1792454400');
    const milliseconds = normalizeTimestamp('1792454400000');
    expect(seconds.ok && seconds.value).toBe(1792454400000);
    expect(milliseconds.ok && milliseconds.value).toBe(1792454400000);
  });

  it('parses ISO 8601 timestamps', () => {
    const result = normalizeTimestamp('2026-10-21T09:00:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(Date.parse('2026-10-21T09:00:00.000Z'));
    expect(result.ambiguity).toBeNull();
  });

  it('parses ISO 8601 timestamps with an offset', () => {
    const result = normalizeTimestamp('2026-10-21T09:00:00+02:00');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(Date.parse('2026-10-21T07:00:00Z'));
  });

  it('reads a date without a time as local midnight and flags it', () => {
    const result = normalizeTimestamp('2026-10-21');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = new Date(2026, 9, 21, 0, 0, 0, 0).getTime();
    expect(result.value).toBe(expected);
    expect(result.ambiguity).toBe('date-only');
  });

  it('reads a date-time without a zone as local time and flags it', () => {
    const result = normalizeTimestamp('2026-10-21 09:30:00');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = new Date(2026, 9, 21, 9, 30, 0, 0).getTime();
    expect(result.value).toBe(expected);
    expect(result.ambiguity).toBe('local-date-time');
  });

  it('accepts Date instances', () => {
    const date = new Date('2026-10-21T09:00:00.000Z');
    const result = normalizeTimestamp(date);
    expect(result.ok && result.value).toBe(date.getTime());
  });

  it('rejects missing, empty and malformed values', () => {
    expect(normalizeTimestamp(null).ok).toBe(false);
    expect(normalizeTimestamp(undefined).ok).toBe(false);
    expect(normalizeTimestamp('').ok).toBe(false);
    expect(normalizeTimestamp('not a date').ok).toBe(false);
    expect(normalizeTimestamp(Number.NaN).ok).toBe(false);
    expect(normalizeTimestamp(-5).ok).toBe(false);
    expect(normalizeTimestamp({}).ok).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    expect(normalizeTimestamp('2026-02-31').ok).toBe(false);
    expect(normalizeTimestamp('2026-13-01').ok).toBe(false);
    expect(normalizeTimestamp('2026-10-21T25:00:00').ok).toBe(false);
  });

  it('explains each ambiguity', () => {
    expect(describeAmbiguity('unix-seconds')).toMatch(/seconds/i);
    expect(describeAmbiguity('unix-milliseconds')).toMatch(/milliseconds/i);
    expect(describeAmbiguity('date-only')).toMatch(/local midnight/i);
    expect(describeAmbiguity('local-date-time')).toMatch(/local time/i);
    expect(describeAmbiguity(null)).toBeNull();
  });
});
