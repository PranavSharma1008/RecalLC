import { useMemo } from 'react';

import { RevisionCard } from '../../components/RevisionCard';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, StatTile } from '../../components/ui/Card';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import type { ProblemWithSchedule } from '../../types';

export interface OverviewScreenProps {
  navigate: (path: string) => void;
  onChanged: () => void;
}

export function OverviewScreen({ navigate, onChanged }: OverviewScreenProps) {
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
            action={
              dueList.length > 0 ? (
                <Button variant="primary" size="sm" onClick={() => navigate(`/recall/${dueList[0]!.slug}`)}>
                  🎯 Review next
                </Button>
              ) : null
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
                    return (
                      <li key={candidate.slug}>
                        <RevisionCard
                          problem={{
                            slug: candidate.slug,
                            title: candidate.title,
                            url: candidate.url,
                            difficulty: candidate.difficulty,
                            topics: candidate.topics,
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
                          onSnooze={async () => {
                            await callService('snooze', { slug: candidate.slug });
                            onChanged();
                            due.reload();
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
                {dueList.length > 4 ? (
                  <div className="pt-1 text-center">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/problems')}>
                      See all {dueList.length} due problems →
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="By topic" subtitle="Where your revision effort goes" />
            <div className="p-4">
              {(data?.byTopic.length ?? 0) === 0 ? (
                <p className="text-xs text-muted">No topics yet — import your history to see the breakdown.</p>
              ) : (
                <ul className="space-y-2">
                  {data?.byTopic.slice(0, 10).map((topic) => {
                    const max = data.byTopic[0]?.count || 1;
                    const percent = Math.round((topic.count / max) * 100);
                    return (
                      <li key={topic.topic}>
                        <div className="flex items-baseline justify-between gap-2 text-[11px]">
                          <span className="truncate text-fg">{topic.topic}</span>
                          <span className="shrink-0 tabular-nums text-subtle">
                            {topic.count}
                            {topic.due > 0 ? <span className="ml-1 text-accent">({topic.due} due)</span> : null}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid grid-cols-2 gap-2 p-4">
              <Button variant="secondary" size="sm" onClick={() => navigate('/problems')}>
                📚 Browse problems
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/import')}>
                📥 Import history
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
                ⚙️ Settings
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void callService('open-problem', { url: 'https://leetcode.com/problemset/' }).catch(() => undefined);
                }}
              >
                🌐 Open LeetCode
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
