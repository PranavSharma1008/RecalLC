/**
 * History importer — JSON and CSV.
 *
 * The flow is deliberately two-phase:
 *   1. `parseImportFile` + `buildPreview` — read and validate the file and
 *      show the user exactly what would happen. Nothing is written yet.
 *   2. `commitImport` — persist the previewed attempts and report a summary.
 *
 * Imported files are untrusted input. Every record is validated field by
 * field; malformed rows are reported rather than silently dropped.
 */

import type { ImportErrorEntry, ImportPreview, ImportResult, NormalizedAttempt } from '../types';
import { parseCsvTable } from '../utils/csv';
import { attemptId, createId } from '../utils/id';
import { normalizeRecord, type RawRecord } from './historyNormalizer';
import { isSampleAttempt, listAttempts, listProblems, purgeSampleData, recordAttempt, recordImport } from './repository';

/** Refuse absurdly large files rather than locking up the UI. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportFormat = 'json' | 'csv' | 'unknown';

export interface ParsedImport {
  fileName: string;
  format: ImportFormat;
  records: RawRecord[];
  errors: ImportErrorEntry[];
  warnings: string[];
  totalRows: number;
  blankRows: number;
}

/** Guess the format from the file name, falling back to the content. */
export function detectFormat(fileName: string, content: string): ImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.tsv')) return 'csv';

  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.includes(',') && trimmed.includes('\n')) return 'csv';
  return 'unknown';
}

const JSON_CONTAINER_KEYS = ['attempts', 'problems', 'records', 'items', 'data', 'history'];

/** Column names that can carry a problem slug (separator-insensitive). */
const SLUG_KEYS = new Set(['slug', 'titleslug', 'problemslug', 'questionslug', 'name', 'problem', 'question']);

/** True when the object carries at least one field that can identify a problem. */
function hasSlugField(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) =>
    SLUG_KEYS.has(
      key
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ''),
    ),
  );
}

/** Read the file and pull out the raw records. No validation yet. */
export function parseImportFile(fileName: string, content: string): ParsedImport {
  const errors: ImportErrorEntry[] = [];
  const warnings: string[] = [];
  const format = detectFormat(fileName, content);

  if (content.length > MAX_IMPORT_BYTES) {
    return {
      fileName,
      format,
      records: [],
      errors: [{ row: null, message: 'File is larger than 5 MB — please split it into smaller files.' }],
      warnings,
      totalRows: 0,
      blankRows: 0,
    };
  }

  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      errors.push({
        row: null,
        message: `This file is not valid JSON: ${error instanceof Error ? error.message : 'parse error'}`,
      });
      return { fileName, format, records: [], errors, warnings, totalRows: 0, blankRows: 0 };
    }

    const records = extractJsonRecords(parsed, errors, warnings);
    return { fileName, format, records, errors, warnings, totalRows: records.length, blankRows: 0 };
  }

  if (format === 'csv') {
    const delimiter = fileName.toLowerCase().endsWith('.tsv') ? '\t' : ',';
    const table = parseCsvTable(content, delimiter);

    if (table.headers.length === 0) {
      errors.push({ row: null, message: 'The CSV file is empty.' });
      return { fileName, format, records: [], errors, warnings, totalRows: 0, blankRows: 0 };
    }

    const hasSlugColumn = table.headers.some((header) =>
      SLUG_KEYS.has(
        header
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, ''),
      ),
    );
    if (!hasSlugColumn) {
      errors.push({
        row: null,
        message: `The CSV file needs a problem slug column. Found: ${table.headers.join(', ')}.`,
      });
      return { fileName, format, records: [], errors, warnings, totalRows: 0, blankRows: 0 };
    }

    const records: RawRecord[] = [];
    let blankRows = 0;
    table.records.forEach((record) => {
      const values = Object.values(record);
      const isBlank = values.every((value) => value.trim() === '');
      if (isBlank) {
        blankRows++;
        return;
      }
      records.push(record as RawRecord);
    });

    if (records.length === 0) {
      errors.push({ row: null, message: 'The CSV file has a header but no data rows.' });
    }

    return { fileName, format, records, errors, warnings, totalRows: records.length, blankRows };
  }

  errors.push({
    row: null,
    message: 'Unrecognised file type. Import a .json or .csv file (tab-separated .tsv also works).',
  });
  return { fileName, format, records: [], errors, warnings, totalRows: 0, blankRows: 0 };
}

function extractJsonRecords(parsed: unknown, errors: ImportErrorEntry[], warnings: string[]): RawRecord[] {
  if (Array.isArray(parsed)) {
    return parsed.filter((entry): entry is RawRecord => typeof entry === 'object' && entry !== null);
  }

  if (parsed && typeof parsed === 'object') {
    const container = parsed as Record<string, unknown>;
    for (const key of JSON_CONTAINER_KEYS) {
      const value = container[key];
      if (Array.isArray(value)) {
        warnings.push(`Records were read from the "${key}" array.`);
        return value.filter((entry): entry is RawRecord => typeof entry === 'object' && entry !== null);
      }
    }
    // A single record? Only if it actually looks like one.
    if (hasSlugField(container)) {
      return [container as RawRecord];
    }
  }

  errors.push({
    row: null,
    message: 'Unrecognised JSON structure. Expected an array of attempts, or an object with an "attempts" array.',
  });
  return [];
}

/** Validate every parsed record and summarise what would be imported. */
export function buildPreview(parsed: ParsedImport): ImportPreview {
  const valid: NormalizedAttempt[] = [];
  const invalid: ImportErrorEntry[] = [...parsed.errors];
  const warnings = [...parsed.warnings];
  const seenKeys = new Set<string>();
  let duplicates = 0;

  parsed.records.forEach((record, index) => {
    const result = normalizeRecord(record, { source: 'import' });
    if (!result.ok) {
      invalid.push({ row: index + 1, message: result.error });
      return;
    }

    const attempt = result.value;
    if (isSampleAttempt(attempt)) {
      warnings.push(`Row ${index + 1}: Sample / demo problem "${attempt.slug}" was ignored.`);
      return;
    }

    const key = attempt.submissionId
      ? `sid:${attempt.submissionId}`
      : `k:${attempt.slug}:${attempt.attemptedAt}:${attempt.language?.toLowerCase() ?? ''}`;

    if (seenKeys.has(key)) {
      duplicates++;
      return;
    }
    seenKeys.add(key);

    for (const warning of attempt.warnings) {
      const message = `Row ${index + 1}: ${warning}`;
      if (!warnings.includes(message)) warnings.push(message);
    }
    valid.push(attempt);
  });

  const grouped = new Map<string, NormalizedAttempt[]>();
  for (const attempt of valid) {
    const bucket = grouped.get(attempt.slug);
    if (bucket) bucket.push(attempt);
    else grouped.set(attempt.slug, [attempt]);
  }

  const problems = [...grouped.entries()]
    .map(([slug, attempts]) => ({
      slug,
      title: attempts.find((a) => a.title)?.title ?? slug,
      attempts: attempts.length,
      firstAttemptAt: Math.min(...attempts.map((a) => a.attemptedAt)),
      lastAttemptAt: Math.max(...attempts.map((a) => a.attemptedAt)),
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return {
    fileName: parsed.fileName,
    format: parsed.format,
    totalRows: parsed.records.length + parsed.blankRows,
    valid,
    invalid,
    duplicates,
    warnings,
    problems,
  };
}

/** Parse + validate in one step. */
export function previewImport(fileName: string, content: string): ImportPreview {
  return buildPreview(parseImportFile(fileName, content));
}

/**
 * Persist a previewed import.
 * De-duplicates against data already in the store and against the file itself.
 */
export async function commitImport(preview: ImportPreview, now: number = Date.now()): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    duplicated: 0,
    invalid: preview.invalid.length,
    merged: 0,
    problemsCreated: 0,
    problemsUpdated: 0,
    errors: [...preview.invalid],
    warnings: [...preview.warnings],
  };

  const [existingProblems, existingAttempts] = await Promise.all([listProblems(), listAttempts()]);
  const knownSlugs = new Set(existingProblems.map((problem) => problem.slug));
  const knownSubmissionIds = new Set(
    existingAttempts.map((attempt) => attempt.submissionId).filter((id): id is string => Boolean(id)),
  );
  const knownAttemptIds = new Set(existingAttempts.map((attempt) => attempt.id));
  const seen = new Set<string>();

  for (const attempt of preview.valid) {
    if (isSampleAttempt(attempt)) {
      result.skipped++;
      continue;
    }
    const key = attempt.submissionId
      ? `sid:${attempt.submissionId}`
      : `k:${attempt.slug}:${attempt.attemptedAt}:${attempt.language?.toLowerCase() ?? ''}`;
    const id = attemptId(attempt.submissionId, attempt.slug, attempt.attemptedAt, attempt.language);

    if (
      seen.has(key) ||
      knownAttemptIds.has(id) ||
      (attempt.submissionId !== null && knownSubmissionIds.has(attempt.submissionId))
    ) {
      result.duplicated++;
      continue;
    }
    seen.add(key);

    const existed = knownSlugs.has(attempt.slug);
    try {
      const outcome = await recordAttempt(
        {
          slug: attempt.slug,
          title: attempt.title,
          attemptedAt: attempt.attemptedAt,
          accepted: attempt.accepted,
          language: attempt.language,
          difficulty: attempt.difficulty,
          topics: attempt.topics,
          submissionId: attempt.submissionId,
          source: 'import',
        },
        now,
      );
      if (!outcome.created) {
        result.duplicated++;
        continue;
      }
      result.imported++;
      if (existed) result.merged++;
      else {
        result.problemsCreated++;
        knownSlugs.add(attempt.slug);
      }
    } catch (error) {
      result.errors.push({
        row: null,
        message: `Could not store "${attempt.slug}": ${error instanceof Error ? error.message : 'unknown error'}`,
      });
      result.invalid++;
    }
  }

  await recordImport({
    id: createId('imp'),
    fileName: preview.fileName,
    format: preview.format,
    importedAt: now,
    result,
  });

  // Guarantee no ghost mock/demo questions or revisions linger after import
  await purgeSampleData();

  return result;
}

/** Convenience: parse, validate and store in one call. */
export async function importFile(fileName: string, content: string, now: number = Date.now()): Promise<ImportResult> {
  const preview = previewImport(fileName, content);
  if (preview.invalid.some((entry) => entry.row === null) && preview.valid.length === 0) {
    return {
      imported: 0,
      skipped: 0,
      duplicated: 0,
      invalid: preview.invalid.length,
      merged: 0,
      problemsCreated: 0,
      problemsUpdated: 0,
      errors: preview.invalid,
      warnings: preview.warnings,
    };
  }
  return commitImport(preview, now);
}
