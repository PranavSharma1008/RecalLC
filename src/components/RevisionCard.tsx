import type { ReactNode } from 'react';
import type { Problem, RevisionRecord } from '../types';
import { formatAttempts, formatDate, formatRelativeTime } from '../utils/date';
import { Badge, DifficultyBadge } from './ui/Badge';

export interface RevisionCardProps {
  problem: Problem;
  revision: RevisionRecord | null;
  dueAt: number | null;
  overdue: boolean;
  daysUntilDue: number | null;
  onRevise?: () => void;
  onSnooze?: () => void;
  onPause?: () => void;
  onDelete?: () => void;
  compact?: boolean;
  /** Extra content rendered under the card actions. */
  extra?: ReactNode;
}

function dueLabel(
  overdue: boolean,
  daysUntilDue: number | null,
): { text: string; tone: 'accent' | 'warning' | 'neutral' } {
  if (daysUntilDue === null) return { text: 'Not scheduled', tone: 'neutral' };
  if (overdue) {
    const days = Math.abs(daysUntilDue);
    return { text: days === 1 ? '1 day overdue' : `${days} days overdue`, tone: 'warning' };
  }
  if (daysUntilDue === 0) return { text: 'Due today', tone: 'accent' };
  if (daysUntilDue === 1) return { text: 'Due tomorrow', tone: 'neutral' };
  return { text: `Due in ${daysUntilDue} days`, tone: 'neutral' };
}

export function RevisionCard({
  problem,
  revision,
  dueAt,
  overdue,
  daysUntilDue,
  onRevise,
  onSnooze,
  onPause,
  onDelete,
  compact = false,
  extra,
}: RevisionCardProps) {
  const due = dueLabel(overdue, daysUntilDue);
  const topic = problem.topics[0];

  return (
    <article className="rlc-card-flat p-3.5 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-fg">{problem.title}</h3>
          <p className="mt-0.5 truncate text-[11px] text-subtle">{problem.slug}</p>
        </div>
        <Badge tone={due.tone}>{due.text}</Badge>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <DifficultyBadge difficulty={problem.difficulty} />
        {topic ? <Badge tone="neutral">{topic}</Badge> : null}
        {revision?.paused ? <Badge tone="neutral">Paused</Badge> : null}
        {problem.attemptCount > 0 ? (
          <span className="text-[11px] text-muted">{formatAttempts(problem.attemptCount)}</span>
        ) : null}
      </div>

      {!compact ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          <div>
            <dt className="text-subtle">Last attempt</dt>
            <dd className="text-muted">{formatRelativeTime(problem.lastAttemptAt)}</dd>
          </div>
          <div>
            <dt className="text-subtle">Next review</dt>
            <dd className="text-muted">{dueAt ? formatDate(dueAt) : '—'}</dd>
          </div>
        </dl>
      ) : null}

      {problem.notes ? (
        <p className="mt-3 line-clamp-2 rounded-md bg-surface-2 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
          {problem.notes}
        </p>
      ) : null}

      {onRevise || onSnooze || onPause || onDelete ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {onRevise ? (
            <button type="button" className="rlc-btn rlc-btn-primary" onClick={onRevise}>
              Revise
            </button>
          ) : null}
          {onSnooze ? (
            <button type="button" className="rlc-btn rlc-btn-secondary" onClick={onSnooze}>
              Tomorrow
            </button>
          ) : null}
          {onPause ? (
            <button type="button" className="rlc-btn rlc-btn-ghost" onClick={onPause}>
              {revision?.paused ? 'Resume' : 'Pause'}
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" className="rlc-btn rlc-btn-ghost" onClick={onDelete}>
              Remove
            </button>
          ) : null}
        </div>
      ) : null}

      {extra ? <div className="mt-3 border-t border-line pt-3">{extra}</div> : null}
    </article>
  );
}
