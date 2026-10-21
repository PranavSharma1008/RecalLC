import { RATING_HINTS, RATING_LABELS, RECALL_RATINGS, type RecallRating } from '../types';

export interface RecallRatingProps {
  value: RecallRating | null;
  onChange: (rating: RecallRating) => void;
  disabled?: boolean;
}

const RATING_STYLE: Record<RecallRating, { active: string; idle: string }> = {
  forgot: {
    active: 'border-danger bg-danger-soft text-danger',
    idle: 'border-line bg-surface-2 text-muted hover:border-danger/40 hover:text-danger',
  },
  hard: {
    active: 'border-warning bg-warning-soft text-warning',
    idle: 'border-line bg-surface-2 text-muted hover:border-warning/40 hover:text-warning',
  },
  good: {
    active: 'border-info bg-info-soft text-info',
    idle: 'border-line bg-surface-2 text-muted hover:border-info/40 hover:text-info',
  },
  easy: {
    active: 'border-success bg-success-soft text-success',
    idle: 'border-line bg-surface-2 text-muted hover:border-success/40 hover:text-success',
  },
};

/**
 * The four-way recall rating used by the spaced-repetition schedule.
 * Deliberately explicit: each option explains what it does to the schedule.
 */
export function RecallRating({ value, onChange, disabled = false }: RecallRatingProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {RECALL_RATINGS.map((rating) => {
        const active = value === rating;
        return (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(rating)}
            className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
              active ? RATING_STYLE[rating].active : RATING_STYLE[rating].idle
            }`}
          >
            <span className="text-[13px] font-semibold">{RATING_LABELS[rating]}</span>
            <span className="text-[11px] leading-snug opacity-80">{RATING_HINTS[rating]}</span>
          </button>
        );
      })}
    </div>
  );
}
