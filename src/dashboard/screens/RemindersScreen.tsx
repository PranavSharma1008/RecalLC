import { useEffect, useMemo, useState } from 'react';

import { RevisionCard } from '../../components/RevisionCard';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import { getPopularProblem } from '../../data/popularProblems';
import type { ProblemWithSchedule } from '../../types';
import { addLocalDays } from '../../utils/date';

export interface RemindersScreenProps {
  navigate: (path: string) => void;
  onChanged: () => void;
}

export function RemindersScreen({ navigate, onChanged }: RemindersScreenProps) {
  const due = useAsync(() => callService('list-due'), []);
  const schedule = useAsync(() => callService('list-problems'), []);

  const [successToast, setSuccessToast] = useState<{ slug: string; message: string } | null>(null);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => {
      setSuccessToast(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [successToast]);

  // Quick reschedule state
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [quickRescheduleDays, setQuickRescheduleDays] = useState(3);

  const dueBySlug = useMemo(() => {
    const map = new Map<string, ProblemWithSchedule>();
    for (const entry of schedule.data ?? []) map.set(entry.problem.slug, entry);
    return map;
  }, [schedule.data]);

  const dueList = due.data ?? [];

  if (due.loading && !due.data) {
    return <Spinner label="Loading revision reminders…" />;
  }

  if (due.error) {
    return <ErrorState message={due.error} onRetry={due.reload} />;
  }

  async function refresh(): Promise<void> {
    await Promise.all([due.reload(), schedule.reload()]);
    onChanged();
  }

  async function handleReschedule(slug: string, daysFromNow: number): Promise<void> {
    const days = Math.max(0, Number(daysFromNow) ?? 0);
    const targetDueAt = addLocalDays(Date.now(), days);

    // If rescheduled for future days, immediately remove from due list in Reminders tab
    if (days > 0) {
      due.setData((prev) => (prev ? prev.filter((item) => item.slug !== slug) : []));
    }

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
      setSuccessToast({
        slug,
        message: `Next revision scheduled in ${days} day${days === 1 ? '' : 's'}${days === 0 ? ' (Due today)' : ''}.`,
      });
      await refresh();
    } catch (err) {
      console.warn('Failed to reschedule:', err);
    }
  }

  const overdueCount = dueList.filter((candidate) => candidate.overdue).length;
  const dueTodayCount = dueList.length - overdueCount;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Revision reminders"
          subtitle={
            dueList.length > 0
              ? `${dueList.length} problem${dueList.length === 1 ? '' : 's'} scheduled for revision today`
              : 'All caught up — no reminders due today'
          }
        />
        <div className="border-t border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-fg">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              Due today: <strong className="text-accent">{dueTodayCount}</strong>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-fg">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              Overdue: <strong className={overdueCount > 0 ? 'text-amber-500' : 'text-subtle'}>{overdueCount}</strong>
            </span>
            <span className="text-subtle">
              Revision intervals are personalized per question. Click &quot;Revise&quot; to practice recall or
              &quot;Change schedule&quot; to set your next reminder.
            </span>
          </div>
        </div>
      </Card>

      {successToast ? (
        <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-xs text-success shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-base">🎉</span>
            <span className="font-medium">{successToast.message}</span>
          </div>
          <button
            type="button"
            className="text-success hover:underline text-xs font-semibold px-2 py-1"
            onClick={() => setSuccessToast(null)}
          >
            ✕ Dismiss
          </button>
        </div>
      ) : null}

      {dueList.length === 0 ? (
        <EmptyState
          title="No problems due for revision"
          description="Whenever a problem reaches its scheduled revision day (e.g. 6 days after solving), it will appear right here."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/problems')}>
              Browse all tracked problems
            </Button>
          }
        />
      ) : (
        <ul className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dueList.map((candidate) => {
            const entry = dueBySlug.get(candidate.slug);
            const notes = entry?.problem.notes ?? '';
            const popular = getPopularProblem(candidate.slug);
            const effectiveDiff =
              candidate.difficulty && candidate.difficulty !== 'Unknown'
                ? candidate.difficulty
                : (popular?.difficulty ?? 'Unknown');
            const effectiveTopics = candidate.topics.length > 0 ? candidate.topics : (popular?.topics ?? []);

            return (
              <li key={candidate.slug}>
                <RevisionCard
                  problem={{
                    slug: candidate.slug,
                    title: candidate.title,
                    url: candidate.url,
                    difficulty: effectiveDiff,
                    topics: effectiveTopics,
                    notes,
                    firstAttemptAt: entry?.problem.firstAttemptAt ?? null,
                    lastAttemptAt: candidate.lastAttemptAt,
                    lastViewedAt: entry?.problem.lastViewedAt ?? null,
                    attemptCount: candidate.attemptCount,
                    accepted: candidate.accepted,
                    lastLanguage: candidate.language,
                    struggleScore: entry?.problem.struggleScore ?? 0,
                    createdAt: entry?.problem.createdAt ?? Date.now(),
                    updatedAt: entry?.problem.updatedAt ?? Date.now(),
                  }}
                  revision={entry?.revision ?? null}
                  dueAt={candidate.dueAt}
                  overdue={candidate.overdue}
                  overdueDays={candidate.overdueDays}
                  daysUntilDue={candidate.overdue ? -candidate.overdueDays : (entry?.daysUntilDue ?? 0)}
                  onRevise={() => navigate(`/recall/${candidate.slug}`)}
                  onReschedule={() => setRescheduleFor(rescheduleFor === candidate.slug ? null : candidate.slug)}
                  rescheduleContent={
                    rescheduleFor === candidate.slug ? (
                      <div className="space-y-2 text-[11px]">
                        <p className="font-medium text-fg">Revise this question:</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(candidate.slug, 1)}>
                            1 day
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(candidate.slug, 3)}>
                            3 days
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(candidate.slug, 5)}>
                            5 days
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(candidate.slug, 7)}>
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
                            value={quickRescheduleDays}
                            onChange={(e) => setQuickRescheduleDays(Number(e.target.value))}
                          />
                          <span className="text-subtle">days (0 = Today)</span>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleReschedule(candidate.slug, quickRescheduleDays)}
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
    </div>
  );
}
