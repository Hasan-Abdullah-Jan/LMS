import { describe, expect, it } from 'vitest';
import { parseEmailList, toCsv } from '../src/lib/csv.js';
import { safeFileName, verifyUpload } from '../src/lib/files.js';
import { passwordSchema } from '../src/lib/password.js';
import { gradeAttempt, seededShuffle } from '../src/lib/quiz-grading.js';
import { submissionStatus } from '../src/services/assignments.service.js';
import { ALLOWED_TRANSITIONS } from '../src/services/complaints.service.js';
import { computeTotals } from '../src/services/marks.service.js';

describe('quiz grading', () => {
  const questions = [
    { id: 'q1', marks: 2 },
    { id: 'q2', marks: 3 },
    { id: 'q3', marks: 1 },
  ];
  const key = new Map([
    ['q1', ['b']],
    ['q2', ['a', 'c']],
    ['q3', ['true']],
  ]);

  it('sums the marks of fully-correct questions only', () => {
    expect(gradeAttempt(questions, key, { q1: ['b'], q2: ['c', 'a'], q3: ['true'] }).score).toBe(6);
  });

  it('multi-select is all-or-nothing', () => {
    expect(gradeAttempt(questions, key, { q1: ['b'], q2: ['a'], q3: ['true'] }).score).toBe(3);
    expect(gradeAttempt(questions, key, { q2: ['a', 'b', 'c'] }).score).toBe(0);
  });

  it('unanswered questions score 0', () => {
    const { score, results } = gradeAttempt(questions, key, {});
    expect(score).toBe(0);
    expect(results.every((r) => !r.correct)).toBe(true);
  });

  it('seeded shuffle is deterministic and a permutation', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    const first = seededShuffle(items, 'seed');
    expect(seededShuffle(items, 'seed')).toEqual(first);
    expect([...first].sort()).toEqual(items);
  });
});

describe('CSV helpers', () => {
  it('parses emails, reporting duplicates and invalid tokens, ignoring the header', () => {
    const parsed = parseEmailList('﻿email\nA@x.com\nb@x.com; a@x.com\nnope\n');
    expect(parsed.emails).toEqual(['a@x.com', 'b@x.com']);
    expect(parsed.duplicates).toEqual(['a@x.com']);
    expect(parsed.invalid).toEqual(['nope']);
  });

  it('writes a UTF-8 BOM, escapes quotes and neutralises formulas', () => {
    const csv = toCsv([
      ['Name', 'Note'],
      ['Ali "Al" Said', '=SUM(A1)'],
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Ali ""Al"" Said"');
    expect(csv).toContain("'=SUM(A1)");
  });
});

describe('file validation', () => {
  it('sanitises file names', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('My Report (final).pdf')).toBe('My_Report_final_.pdf');
  });

  it('accepts a real PDF by magic bytes', async () => {
    const buffer = Buffer.from('%PDF-1.4\n%....\n');
    const result = await verifyUpload(
      { originalname: 'a.pdf', size: buffer.length, buffer },
      'resources',
      1024,
    );
    expect(result.mimeType).toBe('application/pdf');
  });

  it('rejects an executable renamed to .pdf (415) and oversize files (413)', async () => {
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]);
    await expect(
      verifyUpload({ originalname: 'x.pdf', size: exe.length, buffer: exe }, 'resources', 1024),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      verifyUpload({ originalname: 'x.pdf', size: 5000, buffer: exe }, 'resources', 1024),
    ).rejects.toMatchObject({ status: 413 });
  });
});

describe('business rules', () => {
  it('password policy: 10+ chars, a letter and a number', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890').success).toBe(false);
    expect(passwordSchema.safeParse('Gutech2026x').success).toBe(true);
  });

  it('marks percentage counts graded items only', () => {
    const totals = computeTotals([
      { obtained: 7, max: 10 },
      { obtained: 3, max: 6 },
      { obtained: null, max: 20 },
    ]);
    expect(totals).toEqual({
      obtained: 10,
      max: 16,
      percentage: 62.5,
      gradedCount: 2,
      pendingCount: 1,
    });
    expect(computeTotals([{ obtained: null, max: 5 }]).percentage).toBeNull();
  });

  it('submission status chips', () => {
    const future = { dueAt: new Date(Date.now() + 1e6).toISOString(), allowLate: false };
    const past = { dueAt: new Date(Date.now() - 1e6).toISOString(), allowLate: false };
    expect(submissionStatus(future, null)).toBe('pending');
    expect(submissionStatus(past, null)).toBe('missed');
    expect(submissionStatus({ ...past, allowLate: true }, null)).toBe('pending');
    expect(submissionStatus(past, { isLate: true, gradedAt: null })).toBe('late');
    expect(submissionStatus(past, { isLate: false, gradedAt: '2026-01-01' })).toBe('graded');
  });

  it('complaint status flow open -> in_review -> resolved | rejected', () => {
    expect(ALLOWED_TRANSITIONS.open).toEqual(['in_review']);
    expect(ALLOWED_TRANSITIONS.in_review).toEqual(['resolved', 'rejected']);
    expect(ALLOWED_TRANSITIONS.resolved).toEqual([]);
  });
});
