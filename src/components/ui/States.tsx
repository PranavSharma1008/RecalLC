import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
      {icon ? <div className="text-2xl opacity-70">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        {description ? <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted">
      <span
        aria-hidden="true"
        className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent"
      />
      {label ?? 'Loading…'}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-xs text-danger">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-danger/90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-danger/40 px-2 py-1 text-[11px] font-medium hover:bg-danger/10"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
