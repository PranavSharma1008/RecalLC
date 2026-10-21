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
  updateNotes,
  mergeCatalog,
} from '../../services/repository';
import { addLocalDays, startOfLocalDay } from '../../utils/date';
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

    // Default initial interval is one day, so it is already overdue.
    expect(result.revision.dueAt).toBe(addLocalDays(threeDaysAgo, 1));
    expect(result.revision.lastReviewedAt).toBeNull();
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
    expect(revision?.dueAt).toBe(addLocalDays(addLocalDays(NOW, -3), 1));
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
    await markViewed('two-sum', NOW);
    const problem = await getProblem('two-sum');
    expect(problem?.lastViewedAt).toBe(NOW);
    expect(problem?.attemptCount).toBe(0);
    expect(await listAttempts()).toHaveLength(0);
  });
});

describe('due list and statistics', () => {
  it('orders due problems with overdue first', async () => {
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
