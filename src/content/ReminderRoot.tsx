import { useCallback, useEffect, useRef, useState } from 'react';

import { RevisionReminder } from '../components/RevisionReminder';
import { callService } from '../services/messaging';
import { readSettings } from '../services/storage';
import type { ReminderPayload } from '../types';

export interface ReminderRootProps {
  /** Slug of the problem currently open, or `null` off a problem page. */
  currentSlug: string | null;
}

/**
 * The React island that renders the in-page reminder.
 *
 * Only mounted for in-page revision reminders when an older problem is due.
 */
export function ReminderRoot({ currentSlug }: ReminderRootProps) {
  const [payload, setPayload] = useState<ReminderPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const shownCount = useRef(0);
  const dismissedFor = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const settings = await readSettings();
      if (!settings.remindersEnabled) {
        setPayload(null);
        setVisible(false);
        return;
      }
      const result = await callService('get-reminder', { currentSlug });
      setPayload(result);
      if (!result.candidate) {
        setVisible(false);
        return;
      }
      if (dismissedFor.current.has(result.candidate.slug)) {
        setVisible(false);
        return;
      }
      if (shownCount.current >= settings.maxRemindersPerSession) {
        setVisible(false);
        return;
      }
      setVisible(true);
      shownCount.current += 1;
    } catch {
      // The reminder is a nicety — never let it break the page.
      setVisible(false);
    }
  }, [currentSlug]);

  useEffect(() => {
    setVisible(false);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    void readSettings().then((settings) => {
      if (cancelled) return;
      timer = setTimeout(
        () => {
          void load();
        },
        Math.max(0, settings.reminderDelayMs),
      );
    });

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [load]);

  const handleRevise = useCallback(() => {
    const candidate = payload?.candidate;
    if (!candidate) return;
    void callService('open-problem', { url: candidate.url });
  }, [payload]);

  const handleSnooze = useCallback(async () => {
    const candidate = payload?.candidate;
    if (!candidate) return;
    await callService('snooze', { slug: candidate.slug });
    setVisible(false);
    void load();
  }, [payload, load]);

  const handleDismiss = useCallback(async () => {
    const candidate = payload?.candidate;
    if (!candidate) return;
    dismissedFor.current.add(candidate.slug);
    await callService('dismiss', { slug: candidate.slug });
    setVisible(false);
    void load();
  }, [payload, load]);

  const handleOpenDashboard = useCallback(() => {
    void callService('open-dashboard', {});
  }, []);

  if (!visible || !payload?.candidate) return null;

  return (
    <div className="rlc-island-stack">
      {/* In-page Revision Reminder: appears when an older problem is due */}
      <RevisionReminder
        candidate={payload.candidate}
        remainingDue={payload.remainingDue}
        showTopic
        onRevise={handleRevise}
        onSnooze={handleSnooze}
        onDismiss={handleDismiss}
        onOpenDashboard={handleOpenDashboard}
      />
    </div>
  );
}
