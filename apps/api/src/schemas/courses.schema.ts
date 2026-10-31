import { z } from 'zod';
import { paginationSchema } from '../lib/pagination.js';
import { booleanish, optionalText, requiredText, uuidSchema } from './common.schema.js';

const codeSchema = z
  .string('Course code is required.')
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,16}$/, 'Use 2-16 letters, numbers or hyphens (e.g. CS101).');

export const createCourseSchema = z.object({
  code: codeSchema,
  title: requiredText('Title', 2, 160),
  description: optionalText(2000),
});

export const updateCourseSchema = z
  .object({
    code: codeSchema.optional(),
    title: requiredText('Title', 2, 160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const listCoursesQuery = paginationSchema.extend({
  search: optionalText(100),
  status: z.enum(['active', 'archived', 'all']).default('all'),
});

export const setTeachersSchema = z.object({
  teacherIds: z.array(uuidSchema).max(20, 'At most 20 teachers per course.'),
});

export const enrollSchema = z.union([
  z.object({ studentIds: z.array(uuidSchema).min(1, 'Select at least one student.').max(500) }),
  z.object({ csv: z.string().min(1, 'The CSV is empty.').max(200_000) }),
]);

export const enrollQuery = z.object({ dryRun: booleanish.default(false) });

export const courseStudentParams = z.object({ id: uuidSchema, studentId: uuidSchema });
