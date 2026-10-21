import { describe, expect, it } from 'vitest';

import { detectFormat, parseImportFile, previewImport } from '../../services/historyImporter';

const JSON_RECORDS = [
  { slug: 'two-sum', title: 'Two Sum', attemptedAt: 1792454400000, accepted: true, language: 'java' },
  { slug: 'valid-parentheses', attemptedAt: 1792368000000, accepted: true },
  { slug: 'coin-change', attemptedAt: 1792281600000, accepted: false, submissionId: 's-1' },
];

describe('detectFormat', () => {
  it('uses the file extension first', () => {
    expect(detectFormat('history.json', '')).toBe('json');
    expect(detectFormat('history.csv', '')).toBe('csv');
    expect(detectFormat('history.tsv', '')).toBe('csv');
  });

  it('falls back to the content', () => {
    expect(detectFormat('history.txt', '[{"slug":"a"}]')).toBe('json');
    expect(detectFormat('history.txt', 'slug,title\na,b')).toBe('csv');
    expect(detectFormat('history.txt', 'nothing useful')).toBe('unknown');
  });
});

describe('parseImportFile — JSON', () => {
  it('reads a bare array', () => {
    const parsed = parseImportFile('history.json', JSON.stringify(JSON_RECORDS));
    expect(parsed.format).toBe('json');
    expect(parsed.records).toHaveLength(3);
    expect(parsed.errors).toHaveLength(0);
  });

  it('reads an object with an attempts array', () => {
    const parsed = parseImportFile('history.json', JSON.stringify({ attempts: JSON_RECORDS }));
    expect(parsed.records).toHaveLength(3);
  });

  it('reads an object with a problems array', () => {
    const parsed = parseImportFile('history.json', JSON.stringify({ problems: JSON_RECORDS }));
    expect(parsed.records).toHaveLength(3);
  });

  it('reads a single record object', () => {
    const parsed = parseImportFile('history.json', JSON.stringify(JSON_RECORDS[0]));
    expect(parsed.records).toHaveLength(1);
  });

  it('reports malformed JSON clearly', () => {
    const parsed = parseImportFile('history.json', '{ not json');
    expect(parsed.records).toHaveLength(0);
    expect(parsed.errors[0]?.message).toMatch(/not valid JSON/i);
  });

  it('reports an unrecognised structure clearly', () => {
    const parsed = parseImportFile('history.json', JSON.stringify({ unexpected: 42 }));
    expect(parsed.errors[0]?.message).toMatch(/Unrecognised JSON structure/i);
  });

  it('refuses absurdly large files', () => {
    const huge = `{"slug":"${'a'.repeat(6 * 1024 * 1024)}"}`;
    const parsed = parseImportFile('history.json', huge);
    expect(parsed.errors[0]?.message).toMatch(/larger than 5 MB/i);
  });
});

describe('parseImportFile — CSV', () => {
  it('reads a header plus rows', () => {
    const csv = 'slug,title,attemptedAt\ntwo-sum,Two Sum,1792454400000\ncoin-change,Coin Change,1792368000000';
    const parsed = parseImportFile('history.csv', csv);
    expect(parsed.format).toBe('csv');
    expect(parsed.records).toHaveLength(2);
  });

  it('reports a missing slug column', () => {
    const parsed = parseImportFile('history.csv', 'title,timestamp\nTwo Sum,1792454400000');
    expect(parsed.errors[0]?.message).toMatch(/slug column/i);
  });

  it('reports an empty file', () => {
    const parsed = parseImportFile('history.csv', '');
    expect(parsed.errors[0]?.message).toMatch(/empty/i);
  });

  it('reports a header without data rows', () => {
    const parsed = parseImportFile('history.csv', 'slug,attemptedAt\n');
    expect(parsed.errors[0]?.message).toMatch(/no data rows/i);
  });

  it('skips blank rows without treating them as errors', () => {
    const csv = 'slug,attemptedAt\ntwo-sum,1792454400000\n\n\ncoin-change,1792368000000';
    const parsed = parseImportFile('history.csv', csv);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.blankRows).toBe(2);
    expect(parsed.errors).toHaveLength(0);
  });

  it('reads tab separated files', () => {
    const tsv = 'slug\tattemptedAt\ntwo-sum\t1792454400000';
    const parsed = parseImportFile('history.tsv', tsv);
    expect(parsed.records).toHaveLength(1);
  });
});

describe('buildPreview', () => {
  it('validates every row and groups them by problem', () => {
    const preview = previewImport(
      'history.json',
      JSON.stringify([...JSON_RECORDS, { slug: 'two-sum', attemptedAt: 1792108800000, accepted: false }]),
    );
    expect(preview.valid).toHaveLength(4);
    expect(preview.problems).toHaveLength(3);
    const twoSum = preview.problems.find((problem) => problem.slug === 'two-sum');
    expect(twoSum?.attempts).toBe(2);
    expect(twoSum?.firstAttemptAt).toBe(1792108800000);
    expect(twoSum?.lastAttemptAt).toBe(1792454400000);
  });

  it('counts invalid rows and explains why', () => {
    const preview = previewImport(
      'history.json',
      JSON.stringify([{ attemptedAt: 1 }, { slug: 'two-sum' }, { slug: 'ok', attemptedAt: 1 }]),
    );
    expect(preview.valid).toHaveLength(1);
    expect(preview.invalid).toHaveLength(2);
    expect(preview.invalid[0]?.row).toBe(1);
    expect(preview.invalid[0]?.message).toMatch(/slug/i);
    expect(preview.invalid[1]?.message).toMatch(/timestamp/i);
  });

  it('detects duplicates inside a single file', () => {
    const preview = previewImport(
      'history.json',
      JSON.stringify([
        { slug: 'two-sum', attemptedAt: 1792454400000, submissionId: 's-1' },
        { slug: 'two-sum', attemptedAt: 1792454400000, submissionId: 's-1' },
      ]),
    );
    expect(preview.valid).toHaveLength(1);
    expect(preview.duplicates).toBe(1);
  });

  it('detects duplicates without a submission id', () => {
    const preview = previewImport(
      'history.json',
      JSON.stringify([
        { slug: 'two-sum', attemptedAt: 1792454400000, language: 'java' },
        { slug: 'two-sum', attemptedAt: 1792454400000, language: 'java' },
      ]),
    );
    expect(preview.duplicates).toBe(1);
  });

  it('keeps attempts that differ only by language', () => {
    const preview = previewImport(
      'history.json',
      JSON.stringify([
        { slug: 'two-sum', attemptedAt: 1792454400000, language: 'java' },
        { slug: 'two-sum', attemptedAt: 1792454400000, language: 'python3' },
      ]),
    );
    expect(preview.valid).toHaveLength(2);
  });

  it('surfaces timestamp ambiguities as warnings', () => {
    const preview = previewImport('history.json', JSON.stringify([{ slug: 'two-sum', attemptedAt: '2026-10-21' }]));
    expect(preview.warnings.join(' ')).toMatch(/local midnight/i);
  });
});
