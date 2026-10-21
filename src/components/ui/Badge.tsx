import type { ReactNode } from 'react';
import type { Difficulty } from '../../types';

const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  Easy: 'rlc-badge-easy',
  Medium: 'rlc-badge-medium',
  Hard: 'rlc-badge-hard',
  Unknown: 'rlc-badge-unknown',
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`rlc-badge ${DIFFICULTY_CLASS[difficulty]}`}>{difficulty}</span>;
}

export type BadgeTone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<BadgeTone, string> = {
  accent: 'rlc-badge-accent',
  neutral: 'rlc-badge-neutral',
  success: 'rlc-badge-easy',
  warning: 'rlc-badge-medium',
  danger: 'rlc-badge-hard',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={`rlc-badge ${TONE_CLASS[tone]} ${className}`}>{children}</span>;
}
