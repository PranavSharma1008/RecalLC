import { describe, expect, it } from 'vitest';

import { parseCsvRows, parseCsvTable, toCsv } from '../../utils/csv';

describe('parseCsvRows', () => {
  it('splits simple rows', () => {
    expect(parseCsvRows('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsvRows('slug,title\ntwo-sum,"Two Sum, easy"')).toEqual([
      ['slug', 'title'],
      ['two-sum', 'Two Sum, easy'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsvRows('title\n"the ""best"" problem"')).toEqual([['title'], ['the "best" problem']]);
  });

  it('supports newlines inside quoted fields', () => {
    expect(parseCsvRows('title,note\n"Two Sum","line one\nline two"')).toEqual([
      ['title', 'note'],
      ['Two Sum', 'line one\nline two'],
    ]);
  });

  it('handles CRLF and LF line endings', () => {
    expect(parseCsvRows('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips a UTF-8 byte order mark', () => {
    expect(parseCsvRows('\uFEFFslug,title\ntwo-sum,Two Sum')).toEqual([
      ['slug', 'title'],
      ['two-sum', 'Two Sum'],
    ]);
  });

  it('drops trailing blank lines', () => {
    expect(parseCsvRows('a,b\n1,2\n\n')).toHaveLength(2);
  });

  it('supports ragged rows without throwing', () => {
    expect(parseCsvRows('a,b,c\n1,2')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2'],
    ]);
  });

  it('supports an alternative delimiter', () => {
    expect(parseCsvRows('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseCsvTable', () => {
  it('exposes headers and records with lower-cased keys', () => {
    const table = parseCsvTable('Slug,Title,attemptedAt\ntwo-sum,Two Sum,1792454400000');
    expect(table.headers).toEqual(['slug', 'title', 'attemptedat']);
    expect(table.records[0]).toEqual({
      slug: 'two-sum',
      title: 'Two Sum',
      attemptedat: '1792454400000',
    });
  });

  it('trims values', () => {
    const table = parseCsvTable('slug , title \n two-sum , Two Sum ');
    expect(table.records[0]?.slug).toBe('two-sum');
    expect(table.records[0]?.title).toBe('Two Sum');
  });

  it('keeps the first of duplicate headers', () => {
    const table = parseCsvTable('slug,slug\ntwo-sum,three-sum');
    expect(table.headers).toEqual(['slug']);
    expect(table.records[0]?.slug).toBe('two-sum');
  });

  it('returns an empty table for empty input', () => {
    const table = parseCsvTable('');
    expect(table.headers).toEqual([]);
    expect(table.records).toEqual([]);
  });
});

describe('toCsv', () => {
  it('quotes values that need it', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'say "hi"']]);
    expect(csv).toBe('a,b\n"x,y","say ""hi"""\n');
  });

  it('round-trips through the parser', () => {
    const csv = toCsv(['slug', 'title'], [['two-sum', 'Two Sum, revisited']]);
    const table = parseCsvTable(csv);
    expect(table.records[0]?.title).toBe('Two Sum, revisited');
  });
});
