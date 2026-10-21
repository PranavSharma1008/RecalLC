import { useRef, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/States';
import { useSettings } from '../../hooks/useSettings';
import { callService } from '../../services/messaging';
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
        <CardHeader title="Appearance" subtitle="Dark by default, with a light option." />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {(['dark', 'light', 'system'] as ThemePreference[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => void update({ theme: option })}
                aria-pressed={settings.theme === option}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  settings.theme === option
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 text-muted hover:text-fg'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg">First review</p>
              <p className="text-[11px] text-subtle">How long after a first attempt should a problem become due?</p>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-subtle">
              <input
                type="number"
                min={0}
                max={365}
                className="rlc-input w-20 text-center"
                value={settings.initialIntervalDays}
                onChange={(event) => void update({ initialIntervalDays: Number(event.target.value) })}
                aria-label="Days until the first review"
              />
              days
            </label>
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
        <CardHeader title="Tracking" subtitle="How RecallLC learns what you have solved." />
        <div className="space-y-4 p-4">
          <ToggleRow
            label="Track submissions automatically"
            description="Records an attempt when LeetCode shows a verdict. Opening a problem is never counted as an attempt."
            checked={settings.autoTrackSubmissions}
            onChange={(value) => void update({ autoTrackSubmissions: value })}
          />

          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <ToggleRow
              label="Sync my submission history from LeetCode (opt-in)"
              description="Pulls your own submission list while you are signed in on leetcode.com. RecallLC never asks for your password, never reads or forwards cookies, and nothing leaves your device."
              checked={settings.accountSyncEnabled}
              onChange={(value) => void update({ accountSyncEnabled: value })}
            />
            {settings.accountSyncEnabled ? (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <p className="text-[11px] text-muted">
                  Sync runs from the page you are already on, at most once every six hours. LeetCode paginates this
                  history, so only recent submissions are returned — it is not a complete archive of every attempt you
                  have ever made.
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-[11px] text-subtle">
                    <input
                      type="number"
                      min={10}
                      max={2000}
                      className="rlc-input w-24 text-center"
                      value={settings.accountSyncLimit}
                      onChange={(event) => void update({ accountSyncLimit: Number(event.target.value) })}
                      aria-label="Maximum submissions to sync"
                    />
                    submissions
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void callService('open-problem', { url: 'https://leetcode.com/problemset/' });
                    }}
                  >
                    Open leetcode.com to sync
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFailure(null);
              try {
                const updated = await callService('catalog-legacy-refresh');
                setStatus(`Refreshed metadata for ${updated} tracked problem${updated === 1 ? '' : 's'}.`);
              } catch (cause) {
                setFailure(cause instanceof Error ? cause.message : 'Could not refresh the problem metadata.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Refresh problem metadata
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your data" subtitle="Everything lives in this browser profile." />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void exportBackup()}>
              Export backup
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => restoreRef.current?.click()}>
              Restore backup
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
                    Yes, delete it all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
                  Delete all data
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
