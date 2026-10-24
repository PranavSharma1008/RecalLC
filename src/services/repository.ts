/**
 * Repository — every read and write of the durable RecallLC dataset.
 *
 * Runs exclusively inside the service worker (extension origin). The UI and
 * the content script reach it through the messaging layer.
 */

import type {
  AttemptSource,
  BackupFile,
  CatalogEntry,
  DashboardStats,
  Difficulty,
  Problem,
  ProblemWithSchedule,
  RecallRating,
  ReminderCandidate,
  ReviewEvent,
  ReviewEventSource,
  RevisionRecord,
  SubmissionAttempt,
  TopicStat,
} from '../types';
import { createId, attemptId } from '../utils/id';
import { normalizeSlug, problemUrl, titleFromSlug } from '../utils/slug';
import {
  isOverdue,
  isReminderEligible,
  computeStreak,
  createRevision,
  applyRating,
  applyDismiss,
  applySnooze,
  initialDueDate,
  sortByPriority,
  summarizeDue,
} from './revisionEngine';
import { getDb, type ImportBatch, type RecallDatabase } from './db';
import { readSettings } from './storage';
import { getPopularProblem } from '../data/popularProblems';
import { localDayDiff, startOfLocalDay } from '../utils/date';
import { sanitizeProblemNotes } from '../utils/notes';

/* ------------------------------------------------------------------ helpers */

function db(): RecallDatabase {
  return getDb();
}

export interface AttemptInput {
  slug: string;
  title?: string | null;
  attemptedAt: number;
  accepted?: boolean | null;
  language?: string | null;
  difficulty?: Difficulty | null;
  topics?: string[] | null;
  submissionId?: string | null;
  source: AttemptSource;
}

export interface ManualSaveInput {
  slug: string;
  title?: string | null;
  difficulty?: Difficulty | null;
  topics?: string[] | null;
  notes?: string | null;
  /** When set, an explicit attempt is recorded on this date. */
  attemptedAt?: number | null;
  accepted?: boolean | null;
  language?: string | null;
}

/**
 * How hard the user seems to have found this problem. Drives reminder
 * priority: problems the user struggled with surface earlier.
 */
export function computeStruggleScore(input: {
  attemptCount: number;
  accepted: boolean | null;
  lastRating: RecallRating | null;
}): number {
  let score = 0;
  if (input.attemptCount > 1) score += Math.min(0.45, (input.attemptCount - 1) * 0.12);
  if (input.accepted === false) score += 0.3;
  if (input.accepted === null && input.attemptCount > 0) score += 0.05;
  if (input.lastRating === 'forgot') score += 0.25;
  else if (input.lastRating === 'hard') score += 0.12;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

function emptyProblem(slug: string, now: number): Problem {
  const popular = getPopularProblem(slug);
  return {
    slug,
    title: popular?.title ?? titleFromSlug(slug),
    url: problemUrl(slug),
    difficulty: popular?.difficulty ?? 'Unknown',
    topics: popular?.topics ? [...popular.topics] : [],
    notes: '',
    firstAttemptAt: null,
    lastAttemptAt: null,
    lastViewedAt: null,
    attemptCount: 0,
    accepted: null,
    lastLanguage: null,
    struggleScore: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/* -------------------------------------------------------------------- reads */

export async function listProblems(): Promise<Problem[]> {
  const database = db();
  const raw = await database.problems.toArray();

  // Exclude and purge accidental ghost problems created just by viewing without ever pushing or writing notes
  const ghostSlugs: string[] = [];
  const problems = raw.filter((problem) => {
    const hasAttempt = problem.attemptCount > 0 || problem.lastAttemptAt !== null;
    const hasNotes = Boolean(problem.notes && problem.notes.trim().length > 0);
    if (!hasAttempt && !hasNotes) {
      ghostSlugs.push(problem.slug);
      return false;
    }
    return true;
  });

  if (ghostSlugs.length > 0) {
    void database
      .transaction('rw', [database.problems, database.revisions], async () => {
        for (const slug of ghostSlugs) {
          await database.problems.delete(slug);
          await database.revisions.delete(slug);
        }
      })
      .catch(() => undefined);
  }

  for (const problem of problems) {
    let changed = false;
    if (problem.difficulty === 'Unknown' || !problem.difficulty) {
      const popular = getPopularProblem(problem.slug);
      if (popular && popular.difficulty !== 'Unknown') {
        problem.difficulty = popular.difficulty;
        if (problem.topics.length === 0 && popular.topics.length > 0) {
          problem.topics = [...popular.topics];
        }
        changed = true;
      }
    }
    if (
      problem.notes &&
      (problem.notes.includes('Push to RecallLC') ||
        (problem.notes.match(/Solution Code/g)?.length ?? 0) > 1 ||
        (problem.notes.match(/## Recall checklist/g)?.length ?? 0) > 1)
    ) {
      problem.notes = sanitizeProblemNotes(problem.notes);
      changed = true;
    }
    if (changed) {
      await db().problems.put(problem);
    }
  }

  // Natural default order: newest attempt/problem first (new on top, old at bottom)
  problems.sort((a, b) => {
    const aTime = a.lastAttemptAt ?? a.createdAt ?? 0;
    const bTime = b.lastAttemptAt ?? b.createdAt ?? 0;
    return bTime - aTime;
  });

  return problems;
}

export async function getProblem(slug: string): Promise<Problem | undefined> {
  const problem = await db().problems.get(slug);
  if (problem) {
    let changed = false;
    if (problem.difficulty === 'Unknown' || !problem.difficulty) {
      const popular = getPopularProblem(problem.slug);
      if (popular && popular.difficulty !== 'Unknown') {
        problem.difficulty = popular.difficulty;
        if (problem.topics.length === 0 && popular.topics.length > 0) {
          problem.topics = [...popular.topics];
        }
        changed = true;
      }
    }
    if (
      problem.notes &&
      (problem.notes.includes('Push to RecallLC') ||
        (problem.notes.match(/Solution Code/g)?.length ?? 0) > 1 ||
        (problem.notes.match(/## Recall checklist/g)?.length ?? 0) > 1)
    ) {
      problem.notes = sanitizeProblemNotes(problem.notes);
      changed = true;
    }
    if (changed) {
      await db().problems.put(problem);
    }
  }
  return problem;
}

export async function listRevisions(): Promise<RevisionRecord[]> {
  return db().revisions.toArray();
}

export async function getRevision(slug: string): Promise<RevisionRecord | undefined> {
  return db().revisions.get(slug);
}

export async function listAttempts(slug?: string): Promise<SubmissionAttempt[]> {
  if (slug) return db().attempts.where('slug').equals(slug).toArray();
  return db().attempts.toArray();
}

export async function listEvents(limit?: number): Promise<ReviewEvent[]> {
  const events = await db().events.orderBy('reviewedAt').reverse().toArray();
  return typeof limit === 'number' ? events.slice(0, limit) : events;
}

export async function listImports(): Promise<ImportBatch[]> {
  return db().imports.orderBy('importedAt').reverse().toArray();
}

export async function listCatalog(): Promise<CatalogEntry[]> {
  return db().catalog.toArray();
}

/* ------------------------------------------------------------------ writes */

export async function computeInitialDue(anchor: number): Promise<number> {
  const settings = await readSettings();
  return settings.initialScheduleMode === 'weekly_sunday'
    ? initialDueDate(anchor, 'weekly_sunday')
    : initialDueDate(anchor, settings.initialIntervalDays);
}

export interface RecordAttemptResult {
  created: boolean;
  duplicate: boolean;
  problem: Problem;
  revision: RevisionRecord;
}

/**
 * Record an attempt. De-duplicates on the LeetCode submission id when one is
 * available, and otherwise on (slug, timestamp).
 */
export async function recordAttempt(input: AttemptInput, now: number = Date.now()): Promise<RecordAttemptResult> {
  const slug = normalizeSlug(input.slug);
  if (!slug) throw new Error(`Invalid problem slug: ${String(input.slug)}`);
  if (!Number.isFinite(input.attemptedAt)) throw new Error('Invalid attempt timestamp');

  const database = db();
  const submissionId = input.submissionId ? String(input.submissionId) : null;

  if (submissionId) {
    const existing = await database.attempts.where('submissionId').equals(submissionId).first();
    if (existing) {
      const problem = (await database.problems.get(slug)) ?? emptyProblem(slug, now);
      const revision =
        (await database.revisions.get(slug)) ??
        createRevision(slug, await computeInitialDue(problem.lastAttemptAt ?? now), now);
      return { created: false, duplicate: true, problem, revision };
    }
  }

  const id = attemptId(submissionId, slug, input.attemptedAt);
  const existingById = await database.attempts.get(id);
  if (existingById) {
    const problem = (await database.problems.get(slug)) ?? emptyProblem(slug, now);
    const revision =
      (await database.revisions.get(slug)) ??
      createRevision(slug, await computeInitialDue(problem.lastAttemptAt ?? now), now);
    return { created: false, duplicate: true, problem, revision };
  }

  const attempt: SubmissionAttempt = {
    id,
    slug,
    title: input.title ?? null,
    attemptedAt: input.attemptedAt,
    accepted: input.accepted ?? null,
    language: input.language ?? null,
    submissionId,
    source: input.source,
    createdAt: now,
  };

  const previous = await database.problems.get(slug);
  const catalogEntry = await database.catalog.get(slug);
  const problem: Problem = previous ?? emptyProblem(slug, now);

  const firstAttemptAt =
    problem.firstAttemptAt === null ? input.attemptedAt : Math.min(problem.firstAttemptAt, input.attemptedAt);
  const lastAttemptAt =
    problem.lastAttemptAt === null ? input.attemptedAt : Math.max(problem.lastAttemptAt, input.attemptedAt);

  problem.firstAttemptAt = firstAttemptAt;
  problem.lastAttemptAt = lastAttemptAt;
  problem.attemptCount = problem.attemptCount + 1;
  if (input.title) {
    problem.title = input.title;
  } else if (catalogEntry?.title && problem.title === titleFromSlug(slug)) {
    problem.title = catalogEntry.title;
  }
  if (input.language) problem.lastLanguage = input.language;
  if (input.accepted === true) problem.accepted = true;
  else if (input.accepted === false && problem.accepted === null) problem.accepted = false;

  if (input.difficulty && input.difficulty !== 'Unknown') {
    problem.difficulty = input.difficulty;
  } else if (problem.difficulty === 'Unknown' && catalogEntry?.difficulty && catalogEntry.difficulty !== 'Unknown') {
    problem.difficulty = catalogEntry.difficulty;
  } else if (problem.difficulty === 'Unknown') {
    const popular = getPopularProblem(slug);
    if (popular) {
      problem.difficulty = popular.difficulty;
      if (problem.topics.length === 0 && popular.topics.length > 0) {
        problem.topics = [...popular.topics];
      }
    }
  }

  if (input.topics && input.topics.length > 0) {
    problem.topics = [...new Set([...problem.topics, ...input.topics])];
  } else if (problem.topics.length === 0 && catalogEntry?.topics && catalogEntry.topics.length > 0) {
    problem.topics = [...catalogEntry.topics];
  }

  problem.updatedAt = now;

  const previousRevision = await database.revisions.get(slug);
  let revision: RevisionRecord;

  if (!previousRevision) {
    const initialDue = await computeInitialDue(lastAttemptAt);
    revision = createRevision(slug, initialDue, now);
  } else {
    // Preserve existing revision schedule so user's manual schedule / progress is preserved
    revision = previousRevision;
  }

  problem.struggleScore = computeStruggleScore({
    attemptCount: problem.attemptCount,
    accepted: problem.accepted,
    lastRating: revision.lastRating,
  });

  await database.transaction('rw', [database.problems, database.attempts, database.revisions], async () => {
    await database.attempts.put(attempt);
    await database.problems.put(problem);
    await database.revisions.put(revision);
  });

  return { created: true, duplicate: false, problem, revision };
}

/** Create or update a problem by hand (no attempt is implied). */
export async function saveProblem(input: ManualSaveInput, now: number = Date.now()): Promise<Problem> {
  const slug = normalizeSlug(input.slug);
  if (!slug) throw new Error(`Invalid problem slug: ${String(input.slug)}`);

  const database = db();
  const existing = await database.problems.get(slug);
  const problem: Problem = existing ?? emptyProblem(slug, now);

  if (input.title) problem.title = input.title;
  if (input.difficulty) problem.difficulty = input.difficulty;
  if (input.topics) problem.topics = [...new Set(input.topics.filter(Boolean))];
  if (typeof input.notes === 'string') problem.notes = input.notes;
  if (input.language) problem.lastLanguage = input.language;
  problem.updatedAt = now;

  await database.problems.put(problem);

  if (typeof input.attemptedAt === 'number' && Number.isFinite(input.attemptedAt)) {
    await recordAttempt(
      {
        slug,
        title: problem.title,
        attemptedAt: input.attemptedAt,
        accepted: input.accepted ?? null,
        language: input.language ?? null,
        source: 'manual',
      },
      now,
    );
  } else if (!(await database.revisions.get(slug))) {
    const anchor = problem.lastAttemptAt ?? now;
    const initialDue = await computeInitialDue(anchor);
    await database.revisions.put(createRevision(slug, initialDue, now));
  }

  return (await database.problems.get(slug)) ?? problem;
}

/** Update the user's personal notes. */
export async function updateNotes(slug: string, notes: string, now: number = Date.now()): Promise<Problem | null> {
  const problem = await db().problems.get(slug);
  if (!problem) return null;
  problem.notes = sanitizeProblemNotes(notes);
  problem.updatedAt = now;
  await db().problems.put(problem);
  return problem;
}

/** Rate the recall of a problem and reschedule it. */
export async function rateRecall(
  slug: string,
  rating: RecallRating,
  now: number = Date.now(),
): Promise<{ revision: RevisionRecord; event: ReviewEvent }> {
  const database = db();
  const settings = await readSettings();
  const existing = await database.revisions.get(slug);
  const problem = await database.problems.get(slug);

  const previousDueAt = existing?.dueAt ?? now;
  const base: RevisionRecord =
    existing ?? createRevision(slug, await computeInitialDue(problem?.lastAttemptAt ?? now), now);

  const revision = applyRating(base, rating, now, settings.intervals);

  const event: ReviewEvent = {
    id: createId('evt'),
    slug,
    rating,
    reviewedAt: now,
    previousDueAt,
    nextDueAt: revision.dueAt,
    elapsedDays: problem?.lastAttemptAt ? Math.max(0, localDayDiff(problem.lastAttemptAt, now)) : 0,
    source: 'review',
  };

  if (problem) {
    problem.struggleScore = computeStruggleScore({
      attemptCount: problem.attemptCount,
      accepted: problem.accepted,
      lastRating: rating,
    });
    problem.updatedAt = now;
  }

  await database.transaction('rw', [database.problems, database.revisions, database.events], async () => {
    if (problem) await database.problems.put(problem);
    await database.revisions.put(revision);
    await database.events.put(event);
  });

  return { revision, event };
}

async function logScheduleEvent(
  slug: string,
  source: ReviewEventSource,
  now: number,
): Promise<{ revision: RevisionRecord; event: ReviewEvent } | null> {
  const database = db();
  const existing = await database.revisions.get(slug);
  if (!existing) return null;

  const revision = source === 'snooze' ? applySnooze(existing, now) : applyDismiss(existing, now);
  const event: ReviewEvent = {
    id: createId('evt'),
    slug,
    rating: null,
    reviewedAt: now,
    previousDueAt: existing.dueAt,
    nextDueAt: revision.dueAt,
    elapsedDays: 0,
    source,
  };

  await database.transaction('rw', [database.revisions, database.events], async () => {
    await database.revisions.put(revision);
    await database.events.put(event);
  });

  return { revision, event };
}

/** "Remind tomorrow" — hides the problem until the next local midnight. */
export async function snooze(slug: string, now: number = Date.now()) {
  return logScheduleEvent(slug, 'snooze', now);
}

/** "Dismiss" — hides the problem for the rest of today. The schedule is untouched. */
export async function dismiss(slug: string, now: number = Date.now()) {
  return logScheduleEvent(slug, 'dismiss', now);
}

/** Manually reschedule an individual problem to a specific due date. */
export async function rescheduleProblem(
  slug: string,
  dueAt: number,
  now: number = Date.now(),
): Promise<{ revision: RevisionRecord; event: ReviewEvent } | null> {
  const database = db();
  const existing = await database.revisions.get(slug);
  const problem = await database.problems.get(slug);
  if (!existing && !problem) return null;

  const previousDueAt = existing?.dueAt ?? now;
  const base: RevisionRecord = existing ?? createRevision(slug, dueAt, now);
  const revision: RevisionRecord = {
    ...base,
    dueAt,
    manualSchedule: true,
    snoozedUntil: null,
    dismissedAt: null,
    updatedAt: now,
  };

  const event: ReviewEvent = {
    id: createId('evt'),
    slug,
    rating: null,
    reviewedAt: now,
    previousDueAt,
    nextDueAt: dueAt,
    elapsedDays: 0,
    source: 'manual',
  };

  if (problem) {
    problem.updatedAt = now;
  }

  await database.transaction('rw', [database.problems, database.revisions, database.events], async () => {
    if (problem) await database.problems.put(problem);
    await database.revisions.put(revision);
    await database.events.put(event);
  });

  return { revision, event };
}

/** Pause or resume reminders for a problem. */
export async function setPaused(
  slug: string,
  paused: boolean,
  now: number = Date.now(),
): Promise<RevisionRecord | null> {
  const database = db();
  const existing = await database.revisions.get(slug);
  if (!existing) return null;
  const revision: RevisionRecord = { ...existing, paused, updatedAt: now };
  await database.revisions.put(revision);
  return revision;
}

/** Record that the user merely opened a problem (never creates an untracked record). */
export async function markViewed(slug: string, now: number = Date.now()): Promise<void> {
  const database = db();
  const existing = await database.problems.get(slug);
  // Only update lastViewedAt if problem is already tracked; never create ghost problems
  if (existing) {
    existing.lastViewedAt = now;
    await database.problems.put(existing);
  }
}

/** Merge cached catalogue metadata into tracked problems. */
export async function mergeCatalog(entries: CatalogEntry[], now: number = Date.now()): Promise<number> {
  const database = db();
  let updated = 0;
  await database.transaction('rw', [database.problems, database.catalog], async () => {
    for (const entry of entries) {
      await database.catalog.put({ ...entry, updatedAt: now });
      const problem = await database.problems.get(entry.slug);
      if (!problem) continue;
      let changed = false;
      if (entry.title && entry.title !== problem.title) {
        problem.title = entry.title;
        changed = true;
      }
      if (entry.difficulty !== 'Unknown' && entry.difficulty !== problem.difficulty) {
        problem.difficulty = entry.difficulty;
        changed = true;
      }
      if (entry.topics.length > 0) {
        const merged = [...new Set([...problem.topics, ...entry.topics])];
        if (merged.length !== problem.topics.length) {
          problem.topics = merged;
          changed = true;
        }
      }
      if (changed) {
        problem.updatedAt = now;
        await database.problems.put(problem);
        updated++;
      }
    }
  });
  return updated;
}

/** Delete a problem and all of its attempts, schedule and history. */
export async function deleteProblem(slug: string): Promise<void> {
  const database = db();
  await database.transaction(
    'rw',
    [database.problems, database.attempts, database.revisions, database.events],
    async () => {
      await database.problems.delete(slug);
      await database.attempts.where('slug').equals(slug).delete();
      await database.revisions.delete(slug);
      await database.events.where('slug').equals(slug).delete();
    },
  );
}

/* ------------------------------------------------------------------ derived */

export interface DueEntry extends ProblemWithSchedule {
  problem: Problem;
  revision: RevisionRecord;
}

/** All problems that are currently eligible for a reminder, best first. */
export async function listDueProblems(now: number = Date.now()): Promise<ReminderCandidate[]> {
  const [problems, revisions] = await Promise.all([listProblems(), listRevisions()]);
  const problemBySlug = new Map(problems.map((p) => [p.slug, p]));

  const candidates: ReminderCandidate[] = [];
  for (const revision of revisions) {
    if (!isReminderEligible(revision, now)) continue;
    const problem = problemBySlug.get(revision.slug);
    if (!problem) continue;
    candidates.push({
      slug: problem.slug,
      title: problem.title,
      url: problem.url,
      difficulty: problem.difficulty,
      topics: problem.topics,
      attemptCount: problem.attemptCount,
      lastAttemptAt: problem.lastAttemptAt,
      dueAt: revision.dueAt,
      overdue: isOverdue(revision.dueAt, now),
      overdueDays: isOverdue(revision.dueAt, now) ? Math.abs(localDayDiff(revision.dueAt, now)) : 0,
      accepted: problem.accepted,
      language: problem.lastLanguage,
      manualSchedule: revision.manualSchedule,
      updatedAt: revision.updatedAt,
    });
  }

  const ordered = sortByPriority(
    candidates.map((candidate) => ({
      ...candidate,
      struggleScore: problemBySlug.get(candidate.slug)?.struggleScore ?? 0,
    })),
    now,
  );

  return ordered.map(({ struggleScore: _struggleScore, ...candidate }) => candidate);
}

/**
 * Update unreviewed problems that have not been manually rescheduled to match updated settings.
 * Problems that were manually rescheduled by the user preserve their manual schedule (priority).
 */
export async function syncUnscheduledWithSettings(now: number = Date.now()): Promise<number> {
  const settings = await readSettings();
  const database = db();
  const [revisions, problems, events] = await Promise.all([
    database.revisions.toArray(),
    database.problems.toArray(),
    database.events.filter((e) => e.source === 'manual').toArray(),
  ]);
  const manualSlugs = new Set(events.map((e) => e.slug));
  const problemBySlug = new Map(problems.map((p) => [p.slug, p]));
  let updatedCount = 0;

  await database.transaction('rw', database.revisions, async () => {
    for (const revision of revisions) {
      // If user specifically changed or reviewed this problem, preserve it with priority!
      if (
        revision.manualSchedule ||
        manualSlugs.has(revision.slug) ||
        revision.stage > 0 ||
        revision.lastReviewedAt !== null
      ) {
        continue;
      }
      const problem = problemBySlug.get(revision.slug);
      const anchor = problem?.lastAttemptAt ?? revision.createdAt;
      const newDue =
        settings.initialScheduleMode === 'weekly_sunday'
          ? initialDueDate(anchor, 'weekly_sunday')
          : initialDueDate(anchor, settings.initialIntervalDays);
      if (newDue !== revision.dueAt) {
        revision.dueAt = newDue;
        revision.updatedAt = now;
        await database.revisions.put(revision);
        updatedCount++;
      }
    }
  });

  return updatedCount;
}

/** Every tracked problem joined with its schedule. */
export async function listProblemSchedule(now: number = Date.now()): Promise<ProblemWithSchedule[]> {
  const [problems, revisions] = await Promise.all([listProblems(), listRevisions()]);

  const revisionBySlug = new Map(revisions.map((r) => [r.slug, r]));
  return problems.map((problem) => {
    const revision = revisionBySlug.get(problem.slug) ?? null;
    const dueAt = revision?.dueAt ?? null;
    return {
      problem,
      revision,
      dueAt,
      overdue: dueAt !== null && isOverdue(dueAt, now),
      daysUntilDue: dueAt !== null ? localDayDiff(now, dueAt) : null,
    };
  });
}

/** Dashboard statistics, computed from the real stored data. */
export async function getStats(now: number = Date.now()): Promise<DashboardStats> {
  const [problems, revisions, attempts, events] = await Promise.all([
    listProblems(),
    listRevisions(),
    listAttempts(),
    listEvents(),
  ]);

  const summary = summarizeDue(revisions, now);
  const problemBySlug = new Map(problems.map((p) => [p.slug, p]));

  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const revisedThisWeek = events.filter((event) => event.source === 'review' && event.reviewedAt >= weekAgo).length;

  const reviewDays = events.filter((event) => event.source === 'review').map((event) => event.reviewedAt);
  const streak = computeStreak(reviewDays, now);

  const topicMap = new Map<string, TopicStat>();
  for (const problem of problems) {
    const topics = problem.topics.length > 0 ? problem.topics : ['Uncategorised'];
    for (const topic of topics) {
      const stat = topicMap.get(topic) ?? { topic, count: 0, due: 0 };
      stat.count += 1;
      const revision = revisions.find((r) => r.slug === problem.slug);
      if (revision && isReminderEligible(revision, now)) stat.due += 1;
      topicMap.set(topic, stat);
    }
  }

  const byTopic = [...topicMap.values()].sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));

  // Problems with no schedule at all (e.g. imported metadata only).
  const scheduled = new Set(revisions.map((r) => r.slug));
  for (const problem of problems) {
    if (scheduled.has(problem.slug)) continue;
    const stat = topicMap.get('Uncategorised');
    if (stat) stat.count += 0;
  }

  return {
    dueToday: summary.dueToday,
    overdue: summary.overdue,
    totalProblems: problemBySlug.size,
    totalAttempts: attempts.length,
    revisedThisWeek,
    streak,
    byTopic,
    totalReviews: events.filter((event) => event.source === 'review').length,
  };
}

/** Local-day helper re-exported for the dashboard's "due today" grouping. */
export { startOfLocalDay };

/* -------------------------------------------------------------- backup/restore */

export async function exportBackup(now: number = Date.now()): Promise<BackupFile> {
  const [settings, rawProblems, attempts, revisions, events] = await Promise.all([
    readSettings(),
    listProblems(),
    listAttempts(),
    listRevisions(),
    listEvents(),
  ]);

  const problems = rawProblems.map((problem) => {
    let difficulty = problem.difficulty;
    let topics = problem.topics ?? [];
    if (difficulty === 'Unknown' || !difficulty) {
      const pop = getPopularProblem(problem.slug);
      if (pop) {
        difficulty = pop.difficulty;
        if (topics.length === 0 && pop.topics.length > 0) topics = [...pop.topics];
      }
    }
    return {
      ...problem,
      difficulty: difficulty ?? 'Easy',
      topics,
      notes: sanitizeProblemNotes(problem.notes ?? ''),
    };
  });

  return {
    format: 'recalllc-backup',
    version: 1,
    exportedAt: now,
    settings,
    problems,
    attempts,
    revisions,
    events,
  };
}

function isPlainObject(item: unknown): item is Record<string, unknown> {
  return typeof item === 'object' && item !== null && !Array.isArray(item);
}

function sanitizeRecord(raw: unknown): Record<string, unknown> | null {
  if (!isPlainObject(raw)) return null;
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = val;
  }
  return clean;
}

export async function restoreBackup(backup: BackupFile): Promise<{ problems: number; attempts: number }> {
  if (!backup || backup.format !== 'recalllc-backup') {
    throw new Error('This file is not a RecallLC backup.');
  }
  const database = db();
  const rawProblems = Array.isArray(backup.problems) ? backup.problems : [];
  const cleanedProblems: Problem[] = [];

  for (const raw of rawProblems) {
    const item = sanitizeRecord(raw) as Partial<Problem> | null;
    if (!item || typeof item.slug !== 'string' || !item.slug.trim()) continue;

    let diff = item.difficulty;
    let topics = Array.isArray(item.topics) ? item.topics.filter((t) => typeof t === 'string') : [];
    if (diff === 'Unknown' || !diff) {
      const pop = getPopularProblem(item.slug);
      if (pop) {
        diff = pop.difficulty;
        if (topics.length === 0 && pop.topics.length > 0) topics = [...pop.topics];
      }
    }

    cleanedProblems.push({
      slug: item.slug.trim(),
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : titleFromSlug(item.slug),
      url: problemUrl(item.slug),
      difficulty: diff ?? 'Easy',
      topics,
      notes: sanitizeProblemNotes(typeof item.notes === 'string' ? item.notes : ''),
      firstAttemptAt:
        typeof item.firstAttemptAt === 'number' && Number.isFinite(item.firstAttemptAt)
          ? item.firstAttemptAt
          : Date.now(),
      lastAttemptAt:
        typeof item.lastAttemptAt === 'number' && Number.isFinite(item.lastAttemptAt) ? item.lastAttemptAt : Date.now(),
      lastViewedAt:
        typeof item.lastViewedAt === 'number' && Number.isFinite(item.lastViewedAt) ? item.lastViewedAt : null,
      attemptCount:
        typeof item.attemptCount === 'number' && Number.isFinite(item.attemptCount)
          ? Math.max(0, item.attemptCount)
          : 1,
      accepted: typeof item.accepted === 'boolean' ? item.accepted : null,
      lastLanguage: typeof item.lastLanguage === 'string' ? item.lastLanguage : null,
      struggleScore:
        typeof item.struggleScore === 'number' && Number.isFinite(item.struggleScore)
          ? Math.max(0, item.struggleScore)
          : 0,
      createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
    });
  }

  // Validate and sanitize attempts
  const cleanedAttempts: SubmissionAttempt[] = [];
  if (Array.isArray(backup.attempts)) {
    for (const raw of backup.attempts) {
      const item = sanitizeRecord(raw) as Partial<SubmissionAttempt> | null;
      if (!item || typeof item.id !== 'string' || typeof item.slug !== 'string') continue;
      if (typeof item.attemptedAt !== 'number' || !Number.isFinite(item.attemptedAt)) continue;
      cleanedAttempts.push({
        id: item.id,
        slug: item.slug,
        title: typeof item.title === 'string' ? item.title : null,
        attemptedAt: item.attemptedAt,
        accepted: typeof item.accepted === 'boolean' ? item.accepted : null,
        language: typeof item.language === 'string' ? item.language : null,
        submissionId: typeof item.submissionId === 'string' ? item.submissionId : null,
        source: item.source === 'auto' || item.source === 'manual' ? item.source : 'import',
        createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
      });
    }
  }

  // Validate and sanitize revisions
  const cleanedRevisions: RevisionRecord[] = [];
  if (Array.isArray(backup.revisions)) {
    for (const raw of backup.revisions) {
      const item = sanitizeRecord(raw) as Partial<RevisionRecord> | null;
      if (!item || typeof item.slug !== 'string') continue;
      if (typeof item.dueAt !== 'number' || !Number.isFinite(item.dueAt)) continue;
      cleanedRevisions.push({
        slug: item.slug,
        stage: typeof item.stage === 'number' && Number.isFinite(item.stage) ? Math.max(0, Math.floor(item.stage)) : 0,
        lastRating:
          item.lastRating === 'forgot' ||
          item.lastRating === 'hard' ||
          item.lastRating === 'good' ||
          item.lastRating === 'easy'
            ? item.lastRating
            : null,
        lastReviewedAt:
          typeof item.lastReviewedAt === 'number' && Number.isFinite(item.lastReviewedAt) ? item.lastReviewedAt : null,
        dueAt: item.dueAt,
        snoozedUntil:
          typeof item.snoozedUntil === 'number' && Number.isFinite(item.snoozedUntil) ? item.snoozedUntil : null,
        dismissedAt:
          typeof item.dismissedAt === 'number' && Number.isFinite(item.dismissedAt) ? item.dismissedAt : null,
        paused: Boolean(item.paused),
        createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
        updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
      });
    }
  }

  // Deduplicate consecutive identical events if any and sanitize
  const seenEvents = new Set<string>();
  const cleanedEvents: ReviewEvent[] = [];
  if (Array.isArray(backup.events)) {
    for (const raw of backup.events) {
      const item = sanitizeRecord(raw) as Partial<ReviewEvent> | null;
      if (!item || typeof item.id !== 'string' || typeof item.slug !== 'string') continue;
      if (typeof item.reviewedAt !== 'number' || !Number.isFinite(item.reviewedAt)) continue;
      const key = `${item.slug}_${item.reviewedAt}_${item.nextDueAt}`;
      if (seenEvents.has(key)) continue;
      seenEvents.add(key);

      cleanedEvents.push({
        id: item.id,
        slug: item.slug,
        rating:
          item.rating === 'forgot' || item.rating === 'hard' || item.rating === 'good' || item.rating === 'easy'
            ? item.rating
            : null,
        reviewedAt: item.reviewedAt,
        previousDueAt:
          typeof item.previousDueAt === 'number' && Number.isFinite(item.previousDueAt) ? item.previousDueAt : 0,
        nextDueAt: typeof item.nextDueAt === 'number' && Number.isFinite(item.nextDueAt) ? item.nextDueAt : 0,
        elapsedDays: typeof item.elapsedDays === 'number' && Number.isFinite(item.elapsedDays) ? item.elapsedDays : 0,
        source: item.source ?? 'review',
      });
    }
  }

  await database.transaction(
    'rw',
    [database.problems, database.attempts, database.revisions, database.events],
    async () => {
      await database.problems.clear();
      await database.attempts.clear();
      await database.revisions.clear();
      await database.events.clear();
      if (cleanedProblems.length > 0) await database.problems.bulkPut(cleanedProblems);
      if (cleanedAttempts.length > 0) await database.attempts.bulkPut(cleanedAttempts);
      if (cleanedRevisions.length > 0) await database.revisions.bulkPut(cleanedRevisions);
      if (cleanedEvents.length > 0) await database.events.bulkPut(cleanedEvents);
    },
  );
  return {
    problems: cleanedProblems.length,
    attempts: cleanedAttempts.length,
  };
}

/** Wipe every trace of user data. */
export async function clearAll(): Promise<void> {
  const database = db();
  await database.transaction(
    'rw',
    [database.problems, database.attempts, database.revisions, database.events, database.imports, database.catalog],
    async () => {
      await database.problems.clear();
      await database.attempts.clear();
      await database.revisions.clear();
      await database.events.clear();
      await database.imports.clear();
      await database.catalog.clear();
    },
  );
}

/** Remember that an import ran, so the dashboard can show import history. */
export async function recordImport(batch: ImportBatch): Promise<void> {
  await db().imports.put(batch);
}
