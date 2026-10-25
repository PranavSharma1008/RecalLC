// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecallScreen } from '../../dashboard/screens/RecallScreen';
import { invalidateServiceCache } from '../../services/messaging';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('RecallScreen Navigation', () => {
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

  it('automatically navigates to /reminders when rating is submitted', async () => {
    const navigateMock = vi.fn();
    const onChangedMock = vi.fn();

    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const envelope = message as { method: string };
      if (envelope.method === 'get-problem') {
        return {
          ok: true,
          data: {
            problem: {
              slug: 'longest-common-prefix',
              title: 'Longest Common Prefix',
              difficulty: 'Easy',
              topics: ['String'],
              notes: '',
              attemptCount: 1,
              lastAttemptAt: Date.now(),
            },
            revision: {
              slug: 'longest-common-prefix',
              stage: 1,
              dueAt: Date.now(),
            },
            attempts: [],
          },
        };
      }
      if (envelope.method === 'rate') {
        return {
          ok: true,
          data: { dueAt: Date.now() + 86400000 },
        };
      }
      return { ok: true, data: null };
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<RecallScreen slug="longest-common-prefix" navigate={navigateMock} onChanged={onChangedMock} />);
    });

    // Wait for useAsync effect to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Verify problem title is loaded
    expect(container.textContent).toContain('Longest Common Prefix');

    // Click rating "Good"
    const goodRatingBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Good'),
    );
    expect(goodRatingBtn).toBeDefined();
    await act(async () => {
      goodRatingBtn?.click();
    });

    // Click "Save rating & schedule"
    const saveBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Save rating & schedule'),
    );
    expect(saveBtn).toBeDefined();
    await act(async () => {
      saveBtn?.click();
    });

    // Should call onChanged and navigate directly to /reminders
    expect(onChangedMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/reminders');
  });

  it('automatically navigates to /reminders when manual schedule preset is clicked', async () => {
    const navigateMock = vi.fn();
    const onChangedMock = vi.fn();

    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const envelope = message as { method: string };
      if (envelope.method === 'get-problem') {
        return {
          ok: true,
          data: {
            problem: {
              slug: 'longest-common-prefix',
              title: 'Longest Common Prefix',
              difficulty: 'Easy',
              topics: [],
              notes: '',
              attemptCount: 0,
            },
            revision: null,
            attempts: [],
          },
        };
      }
      if (envelope.method === 'reschedule') {
        return {
          ok: true,
          data: { dueAt: Date.now() + 86400000 * 3 },
        };
      }
      return { ok: true, data: null };
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<RecallScreen slug="longest-common-prefix" navigate={navigateMock} onChanged={onChangedMock} />);
    });

    // Wait for useAsync effect to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Click manual reschedule button "3 days"
    const threeDaysBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === '3 days',
    );
    expect(threeDaysBtn).toBeDefined();

    await act(async () => {
      threeDaysBtn?.click();
    });

    // Should call onChanged and navigate directly to /reminders
    expect(onChangedMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/reminders');
  });

  it('navigates to /reminders when top Back button is clicked', async () => {
    const navigateMock = vi.fn();
    const onChangedMock = vi.fn();

    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(async (message: unknown) => {
      const envelope = message as { method: string };
      if (envelope.method === 'get-problem') {
        return {
          ok: true,
          data: {
            problem: {
              slug: 'longest-common-prefix',
              title: 'Longest Common Prefix',
              difficulty: 'Easy',
              topics: [],
              notes: '',
              attemptCount: 0,
            },
            revision: null,
            attempts: [],
          },
        };
      }
      return { ok: true, data: null };
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<RecallScreen slug="longest-common-prefix" navigate={navigateMock} onChanged={onChangedMock} />);
    });

    // Wait for useAsync effect to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const backBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.includes('← Back'));
    expect(backBtn).toBeDefined();

    await act(async () => {
      backBtn?.click();
    });

    expect(navigateMock).toHaveBeenCalledWith('/reminders');
  });
});
