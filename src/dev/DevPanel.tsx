import { useState } from 'react';

import { Button } from '../components/ui/Button';
import { callService } from '../services/messaging';
import { sampleImportJson } from './sampleData';

/**
 * DEVELOPMENT ONLY — a panel that loads the sample dataset into the store so
 * the UI can be exercised without a real import file.
 *
 * Rendered only when `import.meta.env.DEV` is true, so it never appears in a
 * production build.
 */
export function DevPanel({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSample(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await callService('import-commit', {
        fileName: 'sample-data.json',
        content: sampleImportJson(),
      });
      setMessage(`Loaded ${result.imported} demo attempts across ${result.problemsCreated} demo problems.`);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the sample data.');
    } finally {
      setBusy(false);
    }
  }

  async function wipe(): Promise<void> {
    setBusy(true);
    try {
      await callService('clear-all');
      setMessage('Cleared every problem, attempt and review.');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-warning/50 bg-warning-soft p-4">
      <p className="text-xs font-semibold text-warning">Development tools</p>
      <p className="mt-1 text-[11px] text-muted">
        This panel only exists in a development build. The data it loads is clearly marked as demo data and can be wiped
        with one click.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void loadSample()}>
          Load demo data
        </Button>
        <Button variant="danger" size="sm" disabled={busy} onClick={() => void wipe()}>
          Wipe all data
        </Button>
      </div>
      {message ? <p className="mt-2 text-[11px] text-muted">{message}</p> : null}
    </div>
  );
}
