import { useEffect, useRef } from 'react';

import type { ReminderCandidate } from '../types';
import { formatAttempts, formatRelativeTime } from '../utils/date';
import { DifficultyBadge } from './ui/Badge';

export interface RevisionReminderProps {
  candidate: ReminderCandidate;
  /** How many other problems are still due. */
  remainingDue: number;
  showTopic: boolean;
  onRevise: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  onOpenDashboard: () => void;
}

/**
 * The in-page revision reminder.
 *
 * Deliberately small and non-intrusive: one card, bottom-right, with the
 * three actions the product spec calls for.
 */
export function RevisionReminder({
  candidate,
  remainingDue,
  showTopic,
  onRevise,
  onSnooze,
  onDismiss,
  onOpenDashboard,
}: RevisionReminderProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  const topic = showTopic && candidate.topics.length > 0 ? candidate.topics[0] : null;
  const extraTopics = showTopic && candidate.topics.length > 1 ? candidate.topics.length - 1 : 0;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label="RecallLC revision reminder"
      tabIndex={-1}
      className="rlc-reminder rlc-reminder-toast"
    >
      <div className="rlc-reminder-header">
        <span aria-hidden="true" className="text-[13px] leading-none">
          ↻
        </span>
        <span className="rlc-reminder-title">Time to revise!</span>
        {candidate.overdue ? (
          <span className="rlc-badge rlc-badge-medium">
            {candidate.overdueDays === 1 ? 'Overdue - 1 day' : `Overdue - ${candidate.overdueDays} days`}
          </span>
        ) : (
          <span className="rlc-badge rlc-badge-neutral">Due today</span>
        )}
      </div>

      <div className="rlc-reminder-body">
        <p className="rlc-reminder-problem">{candidate.title}</p>
        <div className="rlc-reminder-meta">
          <DifficultyBadge difficulty={candidate.difficulty} />
          {topic ? (
            <span className="rlc-badge rlc-badge-neutral">
              {topic}
              {extraTopics > 0 ? ` +${extraTopics}` : ''}
            </span>
          ) : null}
          <span>Last attempted: {formatRelativeTime(candidate.lastAttemptAt)}</span>
          {candidate.attemptCount > 0 ? <span>· {formatAttempts(candidate.attemptCount)}</span> : null}
        </div>
      </div>

      <div className="rlc-reminder-actions">
        <button type="button" className="rlc-btn rlc-btn-primary" onClick={onRevise} autoFocus>
          Revise Now
        </button>
        <button type="button" className="rlc-btn rlc-btn-secondary" onClick={onSnooze}>
          Remind Tomorrow
        </button>
        <button type="button" className="rlc-btn rlc-btn-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>

      {remainingDue > 0 ? (
        <div className="rlc-reminder-more">
          <button
            type="button"
            onClick={onOpenDashboard}
            style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
            className="underline underline-offset-2"
          >
            {remainingDue} more {remainingDue === 1 ? 'problem is' : 'problems are'} due
          </button>
        </div>
      ) : null}
    </div>
  );
}
