import { useEffect, useMemo, useState } from 'react';

import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/States';
import { useAsync } from '../hooks/useAsync';
import { useHashRoute } from '../hooks/useHashRoute';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import { callService } from '../services/messaging';
import { LockScreen } from '../components/LockScreen';
import { UserGuideModal } from '../components/UserGuideModal';
import { isSessionExpired, isSessionUnlocked, setSessionUnlocked, touchSessionActivity } from '../utils/security';
import { EnquiryScreen } from './screens/EnquiryScreen';
import { ImportScreen } from './screens/ImportScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { ProblemsScreen } from './screens/ProblemsScreen';
import { RecallScreen } from './screens/RecallScreen';
import { RemindersScreen } from './screens/RemindersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SupportScreen } from './screens/SupportScreen';

/** Direct Gmail compose URL to pranav2410991479@gmail.com */
export const GMAIL_ENQUIRY_URL =
  'https://mail.google.com/mail/?view=cm&fs=1&to=pranav2410991479@gmail.com&su=RecallLC%20Enquiry';

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
  { path: '/support', label: 'Support', icon: '💖' },
];

/**
 * Determines whether a dashboard navigation tab is currently active.
 * Handles hash routes without leading slashes and maps sub-routes like `/recall/*` to Problems.
 */
export function isTabActive(itemPath: string, route: { path: string; segments: string[] }): boolean {
  const target = itemPath.replace(/^\//, '');
  const currentSection = route.segments[0] ?? '';

  if (target === '') {
    return currentSection === '' || currentSection === 'overview';
  }
  if (target === 'problems') {
    return currentSection === 'problems' || currentSection === 'recall';
  }
  return currentSection === target;
}

export function Dashboard() {
  const [route, navigate] = useHashRoute();
  const { settings, update, reload: reloadSettings } = useSettings();
  const { resolved } = useTheme(settings?.theme);
  const [dueCount, setDueCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const stats = useAsync(() => callService('stats'), []);

  // Check initial security lock status when settings load
  useEffect(() => {
    if (!settings?.securityAuthEnabled) {
      setIsLocked(false);
      return;
    }
    const unlocked = isSessionUnlocked() && !isSessionExpired(settings.securityAutoLockMinutes ?? 15);
    setIsLocked(!unlocked);
  }, [settings?.securityAuthEnabled, settings?.securityAutoLockMinutes]);

  // User activity tracker for auto-lock inactivity timer
  useEffect(() => {
    if (!settings?.securityAuthEnabled || isLocked) return;

    const handleActivity = () => {
      touchSessionActivity();
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('click', handleActivity, { passive: true });

    // Periodic check for auto-lock timeout
    const interval = setInterval(() => {
      if (isSessionExpired(settings.securityAutoLockMinutes ?? 15)) {
        setSessionUnlocked(false);
        setIsLocked(true);
      }
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(interval);
    };
  }, [settings?.securityAuthEnabled, settings?.securityAutoLockMinutes, isLocked]);

  function handleManualLock(): void {
    setSessionUnlocked(false);
    setIsLocked(true);
  }

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

  const isOnboarding = route.path === 'onboarding' || route.path === '/onboarding';

  if (settings === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-fg">
        <Spinner label="Loading RecallLC…" />
      </div>
    );
  }

  // Master Lock Screen guard — prevents unauthorized access to all LeetCode data
  if (settings.securityAuthEnabled && isLocked) {
    return (
      <LockScreen
        passcodeHash={settings.securityPasscodeHash}
        passcodeSalt={settings.securityPasscodeSalt}
        onUnlock={() => {
          setIsLocked(false);
          refreshStats();
        }}
      />
    );
  }

  const screen = renderScreen(route.segments, navigate, refreshStats);

  function refreshStats(): void {
    stats.reload();
    void reloadSettings();
    void callService('list-due')
      .then((due) => setDueCount(due.length))
      .catch(() => setDueCount(0));
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <img
              src="/icons/icon48.png"
              alt="RecalLC Logo"
              className="h-7 w-7 rounded-lg object-contain drop-shadow-sm transition-transform group-hover:scale-105"
            />
            <span>
              <span className="block text-sm font-semibold tracking-tight">RecalLC</span>
              <span className="hidden text-[11px] text-subtle sm:block">Solve it. Remember it. Master it.</span>
            </span>
          </button>

          <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
            {NAV_ITEMS.map((item) => {
              const active = isTabActive(item.path, route);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                    active
                      ? 'border border-accent/50 bg-gradient-to-b from-accent/20 via-accent/10 to-accent-soft text-accent font-semibold shadow-[0_0_16px_-2px_rgba(124,92,255,0.35)]'
                      : 'border border-transparent text-muted hover:border-line hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  {/* Subtle top lighting sheen for active tab */}
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-2.5 top-0 h-[1px] bg-gradient-to-r from-transparent via-accent/60 to-transparent"
                    />
                  ) : null}

                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.path === '/reminders' && dueBadge > 0 ? (
                    <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-contrast shadow-sm">
                      {dueBadge}
                    </span>
                  ) : null}

                  {/* Active Lighting & Indicator Bar */}
                  {active ? (
                    <>
                      {/* Ambient lighting glow beneath the bar */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-2 -bottom-0.5 h-3 rounded-full bg-accent/40 blur-[5px]"
                      />
                      {/* Illuminated radiant bar */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-accent shadow-[0_0_10px_var(--rlc-accent),0_0_18px_var(--rlc-accent)]"
                      />
                    </>
                  ) : (
                    /* Subtle hover bar on inactive tabs */
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-accent/30 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    />
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => void update({ theme: resolved === 'dark' ? 'light' : 'dark' })}
              aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`}
              className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-fg shadow-sm transition-all hover:border-accent hover:bg-surface-3 hover:text-accent cursor-pointer"
            >
              <span className="text-sm">{resolved === 'dark' ? '☀' : '☾'}</span>
              <span className="hidden sm:inline">{resolved === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>

            {settings.securityAuthEnabled ? (
              <button
                type="button"
                onClick={handleManualLock}
                title="Lock Dashboard (Passcode Protected)"
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-muted shadow-sm transition-all hover:border-rose-500 hover:text-rose-400 hover:bg-surface-3 cursor-pointer"
              >
                <span>🔒</span>
                <span className="hidden sm:inline">Lock</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              title="Open Manual & Guide"
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/15 px-2.5 py-1.5 text-xs font-semibold text-purple-300 shadow-sm transition-all hover:border-purple-400 hover:bg-purple-500/25 hover:text-white cursor-pointer"
            >
              <span>📖</span>
              <span className="hidden sm:inline">Manual</span>
            </button>

            <a
              href="https://youtu.be/K-BiR7K2tPo"
              target="_blank"
              rel="noopener noreferrer"
              title="Watch RecallLC Video Guide on YouTube"
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-300 shadow-sm transition-all hover:border-red-400 hover:bg-red-500/25 hover:text-white cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current text-red-400 shrink-0" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span className="hidden sm:inline">YouTube</span>
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {isOnboarding ? <OnboardingScreen navigate={navigate} onDone={refreshStats} /> : screen}
      </main>

      <footer className="border-t border-line bg-surface/40 backdrop-blur-sm px-4 py-3.5 transition-colors">
        <div className="mx-auto flex w-full max-w-6xl flex-col sm:flex-row items-center justify-between gap-3 text-xs text-subtle">
          {/* Brand & Creator Attribution */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-fg">
              <img src="/icons/icon16.png" alt="" className="h-4 w-4 rounded object-contain" />
              <span>RecallLC</span>
            </div>
            <span className="text-line-strong">·</span>
            <span className="text-muted">Local-first Spaced Repetition</span>
            <span className="text-line-strong">·</span>
            <span>
              Crafted by{' '}
              <a
                href="https://www.linkedin.com/in/pranavsharma1008/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fg hover:text-accent transition-colors underline-offset-2 hover:underline"
              >
                Pranav Sharma
              </a>
            </span>
          </div>

          {/* Quick Actions & Status Badges */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-[11px]">
            {/* User Manual & Project Guide Button */}
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/15 px-3 py-1 font-semibold text-purple-400 hover:border-purple-400 hover:bg-purple-500/25 hover:text-purple-300 transition-all cursor-pointer shadow-sm"
              title="Open full guide on how to push problems and use RecallLC"
            >
              📖 Manual & Guide
            </button>

            {/* YouTube Video Guide Button */}
            <a
              href="https://youtu.be/K-BiR7K2tPo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 font-semibold text-red-400 hover:border-red-400 hover:bg-red-500/25 hover:text-red-300 transition-all cursor-pointer shadow-sm"
              title="Watch full RecallLC video guide on YouTube"
            >
              <svg className="w-3.5 h-3.5 fill-current text-red-500 shrink-0" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span>YouTube</span>
            </a>

            {/* Direct 1-Click Gmail Enquiry Button */}
            <a
              href={GMAIL_ENQUIRY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 font-medium text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all cursor-pointer"
              title="Open Gmail to send enquiry directly to pranav2410991479@gmail.com"
            >
              ✉️ Enquiry
            </a>

            <button
              type="button"
              onClick={() => navigate('/support')}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-medium text-rose-400 hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all cursor-pointer"
            >
              💖 Support & Donate
            </button>

            <a
              href="https://www.linkedin.com/in/pranavsharma1008/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-medium text-muted hover:border-line-strong hover:text-fg hover:bg-surface-3 transition-all"
            >
              💼 LinkedIn ↗
            </a>

            {/* Master Lock Quick Action */}
            {settings.securityAuthEnabled ? (
              <button
                type="button"
                onClick={handleManualLock}
                title="Lock Dashboard"
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-muted hover:border-rose-500 hover:text-rose-400 hover:bg-surface-3 transition-all cursor-pointer"
              >
                <span>🔒</span>
                <span>Lock</span>
              </button>
            ) : null}

            {/* Revision status pill */}
            <button
              type="button"
              onClick={() => navigate('/reminders')}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-medium transition-all hover:border-accent hover:text-accent cursor-pointer"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  dueCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <span className={dueCount > 0 ? 'text-amber-500 font-semibold' : 'text-muted'}>
                {dueCount > 0 ? `${dueCount} due today` : 'All caught up'}
              </span>
            </button>

            {/* Theme switcher pill */}
            <button
              type="button"
              onClick={() => void update({ theme: resolved === 'dark' ? 'light' : 'dark' })}
              title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-muted hover:border-accent hover:text-fg hover:bg-surface-3 transition-all cursor-pointer"
            >
              <span>{resolved === 'dark' ? '☾' : '☀'}</span>
              <span className="capitalize">{resolved}</span>
            </button>
          </div>
        </div>
      </footer>

      <UserGuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
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
    case 'support':
      return <SupportScreen />;
    case 'enquiry':
      return <EnquiryScreen navigate={navigate} />;
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
