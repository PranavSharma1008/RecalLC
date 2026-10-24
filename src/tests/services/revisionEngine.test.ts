import { describe, expect, it } from 'vitest';

import {
  applyDismiss,
  applyRating,
  applySnooze,
  computeStreak,
  createRevision,
  DEFAULT_INTERVALS,
  initialDueDate,
  isDue,
  isDueToday,
  isOverdue,
  isReminderEligible,
  nextDueDate,
  overdueDays,
  pickReminder,
  priorityScore,
  sortByPriority,
  summarizeDue,
} from '../../services/revisionEngine';
import { addLocalDays, startOfLocalDay } from '../../utils/date';
import type { RecallRating, RevisionRecord } from '../../types';

const NOW = new Date(2026, 9, 21, 14, 30, 0, 0).getTime();

function revision(overrides: Partial<RevisionRecord> = {}): RevisionRecord {
  return {
    ...createRevision('two-sum', startOfLocalDay(NOW), NOW),
    ...overrides,
  };
}

describe('intervals', () => {
  it('uses the documented default intervals', () => {
    expect(DEFAULT_INTERVALS).toEqual({ forgot: 1, hard: 2, good: 5, easy: 14 });
  });

  it('schedules the next review from the rating', () => {
    const cases: Array<[RecallRating, number]> = [
      ['forgot', 1],
      ['hard', 2],
      ['good', 5],
      ['easy', 14],
    ];
    for (const [rating, days] of cases) {
      const due = nextDueDate(rating, NOW);
      expect(startOfLocalDay(due)).toBe(addLocalDays(NOW, days));
    }
  });

  it('honours custom intervals', () => {
    const intervals = { forgot: 3, hard: 7, good: 21, easy: 60 };
    expect(startOfLocalDay(nextDueDate('easy', NOW, intervals))).toBe(addLocalDays(NOW, 60));
  });

  it('snaps the next review date to local midnight', () => {
    const due = nextDueDate('good', NOW);
    expect(new Date(due).getHours()).toBe(0);
    expect(new Date(due).getMinutes()).toBe(0);
  });

  it('makes a never-reviewed problem due after the initial interval', () => {
    const threeDaysAgo = addLocalDays(NOW, -3);
    // Attempted three days ago with the default 1-day initial interval:
    // it became due two days ago and is therefore overdue now.
    const due = initialDueDate(threeDaysAgo, 1);
    expect(isOverdue(due, NOW)).toBe(true);
    expect(overdueDays(due, NOW)).toBe(2);
  });
});

describe('due detection', () => {
  it('detects a problem due today', () => {
    const due = startOfLocalDay(NOW);
    expect(isDue(due, NOW)).toBe(true);
    expect(isDueToday(due, NOW)).toBe(true);
    expect(isOverdue(due, NOW)).toBe(false);
  });

  it('detects a problem due tomorrow', () => {
    const due = addLocalDays(NOW, 1);
    expect(isDue(due, NOW)).toBe(false);
    expect(isDueToday(due, NOW)).toBe(false);
  });

  it('detects an overdue problem', () => {
    const due = addLocalDays(NOW, -2);
    expect(isDue(due, NOW)).toBe(true);
    expect(isOverdue(due, NOW)).toBe(true);
    expect(overdueDays(due, NOW)).toBe(2);
  });
});

describe('snoozing and dismissal', () => {
  it('snoozes until the next local midnight without changing the schedule', () => {
    const original = revision({ dueAt: startOfLocalDay(NOW) });
    const snoozed = applySnooze(original, NOW);
    expect(snoozed.dueAt).toBe(original.dueAt);
    expect(snoozed.snoozedUntil).toBe(startOfLocalDay(addLocalDays(NOW, 1)));
  });

  it('hides a snoozed problem until tomorrow', () => {
    const original = revision({ dueAt: startOfLocalDay(NOW) });
    const snoozed = applySnooze(original, NOW);
    expect(isReminderEligible(snoozed, NOW)).toBe(false);
    expect(isReminderEligible(snoozed, addLocalDays(NOW, 1))).toBe(true);
  });

  it('dismisses for the rest of today without changing the schedule', () => {
    const original = revision({ dueAt: startOfLocalDay(NOW) });
    const dismissed = applyDismiss(original, NOW);
    expect(dismissed.dueAt).toBe(original.dueAt);
    expect(dismissed.dismissedAt).toBe(NOW);
  });

  it('hides a dismissed problem for today and brings it back tomorrow', () => {
    const original = revision({ dueAt: startOfLocalDay(NOW) });
    const dismissed = applyDismiss(original, NOW);
    expect(isReminderEligible(dismissed, NOW)).toBe(false);
    expect(isReminderEligible(dismissed, addLocalDays(NOW, 1))).toBe(true);
  });

  it('never surfaces a paused problem', () => {
    const paused = revision({ dueAt: startOfLocalDay(NOW), paused: true });
    expect(isReminderEligible(paused, NOW)).toBe(false);
  });
});

describe('rating a problem', () => {
  it('reschedules the problem and records the rating', () => {
    const original = revision({ dueAt: startOfLocalDay(NOW) });
    const rated = applyRating(original, 'good', NOW);
    expect(rated.lastRating).toBe('good');
    expect(rated.lastReviewedAt).toBe(NOW);
    expect(rated.dueAt).toBe(addLocalDays(NOW, 5));
    expect(rated.stage).toBe(1);
  });

  it('resets the stage after a "forgot" rating', () => {
    const original = revision({ stage: 4, dueAt: startOfLocalDay(NOW) });
    const rated = applyRating(original, 'forgot', NOW);
    expect(rated.stage).toBe(0);
    expect(rated.dueAt).toBe(addLocalDays(NOW, 1));
  });

  it('clears a snooze after a review', () => {
    const snoozed = revision({ dueAt: startOfLocalDay(NOW), snoozedUntil: addLocalDays(NOW, 1) });
    const rated = applyRating(snoozed, 'easy', NOW);
    expect(rated.snoozedUntil).toBeNull();
  });
});

describe('reminder selection', () => {
  const overdue = {
    slug: 'overdue-problem',
    dueAt: addLocalDays(NOW, -3),
    struggleScore: 0.1,
    attemptCount: 2,
  };
  const dueToday = {
    slug: 'due-today-problem',
    dueAt: startOfLocalDay(NOW),
    struggleScore: 0.1,
    attemptCount: 2,
  };
  const struggled = {
    slug: 'struggled-problem',
    dueAt: startOfLocalDay(NOW),
    struggleScore: 0.9,
    attemptCount: 8,
  };

  it('excludes the problem the user is currently looking at', () => {
    const picked = pickReminder([overdue, dueToday], 'overdue-problem', NOW);
    expect(picked?.slug).toBe('due-today-problem');
  });

  it('returns null when nothing else is due', () => {
    expect(pickReminder([overdue], 'overdue-problem', NOW)).toBeNull();
    expect(pickReminder([], null, NOW)).toBeNull();
  });

  it('prioritises overdue problems', () => {
    const picked = pickReminder([dueToday, overdue], null, NOW);
    expect(picked?.slug).toBe('overdue-problem');
  });

  it('prioritises problems the user struggled with', () => {
    const picked = pickReminder([dueToday, struggled], null, NOW);
    expect(picked?.slug).toBe('struggled-problem');
  });

  it('orders candidates deterministically', () => {
    const ordered = sortByPriority([dueToday, overdue, struggled], NOW);
    expect(ordered.map((entry) => entry.slug)).toEqual(['overdue-problem', 'struggled-problem', 'due-today-problem']);
  });
});

describe('summaries', () => {
  it('counts due-today and overdue problems', () => {
    const summary = summarizeDue(
      [
        revision({ slug: 'a', dueAt: startOfLocalDay(NOW) }),
        revision({ slug: 'b', dueAt: addLocalDays(NOW, -1) }),
        revision({ slug: 'c', dueAt: addLocalDays(NOW, 5) }),
        revision({ slug: 'd', dueAt: startOfLocalDay(NOW), paused: true }),
      ],
      NOW,
    );
    expect(summary.dueToday).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.due).toBe(2);
  });
});

describe('streaks', () => {
  it('is zero without any reviews', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const days = [NOW, addLocalDays(NOW, -1), addLocalDays(NOW, -2)];
    expect(computeStreak(days, NOW)).toBe(3);
  });

  it('still counts a streak that ends yesterday', () => {
    const days = [addLocalDays(NOW, -1), addLocalDays(NOW, -2)];
    expect(computeStreak(days, NOW)).toBe(2);
  });

  it('breaks when a day is missed', () => {
    const days = [NOW, addLocalDays(NOW, -2)];
    expect(computeStreak(days, NOW)).toBe(1);
  });

  it('counts a single review as a one day streak', () => {
    expect(computeStreak([NOW], NOW)).toBe(1);
  });
});

describe('manual schedule & recent change priority', () => {
  it('gives priority boost to manually rescheduled problems', () => {
    const today = startOfLocalDay(NOW);
    const regular = priorityScore({ dueAt: today }, null, NOW);
    const manual = priorityScore({ dueAt: today, manualSchedule: true }, null, NOW);
    expect(manual).toBeGreaterThan(regular);
  });

  it('sorts recently updated and manual problems higher in reminder queue', () => {
    const today = startOfLocalDay(NOW);
    const a = { slug: 'prob-a', dueAt: today, updatedAt: NOW - 10000 };
    const b = { slug: 'prob-b', dueAt: today, manualSchedule: true, updatedAt: NOW };
    const ordered = sortByPriority([a, b], NOW);
    expect(ordered[0]?.slug).toBe('prob-b');
  });
});
