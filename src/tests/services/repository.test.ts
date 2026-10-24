import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '../../services/db';
import {
  clearAll,
  deleteProblem,
  exportBackup,
  getProblem,
  getRevision,
  getStats,
  listAttempts,
  listDueProblems,
  listProblems,
  listProblemSchedule,
  listRevisions,
  markViewed,
  rateRecall,
  recordAttempt,
  restoreBackup,
  saveProblem,
  setPaused,
  snooze,
  dismiss,
  rescheduleProblem,
  syncUnscheduledWithSettings,
  updateNotes,
  mergeCatalog,
} from '../../services/repository';
import { addLocalDays, getNextSunday, startOfLocalDay } from '../../utils/date';
import { writeSettings } from '../../services/storage';
import { resetChromeStorage } from '../setup';

const NOW = new Date(2026, 9, 21, 14, 30, 0, 0).getTime();

async function resetDatabase(): Promise<void> {
  const database = getDb();
  await database.delete();
  await closeDb();
  await resetChromeStorage();
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

describe('recording attempts', () => {
  it('creates a problem and schedules the first review', async () => {
    const threeDaysAgo = addLocalDays(NOW, -3);
    const result = await recordAttempt(
      { slug: 'two-sum', attemptedAt: threeDaysAgo, accepted: true, source: 'auto' },
      NOW,
    );

    expect(result.created).toBe(true);
    expect(result.problem.slug).toBe('two-sum');
    expect(result.problem.attemptCount).toBe(1);
    expect(result.problem.accepted).toBe(true);
    expect(result.problem.firstAttemptAt).toBe(threeDaysAgo);
    expect(result.problem.lastAttemptAt).toBe(threeDaysAgo);

    // Default initial schedule is weekly Sunday revision
    expect(result.revision.dueAt).toBe(getNextSunday(threeDaysAgo));
    expect(result.revision.lastReviewedAt).toBeNull();
  });

  it('schedules problems for weekly Sunday revision by default (Mon-Sat -> Sunday)', async () => {
    // Oct 19, 2026 is Monday
    const monday = new Date(2026, 9, 19, 10, 0, 0).getTime();
    const result = await recordAttempt({ slug: 'two-sum', attemptedAt: monday, source: 'auto' }, monday);
    // Next Sunday is Oct 25, 2026
    const sunday = new Date(2026, 9, 25, 0, 0, 0).getTime();
    expect(result.revision.dueAt).toBe(sunday);
  });

  it('enriches a problem with difficulty and topics from the catalog when available', async () => {
    await mergeCatalog([
      {
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        topics: ['Array', 'Hash Table'],
        paidOnly: false,
        updatedAt: NOW,
      },
    ]);

    await recordAttempt({ slug: 'two-sum', attemptedAt: NOW, accepted: true, source: 'auto' }, NOW);
    const problem = await getProblem('two-sum');
    expect(problem?.difficulty).toBe('Easy');
    expect(problem?.topics).toEqual(['Array', 'Hash Table']);
  });

  it('automatically sets Two Sum and popular problems to their true difficulty without catalog', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: NOW, accepted: true, source: 'auto' }, NOW);
    const problem = await getProblem('two-sum');
    expect(problem?.difficulty).toBe('Easy');
    expect(problem?.topics).toContain('Array');
  });

  it('merges attempts for the same problem', async () => {
    const first = addLocalDays(NOW, -10);
    const second = addLocalDays(NOW, -2);

    await recordAttempt({ slug: 'coin-change', attemptedAt: first, accepted: false, source: 'auto' }, NOW);
    await recordAttempt({ slug: 'coin-change', attemptedAt: second, accepted: true, source: 'auto' }, NOW);

    const problems = await listProblems();
    expect(problems).toHaveLength(1);
    const problem = problems[0]!;
    expect(problem.attemptCount).toBe(2);
    expect(problem.firstAttemptAt).toBe(first);
    expect(problem.lastAttemptAt).toBe(second);
    expect(problem.accepted).toBe(true);

    const attempts = await listAttempts('coin-change');
    expect(attempts).toHaveLength(2);
  });

  it('de-duplicates by submission id', async () => {
    const attempt = {
      slug: 'two-sum',
      attemptedAt: addLocalDays(NOW, -4),
      submissionId: 'sid-1',
      source: 'auto' as const,
    };

    const first = await recordAttempt(attempt, NOW);
    const second = await recordAttempt(attempt, NOW);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await listAttempts()).toHaveLength(1);
  });

  it('de-duplicates by slug and timestamp when no submission id exists', async () => {
    const attempt = { slug: 'two-sum', attemptedAt: addLocalDays(NOW, -4), source: 'auto' as const };
    await recordAttempt(attempt, NOW);
    const second = await recordAttempt(attempt, NOW);
    expect(second.duplicate).toBe(true);
    expect(await listAttempts()).toHaveLength(1);
  });

  it('does not reschedule a problem that has already been reviewed', async () => {
    const attemptedAt = addLocalDays(NOW, -10);
    await recordAttempt({ slug: 'two-sum', attemptedAt, accepted: true, source: 'auto' }, NOW);
    await rateRecall('two-sum', 'good', addLocalDays(NOW, -2));

    const revisionBefore = await getRevision('two-sum');
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -1), accepted: true, source: 'auto' }, NOW);
    const revisionAfter = await getRevision('two-sum');

    expect(revisionAfter?.dueAt).toBe(revisionBefore?.dueAt);
  });
});

describe('manual saving', () => {
  it('creates a tracked problem without inventing an attempt', async () => {
    const problem = await saveProblem({ slug: 'climbing-stairs', title: 'Climbing Stairs' }, NOW);
    expect(problem.slug).toBe('climbing-stairs');
    expect(problem.attemptCount).toBe(0);
    expect(await listAttempts()).toHaveLength(0);
  });

  it('records an attempt when a date is supplied', async () => {
    const attemptedAt = addLocalDays(NOW, -5);
    await saveProblem({ slug: 'climbing-stairs', attemptedAt, accepted: true }, NOW);
    expect(await listAttempts()).toHaveLength(1);
    const problem = await getProblem('climbing-stairs');
    expect(problem?.attemptCount).toBe(1);
  });

  it('rejects an invalid slug', async () => {
    await expect(saveProblem({ slug: '!!!' }, NOW)).rejects.toThrow(/slug/i);
  });
});

describe('reviewing', () => {
  it('reschedules the problem and keeps a review event', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    const { revision } = await rateRecall('two-sum', 'good', NOW);

    expect(revision.lastRating).toBe('good');
    expect(revision.dueAt).toBe(addLocalDays(NOW, 5));
    expect(revision.stage).toBe(1);
  });

  it('keeps notes separate from the schedule', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    const problem = await updateNotes('two-sum', 'Use a hash map.', NOW);
    expect(problem?.notes).toBe('Use a hash map.');

    const revision = await getRevision('two-sum');
    expect(revision?.dueAt).toBe(getNextSunday(addLocalDays(NOW, -3)));
  });

  it('does not change the schedule when a problem is snoozed', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    const before = (await getRevision('two-sum'))!.dueAt;

    const outcome = await snooze('two-sum', NOW);
    expect(outcome?.revision.dueAt).toBe(before);
    expect(outcome?.revision.snoozedUntil).toBe(startOfLocalDay(addLocalDays(NOW, 1)));
  });

  it('does not change the schedule when a problem is dismissed', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    const before = (await getRevision('two-sum'))!.dueAt;

    const outcome = await dismiss('two-sum', NOW);
    expect(outcome?.revision.dueAt).toBe(before);
    expect(outcome?.revision.dismissedAt).toBe(NOW);
  });

  it('reschedules an individual problem to a custom due date', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    const customDue = addLocalDays(NOW, 4);
    const outcome = await rescheduleProblem('two-sum', customDue, NOW);
    expect(outcome?.revision.dueAt).toBe(customDue);

    const revision = await getRevision('two-sum');
    expect(revision?.dueAt).toBe(customDue);
  });

  it('pauses and resumes a problem', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    const paused = await setPaused('two-sum', true, NOW);
    expect(paused?.paused).toBe(true);
    const resumed = await setPaused('two-sum', false, NOW);
    expect(resumed?.paused).toBe(false);
  });

  it('records a page view without creating an attempt', async () => {
    await saveProblem({ slug: 'two-sum', title: 'Two Sum' }, NOW);
    await markViewed('two-sum', NOW);
    const problem = await getProblem('two-sum');
    expect(problem?.lastViewedAt).toBe(NOW);
    expect(problem?.attemptCount).toBe(0);
    expect(await listAttempts()).toHaveLength(0);
  });
});

describe('due list and statistics', () => {
  it('orders due problems with overdue first', async () => {
    await writeSettings({ initialScheduleMode: 'fixed_days', initialIntervalDays: 1 });
    await recordAttempt({ slug: 'due-today', attemptedAt: addLocalDays(NOW, -1), source: 'auto' }, NOW);
    await recordAttempt({ slug: 'overdue', attemptedAt: addLocalDays(NOW, -6), source: 'auto' }, NOW);
    await recordAttempt({ slug: 'future', attemptedAt: addLocalDays(NOW, 10), source: 'auto' }, NOW);

    const due = await listDueProblems(NOW);
    expect(due.map((entry) => entry.slug)).toEqual(['overdue', 'due-today']);
    expect(due[0]?.overdue).toBe(true);
    expect(due[0]?.overdueDays).toBe(5);
  });

  it('computes statistics from the stored data', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    await rateRecall('two-sum', 'good', addLocalDays(NOW, -1));

    const stats = await getStats(NOW);
    expect(stats.totalProblems).toBe(1);
    expect(stats.totalAttempts).toBe(1);
    expect(stats.totalReviews).toBe(1);
    expect(stats.revisedThisWeek).toBe(1);
    expect(stats.streak).toBe(1);
  });
});

describe('persistence', () => {
  it('keeps data after the database is closed and reopened', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);

    // Simulate the browser closing: drop the handle and reopen the database.
    await closeDb();
    await getDb().open();

    const problems = await listProblems();
    expect(problems).toHaveLength(1);
    expect(problems[0]?.slug).toBe('two-sum');
    expect(await listRevisions()).toHaveLength(1);
  });

  it('exports and restores a backup', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    await updateNotes('two-sum', 'hash map', NOW);

    const backup = await exportBackup(NOW);
    expect(backup.format).toBe('recalllc-backup');
    expect(backup.problems).toHaveLength(1);

    await clearAll();
    expect(await listProblems()).toHaveLength(0);

    const restored = await restoreBackup(backup);
    expect(restored.problems).toBe(1);
    expect((await getProblem('two-sum'))?.notes).toBe('hash map');
    expect(await listAttempts()).toHaveLength(1);
  });

  it('restores messy backup and automatically cleans duplicate code, fixes Unknown difficulty and empty topics', async () => {
    const messyBackup = {
      format: 'recalllc-backup' as const,
      version: 1 as const,
      exportedAt: NOW,
      settings: {
        schemaVersion: 1,
        theme: 'system' as const,
        intervals: { forgot: 1, hard: 2, good: 5, easy: 14 },
        initialScheduleMode: 'fixed_days' as const,
        initialIntervalDays: 6,
        remindersEnabled: true,
        reminderDelayMs: 0,
        maxRemindersPerSession: 0,
        autoTrackSubmissions: true,
        accountSyncEnabled: false,
        accountSyncLimit: 201,
        showTopicInReminder: true,
        onboardingCompleted: false,
      },
      problems: [
        {
          slug: 'two-sum',
          title: 'Two Sum',
          url: 'https://leetcode.com/problems/two-sum/',
          difficulty: 'Unknown' as const,
          topics: [],
          notes: `Solution Code (Java):\n\`\`\`Java\nclass \nPush to RecallLC 🚀\n🚀\nSolution {\n    public int[] twoSum() {}\n}\n\`\`\`\n\nSolution Code (Java):\n\`\`\`Java\nclass Solution {\n    public int[] twoSum() {}\n}\n\`\`\`\n\n## Recall checklist\n- Q1\n\n## Recall checklist\n- Q1`,
          firstAttemptAt: NOW,
          lastAttemptAt: NOW,
          lastViewedAt: NOW,
          attemptCount: 2,
          accepted: true,
          lastLanguage: 'Java',
          struggleScore: 0.5,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      attempts: [],
      revisions: [
        {
          slug: 'two-sum',
          stage: 0,
          lastRating: null,
          lastReviewedAt: null,
          dueAt: addLocalDays(NOW, 6),
          snoozedUntil: null,
          dismissedAt: null,
          paused: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      events: [],
    };

    await clearAll();
    await restoreBackup(messyBackup);

    const restoredProblem = await getProblem('two-sum');
    expect(restoredProblem).toBeDefined();
    expect(restoredProblem?.difficulty).toBe('Easy');
    expect(restoredProblem?.topics).toContain('Array');
    expect(restoredProblem?.notes.match(/Solution Code/g)?.length).toBe(1);
    expect(restoredProblem?.notes.match(/## Recall checklist/g)?.length).toBe(1);
    expect(restoredProblem?.notes).not.toContain('Push to RecallLC');
    expect(restoredProblem?.notes).toContain('class Solution');
  });

  it('preserves a custom rescheduled due date when new attempts are recorded or schedule is listed', async () => {
    await clearAll();
    await writeSettings({ initialScheduleMode: 'fixed_days', initialIntervalDays: 6 });

    // Solve Two Sum initially -> scheduled 6 days later
    await recordAttempt({ slug: 'two-sum', attemptedAt: NOW, source: 'auto' }, NOW);
    const schedule1 = await listProblemSchedule(NOW);
    expect(schedule1[0]?.daysUntilDue).toBe(6);

    // Manually reschedule Two Sum to 2 days
    const customDue = addLocalDays(NOW, 2);
    await rescheduleProblem('two-sum', customDue, NOW);

    const schedule2 = await listProblemSchedule(NOW);
    expect(schedule2[0]?.daysUntilDue).toBe(2);

    // Re-attempting or pushing an update to Two Sum preserves the custom 2-day schedule
    await recordAttempt({ slug: 'two-sum', attemptedAt: NOW + 1000, source: 'manual' }, NOW + 1000);
    const schedule3 = await listProblemSchedule(NOW);
    expect(schedule3[0]?.daysUntilDue).toBe(2);

    // A brand new problem gets the default 6 days
    await recordAttempt({ slug: 'add-two-numbers', attemptedAt: NOW, source: 'auto' }, NOW);
    const schedule4 = await listProblemSchedule(NOW);
    const addTwo = schedule4.find((s) => s.problem.slug === 'add-two-numbers');
    expect(addTwo?.daysUntilDue).toBe(6);
  });

  it('reschedules a problem to today (0 days) and makes it immediately due in reminders', async () => {
    // Problem solved 24 hours ago
    const yesterday = addLocalDays(NOW, -1);
    await recordAttempt({ slug: 'two-sum', attemptedAt: yesterday, source: 'manual' }, yesterday);

    // Reschedule to today (0 days from NOW)
    const todayDue = addLocalDays(NOW, 0);
    await rescheduleProblem('two-sum', todayDue, NOW);

    const schedule = await listProblemSchedule(NOW);
    const twoSum = schedule.find((s) => s.problem.slug === 'two-sum');
    expect(twoSum?.daysUntilDue).toBe(0);

    // Must be in due list for reminders!
    const dueList = await listDueProblems(NOW);
    expect(dueList.map((d) => d.slug)).toContain('two-sum');
  });

  it('syncUnscheduledWithSettings updates default unreviewed problems while giving priority to manually rescheduled problem', async () => {
    // Two Sum is manually rescheduled to 1 day
    await recordAttempt({ slug: 'two-sum', attemptedAt: NOW, source: 'manual' }, NOW);
    const oneDayDue = addLocalDays(NOW, 1);
    await rescheduleProblem('two-sum', oneDayDue, NOW);

    // Another problem was automatically tracked with no manual reschedule
    await recordAttempt({ slug: 'valid-anagram', attemptedAt: NOW, source: 'auto' }, NOW);

    // Global settings change: every problem come in reminder in 6 days
    await writeSettings({ initialScheduleMode: 'fixed_days', initialIntervalDays: 6 });
    await syncUnscheduledWithSettings(NOW);

    const schedule = await listProblemSchedule(NOW);
    const twoSum = schedule.find((s) => s.problem.slug === 'two-sum');
    const anagram = schedule.find((s) => s.problem.slug === 'valid-anagram');

    // Two Sum preserves its manually prioritized 1-day schedule!
    expect(twoSum?.daysUntilDue).toBe(1);
    // Unscheduled problem follows the new 6-day setting
    expect(anagram?.daysUntilDue).toBe(6);
  });

  it('refuses to restore something that is not a backup', async () => {
    await expect(
      restoreBackup({ format: 'something-else' } as unknown as Parameters<typeof restoreBackup>[0]),
    ).rejects.toThrow(/not a RecallLC backup/i);
  });

  it('deletes a problem together with its attempts and history', async () => {
    await recordAttempt({ slug: 'two-sum', attemptedAt: addLocalDays(NOW, -3), source: 'auto' }, NOW);
    await rateRecall('two-sum', 'good', NOW);

    await deleteProblem('two-sum');
    expect(await listProblems()).toHaveLength(0);
    expect(await listAttempts()).toHaveLength(0);
    expect(await listRevisions()).toHaveLength(0);
  });
});
