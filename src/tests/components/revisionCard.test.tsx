// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';

import { RevisionCard } from '../../components/RevisionCard';
import type { Problem } from '../../types';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const dummyProblem: Problem = {
  slug: 'two-sum',
  title: 'Two Sum',
  url: 'https://leetcode.com/problems/two-sum/',
  difficulty: 'Easy',
  topics: ['Array', 'Hash Table'],
  notes: '',
  firstAttemptAt: Date.now() - 86400000,
  lastAttemptAt: Date.now() - 86400000,
  lastViewedAt: null,
  attemptCount: 1,
  accepted: true,
  lastLanguage: 'typescript',
  struggleScore: 0,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 86400000,
};

describe('RevisionCard overdue and due badge formatting', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders "Due today" badge in blue tone when problem is due today', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <RevisionCard problem={dummyProblem} revision={null} dueAt={Date.now()} overdue={false} daysUntilDue={0} />,
      );
    });

    const badge = container.querySelector('.rlc-badge-accent');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('Due today');
  });

  it('renders "Overdue - 1 day" when 1 day overdue', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <RevisionCard
          problem={dummyProblem}
          revision={null}
          dueAt={Date.now() - 86400000}
          overdue={true}
          overdueDays={1}
          daysUntilDue={-1}
        />,
      );
    });

    const badge = container.querySelector('.rlc-badge-medium');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('Overdue - 1 day');
  });

  it('renders "Overdue - 3 days" when 3 days overdue', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <RevisionCard
          problem={dummyProblem}
          revision={null}
          dueAt={Date.now() - 3 * 86400000}
          overdue={true}
          overdueDays={3}
          daysUntilDue={-3}
        />,
      );
    });

    const badge = container.querySelector('.rlc-badge-medium');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('Overdue - 3 days');
  });

  it('safely falls back to "Overdue - 1 day" if days count is 0 but overdue is true', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <RevisionCard
          problem={dummyProblem}
          revision={null}
          dueAt={Date.now() - 1000}
          overdue={true}
          overdueDays={0}
          daysUntilDue={0}
        />,
      );
    });

    const badge = container.querySelector('.rlc-badge-medium');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('Overdue - 1 day');
  });
});
