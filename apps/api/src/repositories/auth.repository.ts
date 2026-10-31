import type { Session, User } from '@supabase/supabase-js';
import { createAnonClient, supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../lib/errors.js';
import type { Role } from '../types/auth.js';

/** Ten years: effectively permanent until an admin re-activates the user. */
const BAN_FOREVER = '87600h';

/** Thin wrapper over Supabase Auth so services never touch the SDK directly. */
export const authRepository = {
  async signInWithPassword(email: string, password: string) {
    const { data, error } = await createAnonClient().auth.signInWithPassword({ email, password });
    return { session: data.session, user: data.user, error };
  },

  async refreshSession(refreshToken: string): Promise<Session | null> {
    const { data, error } = await createAnonClient().auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) return null;
    return data.session;
  },

  async getUser(accessToken: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    return error ? null : data.user;
  },

  /** Revoke the session the token belongs to ('local') or all of the user's sessions ('global'). */
  async signOut(accessToken: string, scope: 'local' | 'global' | 'others' = 'local') {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, scope);
    if (error) logger.warn({ err: error.message }, 'Supabase sign-out failed');
  },

  /** Delete every session of a user except (optionally) one. */
  async revokeSessions(userId: string, keepSessionId?: string) {
    const { error } = await supabaseAdmin.rpc('revoke_user_sessions', {
      target_user_id: userId,
      ...(keepSessionId ? { keep_session_id: keepSessionId } : {}),
    });
    if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Could not revoke sessions.');
  },

  async createUser(input: { email: string; password: string; fullName: string; role: Role }) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName, role: input.role },
    });
    return { user: data.user, error };
  },

  async deleteUser(userId: string) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) logger.error({ err: error.message, userId }, 'Failed to delete auth user');
  },

  async setPassword(userId: string, password: string) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    return error;
  },

  async setBanned(userId: string, banned: boolean) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? BAN_FOREVER : 'none',
    });
    if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Could not update the account status.');
  },

  async sendPasswordResetEmail(email: string, redirectTo: string) {
    const { error } = await createAnonClient().auth.resetPasswordForEmail(email, { redirectTo });
    return error;
  },
};
