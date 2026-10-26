import { useCallback, useEffect, useRef, useState } from 'react';

import { ImportPreview } from '../../components/ImportPreview';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/States';
import { useAsync } from '../../hooks/useAsync';
import { callService } from '../../services/messaging';
import { isSampleAttempt, SAMPLE_SLUGS } from '../../services/repository';
import type { ImportPreview as ImportPreviewData, ImportResult } from '../../types';
import { toCsv } from '../../utils/csv';
import { formatDateTime } from '../../utils/date';
import { titleFromSlug } from '../../utils/slug';

export interface ImportScreenProps {
  onChanged: () => void;
}

interface RealSolvedExportItem {
  slug: string;
  title: string;
  url: string;
  difficulty: string;
  topics: string;
  topicsArray: string[];
  attemptedAt: number;
  accepted: boolean;
  language: string;
  submissionId: string;
  notes: string;
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

  // Export states
  const [busyExport, setBusyExport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [hasDemoData, setHasDemoData] = useState(false);

  const history = useAsync(() => callService('import-history'), []);
  const stats = useAsync(() => callService('stats'), []);

  // Check on mount if any fake sample data is in the database
  useEffect(() => {
    void callService('export').then((backup) => {
      const attempts = backup?.attempts ?? [];
      const problems = backup?.problems ?? [];
      const foundSample =
        attempts.some((a) => isSampleAttempt(a)) ||
        problems.some((p) => SAMPLE_SLUGS.has(p.slug) && (!p.notes || !p.notes.trim()));
      setHasDemoData(foundSample);
    });
  }, []);

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
      stats.reload();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import failed.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Retrieves real solved LeetCode problems from the database,
   * strictly filtering out any fake mock / sample-import data.
   */
  async function getRealSolvedProblems(): Promise<{
    items: RealSolvedExportItem[];
    foundDemoData: boolean;
  }> {
    const backup = await callService('export');
    const problems = backup.problems ?? [];
    const attempts = backup.attempts ?? [];

    const problemBySlug = new Map(problems.map((p) => [p.slug, p]));
    let foundDemo = false;

    // Filter out mock / fake sample attempts
    const realAttempts = attempts.filter((attempt) => {
      if (isSampleAttempt(attempt)) {
        foundDemo = true;
        return false;
      }
      return true;
    });

    const items: RealSolvedExportItem[] = [];
    const slugsHandled = new Set<string>();

    for (const attempt of realAttempts) {
      if (slugsHandled.has(attempt.slug)) continue;
      const problem = problemBySlug.get(attempt.slug);
      slugsHandled.add(attempt.slug);
      items.push({
        slug: attempt.slug,
        title: attempt.title || problem?.title || titleFromSlug(attempt.slug),
        url: problem?.url || `https://leetcode.com/problems/${attempt.slug}/`,
        difficulty: problem?.difficulty || 'Unknown',
        topics: (problem?.topics ?? []).join(', '),
        topicsArray: problem?.topics ?? [],
        attemptedAt: attempt.attemptedAt,
        accepted: attempt.accepted ?? true,
        language: attempt.language || problem?.lastLanguage || '',
        submissionId: attempt.submissionId || '',
        notes: problem?.notes || '',
      });
    }

    // Sort by latest attempt first
    items.sort((a, b) => b.attemptedAt - a.attemptedAt);

    return { items, foundDemoData: foundDemo };
  }

  const handleDownloadCsv = async (): Promise<void> => {
    setExportMessage(null);
    setExportError(null);
    setBusyExport(true);
    try {
      const { items, foundDemoData } = await getRealSolvedProblems();
      setHasDemoData(foundDemoData);

      if (items.length === 0) {
        setExportError(
          'No solved LeetCode problems found in your database yet. Solve problems on LeetCode while logged in (or visit leetcode.com with Account Sync active), then download your CSV here.',
        );
        return;
      }

      const headers = [
        'slug',
        'title',
        'url',
        'difficulty',
        'topics',
        'attemptedAt',
        'accepted',
        'language',
        'submissionId',
        'notes',
      ];
      const rows = items.map((item) => [
        item.slug,
        item.title,
        item.url,
        item.difficulty,
        item.topics,
        String(item.attemptedAt),
        String(item.accepted),
        item.language,
        item.submissionId,
        item.notes,
      ]);

      const csvContent = toCsv(headers, rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leetcode-solved-problems-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportMessage(`Successfully exported ${items.length} solved LeetCode problem(s) to CSV!`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not export your solved problems.');
    } finally {
      setBusyExport(false);
    }
  };

  const handleDownloadJson = async (): Promise<void> => {
    setExportMessage(null);
    setExportError(null);
    setBusyExport(true);
    try {
      const { items, foundDemoData } = await getRealSolvedProblems();
      setHasDemoData(foundDemoData);

      if (items.length === 0) {
        setExportError(
          'No solved LeetCode problems found in your database yet. Solve problems on LeetCode while logged in (or visit leetcode.com with Account Sync active), then download your JSON here.',
        );
        return;
      }

      const exportList = items.map((item) => ({
        slug: item.slug,
        title: item.title,
        url: item.url,
        difficulty: item.difficulty,
        topics: item.topicsArray,
        attemptedAt: item.attemptedAt,
        attemptedDate: new Date(item.attemptedAt).toISOString(),
        accepted: item.accepted,
        language: item.language || null,
        submissionId: item.submissionId || null,
        notes: item.notes || null,
      }));

      const jsonContent = JSON.stringify(exportList, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leetcode-solved-problems-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportMessage(`Successfully exported ${items.length} solved LeetCode problem(s) to JSON!`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not export your solved problems.');
    } finally {
      setBusyExport(false);
    }
  };

  const handlePurgeDemoData = async (): Promise<void> => {
    setBusyExport(true);
    setExportError(null);
    try {
      const outcome = await callService('purge-sample-data');
      setHasDemoData(false);
      setExportMessage(
        `Cleared ${outcome.deletedProblems} sample problem(s). Only your personal LeetCode data is retained.`,
      );
      history.reload();
      stats.reload();
      onChanged();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not clear sample data.');
    } finally {
      setBusyExport(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Real Solved LeetCode Data Export Card */}
      <Card>
        <CardHeader
          title="Download your solved LeetCode data"
          subtitle="Export the actual questions you have solved on LeetCode as CSV or JSON."
        />
        <div className="space-y-4 p-4">
          {exportError ? <ErrorState message={exportError} /> : null}
          {exportMessage ? (
            <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-soft px-3.5 py-2.5 text-xs text-success">
              <span>🎉</span>
              <span>{exportMessage}</span>
            </div>
          ) : null}

          {hasDemoData ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">ℹ️</span>
                <div>
                  <p className="font-semibold text-fg">Sample Dataset Detected</p>
                  <p className="text-[11px] text-muted">
                    Your database currently includes pre-loaded sample problems. You can clear them to retain only your personal solved questions.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={busyExport}
                onClick={() => void handlePurgeDemoData()}
              >
                Clear Sample Data
              </Button>
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
              <Button
                variant="primary"
                size="sm"
                disabled={busyExport}
                onClick={() => void handleDownloadCsv()}
              >
                📄 Download Solved Problems (CSV)
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={busyExport}
                onClick={() => void handleDownloadJson()}
              >
                💾 Download Solved Problems (JSON)
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-line/60 bg-surface-2/60 p-3 text-[11px] leading-relaxed text-muted">
            <p className="font-medium text-fg mb-1">💡 How RecallLC gets your real LeetCode data:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-subtle">
              <li>When you submit code and receive an <strong className="text-fg">&quot;Accepted&quot;</strong> verdict on LeetCode, RecallLC automatically tracks it.</li>
              <li>You can click the 🚀 rocket button directly on any LeetCode problem page to record it.</li>
              <li>LeetCode Account Sync automatically syncs your recent solved submissions whenever you browse leetcode.com.</li>
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
