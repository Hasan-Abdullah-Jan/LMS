import { describe, expect, it } from 'vitest';
import { roleHome } from './roles';

describe('roleHome', () => {
  it.each([
    ['admin', '/admin'],
    ['teacher', '/teacher'],
    ['student', '/student'],
  ] as const)('routes %s users to %s', (role, path) => {
    expect(roleHome(role)).toBe(path);
  });
});

