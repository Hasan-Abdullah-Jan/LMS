import { describe, expect, it } from 'vitest';
import { passwordPolicy, passwordScore } from './password';

describe('password policy (client mirror of the API rule)', () => {
  it('requires 10+ chars, a letter and a number', () => {
    expect(passwordPolicy.safeParse('abc123').success).toBe(false);
    expect(passwordPolicy.safeParse('abcdefghij').success).toBe(false);
    expect(passwordPolicy.safeParse('abcdefghi1').success).toBe(true);
  });

  it('scores strength monotonically', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abcdefghi1')).toBe(2);
    expect(passwordScore('Abcdefghi1!')).toBe(4);
  });
});
