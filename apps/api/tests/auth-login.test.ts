import { beforeEach, describe, expect, it, vi } from 'vitest';

const signIn = vi.fn();
vi.mock('../src/repositories/auth.repository.js', () => ({
  authRepository: { signInWithPassword: (...args: unknown[]) => signIn(...args), signOut: vi.fn() },
}));
vi.mock('../src/config/supabase.js', () => ({
  supabaseAdmin: {},
  createAnonClient: vi.fn(),
  createUserClient: vi.fn(),
}));
vi.mock('../src/repositories/profiles.repository.js', () => ({
  profilesRepository: { findById: vi.fn() },
}));

const { authService } = await import('../src/services/auth.service.js');

describe('login error mapping', () => {
  beforeEach(() => signIn.mockReset());

  it.each(['invalid_credentials', 'email_not_confirmed', 'user_not_found'])(
    'treats %s as a user mistake with the generic message',
    async (code) => {
      signIn.mockResolvedValue({
        session: null,
        user: null,
        error: { code, status: 400, message: 'x' },
      });
      await expect(authService.login('a@b.co', 'pw')).rejects.toMatchObject({
        status: 401,
        message: 'Invalid email or password.',
      });
    },
  );

  it.each([
    { code: 'invalid_api_key', status: 401 },
    { code: undefined, status: 500 },
    { code: 'unexpected_failure', status: 502 },
  ])(
    'reports configuration/outage errors (%o) as a service problem, not a wrong password',
    async (error) => {
      signIn.mockResolvedValue({ session: null, user: null, error: { ...error, message: 'boom' } });
      await expect(authService.login('a@b.co', 'pw')).rejects.toMatchObject({ status: 503 });
    },
  );

  it('keeps deactivated accounts distinct', async () => {
    signIn.mockResolvedValue({
      session: null,
      user: null,
      error: { code: 'user_banned', status: 400, message: 'banned' },
    });
    await expect(authService.login('a@b.co', 'pw')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_DEACTIVATED',
    });
  });
});
