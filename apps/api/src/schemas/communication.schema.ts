import { z } from 'zod';
import { paginationSchema } from '../lib/pagination.js';
import { isoDateTime, requiredText, uuidSchema } from './common.schema.js';

export const createAnnouncementSchema = z.object({
  courseId: uuidSchema.nullable().optional().transform((value) => value ?? null),
  title: requiredText('Title', 1, 200),
  body: requiredText('Message', 1, 10000),
  isPinned: z.boolean().default(false),
});

export const updateAnnouncementSchema = z
  .object({
    title: requiredText('Title', 1, 200).optional(),
    body: requiredText('Message', 1, 10000).optional(),
    isPinned: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const announcementsQuery = paginationSchema.extend({
  courseId: z.union([uuidSchema, z.literal('global')]).optional(),
});

export const markReadSchema = z.object({
  upTo: isoDateTime('upTo').optional(),
});

export const messagesQuery = z.object({
  before: isoDateTime('before').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const sendMessageSchema = z.object({
  body: z
    .string('Message is required.')
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(2000, 'Messages can be at most 2,000 characters.'),
});
