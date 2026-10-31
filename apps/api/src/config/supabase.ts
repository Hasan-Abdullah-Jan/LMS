import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types.js';
import { env } from './env.js';

export type Db = SupabaseClient<Database>;

const serverAuthOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/**
 * Service-role client. Bypasses RLS, so it is used only for narrowly scoped
 * server tasks after the API has authorized the caller: Auth admin actions,
 * storage objects and signed URLs, quiz grading, audit log and notifications.
 * It is never exposed to the browser.
 */
export const supabaseAdmin: Db = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  serverAuthOptions,
);

/** A fresh anon client for auth flows (login, refresh, password recovery). */
export function createAnonClient(): Db {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, serverAuthOptions);
}

/**
 * A client that acts as the signed-in user: every query runs under their JWT,
 * so Postgres RLS is enforced as a second line of defense.
 */
export function createUserClient(accessToken: string): Db {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    ...serverAuthOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
