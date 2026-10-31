import { describe, expect, it } from 'vitest';
import { homeFor, isStaff } from './roles';
import { formatBytes, formatMarks, initials } from './utils';

describe('role helpers', () => {
  it('maps each role to its dashboard', () => {
    expect(homeFor('admin')).toBe('/admin');
    expect(homeFor('teacher')).toBe('/teacher');
    expect(homeFor('student')).toBe('/student');
    expect(homeFor(null)).toBe('/login');
  });

  it('identifies staff', () => {
    expect(isStaff('teacher')).toBe(true);
    expect(isStaff('admin')).toBe(true);
    expect(isStaff('student')).toBe(false);
  });
});

describe('formatting', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });

  it('builds initials without honorifics', () => {
    expect(initials('Dr. Aisha Al-Balushi')).toBe('AA');
    expect(initials('Fatima')).toBe('F');
  });

  it('formats marks', () => {
    expect(formatMarks(9.5)).toBe('9.5');
    expect(formatMarks(10)).toBe('10');
    expect(formatMarks(null)).toBe('—');
  });
});
