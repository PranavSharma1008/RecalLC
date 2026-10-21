/**
 * A small, dependency-free, RFC-4180-flavoured CSV reader.
 *
 * Handles quoted fields, escaped quotes (`""`), embedded newlines,
 * CRLF / LF / CR line endings, a UTF-8 BOM, and ragged rows.
 */

export interface CsvTable {
  headers: string[];
  /** Data rows, already split into cells (header excluded). */
  rows: string[][];
  /** Rows as objects keyed by the (trimmed, lower-cased) header name. */
  records: Array<Record<string, string>>;
}

/** Split CSV text into raw rows of cells. */
export function parseCsvRows(input: string, delimiter = ','): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let sawAnyChar = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    sawAnyChar = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
      sawAnyChar = true;
      continue;
    }

    if (ch === delimiter) {
      endField();
      sawAnyChar = true;
      continue;
    }

    if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
      continue;
    }

    if (ch === '\n') {
      endRow();
      continue;
    }

    field += ch;
    sawAnyChar = true;
  }

  if (sawAnyChar || field !== '' || row.length > 0) endRow();

  // Drop trailing blank rows produced by a final newline.
  while (rows.length > 0) {
    const last = rows[rows.length - 1]!;
    const blank = last.every((cell) => cell.trim() === '');
    if (!blank) break;
    rows.pop();
  }

  return rows;
}

/**
 * Parse CSV text into a header + records table.
 * Blank header cells are dropped; duplicate headers keep the first occurrence.
 */
export function parseCsvTable(input: string, delimiter = ','): CsvTable {
  const rows = parseCsvRows(input, delimiter);
  if (rows.length === 0) return { headers: [], rows: [], records: [] };

  const headerRow = rows[0]!.map((h) => h.trim());
  const dataRows = rows.slice(1);

  const seen = new Set<string>();
  const headers: string[] = [];
  const headerIndex: number[] = [];
  headerRow.forEach((raw, index) => {
    const key = raw.toLowerCase();
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    headers.push(key);
    headerIndex.push(index);
  });

  const records = dataRows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      const sourceIndex = headerIndex[i]!;
      record[header] = (row[sourceIndex] ?? '').trim();
    });
    return record;
  });

  return { headers, rows: dataRows, records };
}

/** Escape a value for writing into a CSV cell. */
export function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Serialise rows (including the header) to CSV text. */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsvValue).join(','));
  return `${lines.join('\n')}\n`;
}
