/**
 * The RecallLC revision engine.
 *
 * All functions here are pure: they take data and a timestamp and return data.
 * No database access, no `Date.now()` calls hidden inside — every function
 * that needs "now" takes it as an argument. That makes the whole scheduling
 * model deterministic and unit-testable.
 *
 * Scheduling model
 * ----------------
 *  - A problem that has been attempted but never reviewed becomes due
 *    `initialIntervalDays` after its last attempt (default: 1 day).
 *  - After a review, the next due date is `reviewedAt + intervals[rating]`.
 *  - `dueAt` is always snapped to the start of a local calendar day.
 *  - "Dismiss" and "Remind tomorrow" never modify `dueAt`; they are stored
 *    separately so a dismissal can never silently reschedule a problem.
 */

import type { RecallRating, RevisionRecord } from '../types';
import { addLocalDays, endOfLocalDay, isSameLocalDay, localDayDiff, startOfLocalDay } from '../utils/date';

/** Default interval, in days, for each recall rating. */
export const DEFAULT_INTERVALS: Record<RecallRating, number> = {
  forgot: 1,
  hard: 2,
  good: 5,
  easy: 14,
};

/** Default delay, in days, between a first attempt and the first review. */
export const DEFAULT_INITIAL_INTERVAL_DAYS = 1;

/** A problem is considered "due" from the start of its due day onwards. */
export function isDue(dueAt: number, now: number): boolean {
  return dueAt <= endOfLocalDay(now);
}

/** True when the problem is due on today's local calendar day. */
export function isDueToday(dueAt: number, now: number): boolean {
  return isSameLocalDay(dueAt, now) && dueAt <= endOfLocalDay(now);
}

/** True when the problem's due day is in the past. */
export function isOverdue(dueAt: number, now: number): boolean {
  return startOfLocalDay(dueAt) < startOfLocalDay(now);
}

/** Signed number of days until the due day (negative = overdue). */
export function daysUntilDue(dueAt: number, now: number): number {
  return localDayDiff(now, dueAt);
}

/** Whole days the problem has been overdue (0 when it is not overdue). */
export function overdueDays(dueAt: number, now: number): number {
  if (!isOverdue(dueAt, now)) return 0;
  return localDayDiff(dueAt, now);
}

/**
 * Next review date for a rating, snapped to local midnight.
 * A "forgot" rating also resets the repetition stage.
 */
export function nextDueDate(
  rating: RecallRating,
  reviewedAt: number,
  intervals: Record<RecallRating, number> = DEFAULT_INTERVALS,
): number {
  const days = sanitizeInterval(intervals[rating]);
  return addLocalDays(reviewedAt, days);
}

/** Due date for a problem that has been attempted but never reviewed. */
export function initialDueDate(lastAttemptAt: number, initialIntervalDays = DEFAULT_INITIAL_INTERVAL_DAYS): number {
  const days = Math.max(0, Math.floor(initialIntervalDays));
  return addLocalDays(lastAttemptAt, days);
}

function sanitizeInterval(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.floor(value));
}

/* -------------------------------------------------------------- eligibility */

export interface EligibilityOptions {
  /** Hide the problem until this timestamp (snooze). */
  snoozedUntil?: number | null;
  /** Hide the problem until the end of the local day it was dismissed. */
  dismissedAt?: number | null;
  /** Paused problems are never reminded. */
  paused?: boolean;
}

/**
 * Should this revision record be surfaced as a reminder right now?
 * Paused, snoozed and dismissed-today problems are excluded.
 */
export function isReminderEligible(revision: Pick<RevisionRecord, 'dueAt'> & EligibilityOptions, now: number): boolean {
  if (revision.paused) return false;
  if (!isDue(revision.dueAt, now)) return false;
  if (revision.snoozedUntil !== null && revision.snoozedUntil !== undefined) {
    if (revision.snoozedUntil > now) return false;
  }
  if (revision.dismissedAt !== null && revision.dismissedAt !== undefined) {
    // Dismissed problems come back after the local day they were dismissed on.
    if (isSameLocalDay(revision.dismissedAt, now)) return false;
  }
  return true;
}

/**
 * Priority for the reminder queue. Higher wins.
 * Overdue problems come first, then due-today, then problems the user
 * struggled with, then problems with more attempts.
 */
export function priorityScore(
  revision: { dueAt: number; snoozedUntil?: number | null; dismissedAt?: number | null; paused?: boolean },
  problem: { struggleScore?: number; attemptCount?: number } | null,
  now: number,
): number {
  let score = 0;
  if (isOverdue(revision.dueAt, now)) {
    score += 1000;
    score += Math.min(500, overdueDays(revision.dueAt, now) * 10);
  } else if (isDueToday(revision.dueAt, now)) {
    score += 500;
  }
  score += (problem?.struggleScore ?? 0) * 100;
  score += Math.min(20, problem?.attemptCount ?? 0);
  return score;
}

/**
 * Order candidate problems for the reminder queue.
 * Deterministic: ties break on the oldest due date, then the slug.
 */
export function sortByPriority<
  T extends { slug: string; dueAt: number; struggleScore?: number; attemptCount?: number },
>(candidates: readonly T[], now: number): T[] {
  return [...candidates].sort((a, b) => {
    // Highest priority first.
    const scoreDiff = priorityScore(b, b, now) - priorityScore(a, a, now);
    if (scoreDiff !== 0) return scoreDiff;
    if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
    return a.slug.localeCompare(b.slug);
  });
}

/**
 * Pick the single problem to remind about.
 * The problem the user is currently looking at is always excluded.
 */
export function pickReminder<T extends { slug: string; dueAt: number; struggleScore?: number; attemptCount?: number }>(
  candidates: readonly T[],
  currentSlug: string | null | undefined,
  now: number,
): T | null {
  const eligible = candidates.filter((candidate) => candidate.slug !== currentSlug);
  if (eligible.length === 0) return null;
  const ordered = sortByPriority(eligible, now);
  return ordered[0] ?? null;
}

/* ------------------------------------------------------------------ streaks */

/**
 * Consecutive days (ending today or yesterday) on which at least one review
 * was completed.
 */
export function computeStreak(reviewDays: readonly number[], now: number): number {
  if (reviewDays.length === 0) return 0;
  const unique = new Set(reviewDays.map((ts) => startOfLocalDay(ts)));
  if (unique.size === 0) return 0;

  let streak = 0;
  // Today counts; if there is no review today, the streak may still be alive
  // if yesterday was reviewed (the day is not over yet).
  let cursor = startOfLocalDay(now);
  if (!unique.has(cursor)) {
    cursor = addLocalDays(cursor, -1);
    if (!unique.has(cursor)) return 0;
  }
  while (unique.has(cursor)) {
    streak++;
    cursor = addLocalDays(cursor, -1);
  }
  return streak;
}

/* --------------------------------------------------------------- summaries */

export interface DueSummary {
  dueToday: number;
  overdue: number;
  due: number;
}

export function summarizeDue(
  revisions: readonly Pick<RevisionRecord, 'dueAt' | 'paused' | 'snoozedUntil' | 'dismissedAt'>[],
  now: number,
): DueSummary {
  let dueToday = 0;
  let overdue = 0;
  let due = 0;
  for (const revision of revisions) {
    if (revision.paused) continue;
    if (!isReminderEligible(revision, now)) continue;
    if (isOverdue(revision.dueAt, now)) overdue++;
    else if (isDueToday(revision.dueAt, now)) dueToday++;
    due++;
  }
  return { dueToday, overdue, due };
}

/* --------------------------------------------------------------- mutations */

/** Apply a recall rating to a revision record. Returns a new record. */
export function applyRating(
  revision: RevisionRecord,
  rating: RecallRating,
  reviewedAt: number,
  intervals: Record<RecallRating, number> = DEFAULT_INTERVALS,
): RevisionRecord {
  const dueAt = nextDueDate(rating, reviewedAt, intervals);
  return {
    ...revision,
    stage: rating === 'forgot' ? 0 : revision.stage + 1,
    lastRating: rating,
    lastReviewedAt: reviewedAt,
    dueAt,
    snoozedUntil: null,
    dismissedAt: null,
    updatedAt: reviewedAt,
  };
}

/** Snooze a problem until the next local midnight. Never changes `dueAt`. */
export function applySnooze(revision: RevisionRecord, now: number, until?: number): RevisionRecord {
  const snoozedUntil = until ?? addLocalDays(now, 1);
  return { ...revision, snoozedUntil, updatedAt: now };
}

/** Dismiss a problem for the rest of today. Never changes `dueAt`. */
export function applyDismiss(revision: RevisionRecord, now: number): RevisionRecord {
  return { ...revision, dismissedAt: now, updatedAt: now };
}

/** Create the first revision record for a problem. */
export function createRevision(slug: string, dueAt: number, now: number = Date.now()): RevisionRecord {
  return {
    slug,
    stage: 0,
    lastRating: null,
    lastReviewedAt: null,
    dueAt,
    snoozedUntil: null,
    dismissedAt: null,
    paused: false,
    createdAt: now,
    updatedAt: now,
  };
}
