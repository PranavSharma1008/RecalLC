import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '../components/ui/Button';
import { EmptyState, Spinner } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { callService } from '../services/messaging';
import type { ReminderCandidate } from '../types';

export function App() {
  const { settings, update } = useSettings();
  const { resolved } = useTheme(settings?.theme);
  const [due, setDue] = useState<ReminderCandidate[]>([]);
  const [dueLoading, setDueLoading] = useState(true);
  const [dueError, setDueError] = useState<string | null>(null);

  const stats = useAsync(() => callService('stats'), []);

  const loadDue = useCallback(async () => {
    try {
      setDueLoading(true);
      const result = await callService('list-due');
      setDue(result);
      setDueError(null);
    } catch (error) {
      setDueError(error instanceof Error ? error.message : 'Could not load your revision queue.');
    } finally {
      setDueLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDue();
  }, [loadDue]);

  const dueToday = useMemo(() => due.filter((candidate) => !candidate.overdue).length, [due]);
  const overdue = useMemo(() => due.filter((candidate) => candidate.overdue).length, [due]);

  const openDashboard = (hash = '') => {
    void callService('open-dashboard', { hash });
    window.close();
  };

  const openProblem = async (candidate: ReminderCandidate) => {
    await callService('open-problem', { url: candidate.url });
    window.close();
  };

  const startReview = async (candidate: ReminderCandidate) => {
    await callService('dismiss', { slug: candidate.slug });
    openDashboard(`#/recall/${candidate.slug}`);
  };

  const toggleTheme = () => {
    void update({ theme: resolved === 'dark' ? 'light' : 'dark' });
  };

  const total = stats.data?.totalProblems ?? 0;

  return (
    <div className="flex h-full min-h-[520px] w-[380px] flex-col bg-bg text-fg">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[13px] font-bold text-accent-contrast"
            >
              R
            </span>
            <h1 className="text-sm font-semibold tracking-tight">RecallLC</h1>
          </div>
          <p className="mt-1 text-[11px] text-subtle">Solve it. Remember it. Master it.</p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
          className="rounded-md border border-line p-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          {resolved === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      <section className="px-4 py-4">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">Due today</p>
          <p className="mt-1 text-4xl font-semibold leading-none tabular-nums text-fg">{dueLoading ? '—' : dueToday}</p>
          <p className="mt-2 text-[11px] text-muted">
            {overdue > 0 ? (
              <>
                <span className="font-medium text-warning">{overdue} overdue</span> ·{' '}
              </>
            ) : null}
            {total} problem{total === 1 ? '' : 's'} tracked
          </p>

          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={due.length === 0}
              onClick={() => {
                const next = due[0];
                if (next) void startReview(next);
              }}
            >
              🎯 Review next
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openDashboard('#/')}>
              📊 Dashboard
            </Button>
          </div>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Revision queue</h2>
          {due.length > 0 ? <span className="text-[11px] text-subtle">{due.length} total</span> : null}
        </div>

        {dueLoading ? (
          <Spinner label="Loading your queue…" />
        ) : dueError ? (
          <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[11px] text-danger">
            {dueError}
          </div>
        ) : due.length === 0 ? (
          <EmptyState
            title="Nothing due right now"
            description={
              total === 0
                ? 'Save a problem or import your attempt history to start building a revision schedule.'
                : 'You are all caught up. Solve a new problem and RecallLC will remind you when something is due.'
            }
            action={
              <Button variant="secondary" size="sm" onClick={() => openDashboard('#/import')}>
                📥 Import history
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {due.slice(0, 6).map((candidate) => (
              <li key={candidate.slug}>
                <PopupDueItem candidate={candidate} onOpen={() => void openProblem(candidate)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-line px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-subtle">
          <span>Covers the editor, tracker, reminders and queue.</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => openDashboard('#/import')}
              className="text-subtle hover:text-fg transition-colors"
            >
              📥 Import
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => openDashboard('#/settings')}
              className="text-subtle hover:text-fg transition-colors"
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openDashboard('#/support')}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-fg hover:border-line-strong hover:bg-surface-3 transition-colors"
            >
              <span className="text-pink-400">💖</span> Support
            </button>
            <a
              href="mailto:shpranav1008@gmail.com?subject=RecallLC%20Bug%20Report&body=Hi%20Pranav,%0A%0AI%20found%20a%20bug%20in%20RecallLC%20v1.0.0:%0A"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-fg hover:border-line-strong hover:bg-surface-3 transition-colors"
            >
              <span>🪲</span> Report bug
            </a>
          </div>
          <span className="text-[11px] font-mono text-subtle">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}

function PopupDueItem({ candidate, onOpen }: { candidate: ReminderCandidate; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rlc-card-flat block w-full p-3 text-left transition-colors hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-fg">{candidate.title}</p>
        {candidate.overdue ? (
          <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">
            {candidate.overdueDays}d late
          </span>
        ) : null}
      </div>
      <p className="mt-1 truncate text-[11px] text-subtle">
        {candidate.difficulty}
        {candidate.topics[0] ? ` · ${candidate.topics[0]}` : ''} · {candidate.attemptCount} attempt
        {candidate.attemptCount === 1 ? '' : 's'}
      </p>
    </button>
  );
}
