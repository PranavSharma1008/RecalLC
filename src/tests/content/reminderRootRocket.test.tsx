// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReminderRoot } from '../../content/ReminderRoot';
import { InlineRocketButton } from '../../content/InlineRocketButton';
import { pushProblemToRecallLC } from '../../content/pushHelper';
import {
  invalidateServiceCache,
  isExtensionContextValid,
  resetExtensionContextValidityForTest,
} from '../../services/messaging';

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Rocket button display and placement', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    resetExtensionContextValidityForTest();
    invalidateServiceCache();
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
        id: 'recalllc-test-id',
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

  it('immediately displays green Added state when autoOpen is true', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<InlineRocketButton currentSlug="two-sum" autoOpen={true} />);
    });

    const inlineBtn = container.querySelector('.rlc-inline-rocket-btn');
    expect(inlineBtn?.textContent).toContain('Added');
    expect(inlineBtn?.textContent).toContain('✓');
    expect(inlineBtn?.className).toContain('rlc-inline-rocket-btn-success');

    await act(async () => {
      root.unmount();
    });
  });

  it('InlineRocketButton starts fresh with rocket icon and only turns to Added on autoOpen or push', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<InlineRocketButton currentSlug="two-sum" />);
    });

    const inlineBtn = container.querySelector('.rlc-inline-rocket-btn');
    expect(inlineBtn?.textContent).toContain('🚀');
    expect(inlineBtn?.textContent).not.toContain('Added');

    await act(async () => {
      root.unmount();
    });
  });

  it('user clicking the rocket button manually launches animation, pushes problem, and turns button to Added', async () => {
    vi.useFakeTimers();
    const mockPush = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(<InlineRocketButton currentSlug="two-sum" onPushed={mockPush} />);
    });

    const inlineBtn = container.querySelector<HTMLButtonElement>('.rlc-inline-rocket-btn');
    expect(inlineBtn).not.toBeNull();
    expect(inlineBtn?.textContent).toContain('🚀');
    expect(inlineBtn?.textContent).not.toContain('Added');

    // Click rocket button manually
    await act(async () => {
      inlineBtn?.click();
    });

    // Flight animation starts
    const flyingContainer = document.body.querySelector('.rlc-flying-rocket-container');
    expect(flyingContainer).not.toBeNull();

    // Advance past animation
    await act(async () => {
      vi.advanceTimersByTime(1150);
    });

    // Button is now Added
    expect(inlineBtn?.textContent).toContain('Added');
    expect(inlineBtn?.textContent).toContain('✓');

    await act(async () => {
      root.unmount();
    });
    vi.useRealTimers();
  });

  it('pushProblemToRecallLC gracefully returns false and shows banner when extension context is invalidated', async () => {
    // Invalidate extension context by deleting chrome.runtime.id
    // @ts-expect-error test simulation
    delete chrome.runtime.id;
    expect(isExtensionContextValid()).toBe(false);

    const pushed = await pushProblemToRecallLC('two-sum', 'manual');
    expect(pushed).toBe(false);

    const banner = document.getElementById('recalllc-reload-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('RecallLC was reloaded');
  });
});
