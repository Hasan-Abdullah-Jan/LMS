import type { Db } from '../config/supabase.js';

export type Role = 'admin' | 'teacher' | 'student';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
}

/** Everything a service needs to act on behalf of the caller. */
export interface RequestContext {
  user: AuthUser;
  /** Supabase client bound to the caller's JWT (RLS enforced). */
  db: Db;
  accessToken: string;
}
