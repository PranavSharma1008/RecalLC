/**
 * The RecallLC database (IndexedDB, extension origin only).
 *
 * IMPORTANT: this module must only ever be imported from the service worker
 * or from tests. A content script's `indexedDB` resolves to the *page's*
 * origin (leetcode.com), so storing revision history there would expose it
 * to the website. The service worker owns the extension origin, so all
 * persistent reads and writes are funnelled through it.
 *
 * Schema versioning
 * -----------------
 *  v1 — problems, attempts, revisions, events, meta
 *  v2 — adds the problem catalogue cache and the import history; backfills
 *       fields that were introduced after v1 was written.
 *
 * To add a migration: declare `this.version(N+1).stores({...}).upgrade(tx => ...)`
 * and never mutate an already-released version block.
 */

import Dexie, { type Table } from 'dexie';

import type { CatalogEntry, ImportResult, Problem, ReviewEvent, RevisionRecord, SubmissionAttempt } from '../types';

export interface MetaRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  format: string;
  importedAt: number;
  result: ImportResult;
}

export const DB_NAME = 'recalllc';
export const SCHEMA_VERSION = 2;

export class RecallDatabase extends Dexie {
  problems!: Table<Problem, string>;
  attempts!: Table<SubmissionAttempt, string>;
  revisions!: Table<RevisionRecord, string>;
  events!: Table<ReviewEvent, string>;
  catalog!: Table<CatalogEntry, string>;
  imports!: Table<ImportBatch, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    this.version(1).stores({
      problems: 'slug, lastAttemptAt, difficulty, *topics',
      attempts: 'id, slug, attemptedAt, submissionId',
      revisions: 'slug, dueAt',
      events: 'id, slug, reviewedAt',
      meta: 'key',
    });

    this.version(2)
      .stores({
        problems: 'slug, lastAttemptAt, difficulty, *topics',
        attempts: 'id, slug, attemptedAt, submissionId',
        revisions: 'slug, dueAt',
        events: 'id, slug, reviewedAt',
        catalog: 'slug',
        imports: 'id, importedAt',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        await tx
          .table('problems')
          .toCollection()
          .modify((problem: Partial<Problem> & { slug: string }) => {
            if (!Array.isArray(problem.topics)) problem.topics = [];
            if (typeof problem.notes !== 'string') problem.notes = '';
            if (typeof problem.struggleScore !== 'number') problem.struggleScore = 0;
            if (typeof problem.accepted !== 'boolean' && problem.accepted !== null) problem.accepted = null;
          });
      });
  }
}

let singleton: RecallDatabase | null = null;

/** Shared database handle for the service worker. */
export function getDb(): RecallDatabase {
  if (!singleton) singleton = new RecallDatabase();
  return singleton;
}

/** Create an isolated database — used by tests. */
export function createDatabase(name: string = DB_NAME): RecallDatabase {
  return new RecallDatabase(name);
}

/** Close and forget the shared handle (tests, and after a clear-all). */
export async function closeDb(): Promise<void> {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}
