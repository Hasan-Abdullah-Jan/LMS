import type { Database } from '../types/database.types.js';

type Tables = Database['public']['Tables'];
export type Row<T extends keyof Tables> = Tables[T]['Row'];

/** Postgres numeric columns arrive as numbers via PostgREST; normalise nullables. */
export const num = (value: number | string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

export interface PersonSummary {
  id: string;
  fullName: string;
  email: string;
  role: Row<'profiles'>['role'];
}

export function toPersonSummary(
  row: Pick<Row<'profiles'>, 'id' | 'full_name' | 'email' | 'role'>,
): PersonSummary {
  return { id: row.id, fullName: row.full_name, email: row.email, role: row.role };
}
