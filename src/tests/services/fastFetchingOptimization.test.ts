import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { callService, invalidateServiceCache } from '../../services/messaging';
import { clearCatalogCache, fetchCatalogViaGraphQL, fetchCatalogViaLegacyApi } from '../../services/leetcodeApi';
import { clearSettingsCache, readSettings, writeSettings } from '../../services/storage';

describe('Fast Fetching, Request Coalescing & Response Acceleration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    invalidateServiceCache();
    clearCatalogCache();
    clearSettingsCache();
  });

  afterEach(() => {
    invalidateServiceCache();
    clearCatalogCache();
    clearSettingsCache();
  });

  describe('Service Messaging Acceleration (callService)', () => {
    it('coalesces concurrent requests for identical read methods into a single IPC message', async () => {
      let callCount = 0;
      const mockSendMessage = vi.fn().mockImplementation(async () => {
        callCount++;
        // Simulate a small delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          ok: true,
          data: { dueToday: 3, overdue: 1, totalProblems: 10 },
        };
      });

      globalThis.chrome = {
        runtime: {
          sendMessage: mockSendMessage,
        },
      } as unknown as typeof chrome;

      // Invoke stats concurrently from 4 separate callers (simulating dashboard and tabs mounting)
      const [res1, res2, res3, res4] = await Promise.all([
        callService('stats'),
        callService('stats'),
        callService('stats'),
        callService('stats'),
      ]);

      // All 4 callers receive identical responses
      expect(res1).toEqual(res2);
      expect(res2).toEqual(res3);
      expect(res3).toEqual(res4);
      expect(res1).toEqual({ dueToday: 3, overdue: 1, totalProblems: 10 });

      // Only ONE IPC message was sent across the wire
      expect(callCount).toBe(1);
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it('returns responses in 0ms from in-memory cache for consecutive read queries', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({
        ok: true,
        data: [{ slug: 'two-sum', dueAt: Date.now() }],
      });

      globalThis.chrome = {
        runtime: {
          sendMessage: mockSendMessage,
        },
      } as unknown as typeof chrome;

      const firstResult = await callService('list-due');
      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Second consecutive read happens immediately
      const secondResult = await callService('list-due');
      expect(mockSendMessage).toHaveBeenCalledTimes(1); // Served from cache!
      expect(secondResult).toEqual(firstResult);
    });

    it('immediately invalidates read cache when a mutation method is called', async () => {
      let sendCount = 0;
      const mockSendMessage = vi.fn().mockImplementation(async (envelope: { method: string }) => {
        sendCount++;
        if (envelope.method === 'save-problem') {
          return { ok: true, data: { slug: 'three-sum', title: '3Sum' } };
        }
        return { ok: true, data: { totalProblems: sendCount } };
      });

      globalThis.chrome = {
        runtime: {
          sendMessage: mockSendMessage,
        },
      } as unknown as typeof chrome;

      // First read: caches result
      await callService('stats');
      expect(sendCount).toBe(1);

      // Second read: uses cache
      await callService('stats');
      expect(sendCount).toBe(1);

      // Execute a write mutation
      await callService('save-problem', { slug: 'three-sum', title: '3Sum' });
      expect(sendCount).toBe(2);

      // Next read MUST bypass cache because a mutation occurred
      const freshStats = await callService('stats');
      expect(sendCount).toBe(3);
      expect(freshStats).toEqual({ totalProblems: 3 });
    });
  });

  describe('LeetCode Network API Caching & Deduping', () => {
    it('coalesces concurrent GraphQL catalogue requests and caches result for subsequent callers', async () => {
      let fetchCount = 0;
      const mockPayload = {
        data: {
          problemsetQuestionList: {
            questions: [
              {
                title: 'Two Sum',
                titleSlug: 'two-sum',
                difficulty: 'Easy',
                topicTags: [{ name: 'Array' }, { name: 'Hash Table' }],
                paidOnly: false,
              },
            ],
          },
        },
      };

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 10));
        return {
          ok: true,
          status: 200,
          json: async () => mockPayload,
        } as Response;
      });

      // 3 concurrent calls
      const [cat1, cat2, cat3] = await Promise.all([
        fetchCatalogViaGraphQL(),
        fetchCatalogViaGraphQL(),
        fetchCatalogViaGraphQL(),
      ]);

      expect(fetchCount).toBe(1);
      expect(cat1).toHaveLength(1);
      expect(cat1).toEqual(cat2);
      expect(cat2).toEqual(cat3);

      // Subsequent call uses in-memory TTL cache (no network fetch)
      const cat4 = await fetchCatalogViaGraphQL();
      expect(fetchCount).toBe(1);
      expect(cat4).toEqual(cat1);
    });

    it('caches legacy catalog in memory and respects clearCatalogCache', async () => {
      let legacyCount = 0;
      const mockLegacy = {
        stat_status_pairs: [
          {
            stat: { question__title_slug: 'two-sum', question__title: 'Two Sum' },
            difficulty: { level: 1 },
            paid_only: false,
          },
        ],
      };

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        legacyCount++;
        return {
          ok: true,
          status: 200,
          json: async () => mockLegacy,
        } as Response;
      });

      const first = await fetchCatalogViaLegacyApi();
      expect(legacyCount).toBe(1);

      // Cached hit
      const second = await fetchCatalogViaLegacyApi();
      expect(legacyCount).toBe(1);
      expect(second).toEqual(first);

      // Invalidate cache
      clearCatalogCache();
      const third = await fetchCatalogViaLegacyApi();
      expect(legacyCount).toBe(2);
      expect(third).toEqual(first);
    });
  });

  describe('Storage In-Memory Acceleration', () => {
    it('serves settings instantly from in-memory cache on consecutive reads', async () => {
      let getCount = 0;
      const fakeStorage = {
        get: vi.fn().mockImplementation(async () => {
          getCount++;
          return { 'recalllc:settings': { theme: 'dark', remindersEnabled: true } };
        }),
        set: vi.fn().mockResolvedValue(undefined),
      };

      globalThis.chrome = {
        storage: {
          local: fakeStorage,
        },
      } as unknown as typeof chrome;

      const s1 = await readSettings();
      expect(getCount).toBe(1);
      expect(s1.theme).toBe('dark');

      const s2 = await readSettings();
      expect(getCount).toBe(1); // Cached! No storage I/O
      expect(s2.theme).toBe('dark');

      // Writing settings updates the in-memory cache directly
      await writeSettings({ theme: 'light' });
      const s3 = await readSettings();
      expect(s3.theme).toBe('light');
    });
  });
});
