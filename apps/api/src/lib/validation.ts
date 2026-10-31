import type { z } from 'zod';
import { unprocessable } from './errors.js';

/** Parse untrusted input with a Zod schema; respond 422 with field details on failure. */
export function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw unprocessable(
      'Some fields are invalid.',
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}
