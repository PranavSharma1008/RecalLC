import { useMemo, useState } from 'react';

import { RevisionCard } from '../../components/RevisionCard';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import { DIFFICULTIES, type Difficulty, type ProblemSortKey, type ProblemWithSchedule } from '../../types';
import { addLocalDays } from '../../utils/date';

export interface ProblemsScreenProps {
  navigate: (path: string) => void;
  onChanged: () => void;
}

type DueFilter = 'all' | 'due' | 'overdue' | 'upcoming';

const DIFFICULTY_ORDER: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3, Unknown: 4 };

export function ProblemsScreen({ navigate, onChanged }: ProblemsScreenProps) {
  const schedule = useAsync(() => callService('list-problems'), []);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [due, setDue] = useState<DueFilter>('all');
  const [attemptedWithin, setAttemptedWithin] = useState<string>('all');
  const [customAttemptDays, setCustomAttemptDays] = useState<number>(3);
  const [sort, setSort] = useState<ProblemSortKey>('due');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesBusy, setNotesBusy] = useState(false);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [customRescheduleDays, setCustomRescheduleDays] = useState<number>(3);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const entries = schedule.data ?? [];

  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) for (const tag of entry.problem.topics) set.add(tag);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = entries.filter((entry) => {
      const { problem } = entry;
      if (needle) {
        const haystack = `${problem.title} ${problem.slug} ${problem.topics.join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (topic && !problem.topics.includes(topic)) return false;
      if (difficulty && problem.difficulty !== difficulty) return false;
      if (due === 'due' && entry.daysUntilDue !== null && entry.daysUntilDue > 0) return false;
      if (due === 'overdue' && !entry.overdue) return false;
      if (due === 'upcoming' && (entry.overdue || (entry.daysUntilDue !== null && entry.daysUntilDue <= 0)))
        return false;
      if (attemptedWithin !== 'all') {
        const days = attemptedWithin === 'custom' ? customAttemptDays : Number(attemptedWithin);
        if (!problem.lastAttemptAt) return false;
        const cutoff = Date.now() - Math.max(0.1, days) * 86400000;
        if (problem.lastAttemptAt < cutoff) return false;
      }
      return true;
    });

    const factor = direction === 'asc' ? 1 : -1;
    result.sort((a, b) => factor * compareEntries(a, b, sort));
    return result;
  }, [entries, search, topic, difficulty, due, attemptedWithin, customAttemptDays, sort, direction]);

  if (schedule.loading && !schedule.data) return <Spinner label="Loading your problems…" />;
  if (schedule.error) return <ErrorState message={schedule.error} onRetry={schedule.reload} />;

  async function refresh(): Promise<void> {
    schedule.reload();
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

  async function loadSampleProblems(): Promise<void> {
    try {
      const res = await fetch(chrome.runtime.getURL('sample-import.json'));
      const text = await res.text();
      await callService('import-commit', { fileName: 'sample-import.json', content: text });
      await refresh();
    } catch (err) {
      console.warn('Could not load sample problems:', err);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Tracked problems"
          subtitle={`${filtered.length} of ${entries.length} problem${entries.length === 1 ? '' : 's'}`}
        />
        <div className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              aria-label="Filter by topic"
            >
              <option value="">All topics</option>
              {topics.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="rlc-input"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as Difficulty | '')}
              aria-label="Filter by difficulty"
            >
              <option value="">All difficulties</option>
              {DIFFICULTIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              className="rlc-input"
              value={due}
              onChange={(event) => setDue(event.target.value as DueFilter)}
              aria-label="Filter by due state"
            >
              <option value="all">Any due date</option>
              <option value="due">Due now</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
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
                onChange={(event) => setSort(event.target.value as ProblemSortKey)}
              >
                <option value="due">Due date</option>
                <option value="lastAttempt">Last attempt</option>
                <option value="topic">Topic</option>
                <option value="difficulty">Difficulty</option>
                <option value="title">Title</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
                aria-label={`Sort ${direction === 'asc' ? 'descending' : 'ascending'}`}
              >
                {direction === 'asc' ? '🔼 Asc' : '🔽 Desc'}
              </Button>
            </div>
            {(search || topic || difficulty || due !== 'all' || attemptedWithin !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTopic('');
                  setDifficulty('');
                  setDue('all');
                  setAttemptedWithin('all');
                }}
              >
                ✕ Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title={entries.length === 0 ? 'No problems tracked yet' : 'Nothing matches your filters'}
          description={
            entries.length === 0
              ? 'Click the 🚀 rocket button while on any LeetCode problem, import your history, or load sample problems.'
              : 'Try loosening the filters or clearing the search.'
          }
          action={
            entries.length === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" onClick={() => void loadSampleProblems()}>
                  ⚡ Load sample problems
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate('/import')}>
                  📥 Import history
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
                  setDue('all');
                  setAttemptedWithin('all');
                }}
              >
                ✕ Reset all filters
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((entry) => (
            <li key={entry.problem.slug}>
              <RevisionCard
                problem={entry.problem}
                revision={entry.revision}
                dueAt={entry.dueAt}
                overdue={entry.overdue}
                daysUntilDue={entry.daysUntilDue}
                onRevise={() => navigate(`/recall/${entry.problem.slug}`)}
                onSnooze={async () => {
                  await callService('snooze', { slug: entry.problem.slug });
                  await refresh();
                }}
                onPause={async () => {
                  await callService('set-paused', {
                    slug: entry.problem.slug,
                    paused: !entry.revision?.paused,
                  });
                  await refresh();
                }}
                onDelete={() => setConfirmDelete(entry.problem.slug)}
                extra={
                  <div className="space-y-2.5">
                    {notesFor === entry.problem.slug ? (
                      <div className="space-y-2 rounded-md bg-surface-2 p-3">
                        <label htmlFor={`notes-${entry.problem.slug}`} className="text-[11px] font-medium text-subtle">
                          Problem notes & approach
                        </label>
                        <textarea
                          id={`notes-${entry.problem.slug}`}
                          className="rlc-input min-h-24 resize-y font-mono text-[12px]"
                          placeholder="Approach, pitfalls, complexity…"
                          value={notesDraft}
                          onChange={(event) => setNotesDraft(event.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={notesBusy}
                            onClick={() => void saveNotes(entry.problem.slug)}
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
                            setNotesFor(entry.problem.slug);
                            setNotesDraft(entry.problem.notes);
                          }}
                        >
                          {entry.problem.notes ? '✏️ Edit notes' : '📝 + Add notes'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRescheduleFor(rescheduleFor === entry.problem.slug ? null : entry.problem.slug);
                          }}
                        >
                          📅 Change schedule ▾
                        </Button>
                      </div>
                    )}

                    {rescheduleFor === entry.problem.slug ? (
                      <div className="space-y-2 rounded-md border border-line bg-surface-2 p-3 text-[11px]">
                        <p className="font-medium text-fg">Revise this question in:</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(entry.problem.slug, 1)}>
                            1 day
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(entry.problem.slug, 3)}>
                            3 days
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReschedule(entry.problem.slug, 7)}>
                            7 days
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleReschedule(entry.problem.slug, 14)}
                          >
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
                            value={customRescheduleDays}
                            onChange={(e) => setCustomRescheduleDays(Number(e.target.value))}
                          />
                          <span className="text-subtle">days</span>
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
                    ) : null}
                  </div>
                }
              />
            </li>
          ))}
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
    case 'due': {
      const left = a.dueAt ?? Number.POSITIVE_INFINITY;
      const right = b.dueAt ?? Number.POSITIVE_INFINITY;
      return left - right;
    }
    case 'lastAttempt': {
      const left = a.problem.lastAttemptAt ?? 0;
      const right = b.problem.lastAttemptAt ?? 0;
      return right - left;
    }
    case 'topic':
      return (a.problem.topics[0] ?? '').localeCompare(b.problem.topics[0] ?? '');
    case 'difficulty':
      return DIFFICULTY_ORDER[a.problem.difficulty] - DIFFICULTY_ORDER[b.problem.difficulty];
    case 'title':
    default:
      return a.problem.title.localeCompare(b.problem.title);
  }
}
