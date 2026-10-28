import { useEffect, useMemo, useState } from 'react';

import { RevisionCard } from '../../components/RevisionCard';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import { getPopularProblem } from '../../data/popularProblems';
import { DIFFICULTIES, type Difficulty, type ProblemSortKey, type ProblemWithSchedule } from '../../types';
import { addLocalDays } from '../../utils/date';
import { isGfgSlug } from '../../utils/slug';

export interface ProblemsScreenProps {
  navigate: (path: string) => void;
  onChanged: () => void;
}

const DIFFICULTY_ORDER: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3, Unknown: 4 };

function getEffectiveDifficulty(problem: { slug: string; difficulty: Difficulty }): Difficulty {
  if (problem.difficulty && problem.difficulty !== 'Unknown') return problem.difficulty;
  const popular = getPopularProblem(problem.slug);
  return popular?.difficulty ?? 'Unknown';
}

export function ProblemsScreen({ navigate, onChanged }: ProblemsScreenProps) {
  const schedule = useAsync(() => callService('list-problems'), []);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [attemptedWithin, setAttemptedWithin] = useState<string>('all');
  const [customAttemptDays, setCustomAttemptDays] = useState<number>(3);
  const [sort, setSort] = useState<ProblemSortKey>('lastAttempt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [customRescheduleDays, setCustomRescheduleDays] = useState<number>(3);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => {
      setSuccessToast(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [successToast]);

  const entries = schedule.data ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = entries.filter((entry) => {
      const { problem } = entry;
      const probDifficulty = getEffectiveDifficulty(problem);
      if (needle) {
        const probTopics = problem.topics.length > 0 ? problem.topics : (getPopularProblem(problem.slug)?.topics ?? []);
        const isGfg = Boolean(problem.url?.includes('geeksforgeeks.org') || isGfgSlug(problem.slug));
        const platformText = isGfg ? 'gfg geeksforgeeks' : 'leetcode lc';
        const haystack =
          `${problem.title} ${problem.slug} ${probTopics.join(' ')} ${probDifficulty} ${platformText}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      const problemTopics =
        problem.topics.length > 0 ? problem.topics : (getPopularProblem(problem.slug)?.topics ?? []);
      if (topic && !problemTopics.includes(topic)) return false;
      if (difficulty && probDifficulty !== difficulty) return false;
      if (attemptedWithin !== 'all') {
        const days = attemptedWithin === 'custom' ? customAttemptDays : Number(attemptedWithin);
        const attemptTime = problem.lastAttemptAt
          ? problem.lastAttemptAt < 1e11
            ? problem.lastAttemptAt * 1000
            : problem.lastAttemptAt
          : null;
        if (!attemptTime) return false;
        const cutoff = Date.now() - Math.max(0.1, days) * 86400000;
        if (attemptTime < cutoff) return false;
      }
      return true;
    });

    const factor = direction === 'asc' ? 1 : -1;
    result.sort((a, b) => factor * compareEntries(a, b, sort));
    return result;
  }, [entries, search, topic, difficulty, attemptedWithin, customAttemptDays, sort, direction]);

  if (schedule.loading && !schedule.data) return <Spinner label="Loading your problems…" />;
  if (schedule.error) return <ErrorState message={schedule.error} onRetry={schedule.reload} />;

  async function refresh(): Promise<void> {
    schedule.reload();
    onChanged();
  }

  async function handleReschedule(slug: string, daysFromNow: number): Promise<void> {
    const days = Math.max(0, Number(daysFromNow) ?? 0);
    const targetDueAt = addLocalDays(Date.now(), days);

    // Optimistically update schedule so badge and date update immediately
    if (schedule.data) {
      schedule.setData(
        schedule.data.map((entry) => {
          if (entry.problem.slug !== slug) return entry;
          return {
            ...entry,
            dueAt: targetDueAt,
            overdue: false,
            daysUntilDue: days,
            revision: entry.revision
              ? { ...entry.revision, dueAt: targetDueAt, manualSchedule: true }
              : {
                  slug,
                  stage: 0,
                  lastRating: null,
                  lastReviewedAt: null,
                  dueAt: targetDueAt,
                  snoozedUntil: null,
                  dismissedAt: null,
                  paused: false,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  manualSchedule: true,
                },
          };
        }),
      );
    }
    setRescheduleFor(null);

    try {
      await callService('reschedule', { slug, dueAt: targetDueAt });
      setSuccessToast(
        `Next revision scheduled in ${days} day${days === 1 ? '' : 's'}${days === 0 ? ' (Due today)' : ''}.`,
      );
      await refresh();
    } catch (err) {
      console.warn('Failed to reschedule:', err);
    }
  }

  return (
    <div className="space-y-4">
      {successToast ? (
        <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success-soft px-4 py-2.5 text-xs text-success shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">🎉</span>
            <span className="font-medium">{successToast}</span>
          </div>
          <button
            type="button"
            className="text-success hover:underline text-xs font-semibold px-2 py-0.5 cursor-pointer"
            onClick={() => setSuccessToast(null)}
          >
            ✕ Dismiss
          </button>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Tracked problems"
          subtitle={`${filtered.length} of ${entries.length} problem${entries.length === 1 ? '' : 's'}`}
        />
        <div className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className="rlc-input"
              type="search"
              placeholder="🔍 Search by title, slug or topic…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search problems"
            />
            <select
              className="rlc-input"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as Difficulty | '')}
              aria-label="Filter by difficulty"
            >
              <option value="">All difficulties</option>
              {DIFFICULTIES.filter((item) => item !== 'Unknown').map((item) => {
                const count = entries.filter((e) => getEffectiveDifficulty(e.problem) === item).length;
                return (
                  <option key={item} value={item}>
                    {item} ({count})
                  </option>
                );
              })}
            </select>
            <select
              className="rlc-input"
              value={attemptedWithin}
              onChange={(event) => setAttemptedWithin(event.target.value)}
              aria-label="Filter by when attempted"
            >
              <option value="all">Attempted: Any time</option>
              <option value="1">Attempted: Last 24 hours</option>
              <option value="3">Attempted: Last 3 days</option>
              <option value="7">Attempted: Last 7 days</option>
              <option value="14">Attempted: Last 14 days</option>
              <option value="30">Attempted: Last 30 days</option>
              <option value="custom">Attempted: Custom days…</option>
            </select>
          </div>

          {attemptedWithin === 'custom' ? (
            <div className="flex items-center gap-2 text-[11px] text-subtle">
              <span>Show questions attempted within the last</span>
              <input
                type="number"
                min={1}
                max={365}
                className="rlc-input w-16 py-1 text-center text-xs"
                value={customAttemptDays}
                onChange={(e) => setCustomAttemptDays(Number(e.target.value))}
              />
              <span>days</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-subtle">
            <div className="flex items-center gap-2">
              <label htmlFor="sort-by" className="text-subtle">
                Sort by
              </label>
              <select
                id="sort-by"
                className="rlc-input w-auto py-1 text-[11px]"
                value={sort}
                onChange={(event) => {
                  const nextSort = event.target.value as ProblemSortKey;
                  setSort(nextSort);
                  if (nextSort === 'lastAttempt') {
                    setDirection('desc');
                  } else if (nextSort === 'due' || nextSort === 'title' || nextSort === 'difficulty') {
                    setDirection('asc');
                  }
                }}
              >
                <option value="lastAttempt">Recently solved (Newest)</option>
                <option value="due">Due date</option>
                <option value="difficulty">Difficulty</option>
                <option value="title">Title</option>
                <option value="topic">Topic</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
                aria-label={`Sort ${direction === 'asc' ? 'descending' : 'ascending'}`}
              >
                {direction === 'desc' ? '🔽 Desc' : '🔼 Asc'}
              </Button>
            </div>
            {(search || topic || difficulty || attemptedWithin !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTopic('');
                  setDifficulty('');
                  setAttemptedWithin('all');
                }}
              >
                ✕ Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {search || topic || difficulty || attemptedWithin !== 'all' ? (
        <div className="flex flex-wrap items-center gap-1.5 py-1 text-xs text-subtle">
          <span className="font-semibold text-fg">Active:</span>
          {search ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-2 border border-line px-2 py-0.5 text-[11px] text-fg">
              🔍 "{search}"
              <button type="button" onClick={() => setSearch('')} className="hover:text-rose-400">
                ✕
              </button>
            </span>
          ) : null}
          {difficulty ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-2 border border-line px-2 py-0.5 text-[11px] text-fg">
              🎯 {difficulty}
              <button type="button" onClick={() => setDifficulty('')} className="hover:text-rose-400">
                ✕
              </button>
            </span>
          ) : null}
          {topic ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-2 border border-line px-2 py-0.5 text-[11px] text-fg">
              🏷️ {topic}
              <button type="button" onClick={() => setTopic('')} className="hover:text-rose-400">
                ✕
              </button>
            </span>
          ) : null}
          {attemptedWithin !== 'all' ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-2 border border-line px-2 py-0.5 text-[11px] text-fg">
              ⏱️ {attemptedWithin === 'custom' ? `Within ${customAttemptDays}d` : `Last ${attemptedWithin}d`}
              <button type="button" onClick={() => setAttemptedWithin('all')} className="hover:text-rose-400">
                ✕
              </button>
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setTopic('');
              setDifficulty('');
              setAttemptedWithin('all');
            }}
            className="text-xs text-accent hover:underline font-semibold ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={entries.length === 0 ? 'No problems tracked yet' : 'Nothing matches your filters'}
          description={
            entries.length === 0
              ? 'Click the 🚀 rocket button while on any LeetCode or GeeksforGeeks problem, or import your history.'
              : 'Try loosening the filters or clearing the search.'
          }
          action={
            entries.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" onClick={() => navigate('/import')}>
                  📥 Import history
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open('https://leetcode.com/problemset/all/', '_blank')}
                >
                  🌐 Open LeetCode
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    window.open('https://www.geeksforgeeks.org/explore?page=1&sortBy=submissions', '_blank')
                  }
                >
                  🌐 Open GeeksforGeeks
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTopic('');
                  setDifficulty('');
                  setAttemptedWithin('all');
                }}
              >
                ✕ Reset all filters
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => {
            const effectiveDiff = getEffectiveDifficulty(entry.problem);
            const effectiveTopics =
              entry.problem.topics.length > 0
                ? entry.problem.topics
                : (getPopularProblem(entry.problem.slug)?.topics ?? []);

            return (
              <li key={entry.problem.slug}>
                <RevisionCard
                  problem={{
                    ...entry.problem,
                    difficulty: effectiveDiff,
                    topics: effectiveTopics,
                  }}
                  revision={entry.revision}
                  dueAt={entry.dueAt}
                  overdue={entry.overdue}
                  daysUntilDue={entry.daysUntilDue}
                  overdueDays={entry.overdue && entry.daysUntilDue !== null ? Math.abs(entry.daysUntilDue) : undefined}
                  onReschedule={() =>
                    setRescheduleFor(rescheduleFor === entry.problem.slug ? null : entry.problem.slug)
                  }
                  onDelete={() => setConfirmDelete(entry.problem.slug)}
                  rescheduleContent={
                    rescheduleFor === entry.problem.slug ? (
                      <div className="space-y-2 text-[11px]">
                        <p className="font-medium text-fg">Revise this question:</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(entry.problem.slug, 1)}>
                            1 day
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(entry.problem.slug, 3)}>
                            3 days
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(entry.problem.slug, 5)}>
                            5 days
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(entry.problem.slug, 7)}>
                            7 days
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-subtle">Or custom:</span>
                          <input
                            type="number"
                            min={0}
                            max={365}
                            className="rlc-input w-16 py-1 text-center text-xs"
                            value={customRescheduleDays}
                            onChange={(e) => setCustomRescheduleDays(Number(e.target.value))}
                          />
                          <span className="text-subtle">days (0 = Today)</span>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleReschedule(entry.problem.slug, customRescheduleDays)}
                          >
                            ✓ Set
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setRescheduleFor(null)}>
                            ✕ Close
                          </Button>
                        </div>
                      </div>
                    ) : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {confirmDelete ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="rlc-card w-full max-w-sm p-5">
            <h2 className="text-sm font-semibold">Remove this problem?</h2>
            <p className="mt-1.5 text-xs text-muted">
              This deletes the problem, its attempts and its revision history from this device. It cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                ✕ Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await callService('delete-problem', { slug: confirmDelete });
                  setConfirmDelete(null);
                  setSuccessToast('Problem removed from tracking.');
                  await refresh();
                }}
              >
                🗑️ Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function compareEntries(a: ProblemWithSchedule, b: ProblemWithSchedule, sort: ProblemSortKey): number {
  switch (sort) {
    case 'lastAttempt': {
      const aTime = a.problem.lastAttemptAt ?? a.problem.createdAt ?? 0;
      const bTime = b.problem.lastAttemptAt ?? b.problem.createdAt ?? 0;
      return aTime - bTime;
    }
    case 'due': {
      const left = a.dueAt ?? Number.POSITIVE_INFINITY;
      const right = b.dueAt ?? Number.POSITIVE_INFINITY;
      if (left !== right) return left - right;
      // Tie breaker when due date matches: newest attempt on top
      const aTime = a.problem.lastAttemptAt ?? a.problem.createdAt ?? 0;
      const bTime = b.problem.lastAttemptAt ?? b.problem.createdAt ?? 0;
      return bTime - aTime;
    }
    case 'topic':
      return (a.problem.topics[0] ?? '').localeCompare(b.problem.topics[0] ?? '');
    case 'difficulty':
      return DIFFICULTY_ORDER[getEffectiveDifficulty(a.problem)] - DIFFICULTY_ORDER[getEffectiveDifficulty(b.problem)];
    case 'title':
    default:
      return a.problem.title.localeCompare(b.problem.title);
  }
}
