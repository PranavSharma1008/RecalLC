// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReminderRoot } from '../../content/ReminderRoot';
import { InlineRocketButton } from '../../content/InlineRocketButton';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Rocket button display and placement', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    // Mock chrome.storage.local
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ ok: true, data: { candidate: null, remainingDue: 0 } }),
      },
    });
  });

  it('ReminderRoot NEVER renders the floating circular rocket button', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ReminderRoot currentSlug="two-sum" />);
    });

    const floatingRocket = container.querySelector('.rlc-rocket-btn');
    expect(floatingRocket).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('InlineRocketButton renders the simple rocket button correctly', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<InlineRocketButton currentSlug="two-sum" />);
    });

    const inlineBtn = container.querySelector('.rlc-inline-rocket-btn');
    expect(inlineBtn).not.toBeNull();
    expect(inlineBtn?.getAttribute('aria-label')).toBe('Push to RecallLC 🚀');
    expect(inlineBtn?.textContent).toContain('🚀');

    // Verify that the floating popup message is never rendered
    const toast = container.querySelector('.rlc-rocket-toast');
    expect(toast).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
