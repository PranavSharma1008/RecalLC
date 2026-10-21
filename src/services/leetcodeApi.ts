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

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new Error(
      `Could not reach LeetCode: ${error instanceof Error ? error.message : 'network error'}. ` +
        'Check your connection and try again.',
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('LeetCode refused the request. Open leetcode.com in a tab and try again.');
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
export async function fetchCatalogViaGraphQL(): Promise<LeetCodeProblemMeta[]> {
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
  return questions.map((question) => ({
    slug: question.titleSlug,
    title: question.title,
    difficulty: mapDifficulty(question.difficulty),
    topics: (question.topicTags ?? []).map((tag) => tag.name).filter(Boolean),
    paidOnly: Boolean(question.paidOnly),
  }));
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
export async function fetchCatalogViaLegacyApi(): Promise<LeetCodeProblemMeta[]> {
  const response = await fetch(LEGACY_CATALOG_ENDPOINT, {
    method: 'GET',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`The public problem list responded with HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as { stat_status_pairs?: LegacyCatalogEntry[] };
  const pairs = payload?.stat_status_pairs ?? [];
  return pairs.map((pair) => ({
    slug: pair.stat?.question__title_slug ?? '',
    title: pair.stat?.question__title ?? '',
    difficulty: mapDifficultyLevel(pair.difficulty?.level),
    topics: [],
    paidOnly: Boolean(pair.paid_only),
  }));
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
export async function fetchSubmissionHistory(limit: number): Promise<LeetCodeSubmission[]> {
  const collected: LeetCodeSubmission[] = [];
  const pageSize = 50;
  let offset = 0;
  let hasNext = true;

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
        // LeetCode returns seconds.
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
