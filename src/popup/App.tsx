import { useCallback, useEffect, useMemo, useState } from 'react';

import { LockScreen } from '../components/LockScreen';
import { Button } from '../components/ui/Button';
import { EmptyState, Spinner } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { callService } from '../services/messaging';
import type { ReminderCandidate } from '../types';
import { isSessionExpired, isSessionUnlocked, setSessionUnlocked } from '../utils/security';
import { isGfgSlug, problemUrl } from '../utils/slug';

export function App() {
  const { settings, update } = useSettings();
  const { resolved } = useTheme(settings?.theme);
  const [due, setDue] = useState<ReminderCandidate[]>([]);
  const [dueLoading, setDueLoading] = useState(true);
  const [dueError, setDueError] = useState<string | null>(null);

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return !isSessionUnlocked();
  });

  useEffect(() => {
    if (!settings?.securityAuthEnabled) return;
    const timeout = settings.securityAutoLockMinutes ?? 15;
    if (isSessionExpired(timeout)) {
      setSessionUnlocked(false);
      setIsLocked(true);
    }
  }, [settings?.securityAuthEnabled, settings?.securityAutoLockMinutes]);

  const stats = useAsync(() => {
    if (settings?.securityAuthEnabled && isLocked) {
      return Promise.resolve(null);
    }
    return callService('stats');
  }, [settings?.securityAuthEnabled, isLocked]);

  const loadDue = useCallback(async () => {
    try {
      setDueLoading(true);
      const result = await callService('list-due');
      setDue(Array.isArray(result) ? result : []);
      setDueError(null);
    } catch (error) {
      setDueError(error instanceof Error ? error.message : 'Could not load your revision queue.');
      setDue([]);
    } finally {
      setDueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!settings?.securityAuthEnabled || !isLocked) {
      void loadDue();
    }
  }, [loadDue, settings?.securityAuthEnabled, isLocked]);

  // Real-time automatic data reload on storage updates or window focus
  useEffect(() => {
    function handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, area: string) {
      if (area === 'local' && changes['recalllc:data_version']) {
        stats.reload();
        void loadDue();
      }
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, [loadDue, stats]);

  const dueList = Array.isArray(due) ? due : [];
  const dueToday = useMemo(() => dueList.filter((candidate) => !candidate.overdue).length, [dueList]);
  const overdue = useMemo(() => dueList.filter((candidate) => candidate.overdue).length, [dueList]);

  const openDashboard = (hash = '') => {
    void callService('open-dashboard', { hash });
    window.close();
  };

  const openProblem = async (candidate: ReminderCandidate) => {
    const isGfg = Boolean((candidate.url && candidate.url.includes('geeksforgeeks.org')) || isGfgSlug(candidate.slug));
    const targetUrl =
      candidate.url && candidate.url.includes(isGfg ? 'geeksforgeeks.org' : 'leetcode.com')
        ? candidate.url
        : problemUrl(candidate.slug, isGfg ? 'gfg' : undefined);
    await callService('open-problem', { url: targetUrl });
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

  if (settings && settings.securityAuthEnabled && isLocked) {
    return (
      <div className="flex h-full min-h-[520px] w-[380px] flex-col bg-bg text-fg">
        <LockScreen
          passcodeHash={settings.securityPasscodeHash}
          passcodeSalt={settings.securityPasscodeSalt}
          onUnlock={() => {
            setIsLocked(false);
            void loadDue();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[520px] w-[380px] flex-col bg-bg text-fg">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <img src="/icons/icon32.png" alt="RecallLC Logo" className="h-6 w-6 rounded-md object-contain" />
            <h1 className="text-sm font-semibold tracking-tight">RecallLC</h1>
          </div>
          <p className="mt-1 text-[11px] text-subtle">Solve it. Remember it. Master it.</p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-fg shadow-sm transition-all hover:border-accent hover:text-accent cursor-pointer"
        >
          <span className="text-sm">{resolved === 'dark' ? '☀' : '☾'}</span>
          <span className="text-[11px] font-medium">{resolved === 'dark' ? 'Light' : 'Dark'}</span>
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
              disabled={dueList.length === 0}
              onClick={() => {
                const next = dueList[0];
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
          {dueList.length > 0 ? <span className="text-[11px] text-subtle">{dueList.length} total</span> : null}
        </div>

        {dueLoading ? (
          <Spinner label="Loading your queue…" />
        ) : dueError ? (
          <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[11px] text-danger">
            {dueError}
          </div>
        ) : dueList.length === 0 ? (
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
            {dueList.slice(0, 6).map((candidate) => (
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
          <button
            type="button"
            onClick={() => openDashboard('#/settings')}
            className="text-subtle hover:text-fg transition-colors"
          >
            ⚙️ Settings
          </button>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-2">
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=pranav2410991479@gmail.com&su=RecallLC%20Enquiry"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors cursor-pointer"
              title="Open Gmail to send enquiry directly to pranav2410991479@gmail.com"
            >
              <span>✉️</span> Enquiry
            </a>
            <button
              type="button"
              onClick={() => openDashboard('#/support')}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-fg hover:border-line-strong hover:bg-surface-3 transition-colors cursor-pointer"
            >
              <span className="text-pink-400">💖</span> Support
            </button>
          </div>
          <span className="text-[11px] font-mono text-subtle">v1.0.3</span>
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
        <span className="font-medium text-fg/80">
          {(candidate.url && candidate.url.includes('geeksforgeeks.org')) || isGfgSlug(candidate.slug) ? 'GFG' : 'LC'}
        </span>
        {' · '}
        {candidate.difficulty}
        {candidate.topics[0] ? ` · ${candidate.topics[0]}` : ''} · {candidate.attemptCount} attempt
        {candidate.attemptCount === 1 ? '' : 's'}
      </p>
    </button>
  );
}
