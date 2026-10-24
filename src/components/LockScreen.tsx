import { useEffect, useState } from 'react';

import { Button } from './ui/Button';
import {
  getLockoutRemainingSeconds,
  isLockedOut,
  MAX_FAILED_ATTEMPTS,
  recordFailedAttempt,
  resetFailedAttempts,
  setSessionUnlocked,
  verifyPasscode,
} from '../utils/security';

export interface LockScreenProps {
  passcodeHash?: string | null;
  passcodeSalt?: string | null;
  onUnlock: () => void;
}

export function LockScreen({ passcodeHash, passcodeSalt, onUnlock }: LockScreenProps) {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(getLockoutRemainingSeconds());

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      const remaining = getLockoutRemainingSeconds();
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setError(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  async function handleUnlock(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isLockedOut()) {
      setLockoutRemaining(getLockoutRemainingSeconds());
      return;
    }
    if (!passcode) {
      setError('Please enter your master passcode.');
      return;
    }
    if (!passcodeHash || !passcodeSalt) {
      // Passcode not configured properly, allow unlocking
      setSessionUnlocked(true);
      onUnlock();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const isValid = await verifyPasscode(passcode, passcodeHash, passcodeSalt);
      if (isValid) {
        resetFailedAttempts();
        setSessionUnlocked(true);
        onUnlock();
      } else {
        const failure = recordFailedAttempt();
        if (failure.lockedOut) {
          setLockoutRemaining(failure.remainingSeconds);
          setError(`Too many failed attempts. Locked out for ${failure.remainingSeconds} seconds.`);
        } else {
          const remaining = MAX_FAILED_ATTEMPTS - failure.count;
          setError(`Incorrect passcode. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
        }
      }
    } catch {
      setError('An error occurred during authentication verification.');
    } finally {
      setBusy(false);
    }
  }

  const isBlocked = lockoutRemaining > 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 text-fg">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-2xl backdrop-blur-md">
        {/* Header with App Logo and Lock Icon */}
        <div className="text-center">
          <div className="relative mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent-soft text-accent shadow-inner">
            <img src="/icons/icon48.png" alt="RecallLC" className="h-10 w-10 object-contain drop-shadow" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] text-accent-contrast shadow">
              🔒
            </span>
          </div>

          <h1 className="mt-4 text-xl font-bold tracking-tight text-fg">RecallLC is Locked</h1>
          <p className="mt-1 text-xs text-muted">
            Enter your Master Passcode to unlock your LeetCode revisions, notes & personal schedule.
          </p>
        </div>

        {/* Lockout Warning */}
        {isBlocked ? (
          <div className="mt-5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-center">
            <span className="text-xl">⏳</span>
            <p className="mt-1 text-xs font-semibold text-rose-400">Security Cooldown Active</p>
            <p className="mt-0.5 text-[11px] text-rose-300">
              Too many incorrect attempts. Please wait{' '}
              <span className="font-bold tabular-nums">{lockoutRemaining}s</span> before trying again.
            </p>
          </div>
        ) : null}

        {/* Error message */}
        {error && !isBlocked ? (
          <div className="mt-4 rounded-lg border border-danger/40 bg-danger-soft p-3 text-xs text-danger text-center animate-shake">
            {error}
          </div>
        ) : null}

        {/* Passcode Form */}
        <form onSubmit={handleUnlock} className="mt-6 space-y-4">
          <div>
            <label htmlFor="master-passcode" className="block text-xs font-medium text-muted">
              Master Passcode / Password
            </label>
            <div className="relative mt-1">
              <input
                id="master-passcode"
                type={showPassword ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                disabled={isBlocked || busy}
                autoFocus
                placeholder="Enter passcode…"
                className="rlc-input w-full pr-10 text-sm tracking-widest font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-fg text-xs cursor-pointer"
                title={showPassword ? 'Hide passcode' : 'Show passcode'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isBlocked || busy || !passcode}
            className="w-full justify-center text-sm py-2.5 font-semibold"
          >
            {busy ? 'Verifying…' : '🔓 Unlock Dashboard'}
          </Button>
        </form>

        {/* Security badge and info */}
        <div className="mt-6 border-t border-line pt-4 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] text-subtle">
            <span className="text-emerald-500">🛡️</span>
            <span>Local Cryptographic Lock (Salted SHA-256)</span>
          </div>
          <p className="mt-2 text-[10px] text-subtle">
            RecallLC is local-first. Your passcode and data are never sent to external servers.
          </p>
        </div>
      </div>
    </div>
  );
}
