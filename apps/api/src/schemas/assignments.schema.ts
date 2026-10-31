import { z } from 'zod';
import { booleanish, isoDateTime, requiredText } from './common.schema.js';

const marksSchema = z.coerce
  .number('Enter a number.')
  .positive('Max marks must be greater than 0.')
  .max(9999.99, 'Max marks must be at most 9999.99.')
  .multipleOf(0.01, 'Use at most two decimal places.');

/** Multipart form: values arrive as strings, hence the coercion. */
export const createAssignmentSchema = z.object({
  title: requiredText('Title', 1, 200),
  instructions: requiredText('Instructions', 1, 20000),
  maxMarks: marksSchema,
  dueAt: isoDateTime('Due date'),
  allowLate: booleanish.default(false),
});

export const updateAssignmentSchema = z
  .object({
    title: requiredText('Title', 1, 200).optional(),
    instructions: requiredText('Instructions', 1, 20000).optional(),
    maxMarks: marksSchema.optional(),
    dueAt: isoDateTime('Due date').optional(),
    allowLate: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const submitSchema = z.object({
  textAnswer: z
    .string()
    .trim()
    .max(50000, 'Your answer must be at most 50,000 characters.')
    .optional()
    .transform((value) => value || undefined),
});

export const gradeSchema = z.object({
  marks: z.coerce
    .number('Marks must be a number.')
    .min(0, 'Marks cannot be negative.')
    .multipleOf(0.01, 'Use at most two decimal places.'),
  feedback: z
    .string()
    .trim()
    .max(5000, 'Feedback must be at most 5,000 characters.')
    .nullable()
    .optional()
    .transform((value) => value || null),
});
