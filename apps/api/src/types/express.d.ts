import type { Db } from '../config/supabase.js';
import type { AuthUser } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: AuthUser;
      /** Supabase client bound to the caller's JWT (RLS enforced). */
      db?: Db;
      /** The verified bearer token. */
      accessToken?: string;
    }
  }
}

export {};
