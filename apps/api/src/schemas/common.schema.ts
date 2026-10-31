import { z } from 'zod';

export const uuidSchema = z.uuid('Invalid id.');

export const idParams = z.object({ id: uuidSchema });

export const emailSchema = z
  .string('Email is required.')
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.').max(254));

/** Trimmed text; empty strings become undefined so optional fields stay optional. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : undefined));

export const requiredText = (label: string, min: number, max: number) =>
  z
    .string(`${label} is required.`)
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Booleans that may arrive as "true"/"false" strings from multipart forms or query strings. */
export const booleanish = z.union([z.boolean(), z.stringbool()]);

export const isoDateTime = (label: string) =>
  z.iso.datetime({ offset: true, error: `${label} must be a valid date and time.` });
