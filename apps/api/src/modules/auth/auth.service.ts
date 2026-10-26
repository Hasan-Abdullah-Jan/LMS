import { adminClient, userClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../middleware/errors.js';
import type { Profile, UserRole } from './auth.types.js';

const toProfile = (row: Record<string, unknown>): Profile => ({
  id: String(row.id), full_name: String(row.full_name), email: String(row.email),
  role: row.role as UserRole, is_active: Boolean(row.is_active),
  must_change_password: Boolean(row.must_change_password), created_at: String(row.created_at),
});

export async function login(email: string, password: string) {
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  const { data: row, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (profileError || !row || !row.is_active) {
    await client.auth.signOut({ scope: 'local' });
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, profile: toProfile(row) };
}

export async function refresh(refreshToken: string) {
  const client = userClient();
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) throw new HttpError(401, 'UNAUTHORIZED', 'Session expired');
  const { data: row, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (profileError || !row || !row.is_active) throw new HttpError(401, 'UNAUTHORIZED', 'Session expired');
  return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token, profile: toProfile(row) };
}

export async function createAccount(actorId: string, input: { fullName: string; email: string; role: UserRole; temporaryPassword: string; rollNo?: string }) {
  const admin = adminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email, password: input.temporaryPassword, email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (createError || !created.user) throw new HttpError(409, 'USER_CREATE_FAILED', 'Could not create user. Check that the email is not already in use.');
  const row = {
    id: created.user.id, full_name: input.fullName, email: input.email, role: input.role,
    roll_no: input.role === 'student' ? input.rollNo ?? null : null,
    must_change_password: true,
  };
  const { data, error } = await admin.from('profiles').insert(row).select('*').single();
  if (error || !data) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new HttpError(422, 'PROFILE_CREATE_FAILED', 'Could not create profile. Check the student roll number.');
  }
  await admin.from('audit_log').insert({ actor_id: actorId, action: 'user.created', entity: 'profile', entity_id: created.user.id });
  return toProfile(data);
}

export async function listAccounts(input: { page: number; pageSize: number; search?: string | undefined; role?: UserRole | undefined }) {
  const client = adminClient();
  let query = client.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (input.role) query = query.eq('role', input.role);
  if (input.search) query = query.or(`full_name.ilike.%${input.search.replace(/[,%()]/g, '')}%,email.ilike.%${input.search.replace(/[,%()]/g, '')}%`);
  const from = (input.page - 1) * input.pageSize;
  const { data, error, count } = await query.range(from, from + input.pageSize - 1);
  if (error) throw new HttpError(500, 'DATABASE_ERROR', 'Could not load users');
  return { data: (data ?? []).map((row) => toProfile(row)), meta: { page: input.page, pageSize: input.pageSize, total: count ?? 0 } };
}

export async function updateAccount(id: string, actorId: string, input: { fullName?: string; role?: UserRole; isActive?: boolean }) {
  const admin = adminClient();
  const update: Record<string, unknown> = {};
  if (input.fullName !== undefined) update.full_name = input.fullName;
  if (input.role !== undefined) update.role = input.role;
  if (input.isActive !== undefined) update.is_active = input.isActive;
  update.updated_at = new Date().toISOString();
  const { data, error } = await admin.from('profiles').update(update).eq('id', id).select('*').maybeSingle();
  if (error) throw new HttpError(422, 'UPDATE_FAILED', 'Could not update user');
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  const { error: auditError } = await admin.from('audit_log').insert({ actor_id: actorId, action: 'user.updated', entity: 'profile', entity_id: id });
  if (auditError) console.error('Audit log write failed');
  return toProfile(data);
}

export async function sendReset(email: string) {
  await userClient().auth.resetPasswordForEmail(email, { redirectTo: env.PASSWORD_RESET_REDIRECT }).catch(() => undefined);
}

export async function resetPassword(accessToken: string, newPassword: string) {
  const client = userClient(accessToken);
  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error || !data.user) throw new HttpError(400, 'RESET_LINK_INVALID', 'This reset link is invalid or expired. Request a new one.');
  await client.from('profiles').update({ must_change_password: false }).eq('id', data.user.id);
  await adminClient().auth.admin.signOut(data.user.id, 'global');
}

export async function changePassword(accessToken: string, email: string, currentPassword: string, newPassword: string) {
  const verifier = userClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email, password: currentPassword });
  if (verifyError) throw new HttpError(422, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect');
  const client = userClient(accessToken);
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw new HttpError(422, 'PASSWORD_UPDATE_FAILED', 'Could not update password');
  const { data: auth } = await client.auth.getUser();
  if (auth.user) await client.from('profiles').update({ must_change_password: false }).eq('id', auth.user.id);
}

export async function adminReset(email: string) {
  return sendReset(email);
}

