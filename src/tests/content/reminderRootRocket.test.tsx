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

  it('launches rocket from ground to top through animation when autoLaunch is true then turns to Added', async () => {
    vi.useFakeTimers();
    const root = createRoot(container);
    await act(async () => {
      root.render(<InlineRocketButton currentSlug="two-sum" autoLaunch={true} />);
    });

    // 1. Immediately shows the flying rocket animation with rocket symbol, flame and smoke
    const flyingContainer = document.body.querySelector('.rlc-flying-rocket-container');
    expect(flyingContainer).not.toBeNull();
    const flyingRocket = document.body.querySelector('.rlc-flying-rocket');
    expect(flyingRocket).not.toBeNull();
    expect(flyingRocket?.textContent).toContain('🚀');
    expect(flyingRocket?.textContent).toContain('🔥');
    expect(flyingRocket?.textContent).toContain('💨');

    // 2. Advance timer through flight animation (1100ms)
    await act(async () => {
      vi.advanceTimersByTime(1150);
    });

    // 3. Flight animation finishes and button turns to Added
    const flyingAfter = document.body.querySelector('.rlc-flying-rocket-container');
    expect(flyingAfter).toBeNull();

    const inlineBtn = container.querySelector('.rlc-inline-rocket-btn');
    expect(inlineBtn?.textContent).toContain('Added');
    expect(inlineBtn?.textContent).toContain('✓');
    expect(inlineBtn?.className).toContain('rlc-inline-rocket-btn-success');

    await act(async () => {
      root.unmount();
    });
    vi.useRealTimers();
  });
});
