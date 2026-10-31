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
      // The session lives in the API's auth flow, not in supabase-js. Realtime asks
      // this callback for a token on every (re)join and heartbeat, so it always
      // uses the current user's JWT (falling back to the anon key when signed out).
      accessToken: async () => tokenStore.get() ?? anonKey!,
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

if (supabase) {
  // Push a fresh token to open channels whenever the session changes or refreshes.
  tokenStore.subscribe(() => {
    void supabase.realtime.setAuth();
  });
}
