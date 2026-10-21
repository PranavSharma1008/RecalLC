import { useCallback, useRef, useState } from 'react';

import { ImportPreview } from '../../components/ImportPreview';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import type { ImportPreview as ImportPreviewData, ImportResult } from '../../types';
import { formatDateTime } from '../../utils/date';

export interface ImportScreenProps {
  onChanged: () => void;
}

export function ImportScreen({ onChanged }: ImportScreenProps) {
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const history = useAsync(() => callService('import-history'), []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const content = await file.text();
      setFileName(file.name);
      setFileContent(content);
      const data = await callService('import-preview', { fileName: file.name, content });
      setPreview(data);
      if (data.invalid.length === 0 && data.valid.length === 0) {
        setError('Nothing usable was found in that file.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that file.');
    }
  }, []);

  const runImport = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await callService('import-commit', { fileName, content: fileContent });
      setResult(outcome);
      setPreview(null);
      history.reload();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader
          title="Import your attempt history"
          subtitle="Bring the problems you have already solved into RecallLC."
          action={
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              Choose file
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
  "attemptedAt": 1792454400000,
  "accepted": true,
  "language": "java",
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
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void chrome.tabs.create({ url: chrome.runtime.getURL('sample-import.json') });
              }}
            >
              Download the sample file
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void chrome.tabs.create({ url: chrome.runtime.getURL('sample-import.csv') });
              }}
            >
              Sample CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Import history" subtitle="Every import run on this device." />
        <div className="p-4">
          {history.loading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : (history.data ?? []).length === 0 ? (
            <p className="text-xs text-muted">You have not imported anything yet.</p>
          ) : (
            <ul className="space-y-2">
              {(history.data ?? []).map((batch) => (
                <li key={batch.id} className="flex items-baseline justify-between gap-3 text-[11px]">
                  <span className="truncate text-fg">{batch.fileName}</span>
                  <span className="shrink-0 text-subtle">
                    {formatDateTime(batch.importedAt)} · {batch.result.imported} imported
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
