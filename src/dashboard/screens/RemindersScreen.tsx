import { useMemo, useState } from 'react';

import { RevisionCard } from '../../components/RevisionCard';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import type { ProblemWithSchedule } from '../../types';
import { addLocalDays } from '../../utils/date';

export interface RemindersScreenProps {
  navigate: (path: string) => void;
  onChanged: () => void;
}

export function RemindersScreen({ navigate, onChanged }: RemindersScreenProps) {
  const due = useAsync(() => callService('list-due'), []);
  const schedule = useAsync(() => callService('list-problems'), []);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState(3);

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

  async function saveNotes(slug: string): Promise<void> {
    setNotesBusy(true);
    try {
      await callService('update-notes', { slug, notes: notesDraft });
      setNotesFor(null);
      await refresh();
    } finally {
      setNotesBusy(false);
    }
  }

  async function handleReschedule(slug: string, daysFromNow: number): Promise<void> {
    const targetDueAt = addLocalDays(Date.now(), Math.max(1, daysFromNow));
    await callService('reschedule', { slug, dueAt: targetDueAt });
    setRescheduleFor(null);
    await refresh();
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
          action={
            dueList.length > 0 ? (
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => navigate(`/recall/${dueList[0]!.slug}`)}>
                  🎯 Revise next
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void callService('open-problem', { url: dueList[0]!.url });
                  }}
                >
                  🌐 Open on LeetCode
                </Button>
              </div>
            ) : null
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
              Revision intervals are personalized per question. You can revise now or reschedule any problem below.
            </span>
          </div>
        </div>
      </Card>

      {dueList.length === 0 ? (
        <EmptyState
          title="No problems due for revision"
          description="Whenever a problem reaches its scheduled revision day (e.g. 1, 3, or 5 days after solving), it will appear right here."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/problems')}>
              Browse all tracked problems
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {dueList.map((candidate) => {
            const entry = dueBySlug.get(candidate.slug);
            const notes = entry?.problem.notes ?? '';

            return (
              <li key={candidate.slug}>
                <RevisionCard
                  problem={{
                    slug: candidate.slug,
                    title: candidate.title,
                    url: candidate.url,
                    difficulty: candidate.difficulty,
                    topics: candidate.topics,
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
                  daysUntilDue={entry?.daysUntilDue ?? 0}
                  onRevise={() => navigate(`/recall/${candidate.slug}`)}
                  onSnooze={async () => {
                    await callService('snooze', { slug: candidate.slug });
                    await refresh();
                  }}
                  extra={
                    <div className="space-y-2.5">
                      {/* Notes Section */}
                      {notesFor === candidate.slug ? (
                        <div className="space-y-2 rounded-md bg-surface-2 p-3">
                          <label
                            htmlFor={`reminder-notes-${candidate.slug}`}
                            className="text-[11px] font-medium text-subtle"
                          >
                            Problem notes & approach
                          </label>
                          <textarea
                            id={`reminder-notes-${candidate.slug}`}
                            className="rlc-input min-h-20 resize-y font-mono text-[12px]"
                            placeholder="Key insights, data structures, pitfalls…"
                            value={notesDraft}
                            onChange={(event) => setNotesDraft(event.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={notesBusy}
                              onClick={() => void saveNotes(candidate.slug)}
                            >
                              {notesBusy ? 'Saving…' : '💾 Save notes'}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setNotesFor(null)}>
                              ✕ Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNotesFor(candidate.slug);
                              setNotesDraft(notes);
                            }}
                          >
                            {notes ? '✏️ Edit notes' : '📝 + Add notes'}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRescheduleFor(rescheduleFor === candidate.slug ? null : candidate.slug);
                            }}
                          >
                            📅 Change schedule ▾
                          </Button>
                        </div>
                      )}

                      {/* Reschedule Section */}
                      {rescheduleFor === candidate.slug ? (
                        <div className="space-y-2 rounded-md border border-line bg-surface-2 p-3 text-[11px]">
                          <p className="font-medium text-fg">Revise this question in:</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Button variant="secondary" size="sm" onClick={() => handleReschedule(candidate.slug, 1)}>
                              1 day
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => handleReschedule(candidate.slug, 3)}>
                              3 days
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => handleReschedule(candidate.slug, 7)}>
                              7 days
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => handleReschedule(candidate.slug, 14)}>
                              14 days
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-subtle">Or custom:</span>
                            <input
                              type="number"
                              min={1}
                              max={365}
                              className="rlc-input w-16 py-1 text-center text-xs"
                              value={customDays}
                              onChange={(e) => setCustomDays(Number(e.target.value))}
                            />
                            <span className="text-subtle">days</span>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleReschedule(candidate.slug, customDays)}
                            >
                              ✓ Set
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setRescheduleFor(null)}>
                              ✕ Close
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
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
