import type { PostgrestError } from '@supabase/supabase-js';
import { AppError, conflict, forbidden, notFound, unprocessable } from './errors.js';

/**
 * Translate a PostgREST / Postgres error into an API error. Our guard triggers
 * raise with SQLSTATEs chosen to map cleanly onto HTTP statuses.
 */
export function toAppError(error: PostgrestError, entity = 'Resource'): AppError {
  switch (error.code) {
    case '23505':
      return conflict(`${entity} already exists.`);
    case '23514':
      return unprocessable(error.message.startsWith('new row') ? `Invalid ${entity.toLowerCase()} data.` : error.message);
    case '23503':
      return unprocessable(`A referenced record does not exist.`);
    case '22P02':
    case 'PGRST116':
      return notFound(entity);
    case '42501':
      return forbidden(error.message.includes('row-level security') ? undefined : error.message);
    case 'P0001':
      return conflict(error.message);
    default:
      return new AppError(500, 'INTERNAL_ERROR', 'A database error occurred.');
  }
}

interface QueryResult<T> {
  data: T;
  error: PostgrestError | null;
}

/** Throw on error and return data (which may be null for maybeSingle()). */
export function unwrap<T>(result: QueryResult<T>, entity?: string): T {
  if (result.error) throw toAppError(result.error, entity);
  return result.data;
}

/** Throw on error or missing data. */
export function unwrapRequired<T>(result: QueryResult<T>, entity?: string): NonNullable<T> {
  const data = unwrap(result, entity);
  if (data === null || data === undefined) throw notFound(entity);
  return data;
}

/** Throw on error and return a list (never null). */
export function unwrapList<T>(result: QueryResult<T[] | null>, entity?: string): T[] {
  return unwrap(result, entity) ?? [];
}
