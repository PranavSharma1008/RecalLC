import { useCallback, useEffect, useRef, useState } from 'react';

import { ImportPreview } from '../../components/ImportPreview';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import type { BackupFile, ImportPreview as ImportPreviewData, ImportResult } from '../../types';

export interface ImportScreenProps {
  onChanged: () => void;
}

export function ImportScreen({ onChanged }: ImportScreenProps) {
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupFile | null>(null);
  const [restoredResult, setRestoredResult] = useState<{ problems: number; attempts: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Export states
  const [busyExport, setBusyExport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const stats = useAsync(() => callService('stats'), []);

  // Silently purge any legacy mock sample data on mount so only genuine solves exist
  useEffect(() => {
    void callService('purge-sample-data').then(() => {
      stats.reload();
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setPreview(null);
    setBackupPreview(null);
    setRestoredResult(null);
    try {
      const content = await file.text();
      setFileName(file.name);
      setFileContent(content);

      // Check if this file is a RecallLC Complete Backup JSON
      try {
        const parsed = JSON.parse(content);
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.format === 'recalllc-backup' &&
          (Array.isArray(parsed.problems) || Array.isArray(parsed.attempts))
        ) {
          setBackupPreview(parsed as BackupFile);
          return;
        }
      } catch {
        // Not a JSON backup, proceed to preview
      }

      const data = await callService('import-preview', { fileName: file.name, content });
      setPreview(data);
      if (data.invalid.length === 0 && data.valid.length === 0) {
        setError('Nothing usable was found in that file.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that file.');
    }
  }, []);

  const runRestoreBackup = async (): Promise<void> => {
    if (!backupPreview) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await callService('restore', { backup: backupPreview });
      setRestoredResult(outcome);
      setBackupPreview(null);
      setFileName('');
      setFileContent('');
      stats.reload();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The restore failed.');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await callService('import-commit', { fileName, content: fileContent });
      setResult(outcome);
      setPreview(null);
      stats.reload();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = async (): Promise<void> => {
    setExportMessage(null);
    setExportError(null);
    setBusyExport(true);
    try {
      const backup = await callService('export');
      const problemCount = backup.problems?.length ?? 0;
      const attemptCount = backup.attempts?.length ?? 0;

      if (problemCount === 0 && attemptCount === 0) {
        setExportError(
          'No solved LeetCode problems found in your database yet. Solve problems on LeetCode while logged in (or visit leetcode.com with Account Sync active), then download your backup.',
        );
        return;
      }

      const jsonContent = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recalllc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportMessage(
        `Successfully downloaded complete RecallLC backup (${problemCount} problem${problemCount === 1 ? '' : 's'}, ${attemptCount} submission${attemptCount === 1 ? '' : 's'})! Transfer this file to any device or browser to restore all data & schedules.`,
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not export backup.');
    } finally {
      setBusyExport(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Complete Backup Export Card */}
      <Card>
        <CardHeader
          title="Download Complete Backup"
          subtitle="Export all your solved problems, notes, solution code, and revision schedules into a complete JSON backup."
        />
        <div className="space-y-4 p-4">
          {exportError ? <ErrorState message={exportError} /> : null}
          {exportMessage ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-soft px-3.5 py-2.5 text-xs text-success">
              <span>🎉</span>
              <span>{exportMessage}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3 text-xs">
            <div>
              <p className="font-semibold text-fg">Tracked Solved Problems</p>
              <p className="text-[11px] text-subtle mt-0.5">
                {stats.loading
                  ? 'Loading your problem stats…'
                  : `${stats.data?.totalProblems ?? 0} solved problem${(stats.data?.totalProblems ?? 0) === 1 ? '' : 's'} tracked (${stats.data?.totalAttempts ?? 0} total submissions)`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" disabled={busyExport} onClick={() => void handleDownloadBackup()}>
                📦 Download Complete Backup (JSON)
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-line/60 bg-surface-2/60 p-3 text-[11px] leading-relaxed text-muted">
            <p className="font-medium text-fg mb-1">🔄 How to transfer data to another device or browser:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-subtle">
              <li>
                Click <strong className="text-fg">&quot;Download Complete Backup (JSON)&quot;</strong> to export all your problems, notes, solution code, and revision schedules.
              </li>
              <li>
                Open RecallLC on your other device or browser, navigate to this <strong className="text-fg">Import</strong> tab, and drop the downloaded file.
              </li>
              <li>
                All your tracked problems, solution code, and spaced repetition revision schedules will be automatically restored!
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Import your attempt history"
          subtitle="Bring previous problem history into RecallLC from a JSON or CSV file."
          action={
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              📁 Choose file
            </Button>
          }
        />
        <div className="space-y-4 p-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-9 text-center transition-colors ${
              dragging ? 'border-accent bg-accent-soft' : 'border-line'
            }`}
          >
            <span aria-hidden="true" className="text-xl text-subtle">
              ⇩
            </span>
            <p className="text-xs font-medium text-fg">Drop a .json or .csv file here</p>
            <p className="text-[11px] text-subtle">Nothing is saved until you review the preview and confirm.</p>
            <input
              ref={inputRef}
              type="file"
              accept=".json,.csv,.tsv,application/json,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = '';
              }}
            />
          </div>

          {error ? <ErrorState message={error} /> : null}

          {backupPreview ? (
            <div className="rounded-xl border border-accent/40 bg-accent-soft/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-accent">📦 RecallLC Complete Backup Detected</p>
                  <p className="text-[11px] text-subtle mt-0.5">
                    File: <span className="font-mono text-fg">{fileName}</span> · Exported on{' '}
                    {new Date(backupPreview.exportedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-semibold text-accent">
                  Full Backup
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-3 rounded-lg bg-surface-2 p-3">
                <div>
                  <dt className="text-subtle">Problems</dt>
                  <dd className="text-base font-semibold tabular-nums text-fg">
                    {backupPreview.problems?.length ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Submissions</dt>
                  <dd className="text-base font-semibold tabular-nums text-fg">
                    {backupPreview.attempts?.length ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Revision Schedules</dt>
                  <dd className="text-base font-semibold tabular-nums text-fg">
                    {backupPreview.revisions?.length ?? 0}
                  </dd>
                </div>
              </dl>

              <p className="text-[11px] text-muted leading-relaxed">
                Restoring this file will import all your problems, notes, solution code, and spaced repetition revision schedules into this browser.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <Button variant="primary" size="sm" disabled={busy} onClick={() => void runRestoreBackup()}>
                  {busy ? 'Restoring data…' : '🚀 Restore All Data & Schedules'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setBackupPreview(null);
                    setFileName('');
                    setFileContent('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {restoredResult ? (
            <div className="rounded-xl border border-success/40 bg-success-soft p-4">
              <p className="text-xs font-semibold text-success">🎉 Data Restored Successfully</p>
              <p className="mt-1 text-[11px] text-fg">
                Restored <strong className="font-semibold">{restoredResult.problems}</strong> problem(s) and{' '}
                <strong className="font-semibold">{restoredResult.attempts}</strong> submission(s). All your spaced repetition schedules and notes are now active!
              </p>
            </div>
          ) : null}

          {preview ? (
            <ImportPreview
              preview={preview}
              busy={busy}
              onImport={() => void runImport()}
              onCancel={() => {
                setPreview(null);
                setFileName('');
                setFileContent('');
              }}
            />
          ) : null}

          {result ? (
            <div className="rounded-xl border border-success/40 bg-success-soft p-4">
              <p className="text-xs font-semibold text-success">Import complete</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
                <div>
                  <dt className="text-subtle">Imported</dt>
                  <dd className="text-lg font-semibold tabular-nums text-fg">{result.imported}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Duplicates</dt>
                  <dd className="text-lg font-semibold tabular-nums text-fg">{result.duplicated}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Invalid</dt>
                  <dd className="text-lg font-semibold tabular-nums text-fg">{result.invalid}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Merged</dt>
                  <dd className="text-lg font-semibold tabular-nums text-fg">{result.merged}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-muted">
                {result.problemsCreated} new problem{result.problemsCreated === 1 ? '' : 's'} tracked.
              </p>
              {result.errors.length > 0 ? (
                <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[11px] text-muted">
                  {result.errors.slice(0, 8).map((entry, index) => (
                    <li key={index}>
                      {entry.row === null ? 'File' : `Row ${entry.row}`}: {entry.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Supported format" subtitle="Both JSON and CSV are accepted." />
        <div className="space-y-3 p-4 text-[11px] leading-relaxed text-muted">
          <p>
            Each row describes <strong className="text-fg">one attempt</strong>. The only required fields are the
            problem slug and when the attempt happened. Everything else is optional.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] text-fg">
            {`{
  "slug": "two-sum",
  "title": "Two Sum",
  "url": "https://leetcode.com/problems/two-sum/",
  "attemptedAt": 1712345678000,
  "accepted": true,
  "language": "python3",
  "submissionId": "optional-id"
}`}
          </pre>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-medium text-fg">Timestamps</p>
              <p className="mt-1">
                Unix seconds and Unix milliseconds are both accepted and told apart automatically. ISO 8601 strings work
                too. A date without a time is read as local midnight, and a date-time without a zone is read as local
                time — both are flagged in the preview.
              </p>
            </div>
            <div>
              <p className="font-medium text-fg">Column names</p>
              <p className="mt-1">
                CSV headers are matched loosely: <code>slug</code>, <code>titleSlug</code> and <code>problem_slug</code>{' '}
                all work for the slug; <code>timestamp</code>, <code>date</code>, <code>submittedAt</code> and{' '}
                <code>createdAt</code> all work for the timestamp.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
