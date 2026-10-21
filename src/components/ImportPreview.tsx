import type { ImportPreview as ImportPreviewData } from '../types';
import { formatDate } from '../utils/date';

export interface ImportPreviewProps {
  preview: ImportPreviewData;
  onImport: () => void;
  onCancel: () => void;
  busy?: boolean;
}

function CountChip({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'bad' | 'muted' }) {
  const toneClass = {
    ok: 'bg-success-soft text-success',
    warn: 'bg-warning-soft text-warning',
    bad: 'bg-danger-soft text-danger',
    muted: 'bg-surface-2 text-muted',
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${toneClass}`}>
      <span className="text-[13px] font-semibold tabular-nums">{value}</span>
      {label}
    </span>
  );
}

/**
 * Import preview — shows exactly what will happen before anything is written.
 * The user always sees the counts and the problems that will be created or
 * merged before confirming.
 */
export function ImportPreview({ preview, onImport, onCancel, busy = false }: ImportPreviewProps) {
  const willCreate = preview.problems.filter((problem) => problem.attempts > 0).length;

  return (
    <div className="space-y-4">
      <div className="rlc-card-flat p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CountChip label="valid rows" value={preview.valid.length} tone="ok" />
          <CountChip label="duplicates" value={preview.duplicates} tone="warn" />
          <CountChip label="invalid" value={preview.invalid.length} tone="bad" />
          <CountChip label="problems" value={willCreate} tone="muted" />
        </div>

        <p className="mt-3 break-all text-[11px] text-subtle">
          {preview.fileName} · {preview.format.toUpperCase()} · {preview.totalRows} row
          {preview.totalRows === 1 ? '' : 's'} read
        </p>
      </div>

      {preview.invalid.length > 0 ? (
        <div className="rlc-card-flat border-danger/40 p-4">
          <h3 className="text-xs font-semibold text-danger">
            {preview.invalid.length} row{preview.invalid.length === 1 ? '' : 's'} could not be read
          </h3>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-muted">
            {preview.invalid.slice(0, 25).map((entry, index) => (
              <li key={`${entry.row ?? 'file'}-${index}`}>
                <span className="text-subtle">{entry.row === null ? 'File' : `Row ${entry.row}`}:</span> {entry.message}
              </li>
            ))}
            {preview.invalid.length > 25 ? (
              <li className="text-subtle">…and {preview.invalid.length - 25} more.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {preview.warnings.length > 0 ? (
        <div className="rlc-card-flat border-warning/40 p-4">
          <h3 className="text-xs font-semibold text-warning">Notes</h3>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11px] text-muted">
            {preview.warnings.slice(0, 12).map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
            {preview.warnings.length > 12 ? (
              <li className="text-subtle">…and {preview.warnings.length - 12} more.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {preview.problems.length > 0 ? (
        <div className="rlc-card-flat overflow-hidden">
          <div className="border-b border-line px-4 py-2.5">
            <h3 className="text-xs font-semibold text-fg">Problems to be imported</h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-surface text-subtle">
                <tr>
                  <th className="px-4 py-2 font-medium">Problem</th>
                  <th className="px-4 py-2 font-medium">Attempts</th>
                  <th className="px-4 py-2 font-medium">First</th>
                  <th className="px-4 py-2 font-medium">Latest</th>
                </tr>
              </thead>
              <tbody>
                {preview.problems.map((problem) => (
                  <tr key={problem.slug} className="border-t border-line/60">
                    <td className="max-w-[220px] truncate px-4 py-1.5 text-fg">{problem.title}</td>
                    <td className="px-4 py-1.5 tabular-nums text-muted">{problem.attempts}</td>
                    <td className="whitespace-nowrap px-4 py-1.5 text-muted">{formatDate(problem.firstAttemptAt)}</td>
                    <td className="whitespace-nowrap px-4 py-1.5 text-muted">{formatDate(problem.lastAttemptAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="rlc-btn rlc-btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="rlc-btn rlc-btn-primary"
          onClick={onImport}
          disabled={busy || preview.valid.length === 0}
        >
          {busy ? 'Importing…' : `Import ${preview.valid.length} attempt${preview.valid.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
