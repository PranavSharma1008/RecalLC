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
          {/* Section 1: How to Push Problems */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-purple-300 font-semibold text-sm">
              <span>🚀</span>
              <span>1. How to Push Problems (Manual Rocket Push)</span>
            </div>
            <p className="text-purple-200/90">
              RecallLC gives you 100% manual control over your problem revision schedule. Sample test cases or random page visits will <strong className="text-white">never</strong> push problems automatically.
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-purple-200/80">
              <li>Open any problem page on <strong className="text-white">LeetCode</strong> or <strong className="text-white">GeeksforGeeks</strong>.</li>
              <li>Write and submit your solution.</li>
              <li>
                Look at the top navigation bar next to Problem List / Random question: you will see the{' '}
                <strong className="text-white">🚀 Rocket button</strong>.
              </li>
              <li>
                <strong className="text-white">Click the 🚀 Rocket button!</strong> A flying rocket animation will soar across your screen.
              </li>
              <li>
                RecallLC saves the problem title, difficulty, URL, and verified solution code into your revision database, and the button turns to green <strong className="text-emerald-400">✓ Added</strong>.
              </li>
            </ol>
          </div>

          {/* Section 2: Spaced Repetition Revision */}
          <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-2">
            <div className="flex items-center gap-2 text-fg font-semibold text-sm">
              <span>🗓️</span>
              <span>2. Spaced Repetition Revision System</span>
            </div>
            <p className="text-subtle">
              RecallLC is designed so you never forget what you learned:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-subtle">
              <li>
                <strong className="text-fg">Weekly Dedicated Revision Day:</strong> By default, questions solved during the week are scheduled for review on Sunday. You can change this to any day of the week or set a custom interval in <strong className="text-fg">Settings</strong>.
              </li>
              <li>
                <strong className="text-fg">In-Page Reminders:</strong> When you browse LeetCode/GFG and a revision is due, RecallLC gracefully presents a reminder card with solution notes.
              </li>
              <li>
                <strong className="text-fg">Recall Rating:</strong> Rate your recall with Forgot (1d), Hard (2d), Good (5d), or Easy (14d) to space out future intervals automatically.
              </li>
            </ul>
          </div>

          {/* Section 3: Data Transfer / Cross-Device Sync */}
          <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-2">
            <div className="flex items-center gap-2 text-fg font-semibold text-sm">
              <span>📦</span>
              <span>3. How to Sync to Another Device or Browser</span>
            </div>
            <p className="text-subtle">
              Easily move your entire revision history, solution notes, and schedules to any computer or browser:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-subtle">
              <li>
                Go to the <strong className="text-fg">Import</strong> tab in this dashboard.
              </li>
              <li>
                Click <strong className="text-fg">📦 Download Complete Backup (JSON)</strong> to save your backup file.
              </li>
              <li>
                Open RecallLC on your other device/browser, navigate to the <strong className="text-fg">Import</strong> tab, and drop the downloaded file.
              </li>
              <li>
                Click <strong className="text-fg">🚀 Restore All Data & Schedules</strong>. All problems, solution code, and revision schedules are restored 1:1!
              </li>
            </ol>
          </div>

          {/* Section 4: Security & Master Passcode */}
          <div className="rounded-xl border border-line bg-surface-2 p-4 space-y-2">
            <div className="flex items-center gap-2 text-fg font-semibold text-sm">
              <span>🔒</span>
              <span>4. Master Passcode & 100% Offline Privacy</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-subtle">
              <li>
                <strong className="text-fg">Zero Cloud Storage:</strong> All data is stored 100% offline in your browser&apos;s local IndexedDB. No passwords or tokens are ever collected.
              </li>
              <li>
                <strong className="text-fg">Master Passcode:</strong> You can enable passcode protection in Settings with any length (even 1 character or number).
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
