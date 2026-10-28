import { useEffect } from 'react';
import { Button } from './ui/Button';

export interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="rlc-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-accent/40 bg-surface/95 space-y-5 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📖</span>
            <div>
              <h2 className="text-base font-bold text-fg">RecallLC User Manual & Guide</h2>
              <p className="text-xs text-subtle">How to solve, push, and master spaced repetition on LeetCode & GFG.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg text-lg leading-none cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content sections */}
        <div className="space-y-4 text-xs leading-relaxed text-muted">
          {/* YouTube Video Walkthrough Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300/60 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-3.5">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 fill-current text-red-600 dark:text-red-500 shrink-0" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <div>
                <p className="font-semibold text-fg">Watch Complete Video Walkthrough</p>
                <p className="text-[11px] text-muted">See how to solve, push, and revise with RecallLC on YouTube</p>
              </div>
            </div>
            <a
              href="https://youtu.be/K-BiR7K2tPo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 px-3.5 py-1.5 font-semibold text-white transition-colors cursor-pointer text-xs shrink-0 shadow-sm"
            >
              <span>▶ Watch on YouTube</span>
            </a>
          </div>

          {/* Section 1: How to Push Problems */}
          <div className="rounded-xl border border-purple-300 dark:border-purple-500/30 bg-purple-50/80 dark:bg-purple-500/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-semibold text-sm">
              <span>🚀</span>
              <span>1. How to Push Problems (Manual Rocket Push)</span>
            </div>
            <p className="text-purple-950 dark:text-purple-200/90 leading-relaxed">
              RecallLC gives you 100% manual control over your problem revision schedule. Sample test cases or random page visits will <strong className="text-purple-950 dark:text-white font-semibold">never</strong> push problems automatically.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-purple-900 dark:text-purple-200/80">
              <li>Open any problem page on <strong className="text-purple-950 dark:text-white font-semibold">LeetCode</strong> or <strong className="text-purple-950 dark:text-white font-semibold">GeeksforGeeks</strong>.</li>
              <li>Write and submit your solution.</li>
              <li>
                Look at the top navigation bar next to Problem List / Random question: you will see the{' '}
                <strong className="text-purple-950 dark:text-white font-semibold">🚀 Rocket button</strong>.
              </li>
              <li>
                <strong className="text-purple-950 dark:text-white font-semibold">Click the 🚀 Rocket button!</strong> A flying rocket animation will soar across your screen.
              </li>
              <li>
                RecallLC saves the problem title, difficulty, URL, and verified solution code into your revision database, and the button turns to green <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ Added</strong>.
              </li>
            </ol>
          </div>

          {/* Section 2: Spaced Repetition Revision */}
          <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-2">
            <div className="flex items-center gap-2 text-fg font-semibold text-sm">
              <span>🗓️</span>
              <span>2. Spaced Repetition Revision System</span>
            </div>
            <p className="text-fg/80 dark:text-subtle">
              RecallLC is designed so you never forget what you learned:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-fg/80 dark:text-subtle">
              <li>
                <strong className="text-fg font-semibold">Weekly Dedicated Revision Day:</strong> By default, questions solved during the week are scheduled for review on Sunday. You can change this to any day of the week or set a custom interval in <strong className="text-fg font-semibold">Settings</strong>.
              </li>
              <li>
                <strong className="text-fg font-semibold">In-Page Reminders:</strong> When you browse LeetCode/GFG and a revision is due, RecallLC gracefully presents a reminder card with solution notes.
              </li>
              <li>
                <strong className="text-fg font-semibold">Recall Rating:</strong> Rate your recall with Forgot (1d), Hard (2d), Good (5d), or Easy (14d) to space out future intervals automatically.
              </li>
            </ul>
          </div>

          {/* Section 3: Data Transfer / Cross-Device Sync */}
          <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-2">
            <div className="flex items-center gap-2 text-fg font-semibold text-sm">
              <span>📦</span>
              <span>3. How to Sync to Another Device or Browser</span>
            </div>
            <p className="text-fg/80 dark:text-subtle">
              Easily move your entire revision history, solution notes, and schedules to any computer or browser:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-fg/80 dark:text-subtle">
              <li>
                Go to the <strong className="text-fg font-semibold">Import</strong> tab in this dashboard.
              </li>
              <li>
                Click <strong className="text-fg font-semibold">📦 Download Complete Backup (JSON)</strong> to save your backup file.
              </li>
              <li>
                Open RecallLC on your other device/browser, navigate to the <strong className="text-fg font-semibold">Import</strong> tab, and drop the downloaded file.
              </li>
              <li>
                Click <strong className="text-fg font-semibold">🚀 Restore All Data & Schedules</strong>. All problems, solution code, and revision schedules are restored 1:1!
              </li>
            </ol>
          </div>

          {/* Section 4: Security & Master Passcode */}
          <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-2">
            <div className="flex items-center gap-2 text-fg font-semibold text-sm">
              <span>🔒</span>
              <span>4. Master Passcode & 100% Offline Privacy</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-fg/80 dark:text-subtle">
              <li>
                <strong className="text-fg font-semibold">Zero Cloud Storage:</strong> All data is stored 100% offline in your browser&apos;s local IndexedDB. No passwords or tokens are ever collected.
              </li>
              <li>
                <strong className="text-fg font-semibold">Master Passcode:</strong> You can enable passcode protection in Settings with any length (even 1 character or number).
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-[11px] text-subtle">Crafted by Pranav Sharma · RecallLC v1.0.3</span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Got it, close guide
          </Button>
        </div>
      </div>
    </div>
  );
}
