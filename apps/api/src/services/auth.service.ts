import type { Session } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError, unprocessable } from '../lib/errors.js';
import { decodeJwtClaims } from '../lib/jwt.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { authRepository } from '../repositories/auth.repository.js';
import { profilesRepository, type Profile } from '../repositories/profiles.repository.js';
import type { RequestContext } from '../types/auth.js';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Unix epoch seconds. */
  expiresAt: number;
  user: Profile;
}

/** Supabase error codes that mean "the user typed something wrong" (never reveal which). */
const CREDENTIAL_ERROR_CODES = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'user_not_found',
  'validation_failed',
]);

const INVALID_CREDENTIALS = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
const deactivated = () =>
  new AppError(
    403,
    'ACCOUNT_DEACTIVATED',
    'Your account has been deactivated. Contact the administrator.',
  );
const linkInvalid = () =>
  new AppError(
    400,
    'LINK_INVALID',
    'This password reset link is invalid, has expired or has already been used. Please request a new one.',
  );

export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, we have sent a link to reset the password. The link expires in 1 hour.';

function toAuthSession(session: Session, profile: Profile): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
    user: profile,
  };
}

function passwordUpdateError(error: { code?: string; message: string }): AppError {
  if (error.code === 'same_password') {
    return unprocessable('New password must be different from the current password.', [
      { path: 'newPassword', message: 'New password must be different from the current password.' },
    ]);
  }
  if (error.code === 'weak_password') {
    return unprocessable(error.message, [{ path: 'newPassword', message: error.message }]);
  }
  return new AppError(500, 'INTERNAL_ERROR', 'The password could not be updated.');
}

export const authService = {
  async login(email: string, password: string): Promise<AuthSession> {
    const { session, error } = await authRepository.signInWithPassword(email, password);
    if (error?.code === 'user_banned') throw deactivated();
    if (error && !CREDENTIAL_ERROR_CODES.has(error.code ?? '')) {
      // Not a user mistake: a bad Supabase key/URL, an outage, etc. Log the real reason and
      // tell the user it is a service problem instead of blaming their password.
      logger.error(
        { code: error.code, status: error.status, message: error.message },
        'Supabase sign-in failed',
      );
      throw new AppError(
        503,
        'INTERNAL_ERROR',
        'Sign-in is temporarily unavailable. Please try again shortly.',
      );
    }
    if (error || !session) throw INVALID_CREDENTIALS;

    const profile = await profilesRepository.findById(supabaseAdmin, session.user.id);
    if (!profile || !profile.isActive) {
      await authRepository.signOut(session.access_token);
      throw profile ? deactivated() : INVALID_CREDENTIALS;
    }
    return toAuthSession(session, profile);
  },

  async refresh(refreshToken: string): Promise<AuthSession> {
    const session = await authRepository.refreshSession(refreshToken);
    if (!session)
      throw new AppError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');
    const profile = await profilesRepository.findById(supabaseAdmin, session.user.id);
    if (!profile || !profile.isActive) {
      await authRepository.signOut(session.access_token);
      throw deactivated();
    }
    return toAuthSession(session, profile);
  },

  async logout(accessToken: string): Promise<void> {
    await authRepository.signOut(accessToken, 'local');
  },

  async me(ctx: RequestContext): Promise<Profile> {
    const profile = await profilesRepository.findById(ctx.db, ctx.user.id);
    if (!profile) throw new AppError(401, 'UNAUTHORIZED', 'Please sign in to continue.');
    return profile;
  },

  /** Always resolves with the same message whether or not the email exists. */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const profile = await profilesRepository.findByEmail(supabaseAdmin, email);
    if (profile?.isActive) {
      // Not awaited: response time must not reveal whether the account exists.
      void authRepository
        .sendPasswordResetEmail(email, env.PASSWORD_RESET_REDIRECT)
        .then((error) => {
          if (error) logger.warn({ err: error.message }, 'Password reset email failed');
        })
        .catch((err: unknown) => logger.error({ err }, 'Password reset email failed'));
    }
    return { message: FORGOT_PASSWORD_MESSAGE };
  },

  /**
   * Complete a reset using the recovery token from the email link. The token
   * must come from an emailed one-time link (amr = otp/recovery). Afterwards
   * every session - including the recovery one - is revoked, so the link is
   * single-use and the old password stops working immediately.
   */
  async resetPassword(recoveryToken: string | null, newPassword: string): Promise<void> {
    if (!recoveryToken) throw linkInvalid();
    const user = await authRepository.getUser(recoveryToken);
    const claims = decodeJwtClaims(recoveryToken);
    const fromEmailLink = claims.amr?.some((m) => m.method === 'otp' || m.method === 'recovery');
    if (!user || !fromEmailLink) throw linkInvalid();

    const profile = await profilesRepository.findById(supabaseAdmin, user.id);
    if (!profile) throw linkInvalid();
    if (!profile.isActive) throw deactivated();

    const error = await authRepository.setPassword(user.id, newPassword);
    if (error) throw passwordUpdateError(error);

    await profilesRepository.update(supabaseAdmin, user.id, { mustChangePassword: false });
    await authRepository.revokeSessions(user.id);
    await auditRepository.record(user.id, 'auth.password_reset', 'user', user.id);
  },

  /** Change password while signed in; signs out every other session. */
  async changePassword(ctx: RequestContext, currentPassword: string, newPassword: string) {
    const check = await authRepository.signInWithPassword(ctx.user.email, currentPassword);
    if (check.error || !check.session) {
      throw unprocessable('Current password is incorrect.', [
        { path: 'currentPassword', message: 'Current password is incorrect.' },
      ]);
    }

    const error = await authRepository.setPassword(ctx.user.id, newPassword);
    if (error) throw passwordUpdateError(error);

    const updated = await profilesRepository.update(supabaseAdmin, ctx.user.id, {
      mustChangePassword: false,
    });
    const currentSessionId = decodeJwtClaims(ctx.accessToken).session_id;
    await authRepository.revokeSessions(ctx.user.id, currentSessionId);
    await auditRepository.record(ctx.user.id, 'auth.password_change', 'user', ctx.user.id);
    return updated;
  },
};
