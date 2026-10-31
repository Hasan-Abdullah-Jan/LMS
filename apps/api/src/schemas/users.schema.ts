import { z } from 'zod';
import { paginationSchema } from '../lib/pagination.js';
import { passwordSchema } from '../lib/password.js';
import { emailSchema, optionalText, requiredText } from './common.schema.js';

export const roleSchema = z.enum(['admin', 'teacher', 'student'], 'Choose a valid role.');

const rollNoSchema = z
  .string()
  .trim()
  .max(32, 'Roll number must be at most 32 characters.')
  .regex(/^[A-Za-z0-9-/]*$/, 'Roll number may contain letters, numbers, "-" and "/".');

export const createUserSchema = z
  .object({
    fullName: requiredText('Full name', 2, 120),
    email: emailSchema,
    role: roleSchema,
    rollNo: rollNoSchema.optional().transform((value) => value || undefined),
    temporaryPassword: passwordSchema,
  })
  .refine((value) => value.role === 'student' || !value.rollNo, {
    path: ['rollNo'],
    message: 'Only students have a roll number.',
  });

export const updateUserSchema = z
  .object({
    fullName: requiredText('Full name', 2, 120).optional(),
    role: roleSchema.optional(),
    rollNo: rollNoSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const listUsersQuery = paginationSchema.extend({
  search: optionalText(100),
  role: roleSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const adminResetPasswordSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('email') }),
  z.object({ mode: z.literal('temporary'), temporaryPassword: passwordSchema }),
]);
