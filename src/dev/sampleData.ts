/**
 * DEVELOPMENT ONLY — sample data.
 *
 * This module is never imported by production code paths. The dashboard
 * references it through a `import.meta.env.DEV`-guarded dynamic import, so
 * the chunk is dropped from the production bundle entirely.
 *
 * The sample data is *never* mixed with real user data: it is written into
 * the same store, but only ever behind an explicit "Load demo data" action
 * in a development build, and it is clearly labelled in the UI.
 */

import type { NormalizedAttempt } from '../types';

const DAY = 24 * 60 * 60 * 1000;

const BASE = Date.UTC(2026, 9, 21, 9, 0, 0);

interface SampleRow {
  slug: string;
  title: string;
  daysAgo: number;
  accepted: boolean;
  language: string;
  submissionId: string;
}

const ROWS: SampleRow[] = [
  { slug: 'two-sum', title: 'Two Sum', daysAgo: 12, accepted: true, language: 'python3', submissionId: 'demo-1' },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    daysAgo: 9,
    accepted: true,
    language: 'java',
    submissionId: 'demo-2',
  },
  {
    slug: 'climbing-stairs',
    title: 'Climbing Stairs',
    daysAgo: 6,
    accepted: false,
    language: 'cpp',
    submissionId: 'demo-3',
  },
  {
    slug: 'climbing-stairs',
    title: 'Climbing Stairs',
    daysAgo: 5,
    accepted: true,
    language: 'cpp',
    submissionId: 'demo-4',
  },
  {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    daysAgo: 4,
    accepted: true,
    language: 'python3',
    submissionId: 'demo-5',
  },
  { slug: 'coin-change', title: 'Coin Change', daysAgo: 3, accepted: true, language: 'java', submissionId: 'demo-6' },
  {
    slug: 'number-of-islands',
    title: 'Number of Islands',
    daysAgo: 2,
    accepted: false,
    language: 'typescript',
    submissionId: 'demo-7',
  },
  {
    slug: 'number-of-islands',
    title: 'Number of Islands',
    daysAgo: 1,
    accepted: true,
    language: 'typescript',
    submissionId: 'demo-8',
  },
  {
    slug: 'word-search',
    title: 'Word Search',
    daysAgo: 1,
    accepted: true,
    language: 'python3',
    submissionId: 'demo-9',
  },
  {
    slug: 'course-schedule',
    title: 'Course Schedule',
    daysAgo: 0,
    accepted: true,
    language: 'cpp',
    submissionId: 'demo-10',
  },
];

/** Sample attempts, relative to a fixed reference date. */
export const SAMPLE_ATTEMPTS: NormalizedAttempt[] = ROWS.map((row, index) => ({
  slug: row.slug,
  title: row.title,
  url: `https://leetcode.com/problems/${row.slug}/`,
  attemptedAt: BASE - row.daysAgo * DAY - index * 60_000,
  accepted: row.accepted,
  language: row.language,
  submissionId: row.submissionId,
  source: 'import',
  warnings: [],
}));

/** A JSON document in the documented import format, for the dev importer. */
export function sampleImportJson(): string {
  return JSON.stringify(
    SAMPLE_ATTEMPTS.map((attempt) => ({
      slug: attempt.slug,
      title: attempt.title,
      url: attempt.url,
      attemptedAt: attempt.attemptedAt,
      accepted: attempt.accepted,
      language: attempt.language,
      submissionId: attempt.submissionId,
    })),
    null,
    2,
  );
}
