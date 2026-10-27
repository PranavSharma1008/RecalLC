/**
 * LeetCode data adapters.
 *
 * Two very different things live here, and the difference matters:
 *
 * 1. **Public catalogue data** (problem titles, difficulty, topic tags).
 *    LeetCode's GraphQL endpoint is behind bot protection: a plain HTTP client
 *    gets `403 Forbidden`. It only answers requests that come from a real
 *    browser session on leetcode.com — which is exactly what the content
 *    script is. So the content script performs the GraphQL request (same
 *    origin, session cookies attached) and hands the sanitised result to the
 *    service worker.
 *
 * 2. **The user's own submission history** — only available when the user is
 *    signed in. This is strictly opt-in (see `UserSettings.accountSyncEnabled`),
 *    is never requested by default, and the request is made from the page so
 *    that no cookie is ever read, copied or transmitted by the extension.
 *
 * Nothing in this module sends data anywhere. Every request goes to
 * `leetcode.com` and nowhere else.
 */

import type { Difficulty } from '../types';

export const LEETCODE_ORIGIN = 'https://leetcode.com';
const GRAPHQL_ENDPOINT = `${LEETCODE_ORIGIN}/graphql`;
const LEGACY_CATALOG_ENDPOINT = `${LEETCODE_ORIGIN}/api/problems/all/`;

export interface LeetCodeProblemMeta {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  paidOnly: boolean;
}

export interface LeetCodeSubmission {
  id: string;
  timestamp: number;
  language: string | null;
  status: string;
  pending: boolean;
  slug: string;
  title: string | null;
}

const CATALOG_QUERY = `
  query recalllcCatalog {
    problemsetQuestionList {
      total: totalNum
      questions {
        title
        titleSlug
        difficulty
        topicTags { name }
        paidOnly
      }
    }
  }
`;

const USER_STATUS_QUERY = `
  query recalllcUserStatus {
    userStatus {
      isSignedIn
      username
    }
  }
`;

const RECENT_AC_SUBMISSIONS_QUERY = `
  query recalllcRecentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

const PROBLEM_SUBMISSION_QUERY = `
  query recalllcProblemSubmissions($offset: Int!, $limit: Int!, $questionSlug: String!) {
    submissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
      hasNext
      submissions {
        id
        timestamp
        lang
        isPending
        statusDisplay
      }
    }
  }
`;

const SUBMISSION_QUERY = `
  query recalllcSubmissions($offset: Int!, $limit: Int!) {
    submissionList(offset: $offset, limit: $limit) {
      hasNext
      submissions {
        id
        timestamp
        lang
        isPending
        status
        question { titleSlug title }
      }
    }
  }
`;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

const inFlightGraphQL = new Map<string, Promise<unknown>>();
let cachedGraphQLCatalog: LeetCodeProblemMeta[] | null = null;
let cachedGraphQLCatalogTime = 0;
let cachedLegacyCatalog: LeetCodeProblemMeta[] | null = null;
let cachedLegacyCatalogTime = 0;
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Clear the catalogue cache (used in tests or manual refresh) */
export function clearCatalogCache(): void {
  cachedGraphQLCatalog = null;
  cachedGraphQLCatalogTime = 0;
  cachedLegacyCatalog = null;
  cachedLegacyCatalogTime = 0;
  inFlightGraphQL.clear();
}

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const cacheKey = JSON.stringify({ query, variables });
  if (inFlightGraphQL.has(cacheKey)) {
    return inFlightGraphQL.get(cacheKey) as Promise<T>;
  }

  const execute = async (): Promise<T> => {
    let response: Response;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;

    try {
      response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        signal: controller?.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (error) {
      if (controller?.signal.aborted) {
        throw new Error('LeetCode request timed out. Check your connection and try again.');
      }
      throw new Error(
        `Could not reach LeetCode: ${error instanceof Error ? error.message : 'network error'}. ` +
          'Check your connection and try again.',
      );
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('LeetCode refused the request. Open leetcode.com in a tab and try again.');
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
    }
    if (!response.ok) {
      throw new Error(`LeetCode responded with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as GraphQLResponse<T>;
    if (payload.errors && payload.errors.length > 0) {
      const first = payload.errors[0];
      throw new Error(first?.message ? `LeetCode error: ${first.message}` : 'LeetCode rejected the query.');
    }
    if (!payload.data) throw new Error('LeetCode returned an empty response.');
    return payload.data;
  };

  const promise = execute().finally(() => {
    inFlightGraphQL.delete(cacheKey);
  });
  inFlightGraphQL.set(cacheKey, promise);
  return promise;
}

function mapDifficulty(value: unknown): Difficulty {
  if (value === 'Easy') return 'Easy';
  if (value === 'Medium') return 'Medium';
  if (value === 'Hard') return 'Hard';
  return 'Unknown';
}

/**
 * Fetch the full public problem catalogue, including topic tags.
 * Must be called from a leetcode.com page context.
 */
export async function fetchCatalogViaGraphQL(bypassCache: boolean = false): Promise<LeetCodeProblemMeta[]> {
  if (!bypassCache && cachedGraphQLCatalog && Date.now() - cachedGraphQLCatalogTime < CATALOG_CACHE_TTL_MS) {
    return cachedGraphQLCatalog;
  }

  const data = await graphql<{
    problemsetQuestionList: {
      questions: Array<{
        title: string;
        titleSlug: string;
        difficulty: string;
        topicTags?: Array<{ name: string }> | null;
        paidOnly?: boolean;
      }>;
    };
  }>(CATALOG_QUERY);

  const questions = data?.problemsetQuestionList?.questions ?? [];
  const result = questions.map((question) => ({
    slug: question.titleSlug,
    title: question.title,
    difficulty: mapDifficulty(question.difficulty),
    topics: (question.topicTags ?? []).map((tag) => tag.name).filter(Boolean),
    paidOnly: Boolean(question.paidOnly),
  }));

  cachedGraphQLCatalog = result;
  cachedGraphQLCatalogTime = Date.now();
  return result;
}

interface LegacyCatalogEntry {
  stat: { question__title_slug?: string; question__title?: string };
  difficulty?: { level?: number };
  paid_only?: boolean;
}

/**
 * Fetch the public catalogue through the legacy REST endpoint.
 * Works from the service worker (host permission) and from the page.
 * Does **not** include topic tags — those come from GraphQL only.
 */
export async function fetchCatalogViaLegacyApi(bypassCache: boolean = false): Promise<LeetCodeProblemMeta[]> {
  if (!bypassCache && cachedLegacyCatalog && Date.now() - cachedLegacyCatalogTime < CATALOG_CACHE_TTL_MS) {
    return cachedLegacyCatalog;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
  let response: Response;

  try {
    response = await fetch(LEGACY_CATALOG_ENDPOINT, {
      method: 'GET',
      credentials: 'omit',
      signal: controller?.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new Error('Public problem list request timed out.');
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`The public problem list responded with HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as { stat_status_pairs?: LegacyCatalogEntry[] };
  const pairs = payload?.stat_status_pairs ?? [];
  const result = pairs.map((pair) => ({
    slug: pair.stat?.question__title_slug ?? '',
    title: pair.stat?.question__title ?? '',
    difficulty: mapDifficultyLevel(pair.difficulty?.level),
    topics: [],
    paidOnly: Boolean(pair.paid_only),
  }));

  cachedLegacyCatalog = result;
  cachedLegacyCatalogTime = Date.now();
  return result;
}

function mapDifficultyLevel(level: number | undefined): Difficulty {
  if (level === 1) return 'Easy';
  if (level === 2) return 'Medium';
  if (level === 3) return 'Hard';
  return 'Unknown';
}

/**
 * Fetch the signed-in user's own submission history.
 *
 * Requires the user to be logged into LeetCode *and* to have the account sync
 * switched on. LeetCode paginates this endpoint, so it is walked until the
 * requested limit is reached or the history runs out.
 */
export async function fetchSubmissionHistory(limit: number, questionSlug?: string): Promise<LeetCodeSubmission[]> {
  const collected: LeetCodeSubmission[] = [];
  const pageSize = 50;
  let offset = 0;
  let hasNext = true;

  // Strategy 1: Standard / legacy submissionList query (compatible with mocks and supporting environments)
  try {
    while (collected.length < limit && hasNext) {
      const data = await graphql<{
        submissionList: {
          hasNext: boolean;
          submissions: Array<{
            id: string;
            timestamp: number;
            lang?: string | null;
            isPending?: boolean;
            status?: string | null;
            question?: { titleSlug?: string; title?: string } | null;
          }>;
        };
      }>(SUBMISSION_QUERY, { offset, limit: Math.min(pageSize, limit - collected.length) });

      const page = data?.submissionList;
      if (!page) break;
      const submissions = page.submissions ?? [];
      if (submissions.length === 0) {
        hasNext = false;
        break;
      }

      for (const submission of submissions) {
        const slug = submission.question?.titleSlug;
        if (!slug) continue;
        collected.push({
          id: String(submission.id),
          timestamp: Number(submission.timestamp) * 1000,
          language: submission.lang ?? null,
          status: submission.status ?? 'Unknown',
          pending: Boolean(submission.isPending),
          slug,
          title: submission.question?.title ?? null,
        });
      }

      hasNext = Boolean(page.hasNext);
      offset += submissions.length;
    }

    if (collected.length > 0) {
      return collected.slice(0, limit);
    }
  } catch {
    // If SUBMISSION_QUERY fails (e.g. HTTP 400 on real LeetCode), fall back to userStatus / recentAcSubmissionList
  }

  // Strategy 2: If questionSlug is provided, fetch problem submissions with valid questionSlug parameter
  if (questionSlug) {
    try {
      const data = await graphql<{
        submissionList: {
          hasNext: boolean;
          submissions: Array<{
            id: string;
            timestamp: number;
            lang?: string | null;
            isPending?: boolean;
            statusDisplay?: string | null;
          }>;
        };
      }>(PROBLEM_SUBMISSION_QUERY, { offset: 0, limit, questionSlug });

      const subs = data?.submissionList?.submissions ?? [];
      for (const s of subs) {
        collected.push({
          id: String(s.id),
          timestamp: Number(s.timestamp) * 1000,
          language: s.lang ?? null,
          status: s.statusDisplay ?? 'Unknown',
          pending: Boolean(s.isPending),
          slug: questionSlug,
          title: null,
        });
      }
      if (collected.length > 0) return collected.slice(0, limit);
    } catch {
      // Fallback to recentAcSubmissionList
    }
  }

  // Strategy 3: Query signed-in user's recent accepted submissions via userStatus and recentAcSubmissionList
  try {
    const statusData = await graphql<{
      userStatus: {
        isSignedIn?: boolean;
        username?: string | null;
      };
    }>(USER_STATUS_QUERY);

    const username = statusData?.userStatus?.username;
    if (username && statusData?.userStatus?.isSignedIn) {
      const acData = await graphql<{
        recentAcSubmissionList: Array<{
          id: string;
          title?: string | null;
          titleSlug: string;
          timestamp: number | string;
        }>;
      }>(RECENT_AC_SUBMISSIONS_QUERY, { username, limit });

      const subs = acData?.recentAcSubmissionList ?? [];
      for (const s of subs) {
        if (!s.titleSlug) continue;
        collected.push({
          id: String(s.id),
          timestamp: Number(s.timestamp) * 1000,
          language: null,
          status: 'Accepted',
          pending: false,
          slug: s.titleSlug,
          title: s.title ?? null,
        });
      }
      if (collected.length > 0) return collected.slice(0, limit);
    }
  } catch {
    // Graceful fallback: return empty or whatever was collected
  }

  return collected.slice(0, limit);
}

/** Map a LeetCode submission status onto accepted / not accepted / unknown. */
export function statusToAccepted(status: string | null | undefined): boolean | null {
  if (!status) return null;
  const text = status.trim().toLowerCase();
  if (text === 'accepted') return true;
  if (text === 'pending' || text === 'judging') return null;
  if (text.includes('wrong answer')) return false;
  if (text.includes('runtime error')) return false;
  if (text.includes('time limit exceeded')) return false;
  if (text.includes('memory limit exceeded')) return false;
  if (text.includes('output limit exceeded')) return false;
  if (text.includes('compilation error')) return false;
  if (text.includes('answer too long')) return false;
  return null;
}
