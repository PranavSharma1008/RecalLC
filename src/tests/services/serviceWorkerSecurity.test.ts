import { beforeAll, describe, expect, it } from 'vitest';

import { MESSAGE_CHANNEL } from '../../services/messaging';
import { getMessageListeners } from '../setup';

describe('Service Worker Security & IPC Sender Verification', () => {
  let dispatch: (msg: unknown, sender: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string }>;

  beforeAll(async () => {
    // Import serviceWorker to trigger registration of onMessage listener
    await import('../../background/serviceWorker');
    const listeners = getMessageListeners();
    expect(listeners.length).toBeGreaterThan(0);
    const listener = listeners[listeners.length - 1]!;

    dispatch = (msg: unknown, sender: unknown) =>
      new Promise((resolve) => {
        listener(msg, sender, (res) => resolve(res as never));
      });
  });

  it('rejects privileged method "clear-all" from an untrusted content-script sender', async () => {
    const unprivilegedSender = {
      id: 'recalllc-test',
      url: 'https://leetcode.com/problems/two-sum/',
      origin: 'https://leetcode.com',
    };

    const response = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'clear-all',
      },
      unprivilegedSender,
    );

    expect(response.ok).toBe(false);
    expect(response.error).toContain('Unauthorized: method "clear-all" is restricted to extension pages');
  });

  it('rejects privileged method "clear-all" from an external rogue chrome-extension sender', async () => {
    const rogueExtensionSender = {
      id: 'evil-external-extension-id',
      url: 'chrome-extension://evil-external-extension-id/popup.html',
      origin: 'chrome-extension://evil-external-extension-id',
    };

    const response = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'clear-all',
      },
      rogueExtensionSender,
    );

    expect(response.ok).toBe(false);
    expect(response.error).toContain('Unauthorized');
  });

  it('rejects privileged method "export" from an untrusted content-script sender', async () => {
    const unprivilegedSender = {
      id: 'recalllc-test',
      url: 'https://leetcode.com/problems/two-sum/',
    };

    const response = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'export',
      },
      unprivilegedSender,
    );

    expect(response.ok).toBe(false);
    expect(response.error).toContain('Unauthorized: method "export" is restricted to extension pages');
  });

  it('rejects privileged method "update-settings" from an untrusted content-script sender', async () => {
    const unprivilegedSender = {
      id: 'recalllc-test',
      url: 'https://leetcode.com/problems/two-sum/',
    };

    const response = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'update-settings',
        payload: { securityAuthEnabled: false },
      },
      unprivilegedSender,
    );

    expect(response.ok).toBe(false);
    expect(response.error).toContain('Unauthorized');
  });

  it('allows privileged method "export" from an internal extension page', async () => {
    const extensionSender = {
      id: 'recalllc-test',
      url: 'chrome-extension://recalllc-test/src/dashboard/index.html#/settings',
      origin: 'chrome-extension://recalllc-test',
    };

    const response = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'export',
      },
      extensionSender,
    );

    expect(response.ok).toBe(true);
    expect((response.data as { format: string }).format).toBe('recalllc-backup');
  });

  it('allows unprivileged method "get-reminder" from content script', async () => {
    const contentScriptSender = {
      id: 'recalllc-test',
      url: 'https://leetcode.com/problems/two-sum/',
    };

    const response = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'get-reminder',
        payload: { currentSlug: 'two-sum' },
      },
      contentScriptSender,
    );

    expect(response.ok).toBe(true);
  });

  it('validates URLs in "open-problem" and rejects malicious schemes and external domains', async () => {
    const extensionSender = {
      url: 'chrome-extension://recalllc-test/src/popup/index.html',
    };

    // Rejects evil.com
    const resEvil = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'open-problem',
        payload: { url: 'https://evil.com/fake-problem' },
      },
      extensionSender,
    );
    expect(resEvil.ok).toBe(false);
    expect(resEvil.error).toContain('Refusing to open an unexpected URL');

    // Rejects subdomains spoofing leetcode.com
    const resSpoof = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'open-problem',
        payload: { url: 'https://leetcode.com.attacker.com/' },
      },
      extensionSender,
    );
    expect(resSpoof.ok).toBe(false);

    // Rejects javascript:
    const resJs = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'open-problem',
        payload: { url: 'javascript:alert(1)' },
      },
      extensionSender,
    );
    expect(resJs.ok).toBe(false);

    // Accepts valid leetcode.com
    const resValid = await dispatch(
      {
        channel: MESSAGE_CHANNEL,
        method: 'open-problem',
        payload: { url: 'https://leetcode.com/problems/two-sum/' },
      },
      extensionSender,
    );
    expect(resValid.ok).toBe(true);
  });
});
