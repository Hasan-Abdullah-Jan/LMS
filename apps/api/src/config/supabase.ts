import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

function config() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('Supabase is not configured');
  return { url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY };
}

export function userClient(accessToken?: string): SupabaseClient {
  const { url, anonKey } = config();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export function adminClient(): SupabaseClient {
  const { url } = config();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase admin key is not configured');
  return createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

