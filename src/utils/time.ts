/**
 * Timestamp normalisation.
 *
 * Imported history comes from many sources, so timestamps arrive in wildly
 * different shapes. Everything is converted to **epoch milliseconds** so the
 * rest of the app never has to guess.
 *
 * Ambiguity policy
 * ----------------
 *  - A bare number is treated as Unix **seconds** below 1e11 and as Unix
 *    **milliseconds** at or above 1e11 (1e11 ms = 1973, 1e11 s = year 5138,
 *    so the two interpretations never overlap for real-world data).
 *  - A numeric *string* follows the same rule as a number.
 *  - `YYYY-MM-DD` has no time component: it is interpreted as **local
 *    midnight** (never UTC) and flagged as an ambiguity warning.
 *  - `YYYY-MM-DD HH:mm[:ss]` without a zone is interpreted as **local** time
 *    and flagged as an ambiguity warning.
 *  - Anything with an explicit offset / `Z` is parsed as absolute time.
 */

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Values strictly below this are interpreted as Unix seconds. */
export const SECONDS_UPPER_BOUND = 1e11;

export type TimestampAmbiguity = 'unix-seconds' | 'unix-milliseconds' | 'date-only' | 'local-date-time';

export type TimestampResult =
  { ok: true; value: number; ambiguity: TimestampAmbiguity | null } | { ok: false; error: string };

const NUMERIC_RE = /^-?\d+(?:\.\d+)?$/;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

function isValidLocalParts(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): boolean {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return false;
  const probe = new Date(y, mo - 1, d, h, mi, s);
  return (
    probe.getFullYear() === y &&
    probe.getMonth() === mo - 1 &&
    probe.getDate() === d &&
    probe.getHours() === h &&
    probe.getMinutes() === mi
  );
}

/** Convert a raw value to epoch milliseconds. */
export function normalizeTimestamp(input: unknown): TimestampResult {
  if (input === null || input === undefined || input === '') {
    return { ok: false, error: 'timestamp is missing' };
  }

  if (input instanceof Date) {
    const t = input.getTime();
    if (Number.isNaN(t)) return { ok: false, error: 'invalid Date object' };
    return { ok: true, value: t, ambiguity: null };
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return { ok: false, error: 'timestamp is not a finite number' };
    if (input <= 0) return { ok: false, error: 'timestamp must be a positive epoch value' };
    if (input < SECONDS_UPPER_BOUND) {
      return {
        ok: true,
        value: Math.round(input * MS_PER_SECOND),
        ambiguity: 'unix-seconds',
      };
    }
    return { ok: true, value: Math.round(input), ambiguity: 'unix-milliseconds' };
  }

  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return { ok: false, error: 'timestamp is empty' };

    if (NUMERIC_RE.test(raw)) {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return { ok: false, error: 'timestamp is not a finite number' };
      if (numeric <= 0) return { ok: false, error: 'timestamp must be a positive epoch value' };
      if (numeric < SECONDS_UPPER_BOUND) {
        return {
          ok: true,
          value: Math.round(numeric * MS_PER_SECOND),
          ambiguity: 'unix-seconds',
        };
      }
      return { ok: true, value: Math.round(numeric), ambiguity: 'unix-milliseconds' };
    }

    const dateOnly = DATE_ONLY_RE.exec(raw);
    if (dateOnly) {
      const [, ys, mos, ds] = dateOnly;
      const y = Number(ys);
      const mo = Number(mos);
      const d = Number(ds);
      if (!isValidLocalParts(y, mo, d)) {
        return { ok: false, error: `"${raw}" is not a valid calendar date` };
      }
      return { ok: true, value: new Date(y, mo - 1, d, 0, 0, 0, 0).getTime(), ambiguity: 'date-only' };
    }

    const localDateTime = LOCAL_DATETIME_RE.exec(raw);
    if (localDateTime) {
      const [, ys, mos, ds, hs, mis, ss] = localDateTime;
      const y = Number(ys);
      const mo = Number(mos);
      const d = Number(ds);
      const h = Number(hs);
      const mi = Number(mis);
      const s = ss ? Number(ss) : 0;
      if (!isValidLocalParts(y, mo, d, h, mi, s)) {
        return { ok: false, error: `"${raw}" is not a valid local date-time` };
      }
      return {
        ok: true,
        value: new Date(y, mo - 1, d, h, mi, s, 0).getTime(),
        ambiguity: 'local-date-time',
      };
    }

    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) {
      return { ok: false, error: `"${raw}" is not a recognised timestamp` };
    }
    return { ok: true, value: parsed, ambiguity: null };
  }

  return { ok: false, error: `unsupported timestamp type "${typeof input}"` };
}

/** Human-readable explanation of how a timestamp was interpreted. */
export function describeAmbiguity(ambiguity: TimestampAmbiguity | null): string | null {
  switch (ambiguity) {
    case 'unix-seconds':
      return 'value was read as Unix seconds';
    case 'unix-milliseconds':
      return 'value was read as Unix milliseconds';
    case 'date-only':
      return 'date had no time component — read as local midnight';
    case 'local-date-time':
      return 'date-time had no timezone — read as local time';
    default:
      return null;
  }
}
