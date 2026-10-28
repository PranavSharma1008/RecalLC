import { type ReactNode } from 'react';
import { getPopularProblem } from '../data/popularProblems';
import type { Problem, RevisionRecord } from '../types';
import { formatAttempts, formatDateWithWeekday, formatRelativeTime, isSunday } from '../utils/date';
import { parseProblemNotes } from '../utils/notes';
import { isGfgSlug, problemUrl } from '../utils/slug';
import { Badge, DifficultyBadge, PlatformBadge } from './ui/Badge';

export interface RevisionCardProps {
  problem: Problem;
  revision: RevisionRecord | null;
  dueAt: number | null;
  overdue: boolean;
  daysUntilDue: number | null;
  overdueDays?: number | null;
  onRevise?: () => void;
  onReschedule?: () => void;
  onDelete?: () => void;
  compact?: boolean;
  /** Attached dropdown content for the Change schedule button. */
  rescheduleContent?: ReactNode;
  /** Extra content rendered under the card actions. */
  extra?: ReactNode;
}

function dueLabel(
  overdue: boolean,
  daysUntilDue: number | null,
  dueAt: number | null,
  overdueDays?: number | null,
): { text: string; tone: 'accent' | 'warning' | 'neutral' } {
  if (dueAt === null) return { text: 'Not scheduled', tone: 'neutral' };
  if (overdue) {
    const rawDays =
      overdueDays != null && overdueDays > 0 ? overdueDays : daysUntilDue !== null ? Math.abs(daysUntilDue) : 1;
    const days = Math.max(1, rawDays);
    return { text: days === 1 ? 'Overdue - 1 day' : `Overdue - ${days} days`, tone: 'warning' };
  }
  if (daysUntilDue === null) return { text: 'Not scheduled', tone: 'neutral' };
  if (daysUntilDue === 0) return { text: 'Due today', tone: 'accent' };
  if (daysUntilDue === 1) return { text: 'Due tomorrow', tone: 'accent' };

  // If scheduled for weekly Sunday revision
  if (isSunday(dueAt) && daysUntilDue <= 7) {
    return { text: `Due Sunday (${daysUntilDue}d)`, tone: 'accent' };
  }

  return { text: `Due in ${daysUntilDue} days`, tone: 'neutral' };
}

export function RevisionCard({
  problem,
  revision,
  dueAt,
  overdue,
  daysUntilDue,
  overdueDays,
  onRevise,
  onReschedule,
  onDelete,
  compact = false,
  rescheduleContent,
  extra,
}: RevisionCardProps) {
  const due = dueLabel(overdue, daysUntilDue, dueAt, overdueDays);
  const popular = getPopularProblem(problem.slug);
  const effectiveDifficulty =
    problem.difficulty !== 'Unknown' ? problem.difficulty : (popular?.difficulty ?? 'Unknown');
  const topic = problem.topics[0] || popular?.topics[0];
  const parsed = parseProblemNotes(problem.notes);
  const isGfg = Boolean((problem.url && problem.url.includes('geeksforgeeks.org')) || isGfgSlug(problem.slug));
  const targetUrl =
    problem.url && problem.url.includes(isGfg ? 'geeksforgeeks.org' : 'leetcode.com')
      ? problem.url
      : problemUrl(problem.slug, isGfg ? 'gfg' : undefined);

  return (
    <article
      className={`rlc-card-flat relative flex w-full flex-col p-3 sm:p-3.5 transition-all duration-200 ease-out ${
        rescheduleContent
          ? 'z-30'
          : 'hover:scale-[1.02] hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-xl hover:shadow-black/20 hover:z-10 z-0'
      }`}
    >
      <div className="flex-1 flex flex-col">
        {/* Header: Title, Link & Due Badge */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div>
              <a
                href={targetUrl}
                target="_blank"
                rel="noreferrer"
                className="group/title inline-flex items-center gap-1.5 max-w-full text-fg transition-all cursor-pointer"
                title={`Open "${problem.title}" on ${isGfg ? 'GeeksforGeeks' : 'LeetCode'} (${effectiveDifficulty} · ${topic || 'General'})`}
              >
                <h3 className="truncate text-[13px] sm:text-sm font-semibold text-fg group-hover/title:text-accent group-hover/title:underline transition-colors underline-offset-2">
                  {problem.title}
                </h3>
                <span className="text-subtle group-hover/title:text-accent group-hover/title:translate-x-0.5 group-hover/title:-translate-y-0.5 transition-all text-xs font-mono shrink-0">
                  ↗
                </span>
              </a>
            </div>
            <p className="mt-0.5 truncate text-[10.5px] text-subtle font-mono">{problem.slug}</p>
          </div>
          <Badge tone={due.tone}>{due.text}</Badge>
        </div>

        {/* Badges & Attempts */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PlatformBadge url={targetUrl} slug={problem.slug} />
          <DifficultyBadge difficulty={effectiveDifficulty} />
          {topic ? <Badge tone="neutral">{topic}</Badge> : null}
          {revision?.paused ? <Badge tone="warning">Paused</Badge> : null}
          {problem.attemptCount > 0 ? (
            <span className="text-[11px] text-muted font-medium">• {formatAttempts(problem.attemptCount)}</span>
          ) : null}
        </div>

        {/* Timing info bar */}
        {!compact ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface-2/80 px-2.5 py-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-subtle">⏱️ Solved:</span>
              <span className="font-medium text-fg">{formatRelativeTime(problem.lastAttemptAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-subtle">🗓️ Revision:</span>
              <span className="font-medium text-fg">{dueAt ? formatDateWithWeekday(dueAt) : '—'}</span>
            </div>
          </div>
        ) : null}

        {/* Handwritten Notes */}
        {parsed.userNotes ? (
          <div className="mt-2 rounded-md border border-line/70 bg-surface-2/60 p-2.5 text-[11px]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">📝 Notes</div>
            <p className="line-clamp-3 text-muted leading-relaxed whitespace-pre-wrap">{parsed.userNotes}</p>
          </div>
        ) : null}

        {/* Recall Checklist */}
        {parsed.checklist.length > 0 ? (
          <details className="mt-2 text-[11px] text-subtle group">
            <summary className="cursor-pointer hover:text-fg font-medium flex items-center gap-1">
              <span>📋 Recall Checklist ({parsed.checklist.length} prompts)</span>
            </summary>
            <ul className="mt-1.5 space-y-1 pl-4 list-disc text-muted">
              {parsed.checklist.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {/* Action buttons */}
      <div className="mt-2.5">
        {onRevise || onReschedule || onDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
            <div className="flex items-center gap-2">
              {onRevise ? (
                <button type="button" className="rlc-btn rlc-btn-primary" onClick={onRevise}>
                  🎯 Revise
                </button>
              ) : null}
              {onReschedule ? (
                <div className="relative">
                  <button
                    type="button"
                    className="rlc-btn rlc-btn-secondary"
                    onClick={onReschedule}
                    title="Reschedule next revision date"
                  >
                    📅 Change schedule ▾
                  </button>
                  {rescheduleContent ? (
                    <div className="absolute left-0 top-full mt-1.5 z-30 w-72 sm:w-80 rounded-xl border border-line bg-surface p-3 shadow-2xl backdrop-blur-md">
                      {rescheduleContent}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {onDelete ? (
              <button
                type="button"
                className="rlc-btn rlc-btn-ghost text-subtle hover:text-rose-400"
                onClick={onDelete}
                title="Remove problem"
              >
                🗑️
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Extra content */}
        {extra ? <div className="mt-3 border-t border-line/60 pt-3">{extra}</div> : null}
      </div>
    </article>
  );
}
