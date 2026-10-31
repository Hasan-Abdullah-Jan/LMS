import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { tokenStore } from './api';

/**
 * Browser Supabase client. Used ONLY for Realtime subscriptions (chat,
 * announcement badges, notifications). All reads/writes go through the API.
 * Delivery is filtered by Postgres RLS using the signed-in user's JWT.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const realtimeEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = realtimeEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

if (supabase) {
  const apply = (token: string | null) => {
    void supabase.realtime.setAuth(token ?? anonKey!);
  };
  apply(tokenStore.get());
  tokenStore.subscribe(apply);
}
