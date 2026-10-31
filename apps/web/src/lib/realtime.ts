import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

type Event = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Subscribe to Supabase Realtime postgres_changes. RLS on the table decides
 * which rows this user receives. No-op when Realtime is not configured.
 */
export function useRealtime<T extends Record<string, unknown>>({
  channel,
  table,
  filter,
  event = '*',
  enabled = true,
  onChange,
}: {
  channel: string;
  table: string;
  filter?: string;
  event?: Event;
  enabled?: boolean;
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void;
}) {
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  });

  useEffect(() => {
    if (!supabase || !enabled) return;
    // A unique topic per subscription: re-joining the same topic while the previous
    // channel is still closing (e.g. React StrictMode remounts) is rejected by Realtime.
    const topic = `${channel}:${Math.random().toString(36).slice(2, 10)}`;
    const sub = supabase
      .channel(topic)
      .on(
        'postgres_changes' as never,
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload: RealtimePostgresChangesPayload<T>) => handler.current(payload),
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(sub);
    };
  }, [channel, table, filter, event, enabled]);
}
