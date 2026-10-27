// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportScreen } from '../../dashboard/screens/ImportScreen';
import { invalidateServiceCache } from '../../services/messaging';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ImportScreen Export & Sample Protection', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    invalidateServiceCache();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders the solved LeetCode data download section and blank templates', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const envelope = message as { method: string };
      if (envelope.method === 'import-history') {
        return { ok: true, data: [] };
      }
      if (envelope.method === 'stats') {
        return {
          ok: true,
          data: {
            totalProblems: 2,
            totalAttempts: 2,
            dueToday: 0,
            overdue: 0,
            revisedThisWeek: 1,
            streak: 1,
            byTopic: [],
            totalReviews: 1,
          },
        };
      }
      if (envelope.method === 'export') {
        return {
          ok: true,
          data: {
            format: 'recalllc-backup',
            version: 1,
            exportedAt: Date.now(),
            problems: [
              {
                slug: 'trapping-rain-water',
                title: 'Trapping Rain Water',
                url: 'https://leetcode.com/problems/trapping-rain-water/',
                difficulty: 'Hard',
                topics: ['Array', 'Two Pointers'],
                notes: 'Two pointers solution.',
                attemptCount: 1,
                lastAttemptAt: 1700000000000,
                accepted: true,
                lastLanguage: 'cpp',
              },
            ],
            attempts: [
              {
                id: 'att-1',
                slug: 'trapping-rain-water',
                title: 'Trapping Rain Water',
                attemptedAt: 1700000000000,
                accepted: true,
                language: 'cpp',
                submissionId: 'real-sub-999',
                source: 'auto',
              },
            ],
          },
        };
      }
      return { ok: true, data: null };
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<ImportScreen onChanged={() => undefined} />);
    });

    // Wait for async state to settle
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(container.textContent).toContain('Download your solved LeetCode data');
    expect(container.textContent).toContain('Download Solved Problems (CSV)');
    expect(container.textContent).toContain('Download Solved Problems (JSON)');
    expect(container.textContent).not.toContain('Blank format templates');
    expect(container.textContent).not.toContain('Blank CSV Template');
  });

  it('shows helpful guidance and prevents fake data download when no solved problems exist', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const envelope = message as { method: string };
      if (envelope.method === 'import-history') {
        return { ok: true, data: [] };
      }
      if (envelope.method === 'stats') {
        return {
          ok: true,
          data: {
            totalProblems: 0,
            totalAttempts: 0,
            dueToday: 0,
            overdue: 0,
            revisedThisWeek: 0,
            streak: 0,
            byTopic: [],
            totalReviews: 0,
          },
        };
      }
      if (envelope.method === 'export') {
        return {
          ok: true,
          data: {
            format: 'recalllc-backup',
            version: 1,
            exportedAt: Date.now(),
            problems: [],
            attempts: [],
          },
        };
      }
      return { ok: true, data: null };
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<ImportScreen onChanged={() => undefined} />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Find and click the Download CSV button
    const buttons = Array.from(container.querySelectorAll('button'));
    const downloadCsvBtn = buttons.find((b) => b.textContent?.includes('Download Solved Problems (CSV)'));
    expect(downloadCsvBtn).toBeDefined();

    await act(async () => {
      downloadCsvBtn?.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Check that warning message appears without downloading fake data
    expect(container.textContent).toContain('No solved LeetCode problems found in your database yet');
  });

  it('silently purges any legacy demo data on mount', async () => {
    let purged = false;
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const envelope = message as { method: string };
      if (envelope.method === 'import-history') {
        return { ok: true, data: [] };
      }
      if (envelope.method === 'stats') {
        return {
          ok: true,
          data: {
            totalProblems: 1,
            totalAttempts: 1,
            dueToday: 0,
            overdue: 0,
            revisedThisWeek: 0,
            streak: 0,
            byTopic: [],
            totalReviews: 0,
          },
        };
      }
      if (envelope.method === 'purge-sample-data') {
        purged = true;
        return {
          ok: true,
          data: {
            deletedAttempts: 1,
            deletedProblems: 1,
          },
        };
      }
      return { ok: true, data: null };
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<ImportScreen onChanged={() => undefined} />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Should automatically call purge-sample-data silently
    expect(purged).toBe(true);
    // Should NOT show any sample dataset warning or button to the user
    expect(container.textContent).not.toContain('Sample Dataset Detected');
    expect(container.textContent).not.toContain('Clear Sample Data');
  });
});
