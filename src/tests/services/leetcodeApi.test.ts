import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchCatalogViaGraphQL,
  fetchCatalogViaLegacyApi,
  fetchSubmissionHistory,
  statusToAccepted,
} from '../../services/leetcodeApi';

describe('statusToAccepted', () => {
  it('identifies accepted status', () => {
    expect(statusToAccepted('Accepted')).toBe(true);
    expect(statusToAccepted('accepted')).toBe(true);
    expect(statusToAccepted(' ACCEPTED ')).toBe(true);
  });

  it('identifies various submission failure statuses', () => {
    expect(statusToAccepted('Wrong Answer')).toBe(false);
    expect(statusToAccepted('Runtime Error')).toBe(false);
    expect(statusToAccepted('Time Limit Exceeded')).toBe(false);
    expect(statusToAccepted('Memory Limit Exceeded')).toBe(false);
    expect(statusToAccepted('Output Limit Exceeded')).toBe(false);
    expect(statusToAccepted('Compilation Error')).toBe(false);
    expect(statusToAccepted('Answer Too Long')).toBe(false);
  });

  it('handles pending / judging states as null', () => {
    expect(statusToAccepted('Pending')).toBeNull();
    expect(statusToAccepted('judging')).toBeNull();
  });

  it('returns null for empty, undefined, or unrecognised values', () => {
    expect(statusToAccepted(null)).toBeNull();
    expect(statusToAccepted(undefined)).toBeNull();
    expect(statusToAccepted('')).toBeNull();
    expect(statusToAccepted('some arbitrary status')).toBeNull();
  });
});

describe('fetchCatalogViaLegacyApi', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and maps public problems with correct difficulty levels', async () => {
    const mockPayload = {
      stat_status_pairs: [
        {
          stat: { question__title_slug: 'two-sum', question__title: 'Two Sum' },
          difficulty: { level: 1 },
          paid_only: false,
        },
        {
          stat: { question__title_slug: 'add-two-numbers', question__title: 'Add Two Numbers' },
          difficulty: { level: 2 },
          paid_only: false,
        },
        {
          stat: { question__title_slug: 'median-of-two-sorted-arrays', question__title: 'Median of Two Sorted Arrays' },
          difficulty: { level: 3 },
          paid_only: true,
        },
        {
          stat: { question__title_slug: 'unknown-prob', question__title: 'Unknown Problem' },
          difficulty: { level: 99 },
          paid_only: false,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload,
    } as Response);

    const catalog = await fetchCatalogViaLegacyApi();
    expect(catalog).toHaveLength(4);

    expect(catalog[0]).toEqual({
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      topics: [],
      paidOnly: false,
    });
    expect(catalog[1]?.difficulty).toBe('Medium');
    expect(catalog[2]?.difficulty).toBe('Hard');
    expect(catalog[2]?.paidOnly).toBe(true);
    expect(catalog[3]?.difficulty).toBe('Unknown');
  });

  it('throws an informative error on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchCatalogViaLegacyApi()).rejects.toThrow(/HTTP 500/);
  });
});

describe('fetchCatalogViaGraphQL', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and maps catalogue with topics via GraphQL', async () => {
    const mockPayload = {
      data: {
        problemsetQuestionList: {
          questions: [
            {
              titleSlug: 'two-sum',
              title: 'Two Sum',
              difficulty: 'Easy',
              topicTags: [{ name: 'Array' }, { name: 'Hash Table' }],
              paidOnly: false,
            },
          ],
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload,
    } as Response);

    const catalog = await fetchCatalogViaGraphQL();
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toEqual({
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      topics: ['Array', 'Hash Table'],
      paidOnly: false,
    });
  });

  it('handles 403 / 401 gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    await expect(fetchCatalogViaGraphQL()).rejects.toThrow(/refused the request/i);
  });

  it('handles GraphQL error messages', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: 'Rate limit exceeded' }] }),
    } as Response);

    await expect(fetchCatalogViaGraphQL()).rejects.toThrow(/Rate limit exceeded/);
  });
});

describe('fetchSubmissionHistory', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and paginates submission history up to the limit', async () => {
    const page1 = {
      data: {
        submissionList: {
          hasNext: true,
          submissions: [
            {
              id: '101',
              timestamp: 1700000000,
              lang: 'python3',
              isPending: false,
              status: 'Accepted',
              question: { titleSlug: 'two-sum', title: 'Two Sum' },
            },
            {
              id: '102',
              timestamp: 1700000100,
              lang: 'java',
              isPending: false,
              status: 'Wrong Answer',
              question: { titleSlug: 'coin-change', title: 'Coin Change' },
            },
          ],
        },
      },
    };

    const page2 = {
      data: {
        submissionList: {
          hasNext: false,
          submissions: [
            {
              id: '103',
              timestamp: 1700000200,
              lang: 'cpp',
              isPending: false,
              status: 'Accepted',
              question: { titleSlug: '3sum', title: '3Sum' },
            },
          ],
        },
      },
    };

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => (callCount === 1 ? page1 : page2),
      } as Response;
    });

    const history = await fetchSubmissionHistory(10);
    expect(history).toHaveLength(3);
    expect(history[0]).toEqual({
      id: '101',
      timestamp: 1700000000000, // converted from seconds to ms
      language: 'python3',
      status: 'Accepted',
      pending: false,
      slug: 'two-sum',
      title: 'Two Sum',
    });
    expect(history[1]?.slug).toBe('coin-change');
    expect(history[2]?.slug).toBe('3sum');
  });

  it('respects the requested limit when submissions exceed it', async () => {
    const page = {
      data: {
        submissionList: {
          hasNext: true,
          submissions: [
            { id: '1', timestamp: 1700000001, question: { titleSlug: 'p1', title: 'P1' } },
            { id: '2', timestamp: 1700000002, question: { titleSlug: 'p2', title: 'P2' } },
            { id: '3', timestamp: 1700000003, question: { titleSlug: 'p3', title: 'P3' } },
          ],
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => page,
    } as Response);

    const history = await fetchSubmissionHistory(2);
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.id)).toEqual(['1', '2']);
  });
});
