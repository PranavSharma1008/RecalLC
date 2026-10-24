/**
 * Vitest setup.
 *
 * Provides a minimal but faithful `chrome.*` mock and an in-memory
 * IndexedDB (fake-indexeddb), so the repository tests exercise the *real*
 * database code path — including schema versioning — rather than a stub.
 */

import 'fake-indexeddb/auto';

/* ------------------------------------------------------------ chrome mock */

class MockStorageArea {
  private data = new Map<string, unknown>();

  async get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
    if (keys === undefined || keys === null) {
      return Object.fromEntries(this.data.entries());
    }
    const list = Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const key of list) {
      if (this.data.has(key)) result[key] = this.data.get(key);
    }
    return result;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) this.data.set(key, value);
  }

  async remove(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

const localStorageArea = new MockStorageArea();

const messageListeners: Array<
  (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
> = [];

export function getMessageListeners() {
  return [...messageListeners];
}

interface MockChrome {
  storage: { local: MockStorageArea };
  runtime: {
    id: string;
    sendMessage: (message: unknown) => Promise<unknown>;
    getURL: (path: string) => string;
    onMessage: { addListener: (listener: unknown) => void };
    onInstalled: { addListener: (listener: unknown) => void };
  };
  tabs: { create: (options: { url: string }) => Promise<unknown> };
}

const mockChrome: MockChrome = {
  storage: { local: localStorageArea },
  runtime: {
    id: 'recalllc-test',
    sendMessage: async () => ({ ok: true, data: null }),
    getURL: (path: string) => `chrome-extension://recalllc-test/${path.replace(/^\//, '')}`,
    onMessage: {
      addListener: (listener: unknown) => {
        if (typeof listener === 'function') {
          messageListeners.push(listener as never);
        }
      },
    },
    onInstalled: { addListener: () => undefined },
  },
  tabs: {
    create: async () => ({ id: 1 }),
  },
};

(globalThis as unknown as { chrome?: MockChrome }).chrome = mockChrome;

/* ------------------------------------------------------------------ reset */

/** Clear the mocked extension storage between tests. */
export async function resetChromeStorage(): Promise<void> {
  await localStorageArea.clear();
}
