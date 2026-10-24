import { describe, expect, it } from 'vitest';

import { clearAll, getProblem, listAttempts, recordAttempt, restoreBackup } from '../../services/repository';
import type { BackupFile } from '../../types';
import { isSessionExpired } from '../../utils/security';

describe('Eventual Development, Corruption Recovery & Async State Resilience', () => {
  it('safely recovers and restores a corrupted backup with prototype pollution and NaN values', async () => {
    await clearAll();

    const corruptedBackup = {
      format: 'recalllc-backup',
      version: 1,
      exportedAt: Date.now(),
      problems: [
        // Valid problem
        {
          slug: 'valid-problem',
          title: 'Valid Problem',
          url: 'https://leetcode.com/problems/valid-problem/',
          difficulty: 'Medium',
          topics: ['Array', 'Hash Table'],
          notes: 'Important notes',
          firstAttemptAt: 1700000000000,
          lastAttemptAt: 1700000000000,
          attemptCount: 1,
        },
        // Corrupted item with prototype pollution and missing slug
        {
          __proto__: { polluted: true },
          constructor: { prototype: { evil: true } },
          slug: '', // Empty slug must be skipped
          title: 'Corrupted Item',
        },
        // Problem with NaN timestamps
        {
          slug: 'nan-problem',
          title: 'NaN Problem',
          difficulty: 'Unknown',
          firstAttemptAt: Number.NaN,
          lastAttemptAt: Number.NaN,
          attemptCount: -5,
        },
      ],
      attempts: [
        {
          id: 'att-1',
          slug: 'valid-problem',
          attemptedAt: 1700000000000,
          source: 'manual',
        },
        // Corrupted attempt without id or slug
        {
          id: '',
          slug: null,
          attemptedAt: 'not-a-number',
        },
      ],
      revisions: [],
      events: [],
    } as unknown as BackupFile;

    const outcome = await restoreBackup(corruptedBackup);
    expect(outcome.problems).toBe(2); // valid-problem + nan-problem (sanitized)
    expect(outcome.attempts).toBe(1); // att-1 only

    // Verify valid problem exists
    const p1 = await getProblem('valid-problem');
    expect(p1).not.toBeNull();
    expect(p1?.title).toBe('Valid Problem');
    expect(p1?.difficulty).toBe('Medium');

    // Verify nan problem was sanitized with fallback timestamp and positive attempt count
    const p2 = await getProblem('nan-problem');
    expect(p2).not.toBeNull();
    expect(Number.isFinite(p2?.firstAttemptAt)).toBe(true);
    expect(p2?.attemptCount).toBeGreaterThanOrEqual(0);

    // Verify prototype pollution failed
    // @ts-expect-error testing prototype pollution
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('handles rapid sequential attempts deterministically without duplicates', async () => {
    await clearAll();
    const baseTime = 1700000000000;

    // First attempt
    const first = await recordAttempt(
      {
        slug: 'merge-k-sorted-lists',
        attemptedAt: baseTime,
        accepted: true,
        language: 'python',
        source: 'auto',
      },
      baseTime,
    );
    expect(first.created).toBe(true);
    expect(first.duplicate).toBe(false);

    // Duplicate attempt within the same second
    const dup = await recordAttempt(
      {
        slug: 'merge-k-sorted-lists',
        attemptedAt: baseTime,
        accepted: true,
        language: 'python',
        source: 'auto',
      },
      baseTime + 100,
    );
    expect(dup.created).toBe(false);
    expect(dup.duplicate).toBe(true);

    // Attempt at a later time (new session)
    const later = await recordAttempt(
      {
        slug: 'merge-k-sorted-lists',
        attemptedAt: baseTime + 10000,
        accepted: false,
        language: 'python',
        source: 'auto',
      },
      baseTime + 10000,
    );
    expect(later.created).toBe(true);

    const attempts = await listAttempts('merge-k-sorted-lists');
    expect(attempts).toHaveLength(2);
  });

  it('safely handles session expiration boundary conditions', () => {
    // Zero or negative timeout disables auto-lock
    expect(isSessionExpired(0)).toBe(false);
    expect(isSessionExpired(-10)).toBe(false);

    // Missing timestamp expires
    expect(isSessionExpired(15)).toBe(true);
  });
});
