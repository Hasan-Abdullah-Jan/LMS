import { z } from 'zod';

export const passwordSchema = z.string().min(10).regex(/[A-Za-z]/).regex(/[0-9]/);
export const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(256) });
export const forgotSchema = z.object({ email: z.string().trim().email().max(254) });
export const resetSchema = z.object({ newPassword: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
export const createUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  role: z.enum(['admin', 'teacher', 'student']),
  temporaryPassword: passwordSchema,
  rollNo: z.string().trim().min(1).max(30).optional(),
});
export const patchUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0);
export const userListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
});

