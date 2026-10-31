import { z } from 'zod';
import { paginationSchema } from '../lib/pagination.js';
import { COMPLAINT_CATEGORIES } from '../repositories/complaints.repository.js';
import { optionalText, requiredText, uuidSchema } from './common.schema.js';

export const categorySchema = z.enum(COMPLAINT_CATEGORIES, 'Choose a category.');
export const statusSchema = z.enum(
  ['open', 'in_review', 'resolved', 'rejected'],
  'Choose a valid status.',
);

/** Multipart form fields. */
export const createComplaintSchema = z.object({
  category: categorySchema,
  subject: requiredText('Subject', 3, 200),
  description: requiredText('Description', 10, 5000),
  courseId: z
    .union([uuidSchema, z.literal('')])
    .optional()
    .transform((value) => value || null),
});

export const complaintsQuery = paginationSchema.extend({
  status: statusSchema.optional(),
  category: categorySchema.optional(),
  search: optionalText(100),
});

export const adminUpdateComplaintSchema = z
  .object({
    status: statusSchema.optional(),
    adminResponse: z
      .string()
      .trim()
      .max(5000, 'Response must be at most 5,000 characters.')
      .optional(),
  })
  .refine((value) => value.status !== undefined || value.adminResponse !== undefined, {
    message: 'Provide a status or a response.',
  });

export const followUpSchema = z.object({
  comment: requiredText('Follow-up', 1, 2000),
});
