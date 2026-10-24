/**
 * History normaliser — turns an arbitrary imported record into a validated
 * {@link NormalizedAttempt}.
 *
 * Imported files are **untrusted input**: every field is treated as a string
 * of unknown shape, validated, and either accepted with a normalised value or
 * rejected with a human-readable reason.
 */

import type { AttemptSource, Difficulty, NormalizedAttempt } from '../types';
import { normalizeSlug, problemUrl, titleFromSlug } from '../utils/slug';
import { describeAmbiguity, normalizeTimestamp } from '../utils/time';

export type RawRecord = Record<string, unknown>;

/** Accepted spellings for each logical field. */
const FIELD_ALIASES = {
  slug: [
    'slug',
    'titleslug',
    'title_slug',
    'problemslug',
    'problem_slug',
    'questionslug',
    'question_slug',
    'name',
    'problem',
    'question',
  ],
  title: ['title', 'problemtitle', 'problem_title', 'questiontitle', 'question_title', 'name', 'problemname'],
  url: ['url', 'problemurl', 'problem_url', 'link', 'href', 'uri'],
  attemptedAt: [
    'attemptedat',
    'attempted_at',
    'timestamp',
    'time',
    'date',
    'datetime',
    'createdat',
    'created_at',
    'submittedat',
    'submitted_at',
    'submissiontime',
    'submission_time',
    'lastattempted',
    'last_attempted',
    'lastattempt',
    'last_attempt',
    'solvedat',
    'solved_at',
  ],
  accepted: [
    'accepted',
    'isaccepted',
    'is_accepted',
    'success',
    'succeeded',
    'solved',
    'status',
    'result',
    'verdict',
    'outcome',
  ],
  language: ['language', 'lang', 'programminglanguage', 'programming_language', 'languageid', 'language_id'],
  submissionId: ['submissionid', 'submission_id', 'subid', 'sub_id', 'id', 'submission'],
  difficulty: ['difficulty', 'level'],
  topics: ['topics', 'tags', 'topictags', 'topic_tags', 'category'],
} as const;

type FieldKey = keyof typeof FIELD_ALIASES;

function normaliseKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '');
}

function pickField(record: RawRecord, key: FieldKey): unknown {
  const index = new Map<string, unknown>();
  for (const [rawKey, value] of Object.entries(record)) {
    index.set(normaliseKey(rawKey), value);
  }
  for (const alias of FIELD_ALIASES[key]) {
    const value = index.get(alias);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

/** Map a free-form "accepted" value onto true / false / unknown. */
export function parseAccepted(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (
    [
      'true',
      'yes',
      'y',
      '1',
      'accepted',
      'accept',
      'success',
      'succeeded',
      'solved',
      'ac',
      'ok',
      'pass',
      'passed',
    ].includes(text)
  ) {
    return true;
  }
  if (
    [
      'false',
      'no',
      'n',
      '0',
      'failed',
      'fail',
      'wrong answer',
      'wrong',
      'runtime error',
      'time limit exceeded',
      'memory limit exceeded',
      'output limit exceeded',
      'compilation error',
      'answer too long',
      'unsolved',
      'rejected',
    ].includes(text)
  ) {
    return false;
  }
  if (['pending', 'judging', 'queued', 'in queue', 'submitted'].includes(text)) return null;
  return null;
}

/** Map a difficulty value onto the canonical difficulty. */
export function parseDifficulty(value: unknown): Difficulty | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (value === 1) return 'Easy';
    if (value === 2) return 'Medium';
    if (value === 3) return 'Hard';
    return null;
  }
  const text = String(value).trim().toLowerCase();
  if (text.startsWith('easy') || text === '1') return 'Easy';
  if (text.startsWith('medium') || text === '2') return 'Medium';
  if (text.startsWith('hard') || text === '3') return 'Hard';
  return null;
}

export type NormalizeResult = { ok: true; value: NormalizedAttempt } | { ok: false; error: string };

/**
 * Validate and normalise one raw record.
 *
 * `slug` and a timestamp are required; everything else is optional and
 * defaulted safely.
 */
export function normalizeRecord(raw: unknown, options: { source?: AttemptSource } = {}): NormalizeResult {
  if (raw === null || raw === undefined) return { ok: false, error: 'record is empty' };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'record is not an object' };
  }
  const record = raw as RawRecord;

  const rawSlug = pickField(record, 'slug');
  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    const shown = typeof rawSlug === 'string' ? `"${rawSlug.slice(0, 60)}"` : 'missing';
    return { ok: false, error: `missing or invalid slug (${shown})` };
  }

  const rawTimestamp = pickField(record, 'attemptedAt');
  const timestamp = normalizeTimestamp(rawTimestamp);
  if (!timestamp.ok) {
    return { ok: false, error: `invalid timestamp: ${timestamp.error}` };
  }

  const warnings: string[] = [];
  const ambiguity = describeAmbiguity(timestamp.ambiguity);
  if (ambiguity) warnings.push(ambiguity);

  const rawUrl = pickField(record, 'url');
  let url = typeof rawUrl === 'string' && rawUrl.trim() ? rawUrl.trim() : null;
  if (url) {
    try {
      const parsed = new URL(url);
      if (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        (parsed.hostname === 'leetcode.com' || parsed.hostname === 'www.leetcode.com')
      ) {
        url = `https://leetcode.com/problems/${slug}/`;
      } else {
        url = problemUrl(slug);
      }
    } catch {
      url = problemUrl(slug);
    }
  } else {
    url = problemUrl(slug);
  }

  const rawTitle = pickField(record, 'title');
  let title: string | null = null;
  if (typeof rawTitle === 'string' && rawTitle.trim()) {
    title = rawTitle.trim();
  } else if (rawTitle !== undefined && rawTitle !== null && typeof rawTitle !== 'string') {
    title = String(rawTitle);
  }

  const rawLanguage = pickField(record, 'language');
  const language = typeof rawLanguage === 'string' && rawLanguage.trim() ? rawLanguage.trim() : null;

  const rawSubmissionId = pickField(record, 'submissionId');
  const submissionId =
    rawSubmissionId !== undefined && rawSubmissionId !== null && String(rawSubmissionId).trim()
      ? String(rawSubmissionId).trim()
      : null;

  const accepted = parseAccepted(pickField(record, 'accepted'));
  if (accepted === null && pickField(record, 'accepted') !== undefined) {
    warnings.push('accepted flag was not recognised — treated as unknown');
  }

  const rawDifficulty = pickField(record, 'difficulty');
  const difficulty = parseDifficulty(rawDifficulty);

  const rawTopics = pickField(record, 'topics');
  let topics: string[] | undefined;
  if (Array.isArray(rawTopics)) {
    const parsedTopics = rawTopics.map((t) => String(t).trim()).filter(Boolean);
    if (parsedTopics.length > 0) topics = parsedTopics;
  } else if (typeof rawTopics === 'string' && rawTopics.trim()) {
    const parsedTopics = rawTopics
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (parsedTopics.length > 0) topics = parsedTopics;
  }

  return {
    ok: true,
    value: {
      slug,
      title: title ?? titleFromSlug(slug),
      url: url ?? problemUrl(slug),
      attemptedAt: timestamp.value,
      accepted,
      language,
      difficulty: difficulty ?? undefined,
      topics,
      submissionId,
      source: options.source ?? 'import',
      warnings,
    },
  };
}
