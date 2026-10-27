import type { ReactNode } from 'react';
import type { Difficulty } from '../../types';
import { isGfgSlug } from '../../utils/slug';

const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  Easy: 'rlc-badge-easy',
  Medium: 'rlc-badge-medium',
  Hard: 'rlc-badge-hard',
  Unknown: 'rlc-badge-unknown',
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={`rlc-badge ${DIFFICULTY_CLASS[difficulty]}`}>{difficulty}</span>;
}

export function PlatformBadge({ url, slug }: { url?: string; slug?: string }) {
  const isGfg = Boolean((url && url.includes('geeksforgeeks.org')) || (slug && isGfgSlug(slug)));
  return (
    <span
      className={`rlc-badge-platform ${isGfg ? 'rlc-badge-platform-gfg' : 'rlc-badge-platform-lc'} text-[9.5px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase inline-flex items-center ${
        isGfg
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
      }`}
      title={isGfg ? 'Platform: GeeksforGeeks' : 'Platform: LeetCode'}
    >
      {isGfg ? 'GFG' : 'LC'}
    </span>
  );
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
