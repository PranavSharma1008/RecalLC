import { lazy, Suspense, useEffect, useMemo, useState } from 'react';

import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useHashRoute } from '../hooks/useHashRoute';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { callService } from '../services/messaging';
import { ImportScreen } from './screens/ImportScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { ProblemsScreen } from './screens/ProblemsScreen';
import { RecallScreen } from './screens/RecallScreen';
import { RemindersScreen } from './screens/RemindersScreen';
import { SettingsScreen } from './screens/SettingsScreen';

/**
 * The development-only tools panel. The `import.meta.env.DEV` guard is
 * replaced at build time, so the dynamic import — and the demo dataset it
 * pulls in — are removed from production builds entirely.
 */
const DevPanel = import.meta.env.DEV
  ? lazy(() => import('../dev/DevPanel').then((module) => ({ default: module.DevPanel })))
  : null;

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/reminders', label: 'Reminders', icon: '🔔' },
  { path: '/problems', label: 'Problems', icon: '📝' },
  { path: '/import', label: 'Import', icon: '📥' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Dashboard() {
  const [route, navigate] = useHashRoute();
  const { settings, update } = useSettings();
  const { resolved, theme } = useTheme(settings?.theme);
  const [dueCount, setDueCount] = useState(0);

  const stats = useAsync(() => callService('stats'), []);

  useEffect(() => {
    void callService('list-due')
      .then((due) => setDueCount(due.length))
      .catch(() => setDueCount(0));
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => {});
    }
  }, [route.path]);

  const dueBadge = useMemo(() => {
    const value = stats.data?.dueToday ?? 0;
    const overdue = stats.data?.overdue ?? 0;
    return value + overdue;
  }, [stats.data]);

  const isOnboarding = route.path === '/onboarding';

  if (settings === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-fg">
        <Spinner label="Loading RecallLC…" />
      </div>
    );
  }

  const screen = renderScreen(route.segments, navigate, refreshStats);

  function refreshStats(): void {
    stats.reload();
    void callService('list-due')
      .then((due) => setDueCount(due.length))
      .catch(() => setDueCount(0));
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-left">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-contrast"
            >
              R
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">RecallLC</span>
              <span className="hidden text-[11px] text-subtle sm:block">Solve it. Remember it. Master it.</span>
            </span>
          </button>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const active = route.path === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                  {(item.path === '/reminders' || item.path === '/') && dueBadge > 0 ? (
                    <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-contrast">
                      {dueBadge}
                    </span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => void update({ theme: resolved === 'dark' ? 'light' : 'dark' })}
              aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
              className="ml-1 rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {resolved === 'dark' ? '☀' : '☾'}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {DevPanel ? (
          <div className="mb-4">
            <Suspense fallback={null}>
              <DevPanel onChanged={refreshStats} />
            </Suspense>
          </div>
        ) : null}
        {isOnboarding ? <OnboardingScreen navigate={navigate} onDone={refreshStats} /> : screen}
      </main>

      <footer className="border-t border-line px-4 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 text-[11px] text-subtle">
          <span>RecallLC · local-first · no telemetry, no accounts, no cloud.</span>
          <span>
            {dueCount > 0 ? `${dueCount} problem${dueCount === 1 ? '' : 's'} due` : 'Nothing due'} · theme: {theme}
          </span>
        </div>
      </footer>
    </div>
  );
}

type Navigate = (path: string) => void;

function renderScreen(segments: string[], navigate: Navigate, refresh: () => void) {
  const [first, second] = segments;

  switch (first) {
    case undefined:
      return <OverviewScreen navigate={navigate} onChanged={refresh} />;
    case 'reminders':
      return <RemindersScreen navigate={navigate} onChanged={refresh} />;
    case 'problems':
      return <ProblemsScreen navigate={navigate} onChanged={refresh} />;
    case 'recall':
      return <RecallScreen slug={second ?? ''} navigate={navigate} onChanged={refresh} />;
    case 'import':
      return <ImportScreen onChanged={refresh} />;
    case 'settings':
      return <SettingsScreen onChanged={refresh} />;
    default:
      return (
        <div className="rlc-card p-8 text-center">
          <p className="text-sm font-semibold">Page not found</p>
          <p className="mt-1 text-xs text-muted">That screen does not exist.</p>
          <div className="mt-4 flex justify-center">
            <Button variant="primary" size="sm" onClick={() => navigate('/')}>
              Back to overview
            </Button>
          </div>
        </div>
      );
  }
}
