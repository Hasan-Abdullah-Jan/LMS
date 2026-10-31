import { z } from 'zod';

const emailSchema = z.email();

export interface ParsedEmails {
  /** Unique, valid, lower-cased emails in input order. */
  emails: string[];
  /** Emails that appeared more than once in the input. */
  duplicates: string[];
  /** Tokens that are not valid email addresses (header rows are ignored). */
  invalid: string[];
}

/** Parse a CSV / newline / semicolon separated list of emails. */
export function parseEmailList(input: string): ParsedEmails {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const invalid: string[] = [];
  const emails: string[] = [];

  const tokens = input
    .replace(/^\uFEFF/, '')
    .split(/[\r\n,;\t]+/)
    .map((token) =>
      token
        .trim()
        .replace(/^["']|["']$/g, '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  for (const token of tokens) {
    if (token === 'email' || token === 'emails' || token === 'e-mail') continue;
    if (!emailSchema.safeParse(token).success) {
      invalid.push(token);
      continue;
    }
    if (seen.has(token)) {
      duplicates.add(token);
      continue;
    }
    seen.add(token);
    emails.push(token);
  }
  return { emails, duplicates: [...duplicates], invalid };
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build an Excel-friendly CSV (UTF-8 BOM + CRLF). */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}\r\n`;
}
