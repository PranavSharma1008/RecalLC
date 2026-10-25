import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/States';
import { useSettings } from '../../hooks/useSettings';
import { applyTheme, resolveTheme } from '../../hooks/useTheme';
import { callService } from '../../services/messaging';
import { generateSalt, hashPasscode, setSessionUnlocked, verifyPasscode } from '../../utils/security';
import {
  RATING_HINTS,
  RATING_LABELS,
  RECALL_RATINGS,
  type BackupFile,
  type RecallRating,
  type ThemePreference,
} from '../../types';

export interface SettingsScreenProps {
  onChanged: () => void;
}

export function SettingsScreen({ onChanged }: SettingsScreenProps) {
  const { settings, loading, error, update } = useSettings();
  const [status, setStatus] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const restoreRef = useRef<HTMLInputElement | null>(null);

  // Security state
  const [showSecuritySetup, setShowSecuritySetup] = useState(false);
  const [securityMode, setSecurityMode] = useState<'enable' | 'change' | 'disable'>('enable');
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => {
      setStatus(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!failure) return;
    const timer = setTimeout(() => {
      setFailure(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [failure]);

  if (loading || !settings) {
    return <p className="text-xs text-muted">Loading settings…</p>;
  }

  async function setInterval_(rating: RecallRating, days: number): Promise<void> {
    if (!Number.isFinite(days) || days < 0) return;
    await update({ intervals: { ...settings!.intervals, [rating]: Math.floor(days) } });
    onChanged();
  }

  async function exportBackup(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      const backup = await callService('export');
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `recalllc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('Backup downloaded.');
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Could not export your data.');
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup(file: File): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      const outcome = await callService('restore', { backup: parsed });
      setStatus(`Restored ${outcome.problems} problems and ${outcome.attempts} attempts.`);
      onChanged();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Could not restore that backup.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSecurity(e: React.FormEvent) {
    e.preventDefault();
    setSecurityError(null);

    // If changing or disabling, verify current passcode
    if (securityMode === 'change' || securityMode === 'disable') {
      if (!currentPasscode) {
        setSecurityError('Please enter your current passcode.');
        return;
      }
      const isCurrentValid = await verifyPasscode(
        currentPasscode,
        settings!.securityPasscodeHash || '',
        settings!.securityPasscodeSalt || '',
      );
      if (!isCurrentValid) {
        setSecurityError('Current passcode is incorrect.');
        return;
      }
    }

    if (securityMode === 'disable') {
      setSecurityBusy(true);
      try {
        await update({
          securityAuthEnabled: false,
          securityPasscodeHash: null,
          securityPasscodeSalt: null,
        });
        setStatus('Master Passcode disabled.');
        setShowSecuritySetup(false);
        setCurrentPasscode('');
        onChanged();
      } finally {
        setSecurityBusy(false);
      }
      return;
    }

    // Enable or Change
    if (!newPasscode || newPasscode.length < 4) {
      setSecurityError('Passcode must be at least 4 characters long.');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setSecurityError('Passcodes do not match.');
      return;
    }

    setSecurityBusy(true);
    try {
      const salt = generateSalt();
      const hash = await hashPasscode(newPasscode, salt);
      await update({
        securityAuthEnabled: true,
        securityPasscodeHash: hash,
        securityPasscodeSalt: salt,
        securityLastUnlockedAt: Date.now(),
      });
      setSessionUnlocked(true);
      setStatus(securityMode === 'change' ? 'Passcode updated successfully.' : 'Master Passcode protection enabled!');
      setShowSecuritySetup(false);
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      onChanged();
    } catch {
      setSecurityError('Failed to save security settings.');
    } finally {
      setSecurityBusy(false);
    }
  }

  function handleLockDashboardNow() {
    setSessionUnlocked(false);
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {error ? <ErrorState message={error} /> : null}
      {failure ? <ErrorState message={failure} /> : null}
      {status ? (
        <div className="rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-[11px] text-success">
          {status}
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Appearance"
          subtitle="Customize interface theme (Dark, Light, or follow your OS system mode)."
        />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['dark', 'light', 'system'] as ThemePreference[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={async () => {
                  applyTheme(option);
                  await update({ theme: option });
                  onChanged();
                }}
                aria-pressed={settings.theme === option}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  settings.theme === option
                    ? 'border-accent bg-accent-soft text-accent shadow-sm'
                    : 'border-line bg-surface-2 text-muted hover:border-line-strong hover:text-fg'
                }`}
              >
                {option === 'dark' ? 'Dark ☾' : option === 'light' ? 'Light ☀' : 'System ⚙'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-subtle">
            Active mode:{' '}
            <span className="font-semibold text-fg">
              {resolveTheme(settings.theme) === 'dark' ? 'Dark mode ☾' : 'Light mode ☀'}
            </span>
            {settings.theme === 'system' ? ' (matching your operating system)' : ''}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Revision schedule"
          subtitle="How long until a problem comes back, based on how well you recalled it."
        />
        <div className="space-y-3 p-4">
          {RECALL_RATINGS.map((rating) => (
            <div key={rating} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-fg">{RATING_LABELS[rating]}</p>
                <p className="text-[11px] text-subtle">{RATING_HINTS[rating]}</p>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-subtle">
                <input
                  type="number"
                  min={0}
                  max={365}
                  className="rlc-input w-20 text-center"
                  value={settings.intervals[rating]}
                  onChange={(event) => void setInterval_(rating, Number(event.target.value))}
                  aria-label={`Days until the next ${RATING_LABELS[rating]} review`}
                />
                days
              </label>
            </div>
          ))}

          <div className="space-y-3 border-t border-line pt-3">
            <div>
              <p className="text-xs font-medium text-fg">First review schedule</p>
              <p className="text-[11px] text-subtle">When should a newly solved question have its first revision?</p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer rounded-md p-2 hover:bg-surface-2 transition-colors">
                <input
                  type="radio"
                  name="scheduleMode"
                  className="mt-0.5 text-accent"
                  checked={settings.initialScheduleMode === 'weekly_sunday'}
                  onChange={() => void update({ initialScheduleMode: 'weekly_sunday' })}
                />
                <div>
                  <p className="font-medium text-fg">🗓️ Weekly Sunday Revision (Recommended)</p>
                  <p className="text-[11px] text-subtle mt-0.5">
                    Solve questions Mon–Sat, Sunday is dedicated revision day.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer rounded-md p-2 hover:bg-surface-2 transition-colors">
                <input
                  type="radio"
                  name="scheduleMode"
                  className="mt-0.5 text-accent"
                  checked={settings.initialScheduleMode === 'fixed_days'}
                  onChange={() => void update({ initialScheduleMode: 'fixed_days' })}
                />
                <div className="flex-1">
                  <p className="font-medium text-fg">⏳ Fixed interval</p>
                  <p className="text-[11px] text-subtle mt-0.5">
                    Every question becomes due a set number of days after you solve it. Individual problem schedules
                    manually set take priority over global defaults.
                  </p>
                  {settings.initialScheduleMode === 'fixed_days' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        className="rlc-input w-20 text-center text-xs py-1"
                        value={settings.initialIntervalDays}
                        onChange={(event) => void update({ initialIntervalDays: Number(event.target.value) })}
                        aria-label="Days until the first review"
                      />
                      <span className="text-[11px] text-subtle">days after solving</span>
                    </div>
                  ) : null}
                </div>
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Reminders" subtitle="The card that appears on a LeetCode problem page." />
        <div className="space-y-4 p-4">
          <ToggleRow
            label="Show reminders"
            description="Turn this off and RecallLC will never interrupt a problem page."
            checked={settings.remindersEnabled}
            onChange={(value) => void update({ remindersEnabled: value })}
          />
          <ToggleRow
            label="Show the topic in the reminder"
            description="Displays the problem's main topic tag next to its title."
            checked={settings.showTopicInReminder}
            onChange={(value) => void update({ showTopicInReminder: value })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg">Delay before showing</p>
              <p className="text-[11px] text-subtle">Lets the page settle before the card appears.</p>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-subtle">
              <input
                type="number"
                min={0}
                max={30000}
                step={250}
                className="rlc-input w-24 text-center"
                value={settings.reminderDelayMs}
                onChange={(event) => void update({ reminderDelayMs: Number(event.target.value) })}
                aria-label="Reminder delay in milliseconds"
              />
              ms
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg">Maximum reminders per session</p>
              <p className="text-[11px] text-subtle">Prevents the extension from becoming noisy.</p>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-subtle">
              <input
                type="number"
                min={0}
                max={50}
                className="rlc-input w-20 text-center"
                value={settings.maxRemindersPerSession}
                onChange={(event) => void update({ maxRemindersPerSession: Number(event.target.value) })}
                aria-label="Maximum reminders per session"
              />
              cards
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Security & Authentication"
          subtitle="Cryptographically lock your dashboard and LeetCode notes so no one else can view or tamper with them."
        />
        <div className="space-y-4 p-4">
          {/* Status Banner */}
          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${
              settings.securityAuthEnabled ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-line bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{settings.securityAuthEnabled ? '🔒' : '🔓'}</span>
              <div>
                <p className="text-xs font-semibold text-fg">
                  {settings.securityAuthEnabled
                    ? 'Master Passcode Protection: Active'
                    : 'Master Passcode Protection: Disabled'}
                </p>
                <p className="text-[11px] text-muted">
                  {settings.securityAuthEnabled
                    ? 'Your personal notes and revision queue require authentication to unlock.'
                    : 'Anyone with access to this browser can view your revision notes and questions.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {settings.securityAuthEnabled ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSecurityMode('change');
                      setCurrentPasscode('');
                      setNewPasscode('');
                      setConfirmPasscode('');
                      setSecurityError(null);
                      setShowSecuritySetup(true);
                    }}
                  >
                    Change Passcode
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSecurityMode('disable');
                      setCurrentPasscode('');
                      setSecurityError(null);
                      setShowSecuritySetup(true);
                    }}
                    className="text-danger hover:text-danger"
                  >
                    Turn Off
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleLockDashboardNow}>
                    🔒 Lock Now
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSecurityMode('enable');
                    setCurrentPasscode('');
                    setNewPasscode('');
                    setConfirmPasscode('');
                    setSecurityError(null);
                    setShowSecuritySetup(true);
                  }}
                >
                  🛡️ Set Master Passcode
                </Button>
              )}
            </div>
          </div>

          {/* Setup / Change Passcode Inline Box */}
          {showSecuritySetup && (
            <form
              onSubmit={handleSaveSecurity}
              className="rounded-xl border border-accent/40 bg-surface-2 p-4 space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-line pb-2">
                <p className="text-xs font-bold text-fg">
                  {securityMode === 'enable'
                    ? 'Set Up Master Passcode'
                    : securityMode === 'change'
                      ? 'Change Master Passcode'
                      : 'Disable Master Passcode Protection'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowSecuritySetup(false)}
                  className="text-xs text-muted hover:text-fg cursor-pointer"
                >
                  ✕ Cancel
                </button>
              </div>

              {securityError && (
                <div className="rounded-lg border border-danger/40 bg-danger-soft p-2.5 text-xs text-danger">
                  {securityError}
                </div>
              )}

              {(securityMode === 'change' || securityMode === 'disable') && (
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Current Passcode</label>
                  <input
                    type="password"
                    value={currentPasscode}
                    onChange={(e) => setCurrentPasscode(e.target.value)}
                    placeholder="Enter current passcode…"
                    className="rlc-input w-full text-xs font-mono"
                    autoFocus
                  />
                </div>
              )}

              {securityMode !== 'disable' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">New Passcode (min 4 characters)</label>
                    <input
                      type="password"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      placeholder="Enter new passcode…"
                      className="rlc-input w-full text-xs font-mono"
                      autoFocus={securityMode === 'enable'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Confirm New Passcode</label>
                    <input
                      type="password"
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value)}
                      placeholder="Re-enter new passcode…"
                      className="rlc-input w-full text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecuritySetup(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={securityMode === 'disable' ? 'danger' : 'primary'}
                  size="sm"
                  disabled={securityBusy}
                >
                  {securityBusy ? 'Saving…' : securityMode === 'disable' ? 'Confirm Disable' : 'Save Passcode'}
                </Button>
              </div>
            </form>
          )}

          {/* Auto-Lock Inactivity Timeout */}
          {settings.securityAuthEnabled && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <div>
                <p className="text-xs font-medium text-fg">Auto-Lock Inactivity Timeout</p>
                <p className="text-[11px] text-subtle">
                  Automatically lock the dashboard when no mouse or keyboard activity is detected.
                </p>
              </div>
              <select
                value={settings.securityAutoLockMinutes ?? 15}
                onChange={(e) => void update({ securityAutoLockMinutes: Number(e.target.value) })}
                className="rlc-input text-xs cursor-pointer"
              >
                <option value={0}>Immediately when tab closes</option>
                <option value={5}>After 5 minutes of inactivity</option>
                <option value={15}>After 15 minutes of inactivity (Recommended)</option>
                <option value={30}>After 30 minutes of inactivity</option>
                <option value={60}>After 1 hour of inactivity</option>
                <option value={-1}>Never (Manual lock only)</option>
              </select>
            </div>
          )}

          {/* Anti-Hacking & Security Health Audit */}
          <div className="border-t border-line pt-3">
            <p className="text-xs font-semibold text-fg mb-2">Anti-Hacking & System Integrity Shield</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted">
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 border border-line">
                <span className="text-emerald-500">✓</span>
                <span>
                  <strong className="text-fg">Cryptographic Hashing:</strong> Salted SHA-256 Web Crypto
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 border border-line">
                <span className="text-emerald-500">✓</span>
                <span>
                  <strong className="text-fg">Anti-Brute Force:</strong> 5 max attempts with timed lockout
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 border border-line">
                <span className="text-emerald-500">✓</span>
                <span>
                  <strong className="text-fg">XSS & Script Injection Shield:</strong> Strict input sanitization
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 border border-line">
                <span className="text-emerald-500">✓</span>
                <span>
                  <strong className="text-fg">Zero Remote Sync:</strong> 100% offline & local data isolation
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your data" subtitle="Everything lives in this browser profile." />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void exportBackup()}>
              💾 Export backup
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => restoreRef.current?.click()}>
              📥 Restore backup
            </Button>
            <input
              ref={restoreRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restoreBackup(file);
                event.target.value = '';
              }}
            />
          </div>

          <div className="rounded-lg border border-danger/40 bg-danger-soft p-3">
            <p className="text-xs font-medium text-danger">Delete everything</p>
            <p className="mt-1 text-[11px] text-muted">
              Removes every tracked problem, attempt and review from this device. Your settings are kept.
            </p>
            <div className="mt-2">
              {confirmClear ? (
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await callService('clear-all');
                        setStatus('All RecallLC data was deleted.');
                        setConfirmClear(false);
                        onChanged();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    ⚠️ Yes, delete it all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                    ✕ Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
                  🗑️ Delete all data
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Privacy & permissions" subtitle="What RecallLC asks for, and why." />
        <div className="space-y-2 p-4 text-[11px] leading-relaxed text-muted">
          <p>
            <strong className="text-fg">storage</strong> — remembers your settings and revision schedule on this device.
          </p>
          <p>
            <strong className="text-fg">leetcode.com</strong> — lets the extension read the problem page you are already
            on, and (only if you opt in) fetch the public problem catalogue. It cannot read any other site.
          </p>
          <p>
            RecallLC contains no analytics, no telemetry and no remote code. It never asks for your LeetCode password,
            never reads or forwards your session cookies, and never sends your revision history anywhere.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Developer & Support" subtitle="About the creator and ways to support development." />
        <div className="space-y-3 p-4 text-xs text-muted">
          <div className="flex items-center justify-between">
            <span className="font-medium text-fg">Developer</span>
            <span className="font-semibold text-fg">Pranav Sharma</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-fg">Email</span>
            <a href="mailto:pranav2410991479@gmail.com" className="text-accent hover:underline">
              pranav2410991479@gmail.com
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-fg">LinkedIn</span>
            <a
              href="https://www.linkedin.com/in/pranavsharma1008/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline flex items-center gap-1"
            >
              linkedin.com/in/pranavsharma1008 ↗
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-fg">Support / Donate</span>
            <a
              href="https://razorpay.me/@recallc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline flex items-center gap-1"
            >
              razorpay.me/@recallc ↗
            </a>
          </div>
          <div className="pt-2 border-t border-line flex items-center justify-between">
            <span>Free & Open Source</span>
            <a
              href="#/support"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast hover:bg-accent-hover transition-colors"
            >
              💖 Support & Donate
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-fg">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-subtle">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-surface-3 transition-colors peer-checked:bg-accent" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
