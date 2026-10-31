import { z } from 'zod';
import { passwordSchema } from '../lib/password.js';
import { emailSchema } from './common.schema.js';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string('Password is required.').min(1, 'Password is required.').max(200),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({ newPassword: passwordSchema });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.').max(200),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password.',
  });
