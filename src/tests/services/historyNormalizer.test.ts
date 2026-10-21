import { describe, expect, it } from 'vitest';

import { normalizeRecord, parseAccepted, parseDifficulty } from '../../services/historyNormalizer';

describe('parseAccepted', () => {
  it('understands booleans and numbers', () => {
    expect(parseAccepted(true)).toBe(true);
    expect(parseAccepted(false)).toBe(false);
    expect(parseAccepted(1)).toBe(true);
    expect(parseAccepted(0)).toBe(false);
  });

  it('understands verdicts', () => {
    expect(parseAccepted('Accepted')).toBe(true);
    expect(parseAccepted('accepted')).toBe(true);
    expect(parseAccepted('Wrong Answer')).toBe(false);
    expect(parseAccepted('Runtime Error')).toBe(false);
    expect(parseAccepted('Time Limit Exceeded')).toBe(false);
  });

  it('understands textual booleans', () => {
    expect(parseAccepted('true')).toBe(true);
    expect(parseAccepted('YES')).toBe(true);
    expect(parseAccepted('no')).toBe(false);
  });

  it('returns null for anything unknown', () => {
    expect(parseAccepted(null)).toBeNull();
    expect(parseAccepted(undefined)).toBeNull();
    expect(parseAccepted('')).toBeNull();
    expect(parseAccepted('Pending Judge')).toBeNull();
    expect(parseAccepted('who knows')).toBeNull();
  });
});

describe('parseDifficulty', () => {
  it('maps names and levels', () => {
    expect(parseDifficulty('Easy')).toBe('Easy');
    expect(parseDifficulty('medium')).toBe('Medium');
    expect(parseDifficulty('HARD')).toBe('Hard');
    expect(parseDifficulty(1)).toBe('Easy');
    expect(parseDifficulty(3)).toBe('Hard');
  });

  it('returns null for unknown values', () => {
    expect(parseDifficulty('')).toBeNull();
    expect(parseDifficulty('impossible')).toBeNull();
  });
});

describe('normalizeRecord', () => {
  const base = { slug: 'two-sum', attemptedAt: 1792454400000 };

  it('accepts a minimal record', () => {
    const result = normalizeRecord(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe('two-sum');
    expect(result.value.attemptedAt).toBe(1792454400000);
    expect(result.value.title).toBe('Two Sum');
    expect(result.value.url).toBe('https://leetcode.com/problems/two-sum/');
    expect(result.value.accepted).toBeNull();
    expect(result.value.language).toBeNull();
    expect(result.value.submissionId).toBeNull();
  });

  it('rejects a record without a slug', () => {
    const result = normalizeRecord({ attemptedAt: 1792454400000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/slug/i);
  });

  it('rejects a record without a timestamp', () => {
    const result = normalizeRecord({ slug: 'two-sum' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/timestamp/i);
  });

  it('rejects non-object records', () => {
    expect(normalizeRecord('nope').ok).toBe(false);
    expect(normalizeRecord(['nope']).ok).toBe(false);
    expect(normalizeRecord(null).ok).toBe(false);
  });

  it('extracts a slug from a full URL', () => {
    const result = normalizeRecord({ slug: 'https://leetcode.com/problems/two-sum/', attemptedAt: 1 });
    expect(result.ok && result.value.slug).toBe('two-sum');
  });

  it('normalises slugs that are not in canonical form', () => {
    const result = normalizeRecord({ slug: '/Two_Sum/', attemptedAt: 1 });
    expect(result.ok && result.value.slug).toBe('two-sum');
  });

  it('accepts common column aliases', () => {
    const result = normalizeRecord({
      titleSlug: 'valid-parentheses',
      timestamp: '2026-10-21',
      isAccepted: 'true',
      lang: 'java',
      submission_id: 'abc123',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe('valid-parentheses');
    expect(result.value.accepted).toBe(true);
    expect(result.value.language).toBe('java');
    expect(result.value.submissionId).toBe('abc123');
  });

  it('keeps the title and URL when supplied', () => {
    const result = normalizeRecord({
      slug: 'two-sum',
      title: 'Two Sum',
      url: 'https://leetcode.com/problems/two-sum/',
      attemptedAt: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Two Sum');
    expect(result.value.url).toBe('https://leetcode.com/problems/two-sum/');
  });

  it('flags ambiguous timestamps with a warning', () => {
    const result = normalizeRecord({ slug: 'two-sum', attemptedAt: '2026-10-21' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.warnings.join(' ')).toMatch(/local midnight/i);
  });

  it('flags an unrecognised accepted flag', () => {
    const result = normalizeRecord({ slug: 'two-sum', attemptedAt: 1, accepted: 'sort of' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accepted).toBeNull();
    expect(result.value.warnings.join(' ')).toMatch(/not recognised/i);
  });

  it('parses difficulty and topics when present', () => {
    const result = normalizeRecord({
      slug: 'two-sum',
      attemptedAt: 1792454400000,
      difficulty: 'Easy',
      topics: 'Array, Hash Table',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.difficulty).toBe('Easy');
    expect(result.value.topics).toEqual(['Array', 'Hash Table']);
  });

  it('accepts array topics and numeric difficulty levels', () => {
    const result = normalizeRecord({
      slug: 'course-schedule',
      attemptedAt: 1792454400000,
      level: 2,
      tags: ['Graph', 'Topological Sort'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.difficulty).toBe('Medium');
    expect(result.value.topics).toEqual(['Graph', 'Topological Sort']);
  });
});
