import { useEffect, useState } from 'react';

import { RecallRating } from '../../components/RecallRating';
import { Button } from '../../components/ui/Button';
import { Badge, DifficultyBadge, PlatformBadge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState, Spinner } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import { addLocalDays, formatDate, formatRelativeTime } from '../../utils/date';
import { getPopularProblem } from '../../data/popularProblems';
import { parseProblemNotes, upsertChecklist } from '../../utils/notes';
import { isGfgSlug, problemUrl } from '../../utils/slug';
import type { RecallRating as RecallRatingValue } from '../../types';

export interface RecallScreenProps {
  slug: string;
  navigate: (path: string) => void;
  onChanged: () => void;
}

const CHECKLIST = [
  {
    key: 'approach',
    prompt: 'What is the main approach?',
    placeholder: 'e.g. Union-Find to merge connected components…',
  },
  {
    key: 'dataStructure',
    prompt: 'What data structure or algorithm is used?',
    placeholder: 'e.g. BFS over the grid, with a visited set…',
  },
  {
    key: 'complexity',
    prompt: 'What is the time complexity?',
    placeholder: 'e.g. O(m · n) for the grid…',
  },
  {
    key: 'mistake',
    prompt: 'What mistake did I previously make?',
    placeholder: 'e.g. Forgot to mark the start cell as visited…',
  },
] as const;

type ChecklistKey = (typeof CHECKLIST)[number]['key'];

export function RecallScreen({ slug, navigate, onChanged }: RecallScreenProps) {
  const problem = useAsync(() => callService('get-problem', { slug }), [slug]);
  const [answers, setAnswers] = useState<Record<ChecklistKey, string>>({
    approach: '',
    dataStructure: '',
    complexity: '',
    mistake: '',
  });
  const [notesRevealed, setNotesRevealed] = useState(false);
  const [rating, setRating] = useState<RecallRatingValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [nextDue, setNextDue] = useState<number | null>(null);
  const [manualDays, setManualDays] = useState(3);

  useEffect(() => {
    setAnswers({ approach: '', dataStructure: '', complexity: '', mistake: '' });
    setNotesRevealed(false);
    setRating(null);
    setSavedAt(null);
    setNextDue(null);
    setManualDays(3);
  }, [slug]);

  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => {
      setSavedAt(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  if (problem.loading && !problem.data) return <Spinner label="Loading the problem…" />;
  if (problem.error) return <ErrorState message={problem.error} onRetry={problem.reload} />;

  const data = problem.data;
  if (!data?.problem) {
    return (
      <div className="rlc-card p-8 text-center">
        <p className="text-sm font-semibold">Problem not found</p>
        <p className="mt-1 text-xs text-muted">
          RecallLC does not have a record for <span className="font-mono">{slug}</span>.
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="primary" size="sm" onClick={() => navigate('/reminders')}>
            Back to reminders
          </Button>
        </div>
      </div>
    );
  }

  const tracked = data.problem;
  const revision = data.revision;

  async function submitRating(): Promise<void> {
    if (!rating) return;
    setBusy(true);
    try {
      const hasAnswers = Object.values(answers).some((val) => val.trim().length > 0);
      if (hasAnswers) {
        await saveAnswersToNotes();
      }
      const outcome = await callService('rate', { slug, rating });
      setNextDue(outcome?.dueAt ?? null);
      setSavedAt(Date.now());
      onChanged();
      navigate('/reminders');
    } finally {
      setBusy(false);
    }
  }

  async function submitManualReschedule(daysFromNow: number): Promise<void> {
    const days = Math.max(0, Number(daysFromNow) ?? 0);
    const targetDueAt = addLocalDays(Date.now(), days);
    setBusy(true);
    try {
      const hasAnswers = Object.values(answers).some((val) => val.trim().length > 0);
      if (hasAnswers) {
        await saveAnswersToNotes();
      }
      if (rating) {
        await callService('rate', { slug, rating });
      }
      await callService('reschedule', { slug, dueAt: targetDueAt });
      setNextDue(targetDueAt);
      setSavedAt(Date.now());
      onChanged();
      navigate('/reminders');
    } catch (err) {
      console.warn('Failed to set manual schedule:', err);
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswersToNotes(): Promise<void> {
    const lines = CHECKLIST.map((item) => `- ${item.prompt} ${answers[item.key].trim() || '_(not recorded)_'}`);
    const next = upsertChecklist(tracked.notes, lines);
    await callService('update-notes', { slug, notes: next });
    problem.reload();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate('/reminders')}
            className="text-[11px] text-subtle underline-offset-2 hover:underline"
          >
            ← Back
          </button>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{tracked.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PlatformBadge url={tracked.url} slug={tracked.slug} />
            <DifficultyBadge
              difficulty={
                tracked.difficulty !== 'Unknown'
                  ? tracked.difficulty
                  : (getPopularProblem(tracked.slug)?.difficulty ?? 'Unknown')
              }
            />
            {tracked.topics.slice(0, 3).map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
            {tracked.attemptCount > 0 ? (
              <span className="text-[11px] text-muted">
                {tracked.attemptCount} attempt{tracked.attemptCount === 1 ? '' : 's'} · last{' '}
                {formatRelativeTime(tracked.lastAttemptAt)}
              </span>
            ) : null}
          </div>
        </div>
        {(() => {
          const isGfg = Boolean((tracked.url && tracked.url.includes('geeksforgeeks.org')) || isGfgSlug(tracked.slug));
          const targetUrl =
            tracked.url && tracked.url.includes(isGfg ? 'geeksforgeeks.org' : 'leetcode.com')
              ? tracked.url
              : problemUrl(tracked.slug, isGfg ? 'gfg' : undefined);
          return (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void callService('open-problem', { url: targetUrl });
              }}
            >
              🌐 Open on {isGfg ? 'GeeksforGeeks' : 'LeetCode'}
            </Button>
          );
        })()}
      </div>

      {savedAt !== null ? (
        <div className="rounded-xl border border-success/40 bg-success-soft px-4 py-3">
          <p className="text-xs font-semibold text-success">Schedule updated</p>
          <p className="mt-1 text-[11px] text-muted">
            Next review: <strong className="text-fg">{formatDate(nextDue)}</strong>. This problem will not be suggested
            again until then.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/reminders')}>
              🔔 Back to reminders
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/problems`)}>
              📚 All problems
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="1 · Recall first"
          subtitle="Try to reconstruct the solution before you look at anything you wrote down."
        />
        <div className="space-y-3 p-4">
          {CHECKLIST.map((item) => (
            <div key={item.key}>
              <label htmlFor={`check-${item.key}`} className="text-xs font-medium text-fg">
                {item.prompt}
              </label>
              <textarea
                id={`check-${item.key}`}
                className="rlc-input mt-1 min-h-16 resize-y text-[13px]"
                placeholder={item.placeholder}
                value={answers[item.key]}
                onChange={(event) => setAnswers((current) => ({ ...current, [item.key]: event.target.value }))}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void saveAnswersToNotes()}>
              💾 Save answers to my notes
            </Button>
            <span className="text-[11px] text-subtle">Optional — your notes stay hidden until you reveal them.</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="2 · Your notes" subtitle="Hidden by default so you actually try first." />
        <div className="p-4">
          {notesRevealed ? (
            tracked.notes.trim() ? (
              <div className="space-y-3">
                {(() => {
                  const parsed = parseProblemNotes(tracked.notes);
                  return (
                    <>
                      {parsed.code ? (
                        <div className="overflow-hidden rounded-md border border-line bg-surface-2">
                          <div className="flex items-center justify-between border-b border-line/60 bg-surface-3/40 px-3 py-1.5 text-[11px] font-medium text-fg">
                            <span>💻 Solution Code ({parsed.language})</span>
                            <button
                              type="button"
                              onClick={() => void navigator.clipboard.writeText(parsed.code || '')}
                              className="text-subtle hover:text-fg text-xs"
                            >
                              📋 Copy
                            </button>
                          </div>
                          <pre className="max-h-64 overflow-auto bg-[#0d1117] p-3 font-mono text-[11px] leading-relaxed text-zinc-200 select-text">
                            <code>{parsed.code}</code>
                          </pre>
                        </div>
                      ) : null}

                      {parsed.userNotes ? (
                        <div className="rounded-md border border-line bg-surface-2 p-3 text-xs text-muted leading-relaxed whitespace-pre-wrap">
                          <p className="font-semibold text-fg mb-1 text-[11px]">📝 Notes</p>
                          {parsed.userNotes}
                        </div>
                      ) : null}

                      {!parsed.code && !parsed.userNotes ? (
                        <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-mono text-[12px] leading-relaxed text-muted">
                          {tracked.notes}
                        </pre>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="text-xs text-muted">You have not written any notes for this problem yet.</p>
            )
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setNotesRevealed(true)}>
              👁️ Reveal my notes
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="3 · How well did you recall it?"
          subtitle="Your answer sets the next review date, or you can set a manual schedule below."
        />
        <div className="space-y-4 p-4">
          <RecallRating value={rating} onChange={setRating} disabled={busy} />
          <div className="flex items-center justify-between gap-3">
            {revision ? (
              <span className="text-[11px] text-subtle">
                Currently due {formatDate(revision.dueAt)}
                {revision.stage > 0 ? ` · ${revision.stage} review${revision.stage === 1 ? '' : 's'}` : ''}
              </span>
            ) : (
              <span className="text-[11px] text-subtle">Not scheduled yet</span>
            )}
            <Button variant="primary" size="sm" disabled={!rating || busy} onClick={() => void submitRating()}>
              {busy ? 'Saving…' : '✓ Save rating & schedule'}
            </Button>
          </div>

          {/* Manual Scheduling Option */}
          <div className="border-t border-line/60 pt-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-fg">📅 Or set schedule manually:</p>
                <p className="text-[11px] text-subtle">Choose exact days until the next review</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void submitManualReschedule(1)}
                  title="Schedule revision for tomorrow (1 day)"
                >
                  1 day
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void submitManualReschedule(3)}
                  title="Schedule revision in 3 days"
                >
                  3 days
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void submitManualReschedule(5)}
                  title="Schedule revision in 5 days"
                >
                  5 days
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void submitManualReschedule(7)}
                  title="Schedule revision in 7 days"
                >
                  7 days
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="text-subtle">Or custom:</span>
              <input
                type="number"
                min={0}
                max={365}
                className="rlc-input w-16 py-1 text-center text-xs font-semibold"
                value={manualDays}
                onChange={(e) => setManualDays(Math.max(0, Number(e.target.value) || 0))}
                disabled={busy}
              />
              <span className="text-subtle">days (0 = Today)</span>
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() => void submitManualReschedule(manualDays)}
              >
                ✓ Set manual schedule
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
