import { createAnonClient, supabaseAdmin } from '../config/supabase.js';

type Check = 'ok' | 'error';

export interface Readiness {
  api: 'ok';
  /** Service-role key + URL can read the database. */
  serviceKey: Check;
  /** Anon key + URL are accepted by Supabase Auth. */
  anonKey: Check;
  /** Number of profiles (0 means the SQL setup/seed has not been run). */
  profiles: number | null;
  hint: string;
}

/**
 * Deployment self-check. Reports only whether each configuration piece works - no secrets,
 * no account details - so a misconfigured deployment can be diagnosed from the browser.
 */
export async function checkReadiness(): Promise<Readiness> {
  const profiles = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  const serviceKey: Check = profiles.error ? 'error' : 'ok';

  // A deliberately wrong login: "invalid_credentials" proves the URL and anon key are accepted.
  const probe = await createAnonClient()
    .auth.signInWithPassword({
      email: 'readiness-probe@invalid.example',
      password: 'not-a-password',
    })
    .catch(() => ({ error: { code: 'network_error' } }));
  const anonKey: Check = probe.error?.code === 'invalid_credentials' ? 'ok' : 'error';

  const count = profiles.error ? null : (profiles.count ?? 0);
  let hint = 'All good.';
  if (serviceKey === 'error') {
    hint =
      'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is wrong, or the database setup SQL has not been run.';
  } else if (anonKey === 'error') {
    hint =
      'SUPABASE_ANON_KEY or SUPABASE_URL is wrong (use the anon/publishable key, not the secret key).';
  } else if (count === 0) {
    hint = 'The database is empty: run supabase/setup.sql in the Supabase SQL Editor.';
  }
  return { api: 'ok', serviceKey, anonKey, profiles: count, hint };
}
