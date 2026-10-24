import { useMemo } from 'react';

import { RevisionCard } from '../../components/RevisionCard';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, StatTile } from '../../components/ui/Card';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import { getPopularProblem } from '../../data/popularProblems';
import type { ProblemWithSchedule } from '../../types';

export interface OverviewScreenProps {
  navigate: (path: string) => void;
  onChanged: () => void;
}

export function OverviewScreen({ navigate, onChanged: _onChanged }: OverviewScreenProps) {
  const stats = useAsync(() => callService('stats'), []);
  const due = useAsync(() => callService('list-due'), []);
  const schedule = useAsync(() => callService('list-problems'), []);

  const dueBySlug = useMemo(() => {
    const map = new Map<string, ProblemWithSchedule>();
    for (const entry of schedule.data ?? []) map.set(entry.problem.slug, entry);
    return map;
  }, [schedule.data]);

  if (stats.loading && !stats.data) {
    return <Spinner label="Crunching your revision history…" />;
  }

  if (stats.error) {
    return <ErrorState message={stats.error} onRetry={stats.reload} />;
  }

  const data = stats.data;
  const dueList = due.data ?? [];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Due today"
          value={data?.dueToday ?? 0}
          tone="accent"
          hint={data && data.dueToday > 0 ? 'Ready to revise' : 'All clear'}
        />
        <StatTile
          label="Overdue"
          value={data?.overdue ?? 0}
          tone={(data?.overdue ?? 0) > 0 ? 'warning' : 'default'}
          hint={(data?.overdue ?? 0) > 0 ? 'Needs attention' : 'Nothing late'}
        />
        <StatTile label="Tracked" value={data?.totalProblems ?? 0} hint={`${data?.totalAttempts ?? 0} attempts`} />
        <StatTile
          label="Revised (7d)"
          value={data?.revisedThisWeek ?? 0}
          tone="success"
          hint={`${data?.totalReviews ?? 0} reviews all time`}
        />
        <StatTile
          label="Streak"
          value={`${data?.streak ?? 0}d`}
          tone={(data?.streak ?? 0) > 0 ? 'success' : 'default'}
          hint={(data?.streak ?? 0) > 0 ? 'Keep it going' : 'Revise to start one'}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Due for revision"
            subtitle={
              dueList.length > 0
                ? `${dueList.length} problem${dueList.length === 1 ? '' : 's'} waiting`
                : 'Nothing is due right now'
            }
          />
          <div className="p-4">
            {due.loading ? (
              <Spinner />
            ) : dueList.length === 0 ? (
              <EmptyState
                title="You are all caught up"
                description="Solve a new problem on LeetCode with the 🚀 rocket button — RecallLC will remind you when it is due."
                action={
                  <Button variant="secondary" size="sm" onClick={() => navigate('/import')}>
                    📥 Import attempt history
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {dueList.slice(0, 4).map((candidate) => {
                    const entry = dueBySlug.get(candidate.slug);
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
                            notes: entry?.problem.notes ?? '',
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
                          daysUntilDue={entry?.daysUntilDue ?? null}
                          compact
                          onRevise={() => navigate(`/recall/${candidate.slug}`)}
                        />
                      </li>
                    );
                  })}
                </ul>
                {dueList.length > 4 ? (
                  <div className="pt-1 text-center">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/reminders')}>
                      See all {dueList.length} due reminders →
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid grid-cols-2 gap-2 p-4">
              <Button variant="secondary" size="sm" onClick={() => navigate('/problems')}>
                📚 Browse problems
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/reminders')}>
                ⏰ View reminders
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/import')}>
                📥 Import history
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
                ⚙️ Settings
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
