/**
 * Date arithmetic & formatting used across the UI.
 *
 * Deliberately dependency-free and locale-stable: the extension must render
 * identically offline, so no Intl-heavy formatting that varies per machine.
 *
 * Scheduling works in **local calendar days**, never in fixed 24-hour blocks,
 * so a review scheduled "tomorrow" stays "tomorrow" across a DST change.
 */

import { MS_PER_DAY } from './time';

/* -------------------------------------------------------- calendar helpers */

/** Epoch ms of 00:00:00.000 local time on the day containing `ts`. */
export function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Epoch ms of 00:00:00.000 local time on the day *after* `ts`. */
export function startOfNextLocalDay(ts: number): number {
  const d = new Date(startOfLocalDay(ts));
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Epoch ms of the last millisecond of the local day containing `ts`. */
export function endOfLocalDay(ts: number): number {
  return startOfNextLocalDay(ts) - 1;
}

/** Epoch ms of 00:00:00.000 local time, `days` calendar days from `ts`. */
export function addLocalDays(ts: number, days: number): number {
  const d = new Date(startOfLocalDay(ts));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** True when both timestamps fall on the same local calendar day. */
export function isSameLocalDay(a: number, b: number): boolean {
  return startOfLocalDay(a) === startOfLocalDay(b);
}

/**
 * Whole local days between two timestamps (`to - from`).
 * Anchored on local noon so DST transitions never shift the result.
 */
export function localDayDiff(from: number, to: number): number {
  const a = new Date(startOfLocalDay(from));
  a.setHours(12, 0, 0, 0);
  const b = new Date(startOfLocalDay(to));
  b.setHours(12, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/* -------------------------------------------------------------- formatting */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "21 Oct 2026" */
export function formatDate(ts: number | null | undefined): string {
  if (ts === null || ts === undefined || Number.isNaN(ts)) return '—';
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "21 Oct, 14:03" */
export function formatDateTime(ts: number | null | undefined): string {
  if (ts === null || ts === undefined || Number.isNaN(ts)) return '—';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hh}:${mm}`;
}

/** "just now" / "5 minutes ago" / "3 days ago" / "in 2 days" */
export function formatRelativeTime(ts: number | null | undefined, now: number = Date.now()): string {
  if (ts === null || ts === undefined || Number.isNaN(ts)) return 'never';
  const diff = now - ts;
  const abs = Math.abs(diff);
  const future = diff < 0;

  if (abs < 45 * 1000) return future ? 'in a moment' : 'just now';
  if (abs < 90 * 60 * 1000) {
    const mins = Math.max(1, Math.round(abs / (60 * 1000)));
    return future ? `in ${mins} min` : `${mins} min ago`;
  }
  if (abs < 36 * 60 * 60 * 1000) {
    const hours = Math.round(abs / (60 * 60 * 1000));
    return future ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.round(abs / DAY_MS);
  if (days === 1) return future ? 'tomorrow' : 'yesterday';
  if (days < 30) return future ? `in ${days} days` : `${days} days ago`;
  const months = Math.round(days / 30);
  if (months === 1) return future ? 'in 1 month' : '1 month ago';
  if (months < 12) return future ? `in ${months} months` : `${months} months ago`;
  const years = Math.round(months / 12);
  return future ? `in ${years}y` : `${years}y ago`;
}

/** "today" / "tomorrow" / "3 days overdue" / "in 5 days" */
export function formatDueLabel(dueAt: number, now: number = Date.now()): string {
  const diffDays = localDayDiff(now, dueAt);
  if (diffDays === 0) return 'due today';
  if (diffDays === 1) return 'due tomorrow';
  if (diffDays === -1) return '1 day overdue';
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  return `in ${diffDays} days`;
}

/** "1 attempt" / "4 attempts" */
export function formatAttempts(count: number): string {
  return `${count} ${count === 1 ? 'attempt' : 'attempts'}`;
}

/** "2h 15m" style duration for runtime values. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}
